import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { SchoolInfo } from "../components/SchoolDocumentHeader";
import "../fonts/registerFonts";

export interface StaffIdCardData {
  staffId: string;
  name: string;
  employeeId: string;
  designation: string;
  department?: string | null;
  bloodGroup?: string | null;
  phone?: string | null;
  validUntil?: string | null;
  photoUrl?: string | null;
}

export interface StaffIdCardPDFProps {
  school: SchoolInfo;
  staff: StaffIdCardData[];
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
    backgroundColor: "#1E293B",
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
    color: "#CBD5E1",
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
  staffName: {
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
    width: 48,
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
  validText: {
    fontSize: 6,
    color: "#475569",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#94A3B8",
    borderTopStyle: "solid",
    paddingTop: 2,
    width: 75,
    alignItems: "center",
  },
  signatureLabel: {
    fontSize: 6,
    color: "#475569",
  },
  backBody: {
    flex: 1,
    padding: 8,
    justifyContent: "space-between",
  },
  backText: {
    fontSize: 6.8,
    color: "#334155",
    lineHeight: 1.35,
  },
});

function StaffCardFront({
  school,
  member,
}: {
  school: SchoolInfo;
  member: StaffIdCardData;
}) {
  const logoSrc = school.logoUrl || school.logoS3Key || null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
        <View style={styles.schoolHeaderText}>
          <Text style={styles.schoolName}>{school.name}</Text>
          <Text style={styles.cardTag}>STAFF IDENTITY CARD</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.photoBox}>
          {member.photoUrl ? (
            <Image style={styles.photo} src={member.photoUrl} />
          ) : (
            <Text style={styles.photoPlaceholderText}>PHOTO</Text>
          )}
        </View>

        <View style={styles.detailsCol}>
          <Text style={styles.staffName}>{member.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Emp. ID:</Text>
            <Text style={styles.metaValue}>{member.employeeId}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Role:</Text>
            <Text style={styles.metaValue}>{member.designation}</Text>
          </View>
          {member.department ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Dept:</Text>
              <Text style={styles.metaValue}>{member.department}</Text>
            </View>
          ) : null}
          {member.bloodGroup ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Blood Grp:</Text>
              <Text style={styles.metaValue}>{member.bloodGroup}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.validText}>
          {member.validUntil ? `Valid Until: ${member.validUntil}` : "Authorized Staff"}
        </Text>
        <View style={styles.signatureLine}>
          <Text style={styles.signatureLabel}>Issuing Authority</Text>
        </View>
      </View>
    </View>
  );
}

function StaffCardBack({
  school,
  member,
}: {
  school: SchoolInfo;
  member: StaffIdCardData;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.schoolHeaderText}>
          <Text style={styles.schoolName}>{school.name}</Text>
          <Text style={styles.cardTag}>STAFF INSTRUCTIONS &amp; RETURN</Text>
        </View>
      </View>
      <View style={styles.backBody}>
        <View>
          <Text style={styles.backText}>Employee ID: {member.employeeId}</Text>
          {member.phone ? <Text style={styles.backText}>Contact: {member.phone}</Text> : null}
          <Text style={styles.backText}>
            This card is the property of {school.name} and must be surrendered upon separation.
          </Text>
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

export function StaffIdCardPDF({
  school,
  staff,
  includeBack = true,
}: StaffIdCardPDFProps) {
  const chunkSize = includeBack ? 4 : 8;
  const pages: StaffIdCardData[][] = [];
  for (let i = 0; i < staff.length; i += chunkSize) {
    pages.push(staff.slice(i, i + chunkSize));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  return (
    <Document>
      {pages.map((pageStaff, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          {includeBack ? (
            pageStaff.map((member) => (
              <View key={member.staffId} style={styles.cardPairRow}>
                <StaffCardFront school={school} member={member} />
                <StaffCardBack school={school} member={member} />
              </View>
            ))
          ) : (
            <View style={styles.grid}>
              {pageStaff.map((member) => (
                <View key={member.staffId} style={{ width: "48%", marginBottom: 14 }}>
                  <StaffCardFront school={school} member={member} />
                </View>
              ))}
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}
