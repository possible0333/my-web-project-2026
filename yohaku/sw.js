/* Build replaces the version; this worker only handles Money Mgr's own files. */
const CACHE='money-mgr-shell-6298628e1f91bd92';
const ROOT=new URL('./',self.location.href).href;
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable.png','apple-touch-icon.png'].map(path=>new URL(path,ROOT).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('money-mgr-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);url.search='';url.hash='';if(!FILES.includes(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(request.mode!=='navigate'){const hit=await cache.match(url.href);if(hit)return hit;return fetch(request);}
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),1800);
  try{const response=await fetch(request,{signal:controller.signal});if(response.ok){await cache.put(url.href,response.clone());return response;}const hit=await cache.match(url.href)||await cache.match(ROOT);return hit||response;}
  catch{const hit=await cache.match(url.href)||await cache.match(ROOT);return hit||new Response('初回はオンラインでMoney Mgrを開いてください。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  finally{clearTimeout(timeout);}
 })());
});
