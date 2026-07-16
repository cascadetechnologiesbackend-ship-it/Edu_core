// ─── Class 1-5 Report Card Template ──────────────────────────────────────────
// Subject marks + letter grade + attendance % + teacher remarks + signature block

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Watermark } from "../WatermarkWrapper";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    backgroundColor: "#ffffff",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
    borderBottom: 2,
    borderBottomColor: "#059669",
    paddingBottom: 10,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#064e3b",
  },
  reportTitle: {
    fontSize: 12,
    color: "#059669",
    marginTop: 4,
  },
  studentCard: {
    flexDirection: "row",
    backgroundColor: "#ecfdf5",
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  studentField: {
    minWidth: 120,
  },
  fieldLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  fieldValue: { fontSize: 10, fontWeight: "bold", color: "#111827" },
  table: {
    marginTop: 8,
    border: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#059669",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  subjectCol: { flex: 3, fontSize: 9, color: "#374151" },
  maxCol: { flex: 1, textAlign: "center", fontSize: 9, color: "#6b7280" },
  obtainedCol: { flex: 1, textAlign: "center", fontSize: 9, fontWeight: "bold" },
  gradeCol: {
    flex: 1,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
    color: "#059669",
  },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#ecfdf5",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  remarksBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#fafafa",
    border: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  signatureRow: {
    flexDirection: "row",
    marginTop: 28,
    justifyContent: "space-between",
  },
  signatureBlock: { alignItems: "center", width: 110 },
  signatureLine: {
    borderTop: 1,
    borderTopColor: "#374151",
    width: 90,
    marginBottom: 4,
  },
  signatureLabel: { fontSize: 8, color: "#6b7280", textAlign: "center" },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginTop: 8,
  },
});

interface SubjectResult {
  name: string;
  maxMarks: number;
  marksObtained: number | null;
  grade: string;
  isAbsent: boolean;
  isMedicalExempt: boolean;
}

export interface Class1to5ReportData {
  schoolName: string;
  studentName: string;
  admissionNumber: string;
  classDisplay: string;
  section: string;
  academicYear: string;
  examName: string;
  rollNumber?: string;
  rank?: number;
  totalStudents?: number;
  attendancePercent?: number;
  subjects: SubjectResult[];
  totalMarks: number;
  totalMaxMarks: number;
  overallGrade: string;
  isPassed: boolean;
  teacherRemarks?: string;
  principalRemarks?: string;
  classTeacherName?: string;
  principalName?: string;
  isWatermarked?: boolean;
  watermarkDate?: string;
}

export function Class1to5Template({ data }: { data: Class1to5ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.isWatermarked && (
          <Watermark
            studentName={data.studentName}
            date={data.watermarkDate ?? new Date().toLocaleDateString()}
          />
        )}

        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.schoolName}</Text>
          <Text style={styles.reportTitle}>
            {data.examName} — {data.classDisplay} | {data.academicYear}
          </Text>
        </View>

        <View style={styles.studentCard}>
          <View style={styles.studentField}>
            <Text style={styles.fieldLabel}>Student Name</Text>
            <Text style={styles.fieldValue}>{data.studentName}</Text>
          </View>
          <View style={styles.studentField}>
            <Text style={styles.fieldLabel}>Admission No.</Text>
            <Text style={styles.fieldValue}>{data.admissionNumber}</Text>
          </View>
          <View style={styles.studentField}>
            <Text style={styles.fieldLabel}>Class & Section</Text>
            <Text style={styles.fieldValue}>{data.classDisplay} — {data.section}</Text>
          </View>
          {data.attendancePercent !== undefined && (
            <View style={styles.studentField}>
              <Text style={styles.fieldLabel}>Attendance</Text>
              <Text style={styles.fieldValue}>{data.attendancePercent.toFixed(1)}%</Text>
            </View>
          )}
          {data.rank && (
            <View style={styles.studentField}>
              <Text style={styles.fieldLabel}>Class Rank</Text>
              <Text style={styles.fieldValue}>
                {data.rank} / {data.totalStudents ?? "—"}
              </Text>
            </View>
          )}
        </View>

        {/* Marks Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Subject</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Max</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Obtained</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Grade</Text>
          </View>

          {data.subjects.map((s, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : {}]}>
              <Text style={styles.subjectCol}>{s.name}</Text>
              <Text style={styles.maxCol}>{s.maxMarks}</Text>
              <Text style={styles.obtainedCol}>
                {s.isAbsent ? "AB" : s.isMedicalExempt ? "ME" : (s.marksObtained ?? "—")}
              </Text>
              <Text style={styles.gradeCol}>{s.grade}</Text>
            </View>
          ))}

          <View style={styles.summaryRow}>
            <Text style={[styles.subjectCol, { fontWeight: "bold" }]}>TOTAL</Text>
            <Text style={styles.maxCol}>{data.totalMaxMarks}</Text>
            <Text style={[styles.obtainedCol, { fontWeight: "bold" }]}>
              {data.totalMarks}
            </Text>
            <Text style={[styles.gradeCol, { fontWeight: "bold", fontSize: 11 }]}>
              {data.overallGrade}
            </Text>
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: data.isPassed ? "#d1fae5" : "#fee2e2" }]}>
          <Text style={{ color: data.isPassed ? "#065f46" : "#991b1b", fontSize: 10 }}>
            {data.isPassed ? "RESULT: PASS ✓" : "RESULT: FAIL ✗"}
          </Text>
        </View>

        {data.teacherRemarks && (
          <View style={styles.remarksBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Class Teacher Remarks:
            </Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>{data.teacherRemarks}</Text>
          </View>
        )}

        {data.principalRemarks && (
          <View style={[styles.remarksBox, { marginTop: 6 }]}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Principal Remarks:
            </Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>{data.principalRemarks}</Text>
          </View>
        )}

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Class Teacher</Text>
            {data.classTeacherName && (
              <Text style={[styles.signatureLabel, { color: "#374151" }]}>
                {data.classTeacherName}
              </Text>
            )}
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Parent / Guardian</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Principal</Text>
            {data.principalName && (
              <Text style={[styles.signatureLabel, { color: "#374151" }]}>
                {data.principalName}
              </Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
