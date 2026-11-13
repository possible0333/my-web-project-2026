import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const ctx={crypto:webcrypto};vm.createContext(ctx);vm.runInContext(await readFile(new URL('../bar-events/model.js',import.meta.url),'utf8'),ctx);const M=ctx.BarModel;
function setup(){const db=M.empty();M.pair(db,'2026-11-07');return db;}
test('self attendance reuses existing map member, clears absence slots, and resets next event',()=>{
 const db=setup(),map={name:'Me',kind:'member',sponsor:'Sponsor',source:'map:local:self'};
 const p=M.person(db,map);M.add(db,db.events[0].id,p.id);
 M.setSelf(db,db.events[0].id,'Me',map,{status:'yes',slots:['C','D']});
 assert.equal(db.entries.length,1);assert.equal(db.entries[0].sponsor,'Sponsor');
 assert.equal(M.summary(db.entries).part2,1);assert.equal(M.summary(db.entries).slots.D,0);
 M.setSelf(db,db.events[0].id,'Me',map,{status:'no'});assert.equal(db.entries[0].slots.length,0);
 M.setSelf(db,db.events[1].id,'Me',map,{status:'yes'});
 assert.equal(db.people.length,1);assert.equal(db.entries[1].slots.length,0);
});
test('self attendance reuses unique manual member but never a same-name prospect',()=>{
 const db=setup();M.person(db,{name:'Me',kind:'prospect',sponsor:'Other'});
 const p=M.person(db,{name:'Me',kind:'member',sponsor:'Me'});
 M.setSelf(db,db.events[0].id,'Me',null,{status:'yes',slots:['D']});
 assert.equal(db.people.length,2);assert.equal(db.entries[0].personId,p.id);
 assert.throws(()=>M.setSelf(db,db.events[0].id,'',null,{status:'yes'}));
});
test('automatic schedule works with no uploads and crosses midnight/month/year',()=>{
 assert.equal(M.nextEvent([],'2026-11-02').date,'2026-11-07');
 assert.equal(M.nextEvent([],'2026-11-07').date,'2026-11-07');
 assert.equal(M.nextEvent([],'2026-11-08').date,'2026-11-21');
 assert.equal(M.nextEvent([],'2026-11-21').date,'2026-11-21');
 assert.equal(M.nextEvent([],'2026-11-22').date,'2026-12-05');
 assert.equal(M.nextEvent([],'2026-12-31').date,'2027-01-02');
 const db=setup();assert.equal(M.nextEvent(db.events,'2026-11-02').id,db.events[0].id);
 const custom={id:'custom',date:'2026-08-08'};
 assert.equal(M.nextEvent([custom],'2026-08-01').id,'custom');
 assert.equal(M.nextEvent([custom],'2026-08-09').date,'2026-08-22');
});
test('show only the nearest upcoming event, including today; never fall back to past',()=>{
 const db=setup(),before=JSON.stringify(db);
 assert.equal(M.upcoming([...db.events].reverse(),'2026-11-02').date,'2026-11-07');
 assert.equal(M.upcoming(db.events,'2026-11-07').date,'2026-11-07');
 assert.equal(M.upcoming(db.events,'2026-11-08').date,'2026-11-21');
 assert.equal(M.upcoming(db.events,'2026-11-22'),null);
 assert.equal(M.upcoming([],'2026-11-02'),null);
 assert.equal(JSON.stringify(db),before);
});
test('first Saturday candidates and 14-day pair do not duplicate',()=>{
 const db=setup();M.pair(db,'2026-11-07');assert.equal(db.events.length,2);assert.equal(db.events[1].date,'2026-11-21');
 assert.throws(()=>M.pair(db,'2026-11-10'));assert.throws(()=>M.pair(db,'2026-02-30'));
 assert.equal(M.candidates('2026-08').length,2);
});
test('repeated map imports use identity; names alone are not merged',()=>{
 const db=setup(),p=M.person(db,{name:'Test',source:'map:a',sponsor:'Owner'});
 assert.equal(M.person(db,{name:'Test',source:'map:a'}).id,p.id);
 assert.notEqual(M.person(db,{name:'Test',source:'map:b'}).id,p.id);
 M.add(db,db.events[0].id,p.id);assert.throws(()=>M.add(db,db.events[0].id,p.id));
});
test('only confirmed entries count in slots; overall and part1 counts are unique',()=>{
 const db=setup();for(const status of ['yes','pending','no']){const p=M.person(db,{name:status,kind:'prospect'});M.add(db,db.events[0].id,p.id);M.change(db,db.entries.at(-1).id,{status,slots:['A','B','C','A'],arrived:status==='yes'});}
 const s=M.summary(db.entries,3,2);assert.equal(s.confirmed,1);assert.equal(s.prospects,1);assert.equal(s.part1,1);assert.equal(s.part2,0);assert.equal(s.slots.A,1);assert.equal(s.pending,1);assert.equal(s.remaining,2);assert.equal(s.arrived,1);
});
test('past prospects require actual arrival and honor owner/date filters',()=>{
 const db=setup();for(const [name,sponsor,arrived,kind] of [['one','Me',true,'prospect'],['two','Other',true,'prospect'],['three','Me',false,'prospect'],['four','Me',true,'member']]){const p=M.person(db,{name,sponsor,kind});M.add(db,db.events[0].id,p.id);M.change(db,db.entries.at(-1).id,{arrived});}
 assert.equal(M.past(db,'2026-11-21','Me').length,1);assert.equal(M.past(db,'2026-11-21','Me',true).length,2);assert.equal(M.past(db,'2026-11-07','Me',true).length,0);
 const p=db.people[0];M.add(db,db.events[1].id,p.id);assert.equal(db.entries.at(-1).status,'pending');assert.equal(db.entries.at(-1).slots.length,0);assert.equal(db.entries.at(-1).arrived,false);
});
