import { DatabaseDomain } from "../catalog/types";

export type EntityType =
  | "CLASS_SECTION"
  | "SUBJECT"
  | "STUDENT_NAME"
  | "STAFF_NAME"
  | "EXAM_NAME"
  | "FEE_HEAD"
  | "BUS_ROUTE"
  | "DATE_TEMPORAL"
  | "ACTION_INTENT";

export interface RecognizedEntity {
  type: EntityType;
  raw: string;
  normalized: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata?: Record<string, any> | undefined;
}

export type IntentType =
  | "VIEW_MARKS"
  | "ENTER_MARKS"
  | "VIEW_ATTENDANCE"
  | "TAKE_ATTENDANCE"
  | "VIEW_FEE_DUES"
  | "COLLECT_FEE"
  | "TRACK_BUS"
  | "VIEW_REPORT_CARD"
  | "GENERATE_REPORT_CARD"
  | "VIEW_STUDENT_PROFILE"
  | "VIEW_STAFF_PROFILE"
  | "VIEW_TIMETABLE"
  | "MANAGE_EXAM_SCHEDULE"
  | "CREATE_NOTICE"
  | "NAVIGATE_DOMAIN"
  | "SEARCH_GENERAL";

export interface QueryIntent {
  type: IntentType;
  targetDomain: DatabaseDomain;
  targetTable?: string | undefined;
  confidence: number;
  description: string;
}

export interface ParsedQuery {
  rawQuery: string;
  normalizedQuery: string;
  recognizedEntities: RecognizedEntity[];
  primaryIntent?: QueryIntent | undefined;
  targetRoute?: string | undefined;
  actionLabel?: string | undefined;
  confidenceScore: number;
  parseDurationMs: number;
}
