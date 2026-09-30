// ─── Watermark Wrapper ────────────────────────────────────────────────────────
// Adds a diagonal watermark to any @react-pdf/renderer document.

import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  watermarkText: {
    fontSize: 48,
    color: "#cccccc",
    opacity: 0.15,
    transform: "rotate(-45deg)",
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: 2,
  },
  secondaryText: {
    fontSize: 16,
    color: "#cccccc",
    opacity: 0.15,
    textAlign: "center",
    marginTop: 8,
  },
});

interface WatermarkProps {
  studentName: string;
  date: string;
}

export function Watermark({ studentName, date }: WatermarkProps) {
  return (
    <View style={styles.watermarkContainer} fixed>
      <Text style={styles.watermarkText}>{studentName}</Text>
      <Text style={styles.secondaryText}>{date}</Text>
    </View>
  );
}
