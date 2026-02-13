const CACHE = "erp-pro-cache-v12";
const ASSETS = ["./","./index.html","./styles.css","./print.css","./app.js","./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install", (e)=> {
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e)=> {
  e.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (e)=> {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(r=> r || fetch(e.request).then(resp=>{
      const copy = resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
      return resp;
    }).catch(()=>caches.match("./index.html")))
  );
});
