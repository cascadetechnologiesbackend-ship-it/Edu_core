import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface LibraryReportRow {
  accessionNumber: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
  issuedCopies: number;
  availableCopies: number;
}

export interface LibraryReportPDFProps {
  school: SchoolInfo;
  scope?: string;
  academicYear?: string;
  rows: LibraryReportRow[];
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
  { key: "accessionNumber", label: "Acc. No.", width: "13%", align: "left" },
  { key: "title", label: "Book Title", width: "29%", align: "left" },
  { key: "author", label: "Author", width: "19%", align: "left" },
  { key: "category", label: "Category", width: "15%", align: "left" },
  { key: "totalCopies", label: "Total", width: "8%", align: "right" },
  { key: "issuedCopies", label: "Issued", width: "8%", align: "right" },
  { key: "availableCopies", label: "Avail.", width: "8%", align: "right" },
];

export function LibraryReportPDF({ school, scope, academicYear, rows }: LibraryReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Library Inventory & Circulation Report"
          scope={scope}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`Total Titles: ${rows.length}`} />
      </Page>
    </Document>
  );
}
