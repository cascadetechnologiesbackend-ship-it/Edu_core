import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { decryptData } from "@/lib/encryption";
import { SchoolDocumentHeader, type SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";

export interface ReceiptPDFItem {
  feeHeadName: string;
  invoiceNumber: string;
  term: string;
  grossAmount: number;
  discountAmount: number;
  lateFeeAmount: number;
  amountPaid: number;
  balanceAmount: number;
}

export interface ReceiptPDFProps {
  payment: any;
  payments?: any[];
  invoice?: any;
  items?: ReceiptPDFItem[];
  student: any;
  className?: string | null;
  sectionName?: string | null;
  school: any;
  logoUrl?: string | null;
  academicYear?: string | undefined;
  cashierName?: string | undefined;
}

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function formatINR(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return `Rs. ${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n] || "";
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten] || ""}${one > 0 ? ` ${ONES[one]}` : ""}`.trim();
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (hundred > 0) parts.push(`${ONES[hundred]} Hundred`);
  if (rem > 0) parts.push(twoDigitsToWords(rem));
  return parts.join(" ");
}

/**
 * Converts an amount in rupees to Indian numbering system words (Crores / Lakhs / Thousands).
 */
export function amountToIndianWords(amountOrPaise: number, isPaise = false): string {
  const totalPaise = isPaise ? Math.round(amountOrPaise) : Math.round(amountOrPaise * 100);
  if (totalPaise <= 0) return "Rupees Zero Only";

  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const parts: string[] = [];
  let rem = rupees;

  const crore = Math.floor(rem / 10_000_000);
  rem %= 10_000_000;
  if (crore > 0) parts.push(`${threeDigitsToWords(crore)} Crore`);

  const lakh = Math.floor(rem / 100_000);
  rem %= 100_000;
  if (lakh > 0) parts.push(`${twoDigitsToWords(lakh)} Lakh`);

  const thousand = Math.floor(rem / 1_000);
  rem %= 1_000;
  if (thousand > 0) parts.push(`${twoDigitsToWords(thousand)} Thousand`);

  if (rem > 0) parts.push(threeDigitsToWords(rem));

  const rupeeWords = parts.length > 0 ? `Rupees ${parts.join(" ")}` : "Rupees Zero";
  if (paise > 0) {
    return `${rupeeWords} and ${twoDigitsToWords(paise)} Paise Only`;
  }
  return `${rupeeWords} Only`;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 50,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1f2937",
  },
  voidWatermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  voidWatermarkText: {
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    opacity: 0.16,
    transform: "rotate(-35deg)",
    letterSpacing: 6,
  },
  voidBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderStyle: "solid",
    borderRadius: 3,
    padding: 7,
    marginBottom: 10,
  },
  voidBannerTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#b91c1c",
    marginBottom: 2,
  },
  voidBannerText: {
    fontSize: 8,
    color: "#7f1d1d",
  },
  metaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "solid",
    borderRadius: 3,
    padding: 9,
    marginBottom: 12,
    gap: 14,
  },
  metaColumn: {
    flex: 1,
    gap: 3,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  metaLabel: {
    fontSize: 8,
    color: "#64748b",
    fontFamily: "Helvetica-Bold",
  },
  metaValue: {
    fontSize: 8.5,
    color: "#0f172a",
    textAlign: "right",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "solid",
    borderRadius: 2,
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#003E80",
  },
  tableHeaderCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#1d5fa3",
    borderRightStyle: "solid",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
  },
  tableRowOdd: {
    backgroundColor: "#f8fafc",
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    color: "#1e293b",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    borderRightStyle: "solid",
  },
  tableTotalRow: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderTopWidth: 1.5,
    borderTopColor: "#003E80",
    borderTopStyle: "solid",
  },
  tableTotalCell: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#003E80",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    borderRightStyle: "solid",
  },
  wordsBox: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 3,
    padding: 8,
    marginBottom: 12,
  },
  wordsLabel: {
    fontSize: 7.5,
    color: "#64748b",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  wordsValue: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  paymentDetailsBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 3,
    padding: 8,
    marginBottom: 16,
    gap: 3,
  },
  sectionHeading: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#003E80",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 18,
    paddingTop: 8,
  },
  receivedByBlock: {
    width: "50%",
    gap: 3,
  },
  signatureBox: {
    width: "38%",
    borderTopWidth: 1,
    borderTopColor: "#334155",
    borderTopStyle: "solid",
    paddingTop: 5,
    alignItems: "center",
  },
  signatureTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },
  signatureSub: {
    fontSize: 7.5,
    color: "#64748b",
    marginTop: 1,
  },
});

