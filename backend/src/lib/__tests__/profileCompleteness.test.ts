import { describe, it, expect } from "vitest";
import {
  calculateUserProfileCompleteness,
  calculateSchoolProfileCompleteness,
} from "../profileCompleteness";

describe("profileCompleteness engine", () => {
  describe("calculateUserProfileCompleteness", () => {
    it("returns 100% when student has all fields complete", () => {
      const res = calculateUserProfileCompleteness({
        role: "STUDENT",
        hasName: true,
        hasGender: true,
        hasDob: true,
        hasPhoto: true,
        hasIdentityNumber: true,
        hasBloodGroupOrCategory: true,
      });
      expect(res.percent).toBe(100);
      expect(res.missing).toHaveLength(0);
    });

    it("identifies missing photo and identity for student", () => {
      const res = calculateUserProfileCompleteness({
        role: "STUDENT",
        hasName: true,
        hasGender: true,
        hasDob: true,
        hasPhoto: false,
        hasIdentityNumber: false,
        hasBloodGroupOrCategory: true,
      });
      expect(res.percent).toBe(65);
      expect(res.missing).toContain("Profile Photo");
      expect(res.missing).toContain("Aadhaar / APAAR ID");
    });

    it("evaluates parent completeness correctly", () => {
      const res = calculateUserProfileCompleteness({
        role: "PARENT",
        hasName: true,
        hasMobile: true,
        hasEmail: false,
        hasPhoto: false,
      });
      // Name: 40, Mobile: 30 = 70%
      expect(res.percent).toBe(70);
      expect(res.missing).toEqual(["Email Address", "Profile Photo"]);
    });

    it("evaluates driver completeness correctly", () => {
      const res = calculateUserProfileCompleteness({
        role: "DRIVER",
        hasName: true,
        hasMobile: true,
        hasLicence: true,
        hasPhoto: false,
      });
      // Name: 35, Mobile: 25, Licence: 25 = 85%
      expect(res.percent).toBe(85);
      expect(res.missing).toEqual(["Profile Photo"]);
    });

    it("evaluates staff completeness correctly", () => {
      const res = calculateUserProfileCompleteness({
        role: "TEACHER",
        hasName: true,
        hasMobile: true,
        hasPhoto: true,
        hasDepartmentOrDesignation: true,
        hasGender: true,
        hasDob: true,
      });
      expect(res.percent).toBe(100);
      expect(res.missing).toHaveLength(0);
    });
  });

  describe("calculateSchoolProfileCompleteness", () => {
    it("returns 100% when full school profile is populated", () => {
      const res = calculateSchoolProfileCompleteness({
        name: "Greenwood International School",
        address: "123 School Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        phone: "080-12345678",
        email: "contact@greenwood.edu",
        principalName: "Dr. A. Sharma",
        establishedYear: 2005,
        board: "CBSE",
        udiseCode: "29280601234",
        logoS3Key: "schools/gw/logo.png",
        themeColors: { light: "#4f46e5", dark: "#6366f1" },
        website: "https://greenwood.edu",
        motto: "Excellence in Education",
        about: "Leading international CBSE school.",
        socialHandles: { twitter: "@greenwood" },
      });
      expect(res.percent).toBe(100);
      expect(res.missing).toHaveLength(0);
    });

    it("calculates partial score when branding and website are missing", () => {
      const res = calculateSchoolProfileCompleteness({
        name: "Sunrise Academy",
        address: "45 MG Road",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
        phone: "020-88776655",
        email: "info@sunrise.edu",
        principalName: "Mrs. K. Patil",
        establishedYear: 2012,
        board: "ICSE",
        udiseCode: "27251401234",
        logoS3Key: null,
        themeColors: null,
        website: null,
        motto: null,
        about: null,
        socialHandles: null,
      });
      // Basic Info: 50, Affiliation: 20 = 70%
      expect(res.percent).toBe(70);
      expect(res.missing).toContain("School Logo & Theme Colors");
      expect(res.missing).toContain("Website, Motto, About & Social Handles");
    });
  });
});
