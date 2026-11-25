/**
 * SchoolDocumentFooter — Fixed PDF footer with page numbers and generation timestamp.
 * Uses @react-pdf/renderer's render-prop Text for dynamic page numbers.
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

export interface SchoolDocumentFooterProps {
  pageLabel?: string;
}

const styles = StyleSheet.create({
  footerContainer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    borderTopStyle: "solid",
    paddingTop: 4,
  },
  footerLeft: {
    fontSize: 8,
    color: "#888888",
  },
  footerRight: {
    fontSize: 8,
    color: "#888888",
  },
  footerCenter: {
    fontSize: 8,
    color: "#888888",
    textAlign: "center",
  },
});

export function SchoolDocumentFooter({ pageLabel }: SchoolDocumentFooterProps) {
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={styles.footerContainer} fixed>
      <Text style={styles.footerLeft}>SchoolMitra ERP</Text>
      <Text style={styles.footerCenter}>
        {pageLabel ? `${pageLabel}  —  ` : ""}
        <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        } />
      </Text>
      <Text style={styles.footerRight}>Generated: {generatedOn}</Text>
    </View>
  );
}
