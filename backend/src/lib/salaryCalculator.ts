/**
 * Canonical Salary Breakdown Calculator
 * Computes Indian K-12 School ERP earnings, statutory deductions (PF, PT, TDS),
 * and net take-home pay from salary components.
 */

export interface SalaryBreakdown {
  basicSalary: number;
  daAmount: number;
  daPercent: number;
  hraAmount: number;
  hraPercent: number;
  otherAllowancesTotal: number;
  otherAllowances: Array<{ name: string; amount: number }>;
  grossEarnings: number;
  pfEmployeeAmount: number;
  pfEmployeePercent: number;
  pfEmployerAmount: number;
  pfEmployerPercent: number;
  esiApplicable: boolean;
  ptAmount: number;
  tdsAmount: number;
  deductionsTotal: number;
  netMonthlyPay: number;
}

export function computeSalaryBreakdown(
  components: any,
  customGross?: number
): SalaryBreakdown {
  if (!components) {
    return {
      basicSalary: 0,
      daAmount: 0,
      daPercent: 0,
      hraAmount: 0,
      hraPercent: 0,
      otherAllowancesTotal: 0,
      otherAllowances: [],
      grossEarnings: 0,
      pfEmployeeAmount: 0,
      pfEmployeePercent: 12,
      pfEmployerAmount: 0,
      pfEmployerPercent: 12,
      esiApplicable: false,
      ptAmount: 0,
      tdsAmount: 0,
      deductionsTotal: 0,
      netMonthlyPay: 0,
    };
  }

  const basicSalary = parseFloat(components.basicSalary || "0");
  const daPercent = parseFloat(components.daPercent || "0");
  const hraPercent = parseFloat(components.hraPercent || "0");
  const pfEmployeePercent = parseFloat(components.pfEmployeePercent || "12");
  const pfEmployerPercent = parseFloat(components.pfEmployerPercent || "12");
  const esiApplicable = Boolean(components.esiApplicable);
  const tdsAmount = parseFloat(components.monthlyTdsAmount || "0");

  // Allowances calculation
  const daAmount = basicSalary * (daPercent / 100);
  const hraAmount = basicSalary * (hraPercent / 100);

  const rawOther = components.otherAllowances;
  const otherAllowances: Array<{ name: string; amount: number }> = Array.isArray(
    rawOther
  )
    ? rawOther.map((item: any) => ({
        name: String(item.name || "Allowance"),
        amount: parseFloat(item.amount || "0"),
      }))
    : [];

  const otherAllowancesTotal = otherAllowances.reduce(
    (sum, a) => sum + (a.amount || 0),
    0
  );

  const grossEarnings = basicSalary + daAmount + hraAmount + otherAllowancesTotal;

  // Deductions calculation
  const pfEmployeeAmount = basicSalary * (pfEmployeePercent / 100);
  const pfEmployerAmount = basicSalary * (pfEmployerPercent / 100);

  // Standard Indian Professional Tax (PT)
  const ptAmount = grossEarnings >= 15000 ? 200 : grossEarnings >= 10000 ? 150 : 0;

  const deductionsTotal = pfEmployeeAmount + ptAmount + tdsAmount;
  const netMonthlyPay = Math.max(0, grossEarnings - deductionsTotal);

  return {
    basicSalary: Math.round(basicSalary * 100) / 100,
    daAmount: Math.round(daAmount * 100) / 100,
    daPercent,
    hraAmount: Math.round(hraAmount * 100) / 100,
    hraPercent,
    otherAllowancesTotal: Math.round(otherAllowancesTotal * 100) / 100,
    otherAllowances,
    grossEarnings: Math.round(grossEarnings * 100) / 100,
    pfEmployeeAmount: Math.round(pfEmployeeAmount * 100) / 100,
    pfEmployeePercent,
    pfEmployerAmount: Math.round(pfEmployerAmount * 100) / 100,
    pfEmployerPercent,
    esiApplicable,
    ptAmount,
    tdsAmount: Math.round(tdsAmount * 100) / 100,
    deductionsTotal: Math.round(deductionsTotal * 100) / 100,
    netMonthlyPay: Math.round(netMonthlyPay * 100) / 100,
  };
}
