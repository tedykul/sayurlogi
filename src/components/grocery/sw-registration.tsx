"use client";

import { useEffect } from "react";

// ============================================================
// ServiceWorkerRegistration — registers /sw.js on mount.
// ============================================================

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
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
