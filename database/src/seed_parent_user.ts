import "dotenv/config";
import { db } from "./index";
import { users, userRoles, roles, students, studentFamilyMembers, schools } from "./schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "e29ed7af4c54ed20a650cd257398652e3dc54b1fc4800b77900192c088532283";

function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

async function main() {
  console.log("=== SEEDING / SYNCHRONIZING PARENT USER ===");

  const targetEmail = "vaibhavabg1234@gmail.com";
  const targetPassword = "Parent@3210";
  const passwordHash = await bcrypt.hash(targetPassword, 12);

  // 1. Get primary school
  const [school] = await db.select().from(schools).limit(1);
  if (!school) {
    throw new Error("No school found");
  }
  console.log(`Using school: ${school.name} (${school.id})`);

  // 2. Ensure PARENT role exists
  let [parentRole] = await db.select().from(roles).where(and(eq(roles.schoolId, school.id), eq(roles.name, "PARENT"))).limit(1);
  if (!parentRole) {
    console.log("Creating PARENT role...");
    const [cr] = await db.insert(roles).values({
      schoolId: school.id,
      name: "PARENT",
      displayName: "Parent / Guardian",
      isSystemRole: true,
    }).returning();
    parentRole = cr;
  }
  if (!parentRole) {
    throw new Error("Could not find or create PARENT role");
  }
  console.log(`PARENT role ID: ${parentRole.id}`);

  // 3. Find or insert user
  let [parentUser] = await db.select().from(users).where(sql`lower(${users.email}) = ${targetEmail}`).limit(1);

  if (parentUser) {
    console.log(`Updating existing user ${parentUser.id} password to '${targetPassword}'...`);
    await db.update(users).set({
      passwordHash,
      isActive: true,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    }).where(eq(users.id, parentUser.id));
  } else {
    console.log(`Creating new user for ${targetEmail}...`);
    const [nu] = await db.insert(users).values({
      schoolId: school.id,
      email: targetEmail,
      passwordHash,
      isActive: true,
      isEmailVerified: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    parentUser = nu;
  }
  if (!parentUser) {
    throw new Error("Could not find or create parent user");
  }
  console.log(`Parent user ready: ${parentUser.id} (${parentUser.email})`);

  // 4. Assign PARENT role to user
  const [existingUserRole] = await db.select().from(userRoles).where(
    and(eq(userRoles.userId, parentUser.id), eq(userRoles.roleId, parentRole.id))
  ).limit(1);

  if (!existingUserRole) {
    console.log("Assigning PARENT role in user_roles...");
    await db.insert(userRoles).values({
      userId: parentUser.id,
      roleId: parentRole.id,
      schoolId: school.id,
    });
  }

  // 5. Link Student record
  const [student] = await db.select().from(students).where(eq(students.schoolId, school.id)).limit(1);
  if (student) {
    console.log(`Linking student ${student.admissionNumber} (${student.id}) to parent user ${parentUser.id}...`);
    await db.update(students).set({
      primaryParentUserId: parentUser.id,
      updatedAt: new Date(),
    }).where(eq(students.id, student.id));

    // 6. Update student family members
    const fams = await db.select().from(studentFamilyMembers).where(eq(studentFamilyMembers.studentId, student.id));
    
    // Father
    const father = fams.find(f => f.relation === "FATHER");
    if (father) {
      console.log("Updating FATHER family member record...");
      await db.update(studentFamilyMembers).set({
        nameEncrypted: encryptData("Dhinakara reddy"),
        emailEncrypted: encryptData(targetEmail),
        mobileEncrypted: encryptData("9874563210"),
        userId: parentUser.id,
        isPrimaryContact: true,
        hasConsentAuthority: true,
        updatedAt: new Date(),
      }).where(eq(studentFamilyMembers.id, father.id));
    } else {
      console.log("Inserting FATHER family member record...");
      await db.insert(studentFamilyMembers).values({
        studentId: student.id,
        schoolId: school.id,
        userId: parentUser.id,
        relation: "FATHER",
        nameEncrypted: encryptData("Dhinakara reddy"),
        emailEncrypted: encryptData(targetEmail),
        mobileEncrypted: encryptData("9874563210"),
        isPrimaryContact: true,
        isEmergencyContact: true,
        hasConsentAuthority: true,
      });
    }

    // Mother
    const mother = fams.find(f => f.relation === "MOTHER");
    if (mother) {
      console.log("Updating MOTHER family member record...");
      await db.update(studentFamilyMembers).set({
        nameEncrypted: encryptData("Vijayalakshmi"),
        emailEncrypted: encryptData(targetEmail),
        mobileEncrypted: encryptData("9874563210"),
        hasConsentAuthority: true,
        updatedAt: new Date(),
      }).where(eq(studentFamilyMembers.id, mother.id));
    } else {
      console.log("Inserting MOTHER family member record...");
      await db.insert(studentFamilyMembers).values({
        studentId: student.id,
        schoolId: school.id,
        relation: "MOTHER",
        nameEncrypted: encryptData("Vijayalakshmi"),
        emailEncrypted: encryptData(targetEmail),
        mobileEncrypted: encryptData("9874563210"),
        isEmergencyContact: true,
        hasConsentAuthority: true,
      });
    }
  }

  // 7. Verify bcrypt compare
  const isValid = await bcrypt.compare(targetPassword, passwordHash);
  console.log(`\nVerification: bcrypt.compare("${targetPassword}", hash) === ${isValid}`);
  console.log("SUCCESS! User is now fully provisioned and ready to log in.");

  process.exit(0);
}

main().catch(err => {
  console.error("Error provisioning parent:", err);
  process.exit(1);
});
