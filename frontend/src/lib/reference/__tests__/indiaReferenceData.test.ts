import { describe, it, expect } from "vitest";
import {
  INDIAN_STATES,
  pincodeToStateDistrict,
  normalizeProfessionalTaxState,
  getDistrictsForState,
  getStateByCode,
  CANONICAL_RELIGIONS,
  CANONICAL_CATEGORIES,
  CANONICAL_MOTHER_TONGUES,
} from "../indiaReferenceData";
import { resolveGeoHint } from "../addressGeo";

describe("India Reference Data Layer", () => {
  describe("Canonical States & Union Territories", () => {
    it("contains all 28 states and 8 union territories (36 total)", () => {
      expect(INDIAN_STATES).toHaveLength(36);

      const states = INDIAN_STATES.filter((s) => !s.isUnionTerritory);
      const uts = INDIAN_STATES.filter((s) => s.isUnionTerritory);

      expect(states).toHaveLength(28);
      expect(uts).toHaveLength(8);
    });

    it("has unique 2-letter codes and bilingual labels for all states", () => {
      const codes = new Set<string>();
      for (const s of INDIAN_STATES) {
        expect(s.code).toHaveLength(2);
        expect(s.nameEn.length).toBeGreaterThan(1);
        expect(s.nameHi.length).toBeGreaterThan(1);
        expect(codes.has(s.code)).toBe(false);
        codes.add(s.code);
      }
    });

    it("retrieves state by code", () => {
      const ka = getStateByCode("KA");
      expect(ka?.nameEn).toBe("Karnataka");
      expect(ka?.nameHi).toBe("कर्नाटक");

      const dl = getStateByCode("dl");
      expect(dl?.nameEn).toBe("Delhi");
    });
  });

  describe("Pincode-First Autofill (pincodeToStateDistrict)", () => {
    it("resolves exact state and district for major urban centres in India", () => {
      // Bengaluru
      const blr = pincodeToStateDistrict("560001");
      expect(blr).toEqual({
        state: "Karnataka",
        stateCode: "KA",
        district: "Bengaluru Urban",
      });

      // New Delhi
      const del = pincodeToStateDistrict("110001");
      expect(del).toEqual({
        state: "Delhi",
        stateCode: "DL",
        district: "New Delhi",
      });

      // Mumbai
      const bom = pincodeToStateDistrict("400001");
      expect(bom).toEqual({
        state: "Maharashtra",
        stateCode: "MH",
        district: "Mumbai City",
      });

      // Chennai
      const maa = pincodeToStateDistrict("600001");
      expect(maa).toEqual({
        state: "Tamil Nadu",
        stateCode: "TN",
        district: "Chennai",
      });

      // Kolkata
      const ccu = pincodeToStateDistrict("700001");
      expect(ccu).toEqual({
        state: "West Bengal",
        stateCode: "WB",
        district: "Kolkata",
      });

      // Hyderabad
      const hyd = pincodeToStateDistrict("500001");
      expect(hyd).toEqual({
        state: "Telangana",
        stateCode: "TG",
        district: "Hyderabad",
      });

      // Jaipur
      const jai = pincodeToStateDistrict("302001");
      expect(jai).toEqual({
        state: "Rajasthan",
        stateCode: "RJ",
        district: "Jaipur",
      });

      // Lucknow
      const lko = pincodeToStateDistrict("226001");
      expect(lko).toEqual({
        state: "Uttar Pradesh",
        stateCode: "UP",
        district: "Lucknow",
      });

      // Patna
      const pat = pincodeToStateDistrict("800001");
      expect(pat).toEqual({
        state: "Bihar",
        stateCode: "BR",
        district: "Patna",
      });
    });

    it("falls back gracefully to state resolution for non-urban 2-digit prefixes", () => {
      const res = pincodeToStateDistrict("569999");
      expect(res).not.toBeNull();
      expect(res?.state).toBe("Karnataka");
      expect(res?.stateCode).toBe("KA");
    });

    it("rejects invalid, short, or non-numeric PIN codes", () => {
      expect(pincodeToStateDistrict("")).toBeNull();
      expect(pincodeToStateDistrict(null)).toBeNull();
      expect(pincodeToStateDistrict(undefined)).toBeNull();
      expect(pincodeToStateDistrict("12345")).toBeNull();
      expect(pincodeToStateDistrict("1234567")).toBeNull();
      expect(pincodeToStateDistrict("56000A")).toBeNull();
      expect(pincodeToStateDistrict("999999")).toBeNull();
    });

    it("executes 5,000 lookups in under 50ms total (<0.01ms per lookup, zero network)", () => {
      const pins = ["560001", "110001", "400001", "600001", "700001", "500001", "302001", "226001"];
      const start = performance.now();
      for (let i = 0; i < 5000; i++) {
        pincodeToStateDistrict(pins[i % pins.length]);
      }
      const elapsedMs = performance.now() - start;
      expect(elapsedMs).toBeLessThan(50);
    });
  });

  describe("Professional Tax State Normalization", () => {
    it("normalizes canonical 2-letter codes and case variations", () => {
      expect(normalizeProfessionalTaxState("DL")).toBe("DL");
      expect(normalizeProfessionalTaxState("dl")).toBe("DL");
      expect(normalizeProfessionalTaxState("KA")).toBe("KA");
      expect(normalizeProfessionalTaxState("ka")).toBe("KA");
      expect(normalizeProfessionalTaxState("MH")).toBe("MH");
    });

    it("normalizes legacy full-text states (e.g. 'KARNATAKA', 'Karnataka', 'Delhi')", () => {
      expect(normalizeProfessionalTaxState("KARNATAKA")).toBe("KA");
      expect(normalizeProfessionalTaxState("karnataka")).toBe("KA");
      expect(normalizeProfessionalTaxState("Karnataka")).toBe("KA");
      expect(normalizeProfessionalTaxState("Delhi")).toBe("DL");
      expect(normalizeProfessionalTaxState("DELHI")).toBe("DL");
      expect(normalizeProfessionalTaxState("Maharashtra")).toBe("MH");
      expect(normalizeProfessionalTaxState("West Bengal")).toBe("WB");
      expect(normalizeProfessionalTaxState("Tamil Nadu")).toBe("TN");
    });

    it("normalizes historical/legacy variations", () => {
      expect(normalizeProfessionalTaxState("Orissa")).toBe("OR");
      expect(normalizeProfessionalTaxState("Pondicherry")).toBe("PY");
      expect(normalizeProfessionalTaxState("Uttaranchal")).toBe("UK");
      expect(normalizeProfessionalTaxState("NCT")).toBe("DL");
    });

    it("returns null for unmatched, empty, or gibberish inputs", () => {
      expect(normalizeProfessionalTaxState("XYZ_STATE")).toBeNull();
      expect(normalizeProfessionalTaxState("")).toBeNull();
      expect(normalizeProfessionalTaxState("   ")).toBeNull();
      expect(normalizeProfessionalTaxState(null)).toBeNull();
      expect(normalizeProfessionalTaxState(undefined)).toBeNull();
    });
  });

  describe("Districts Per State", () => {
    it("returns districts list for valid state code or name", () => {
      const kaDistricts = getDistrictsForState("KA");
      expect(kaDistricts.length).toBeGreaterThan(25);
      expect(kaDistricts.some((d) => d.en === "Bengaluru Urban")).toBe(true);
      expect(kaDistricts.some((d) => d.hi === "बेंगलुरु शहरी")).toBe(true);

      const dlDistricts = getDistrictsForState("Delhi");
      expect(dlDistricts.length).toBe(11);
      expect(dlDistricts.some((d) => d.en === "New Delhi")).toBe(true);
    });

    it("returns empty array for invalid state", () => {
      expect(getDistrictsForState("INVALID")).toEqual([]);
      expect(getDistrictsForState("")).toEqual([]);
    });
  });

  describe("Canonical Demographics & Scheduled Languages", () => {
    it("provides canonical religions list with bilingual labels", () => {
      expect(CANONICAL_RELIGIONS.length).toBeGreaterThanOrEqual(9);
      expect(CANONICAL_RELIGIONS.some((r) => r.en === "Hinduism" && r.hi === "हिन्दू धर्म")).toBe(true);
      expect(CANONICAL_RELIGIONS.some((r) => r.en === "Islam" && r.hi === "इस्लाम")).toBe(true);
      expect(CANONICAL_RELIGIONS.some((r) => r.en === "Other")).toBe(true);
    });

    it("provides categories aligned with categoryEnum and curated sub-castes", () => {
      const categoryCodes = CANONICAL_CATEGORIES.map((c) => c.code);
      expect(categoryCodes).toContain("GENERAL");
      expect(categoryCodes).toContain("OBC");
      expect(categoryCodes).toContain("SC");
      expect(categoryCodes).toContain("ST");
      expect(categoryCodes).toContain("EWS");

      const obc = CANONICAL_CATEGORIES.find((c) => c.code === "OBC");
      expect(obc?.subCastes.length).toBeGreaterThan(5);
      expect(obc?.subCastes.some((s) => s.en.includes("Yadav"))).toBe(true);
    });

    it("provides 22 scheduled Indian languages plus common extras", () => {
      expect(CANONICAL_MOTHER_TONGUES.length).toBeGreaterThanOrEqual(25);
      expect(CANONICAL_MOTHER_TONGUES.some((l) => l.en === "Hindi" && l.hi === "हिन्दी")).toBe(true);
      expect(CANONICAL_MOTHER_TONGUES.some((l) => l.en === "Kannada" && l.hi === "कन्नड़")).toBe(true);
      expect(CANONICAL_MOTHER_TONGUES.some((l) => l.en === "English")).toBe(true);
    });
  });

  describe("Server Geo Hint Resolver (addressGeo)", () => {
    it("extracts state and city from Vercel platform headers", () => {
      const headers = new Headers({
        "x-vercel-ip-country": "IN",
        "x-vercel-ip-country-region": "KA",
        "x-vercel-ip-city": "Bengaluru",
      });

      const hint = resolveGeoHint(headers);
      expect(hint).toEqual({
        state: "Karnataka",
        stateCode: "KA",
        city: "Bengaluru",
        source: "ip",
      });
    });

    it("extracts state from Cloudflare platform headers", () => {
      const headers = new Headers({
        "cf-ipcountry": "IN",
        "cf-region": "DL",
        "cf-ipcity": "New Delhi",
      });

      const hint = resolveGeoHint(headers);
      expect(hint).toEqual({
        state: "Delhi",
        stateCode: "DL",
        city: "New Delhi",
        source: "ip",
      });
    });

    it("returns null when non-India country header is detected", () => {
      const headers = new Headers({
        "x-vercel-ip-country": "US",
        "x-vercel-ip-country-region": "CA",
      });

      expect(resolveGeoHint(headers)).toBeNull();
    });

    it("returns null when no geo headers are present", () => {
      expect(resolveGeoHint(new Headers())).toBeNull();
    });
  });
});
