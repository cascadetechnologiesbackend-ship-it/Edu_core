import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface TimetableRow {
  dayOfWeek: string;
  period1: string;
  period2: string;
  period3: string;
  period4: string;
  period5: string;
  period6: string;
  period7: string;
  period8: string;
}

export interface TimetablePDFProps {
  school: SchoolInfo;
  className: string;
  section: string;
  academicYear?: string;
  rows: TimetableRow[];
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
  { key: "dayOfWeek", label: "Day", width: "12%", align: "left" },
  { key: "period1", label: "P1", width: "11%", align: "center" },
  { key: "period2", label: "P2", width: "11%", align: "center" },
  { key: "period3", label: "P3", width: "11%", align: "center" },
  { key: "period4", label: "P4", width: "11%", align: "center" },
  { key: "period5", label: "P5", width: "11%", align: "center" },
  { key: "period6", label: "P6", width: "11%", align: "center" },
  { key: "period7", label: "P7", width: "11%", align: "center" },
  { key: "period8", label: "P8", width: "11%", align: "center" },
];

export function TimetablePDF({
  school,
  className,
  section,
  academicYear,
  rows,
}: TimetablePDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Class Timetable"
          subtitle={`${className} - Section ${section}`}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`${className}-${section}`} />
      </Page>
    </Document>
  );
}
