// emet service worker: shows phone notifications (sent by /api/push) and opens the right page when one is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let n = {};
  try { n = event.data ? event.data.json() : {}; } catch { n = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(n.title || "emet", {
    body: n.body || "",
    tag: n.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: n.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = tabs.find((c) => c.url.startsWith(self.location.origin));
    if (open) { await open.focus(); return open.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
