// ─── Class 9-10 Report Card Template (CBSE Board-Aligned) ─────────────────────
// Internal Assessment + Periodic Test + Half-Yearly + Annual
// Practical marks separate; CBSE grading scale

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Watermark } from "../WatermarkWrapper";

const PRIMARY = "#7c3aed";
const LIGHT_BG = "#f5f3ff";
const HEADER_BG = "#7c3aed";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, padding: 32, backgroundColor: "#fff" },
  header: { alignItems: "center", marginBottom: 12, borderBottom: 2, borderBottomColor: PRIMARY, paddingBottom: 10 },
  schoolName: { fontSize: 17, fontWeight: "bold", color: "#4c1d95" },
  boardLabel: { fontSize: 9, color: "#7c3aed", marginTop: 2, letterSpacing: 2 },
  reportTitle: { fontSize: 11, color: PRIMARY, marginTop: 3 },
  studentCard: { flexDirection: "row", backgroundColor: LIGHT_BG, borderRadius: 5, padding: 9, marginBottom: 10, flexWrap: "wrap", gap: 5 },
  studentField: { minWidth: 100 },
  fieldLabel: { fontSize: 7, color: "#6b7280", marginBottom: 2 },
  fieldValue: { fontSize: 9, fontWeight: "bold", color: "#111827" },
  sectionTitle: { fontSize: 10, fontWeight: "bold", color: PRIMARY, marginTop: 10, marginBottom: 5, paddingBottom: 3, borderBottom: 1, borderBottomColor: "#ddd6fe" },
  table: { border: 1, borderColor: "#ddd6fe", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  tableHeader: { flexDirection: "row", backgroundColor: HEADER_BG, paddingVertical: 5, paddingHorizontal: 6 },
  th: { color: "#fff", fontSize: 7, fontWeight: "bold" },
  tableRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottom: 1, borderBottomColor: "#f5f3ff" },
  tableRowAlt: { backgroundColor: "#faf9ff" },
  summaryRow: { flexDirection: "row", backgroundColor: LIGHT_BG, paddingVertical: 5, paddingHorizontal: 6, fontWeight: "bold" },
  gradeScale: { marginTop: 8, border: 1, borderColor: "#ddd6fe", borderRadius: 3, padding: 6 },
  gradeScaleTitle: { fontSize: 8, fontWeight: "bold", color: "#4c1d95", marginBottom: 4 },
  gradeScaleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  gradeItem: { fontSize: 7, color: "#374151" },
  remarksBox: { marginTop: 8, padding: 7, backgroundColor: "#fafafa", border: 1, borderColor: "#e5e7eb", borderRadius: 3 },
  signatureRow: { flexDirection: "row", marginTop: 20, justifyContent: "space-between" },
  signatureBlock: { alignItems: "center", width: 95 },
  signatureLine: { borderTop: 1, borderTopColor: "#374151", width: 75, marginBottom: 3 },
  signatureLabel: { fontSize: 7, color: "#6b7280", textAlign: "center" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, fontSize: 8, fontWeight: "bold", alignSelf: "flex-start", marginTop: 4, marginBottom: 4 },
});

interface AssessmentBreakdown {
  periodicTest: number | null; // PT1 + PT2 average (max 10 each → avg → 10)
  multipleAssessment: number | null; // Notebook submission + Subject Enrichment (max 10)
  halfYearly: number | null; // Half-yearly exam marks (converted to max 80)
  annual: number | null;    // Annual exam marks (max 80)
  practical: number | null;
  practicalMax?: number;
}

interface BoardSubject {
  name: string;
  code: string;
  subjectType: "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE";
  internalAssessment: number | null; // out of 20
  theory: number | null; // out of 80
  practical: number | null;
  practicalMax?: number;
  totalMarks: number | null; // out of 100
  grade: string;
  gradePoint: number;
  isAbsent: boolean;
  isMedicalExempt: boolean;
  isPracticalAbsent?: boolean;
  assessmentBreakdown?: AssessmentBreakdown;
}

interface CoScholasticEntry {
  activity: string;
  grade: string; // A, B, C, D
}

export interface Class9to10ReportData {
  schoolName: string;
  boardName: string; // "CENTRAL BOARD OF SECONDARY EDUCATION"
  studentName: string;
  admissionNumber: string;
  rollNumber?: string;
  classDisplay: string;
  section: string;
  academicYear: string;
  examName: string;
  attendancePercent?: number;
  rank?: number;
  totalStudents?: number;
  scholasticSubjects: BoardSubject[];
  coScholastic: CoScholasticEntry[];
  cgpa?: number;
  totalTheoryMarks?: number;
  totalMaxTheory?: number;
  isPassed: boolean;
  overallGrade: string;
  teacherRemarks?: string;
  principalRemarks?: string;
  classTeacherName?: string;
  principalName?: string;
  isWatermarked?: boolean;
  watermarkDate?: string;
}

const CBSE_SCALE = [
  { range: "91-100", grade: "A1", gp: "10.0" },
  { range: "81-90", grade: "A2", gp: "9.0" },
  { range: "71-80", grade: "B1", gp: "8.0" },
  { range: "61-70", grade: "B2", gp: "7.0" },
  { range: "51-60", grade: "C1", gp: "6.0" },
  { range: "41-50", grade: "C2", gp: "5.0" },
  { range: "33-40", grade: "D", gp: "4.0" },
  { range: "00-32", grade: "E", gp: "Fail" },
];

