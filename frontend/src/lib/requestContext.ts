import { headers } from "next/headers";

export interface RequestClientContext {
  ipAddress: string;
  userAgent: string;
}

/**
 * Extracts the real client IP and User-Agent from incoming Next.js request headers.
 * Never defaults or hardcodes to '127.0.0.1' or loopback addresses.
 */
export function getClientRequestContext(): RequestClientContext {
  let ipAddress = "0.0.0.0";
  let userAgent = "SchoolMitra Client";

  try {
    const h = headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first && first !== "127.0.0.1" && first !== "::1") {
        ipAddress = first;
      }
    } else {
      const realIp = h.get("x-real-ip")?.trim();
      if (realIp && realIp !== "127.0.0.1" && realIp !== "::1") {
        ipAddress = realIp;
      }
    }

    const ua = h.get("user-agent");
    if (ua) {
      userAgent = ua;
    }
  } catch {
    // In background or test context where headers() is unavailable
  }

  return { ipAddress, userAgent };
}
