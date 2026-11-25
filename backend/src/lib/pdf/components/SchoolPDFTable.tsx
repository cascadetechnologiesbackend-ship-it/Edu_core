/**
 * SchoolPDFTable — Reusable PDF table component for @react-pdf/renderer.
 *
 * Features:
 * - Typed column definitions with width and text alignment
 * - Bold header row with #003E80 background, white text
 * - Optional alternating row stripes (#F7F7F7 / #FFFFFF)
 * - Text wrapping in cells
 * - Right-alignment for numeric/currency/date columns
 */

import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

export interface PDFTableColumn {
  key: string;
  label: string;
  /** Width as a number (pt) or string ('20%'). All columns should sum to 100% or fit page width. */
  width: number | string;
  align?: "left" | "right" | "center";
}

export interface SchoolPDFTableProps {
  columns: PDFTableColumn[];
  rows: Record<string, unknown>[];
  striped?: boolean;
}

const HEADER_BG = "#003E80";
const STRIPE_ODD = "#F7F7F7";
const STRIPE_EVEN = "#FFFFFF";
const BORDER_COLOR = "#DDDDDD";

const styles = StyleSheet.create({
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderStyle: "solid",
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
  },
  headerCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#1a5a9a",
    borderRightStyle: "solid",
  },
  dataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    borderBottomStyle: "solid",
  },
  dataCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 8,
    color: "#222222",
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
    borderRightStyle: "solid",
  },
});

function cellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

export function SchoolPDFTable({ columns, rows, striped = true }: SchoolPDFTableProps) {
  return (
    <View style={styles.table}>
      {/* Header row */}
      <View style={styles.headerRow}>
        {columns.map((col) => (
          <View
            key={col.key}
            style={[
              styles.headerCell,
              { width: col.width, textAlign: col.align ?? "left" },
            ]}
          >
            <Text>{col.label}</Text>
          </View>
        ))}
      </View>

      {/* Data rows */}
      {rows.map((row, rowIdx) => {
        const bg = striped
          ? rowIdx % 2 === 0
            ? STRIPE_EVEN
            : STRIPE_ODD
          : STRIPE_EVEN;

        return (
          <View
            key={rowIdx}
            style={[styles.dataRow, { backgroundColor: bg }]}
          >
            {columns.map((col) => (
              <View
                key={col.key}
                style={[
                  styles.dataCell,
                  {
                    width: col.width,
                    textAlign: col.align ?? "left",
                  },
                ]}
              >
                <Text>{cellValue(row[col.key])}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
