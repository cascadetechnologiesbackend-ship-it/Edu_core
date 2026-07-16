import { describe, it, expect } from "vitest";
import {
  calculateGrossComponents,
  calculateProfessionalTax,
  calculateProvidentFund,
  calculateESI,
  runPayrollCalculations,
  generatePfEcrFile,
} from "../payrollEngine";

describe("SchoolMitra ERP Payroll Engine Calculations", () => {
  describe("Gross Salary Components", () => {
    it("sums Basic, HRA%, DA% and other allowances correctly", () => {
      const result = calculateGrossComponents({
        basicSalary: 20000,
        daPercent: 10, // 2,000
        hraPercent: 40, // 8,000
        otherAllowances: [
          { name: "Special Allowance", amount: 3000 },
          { name: "Travel Allowance", amount: 1500 },
        ],
        pfEmployeePercent: 12,
        pfEmployerPercent: 12,
        esiApplicable: false,
        professionalTaxState: "DL",
      });

      expect(result.basic).toBe(20000);
      expect(result.da).toBe(2000);
      expect(result.hra).toBe(8000);
      expect(result.allowances).toBe(4500);
      expect(result.grossBeforeLwp).toBe(34500);
    });
  });

  describe("Professional Tax Slabs", () => {
    it("calculates zero tax for Delhi", () => {
      expect(calculateProfessionalTax(15000, "DL")).toBe(0);
      expect(calculateProfessionalTax(50000, "DL")).toBe(0);
    });

    it("calculates correct slabs for Karnataka", () => {
      expect(calculateProfessionalTax(24000, "KA")).toBe(0);
      expect(calculateProfessionalTax(26000, "KA")).toBe(200);
    });

    it("calculates correct slabs for Maharashtra (regular vs Feb)", () => {
      // <= 7500: 0
      expect(calculateProfessionalTax(7000, "MH")).toBe(0);
      // 7501 to 10000: 175
      expect(calculateProfessionalTax(8000, "MH")).toBe(175);
      // > 10000: 200 (250 in Feb)
      expect(calculateProfessionalTax(15000, "MH", false)).toBe(200);
      expect(calculateProfessionalTax(15000, "MH", true)).toBe(250);
    });
  });

  describe("Provident Fund", () => {
    it("caps PF at 15,000 basic + DA standard limit", () => {
      const { employeePf, employerPf } = calculateProvidentFund(
        25000,
        12,
        12,
        true,
      );
      expect(employeePf).toBe(1800); // 12% of 15,000
      expect(employerPf).toBe(1800);
    });

    it("calculates PF on full salary if capping is disabled", () => {
      const { employeePf, employerPf } = calculateProvidentFund(
        20000,
        12,
        12,
        false,
      );
      expect(employeePf).toBe(2400); // 12% of 20,000
      expect(employerPf).toBe(2400);
    });

    it("calculates exact amount if wages are below 15,000 cap limit", () => {
      const { employeePf, employerPf } = calculateProvidentFund(
        12000,
        12,
        12,
        true,
      );
      expect(employeePf).toBe(1440); // 12% of 12,000
      expect(employerPf).toBe(1440);
    });
  });

  describe("ESI Calculation", () => {
    it("returns 0 if not applicable", () => {
      const { employeeEsi, employerEsi } = calculateESI(15000, false);
      expect(employeeEsi).toBe(0);
      expect(employerEsi).toBe(0);
    });

    it("returns 0 if Gross exceeds 21,000 threshold", () => {
      const { employeeEsi, employerEsi } = calculateESI(22000, true);
      expect(employeeEsi).toBe(0);
      expect(employerEsi).toBe(0);
    });

    it("calculates correct percentages if applicable and Gross <= 21,000", () => {
      const { employeeEsi, employerEsi } = calculateESI(10000, true);
      expect(employeeEsi).toBe(75); // 0.75% of 10,000
      expect(employerEsi).toBe(325); // 3.25% of 10,000
    });
  });

  describe("Monthly Run Calculations", () => {
    it("calculates Net Pay correctly with LWP deductions, loans, and PT", () => {
      const salary = {
        basicSalary: 30000,
        daPercent: 10, // 3,000
        hraPercent: 30, // 9,000
        otherAllowances: [{ name: "Travel Allowance", amount: 2000 }],
        pfEmployeePercent: 12,
        pfEmployerPercent: 12,
        esiApplicable: false,
        professionalTaxState: "KA", // Karnataka -> PT 200
      };

      const deductions = {
        lwpDays: 3,
        daysInMonth: 30,
        monthlyTdsAmount: 1500,
        activeLoanEmi: 2500,
        activeLoanRemaining: 5000,
      };

      // GrossBeforeLwp = 30000 + 3000 + 9000 + 2000 = 44,000
      // LWP Deduction = (44000 / 30) * 3 = 4,400
      // Actual Gross = 44,000 - 4,400 = 39,600
      // PF: Basic+DA after LWP = (30000 + 3000) - ((33000 / 30) * 3) = 33000 - 3300 = 29,700
      // PF capped at 15,000 -> PF = 15000 * 0.12 = 1,800
      // PT (Karnataka): Actual Gross 39,600 > 25,000 -> PT = 200
      // TDS = 1,500
      // Loan EMI = 2,500
      // Total Deductions = 1,800 (PF) + 200 (PT) + 1,500 (TDS) + 2,500 (Loan) = 6,000
      // Net Pay = 39,600 - 6,000 = 33,600

      const result = runPayrollCalculations(salary, deductions, false);

      expect(result.grossSalaryBeforeLwp).toBe(44000);
      expect(result.lwpDeduction).toBe(4400);
      expect(result.actualGrossSalary).toBe(39600);
      expect(result.pfEmployee).toBe(1800);
      expect(result.professionalTax).toBe(200);
      expect(result.loanEmiApplied).toBe(2500);
      expect(result.tds).toBe(1500);
      expect(result.totalDeductions).toBe(6000);
      expect(result.netPay).toBe(33600);
    });

    it("restricts loan deduction to remaining amount if remaining is less than EMI", () => {
      const salary = {
        basicSalary: 20000,
        daPercent: 0,
        hraPercent: 0,
        otherAllowances: [],
        pfEmployeePercent: 12,
        pfEmployerPercent: 12,
        esiApplicable: false,
        professionalTaxState: "DL",
      };

      const deductions = {
        lwpDays: 0,
        daysInMonth: 30,
        monthlyTdsAmount: 0,
        activeLoanEmi: 2500,
        activeLoanRemaining: 1200, // Remaining loan is less than EMI
      };

      const result = runPayrollCalculations(salary, deductions, false);
      expect(result.loanEmiApplied).toBe(1200);
    });
  });

  describe("PF ECR File Export", () => {
    it("generates a correctly delimited text file matching EPFO specs", () => {
      const records = [
        {
          memberId: "MEMBER001",
          memberName: "John Doe",
          grossWages: 25000,
          epfWages: 14000, // below cap
          ncpDays: 2,
        },
        {
          memberId: "MEMBER002",
          memberName: "Jane Smith",
          grossWages: 30000,
          epfWages: 18000, // above cap (will cap to 15,000)
          ncpDays: 0,
        },
      ];

      const ecrContent = generatePfEcrFile(records);
      const lines = ecrContent.split("\r\n");

      expect(lines.length).toBe(2);

      // Line 1: John Doe (14,000)
      // epf = 14000, employee pf = 14000 * 12% = 1680, eps = 14000 * 8.33% = 1166, diff = 1680 - 1166 = 514
      const cols1 = (lines[0] ?? "").split("#");
      expect(cols1[0]).toBe("MEMBER001");
      expect(cols1[1]).toBe("John Doe");
      expect(cols1[2]).toBe("25000");
      expect(cols1[3]).toBe("14000"); // EPF wages
      expect(cols1[6]).toBe("1680"); // EPF contr
      expect(cols1[7]).toBe("1166"); // EPS contr
      expect(cols1[8]).toBe("514"); // diff contr
      expect(cols1[9]).toBe("2"); // NCP days

      // Line 2: Jane Smith (18,000 capped to 15,000)
      // epf = 15000, employee pf = 15000 * 12% = 1800, eps = 15000 * 8.33% = 1250, diff = 1800 - 1250 = 550
      const cols2 = (lines[1] ?? "").split("#");
      expect(cols2[0]).toBe("MEMBER002");
      expect(cols2[1]).toBe("Jane Smith");
      expect(cols2[2]).toBe("30000");
      expect(cols2[3]).toBe("15000"); // capped EPF wages
      expect(cols2[6]).toBe("1800"); // EPF contr
      expect(cols2[7]).toBe("1250"); // EPS contr
      expect(cols2[8]).toBe("550"); // diff contr
      expect(cols2[9]).toBe("0"); // NCP days
    });
  });
});
