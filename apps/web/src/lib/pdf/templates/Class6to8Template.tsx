// ─── Class 6-8 Report Card Template ──────────────────────────────────────────
// Scholastic (marks, grade, rank) + Co-Scholastic (activities, values, attitudes) + attendance

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Watermark } from "../WatermarkWrapper";

const PRIMARY = "#1d4ed8";
const LIGHT_BG = "#eff6ff";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 36,
    backgroundColor: "#fff",
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
    borderBottom: 2,
    borderBottomColor: PRIMARY,
    paddingBottom: 10,
  },
  schoolName: { fontSize: 18, fontWeight: "bold", color: "#1e3a8a" },
  reportTitle: { fontSize: 11, color: PRIMARY, marginTop: 4 },
  studentCard: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 6,
  },
  studentField: { minWidth: 110 },
  fieldLabel: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
  fieldValue: { fontSize: 10, fontWeight: "bold", color: "#111827" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: PRIMARY,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: 1,
    borderBottomColor: "#bfdbfe",
  },
  table: {
    border: 1,
    borderColor: "#dbeafe",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderText: { color: "#fff", fontSize: 8, fontWeight: "bold" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottom: 1,
    borderBottomColor: "#f1f5f9",
  },
  tableRowAlt: { backgroundColor: "#f8faff" },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  coScholasticRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottom: 1,
    borderBottomColor: "#f1f5f9",
  },
  remarksBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#fafafa",
    border: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  signatureRow: {
    flexDirection: "row",
    marginTop: 24,
    justifyContent: "space-between",
  },
  signatureBlock: { alignItems: "center", width: 100 },
  signatureLine: {
    borderTop: 1,
    borderTopColor: "#374151",
    width: 80,
    marginBottom: 4,
  },
  signatureLabel: { fontSize: 8, color: "#6b7280", textAlign: "center" },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginTop: 6,
    marginBottom: 4,
  },
});

interface ScholasticSubject {
  name: string;
  maxMarks: number;
  marksObtained: number | null;
  practicalMarks?: number | null;
  practicalMaxMarks?: number | null;
  grade: string;
  isAbsent: boolean;
  isMedicalExempt: boolean;
  isPracticalAbsent?: boolean;
}

interface CoScholasticItem {
  category: string; // "Co-Curricular", "Values & Attitudes", "Health & Physical Education"
  name: string;
  grade: string; // A, B, C, D
}

export interface Class6to8ReportData {
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
  scholasticSubjects: ScholasticSubject[];
  coScholastic: CoScholasticItem[];
  totalMarks: number;
  totalMaxMarks: number;
  overallGrade: string;
  overallGradePoint: number;
  isPassed: boolean;
  teacherRemarks?: string;
  principalRemarks?: string;
  classTeacherName?: string;
  principalName?: string;
  isWatermarked?: boolean;
  watermarkDate?: string;
}

export function Class6to8Template({ data }: { data: Class6to8ReportData }) {
  // Group co-scholastic by category
  const coSchCategories = Array.from(
    new Set(data.coScholastic.map((c) => c.category)),
  );

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
          {[
            { label: "Student Name", value: data.studentName },
            { label: "Admission No.", value: data.admissionNumber },
            {
              label: "Class & Section",
              value: `${data.classDisplay} — ${data.section}`,
            },
            {
              label: "Attendance",
              value:
                data.attendancePercent != null
                  ? `${data.attendancePercent.toFixed(1)}%`
                  : "—",
            },
            {
              label: "Class Rank",
              value: data.rank
                ? `${data.rank} / ${data.totalStudents ?? "—"}`
                : "—",
            },
          ].map((f, i) => (
            <View key={i} style={styles.studentField}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <Text style={styles.fieldValue}>{f.value}</Text>
            </View>
          ))}
        </View>

        {/* PART A: Scholastic */}
        <Text style={styles.sectionTitle}>Part A — Scholastic Performance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 3 }]}>Subject</Text>
            <Text
              style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}
            >
              Theory Max
            </Text>
            <Text
              style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}
            >
              Theory Obt.
            </Text>
            <Text
              style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}
            >
              Practical
            </Text>
            <Text
              style={[styles.tableHeaderText, { flex: 1, textAlign: "center" }]}
            >
              Grade
            </Text>
          </View>

          {data.scholasticSubjects.map((s, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowAlt : {}]}
            >
              <Text style={{ flex: 3, fontSize: 9, color: "#374151" }}>
                {s.name}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 9 }}>
                {s.maxMarks}
              </Text>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 9,
                  fontWeight: "bold",
                }}
              >
                {s.isAbsent
                  ? "AB"
                  : s.isMedicalExempt
                    ? "ME"
                    : (s.marksObtained ?? "—")}
              </Text>
              <Text style={{ flex: 1, textAlign: "center", fontSize: 9 }}>
                {s.practicalMaxMarks
                  ? s.isPracticalAbsent
                    ? "PA"
                    : `${s.practicalMarks ?? 0}/${s.practicalMaxMarks}`
                  : "N/A"}
              </Text>
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 9,
                  fontWeight: "bold",
                  color: PRIMARY,
                }}
              >
                {s.grade}
              </Text>
            </View>
          ))}

          <View style={styles.summaryRow}>
            <Text style={{ flex: 3, fontSize: 9, fontWeight: "bold" }}>
              TOTAL / OVERALL
            </Text>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 9 }}>
              {data.totalMaxMarks}
            </Text>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 9,
                fontWeight: "bold",
              }}
            >
              {data.totalMarks}
            </Text>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 9 }}>—</Text>
            <Text
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 11,
                fontWeight: "bold",
                color: PRIMARY,
              }}
            >
              {data.overallGrade} ({data.overallGradePoint.toFixed(1)})
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: data.isPassed ? "#d1fae5" : "#fee2e2" },
          ]}
        >
          <Text
            style={{
              color: data.isPassed ? "#065f46" : "#991b1b",
              fontSize: 9,
            }}
          >
            {data.isPassed ? "RESULT: PASS ✓" : "RESULT: FAIL ✗"}
          </Text>
        </View>

        {/* PART B: Co-Scholastic */}
        <Text style={styles.sectionTitle}>
          Part B — Co-Scholastic Activities
        </Text>
        {coSchCategories.map((cat, cIdx) => (
          <View key={cIdx} style={{ marginBottom: 6 }}>
            <Text
              style={{
                fontSize: 9,
                fontWeight: "bold",
                color: "#4b5563",
                marginBottom: 3,
              }}
            >
              {cat}
            </Text>
            <View style={styles.table}>
              {data.coScholastic
                .filter((c) => c.category === cat)
                .map((item, iIdx) => (
                  <View
                    key={iIdx}
                    style={[
                      styles.coScholasticRow,
                      iIdx % 2 === 0 ? styles.tableRowAlt : {},
                    ]}
                  >
                    <Text style={{ flex: 4, fontSize: 9, color: "#374151" }}>
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontSize: 10,
                        fontWeight: "bold",
                        color: PRIMARY,
                      }}
                    >
                      {item.grade}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        ))}

        {data.teacherRemarks && (
          <View style={styles.remarksBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 3 }}>
              Teacher Remarks:
            </Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>
              {data.teacherRemarks}
            </Text>
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
              {s.name && (
                <Text style={[styles.signatureLabel, { color: "#374151" }]}>
                  {s.name}
                </Text>
              )}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
