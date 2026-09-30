"use client";

import { useState } from "react";
import { processManualPayment } from "./actions";

export function CollectForm({
  invoices,
  students,
  defaultStudentId,
}: {
  invoices: any[];
  students: any[];
  defaultStudentId?: string;
}) {
  const [selectedStudent, setSelectedStudent] = useState<string>(
    defaultStudentId || "",
  );
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const studentInvoices = invoices.filter(
    (i) => i.studentId === selectedStudent,
  );
  const currentInvoice = studentInvoices.find((i) => i.id === selectedInvoice);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    formData.append("invoiceId", selectedInvoice);

    const res = await processManualPayment(formData);
    setLoading(false);

    if (res.success) {
      setSuccess(`Payment successful! Receipt No: ${res.receiptNumber}`);
      setSelectedInvoice("");
    } else {
      setError(res.message || "Payment failed");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Student & Invoice Selection */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">
            Search Student (with pending dues)
          </label>
          <select
            className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
            value={selectedStudent}
            onChange={(e) => {
              setSelectedStudent(e.target.value);
              setSelectedInvoice("");
            }}
          >
            <option value="">-- Select Student --</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.admissionNumber} - {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>

        {selectedStudent && (
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Pending Invoices
            </h3>
            {studentInvoices.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 dark:bg-slate-800 p-4 rounded-md border border-gray-100 dark:border-slate-700">
                <p>No pending invoices found for this student.</p>
                <p className="mt-1 text-xs">
                  If you expected an invoice, please generate missing invoices
                  from the student's Fee Ledger.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {studentInvoices.map((inv) => (
                  <label
                    key={inv.id}
                    className={`block cursor-pointer p-4 border rounded-lg transition-colors ${selectedInvoice === inv.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"}`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="invoiceSelect"
                        value={inv.id}
                        checked={selectedInvoice === inv.id}
                        onChange={() => setSelectedInvoice(inv.id)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {inv.feeStructure?.feeHead?.name} ({inv.term})
                        </div>
                        <div className="flex justify-between mt-2 text-sm">
                          <span>Net: ₹{inv.netAmount}</span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            Balance: ₹{inv.balanceAmount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Processing Form */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow border border-gray-200 dark:border-slate-800 h-fit">
        <h2 className="text-lg font-semibold mb-4">Record Payment</h2>

        {!currentInvoice ? (
          <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
            Select an invoice from the left to record payment.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 text-green-700 rounded text-sm">
                {success}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Amount to Pay (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amountPaid"
                  defaultValue={currentInvoice.balanceAmount}
                  max={currentInvoice.balanceAmount}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 font-bold text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Payment Method
                </label>
                <select
                  name="paymentMethod"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
                >
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="DD">Demand Draft (DD)</option>
                  <option value="NEFT">NEFT/IMPS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Transaction Ref / Cheque No (Optional)
              </label>
              <input
                type="text"
                name="transactionReference"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Remarks (Optional)
              </label>
              <textarea
                name="remarks"
                rows={2}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white font-medium py-3 rounded-md hover:bg-green-700 disabled:opacity-50 mt-4"
            >
              {loading
                ? "Processing..."
                : `Record Payment of ₹${currentInvoice.balanceAmount}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
