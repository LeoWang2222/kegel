const CACHE='kegel-v5.1.1';
const ASSETS=['./','./index.html','./styles.css','./refinements.css','./app.js','./peach.svg','./favicon.svg','./manifest.webmanifest','./apple-touch-icon.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(
  ASSETS.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'}))
))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('kegel-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // One atomic app version: HTML and its modules always come from the same cache.
    const hit=await cache.match(request,{ignoreSearch:true});
    if(hit)return hit;
    if(request.mode==='navigate')return await cache.match('./index.html')||fetch(request);
    const response=await fetch(request);
    return response;
  })());
});
