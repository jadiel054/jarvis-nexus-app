const CACHE = "jarvis-v1";
const ASSETS = ["/", "/jarvis"];

// Install
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return; // never cache APIs
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push notifications ────────────────────────────────────────────
self.addEventListener("push", e => {
  if (!e.data) return;
  try {
    const data = e.data.json();
    const title = data.title || "J.A.R.V.I.S. Nexus";
    const options = {
      body: data.body || "Nova atualizacao disponivel.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: data.url || "/jarvis" },
      tag: data.tag || "jarvis-default",
      renotify: true,
    };
    e.waitUntil(self.registration.showNotification(title, options));
  } catch {
    e.waitUntil(
      self.registration.showNotification("J.A.R.V.I.S. Nexus", {
        body: e.data.text(),
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/jarvis";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then(clientsArr => {
      const existing = clientsArr.find(c => c.url.includes(url));
      if (existing) {
        existing.focus();
      } else {
        clients.openWindow(url);
      }
    })
  );
});

// ── Message handling — update detection, skip waiting, push subscription ──
self.addEventListener("message", e => {
  if (e.data === "CHECK_UPDATE") {
    self.registration.update();
  }
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (e.data?.type === "SUBSCRIBE_PUSH") {
    const vapidKey = e.data.vapidKey;
    e.waitUntil(
      self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      }).then(sub => {
        // Send subscription to server
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      }).catch(err => {
        console.warn("[SW] Push subscription failed:", err);
      })
    );
  }
});
