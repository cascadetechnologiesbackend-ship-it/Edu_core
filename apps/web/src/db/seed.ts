import "dotenv/config";
import { db } from "./index";
import {
  schools,
  academicYears,
  roles,
  users,
  userRoles,
  students,
  studentFamilyMembers,
  consentPurposes,
  privacyNotices,
  consentRecords,
  admissionWorkflowSteps,
  admissionDocuments,
  waitlist,
  admissionApplications,
  classes,
  sections,
  studentClassHistory,
  salaryTemplates,
  staffDocuments,
  staffLoans,
  leaveBalances,
  exams,
  examSchedules,
  gradeRules,
  reportCardJobs,
  medicalExemptions,
  certificates,
  reportCards,
  markEntries,
  examTypes,
  subjects,
  classSubjects,
  timetablePeriods,
  lessonPlans,
  assignments,
  assignmentSubmissions,
  vehicles,
  routes,
  routeStops,
  studentBusPasses,
  gpsPings,
  // Library tables
  books,
  bookCopies,
  libraryMembers,
  bookIssues,
  bookFines,
  // HR / Payroll / DPDP / Attendance additions
  departments,
  designations,
  staff,
  leaveTypes,
  leaveRequests,
  salaryComponents,
  payrollRuns,
  payslips,
  studentAttendance,
  staffAttendance,
  attendanceNotifications,
  rightsRequests,
  dpdpGrievances,
  auditLogs,
} from "./schema";
import bcrypt from "bcryptjs";
import { CONSENT_PURPOSES, MANDATORY_PURPOSE_IDS } from "@schoolmitra/dpdp";
import crypto from "crypto";
import { eq } from "drizzle-orm";

const ROLES = [
  { name: "SUPER_ADMIN", displayName: "Super Admin", isSystemRole: true },
  { name: "SCHOOL_ADMIN", displayName: "School Admin", isSystemRole: true },
  { name: "PRINCIPAL", displayName: "Principal", isSystemRole: true },
  { name: "HR_MANAGER", displayName: "HR Manager", isSystemRole: true },
  { name: "TEACHER", displayName: "Teacher", isSystemRole: true },
  { name: "ACCOUNTANT", displayName: "Accountant", isSystemRole: true },
  { name: "LIBRARIAN", displayName: "Librarian", isSystemRole: true },
  { name: "TRANSPORT_MANAGER", displayName: "Transport Manager", isSystemRole: true },
  { name: "PARENT", displayName: "Parent", isSystemRole: true },
  { name: "STUDENT", displayName: "Student", isSystemRole: true },
] as const;

const GRADES = [
  "NURSERY",
  "LKG",
  "UKG",
  "CLASS_1",
  "CLASS_2",
  "CLASS_3",
  "CLASS_4",
  "CLASS_5",
  "CLASS_6",
  "CLASS_7",
  "CLASS_8",
  "CLASS_9",
  "CLASS_10",
] as const;

const FIRST_NAMES_MALE = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Rishi", "Dev", "Krishna", "Om", "Kabir", "Aryan", "Dhruv", "Rudra", "Ishaan", "Kartik"];
const FIRST_NAMES_FEMALE = ["Ananya", "Aadhya", "Saanvi", "Diya", "Riya", "Myra", "Kiara", "Kavya", "Pari", "Navya", "Meera", "Zara", "Aarohi", "Ira", "Shruti"];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Singh", "Yadav", "Reddy", "Nair", "Iyer", "Das", "Bose", "Choudhury"];

