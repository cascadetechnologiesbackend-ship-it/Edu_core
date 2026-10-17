import { INDIAN_STATES, STATE_BY_CODE } from "./indiaReferenceData";

export interface GeoHintResult {
  state: string;
  stateCode: string;
  city?: string | undefined;
  source: "ip";
}

/**
 * Server-only helper to extract geographic hints from incoming platform HTTP headers.
 * Supports Vercel edge/lambda headers and Cloudflare headers.
 * 
 * Strict Privacy & DPDP Posture:
 * - NO external IP API calls (no third-party tracking).
 * - NO navigator.geolocation browser prompts.
 * - District is never inferred from IP (state-level preselection only).
 * - The hint is purely a client-side convenience default; never persisted by itself.
 */
export function resolveGeoHint(headers: Headers | Record<string, string | string[] | undefined>): GeoHintResult | null {
  try {
    const getHeader = (name: string): string | null => {
      if (typeof (headers as any).get === "function") {
        return (headers as Headers).get(name);
      }
      const val = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
      if (Array.isArray(val)) return val[0] || null;
      return val || null;
    };

    // Check country first if present - only suggest for India
    const country = getHeader("x-vercel-ip-country") || getHeader("cf-ipcountry");
    if (country && country.toUpperCase() !== "IN") {
      return null;
    }

    // Extract region/state code
    const rawRegion =
      getHeader("x-vercel-ip-country-region") ||
      getHeader("cf-region-code") ||
      getHeader("cf-region") ||
      getHeader("x-amz-cf-id-country-region");

    if (!rawRegion) {
      return null;
    }

    const regionUpper = rawRegion.trim().toUpperCase();

    // Map 2-letter state code or name
    let matchedState = STATE_BY_CODE.get(regionUpper);
    if (!matchedState) {
      matchedState = INDIAN_STATES.find(
        (s) =>
          s.code === regionUpper ||
          s.nameEn.toUpperCase() === regionUpper ||
          s.nameEn.replace(/\s+/g, "").toUpperCase() === regionUpper.replace(/\s+/g, "")
      );
    }

    if (!matchedState) {
      return null;
    }

    // Extract optional city name
    const rawCity = getHeader("x-vercel-ip-city") || getHeader("cf-ipcity");
    const city = rawCity ? decodeURIComponent(rawCity).trim() : undefined;

    return {
      state: matchedState.nameEn,
      stateCode: matchedState.code,
      city: city || undefined,
      source: "ip",
    };
  } catch {
    // Fail silently in offline or restricted environments
    return null;
  }
}
