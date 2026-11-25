import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface FeeChallanItem {
  challanNumber: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  dueDate: string;
  feeHeads: { headName: string; amountFormatted: string }[];
  totalDueFormatted: string;
}

export interface FeeChallanBatchPDFProps {
  school: SchoolInfo;
  feeCycleLabel: string;
  academicYear?: string;
  challans: FeeChallanItem[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
  },
  metaBox: {
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    borderStyle: "solid",
    borderRadius: 2,
    backgroundColor: "#F9FAFB",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  metaText: {
    fontSize: 9,
    color: "#222222",
  },
  totalBox: {
    marginTop: 10,
    alignItems: "flex-end",
  },
  totalText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#003E80",
  },
});

const COLUMNS: PDFTableColumn[] = [
  { key: "headName", label: "Fee Head", width: "70%", align: "left" },
  { key: "amountFormatted", label: "Amount (INR)", width: "30%", align: "right" },
];

export function FeeChallanBatchPDF({
  school,
  feeCycleLabel,
  academicYear,
  challans,
}: FeeChallanBatchPDFProps) {
  return (
    <Document>
      {challans.map((challan) => (
        <Page key={challan.challanNumber} size="A4" style={styles.page}>
          <SchoolDocumentHeader
            school={school}
            reportTitle="Fee Challan"
            subtitle={feeCycleLabel}
            academicYear={academicYear}
          />
          <View style={styles.metaBox}>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Challan No: {challan.challanNumber}</Text>
              <Text style={styles.metaText}>Due Date: {challan.dueDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Student: {challan.studentName}</Text>
              <Text style={styles.metaText}>Adm. No: {challan.admissionNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Class: {challan.className}</Text>
            </View>
          </View>
          <SchoolPDFTable
            columns={COLUMNS}
            rows={challan.feeHeads as unknown as Record<string, unknown>[]}
          />
          <View style={styles.totalBox}>
            <Text style={styles.totalText}>Total Payable: {challan.totalDueFormatted}</Text>
          </View>
          <SchoolDocumentFooter pageLabel={`Challan ${challan.challanNumber}`} />
        </Page>
      ))}
    </Document>
  );
}
