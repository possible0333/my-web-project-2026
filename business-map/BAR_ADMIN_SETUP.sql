-- Bar-only moderation. Existing authentication and map permissions are unchanged.
begin;
create schema if not exists bar_private;
revoke all on schema bar_private from public, anon;
grant usage on schema bar_private to authenticated;
create table if not exists public.bar_attendance_overrides (
 uploader_id uuid not null,
 event_date date not null,
 person_id text not null,
 patch jsonb not null default '{}'::jsonb,
 deleted boolean not null default false,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key (uploader_id,event_date,person_id)
);
alter table public.bar_attendance_overrides enable row level security;
revoke all on public.bar_attendance_overrides from public, anon, authenticated;
grant select on public.bar_attendance_overrides to authenticated;
drop policy if exists bar_shared_read on public.bar_attendance_overrides;
create policy bar_shared_read on public.bar_attendance_overrides for select to authenticated using (true);
create table if not exists bar_private.audit (
 id bigint generated always as identity primary key,
 actor uuid not null,
 uploader_id uuid not null,
 event_date date not null,
 person_id text not null,
 before_value jsonb,
 after_value jsonb,
 created_at timestamptz not null default now()
);
alter table bar_private.audit enable row level security;
revoke all on bar_private.audit from public, anon, authenticated;
create or replace function bar_private.moderate(
 p_password text,p_uploader_id uuid,p_event_date date,p_person_id text,
 p_expected_updated_at timestamptz,p_revision integer,p_action text,p_patch jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid:=auth.uid(); v_row public.business_maps%rowtype;
 v_old public.bar_attendance_overrides%rowtype;
 v_entry jsonb; v_patch jsonb; v_deleted boolean; v_result jsonb;
begin
 if v_uid is null then return jsonb_build_object('ok',false,'error','認証が必要です'); end if;
 -- Return, rather than raise, so failed-attempt counters are committed.
 if public.admin_verify_business_maps(p_password) is distinct from true then
  return jsonb_build_object('ok',false,'error','パスワードが違うか、一時的に制限されています');
 end if;
 if p_action is null or p_action not in ('edit','delete','restore') or p_person_id is null or length(p_person_id)>200 then
  return jsonb_build_object('ok',false,'error','操作が不正です');
 end if;
 select * into v_row from public.business_maps where user_id=p_uploader_id for update;
 if not found or v_row.map_data->>'schema' is distinct from 'bar-events-upload-v1' then
  return jsonb_build_object('ok',false,'error','Bar登録が見つかりません');
 end if;
 if v_row.updated_at is distinct from p_expected_updated_at then
  return jsonb_build_object('ok',false,'error','アップロードが更新されています。一覧を更新してください');
 end if;
 select en into v_entry from jsonb_array_elements(v_row.schedule_data->'barEvents'->'events') ev,
 jsonb_array_elements(ev->'entries') en where ev->>'date'=p_event_date::text and en->>'personId'=p_person_id limit 1;
 if v_entry is null then return jsonb_build_object('ok',false,'error','参加者が見つかりません'); end if;
 select * into v_old from public.bar_attendance_overrides where uploader_id=p_uploader_id and event_date=p_event_date and person_id=p_person_id;
 if coalesce(v_old.revision,0) is distinct from p_revision then
  return jsonb_build_object('ok',false,'error','別の管理者が更新しています。一覧を更新してください');
 end if;
 v_patch:=coalesce(v_old.patch,'{}'::jsonb);v_deleted:=coalesce(v_old.deleted,false);
 if p_action='edit' then
  if jsonb_typeof(p_patch) is distinct from 'object' or
   exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('name','sponsor','group','kind','status','slots','arrived')) or
   jsonb_typeof(p_patch->'name') is distinct from 'string' or length(trim(p_patch->>'name')) not between 1 and 80 or
   jsonb_typeof(p_patch->'sponsor') is distinct from 'string' or length(p_patch->>'sponsor')>80 or
   jsonb_typeof(p_patch->'group') is distinct from 'string' or length(p_patch->>'group')>80 or
   coalesce(p_patch->>'kind','') not in ('member','prospect') or
   coalesce(p_patch->>'status','') not in ('yes','pending','no') or
   jsonb_typeof(p_patch->'slots') is distinct from 'array' or
   jsonb_typeof(p_patch->'arrived') is distinct from 'boolean' then
   return jsonb_build_object('ok',false,'error','入力内容が不正です');
  end if;
  if jsonb_array_length(p_patch->'slots')>4 or exists(select 1 from jsonb_array_elements_text(p_patch->'slots') s where s is null or s not in ('A','B','C','D')) then
   return jsonb_build_object('ok',false,'error','時間帯が不正です');
  end if;
  v_patch:=p_patch||jsonb_build_object('name',trim(p_patch->>'name'),'sponsor',trim(p_patch->>'sponsor'),'group',trim(p_patch->>'group'));
 elsif p_action='delete' then v_deleted:=true;
 else v_deleted:=false;
 end if;
 insert into public.bar_attendance_overrides(uploader_id,event_date,person_id,patch,deleted,revision,updated_at)
 values(p_uploader_id,p_event_date,p_person_id,v_patch,v_deleted,coalesce(v_old.revision,0)+1,clock_timestamp())
 on conflict(uploader_id,event_date,person_id) do update set patch=excluded.patch,deleted=excluded.deleted,revision=excluded.revision,updated_at=excluded.updated_at
 returning to_jsonb(bar_attendance_overrides.*) into v_result;
 insert into bar_private.audit(actor,uploader_id,event_date,person_id,before_value,after_value)
 values(v_uid,p_uploader_id,p_event_date,p_person_id,to_jsonb(v_old),v_result);
 return jsonb_build_object('ok',true,'record',v_result);
end;
$$;
revoke all on function bar_private.moderate(text,uuid,date,text,timestamptz,integer,text,jsonb) from public,anon;
grant execute on function bar_private.moderate(text,uuid,date,text,timestamptz,integer,text,jsonb) to authenticated;
create or replace function public.bar_admin_moderate(
 p_password text,p_uploader_id uuid,p_event_date date,p_person_id text,
 p_expected_updated_at timestamptz,p_revision integer,p_action text,p_patch jsonb
) returns jsonb language sql security invoker set search_path='' as $$
 select bar_private.moderate(p_password,p_uploader_id,p_event_date,p_person_id,p_expected_updated_at,p_revision,p_action,p_patch);
$$;
revoke all on function public.bar_admin_moderate(text,uuid,date,text,timestamptz,integer,text,jsonb) from public,anon;
grant execute on function public.bar_admin_moderate(text,uuid,date,text,timestamptz,integer,text,jsonb) to authenticated;
commit;
