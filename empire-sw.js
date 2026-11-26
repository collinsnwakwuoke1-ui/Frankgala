const CACHE="frankgala-empire-control-v1";
const SHELL=["/empire-control","/admin.html","/empire.webmanifest","/empire-icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.includes("/rest/")||url.pathname.includes("/auth/"))return;if(req.mode==="navigate"){event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return response;}).catch(()=>caches.match(req).then(hit=>hit||caches.match("/admin.html"))));}});
