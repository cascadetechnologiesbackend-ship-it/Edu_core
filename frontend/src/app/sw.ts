import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // 1. Exclude all /api/* routes completely (ERP financial and student correctness)
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
      handler: ({ request }: any) => fetch(request),
    },
    // 2. Exclude Razorpay external checkout
    {
      matcher: ({ url }: { url: URL }) => url.hostname.includes("razorpay.com"),
      handler: ({ request }: any) => fetch(request),
    },
    // 3. Static assets: Cache-First
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/_next/static/"),
      handler: async ({ request }: any) => {
        const cache = await caches.open("schoolmitra-static-assets");
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) {
          cache.put(request, res.clone());
        }
        return res;
      },
    },
    // 4. Default cache strategies
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }: { request: Request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Clear auth page caches on sign out
self.addEventListener("message", (event: any) => {
  if (event.data?.type === "CLEAR_AUTH_CACHE") {
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.includes("static")).map((k) => caches.delete(k)))
    );
  }
});