// AES-256 Encryption Mock
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function getRandomItem<T>(arr: T[] | readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function generateMobile() {
  return "9" + Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
}

function generateAadhaar() {
  return Math.floor(Math.random() * 10000).toString().padStart(4, "0");
}

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Clear existing core data (in reverse dependency order to prevent constraint errors)
  console.log("🧹 Clearing existing data...");
  await db.delete(gpsPings);
  await db.delete(studentBusPasses);
  await db.delete(routeStops);
  await db.delete(routes);
  await db.delete(vehicles);

  await db.delete(bookFines);
  await db.delete(bookIssues);
  await db.delete(libraryMembers);
  await db.delete(bookCopies);
  await db.delete(books);

  await db.delete(assignmentSubmissions);
  await db.delete(assignments);
  await db.delete(lessonPlans);
  await db.delete(classSubjects);
  await db.delete(timetablePeriods);
  await db.delete(subjects);

  await db.delete(auditLogs);
  await db.delete(rightsRequests);
  await db.delete(dpdpGrievances);
  await db.delete(consentRecords);
  await db.delete(consentPurposes);
  await db.delete(privacyNotices);

  await db.delete(payslips);
  await db.delete(payrollRuns);
  await db.delete(salaryComponents);
  await db.delete(staffLoans);
  await db.delete(staffDocuments);
  await db.delete(leaveBalances);
  await db.delete(leaveRequests);
  await db.delete(leaveTypes);
  await db.delete(staffAttendance);
  await db.delete(studentAttendance);
  await db.delete(attendanceNotifications);
  await db.delete(staff);
  await db.delete(designations);
  await db.delete(departments);

  await db.delete(markEntries);
  await db.delete(certificates);
  await db.delete(reportCards);
  await db.delete(reportCardJobs);
  await db.delete(medicalExemptions);
  await db.delete(examSchedules);
  await db.delete(exams);
  await db.delete(examTypes);
  await db.delete(gradeRules);
  await db.delete(salaryTemplates);
  
  await db.delete(studentClassHistory);
  await db.delete(studentFamilyMembers);
  await db.delete(students);
  await db.delete(admissionWorkflowSteps);
  await db.delete(admissionDocuments);
  await db.delete(waitlist);
  await db.delete(admissionApplications);

  // Clear sections and classes before userRoles/users/roles
  await db.delete(sections);
  await db.delete(classes);

  await db.delete(userRoles);
  await db.delete(users);
  await db.delete(roles);

  await db.delete(academicYears);
  await db.delete(schools);

  // 2. Create default School
  console.log("🏫 Creating default school...");
  const [school] = await db
    .insert(schools)
    .values({
      name: "Saraswati Public School",
      board: "CBSE",
      udiseCode: "27251101904",
      address: "123 Education Hub, MG Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      phone: "9876543210",
      email: "contact@saraswati.edu.in",
      principalName: "Dr. Arvind Sharma",
      establishedYear: 2005,
      isActive: true,
    })
    .returning({ id: schools.id });

  if (!school) throw new Error("Failed to create school");

  // 3. Create default Academic Year
  console.log("📅 Creating default academic year...");
  const [academicYear] = await db
    .insert(academicYears)
    .values({
      schoolId: school.id,
      label: "2025-26",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
    })
    .returning({ id: academicYears.id });

  if (!academicYear) throw new Error("Failed to create academic year");

  // 4. DPDP: Create Consent Purposes & Privacy Notice
  console.log("🛡️ Seeding DPDP Act records...");
  await db.insert(consentPurposes).values(
    CONSENT_PURPOSES.map((p) => ({
      purposeId: p.id,
      labelEn: p.label,
      labelHi: p.labelHindi,
      descriptionEn: p.description,
      descriptionHi: p.descriptionHindi,
      mandatory: p.mandatory,
      legalBasis: p.legalBasis,
      retentionDays: p.retentionDays === "LEGAL_HOLD" ? 36500 : p.retentionDays,
    }))
  );

  const [privacyNotice] = await db
    .insert(privacyNotices)
    .values({
      schoolId: school.id,
      version: "1.0",
      titleEn: "Data Privacy Notice (DPDP Act 2023)",
      titleHi: "डेटा गोपनीयता सूचना (डीपीडीपी अधिनियम 2023)",
      contentEn: "We are committed to protecting your child's data...",
      contentHi: "हम आपके बच्चे के डेटा की सुरक्षा के लिए प्रतिबद्ध हैं...",
      publishedAt: new Date(),
      isActive: true,
      changedPurposeIds: [],
    })
    .returning({ version: privacyNotices.version });

  // 5. Create Roles
  console.log("🔑 Creating roles...");
  const createdRoles = await db
    .insert(roles)
    .values(
      ROLES.map((r) => ({
        schoolId: school.id,
        name: r.name,
        displayName: r.displayName,
        isSystemRole: r.isSystemRole,
      }))
    )
    .returning({ id: roles.id, name: roles.name });

  const roleMap = Object.fromEntries(createdRoles.map((r) => [r.name, r.id]));

  // 6. Create Users
  console.log("👤 Creating user accounts...");
  const passwordHash = await bcrypt.hash("schoolmitra_dev", 12);
  const teacherIds: string[] = [];

  for (const roleName of ROLES.map((r) => r.name)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;
    if (roleName === "STUDENT" || roleName === "PARENT") continue; // We will generate these later

    const newUsers = await db
      .insert(users)
      .values(
        Array.from({ length: 5 }).map((_, i) => ({
          schoolId: school.id,
          email: `${roleName.toLowerCase()}${i + 1}@school.edu.in`,
          passwordHash,
          isActive: true,
          isEmailVerified: true,
        }))
      )
      .returning({ id: users.id });

    await db.insert(userRoles).values(
      newUsers.map((u) => ({
        userId: u.id,
        roleId,
        schoolId: school.id,
      }))
    );

    if (roleName === "TEACHER") {
      teacherIds.push(...newUsers.map((u) => u.id));
    }
  }

  // 7. Create Students & Parents (390 students: 30 per grade)
  console.log("🎓 Creating 390 students, parents, and DPDP consent records...");
  const parentRoleId = roleMap["PARENT"];
  const studentRoleId = roleMap["STUDENT"];
  
  if (!parentRoleId || !studentRoleId) throw new Error("Missing roles");

  let admissionNumberCounter = 1000;

  const createdClasses: any[] = [];
  let sortOrder = 1;
  for (const grade of GRADES) {
    console.log(`   -> Generating Class and Sections for ${grade}...`);
    
    // Create Class
    const [cls] = await db.insert(classes).values({
      schoolId: school.id,
      academicYearId: academicYear.id,
      gradeLevel: grade,
      displayName: grade.replace("_", " "),
      sortOrder: sortOrder++,
      isActive: true,
    }).returning({ id: classes.id });

    if (!cls) throw new Error("Failed to create class");
    createdClasses.push(cls);

    // Create Sections A and B (assign teacher1 to Section A, teacher2 to Section B)
    const createdSections = await db.insert(sections).values([
      { classId: cls.id, schoolId: school.id, name: "A", capacity: 30, isActive: true, classTeacherId: teacherIds[0] || null },
      { classId: cls.id, schoolId: school.id, name: "B", capacity: 30, isActive: true, classTeacherId: teacherIds[1] || null },
    ]).returning({ id: sections.id });

    console.log(`   -> Generating 30 students for ${grade}...`);
    for (let i = 0; i < 30; i++) {
      const isMale = Math.random() > 0.5;
      const firstName = getRandomItem(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
      const lastName = getRandomItem(LAST_NAMES);
      const admissionNum = `2025/${grade}/${admissionNumberCounter++}`;
      
      const fatherName = getRandomItem(FIRST_NAMES_MALE) + " " + lastName;
      const motherName = getRandomItem(FIRST_NAMES_FEMALE) + " " + lastName;
      const parentMobile = generateMobile();

      // Create Parent User
      const [parentUser] = await db
        .insert(users)
        .values({
          schoolId: school.id,
          email: `parent_${admissionNumberCounter}@school.edu.in`,
          passwordHash,
          isActive: true,
          isEmailVerified: true,
        })
        .returning({ id: users.id });

      if (!parentUser) throw new Error("Failed to create parent user");

      await db.insert(userRoles).values({
        userId: parentUser.id,
        roleId: parentRoleId,
        schoolId: school.id,
      });

      // Create Student
      const [student] = await db
        .insert(students)
        .values({
          schoolId: school.id,
          academicYearId: academicYear.id,
          admissionNumber: admissionNum,
          firstNameEncrypted: encryptData(firstName),
          lastNameEncrypted: encryptData(lastName),
          dateOfBirth: new Date(2010 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          gender: isMale ? "MALE" : "FEMALE",
          category: "GENERAL",
          aadhaarLast4: generateAadhaar(),
          admissionDate: new Date(),
          primaryParentUserId: parentUser.id,
        })
        .returning({ id: students.id });

      if (!student) throw new Error("Failed to create student");

      // Assign to Section (first 15 to A, next 15 to B)
      const assignedSection = createdSections[i < 15 ? 0 : 1];
      if (assignedSection) {
        await db.insert(studentClassHistory).values({
          studentId: student.id,
          schoolId: school.id,
          academicYearId: academicYear.id,
          classId: cls.id,
          sectionId: assignedSection.id,
          rollNumber: (i % 15 + 1).toString(),
          promotionStatus: "PROMOTED",
        });
      }

      // Create Family Members
      await db.insert(studentFamilyMembers).values([
        {
          studentId: student.id,
          schoolId: school.id,
          relation: "FATHER",
          nameEncrypted: encryptData(fatherName),
          mobileEncrypted: encryptData(parentMobile),
          isPrimaryContact: true,
          hasConsentAuthority: true,
          userId: parentUser.id,
        },
        {
          studentId: student.id,
          schoolId: school.id,
          relation: "MOTHER",
          nameEncrypted: encryptData(motherName),
          hasConsentAuthority: true,
        }
      ]);

      // Create DPDP Consent Records (Mandatory purposes)
      await db.insert(consentRecords).values(
        MANDATORY_PURPOSE_IDS.map(purposeId => ({
          schoolId: school.id,
          studentId: student.id,
          parentUserId: parentUser.id,
          purposeId,
          privacyNoticeVersion: privacyNotice!.version,
          granted: true,
          method: "physical_scan" as const,
          otpVerified: true,
        }))
      );

      // Add transport purpose to the first student for testing
      if (i === 0) {
        await db.insert(consentRecords).values({
          schoolId: school.id,
          studentId: student.id,
          parentUserId: parentUser.id,
          purposeId: "transport",
          privacyNoticeVersion: privacyNotice!.version,
          granted: true,
          method: "physical_scan" as const,
          otpVerified: true,
        });
      }
    }
  }

  // 8. Create Default Subjects and Subject Mappings
  console.log("📚 Seeding default subjects and teacher mapping...");
  const defaultSubjects = await db.insert(subjects).values([
    { schoolId: school.id, code: "MATH101", name: "Mathematics", subjectType: "THEORY", maxMarks: 100, passingMarks: 33 },
    { schoolId: school.id, code: "SCI101", name: "Science", subjectType: "THEORY", maxMarks: 100, passingMarks: 33 },
    { schoolId: school.id, code: "ENG101", name: "English", subjectType: "THEORY", maxMarks: 100, passingMarks: 33 },
  ]).returning({ id: subjects.id, code: subjects.code });

  const mathSub = defaultSubjects.find(s => s.code === "MATH101")!;
  const sciSub = defaultSubjects.find(s => s.code === "SCI101")!;
  const engSub = defaultSubjects.find(s => s.code === "ENG101")!;

  if (createdClasses.length > 0) {
    const firstClass = createdClasses[0];
    await db.insert(classSubjects).values([
      { classId: firstClass.id, subjectId: mathSub.id, schoolId: school.id, assignedTeacherId: teacherIds[0] || null, periodsPerWeek: 5 },
      { classId: firstClass.id, subjectId: sciSub.id, schoolId: school.id, assignedTeacherId: teacherIds[0] || null, periodsPerWeek: 5 },
      { classId: firstClass.id, subjectId: engSub.id, schoolId: school.id, assignedTeacherId: teacherIds[1] || null, periodsPerWeek: 5 },
    ]);
  }

  // 9. Create Default Transport Vehicle, Route, and Stop
  console.log("🚌 Seeding default transport vehicle, route, and stop...");
  const [vehicle] = await db.insert(vehicles).values({
    schoolId: school.id,
    busNumber: "BUS-01",
    registrationNumber: "MH-12-QQ-1234",
    capacity: 40,
    make: "Tata",
    model: "Starbus",
    yearOfManufacture: 2021,
    driverNameEncrypted: encryptData("Rajesh Kumar"),
    driverLicenceEncrypted: encryptData("DL-1420230099887"),
    driverMobileEncrypted: encryptData("9876543210"),
    conductorNameEncrypted: encryptData("Amit Singh"),
    conductorMobileEncrypted: encryptData("9876543211"),
    isActive: true,
  }).returning({ id: vehicles.id });

  if (vehicle) {
    const [route] = await db.insert(routes).values({
      schoolId: school.id,
      vehicleId: vehicle.id,
      routeName: "Route A - Hinjewadi",
      routeCode: "R-A",
      isActive: true,
    }).returning({ id: routes.id });

    if (route) {
      await db.insert(routeStops).values([
        {
          routeId: route.id,
          schoolId: school.id,
          stopName: "Wakad Chowk",
          stopOrder: 1,
          gpsLatitude: "18.5987",
          gpsLongitude: "73.7654",
          estimatedArrivalTime: "07:30",
        },
        {
          routeId: route.id,
          schoolId: school.id,
          stopName: "Dange Chowk",
          stopOrder: 2,
          gpsLatitude: "18.6123",
          gpsLongitude: "73.7745",
          estimatedArrivalTime: "07:45",
        },
      ]);
    }
  }

  // 10. Seed Library Books, Copies, Members, and Issues
  console.log("📚 Seeding default library books and copies...");
  const seededBooks = await db.insert(books).values([
    {
      schoolId: school.id,
      title: "Introduction to Algorithms",
      author: "Thomas H. Cormen",
      publisher: "MIT Press",
      edition: "4th",
      subject: "Computer Science",
      category: "Technical",
      rackLocation: "Rack A-3",
      totalCopies: 2,
      availableCopies: 1,
      isActive: true,
    },
    {
      schoolId: school.id,
      title: "The C++ Programming Language",
      author: "Bjarne Stroustrup",
      publisher: "Addison-Wesley",
      edition: "4th",
      subject: "Computer Science",
      category: "Technical",
      rackLocation: "Rack A-4",
      totalCopies: 2,
      availableCopies: 2,
      isActive: true,
    },
    {
      schoolId: school.id,
      title: "Harry Potter and the Sorcerer's Stone",
      author: "J.K. Rowling",
      publisher: "Scholastic",
      edition: "1st",
      subject: "Fiction",
      category: "Novel",
      rackLocation: "Rack F-1",
      totalCopies: 2,
      availableCopies: 2,
      isActive: true,
    },
  ]).returning({ id: books.id, title: books.title });

  // Add copies for each book
  for (const b of seededBooks) {
    const prefix = b.title.slice(0, 3).toUpperCase();
    await db.insert(bookCopies).values([
      { bookId: b.id, schoolId: school.id, barcodeNumber: `BC-${prefix}-01`, condition: "GOOD", isAvailable: true },
      { bookId: b.id, schoolId: school.id, barcodeNumber: `BC-${prefix}-02`, condition: "GOOD", isAvailable: true },
    ]);
  }

  // Get student to create library member
  const firstStudent = await db.query.students.findFirst({
    where: eq(students.schoolId, school.id),
  });

  if (firstStudent) {
    console.log("💳 Seeding student library member and checkout issue...");
    const [studentMember] = await db.insert(libraryMembers).values({
      schoolId: school.id,
      memberType: "STUDENT",
      memberRefId: firstStudent.id,
      memberCardNumber: "LIB-ST-1001",
      maxBooksAllowed: 3,
      loanPeriodDays: 14,
      isActive: true,
    }).returning({ id: libraryMembers.id });

    // Issue a book to the student
    const firstCopy = await db.query.bookCopies.findFirst({
      where: eq(bookCopies.schoolId, school.id),
    });

    if (firstCopy && studentMember) {
      // Mark copy as checked out
      await db.update(bookCopies)
        .set({ isAvailable: false })
        .where(eq(bookCopies.id, firstCopy.id));

      // Create issue
      await db.insert(bookIssues).values({
        schoolId: school.id,
        bookCopyId: firstCopy.id,
        libraryMemberId: studentMember.id,
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: "ISSUED",
      });
    }
  }

  console.log("✅ Seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
