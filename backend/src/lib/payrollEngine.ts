export interface SalaryTemplateConfig {
  id?: string;
  name?: string;
  basicPercent: number; // e.g. 50
  daPercent: number;    // e.g. 10
  hraPercent: number;   // e.g. 20
  pfEmployeePercent?: number; // default 12%
  pfEmployerPercent?: number; // default 12%
  esiApplicable?: boolean;    // auto-checked if Gross <= 21,000 INR
  professionalTaxState?: string; // default "DL" / "MH"
}

export interface PayrollInput {
  staffId: string;
  staffName: string;
  employeeCode: string;
  designationName?: string;
  departmentName?: string;
  grossSalary: number;
  template: SalaryTemplateConfig;
  lwpDays?: number;
  totalDaysInMonth?: number;
  activeLoanBalance?: number;
  loanEmiAmount?: number;
  customDeductions?: number;
}

export interface StatutoryBreakdown {
  pfWageBase: number;
  pfCappedWageBase: number;
  employeePF: number;
  employerEPF: number; // 3.67%
  employerEPS: number; // 8.33% capped at 1,250 INR
  totalEmployerPF: number; // 12%
  isEsiEligible: boolean;
  esiWageBase: number;
  employeeESI: number; // 0.75%
  employerESI: number; // 3.25%
  professionalTax: number; // 0 or 200 INR
}

export interface ProcessedPayrollRecord {
  staffId: string;
  staffName: string;
  employeeCode: string;
  designationName: string;
  departmentName: string;
  
  // Gross & Component Breakdown
  grossSalary: number;
  basicSalary: number;
  daAmount: number;
  hraAmount: number;
  specialAllowance: number;
  
  // Loss of Pay (LWP)
  lwpDays: number;
  dailyRate: number;
  lwpDeduction: number;
  effectiveGross: number;
  
  // Statutory Calculations
  statutory: StatutoryBreakdown;
  
  // Loan Ledger Deductions
  activeLoanBalance: number;
  loanEmiDeduction: number;
  remainingLoanBalance: number;
  
  // Summary Aggregates
  totalStatutoryDeductions: number;
  totalDeductions: number;
  netPay: number;
}

/**
 * Pure mathematical calculation engine for Indian School ERP Payroll.
 * Enforces PF 12% @ 15k cap, ESI 0.75%/3.25% @ 21k ceiling, PT tiered rules, LWP & Loan EMI deduction logic.
 */
