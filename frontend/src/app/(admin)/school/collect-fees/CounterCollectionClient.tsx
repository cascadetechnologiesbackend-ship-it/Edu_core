"use client";

import { useState } from "react";
import { processCounterCollection } from "./actions";
import {
  CreditCard,
  Search,
  CheckCircle2,
  Printer,
  FileDown,
  X,
  IndianRupee,
  Receipt,
  User,
} from "lucide-react";

interface StudentItem {
  id: string;
  admissionNumber: string;
  name: string;
  className: string;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  studentId: string;
  feeHeadName: string;
  term: string;
  dueDate: string;
  grossAmount: string;
  paidAmount: string;
  balanceAmount: string;
  status: string;
}

interface BankAccountItem {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
}

export function CounterCollectionClient({
  students,
  invoices,
  bankAccounts,
  schoolName,
}: {
  students: StudentItem[];
  invoices: InvoiceItem[];
  bankAccounts: BankAccountItem[];
  schoolName: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Thermal Receipt Print Modal State
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string;
    paymentId: string;
    amountPaid: string;
    invoiceNumber: string;
    paymentMethod: string;
    date: string;
  } | null>(null);

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.className.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const activeStudent = students.find((s) => s.id === selectedStudentId);
  const studentInvoices = invoices.filter((i) => i.studentId === selectedStudentId);
  const currentInvoice = studentInvoices.find((i) => i.id === selectedInvoiceId);

  const handlePay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    formData.append("invoiceId", selectedInvoiceId);

    const res = await processCounterCollection(formData);
    setSubmitting(false);

    if (res.success && res.receiptNumber) {
      setReceiptData({
        receiptNumber: res.receiptNumber,
        paymentId: res.paymentId!,
        amountPaid: res.amountPaid!,
        invoiceNumber: res.invoiceNumber!,
        paymentMethod: res.paymentMethod!,
        date: res.date!,
      });
      setSelectedInvoiceId("");
    } else {
      setErrorMessage(res.message || "Failed to process payment");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Student Search & Invoices (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Search Engine */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase">
            Search Student (Admission No, Name, Class)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name, admission number, or grade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800 border border-gray-100 dark:border-slate-800 rounded-xl">
            {filteredStudents.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500">
                No matching students found with outstanding invoices.
              </div>
            ) : (
              filteredStudents.slice(0, 10).map((stu) => (
                <button
                  type="button"
                  key={stu.id}
                  onClick={() => {
                    setSelectedStudentId(stu.id);
                    setSelectedInvoiceId("");
                  }}
                  className={`w-full p-3 text-left flex items-center justify-between transition ${
                    selectedStudentId === stu.id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold"
                      : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      {stu.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{stu.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Adm: #{stu.admissionNumber} • {stu.className}
                      </p>
                    </div>
                  </div>
                  {selectedStudentId === stu.id && (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Student Ledger & Invoices */}
        {activeStudent && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  {activeStudent.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Admission: #{activeStudent.admissionNumber} • Grade: {activeStudent.className}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {studentInvoices.length} Pending Invoices
              </span>
            </div>

            {studentInvoices.length === 0 ? (
              <div className="p-6 text-center text-sm text-emerald-600 font-medium">
                🎉 All dues are clear for this student! No pending invoices.
              </div>
            ) : (
              <div className="space-y-3">
                {studentInvoices.map((inv) => (
                  <label
                    key={inv.id}
                    className={`block p-4 rounded-xl border cursor-pointer transition ${
                      selectedInvoiceId === inv.id
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm"
                        : "border-gray-200 dark:border-slate-800 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="selectedInvoice"
                        value={inv.id}
                        checked={selectedInvoiceId === inv.id}
                        onChange={() => setSelectedInvoiceId(inv.id)}
                        className="mt-1 text-blue-600"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {inv.feeHeadName} ({inv.term})
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                            {inv.invoiceNumber}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>Due Date: {new Date(inv.dueDate).toLocaleDateString("en-IN")}</span>
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            Due Balance: ₹{parseFloat(inv.balanceAmount).toLocaleString("en-IN")}
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

      {/* Right Column: Collection Counter Terminal (5 cols) */}
      <div className="lg:col-span-5">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm sticky top-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Fee Collection Terminal
            </h2>
          </div>

          {!currentInvoice ? (
            <div className="p-8 text-center text-gray-400 text-xs border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
              Select a student and choose a pending invoice to accept payment.
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium">
                  {errorMessage}
                </div>
              )}

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Gross Invoice Total</span>
                  <span>₹{parseFloat(currentInvoice.grossAmount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Already Paid</span>
                  <span>₹{parseFloat(currentInvoice.paidAmount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-slate-700 pt-2">
                  <span>Payable Balance</span>
                  <span className="text-emerald-600">
                    ₹{parseFloat(currentInvoice.balanceAmount).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Collection Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amountPaid"
                  required
                  defaultValue={currentInvoice.balanceAmount}
                  max={currentInvoice.balanceAmount}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Payment Mode *
                  </label>
                  <select
                    name="paymentMethod"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="CASH">Cash Counter</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="DD">Demand Draft (DD)</option>
                    <option value="NEFT">Bank Transfer (NEFT/RTGS)</option>
                    <option value="ONLINE">Online Portal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Deposit Account
                  </label>
                  <select
                    name="bankAccountId"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="CASH">Cash in Hand</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Reference No / Cheque No / UTR
                </label>
                <input
                  type="text"
                  name="transactionReference"
                  placeholder="e.g. UTR12345678 or Cheque 987654"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Receipt Remarks
                </label>
                <input
                  type="text"
                  name="remarks"
                  placeholder="Optional counter remarks"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" />
                {submitting ? "Processing Transaction..." : "Collect Fees & Issue Receipt"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Instant Thermal Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setReceiptData(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Thermal Print Content Container */}
            <div id="thermal-receipt" className="font-mono text-center space-y-3 pt-2 text-xs border-b pb-4">
              <div className="border-b pb-2">
                <h4 className="font-bold text-sm uppercase">{schoolName}</h4>
                <p className="text-[10px] text-gray-500">OFFICIAL FEE PAYMENT RECEIPT</p>
              </div>

              <div className="text-left space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipt No:</span>
                  <span className="font-bold">{receiptData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice:</span>
                  <span>{receiptData.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span>{receiptData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode:</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                  <span>Amount Paid:</span>
                  <span>₹ {parseFloat(receiptData.amountPaid).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-gray-500 italic">
                Thank you for your payment. This is a computer generated receipt.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-900 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Printer className="w-3.5 h-3.5" /> Thermal Print
              </button>
              <a
                href={`/api/receipt/${receiptData.paymentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-lg bg-blue-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <FileDown className="w-3.5 h-3.5" /> Download PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
