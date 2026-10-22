import { NextRequest, NextResponse } from "next/server";
import {
  INDIAN_STATES,
  pincodeToStateDistrict,
} from "../../../../lib/reference/indiaReferenceData";

export interface PincodeResolutionPayload {
  success: boolean;
  source: "online" | "offline-fallback";
  pincode: string;
  state: string;
  stateCode: string;
  district: string;
  city: string;
  localities?: string[];
  message?: string;
}

// In-memory cache for ultra-fast repeated lookups
const pincodeMemoryCache = new Map<string, PincodeResolutionPayload>();

export async function GET(
  _request: NextRequest,
  { params }: { params: { pincode: string } }
) {
  const rawPincode = params.pincode?.trim();

  if (!rawPincode || !/^\d{6}$/.test(rawPincode)) {
    return NextResponse.json(
      { success: false, message: "Invalid PIN code format. Must be 6 digits." },
      { status: 400 }
    );
  }

  // Check cache first
  const cached = pincodeMemoryCache.get(rawPincode);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Online source: India Post Postal Pincode API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://api.postalpincode.in/pincode/${rawPincode}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 86400 }, // 24-hour Next.js cache
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (
        Array.isArray(data) &&
        data[0]?.Status === "Success" &&
        Array.isArray(data[0]?.PostOffice) &&
        data[0].PostOffice.length > 0
      ) {
        const postOffices = data[0].PostOffice;
        const firstPo = postOffices[0];

        // Canonical state matching
        const rawStateName = (firstPo.State || "").trim();
        const matchedState = INDIAN_STATES.find(
          (s) =>
            s.nameEn.toLowerCase() === rawStateName.toLowerCase() ||
            s.code.toLowerCase() === rawStateName.toLowerCase()
        );

        const stateName = matchedState?.nameEn || rawStateName;
        const stateCode = matchedState?.code || "";
        const district = (firstPo.District || "").trim();

        // City/Locality resolution: prefer Block if not "NA", otherwise Name or Division
        let city = "";
        if (firstPo.Block && firstPo.Block.toUpperCase() !== "NA") {
          city = firstPo.Block.trim();
        } else if (firstPo.Name) {
          city = firstPo.Name.trim();
        } else if (firstPo.Division) {
          city = firstPo.Division.trim();
        }

        // Distinct localities in this PIN code
        const localities: string[] = Array.from(
          new Set(
            postOffices
              .map((po: any) => (po.Name || "").trim())
              .filter((name: string) => Boolean(name))
          )
        );

        const payload: PincodeResolutionPayload = {
          success: true,
          source: "online",
          pincode: rawPincode,
          state: stateName,
          stateCode,
          district,
          city,
          localities,
        };

        pincodeMemoryCache.set(rawPincode, payload);
        return NextResponse.json(payload);
      }
    }
  } catch (error) {
    // Network / abort error - fallback gracefully
    console.warn(`[Pincode API] Online lookup failed for ${rawPincode}, falling back to offline index:`, error);
  }

  // Offline Fallback
  const fallback = pincodeToStateDistrict(rawPincode);
  if (fallback) {
    const payload: PincodeResolutionPayload = {
      success: true,
      source: "offline-fallback",
      pincode: rawPincode,
      state: fallback.state,
      stateCode: fallback.stateCode,
      district: fallback.district || "",
      city: "",
    };
    pincodeMemoryCache.set(rawPincode, payload);
    return NextResponse.json(payload);
  }

  return NextResponse.json(
    { success: false, message: "Unable to resolve address for this PIN code." },
    { status: 404 }
  );
}
