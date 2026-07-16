import { db } from "@/db";
import { feePayments, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { decryptData } from "@/lib/encryption";
import { auth } from "@/lib/auth";

// Basic styles for PDF
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 12, color: "#333" },
  header: { borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 10, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#111" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  bold: { fontWeight: "bold" },
  section: { marginTop: 20, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 5 },
  sectionTitle: { fontSize: 14, fontWeight: "bold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#000" },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40, textAlign: "center", color: "#999", fontSize: 10 }
});

const ReceiptPDF = ({ payment, invoice, student, school }: any) => {
  const fName = decryptData(student.firstNameEncrypted) || "";
  const lName = decryptData(student.lastNameEncrypted) || "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{school.name}</Text>
          <Text style={styles.subtitle}>Fee Receipt</Text>
        </View>

        <View style={styles.row}>
          <Text><Text style={styles.bold}>Receipt No:</Text> {payment.receiptNumber}</Text>
          <Text><Text style={styles.bold}>Date:</Text> {new Date(payment.paymentDate).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text><Text style={styles.bold}>Student:</Text> {fName} {lName} ({student.admissionNumber})</Text>
          <Text><Text style={styles.bold}>Method:</Text> {payment.paymentMethod}</Text>
        </View>
        
        {payment.transactionReference && (
          <View style={styles.row}>
            <Text><Text style={styles.bold}>Transaction Ref:</Text> {payment.transactionReference}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
        </View>
        <View style={styles.row}>
          <Text>Invoice No:</Text>
          <Text>{invoice.invoiceNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text>Term:</Text>
          <Text>{invoice.term}</Text>
        </View>
        <View style={styles.row}>
          <Text>Gross Amount:</Text>
          <Text>INR {invoice.grossAmount}</Text>
        </View>
        <View style={styles.row}>
          <Text>Discount:</Text>
          <Text>- INR {invoice.discountAmount}</Text>
        </View>
        <View style={styles.row}>
          <Text>Late Fee:</Text>
          <Text>+ INR {invoice.lateFeeAmount}</Text>
        </View>
        
        <View style={styles.totalRow}>
          <Text style={styles.bold}>Amount Paid This Receipt:</Text>
          <Text style={styles.bold}>INR {payment.amountPaid}</Text>
        </View>
        
        <Text style={styles.footer}>This is a computer generated receipt and does not require a physical signature.</Text>
      </Page>
    </Document>
  );
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    
    // Check authentication
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payment = await db.query.feePayments.findFirst({
      where: eq(feePayments.id, params.id),
      with: {
        invoice: true,
        school: true,
      }
    });

    if (!payment) return new NextResponse("Payment not found", { status: 404 });

    const student = await db.query.students.findFirst({
      where: eq(students.id, payment.studentId)
    });

    if (!student) return new NextResponse("Student not found", { status: 404 });

    // Validate DPDP: Only primary parent can view
    if (student.primaryParentUserId !== session.user.id) {
      return new NextResponse("Unauthorized to view this receipt", { status: 403 });
    }

    const stream = await renderToStream(
      <ReceiptPDF 
        payment={payment} 
        invoice={payment.invoice} 
        student={student} 
        school={payment.school} 
      />
    );

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt_${payment.receiptNumber}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF Render Error:", error);
    return new NextResponse(error.message, { status: 500 });
  }
}
