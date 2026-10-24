export interface GradeLevelOption {
  value: string;
  label: string;
  sortOrder: number;
}

export const ALL_GRADE_LEVELS: readonly GradeLevelOption[] = [
  { value: "NURSERY", label: "Nursery", sortOrder: 1 },
  { value: "LKG", label: "LKG", sortOrder: 2 },
  { value: "UKG", label: "UKG", sortOrder: 3 },
  { value: "CLASS_1", label: "Class 1", sortOrder: 4 },
  { value: "CLASS_2", label: "Class 2", sortOrder: 5 },
  { value: "CLASS_3", label: "Class 3", sortOrder: 6 },
  { value: "CLASS_4", label: "Class 4", sortOrder: 7 },
  { value: "CLASS_5", label: "Class 5", sortOrder: 8 },
  { value: "CLASS_6", label: "Class 6", sortOrder: 9 },
  { value: "CLASS_7", label: "Class 7", sortOrder: 10 },
  { value: "CLASS_8", label: "Class 8", sortOrder: 11 },
  { value: "CLASS_9", label: "Class 9", sortOrder: 12 },
  { value: "CLASS_10", label: "Class 10", sortOrder: 13 },
  { value: "CLASS_11", label: "Class 11", sortOrder: 14 },
  { value: "CLASS_12", label: "Class 12", sortOrder: 15 },
] as const;

export const GRADE_LEVEL_VALUES = ALL_GRADE_LEVELS.map((g) => g.value);
