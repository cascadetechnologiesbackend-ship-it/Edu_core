import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { SchoolInfo } from "../components/SchoolDocumentHeader";
import "../fonts/registerFonts";

export interface StudentIdCardData {
  studentId: string;
  name: string;
  admissionNo: string;
  rollNumber?: string | null;
  className: string;
  section?: string | null;
  academicYear: string;
  bloodGroup?: string | null;
  dateOfBirth?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  /** Non-sensitive QR payload, e.g. SM-STU:<admissionNo>:<academicYear> */
  qrPayload?: string | null;
}

export interface StudentIdCardPDFProps {
  school: SchoolInfo;
  students: StudentIdCardData[];
  includeBack?: boolean;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardPairRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  card: {
    width: "48%",
    height: 162,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "solid",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    backgroundColor: "#003E80",
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 6,
    objectFit: "contain",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  schoolHeaderText: {
    flex: 1,
  },
  schoolName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  cardTag: {
    fontSize: 6.5,
    color: "#DBEAFE",
    marginTop: 1,
  },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    padding: 8,
  },
  photoBox: {
    width: 50,
    height: 62,
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderStyle: "solid",
    borderRadius: 3,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  photo: {
    width: 48,
    height: 60,
    objectFit: "cover",
  },
  photoPlaceholderText: {
    fontSize: 6.5,
    color: "#64748B",
    textAlign: "center",
  },
  detailsCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  studentName: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 1.5,
  },
  metaLabel: {
    fontSize: 7,
    color: "#64748B",
    width: 46,
  },
  metaValue: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#1E293B",
    flex: 1,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    borderTopStyle: "solid",
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  qrBox: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "solid",
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: "#FFFFFF",
  },
  qrText: {
    fontSize: 5.5,
    color: "#334155",
  },
  backBody: {
    flex: 1,
    padding: 8,
    justifyContent: "space-between",
  },
  backTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#003E80",
    marginBottom: 4,
  },
  backText: {
    fontSize: 6.8,
    color: "#334155",
    lineHeight: 1.35,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#94A3B8",
    borderTopStyle: "solid",
    paddingTop: 2,
    width: 70,
    alignItems: "center",
  },
  signatureLabel: {
    fontSize: 6,
    color: "#475569",
  },
});

function buildSafeQrPayload(student: StudentIdCardData): string {
  if (student.qrPayload) return student.qrPayload;
  return `SM-STU:${student.admissionNo}:${student.academicYear}`;
}

function StudentCardFront({
  school,
  student,
}: {
  school: SchoolInfo;
  student: StudentIdCardData;
}) {
  const logoSrc = school.logoUrl || school.logoS3Key || null;
  const classSection = student.section
    ? `${student.className} - ${student.section}`
    : student.className;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
        <View style={styles.schoolHeaderText}>
          <Text style={styles.schoolName}>{school.name}</Text>
          <Text style={styles.cardTag}>STUDENT IDENTITY CARD • {student.academicYear}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.photoBox}>
          {student.photoUrl ? (
            <Image style={styles.photo} src={student.photoUrl} />
          ) : (
            <Text style={styles.photoPlaceholderText}>PHOTO</Text>
          )}
        </View>

        <View style={styles.detailsCol}>
          <Text style={styles.studentName}>{student.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Adm. No:</Text>
            <Text style={styles.metaValue}>{student.admissionNo}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Class:</Text>
            <Text style={styles.metaValue}>{classSection}</Text>
          </View>
          {student.rollNumber ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Roll No:</Text>
              <Text style={styles.metaValue}>{student.rollNumber}</Text>
            </View>
          ) : null}
          {student.bloodGroup ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Blood Grp:</Text>
              <Text style={styles.metaValue}>{student.bloodGroup}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.qrBox}>
          <Text style={styles.qrText}>{buildSafeQrPayload(student)}</Text>
        </View>
        <View style={styles.signatureLine}>
          <Text style={styles.signatureLabel}>Principal</Text>
        </View>
      </View>
    </View>
  );
}

function StudentCardBack({
  school,
  student,
}: {
  school: SchoolInfo;
  student: StudentIdCardData;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.schoolHeaderText}>
          <Text style={styles.schoolName}>{school.name}</Text>
          <Text style={styles.cardTag}>EMERGENCY &amp; RETURN INFORMATION</Text>
        </View>
      </View>
      <View style={styles.backBody}>
        <View>
          {student.guardianName ? (
            <Text style={styles.backText}>Guardian: {student.guardianName}</Text>
          ) : null}
          {student.guardianPhone ? (
            <Text style={styles.backText}>Emergency Contact: {student.guardianPhone}</Text>
          ) : null}
          {student.dateOfBirth ? (
            <Text style={styles.backText}>Date of Birth: {student.dateOfBirth}</Text>
          ) : null}
          {student.address ? (
            <Text style={styles.backText}>Address: {student.address}</Text>
          ) : null}
        </View>
        <View>
          <Text style={styles.backText}>
            If found, please return to {school.name}
            {school.phone ? ` (${school.phone})` : ""}.
          </Text>
        </View>
      </View>
    </View>
  );
}

export function StudentIdCardPDF({
  school,
  students,
  includeBack = true,
}: StudentIdCardPDFProps) {
  const chunkSize = includeBack ? 4 : 8;
  const pages: StudentIdCardData[][] = [];
  for (let i = 0; i < students.length; i += chunkSize) {
    pages.push(students.slice(i, i + chunkSize));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <Document>
      {pages.map((pageStudents, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          {includeBack ? (
            pageStudents.map((student) => (
              <View key={student.studentId} style={styles.cardPairRow}>
                <StudentCardFront school={school} student={student} />
                <StudentCardBack school={school} student={student} />
              </View>
            ))
          ) : (
            <View style={styles.grid}>
              {pageStudents.map((student) => (
                <View key={student.studentId} style={{ width: "48%", marginBottom: 14 }}>
                  <StudentCardFront school={school} student={student} />
                </View>
              ))}
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}