export function calculateStaffPayroll(input: PayrollInput): ProcessedPayrollRecord {
  const {
    staffId,
    staffName,
    employeeCode,
    designationName,
    departmentName,
    grossSalary,
    template,
    lwpDays = 0,
    totalDaysInMonth = 30,
    activeLoanBalance = 0,
    loanEmiAmount = 0,
    customDeductions = 0,
  } = input;

  const validGross = Math.max(0, grossSalary);
  const daysInMonth = totalDaysInMonth > 0 ? totalDaysInMonth : 30;

  // 1. Calculate Component Breakdown (Ensuring exact 100% allocation with Special Allowance fallback)
  const basicPct = Math.min(100, Math.max(0, template.basicPercent || 50));
  const daPct = Math.min(100 - basicPct, Math.max(0, template.daPercent || 0));
  const hraPct = Math.min(100 - (basicPct + daPct), Math.max(0, template.hraPercent || 0));
  const specialPct = Math.max(0, 100 - (basicPct + daPct + hraPct));

  // 2. Compute Loss of Pay (LWP) Daily Deduction
  const dailyRate = validGross / daysInMonth;
  const lwpDeduction = Math.min(validGross, Math.round(dailyRate * Math.max(0, lwpDays)));
  const effectiveGross = Math.max(0, validGross - lwpDeduction);

  // Scaled Salary Component Breakdown based on Effective Gross
  const basicSalary = Math.round(effectiveGross * (basicPct / 100));
  const daAmount = Math.round(effectiveGross * (daPct / 100));
  const hraAmount = Math.round(effectiveGross * (hraPct / 100));
  const specialAllowance = Math.max(0, effectiveGross - (basicSalary + daAmount + hraAmount));

  // 3. Statutory Computations (Indian Compliance)
  const pfWageBase = basicSalary + daAmount;
  const pfCappedWageBase = Math.min(15000, pfWageBase);
  const pfEmpRate = (template.pfEmployeePercent ?? 12) / 100;
  
  const employeePF = Math.round(pfCappedWageBase * pfEmpRate);
  
  // Employer PF Breakdown (3.67% EPF + 8.33% EPS capped at 1,250 INR)
  const employerEPS = Math.min(1250, Math.round(pfCappedWageBase * 0.0833));
  const employerEPF = Math.max(0, Math.round(pfCappedWageBase * 0.12) - employerEPS);
  const totalEmployerPF = employerEPF + employerEPS;

  // ESI (Applied if Gross <= 21,000 INR)
  const isEsiEligible = validGross <= 21000 || !!template.esiApplicable;
  const esiWageBase = isEsiEligible ? effectiveGross : 0;
  const employeeESI = isEsiEligible ? Math.ceil(effectiveGross * 0.0075) : 0;
  const employerESI = isEsiEligible ? Math.ceil(effectiveGross * 0.0325) : 0;

  // Professional Tax (PT)
  const professionalTax = calculateProfessionalTax(effectiveGross, template.professionalTaxState || "DL");

  const statutory: StatutoryBreakdown = {
    pfWageBase,
    pfCappedWageBase,
    employeePF,
    employerEPF,
    employerEPS,
    totalEmployerPF,
    isEsiEligible,
    esiWageBase,
    employeeESI,
    employerESI,
    professionalTax,
  };

  // 4. Loan Ledger Recovery (Deduct EMI up to active balance)
  const loanEmiDeduction = Math.min(Math.max(0, activeLoanBalance), Math.max(0, loanEmiAmount));
  const remainingLoanBalance = Math.max(0, activeLoanBalance - loanEmiDeduction);

  // 5. Total Deductions & Net Pay
  const totalStatutoryDeductions = employeePF + employeeESI + professionalTax;
  const totalDeductions = lwpDeduction + totalStatutoryDeductions + loanEmiDeduction + customDeductions;
  const netPay = Math.max(0, effectiveGross - totalStatutoryDeductions - loanEmiDeduction - customDeductions);

  return {
    staffId,
    staffName,
    employeeCode,
    designationName: designationName || "",
    departmentName: departmentName || "",
    grossSalary: validGross,
    basicSalary,
    daAmount,
    hraAmount,
    specialAllowance,
    lwpDays,
    dailyRate: Math.round(dailyRate),
    lwpDeduction,
    effectiveGross,
    statutory,
    activeLoanBalance,
    loanEmiDeduction,
    remainingLoanBalance,
    totalStatutoryDeductions,
    totalDeductions,
    netPay,
  };
}

// ── Legacy & Helper Calculation Exports for Test Suite & API Routes ───────

