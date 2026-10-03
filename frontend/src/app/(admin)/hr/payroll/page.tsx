import { db } from "@/db";
import { staff, salaryTemplates, staffLoans, departments, designations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { calculateStaffPayroll, ProcessedPayrollRecord } from "@/lib/payrollEngine";
import { PayrollClientWrapper } from "./PayrollClientWrapper";

export const metadata = {
  title: "Monthly Payroll Run & Salary Templates | SchoolMitra ERP",
  description: "Indian statutory payroll calculations, PF/ESI/PT deductions, LWP adjustments, and loan recoveries.",
};

export default async function MonthlyPayrollRunPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);
  const school = await requireSchool(ctx);

  // Fetch School Salary Templates
  const schoolTemplates = await db.query.salaryTemplates.findMany({
    where: and(
      eq(salaryTemplates.schoolId, school.id),
      eq(salaryTemplates.isActive, true)
    ),
  });

  // Default Fallback Template if none seeded yet
  const defaultTemplate = schoolTemplates[0] ? {
    basicPercent: Number(schoolTemplates[0].basicPercent),
    daPercent: Number(schoolTemplates[0].daPercent),
    hraPercent: Number(schoolTemplates[0].hraPercent),
    pfEmployeePercent: Number(schoolTemplates[0].pfEmployeePercent),
    pfEmployerPercent: Number(schoolTemplates[0].pfEmployerPercent),
    esiApplicable: schoolTemplates[0].esiApplicable,
    professionalTaxState: schoolTemplates[0].professionalTaxState,
  } : {
    basicPercent: 50,
    daPercent: 10,
    hraPercent: 20,
    pfEmployeePercent: 12,
    pfEmployerPercent: 12,
    esiApplicable: false,
    professionalTaxState: "DL",
  };

  // Fetch Real Staff Records from DB
  const staffList = await db.query.staff.findMany({
    where: and(
      eq(staff.schoolId, school.id),
      eq(staff.isActive, true)
    ),
    with: {
      department: true,
      designation: true,
    },
    limit: 50,
  });

  // Fetch Staff Loans
  const activeLoans = await db.query.staffLoans.findMany({
    where: and(
      eq(staffLoans.schoolId, school.id),
      eq(staffLoans.status, "ACTIVE")
    ),
  });

  const loanMap: Record<string, { balance: number; emi: number }> = {};
  activeLoans.forEach((loan) => {
    loanMap[loan.staffId] = {
      balance: Number(loan.remainingAmount),
      emi: Number(loan.emiAmount),
    };
  });

  // Prepare Mock/Pre-populated Staff Data if no DB staff enrolled yet
  const sampleStaffData = staffList.length > 0 ? staffList.map((s, idx) => ({
    staffId: s.id,
    staffName: `Staff Member #${idx + 1}`,
    employeeCode: s.employeeCode,
    designationName: s.designation?.name || "Teacher",
    departmentName: s.department?.name || "Academics",
    grossSalary: 35000 + (idx * 5000),
    lwpDays: idx % 4 === 0 ? 2 : 0,
    activeLoanBalance: loanMap[s.id]?.balance || (idx === 2 ? 25000 : 0),
    loanEmiAmount: loanMap[s.id]?.emi || (idx === 2 ? 2500 : 0),
  })) : [
    { staffId: "stf_1", staffName: "Dr. Ramesh Sharma", employeeCode: "EMP001", designationName: "Principal", departmentName: "Administration", grossSalary: 85000, lwpDays: 0, activeLoanBalance: 0, loanEmiAmount: 0 },
    { staffId: "stf_2", staffName: "Sunita Verma", employeeCode: "EMP002", designationName: "Trained Graduate Teacher (TGT)", departmentName: "Middle School Academic", grossSalary: 48000, lwpDays: 1, activeLoanBalance: 30000, loanEmiAmount: 3000 },
    { staffId: "stf_3", staffName: "Rajesh Kumar", employeeCode: "EMP003", designationName: "Primary Teacher (PRT)", departmentName: "Primary Academic", grossSalary: 38000, lwpDays: 0, activeLoanBalance: 0, loanEmiAmount: 0 },
    { staffId: "stf_4", staffName: "Anjali Gupta", employeeCode: "EMP004", designationName: "High School Teacher (TGT)", departmentName: "High School Academic", grossSalary: 52000, lwpDays: 2, activeLoanBalance: 0, loanEmiAmount: 0 },
    { staffId: "stf_5", staffName: "Vikram Singh", employeeCode: "EMP005", designationName: "Chief Accountant / Bursar", departmentName: "Finance & Accounts", grossSalary: 60000, lwpDays: 0, activeLoanBalance: 50000, loanEmiAmount: 5000 },
    { staffId: "stf_6", staffName: "Meenakshi Joshi", employeeCode: "EMP006", designationName: "HR Executive", departmentName: "Human Resources", grossSalary: 42000, lwpDays: 0, activeLoanBalance: 0, loanEmiAmount: 0 },
    { staffId: "stf_7", staffName: "Pooja Nair", employeeCode: "EMP007", designationName: "Head Librarian", departmentName: "Library & Information Hub", grossSalary: 36000, lwpDays: 0, activeLoanBalance: 0, loanEmiAmount: 0 },
    { staffId: "stf_8", staffName: "Mahesh Patil", employeeCode: "EMP008", designationName: "Transport Operations Manager", departmentName: "Transport & Fleet", grossSalary: 32000, lwpDays: 3, activeLoanBalance: 15000, loanEmiAmount: 1500 },
    { staffId: "stf_9", staffName: "Suresh Yadav", employeeCode: "EMP009", designationName: "School Bus Driver", departmentName: "Transport & Fleet", grossSalary: 18000, lwpDays: 0, activeLoanBalance: 0, loanEmiAmount: 0 },
    { staffId: "stf_10", staffName: "Ramesh Pawar", employeeCode: "EMP010", designationName: "Campus Security Guard", departmentName: "Facilities & Operations", grossSalary: 15000, lwpDays: 0, activeLoanBalance: 0, loanEmiAmount: 0 },
  ];

  // Process Payroll Records via Pure Calculation Engine
  const processedRecords: ProcessedPayrollRecord[] = sampleStaffData.map((item) => {
    return calculateStaffPayroll({
      staffId: item.staffId,
      staffName: item.staffName,
      employeeCode: item.employeeCode,
      designationName: item.designationName,
      departmentName: item.departmentName,
      grossSalary: item.grossSalary,
      template: defaultTemplate,
      lwpDays: item.lwpDays,
      totalDaysInMonth: 30,
      activeLoanBalance: item.activeLoanBalance,
      loanEmiAmount: item.loanEmiAmount,
    });
  });

  const formattedTemplates = schoolTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    basicPercent: Number(t.basicPercent),
    daPercent: Number(t.daPercent),
    hraPercent: Number(t.hraPercent),
    pfEmployeePercent: Number(t.pfEmployeePercent),
    pfEmployerPercent: Number(t.pfEmployerPercent),
    esiApplicable: t.esiApplicable,
    professionalTaxState: t.professionalTaxState,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PayrollClientWrapper
        initialRecords={processedRecords}
        templates={formattedTemplates}
        monthLabel="June 2026"
      />
    </div>
  );
}
