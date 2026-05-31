/* TASNEEF V275 cache reset service worker: removes old cached builds and uses network only. */
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>/tasneef/i.test(k)).map(k=>caches.delete(k)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>/tasneef/i.test(k)).map(k=>caches.delete(k)));
    try{ await self.registration.unregister(); }catch(e){}
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => { event.respondWith(fetch(event.request)); });
