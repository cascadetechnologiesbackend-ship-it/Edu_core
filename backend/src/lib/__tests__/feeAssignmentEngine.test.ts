import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoAssignFeeStructuresToStudent } from "../feeAssignmentEngine";

describe("Fee Assignment Engine (autoAssignFeeStructuresToStudent)", () => {
  const schoolId = "school-111";
  const studentId = "student-222";
  const classId = "class-333";
  const academicYearId = "year-444";

  let mockStudent: any;
  let mockActiveYear: any;
  let mockStructures: any[];
  let mockConcessions: any[];
  let insertedInvoices: any[];

  let mockTx: any;

  beforeEach(() => {
    insertedInvoices = [];

    mockStudent = {
      id: studentId,
      schoolId,
      currentClassId: classId,
      academicYearId,
      isActive: true,
      optInTransport: true,
      optInHostel: true,
    };

    mockActiveYear = {
      id: academicYearId,
      schoolId,
      isActive: true,
    };

    mockStructures = [
      {
        id: "struct-1",
        schoolId,
        academicYearId,
        classId,
        amount: "5000.00",
        isActive: true,
        feeHeadId: "head-tuition",
        dueDate: new Date(),
        term: "TERM_1",
        feeHead: {
          headType: "TUITION",
          code: "TUT",
          name: "Tuition Fee",
          isTaxable: false,
        },
      },
      {
        id: "struct-2",
        schoolId,
        academicYearId,
        classId,
        amount: "1500.00",
        isActive: true,
        feeHeadId: "head-transport",
        dueDate: new Date(),
        term: "TERM_1",
        feeHead: {
          headType: "TRANSPORT",
          code: "TRN",
          name: "Transport Fee",
          isTaxable: false,
        },
      },
    ];

    mockConcessions = [];

    mockTx = {
      query: {
        students: {
          findFirst: vi.fn(() => Promise.resolve(mockStudent)),
        },
        academicYears: {
          findFirst: vi.fn(() => Promise.resolve(mockActiveYear)),
        },
        feeStructures: {
          findMany: vi.fn(() => Promise.resolve(mockStructures)),
        },
        feeConcessions: {
          findMany: vi.fn(() => Promise.resolve(mockConcessions)),
        },
        feeInvoices: {
          findFirst: vi.fn(() => Promise.resolve(null)),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => {
          insertedInvoices.push(vals);
          return Promise.resolve();
        }),
      })),
    };
  });

  it("happy path: generates invoices for student with active structures in a transaction", async () => {
    const count = await autoAssignFeeStructuresToStudent(studentId, mockTx);
    expect(count).toBe(2);
    expect(insertedInvoices.length).toBe(2);
    expect(insertedInvoices[0].studentId).toBe(studentId);
    expect(insertedInvoices[0].grossAmount).toBe("5000.00");
    expect(insertedInvoices[1].grossAmount).toBe("1500.00");
  });

  it("transport opt-out: skips transport fee head when optInTransport is false", async () => {
    mockStudent.optInTransport = false;

    const count = await autoAssignFeeStructuresToStudent(studentId, mockTx);
    expect(count).toBe(1);
    expect(insertedInvoices.length).toBe(1);
    expect(insertedInvoices[0].feeStructureId).toBe("struct-1");
  });

  it("idempotency check: does not duplicate invoices if an invoice already exists", async () => {
    // Simulate first invoice already existing
    mockTx.query.feeInvoices.findFirst = vi.fn(({ where }: any) => {
      return Promise.resolve({ id: "existing-inv-1" });
    });

    const count = await autoAssignFeeStructuresToStudent(studentId, mockTx);
    expect(count).toBe(0);
    expect(insertedInvoices.length).toBe(0);
  });

  it("applies concession discount correctly to taxable/net balance calculations", async () => {
    mockConcessions = [
      {
        academicYearId,
        studentId,
        appliesTo: "ALL",
        discountPercentage: "20.00",
      },
    ];
    mockTx.query.feeConcessions.findMany = vi.fn(() => Promise.resolve(mockConcessions));

    const count = await autoAssignFeeStructuresToStudent(studentId, mockTx);
    expect(count).toBe(2);
    // Tuition: 5000 - 20% (1000) = 4000
    expect(insertedInvoices[0].discountAmount).toBe("1000.00");
    expect(insertedInvoices[0].netAmount).toBe("4000.00");
  });
});
