import { signOut } from "next-auth/react";

/**
 * Performs a privacy-hardened logout:
 * 1. Instructs Service Worker to purge all cached pages and data via CLEAR_AUTH_CACHE.
 * 2. Purges window.caches directly to ensure no authenticated HTML/data lingers on shared devices.
 * 3. Triggers next-auth signOut().
 */
export async function secureSignOut(options: { callbackUrl?: string } = { callbackUrl: "/login" }) {
  if (typeof window !== "undefined") {
    if ("serviceWorker" in navigator) {
      try {
        navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_AUTH_CACHE" });
      } catch (err) {
        console.warn("ServiceWorker CLEAR_AUTH_CACHE dispatch failed", err);
      }
    }
    if ("caches" in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (err) {
        console.warn("Client caches purge failed", err);
      }
    }
  }

  await signOut(options);
}
