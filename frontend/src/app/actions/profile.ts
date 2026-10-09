"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  persons,
  staff,
  students,
  drivers,
  auditLogs,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { encryptData, decryptData, computeSearchHash } from "@/lib/encryption";
import { uploadBufferToS3, getPresignedDownloadUrl } from "@/lib/storage";
import {
  calculateUserProfileCompleteness,
  type CompletenessResult,
} from "@/lib/profileCompleteness";
import {
  selfProfileUpdateSchema,
  type SelfProfileUpdateInput,
} from "@schoolmitra/validators";

export interface DecryptedSelfProfile {
  id: string; // userId
  personId: string;
  role: string;
  email: string;
  schoolId: string | null;
  firstName: string;
  middleName?: string | null | undefined;
  lastName: string;
  mobile: string;
  gender: string;
  dateOfBirth?: string | null | undefined;
  aadhaarLast4?: string | null | undefined;
  photoS3Key?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  address?: string | null | undefined;
  emergencyContact?: string | null | undefined;
  bloodGroup?: string | null | undefined;
  preferredLanguage: string;
  prefersDarkMode: boolean;
  mustChangePassword: boolean;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
}

export interface ReadOnlyProfileDetails {
  designationName?: string | undefined;
  departmentName?: string | undefined;
  employeeCode?: string | undefined;
  joiningDate?: string | undefined;
  contractType?: string | undefined;
  admissionNumber?: string | undefined;
  className?: string | undefined;
  sectionName?: string | undefined;
  rollNumber?: string | undefined;
  licenceNumber?: string | undefined;
  assignedVehicle?: string | undefined;
}

export interface SelfProfileResult {
  success: boolean;
  profile?: DecryptedSelfProfile | undefined;
  completeness?: CompletenessResult | undefined;
  readOnlyDetails?: ReadOnlyProfileDetails | undefined;
  error?: string | undefined;
}

