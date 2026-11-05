"use client";

import { useEffect } from "react";

// ============================================================
// ServiceWorkerRegistration — registers /sw.js on mount.
// ============================================================
// Also listens for 'controllerchange' (fires when a new SW takes
// control) and auto-reloads the page so the user sees fresh
// content immediately. This is critical for admin-editable content
// — without it, the user would need to reload TWICE after admin
// saves changes (once for SW to update, once for fresh content).
// ============================================================

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none", // always fetch fresh sw.js, never HTTP cache
        });

        // Check for SW updates frequently (every 5 min) so admin
        // changes propagate to users faster. The browser also
        // checks on every navigation, but this catches cases where
        // the user keeps the tab open for a long time.
        const updateInterval = setInterval(() => {
          registration.update().catch(() => {});
        }, 5 * 60 * 1000);

        // Auto-reload when a new SW takes control. This fires
        // after skipWaiting() + clients.claim() in the new SW.
        let refreshing = false;
        const onControllerChange = () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        return () => {
          clearInterval(updateInterval);
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        };
      } catch (err) {
        console.warn("[SW] registration failed:", err);
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
