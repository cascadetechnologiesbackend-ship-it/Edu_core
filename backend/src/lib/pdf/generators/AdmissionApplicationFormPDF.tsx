import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import "../fonts/registerFonts";

export interface AdmissionApplicationFormData {
  applicationNumber?: string | null;
  academicYear?: string | null;
  appliedClass?: string | null;
  studentName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  nationality?: string | null;
  previousSchool?: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  fatherOccupation?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
  motherOccupation?: string | null;
  guardianEmail?: string | null;
  address?: string | null;
  submittedDocuments?: string[];
}

export interface AdmissionApplicationFormPDFProps {
  school: SchoolInfo;
  application?: AdmissionApplicationFormData | null;
}

const DEFAULT_DOCUMENT_CHECKLIST = [
  "Birth Certificate (Copy)",
  "Transfer Certificate (Original, if applicable)",
  "Previous Class Marksheet / Progress Report",
  "Student Aadhaar / Identity Proof (Copy)",
  "Passport-size Photographs (2 Nos.)",
  "Parent / Guardian ID Proof (Copy)",
];

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 45,
    paddingHorizontal: 32,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1E293B",
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
    paddingRight: 12,
  },
  photoBox: {
    width: 78,
    height: 92,
    borderWidth: 1,
    borderColor: "#94A3B8",
    borderStyle: "solid",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  photoLabel: {
    fontSize: 7.5,
    color: "#64748B",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#003E80",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: "#003E80",
    borderLeftStyle: "solid",
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
    borderBottomStyle: "solid",
    paddingBottom: 3,
  },
  fieldLabel: {
    width: "34%",
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    fontSize: 8.5,
  },
  fieldValue: {
    width: "66%",
    color: "#0F172A",
    fontSize: 8.5,
  },
  checklistGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  checklistItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  checkbox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: "#475569",
    borderStyle: "solid",
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxTick: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  declarationBox: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "solid",
    backgroundColor: "#F8FAFC",
  },
  declarationText: {
    fontSize: 8,
    lineHeight: 1.4,
    color: "#334155",
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 26,
  },
  signatureBlock: {
    width: "30%",
    borderTopWidth: 1,
    borderTopColor: "#64748B",
    borderTopStyle: "solid",
    paddingTop: 4,
    alignItems: "center",
  },
  signatureText: {
    fontSize: 8,
    color: "#475569",
  },
});

function Field({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value && value.trim() ? value : "______________________________"}</Text>
    </View>
  );
}

export function AdmissionApplicationFormPDF({
  school,
  application,
}: AdmissionApplicationFormPDFProps) {
  const data = application ?? {};
  const submittedSet = new Set((data.submittedDocuments ?? []).map((d) => d.toLowerCase()));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="ADMISSION APPLICATION FORM"
          academicYear={data.academicYear ?? undefined}
        />

        <View style={styles.topMetaRow}>
          <View style={styles.metaCol}>
            <Field label="Application No." value={data.applicationNumber} />
            <Field label="Academic Year" value={data.academicYear} />
            <Field label="Class Applied For" value={data.appliedClass} />
          </View>
          <View style={styles.photoBox}>
            <Text style={styles.photoLabel}>Paste Student{"\n"}Passport Photo</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Student Details</Text>
        <Field label="Full Name of Student" value={data.studentName} />
        <Field label="Date of Birth" value={data.dateOfBirth} />
        <Field label="Gender" value={data.gender} />
        <Field label="Blood Group" value={data.bloodGroup} />
        <Field label="Nationality" value={data.nationality} />
        <Field label="Previous School" value={data.previousSchool} />

        <Text style={styles.sectionTitle}>2. Parent / Guardian Details</Text>
        <Field label="Father's Name" value={data.fatherName} />
        <Field label="Father's Phone" value={data.fatherPhone} />
        <Field label="Father's Occupation" value={data.fatherOccupation} />
        <Field label="Mother's Name" value={data.motherName} />
        <Field label="Mother's Phone" value={data.motherPhone} />
        <Field label="Mother's Occupation" value={data.motherOccupation} />
        <Field label="Email Address" value={data.guardianEmail} />
        <Field label="Residential Address" value={data.address} />

        <Text style={styles.sectionTitle}>3. Document Checklist (Office Use)</Text>
        <View style={styles.checklistGrid}>
          {DEFAULT_DOCUMENT_CHECKLIST.map((doc) => {
            const checked = submittedSet.has(doc.toLowerCase());
            return (
              <View key={doc} style={styles.checklistItem}>
                <View style={styles.checkbox}>
                  {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 8 }}>{doc}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.declarationBox}>
          <Text style={styles.declarationText}>
            Declaration: I hereby declare that the information furnished above is true and
            correct to the best of my knowledge. I agree to abide by the rules and regulations
            of {school.name}.
          </Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureText}>Parent / Guardian Signature</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureText}>Admission Officer</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureText}>Principal Signature</Text>
          </View>
        </View>

        <SchoolDocumentFooter pageLabel="Admission Application Form" />
      </Page>
    </Document>
  );
}
