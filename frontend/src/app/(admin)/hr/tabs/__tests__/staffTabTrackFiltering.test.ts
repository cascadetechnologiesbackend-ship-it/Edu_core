import { describe, it, expect } from "vitest";

// Pure logic mirror for track department filtering
function filterDepartmentsByTrack(
  departments: Array<{ id: string; name: string }>,
  designations: Array<{ id: string; name: string; departmentId: string; isTeaching: boolean }>,
  track: "TEACHING" | "NON_TEACHING"
) {
  const isTeaching = track === "TEACHING";

  return departments.filter((dept) => {
    const deptDesignations = designations.filter((des) => des.departmentId === dept.id);
    if (deptDesignations.length > 0) {
      if (isTeaching) {
        return deptDesignations.some((des) => Boolean(des.isTeaching));
      } else {
        return deptDesignations.some((des) => !des.isTeaching);
      }
    }

    const name = (dept.name || "").toLowerCase();
    const isOperationalOrAdmin =
      /finance|account|human resource|\bhr\b|transport|fleet|facilit|campus|maintenance|security|\bit\b|technology|bursar/i.test(name);
    const isPureClassroomAcademic =
      /^(pre-primary|primary|middle school|high school|senior secondary)\s+academic\s+department$/i.test(name.trim());

    if (isTeaching) {
      if (isOperationalOrAdmin) return false;
      return /academic|teach|faculty|curriculum|primary|middle|high|secondary|kg|kindergarten|science|math|language|english|hindi|social|arts/i.test(name);
    } else {
      if (isPureClassroomAcademic) return false;
      return true;
    }
  });
}

describe("StaffTab Faculty Track Department Filtering", () => {
  const departments = [
    { id: "dept-admin", name: "School-Wide Administration" },
    { id: "dept-pre-pri", name: "Pre-Primary Academic Department" },
    { id: "dept-pri", name: "Primary Academic Department" },
    { id: "dept-mid", name: "Middle School Academic Department" },
    { id: "dept-high", name: "High School Academic Department" },
    { id: "dept-fin", name: "Finance & Accounts" },
    { id: "dept-hr", name: "Human Resources" },
    { id: "dept-lib", name: "Library & Information Hub" },
    { id: "dept-trn", name: "Transport & Fleet Logistics" },
    { id: "dept-it", name: "IT & Educational Technology" },
    { id: "dept-ops", name: "Facilities & Campus Operations" },
  ];

  const designations = [
    { id: "d1", name: "Principal", departmentId: "dept-admin", isTeaching: false },
    { id: "d2", name: "Academic Coordinator", departmentId: "dept-admin", isTeaching: true },
    { id: "d3", name: "Primary Teacher (PRT)", departmentId: "dept-pri", isTeaching: true },
    { id: "d4", name: "TGT Science", departmentId: "dept-mid", isTeaching: true },
    { id: "d5", name: "Chief Accountant", departmentId: "dept-fin", isTeaching: false },
    { id: "d6", name: "HR Executive", departmentId: "dept-hr", isTeaching: false },
    { id: "d7", name: "Facilities Manager", departmentId: "dept-ops", isTeaching: false },
  ];

  it("filters out non-teaching departments when TEACHING track is selected", () => {
    const teachingDepts = filterDepartmentsByTrack(departments, designations, "TEACHING");
    const names = teachingDepts.map((d) => d.name);

    expect(names).toContain("Pre-Primary Academic Department");
    expect(names).toContain("Primary Academic Department");
    expect(names).toContain("Middle School Academic Department");
    expect(names).toContain("High School Academic Department");
    expect(names).toContain("School-Wide Administration");

    // Must NOT contain administrative/support departments
    expect(names).not.toContain("Facilities & Campus Operations");
    expect(names).not.toContain("Finance & Accounts");
    expect(names).not.toContain("Human Resources");
    expect(names).not.toContain("Transport & Fleet Logistics");
    expect(names).not.toContain("IT & Educational Technology");
  });

  it("filters out pure academic classroom departments when NON_TEACHING track is selected", () => {
    const nonTeachingDepts = filterDepartmentsByTrack(departments, designations, "NON_TEACHING");
    const names = nonTeachingDepts.map((d) => d.name);

    expect(names).toContain("School-Wide Administration");
    expect(names).toContain("Facilities & Campus Operations");
    expect(names).toContain("Finance & Accounts");
    expect(names).toContain("Human Resources");
    expect(names).toContain("Library & Information Hub");
    expect(names).toContain("Transport & Fleet Logistics");
    expect(names).toContain("IT & Educational Technology");

    // Must NOT contain pure classroom teaching departments
    expect(names).not.toContain("Primary Academic Department");
    expect(names).not.toContain("Middle School Academic Department");
  });
});
