/* Mrs.Rana service worker — cache-first for app shell */
const CACHE = "mrsrana-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./login2.html",
    "./register-teacher.html",
    "./dashboard.html",
    "./guardian.html",
    "./style.css",
    "./script.js",
    "./login2.js",
    "./dashboard.js",
    "./guardian.js",
    "./register-teacher.js",
    "./supabase-config.js",
    "./db.js",
    "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    e.respondWith(
        caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
    );
});
