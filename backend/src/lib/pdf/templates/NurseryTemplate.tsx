// ─── Nursery/LKG/UKG Report Card Template ─────────────────────────────────────
// Activity skills with emoji indicators (🌟/⭐/✨), NO numeric marks

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
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: "#4f46e5",
    paddingBottom: 12,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e1b4b",
    marginTop: 6,
  },
  reportTitle: {
    fontSize: 13,
    color: "#4f46e5",
    marginTop: 4,
  },
  studentCard: {
    flexDirection: "row",
    backgroundColor: "#f0f0ff",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  studentField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#4f46e5",
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: 1,
    borderBottomColor: "#e5e7eb",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 3,
    borderRadius: 4,
  },
  activityRowAlt: {
    backgroundColor: "#f9fafb",
  },
  activityName: {
    flex: 2,
    fontSize: 9,
    color: "#374151",
  },
  emojiCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
  },
  levelLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 8,
    color: "#6b7280",
  },
  remarksBox: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#fafafa",
    border: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  signatureRow: {
    flexDirection: "row",
    marginTop: 30,
    justifyContent: "space-between",
  },
  signatureBlock: {
    alignItems: "center",
    width: 120,
  },
  signatureLine: {
    borderTop: 1,
    borderTopColor: "#374151",
    width: 100,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    fontSize: 8,
    color: "#6b7280",
  },
});

const LEVEL_EMOJI: Record<string, string> = {
  EXCELLENT: "🌟",
  GOOD: "⭐",
  SATISFACTORY: "✨",
  NEEDS_IMPROVEMENT: "🔆",
};

type ActivityLevel =
  "EXCELLENT" | "GOOD" | "SATISFACTORY" | "NEEDS_IMPROVEMENT";

interface ActivitySkill {
  area: string;
  skills: Array<{ name: string; level: ActivityLevel }>;
}

export interface NurseryReportCardData {
  schoolName: string;
  schoolLogoUrl?: string;
  studentName: string;
  admissionNumber: string;
  classDisplay: string;
  section: string;
  academicYear: string;
  attendancePercent?: number;
  teacherRemarks?: string;
  classTeacherName?: string;
  principalName?: string;
  activitySkills: ActivitySkill[];
  isWatermarked?: boolean;
  watermarkDate?: string;
}

export function NurseryTemplate({ data }: { data: NurseryReportCardData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.isWatermarked && (
          <Watermark
            studentName={data.studentName}
            date={data.watermarkDate ?? new Date().toLocaleDateString()}
          />
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{data.schoolName}</Text>
          <Text style={styles.reportTitle}>
            Progress Report Card — {data.classDisplay} | {data.academicYear}
          </Text>
        </View>

        {/* Student Info */}
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
            <Text style={styles.fieldValue}>
              {data.classDisplay} — {data.section}
            </Text>
          </View>
          {data.attendancePercent !== undefined && (
            <View style={styles.studentField}>
              <Text style={styles.fieldLabel}>Attendance</Text>
              <Text style={styles.fieldValue}>
                {data.attendancePercent.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <Text style={styles.legendItem}>🌟 Excellent</Text>
          <Text style={styles.legendItem}>⭐ Good</Text>
          <Text style={styles.legendItem}>✨ Satisfactory</Text>
          <Text style={styles.legendItem}>🔆 Needs Improvement</Text>
        </View>

        {/* Activity Skill Areas */}
        {data.activitySkills.map((area, aIdx) => (
          <View key={aIdx}>
            <Text style={styles.sectionTitle}>{area.area}</Text>
            {area.skills.map((skill, sIdx) => (
              <View
                key={sIdx}
                style={[
                  styles.activityRow,
                  sIdx % 2 === 0 ? styles.activityRowAlt : {},
                ]}
              >
                <Text style={styles.activityName}>{skill.name}</Text>
                <Text style={styles.emojiCell}>{LEVEL_EMOJI[skill.level]}</Text>
                <Text style={styles.levelLabel}>
                  {skill.level.replace("_", " ")}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Teacher Remarks */}
        {data.teacherRemarks && (
          <View style={styles.remarksBox}>
            <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
              Class Teacher Remarks:
            </Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>
              {data.teacherRemarks}
            </Text>
          </View>
        )}

        {/* Signatures */}
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
