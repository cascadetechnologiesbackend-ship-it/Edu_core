/**
 * Profile & School Completeness Engine
 * Calculates weighted completeness percentages and missing field checklists
 * for all ERP user roles and school profiles.
 */

export interface CompletenessItem {
  key: string;
  label: string;
  weight: number;
  isComplete: boolean;
}

export interface CompletenessResult {
  percent: number;
  completedWeight: number;
  totalWeight: number;
  missing: string[];
  completed: string[];
  items: CompletenessItem[];
}

export interface UserProfileCompletenessInput {
  role: string;
  hasName?: boolean;
  hasMobile?: boolean;
  hasEmail?: boolean;
  hasPhoto?: boolean;
  hasGender?: boolean;
  hasDob?: boolean;
  hasDepartmentOrDesignation?: boolean;
  hasAcademicDetails?: boolean; // class/section/admission
  hasIdentityNumber?: boolean; // aadhaar / apaar
  hasBloodGroupOrCategory?: boolean;
  hasLicence?: boolean;
}

export interface SchoolProfileCompletenessInput {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  principalName?: string | null;
  establishedYear?: number | null;
  board?: string | null;
  udiseCode?: string | null;
  logoS3Key?: string | null;
  themeColors?: any;
  website?: string | null;
  motto?: string | null;
  about?: string | null;
  socialHandles?: any;
}

/**
 * Calculates user profile completeness based on role-specific weights.
 */
export function calculateUserProfileCompleteness(
  input: UserProfileCompletenessInput
): CompletenessResult {
  const role = input.role?.toUpperCase() || "STAFF";
  const items: CompletenessItem[] = [];

  if (role === "STUDENT") {
    items.push({
      key: "name",
      label: "Full Name",
      weight: 30,
      isComplete: !!input.hasName,
    });
    items.push({
      key: "gender_dob",
      label: "Date of Birth & Gender",
      weight: 20,
      isComplete: !!input.hasGender && !!input.hasDob,
    });
    items.push({
      key: "photo",
      label: "Profile Photo",
      weight: 20,
      isComplete: !!input.hasPhoto,
    });
    items.push({
      key: "identity_id",
      label: "Aadhaar / APAAR ID",
      weight: 15,
      isComplete: !!input.hasIdentityNumber,
    });
    items.push({
      key: "blood_category",
      label: "Blood Group & Category",
      weight: 15,
      isComplete: !!input.hasBloodGroupOrCategory,
    });
  } else if (role === "PARENT") {
    items.push({
      key: "name",
      label: "Full Name",
      weight: 40,
      isComplete: !!input.hasName,
    });
    items.push({
      key: "mobile",
      label: "Mobile Number",
      weight: 30,
      isComplete: !!input.hasMobile,
    });
    items.push({
      key: "email",
      label: "Email Address",
      weight: 20,
      isComplete: !!input.hasEmail,
    });
    items.push({
      key: "photo",
      label: "Profile Photo",
      weight: 10,
      isComplete: !!input.hasPhoto,
    });
  } else if (role === "DRIVER") {
    items.push({
      key: "name",
      label: "Full Name",
      weight: 35,
      isComplete: !!input.hasName,
    });
    items.push({
      key: "mobile",
      label: "Mobile Number",
      weight: 25,
      isComplete: !!input.hasMobile,
    });
    items.push({
      key: "licence",
      label: "Driving Licence",
      weight: 25,
      isComplete: !!input.hasLicence,
    });
    items.push({
      key: "photo",
      label: "Profile Photo",
      weight: 15,
      isComplete: !!input.hasPhoto,
    });
  } else if (role === "SUPER_ADMIN") {
    items.push({
      key: "name",
      label: "Full Name",
      weight: 40,
      isComplete: !!input.hasName,
    });
    items.push({
      key: "email",
      label: "Email Address",
      weight: 30,
      isComplete: !!input.hasEmail,
    });
    items.push({
      key: "photo",
      label: "Profile Photo",
      weight: 30,
      isComplete: !!input.hasPhoto,
    });
  } else {
    // Default Staff roles (SCHOOL_ADMIN, PRINCIPAL, HR_MANAGER, TEACHER, ACCOUNTANT, LIBRARIAN, TRANSPORT_MANAGER)
    items.push({
      key: "name",
      label: "Full Name",
      weight: 30,
      isComplete: !!input.hasName,
    });
    items.push({
      key: "mobile",
      label: "Contact Mobile",
      weight: 20,
      isComplete: !!input.hasMobile,
    });
    items.push({
      key: "photo",
      label: "Profile Photo",
      weight: 15,
      isComplete: !!input.hasPhoto,
    });
    items.push({
      key: "dept_designation",
      label: "Department & Designation",
      weight: 15,
      isComplete: !!input.hasDepartmentOrDesignation,
    });
    items.push({
      key: "gender_dob",
      label: "Gender & Date of Birth",
      weight: 20,
      isComplete: !!input.hasGender && !!input.hasDob,
    });
  }

  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const completedWeight = items.reduce(
    (sum, i) => sum + (i.isComplete ? i.weight : 0),
    0
  );
  const percent = totalWeight === 0 ? 100 : Math.round((completedWeight / totalWeight) * 100);

  return {
    percent,
    completedWeight,
    totalWeight,
    missing: items.filter((i) => !i.isComplete).map((i) => i.label),
    completed: items.filter((i) => i.isComplete).map((i) => i.label),
    items,
  };
}

