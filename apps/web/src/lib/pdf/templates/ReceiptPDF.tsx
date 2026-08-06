import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { decryptData } from "@/lib/encryption";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 12, color: "#333" },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#111" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bold: { fontWeight: "bold" },
  section: {
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 5,
  },
  sectionTitle: { fontSize: 14, fontWeight: "bold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#111",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#999",
    fontSize: 10,
  },
});

export function ReceiptPDF({ payment, invoice, student, school }: any) {
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
          <Text>
            <Text style={styles.bold}>Receipt No:</Text> {payment.receiptNumber}
          </Text>
          <Text>
            <Text style={styles.bold}>Date:</Text>{" "}
            {new Date(payment.paymentDate).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Details</Text>
        </View>

        <View style={styles.row}>
          <Text>
            <Text style={styles.bold}>Name:</Text> {fName} {lName}
          </Text>
          <Text>
            <Text style={styles.bold}>Admission No:</Text>{" "}
            {student.admissionNumber}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
        </View>

        <View style={styles.row}>
          <Text>Payment Mode:</Text>
          <Text>{payment.paymentMode || payment.paymentMethod}</Text>
        </View>
        <View style={styles.row}>
          <Text>Transaction Ref:</Text>
          <Text>{payment.transactionReference || "N/A"}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={[styles.bold, { fontSize: 14 }]}>Amount Paid:</Text>
          <Text style={[styles.bold, { fontSize: 14 }]}>
            ₹{payment.amountPaid}
          </Text>
        </View>

        {invoice && (
          <View style={[styles.row, { marginTop: 10 }]}>
            <Text>Remaining Invoice Balance:</Text>
            <Text>₹{invoice.balanceAmount}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>
            This is a computer-generated document. No signature required.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
