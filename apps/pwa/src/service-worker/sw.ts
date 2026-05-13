/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;
declare const __WB_MANIFEST: (string | { url: string; revision: string | null })[];

precacheAndRoute(__WB_MANIFEST);
cleanupOutdatedCaches();

const navigationHandler = createHandlerBoundToURL("/index.html");
registerRoute(new NavigationRoute(navigationHandler, { denylist: [/^\/api/] }));

registerRoute(
  ({ request, url }) =>
    request.method === "GET" &&
    (url.pathname.startsWith("/devices") || url.pathname.startsWith("/events")),
  new StaleWhileRevalidate({ cacheName: "wcreation-pages" }),
);

self.skipWaiting();
clientsClaim();

self.addEventListener("push", (event) => {
  let title = "WCreation";
  let body = "Nueva notificación";
  let deviceId: string | undefined;
  try {
    const data = event.data?.json() as { title?: string; body?: string; device_id?: string } | undefined;
    if (data?.title) title = data.title;
    if (data?.body) body = data.body;
    deviceId = data?.device_id;
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { deviceId },
      icon: "/pwa-192.svg",
      badge: "/pwa-192.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deviceId = (event.notification.data as { deviceId?: string } | undefined)?.deviceId;
  const url = deviceId ? `/devices/${deviceId}` : "/devices";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          void client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