/**
 * Calculates school profile completeness across basic, affiliation, branding, and online presence.
 */
export function calculateSchoolProfileCompleteness(
  school: SchoolProfileCompletenessInput
): CompletenessResult {
  const items: CompletenessItem[] = [];

  // Basic Information (50% total)
  const hasBasicInfo =
    !!school.name &&
    !!school.address &&
    !!school.city &&
    !!school.state &&
    !!school.pincode &&
    !!school.phone &&
    !!school.email &&
    !!school.principalName &&
    school.establishedYear !== null &&
    school.establishedYear !== undefined &&
    school.establishedYear > 1800;

  items.push({
    key: "basic_info",
    label: "Basic School Details (Address, Contact, Principal, Year)",
    weight: 50,
    isComplete: hasBasicInfo,
  });

  // Affiliation & Board (20% total)
  const hasAffiliation = !!school.board && !!school.udiseCode;
  items.push({
    key: "affiliation",
    label: "Affiliation Board & UDISE Code",
    weight: 20,
    isComplete: hasAffiliation,
  });

  // Branding & Theme (15% total)
  const hasTheme =
    typeof school.themeColors === "object" &&
    school.themeColors !== null &&
    (!!school.themeColors.light || !!school.themeColors.dark);
  const hasBranding = !!school.logoS3Key || hasTheme;
  items.push({
    key: "branding",
    label: "School Logo & Theme Colors",
    weight: 15,
    isComplete: hasBranding,
  });

  // Online Presence & Social (15% total)
  const hasSocial =
    typeof school.socialHandles === "object" &&
    school.socialHandles !== null &&
    Object.values(school.socialHandles).some((v) => !!v && typeof v === "string" && v.trim().length > 0);
  const hasOnline = !!school.website || !!school.motto || !!school.about || hasSocial;
  items.push({
    key: "online_presence",
    label: "Website, Motto, About & Social Handles",
    weight: 15,
    isComplete: hasOnline,
  });

  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  const completedWeight = items.reduce(
    (sum, i) => sum + (i.isComplete ? i.weight : 0),
    0
  );
  const percent = totalWeight === 0 ? 100 : Math.round((completedWeight / totalWeight) * 100);

  return {
    percent,
    completedWeight,
    totalWeight,
    missing: items.filter((i) => !i.isComplete).map((i) => i.label),
    completed: items.filter((i) => i.isComplete).map((i) => i.label),
    items,
  };
}
