// ─── Topper Certificate Template ──────────────────────────────────────────────
// Gold border, school logo, merit details; used for Merit list + Topper recognition

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const GOLD = "#b8860b";
const GOLD_LIGHT = "#fef3c7";
const GOLD_BORDER = "#d97706";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 12,
    padding: 0,
    backgroundColor: "#fffbeb",
  },
  outerBorder: {
    margin: 18,
    border: 4,
    borderColor: GOLD_BORDER,
    borderRadius: 8,
    padding: 0,
    flex: 1,
  },
  innerBorder: {
    margin: 6,
    border: 1,
    borderColor: GOLD,
    borderRadius: 4,
    padding: 32,
    flex: 1,
    alignItems: "center",
  },
  cornerDecoration: {
    position: "absolute",
    fontSize: 24,
    color: GOLD,
  },
  topLeft: { top: 10, left: 10 },
  topRight: { top: 10, right: 10 },
  bottomLeft: { bottom: 10, left: 10 },
  bottomRight: { bottom: 10, right: 10 },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    border: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  schoolName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4c1d95",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 4,
  },
  schoolAddress: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  certTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: GOLD,
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  certSubtitle: {
    fontSize: 11,
    color: "#92400e",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 1,
  },
  divider: {
    borderBottom: 1,
    borderBottomColor: GOLD,
    width: "80%",
    marginVertical: 16,
  },
  presentedTo: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  studentName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1e1b4b",
    textAlign: "center",
    marginBottom: 6,
  },
  rankRow: {
    flexDirection: "row",
    gap: 40,
    marginTop: 8,
    marginBottom: 8,
  },
  statBlock: {
    alignItems: "center",
    minWidth: 80,
  },
  statLabel: {
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: GOLD,
    textAlign: "center",
  },
  statSub: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
  achievementText: {
    fontSize: 10,
    color: "#374151",
    textAlign: "center",
    marginVertical: 12,
    lineHeight: 1.6,
    width: "85%",
  },
  meritBadge: {
    backgroundColor: GOLD_LIGHT,
    border: 1,
    borderColor: GOLD,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 16,
  },
  meritText: {
    fontSize: 12,
    fontWeight: "bold",
    color: GOLD,
    textAlign: "center",
    letterSpacing: 2,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "90%",
    marginTop: 24,
  },
  signatureBlock: {
    alignItems: "center",
    minWidth: 110,
  },
  signatureLine: {
    borderTop: 1,
    borderTopColor: "#374151",
    width: 90,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#6b7280",
    textAlign: "center",
  },
  dateText: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 12,
  },
});

export interface TopperCertificateData {
  schoolName: string;
  schoolAddress?: string;
  schoolLogoUrl?: string;
  studentName: string;
  classDisplay: string;
  section: string;
  academicYear: string;
  examName: string;
  rank: number;
  totalStudents: number;
  totalMarks: number;
  totalMaxMarks: number;
  overallPercent: number;
  overallGrade: string;
  cgpa?: number;
  principalName?: string;
  classTeacherName?: string;
  issuedDate: string;
  certificateNumber: string;
}

export function TopperCertificate({ data }: { data: TopperCertificateData }) {
  const isFirstRank = data.rank === 1;
  const meritLabel = isFirstRank
    ? "SCHOOL TOPPER"
    : data.rank <= 3
      ? `${data.rank}${data.rank === 2 ? "nd" : "rd"} RANK HOLDER`
      : `MERIT CERTIFICATE`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>
            {/* Corner Decorations */}
            <Text style={[styles.cornerDecoration, styles.topLeft]}>❋</Text>
            <Text style={[styles.cornerDecoration, styles.topRight]}>❋</Text>
            <Text style={[styles.cornerDecoration, styles.bottomLeft]}>❋</Text>
            <Text style={[styles.cornerDecoration, styles.bottomRight]}>❋</Text>

            {/* School Header */}
            {data.schoolLogoUrl && (
              <View style={styles.logoContainer}>
                <Image
                  src={data.schoolLogoUrl}
                  style={{ width: 60, height: 60, objectFit: "contain" }}
                />
              </View>
            )}
            <Text style={styles.schoolName}>{data.schoolName}</Text>
            {data.schoolAddress && (
              <Text style={styles.schoolAddress}>{data.schoolAddress}</Text>
            )}

            <View style={styles.divider} />

            {/* Certificate Title */}
            <Text style={styles.certTitle}>Certificate of Merit</Text>
            <Text style={styles.certSubtitle}>
              Academic Excellence Award — {data.academicYear}
            </Text>

            {/* Recipient */}
            <Text style={styles.presentedTo}>
              This certificate is proudly presented to
            </Text>
            <Text style={styles.studentName}>{data.studentName}</Text>

            {/* Merit Badge */}
            <View style={styles.meritBadge}>
              <Text style={styles.meritText}>
                🏆 {meritLabel} — {data.classDisplay} {data.section}
              </Text>
            </View>

            {/* Achievement Stats */}
            <View style={styles.rankRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Class Rank</Text>
                <Text style={styles.statValue}>{data.rank}</Text>
                <Text style={styles.statSub}>out of {data.totalStudents}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Total Score</Text>
                <Text style={styles.statValue}>{data.totalMarks}</Text>
                <Text style={styles.statSub}>out of {data.totalMaxMarks}</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statLabel}>Percentage</Text>
                <Text style={styles.statValue}>
                  {data.overallPercent.toFixed(1)}%
                </Text>
                <Text style={styles.statSub}>Grade {data.overallGrade}</Text>
              </View>
              {data.cgpa != null && (
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>CGPA</Text>
                  <Text style={styles.statValue}>{data.cgpa.toFixed(1)}</Text>
                  <Text style={styles.statSub}>10-point scale</Text>
                </View>
              )}
            </View>

            <Text style={styles.achievementText}>
              For outstanding academic performance in the {data.examName}{" "}
              examination of the Academic Year {data.academicYear},
              demonstrating exceptional dedication and commitment to excellence.
            </Text>

            <View style={styles.divider} />

            {/* Signatures */}
            <View style={styles.signatureRow}>
              {data.classTeacherName && (
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>Class Teacher</Text>
                  <Text style={[styles.signatureLabel, { color: "#374151" }]}>
                    {data.classTeacherName}
                  </Text>
                </View>
              )}
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

            <Text style={styles.dateText}>
              Date: {data.issuedDate} | Certificate No: {data.certificateNumber}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