export async function getSelfProfileAction(): Promise<SelfProfileResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return { success: false, error: "User account not found" };
  }

  // Find canonical person linked to this user
  let person = await db.query.persons.findFirst({
    where: and(eq(persons.userId, userId), isNull(persons.deletedAt)),
  });

  // If no person record exists (e.g. legacy seed user), synthesize or insert canonical shell
  if (!person) {
    const defaultType =
      session.user.role === "STUDENT"
        ? "STUDENT"
        : session.user.role === "PARENT"
          ? "PARENT"
          : session.user.role === "DRIVER"
            ? "DRIVER"
            : "STAFF";

    const nameParts = (session.user.name || "User").split(" ");
    const firstName = nameParts[0] || "User";
    const lastName = nameParts.slice(1).join(" ") || "Member";

    const [created] = await db
      .insert(persons)
      .values({
        schoolId: session.user.schoolId || null,
        userId: user.id,
        primaryType: defaultType as any,
        firstNameEncrypted: encryptData(firstName),
        lastNameEncrypted: encryptData(lastName),
        firstNameSearchHash: computeSearchHash(firstName),
        lastNameSearchHash: computeSearchHash(lastName),
        gender: "OTHER",
        primaryEmailEncrypted: encryptData(user.email),
        primaryMobileEncrypted: user.mobileEncrypted,
      })
      .returning();

    person = created;
  }

  const decryptedFirstName = person ? decryptData(person.firstNameEncrypted) || "" : "";
  const decryptedMiddleName = person?.middleNameEncrypted ? decryptData(person.middleNameEncrypted) : null;
  const decryptedLastName = person ? decryptData(person.lastNameEncrypted) || "" : "";
  const decryptedMobile =
    (person?.primaryMobileEncrypted && decryptData(person.primaryMobileEncrypted)) ||
    (user.mobileEncrypted && decryptData(user.mobileEncrypted)) ||
    "";

  let decryptedAddress: string | null = null;
  let decryptedEmergencyContact: string | null = null;
  let bloodGroup: string | null = null;
  const readOnlyDetails: ReadOnlyProfileDetails = {};

  // Role-specific domain enrichment
  const isStaffRole = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "HR_MANAGER",
    "TEACHER",
    "ACCOUNTANT",
    "LIBRARIAN",
    "TRANSPORT_MANAGER",
  ].includes(session.user.role);

  let staffRecord: any = null;
  let studentRecord: any = null;
  let driverRecord: any = null;

  if (isStaffRole) {
    staffRecord = await db.query.staff.findFirst({
      where: and(eq(staff.userId, userId), isNull(staff.deletedAt)),
      with: {
        department: true,
        designation: true,
      },
    });

    if (staffRecord) {
      decryptedAddress = staffRecord.addressEncrypted
        ? decryptData(staffRecord.addressEncrypted)
        : null;
      decryptedEmergencyContact = staffRecord.emergencyContactEncrypted
        ? decryptData(staffRecord.emergencyContactEncrypted)
        : null;

      readOnlyDetails.departmentName = staffRecord.department?.name || undefined;
      readOnlyDetails.designationName = staffRecord.designation?.title || undefined;
      readOnlyDetails.employeeCode = staffRecord.employeeCode || undefined;
      readOnlyDetails.joiningDate = staffRecord.joiningDate
        ? new Date(staffRecord.joiningDate).toISOString().split("T")[0]
        : undefined;
      readOnlyDetails.contractType = staffRecord.contractType || undefined;
    }
  } else if (session.user.role === "STUDENT") {
    studentRecord = await db.query.students.findFirst({
      where: and(eq(students.userId, userId), isNull(students.deletedAt)),
    });

    if (studentRecord) {
      bloodGroup = studentRecord.bloodGroup || null;
      readOnlyDetails.admissionNumber = studentRecord.admissionNumber || undefined;
      readOnlyDetails.rollNumber = studentRecord.rollNumber || undefined;
    }
  } else if (session.user.role === "DRIVER") {
    driverRecord = await db.query.drivers.findFirst({
      where: and(eq(drivers.userId, userId), isNull(drivers.deletedAt)),
      with: {
        vehicle: true,
      },
    });

    if (driverRecord) {
      const decryptedLicence = driverRecord.licenceEncrypted
        ? decryptData(driverRecord.licenceEncrypted) || undefined
        : undefined;
      readOnlyDetails.licenceNumber = decryptedLicence;
      readOnlyDetails.assignedVehicle = driverRecord.vehicle
        ? `${driverRecord.vehicle.busNumber} (${driverRecord.vehicle.registrationNumber})`
        : "Not assigned";
    }
  }

  // Pre-signed download URL for avatar (15-min TTL)
  const photoKey = person?.photoS3Key || staffRecord?.photoS3Key || studentRecord?.photoS3Key || null;
  let avatarUrl: string | null = null;
  if (photoKey) {
    try {
      avatarUrl = await getPresignedDownloadUrl(photoKey, 900); // 15 mins
    } catch (err) {
      console.warn("Could not generate presigned avatar download URL", err);
    }
  }

  // Completeness score
  const completeness = calculateUserProfileCompleteness({
    role: session.user.role,
    hasName: Boolean(decryptedFirstName && decryptedLastName),
    hasMobile: Boolean(decryptedMobile),
    hasEmail: Boolean(user.email),
    hasPhoto: Boolean(photoKey),
    hasGender: Boolean(person?.gender),
    hasDob: Boolean(person?.dateOfBirth),
    hasDepartmentOrDesignation: Boolean(staffRecord?.departmentId || staffRecord?.designationId),
    hasAcademicDetails: Boolean(studentRecord?.admissionNumber),
    hasIdentityNumber: Boolean(person?.aadhaarLast4 || staffRecord?.aadhaarLast4),
    hasBloodGroupOrCategory: Boolean(bloodGroup),
    hasLicence: Boolean(driverRecord?.licenceEncrypted),
  });

  return {
    success: true,
    profile: {
      id: user.id,
      personId: person ? person.id : "",
      role: session.user.role,
      email: user.email,
      schoolId: user.schoolId || null,
      firstName: decryptedFirstName,
      middleName: decryptedMiddleName,
      lastName: decryptedLastName,
      mobile: decryptedMobile,
      gender: person?.gender || "OTHER",
      dateOfBirth: person?.dateOfBirth ? new Date(person.dateOfBirth).toISOString().split("T")[0] : null,
      aadhaarLast4: person?.aadhaarLast4 || null,
      photoS3Key: photoKey,
      avatarUrl,
      address: decryptedAddress,
      emergencyContact: decryptedEmergencyContact,
      bloodGroup,
      preferredLanguage: user.languagePreference || "en",
      prefersDarkMode: user.prefersDarkMode || false,
      mustChangePassword: user.mustChangePassword || false,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
    },
    completeness,
    readOnlyDetails,
  };
}

