/**
 * SchoolDocumentHeader — Shared PDF document header component.
 *
 * Renders school branding (logo if available, name, address, contact) followed
 * by report title/subtitle. Never hardcodes school identity — all data is passed
 * via props.
 *
 * Uses @react-pdf/renderer primitives only.
 */

import React from "react";
import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";

export interface SchoolInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  boardAffiliation?: string | null;
  logoS3Key?: string | null;
  /** Pre-resolved logo URL/data-URI — supply this when logoS3Key has been resolved */
  logoUrl?: string | null;
}

export interface SchoolDocumentHeaderProps {
  school: SchoolInfo;
  reportTitle: string;
  subtitle?: string | undefined;
  academicYear?: string | undefined;
  scope?: string | undefined;
  generatedAt?: string | undefined;
}

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#003E80",
    borderBottomStyle: "solid",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  logoBox: {
    width: 60,
    height: 60,
    marginRight: 12,
    flexShrink: 0,
  },
  logo: {
    width: "auto",
    height: 60,
    objectFit: "contain",
  },
  schoolTextBlock: {
    flex: 1,
    flexDirection: "column",
  },
  schoolName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#003E80",
    marginBottom: 2,
  },
  schoolMeta: {
    fontSize: 9,
    color: "#555555",
    lineHeight: 1.4,
  },
  titleBlock: {
    marginTop: 6,
    alignItems: "center",
  },
  reportTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a2e",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 10,
    color: "#444444",
    textAlign: "center",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 3,
    gap: 16,
  },
  metaText: {
    fontSize: 9,
    color: "#666666",
  },
});

export function SchoolDocumentHeader({
  school,
  reportTitle,
  subtitle,
  academicYear,
  scope,
  generatedAt,
}: SchoolDocumentHeaderProps) {
  const hasLogo = Boolean(school.logoUrl);

  const metaParts: string[] = [];
  if (school.address) metaParts.push(school.address);
  if (school.phone) metaParts.push(`Ph: ${school.phone}`);
  if (school.email) metaParts.push(school.email);
  if (school.boardAffiliation) metaParts.push(`Affiliation: ${school.boardAffiliation}`);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        {hasLogo && school.logoUrl && (
          <View style={styles.logoBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={school.logoUrl} style={styles.logo} />
          </View>
        )}
        <View style={styles.schoolTextBlock}>
          <Text style={styles.schoolName}>{school.name}</Text>
          {metaParts.length > 0 && (
            <Text style={styles.schoolMeta}>{metaParts.join("  |  ")}</Text>
          )}
          {school.website && (
            <Text style={styles.schoolMeta}>{school.website}</Text>
          )}
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.reportTitle}>{reportTitle}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        <View style={styles.metaRow}>
          {academicYear && (
            <Text style={styles.metaText}>Academic Year: {academicYear}</Text>
          )}
          {scope && <Text style={styles.metaText}>{scope}</Text>}
          {generatedAt && (
            <Text style={styles.metaText}>Generated: {generatedAt}</Text>
          )}
        </View>
      </View>
    </View>
  );
}
