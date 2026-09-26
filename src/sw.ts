/// <reference lib="webworker" />
// This file is bundled by vite-plugin-pwa (injectManifest strategy) into the
// published service worker. It is intentionally excluded from the main
// `tsc -b` project (see tsconfig.json) because the ServiceWorkerGlobalScope
// and DOM lib types conflict when type-checked together - Vite still
// compiles and bundles it normally as part of `vite build`.
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Injected at build time with the app-shell file list (spec §30).
precacheAndRoute(self.__WB_MANIFEST);

// Offline app shell: any navigation falls back to the precached index.html
// so a reload while offline doesn't hard-fail (spec §30 "offline shell").
// This never applies to API/RPC calls to Supabase - only same-origin page
// navigations - so it can't paper over a failed financial write.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// Static build assets (JS/CSS/fonts/images) revalidate in the background
// instead of re-fetching on every load.
registerRoute(
  ({ request }) => ["style", "script", "worker", "font", "image"].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: "ked-app-shell" })
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

/**
 * Web Push handler. The payload shape matches what scheduled-reminders and
 * send-test-push send (see supabase/functions/), a small JSON object with
 * title/message/url - never anything containing another user's data, since
 * each push is addressed to one subscription belonging to one user.
 */
self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; message?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { title: "KED Finance", message: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "KED Finance";
  const options: NotificationOptions = {
    body: payload.message ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url ?? "/notifications" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/** Focuses an existing tab on the target route if one is open, else opens a new one. */
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) ?? "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