const COL_WIDTHS = {
  feeHead: "22%",
  invoiceNo: "14%",
  term: "10%",
  gross: "11%",
  concession: "11%",
  lateFee: "10%",
  paid: "11%",
  balance: "11%",
};

export function ReceiptPDF({
  payment,
  payments,
  invoice,
  items,
  student,
  className,
  sectionName,
  school,
  logoUrl,
  academicYear,
  cashierName,
}: ReceiptPDFProps) {
  const fName = decryptData(student?.firstNameEncrypted || null) || "";
  const lName = decryptData(student?.lastNameEncrypted || null) || "";
  const studentName = `${fName} ${lName}`.trim() || "Student";

  const isCancelled = Boolean(payment?.isCancelled || payment?.status === "REVERSED");
  const receiptNo = payment?.receiptGroupId || payment?.receiptNumber || "REC";
  const formattedDate = payment?.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  const resolvedSchoolAddress = [
    school?.address,
    school?.city,
    school?.state,
    school?.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  const schoolInfo: SchoolInfo = {
    name: school?.name || "SchoolMitra Campus",
    address: resolvedSchoolAddress || school?.address || null,
    phone: school?.phone || null,
    email: school?.email || null,
    website: school?.website || null,
    boardAffiliation: school?.board || school?.boardAffiliation || null,
    logoUrl: logoUrl || null,
  };

  // Build line items from explicit items or fallback to payments/invoice
  const lineItems: ReceiptPDFItem[] =
    items && items.length > 0
      ? items
      : (payments && payments.length > 0 ? payments : [payment]).map((p: any) => {
          const inv = p?.invoice || invoice;
          const grossP = toPaise(inv?.grossAmount ?? p?.amountPaid);
          const discP = toPaise(inv?.discountAmount ?? 0);
          const lateP = toPaise(inv?.lateFeeAmount ?? 0);
          const paidP = toPaise(p?.amountPaid ?? 0);
          const balP = toPaise(inv?.balanceAmount ?? 0);
          return {
            feeHeadName: inv?.feeStructure?.feeHead?.name || "Tuition / School Fee",
            invoiceNumber: inv?.invoiceNumber || "N/A",
            term: inv?.term || "ANNUAL",
            grossAmount: grossP / 100,
            discountAmount: discP / 100,
            lateFeeAmount: lateP / 100,
            amountPaid: paidP / 100,
            balanceAmount: balP / 100,
          };
        });

  let totalGrossPaise = 0;
  let totalDiscountPaise = 0;
  let totalLateFeePaise = 0;
  let totalPaidPaise = 0;
  let totalBalancePaise = 0;

  for (const it of lineItems) {
    totalGrossPaise += toPaise(it.grossAmount);
    totalDiscountPaise += toPaise(it.discountAmount);
    totalLateFeePaise += toPaise(it.lateFeeAmount);
    totalPaidPaise += toPaise(it.amountPaid);
    totalBalancePaise += toPaise(it.balanceAmount);
  }

  const classLabel = [className || "Class", sectionName].filter(Boolean).join(" - ");
  const amountInWords = amountToIndianWords(totalPaidPaise, true);

  return (
    <Document title={`Fee Receipt ${receiptNo}`}>
      <Page size="A4" style={styles.page}>
        {/* VOID Watermark if receipt is cancelled/reversed */}
        {isCancelled && (
          <View style={styles.voidWatermarkContainer} fixed>
            <Text style={styles.voidWatermarkText}>VOID / CANCELLED</Text>
          </View>
        )}

        {/* Repeated Official School Header across pages */}
        <View fixed>
          <SchoolDocumentHeader
            school={schoolInfo}
            reportTitle="OFFICIAL FEE PAYMENT RECEIPT"
            subtitle={`Receipt No: ${receiptNo}${isCancelled ? "  [CANCELLED / REVERSED]" : ""}`}
            academicYear={academicYear}
            generatedAt={formattedDate}
          />
        </View>

        {/* Cancellation Banner */}
        {isCancelled && (
          <View style={styles.voidBanner}>
            <Text style={styles.voidBannerTitle}>
              THIS RECEIPT HAS BEEN CANCELLED / REVERSED
            </Text>
            <Text style={styles.voidBannerText}>
              Reason: {payment?.cancellationReason || payment?.remarks || "Reversed by administrator"}
              {payment?.cancelledAt
                ? `  |  Cancelled on: ${new Date(payment.cancelledAt).toLocaleDateString("en-IN")}`
                : ""}
            </Text>
          </View>
        )}

        {/* Receipt & Student Metadata */}
        <View style={styles.metaGrid}>
          <View style={styles.metaColumn}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Student Name:</Text>
              <Text style={styles.metaValue}>{studentName}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Admission No:</Text>
              <Text style={styles.metaValue}>{student?.admissionNumber || "N/A"}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Class / Section:</Text>
              <Text style={styles.metaValue}>{classLabel}</Text>
            </View>
            {student?.rollNumber && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Roll No:</Text>
                <Text style={styles.metaValue}>{student.rollNumber}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaColumn}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Receipt No:</Text>
              <Text style={styles.metaValue}>{receiptNo}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Date:</Text>
              <Text style={styles.metaValue}>{formattedDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Mode:</Text>
              <Text style={styles.metaValue}>
                {payment?.paymentMethod || payment?.paymentMode || "CASH"}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status:</Text>
              <Text style={styles.metaValue}>
                {isCancelled ? "REVERSED (VOID)" : "CONFIRMED"}
              </Text>
            </View>
          </View>
        </View>

        {/* Multi-Invoice Fee Particulars Table */}
        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <View style={[styles.tableHeaderCell, { width: COL_WIDTHS.feeHead }]}>
              <Text>Fee Head</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: COL_WIDTHS.invoiceNo }]}>
              <Text>Invoice #</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: COL_WIDTHS.term }]}>
              <Text>Term</Text>
            </View>
            <View
              style={[styles.tableHeaderCell, { width: COL_WIDTHS.gross, textAlign: "right" }]}
            >
              <Text>Gross</Text>
            </View>
            <View
              style={[
                styles.tableHeaderCell,
                { width: COL_WIDTHS.concession, textAlign: "right" },
              ]}
            >
              <Text>Concession</Text>
            </View>
            <View
              style={[styles.tableHeaderCell, { width: COL_WIDTHS.lateFee, textAlign: "right" }]}
            >
              <Text>Late Fee</Text>
            </View>
            <View style={[styles.tableHeaderCell, { width: COL_WIDTHS.paid, textAlign: "right" }]}>
              <Text>Paid</Text>
            </View>
            <View
              style={[
                styles.tableHeaderCell,
                { width: COL_WIDTHS.balance, textAlign: "right", borderRightWidth: 0 },
              ]}
            >
              <Text>Balance</Text>
            </View>
          </View>

          {lineItems.map((it, idx) => (
            <View
              key={`${it.invoiceNumber}-${idx}`}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowOdd : {}]}
              wrap={false}
            >
              <View style={[styles.tableCell, { width: COL_WIDTHS.feeHead }]}>
                <Text>{it.feeHeadName}</Text>
              </View>
              <View style={[styles.tableCell, { width: COL_WIDTHS.invoiceNo }]}>
                <Text>{it.invoiceNumber}</Text>
              </View>
              <View style={[styles.tableCell, { width: COL_WIDTHS.term }]}>
                <Text>{it.term}</Text>
              </View>
              <View style={[styles.tableCell, { width: COL_WIDTHS.gross, textAlign: "right" }]}>
                <Text>{formatINR(toPaise(it.grossAmount))}</Text>
              </View>
              <View
                style={[styles.tableCell, { width: COL_WIDTHS.concession, textAlign: "right" }]}
              >
                <Text>{formatINR(toPaise(it.discountAmount))}</Text>
              </View>
              <View style={[styles.tableCell, { width: COL_WIDTHS.lateFee, textAlign: "right" }]}>
                <Text>{formatINR(toPaise(it.lateFeeAmount))}</Text>
              </View>
              <View
                style={[
                  styles.tableCell,
                  { width: COL_WIDTHS.paid, textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                <Text>{formatINR(toPaise(it.amountPaid))}</Text>
              </View>
              <View
                style={[
                  styles.tableCell,
                  { width: COL_WIDTHS.balance, textAlign: "right", borderRightWidth: 0 },
                ]}
              >
                <Text>{formatINR(toPaise(it.balanceAmount))}</Text>
              </View>
            </View>
          ))}

          {/* Totals Row */}
          <View style={styles.tableTotalRow} wrap={false}>
            <View style={[styles.tableTotalCell, { width: "46%" }]}>
              <Text>TOTAL ({lineItems.length} Item{lineItems.length === 1 ? "" : "s"})</Text>
            </View>
            <View style={[styles.tableTotalCell, { width: COL_WIDTHS.gross, textAlign: "right" }]}>
              <Text>{formatINR(totalGrossPaise)}</Text>
            </View>
            <View
              style={[styles.tableTotalCell, { width: COL_WIDTHS.concession, textAlign: "right" }]}
            >
              <Text>{formatINR(totalDiscountPaise)}</Text>
            </View>
            <View
              style={[styles.tableTotalCell, { width: COL_WIDTHS.lateFee, textAlign: "right" }]}
            >
              <Text>{formatINR(totalLateFeePaise)}</Text>
            </View>
            <View style={[styles.tableTotalCell, { width: COL_WIDTHS.paid, textAlign: "right" }]}>
              <Text>{formatINR(totalPaidPaise)}</Text>
            </View>
            <View
              style={[
                styles.tableTotalCell,
                { width: COL_WIDTHS.balance, textAlign: "right", borderRightWidth: 0 },
              ]}
            >
              <Text>{formatINR(totalBalancePaise)}</Text>
            </View>
          </View>
        </View>

        {/* Amount in Words */}
        <View style={styles.wordsBox} wrap={false}>
          <Text style={styles.wordsLabel}>Amount Received in Words</Text>
          <Text style={styles.wordsValue}>{amountInWords}</Text>
        </View>

        {/* Payment Mode, Reference & Remarks */}
        <View style={styles.paymentDetailsBox} wrap={false}>
          <Text style={styles.sectionHeading}>Payment & Transaction Reference</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Payment Mode:</Text>
            <Text style={styles.metaValue}>
              {payment?.paymentMethod || payment?.paymentMode || "CASH"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Transaction Reference / UTR / Cheque No:</Text>
            <Text style={styles.metaValue}>{payment?.transactionReference || "N/A"}</Text>
          </View>
          {payment?.remarks && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Remarks:</Text>
              <Text style={styles.metaValue}>{payment.remarks}</Text>
            </View>
          )}
        </View>

        {/* Received By & Authorized Signature Box */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.receivedByBlock}>
            <Text style={styles.metaLabel}>Received By:</Text>
            <Text style={{ fontSize: 9, color: "#0f172a" }}>
              {cashierName || "Authorized School Cashier"}
            </Text>
            <Text style={{ fontSize: 7.5, color: "#64748b" }}>
              This is an official computer-generated receipt.
            </Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>Authorized Signatory</Text>
            <Text style={styles.signatureSub}>Accounts / School Stamp</Text>
          </View>
        </View>

        <SchoolDocumentFooter pageLabel={`Receipt ${receiptNo}`} />
      </Page>
    </Document>
  );
}
