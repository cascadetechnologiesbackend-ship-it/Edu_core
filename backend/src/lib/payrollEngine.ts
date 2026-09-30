/**
 * SchoolMitra ERP Payroll Engine
 *
 * Computes monthly gross salary, statutory deductions (PF, PT, ESI),
 * LWP salary deductions, loan EMI repayments, net pay, and exports
 * EPFO ECR text format files.
 */

export interface SalaryComponentInput {
  basicSalary: number;
  daPercent: number;
  hraPercent: number;
  otherAllowances: Array<{ name: string; amount: number }>;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  esiApplicable: boolean;
  professionalTaxState: string; // "MH" | "KA" | "DL"
}

export interface PayrollDeductionsInput {
  lwpDays: number;
  daysInMonth: number;
  monthlyTdsAmount: number;
  activeLoanEmi: number;
  activeLoanRemaining: number;
}

export interface PayrollCalculationResult {
  baseGross: number;
  daAmount: number;
  hraAmount: number;
  allowancesAmount: number;
  grossSalaryBeforeLwp: number;
  lwpDeduction: number;
  actualGrossSalary: number;
  // Deductions
  pfEmployee: number;
  pfEmployer: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  tds: number;
  loanEmiApplied: number;
  totalDeductions: number;
  netPay: number;
}

/**
 * Calculates gross wages and components before LWP deductions.
 */
export function calculateGrossComponents(input: SalaryComponentInput) {
  const basic = input.basicSalary;
  const da = (basic * input.daPercent) / 100;
  const hra = (basic * input.hraPercent) / 100;
  const allowances = input.otherAllowances.reduce(
    (acc, curr) => acc + curr.amount,
    0,
  );
  const grossBeforeLwp = basic + da + hra + allowances;

  return {
    basic,
    da,
    hra,
    allowances,
    grossBeforeLwp,
  };
}

/**
 * Calculates Professional Tax (PT) based on State slabs and Gross Salary.
 */
export function calculateProfessionalTax(
  gross: number,
  state: string,
  isFebruary = false,
): number {
  const code = state.toUpperCase();
  if (code === "MH") {
    // Maharashtra slabs
    if (gross <= 7500) return 0;
    if (gross <= 10000) return 175;
    return isFebruary ? 250 : 200;
  }
  if (code === "KA") {
    // Karnataka slabs
    if (gross <= 25000) return 0;
    return 200;
  }
  // Delhi or other states (default to 0)
  return 0;
}

/**
 * Calculates Provident Fund (PF) contributions.
 * Under standard rules, contributions are capped at 12% of ₹15,000 (Basic+DA) = ₹1,800.
 */
export function calculateProvidentFund(
  basicAndDa: number,
  employeePercent = 12,
  employerPercent = 12,
  capToStatutoryLimit = true,
) {
  const baseWages = capToStatutoryLimit
    ? Math.min(basicAndDa, 15000)
    : basicAndDa;

  const employeePf = (baseWages * employeePercent) / 100;
  const employerPf = (baseWages * employerPercent) / 100;

  return {
    employeePf: Math.round(employeePf * 100) / 100,
    employerPf: Math.round(employerPf * 100) / 100,
  };
}

/**
 * Calculates ESI contributions (Employee: 0.75%, Employer: 3.25%).
 * Only applicable if Gross Salary <= ₹21,000.
 */
export function calculateESI(gross: number, isApplicable: boolean) {
  if (!isApplicable || gross > 21000) {
    return { employeeEsi: 0, employerEsi: 0 };
  }

  const employeeEsi = (gross * 0.75) / 100;
  const employerEsi = (gross * 3.25) / 100;

  return {
    employeeEsi: Math.round(employeeEsi * 100) / 100,
    employerEsi: Math.round(employerEsi * 100) / 100,
  };
}

/**
 * Main calculation run for a staff member's monthly payroll.
 */
