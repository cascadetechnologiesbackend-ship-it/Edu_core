/**
 * Fee Payment Allocation Engine
 *
 * Implements the explicit allocation order defined in Spec v1.2:
 * business_logic_rules.fees.allocation_order:
 * "A payment allocates to late fee first, then the oldest outstanding invoice,
 * then the next; partial payments never split a single allocation across invoices
 * when one can be cleared."
 */

export interface InvoiceAllocationTarget {
  id: string;
  studentId: string;
  invoiceNumber?: string | undefined;
  dueDate: Date | string;
  balanceAmount: number;
  lateFeeAmount: number;
}

export interface InvoiceAllocationResult {
  invoiceId: string;
  studentId: string;
  lateFeeAllocated: number;
  balanceAllocated: number;
  totalAllocated: number;
  remainingBalance: number;
  remainingLateFee: number;
  isFullyCleared: boolean;
}

export interface PaymentAllocationPlan {
  totalPaymentAmount: number;
  totalLateFeeAllocated: number;
  totalPrincipalAllocated: number;
  allocations: InvoiceAllocationResult[];
  unallocatedAmount: number;
}

/**
 * Pure function: Implements the explicit allocation order defined in Spec v1.2:
 * business_logic_rules.fees.allocation_order:
 * "A payment allocates to late fee first, then the oldest outstanding invoice,
 * then the next; partial payments never split a single allocation across invoices
 * when one can be cleared."
 */
export function calculatePaymentAllocation(
  invoices: InvoiceAllocationTarget[],
  paymentAmount: number
): PaymentAllocationPlan {
  if (paymentAmount <= 0 || invoices.length === 0) {
    return {
      totalPaymentAmount: paymentAmount,
      totalLateFeeAllocated: 0,
      totalPrincipalAllocated: 0,
      allocations: invoices.map((inv) => ({
        invoiceId: inv.id,
        studentId: inv.studentId,
        lateFeeAllocated: 0,
        balanceAllocated: 0,
        totalAllocated: 0,
        remainingBalance: inv.balanceAmount,
        remainingLateFee: inv.lateFeeAmount,
        isFullyCleared: false,
      })),
      unallocatedAmount: Math.max(0, paymentAmount),
    };
  }

  // Sort invoices oldest first (by dueDate ascending)
  const sorted = [...invoices].sort((a, b) => {
    const da = new Date(a.dueDate).getTime();
    const db = new Date(b.dueDate).getTime();
    return da - db;
  });

  let remainingCash = paymentAmount;
  let totalLateFeeAllocated = 0;
  let totalPrincipalAllocated = 0;

  // Step 1: Allocate to late fees first across oldest invoices
  const lateFeeMap = new Map<string, number>();
  for (const inv of sorted) {
    if (inv.lateFeeAmount > 0 && remainingCash > 0) {
      const allocateLateFee = Math.min(inv.lateFeeAmount, remainingCash);
      lateFeeMap.set(inv.id, allocateLateFee);
      remainingCash -= allocateLateFee;
      totalLateFeeAllocated += allocateLateFee;
    } else {
      lateFeeMap.set(inv.id, 0);
    }
  }

  // Step 2: Allocate to invoice principal starting from oldest
  // If payment can clear an invoice fully, clear it before moving to next.
  const allocations: InvoiceAllocationResult[] = [];
  for (const inv of sorted) {
    const lateFeeAllocated = lateFeeMap.get(inv.id) || 0;
    let balanceAllocated = 0;

    if (remainingCash > 0 && inv.balanceAmount > 0) {
      balanceAllocated = Math.min(inv.balanceAmount, remainingCash);
      remainingCash -= balanceAllocated;
      totalPrincipalAllocated += balanceAllocated;
    }

    const totalAllocated = lateFeeAllocated + balanceAllocated;
    const remainingBalance = Math.max(0, inv.balanceAmount - balanceAllocated);
    const remainingLateFee = Math.max(0, inv.lateFeeAmount - lateFeeAllocated);
    const isFullyCleared = remainingBalance <= 0.01 && remainingLateFee <= 0.01;

    allocations.push({
      invoiceId: inv.id,
      studentId: inv.studentId,
      lateFeeAllocated,
      balanceAllocated,
      totalAllocated,
      remainingBalance,
      remainingLateFee,
      isFullyCleared,
    });
  }

  return {
    totalPaymentAmount: paymentAmount,
    totalLateFeeAllocated,
    totalPrincipalAllocated,
    allocations,
    unallocatedAmount: remainingCash,
  };
}