export function Class9to10Template({ data }: { data: Class9to10ReportData }) {
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
          <Text style={styles.boardLabel}>{data.boardName}</Text>
          <Text style={styles.reportTitle}>
            {data.examName} — {data.classDisplay} | {data.academicYear}
          </Text>
        </View>

        <View style={styles.studentCard}>
          {[
            { label: "Name", value: data.studentName },
            { label: "Admission No.", value: data.admissionNumber },
            { label: "Roll No.", value: data.rollNumber ?? "—" },
            { label: "Class & Section", value: `${data.classDisplay} — ${data.section}` },
            { label: "Attendance", value: data.attendancePercent != null ? `${data.attendancePercent.toFixed(1)}%` : "—" },
            { label: "Rank", value: data.rank ? `${data.rank} / ${data.totalStudents ?? "—"}` : "—" },
            { label: "CGPA", value: data.cgpa != null ? data.cgpa.toFixed(1) : "—" },
          ].map((f, i) => (
            <View key={i} style={styles.studentField}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldValue}>{f.value}</Text>
            </View>
          ))}
        </View>

        {/* Scholastic Performance */}
        <Text style={styles.sectionTitle}>Part I — Scholastic Performance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 3 }]}>Subject</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>IA (20)</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Theory (80)</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Practical</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Total (100)</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Grade</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>GP</Text>
          </View>

          {data.scholasticSubjects.map((s, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : {}]}>
              <Text style={{ flex: 3, fontSize: 8, color: "#374151" }}>{s.name}</Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 8 }}>
                {s.isMedicalExempt ? "ME" : s.isAbsent ? "AB" : (s.internalAssessment ?? "—")}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 8 }}>
                {s.isMedicalExempt ? "ME" : s.isAbsent ? "AB" : (s.theory ?? "—")}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 8 }}>
                {s.practicalMax
                  ? s.isPracticalAbsent
                    ? "PA"
                    : `${s.practical ?? "—"}/${s.practicalMax}`
                  : "N/A"}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 8, fontWeight: "bold" }}>
                {s.isMedicalExempt ? "ME" : s.isAbsent ? "AB" : (s.totalMarks ?? "—")}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: "bold", color: PRIMARY }}>
                {s.grade}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 8, color: "#6b7280" }}>
                {s.isMedicalExempt || s.isAbsent ? "—" : s.gradePoint.toFixed(1)}
              </Text>
            </View>
          ))}

          <View style={styles.summaryRow}>
            <Text style={{ flex: 3, fontSize: 8 }}>Overall Result</Text>
            <Text style={{ flex: 1 }} />
            <Text style={{ flex: 1, textAlign: "center", fontSize: 8 }}>
              {data.totalTheoryMarks}/{data.totalMaxTheory}
            </Text>
            <Text style={{ flex: 1 }} />
            <Text style={{ flex: 1 }} />
            <Text style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: "bold", color: PRIMARY }}>
              {data.overallGrade}
            </Text>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 8, color: PRIMARY }}>
              CGPA: {data.cgpa?.toFixed(1) ?? "—"}
            </Text>
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: data.isPassed ? "#d1fae5" : "#fee2e2" }]}>
          <Text style={{ color: data.isPassed ? "#065f46" : "#991b1b", fontSize: 8 }}>
            {data.isPassed ? "RESULT: PASS ✓" : "RESULT: FAIL / COMPARTMENT ✗"}
          </Text>
        </View>

        {/* Co-Scholastic */}
        {data.coScholastic.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Part II — Co-Scholastic Activities</Text>
            <View style={styles.table}>
              {data.coScholastic.map((item, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : {}]}>
                  <Text style={{ flex: 5, fontSize: 8 }}>{item.activity}</Text>
                  <Text style={{ flex: 1, textAlign: "center", fontSize: 9, fontWeight: "bold", color: PRIMARY }}>
                    {item.grade}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* CBSE Grading Scale */}
        <View style={styles.gradeScale}>
          <Text style={styles.gradeScaleTitle}>CBSE 10-Point Grading Scale</Text>
          <View style={styles.gradeScaleRow}>
            {CBSE_SCALE.map((g, i) => (
              <Text key={i} style={styles.gradeItem}>
                {g.range}% → {g.grade} (GP {g.gp}){"   "}
              </Text>
            ))}
          </View>
        </View>

        {data.teacherRemarks && (
          <View style={styles.remarksBox}>
            <Text style={{ fontSize: 8, fontWeight: "bold", marginBottom: 3 }}>
              Class Teacher Remarks:
            </Text>
            <Text style={{ fontSize: 8, color: "#374151" }}>{data.teacherRemarks}</Text>
          </View>
        )}

        <View style={styles.signatureRow}>
          {[
            { label: "Class Teacher", name: data.classTeacherName },
            { label: "Parent / Guardian", name: undefined },
            { label: "Principal", name: data.principalName },
          ].map((s, i) => (
            <View key={i} style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>{s.label}</Text>
              {s.name && <Text style={[styles.signatureLabel, { color: "#374151" }]}>{s.name}</Text>}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