export function calculateGrossComponents(params: {
  basicSalary: number;
  daPercent: number;
  hraPercent: number;
  otherAllowances?: Array<{ name: string; amount: number }>;
  pfEmployeePercent?: number;
  pfEmployerPercent?: number;
  esiApplicable?: boolean;
  professionalTaxState?: string;
}) {
  const basic = Math.max(0, params.basicSalary);
  const da = Math.round(basic * ((params.daPercent || 0) / 100));
  const hra = Math.round(basic * ((params.hraPercent || 0) / 100));
  const allowances = (params.otherAllowances || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const grossBeforeLwp = basic + da + hra + allowances;
  return { basic, da, hra, allowances, grossBeforeLwp };
}

export function calculateProfessionalTax(
  grossAmount: number,
  stateCode: string = "DL",
  isFebruary: boolean = false
): number {
  const code = (stateCode || "DL").toUpperCase();
  if (code === "KA") {
    return grossAmount > 25000 ? 200 : 0;
  }
  if (code === "MH") {
    if (grossAmount <= 7500) return 0;
    if (grossAmount <= 10000) return 175;
    return isFebruary ? 250 : 200;
  }
  if (code === "DL") {
    return 0; // Delhi has no PT
  }
  return grossAmount > 15000 ? 200 : 0;
}

export function calculateProvidentFund(
  pfWages: number,
  employeePercent: number = 12,
  employerPercent: number = 12,
  capWageLimit: boolean = true
) {
  const cappedWages = capWageLimit ? Math.min(15000, Math.max(0, pfWages)) : Math.max(0, pfWages);
  const employeePf = Math.round(cappedWages * (employeePercent / 100));
  const employerPf = Math.round(cappedWages * (employerPercent / 100));
  return { employeePf, employerPf, cappedWages };
}

export function calculateESI(grossSalary: number, esiApplicable: boolean = true) {
  if (!esiApplicable || grossSalary > 21000) {
    return { employeeEsi: 0, employerEsi: 0 };
  }
  const employeeEsi = Math.ceil(grossSalary * 0.0075);
  const employerEsi = Math.ceil(grossSalary * 0.0325);
  return { employeeEsi, employerEsi };
}

export function runPayrollCalculations(salaryConfig: any, deductionsInput: any, isFeb: boolean = false) {
  const { basic, da, hra, allowances, grossBeforeLwp } = calculateGrossComponents({
    basicSalary: salaryConfig.basicSalary || 0,
    daPercent: salaryConfig.daPercent || 0,
    hraPercent: salaryConfig.hraPercent || 0,
    otherAllowances: salaryConfig.otherAllowances || [],
  });

  const daysInMonth = deductionsInput.daysInMonth || 30;
  const lwpDays = deductionsInput.lwpDays || 0;
  const lwpDeduction = Math.round((grossBeforeLwp / daysInMonth) * lwpDays);
  const actualGrossSalary = Math.max(0, grossBeforeLwp - lwpDeduction);

  const pfWageBeforeLwp = basic + da;
  const pfWageDeduction = Math.round((pfWageBeforeLwp / daysInMonth) * lwpDays);
  const actualPfWages = Math.max(0, pfWageBeforeLwp - pfWageDeduction);

  const { employeePf, employerPf } = calculateProvidentFund(actualPfWages, salaryConfig.pfEmployeePercent ?? 12, salaryConfig.pfEmployerPercent ?? 12, true);
  const professionalTax = calculateProfessionalTax(actualGrossSalary, salaryConfig.professionalTaxState || "DL", isFeb);
  const { employeeEsi } = calculateESI(actualGrossSalary, salaryConfig.esiApplicable);

  const loanEmiApplied = Math.min(
    deductionsInput.activeLoanRemaining || 0,
    deductionsInput.activeLoanEmi || 0
  );
  const tds = deductionsInput.monthlyTdsAmount || 0;

  const totalDeductions = employeePf + professionalTax + employeeEsi + loanEmiApplied + tds;
  const netPay = Math.max(0, actualGrossSalary - totalDeductions);

  return {
    grossSalaryBeforeLwp: grossBeforeLwp,
    basicSalary: basic,
    daAmount: da,
    hraAmount: hra,
    allowancesAmount: allowances,
    lwpDeduction,
    actualGrossSalary,
    pfEmployee: employeePf,
    pfEmployer: employerPf,
    professionalTax,
    esiEmployee: employeeEsi,
    loanEmiApplied,
    tds,
    totalDeductions,
    netPay,
  };
}

export function generatePfEcrFile(records: Array<{ memberId: string; memberName: string; grossWages: number; epfWages: number; ncpDays: number }>): string {
  return records
    .map((r) => {
      const epfWages = Math.min(15000, r.epfWages);
      const epfContr = Math.round(epfWages * 0.12);
      const epsContr = Math.min(1250, Math.round(epfWages * 0.0833));
      const diffContr = epfContr - epsContr;
      return `${r.memberId}#${r.memberName}#${r.grossWages}#${epfWages}#${epfWages}#${epfWages}#${epfContr}#${epsContr}#${diffContr}#${r.ncpDays}#0`;
    })
    .join("\r\n");
}
