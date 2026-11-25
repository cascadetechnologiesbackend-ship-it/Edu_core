import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface PayrollStatementRow {
  employeeCode: string;
  staffName: string;
  department: string;
  grossPayFormatted: string;
  deductionsFormatted: string;
  netPayFormatted: string;
  status: string;
}

export interface PayrollStatementPDFProps {
  school: SchoolInfo;
  monthLabel: string;
  totalNetPayFormatted: string;
  academicYear?: string;
  rows: PayrollStatementRow[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
  },
});

const COLUMNS: PDFTableColumn[] = [
  { key: "employeeCode", label: "Emp. Code", width: "12%", align: "left" },
  { key: "staffName", label: "Staff Name", width: "24%", align: "left" },
  { key: "department", label: "Department", width: "16%", align: "left" },
  { key: "grossPayFormatted", label: "Gross (INR)", width: "13%", align: "right" },
  { key: "deductionsFormatted", label: "Deductions", width: "12%", align: "right" },
  { key: "netPayFormatted", label: "Net Pay (INR)", width: "13%", align: "right" },
  { key: "status", label: "Status", width: "10%", align: "center" },
];

export function PayrollStatementPDF({
  school,
  monthLabel,
  totalNetPayFormatted,
  academicYear,
  rows,
}: PayrollStatementPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Payroll Statement"
          subtitle={`${monthLabel} | Total Net Disbursal: ${totalNetPayFormatted}`}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`${monthLabel} | Net: ${totalNetPayFormatted}`} />
      </Page>
    </Document>
  );
}