export async function updateSelfProfileAction(
  data: SelfProfileUpdateInput
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;

  // Runtime prohibited key check (prevent privilege escalation)
  const rawInput = data as Record<string, any>;
  const prohibitedKeys = [
    "id",
    "role",
    "schoolId",
    "salary",
    "panEncrypted",
    "bankAccountEncrypted",
    "passwordHash",
    "mustChangePassword",
    "isActive",
  ];
  for (const key of prohibitedKeys) {
    if (rawInput[key] !== undefined) {
      return { success: false, error: `Forbidden field update: ${key}` };
    }
  }

  const validated = selfProfileUpdateSchema.parse(data);

  // DPDP Consent verification for sensitive health / contact fields
  if (
    (validated.emergencyContact || validated.address || validated.bloodGroup) &&
    !validated.hasGivenDpdpConsent
  ) {
    return {
      success: false,
      error:
        "Explicit DPDP consent is required to process emergency contact, address, or blood group data.",
    };
  }

  const person = await db.query.persons.findFirst({
    where: and(eq(persons.userId, userId), isNull(persons.deletedAt)),
  });

  await db.transaction(async (tx) => {
    // 1. Update users preferences and mobile
    const userUpdates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (validated.themePreference) {
      userUpdates.prefersDarkMode = validated.themePreference === "dark";
    }
    if (validated.preferredLanguage) {
      userUpdates.languagePreference = validated.preferredLanguage;
    }
    if (validated.mobile) {
      userUpdates.mobileEncrypted = encryptData(validated.mobile);
    }

    await tx.update(users).set(userUpdates).where(eq(users.id, userId));

    // 2. Update persons identity
    if (person) {
      const personUpdates: Partial<typeof persons.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (validated.firstName) {
        personUpdates.firstNameEncrypted = encryptData(validated.firstName);
        personUpdates.firstNameSearchHash = computeSearchHash(validated.firstName);
      }
      if (validated.middleName !== undefined) {
        personUpdates.middleNameEncrypted = validated.middleName
          ? encryptData(validated.middleName)
          : null;
      }
      if (validated.lastName) {
        personUpdates.lastNameEncrypted = encryptData(validated.lastName);
        personUpdates.lastNameSearchHash = computeSearchHash(validated.lastName);
      }
      if (validated.mobile) {
        personUpdates.primaryMobileEncrypted = encryptData(validated.mobile);
      }
      if (validated.email) {
        personUpdates.primaryEmailEncrypted = encryptData(validated.email);
      }

      await tx.update(persons).set(personUpdates).where(eq(persons.id, person.id));
    }

    // 3. Update staff domain record if exists
    const staffRow = await tx.query.staff.findFirst({
      where: and(eq(staff.userId, userId), isNull(staff.deletedAt)),
    });
    if (staffRow) {
      const staffUpdates: Partial<typeof staff.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (validated.address !== undefined) {
        staffUpdates.addressEncrypted = validated.address
          ? encryptData(validated.address)
          : null;
      }
      if (validated.emergencyContact !== undefined) {
        staffUpdates.emergencyContactEncrypted = validated.emergencyContact
          ? encryptData(validated.emergencyContact)
          : null;
      }
      if (validated.mobile) {
        staffUpdates.mobileEncrypted = encryptData(validated.mobile);
      }
      if (validated.email) {
        staffUpdates.emailEncrypted = encryptData(validated.email);
      }
      await tx.update(staff).set(staffUpdates).where(eq(staff.id, staffRow.id));
    }

    // 4. Update student domain record if exists
    const studentRow = await tx.query.students.findFirst({
      where: and(eq(students.userId, userId), isNull(students.deletedAt)),
    });
    if (studentRow) {
      const studentUpdates: Partial<typeof students.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (validated.bloodGroup !== undefined) {
        studentUpdates.bloodGroup = validated.bloodGroup as any;
      }
      await tx.update(students).set(studentUpdates).where(eq(students.id, studentRow.id));
    }

    // 5. Audit Log (No Plaintext PII logged)
    await tx.insert(auditLogs).values({
      userId,
      userEmail: "[audit-redacted]",
      userRole: session.user.role,
      schoolId: session.user.schoolId || null,
      action: "WRITE",
      tableName: "persons",
      recordId: person?.id || userId,
      purposeId: "self_service_profile_update",
      ipAddress: "127.0.0.1",
      userAgent: "NextServerAction",
      metadata: {
        updatedKeys: Object.keys(validated).filter(
          (k) => k !== "hasGivenDpdpConsent" && validated[k as keyof typeof validated] !== undefined
        ),
        dpdpConsentGranted: validated.hasGivenDpdpConsent ?? false,
      },
    });
  });

  return { success: true };
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<{ success: boolean; avatarUrl?: string; s3Key?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No image file provided" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Only JPEG, PNG, or WebP images are permitted." };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: "Image file exceeds the 2MB size limit." };
  }

  const userId = session.user.id;
  const person = await db.query.persons.findFirst({
    where: and(eq(persons.userId, userId), isNull(persons.deletedAt)),
  });

  const schoolId = session.user.schoolId || "platform";
  const personId = person?.id || userId;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const s3Key = `${schoolId}/persons/${personId}/avatar-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadResult = await uploadBufferToS3(s3Key, buffer, file.type);
  if (!uploadResult.success) {
    return { success: false, error: uploadResult.error || "Failed to upload avatar to S3" };
  }

  // Update persons table
  if (person) {
    await db
      .update(persons)
      .set({ photoS3Key: s3Key, updatedAt: new Date() })
      .where(eq(persons.id, person.id));
  }

  // If staff record exists, update photoS3Key
  const staffRow = await db.query.staff.findFirst({
    where: and(eq(staff.userId, userId), isNull(staff.deletedAt)),
  });
  if (staffRow) {
    await db
      .update(staff)
      .set({ photoS3Key: s3Key, updatedAt: new Date() })
      .where(eq(staff.id, staffRow.id));
  }

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    userEmail: "[audit-redacted]",
    userRole: session.user.role,
    schoolId: session.user.schoolId || null,
    action: "WRITE",
    tableName: "persons",
    recordId: personId,
    purposeId: "avatar_upload",
    ipAddress: "127.0.0.1",
    userAgent: "NextServerAction",
    metadata: { s3Key, mimeType: file.type, sizeBytes: file.size },
  });

  const signedUrl = await getPresignedDownloadUrl(s3Key, 900); // 15-min TTL

  return { success: true, avatarUrl: signedUrl, s3Key };
}
