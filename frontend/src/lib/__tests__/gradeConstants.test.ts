import { describe, it, expect } from "vitest";
import { ALL_GRADE_LEVELS, GRADE_LEVEL_VALUES } from "../gradeConstants";

describe("Grade Constants (S14-F04)", () => {
  it("defines the complete canonical K-12 grade level hierarchy (Nursery to Class 12)", () => {
    expect(ALL_GRADE_LEVELS).toHaveLength(15);
    
    const values = ALL_GRADE_LEVELS.map((g) => g.value);
    expect(values).toEqual([
      "NURSERY",
      "LKG",
      "UKG",
      "CLASS_1",
      "CLASS_2",
      "CLASS_3",
      "CLASS_4",
      "CLASS_5",
      "CLASS_6",
      "CLASS_7",
      "CLASS_8",
      "CLASS_9",
      "CLASS_10",
      "CLASS_11",
      "CLASS_12",
    ]);
  });

  it("ensures sortOrder is strictly sequential and unique from 1 to 15", () => {
    const sortOrders = ALL_GRADE_LEVELS.map((g) => g.sortOrder);
    expect(sortOrders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("ensures all labels are human-readable and unique", () => {
    const labels = ALL_GRADE_LEVELS.map((g) => g.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(15);
    expect(labels[0]).toBe("Nursery");
    expect(labels[14]).toBe("Class 12");
  });

  it("GRADE_LEVEL_VALUES contains exact values matching ALL_GRADE_LEVELS", () => {
    expect(GRADE_LEVEL_VALUES).toEqual(ALL_GRADE_LEVELS.map((g) => g.value));
  });
});