export function runPayrollCalculations(
  salary: SalaryComponentInput,
  deductions: PayrollDeductionsInput,
  isFebruary = false,
): PayrollCalculationResult {
  const { basic, da, hra, allowances, grossBeforeLwp } =
    calculateGrossComponents(salary);

  // 1. Calculate LWP deduction: (GrossBeforeLwp / DaysInMonth) * LWP days
  const dailyRate =
    deductions.daysInMonth > 0 ? grossBeforeLwp / deductions.daysInMonth : 0;
  const lwpDeduction = Math.round(dailyRate * deductions.lwpDays * 100) / 100;

  // Actual Gross Salary after LWP
  const actualGross = Math.max(
    0,
    Math.round((grossBeforeLwp - lwpDeduction) * 100) / 100,
  );

  // PF calculated on (Basic + DA) proportioned after LWP
  // If LWP occurred, wages scale down proportionally
  const actualBasic = Math.max(
    0,
    basic -
      daysRateDeduction(basic, deductions.lwpDays, deductions.daysInMonth),
  );
  const actualDa = Math.max(
    0,
    da - daysRateDeduction(da, deductions.lwpDays, deductions.daysInMonth),
  );
  const pfWages = actualBasic + actualDa;

  // 2. PF Deduction
  const { employeePf, employerPf } = calculateProvidentFund(
    pfWages,
    salary.pfEmployeePercent,
    salary.pfEmployerPercent,
    true, // default cap to EPFO statutory limit of 15k
  );

  // 3. PT Deduction
  const pt = calculateProfessionalTax(
    actualGross,
    salary.professionalTaxState,
    isFebruary,
  );

  // 4. ESI Deduction (based on actualGross)
  const { employeeEsi, employerEsi } = calculateESI(
    actualGross,
    salary.esiApplicable,
  );

  // 5. Loan EMI Deduction (cannot exceed remaining amount or actualGross)
  const loanEmiApplied = Math.min(
    deductions.activeLoanEmi,
    deductions.activeLoanRemaining,
    actualGross,
  );

  // 6. TDS
  const tds = deductions.monthlyTdsAmount;

  // Sum up deductions
  const totalDeductions =
    Math.round((employeePf + employeeEsi + pt + tds + loanEmiApplied) * 100) /
    100;

  // Net Pay
  const netPay = Math.max(
    0,
    Math.round((actualGross - totalDeductions) * 100) / 100,
  );

  return {
    baseGross: basic,
    daAmount: da,
    hraAmount: hra,
    allowancesAmount: allowances,
    grossSalaryBeforeLwp: grossBeforeLwp,
    lwpDeduction,
    actualGrossSalary: actualGross,
    pfEmployee: employeePf,
    pfEmployer: employerPf,
    esiEmployee: employeeEsi,
    esiEmployer: employerEsi,
    professionalTax: pt,
    tds,
    loanEmiApplied,
    totalDeductions,
    netPay,
  };
}

function daysRateDeduction(
  val: number,
  lwpDays: number,
  totalDays: number,
): number {
  if (totalDays <= 0) return 0;
  return Math.round((val / totalDays) * lwpDays * 100) / 100;
}

/**
 * Generates the PF ECR text file format according to EPFO specification.
 * Delimiter: "#~#" (EPFO standard) or "#" (simple delimiter).
 * Output Columns:
 * 1. Member ID
 * 2. Member Name
 * 3. Gross Wages
 * 4. EPF Wages (capped at 15000 or actual)
 * 5. EPS Wages (capped at 15000 or actual)
 * 6. EDLI Wages (capped at 15000 or actual)
 * 7. EPF Contribution (12% employee)
 * 8. EPS Contribution (8.33% employer)
 * 9. Diff EPF and EPS Contribution (3.67% employer)
 * 10. NCP (Non-Contributory Period) Days / LWP days
 * 11. Refunds
 */
export interface EcrRecordInput {
  memberId: string;
  memberName: string;
  grossWages: number;
  epfWages: number; // Basic+DA after LWP
  ncpDays: number; // LWP days
}

export function generatePfEcrFile(records: EcrRecordInput[]): string {
  return records
    .map((r) => {
      const epfWages = Math.min(r.epfWages, 15000);
      const epsWages = Math.min(r.epfWages, 15000); // capped at statutory limit
      const edliWages = Math.min(r.epfWages, 15000);

      // Calculations
      const epfContribution = Math.round(epfWages * 0.12);
      const epsContribution = Math.round(epsWages * 0.0833);
      const diffContribution = Math.round(epfContribution - epsContribution);

      // EPFO ECR line columns format (delimited by #)
      const cols = [
        r.memberId,
        r.memberName,
        Math.round(r.grossWages),
        Math.round(epfWages),
        Math.round(epsWages),
        Math.round(edliWages),
        epfContribution,
        epsContribution,
        diffContribution,
        r.ncpDays,
        0, // Refunds
      ];

      return cols.join("#");
    })
    .join("\r\n");
}
