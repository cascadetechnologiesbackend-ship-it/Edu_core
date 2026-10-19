import { DatabaseDomain } from "../catalog/types";
import {
  BUS_ROUTE_REGEX,
  CLASS_SECTION_REGEXES,
  DATE_TEMPORAL_REGEXES,
  EXAM_DICTIONARY,
  FEE_HEAD_DICTIONARY,
  INTENT_DICTIONARY,
  SUBJECT_DICTIONARY,
  TokenDictionaryEntry,
} from "./patterns";
import {
  EntityType,
  IntentType,
  ParsedQuery,
  QueryIntent,
  RecognizedEntity,
} from "./types";

function getNow(): number {
  if (typeof globalThis !== "undefined" && globalThis.performance) {
    return globalThis.performance.now();
  }
  return Date.now();
}

/**
 * High-performance, deterministic Omnibox Query Parser.
 * Runs in <5ms without external model dependencies.
 */
export function parseOmniboxQuery(rawQuery: string): ParsedQuery {
  const startTime = getNow();
  const trimmed = (rawQuery || "").trim();
  const normalized = trimmed.toLowerCase();

  if (!trimmed) {
    return {
      rawQuery: "",
      normalizedQuery: "",
      recognizedEntities: [],
      confidenceScore: 0,
      parseDurationMs: 0,
    };
  }

  const recognizedEntities: RecognizedEntity[] = [];

  // Track matched character spans to prevent duplicate/overlapping token extraction
  const matchedRanges: Array<{ start: number; end: number }> = [];

  const isOverlapping = (start: number, end: number) => {
    return matchedRanges.some(
      (range) => Math.max(start, range.start) < Math.min(end, range.end)
    );
  };

  const registerEntity = (
    type: EntityType,
    rawMatch: string,
    canonical: string,
    start: number,
    end: number,
    confidence: number,
    metadata?: Record<string, any> | undefined
  ) => {
    if (isOverlapping(start, end)) return;
    matchedRanges.push({ start, end });
    recognizedEntities.push({
      type,
      raw: rawMatch,
      normalized: canonical,
      startIndex: start,
      endIndex: end,
      confidence,
      metadata,
    });
  };

  // 1. Match Class & Section
  for (const regex of CLASS_SECTION_REGEXES) {
    const match = regex.exec(trimmed);
    if (match && match[1]) {
      const start = match.index;
      const end = start + match[0].length;
      if (!isOverlapping(start, end)) {
        const classNum = match[1].toUpperCase();
        const section = match[2] ? match[2].toUpperCase() : undefined;
        const canonical = section ? `Class ${classNum}-${section}` : `Class ${classNum}`;

        registerEntity(
          "CLASS_SECTION",
          match[0],
          canonical,
          start,
          end,
          0.95,
          { class: classNum, section }
        );
        break;
      }
    }
  }

  // 2. Match Exam Assessment
  for (const entry of EXAM_DICTIONARY) {
    const sortedAliases = [...entry.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      const match = regex.exec(trimmed);
      if (match && !isOverlapping(match.index, match.index + match[0].length)) {
        registerEntity(
          "EXAM_NAME",
          match[0],
          entry.canonical,
          match.index,
          match.index + match[0].length,
          0.90,
          { examCategory: entry.category }
        );
        break;
      }
    }
  }

  // 3. Match Subject
  for (const entry of SUBJECT_DICTIONARY) {
    const sortedAliases = [...entry.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      const match = regex.exec(trimmed);
      if (match && !isOverlapping(match.index, match.index + match[0].length)) {
        registerEntity(
          "SUBJECT",
          match[0],
          entry.canonical,
          match.index,
          match.index + match[0].length,
          0.90
        );
        break;
      }
    }
  }

  // 4. Match Fee Head
  for (const entry of FEE_HEAD_DICTIONARY) {
    const sortedAliases = [...entry.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      const match = regex.exec(trimmed);
      if (match && !isOverlapping(match.index, match.index + match[0].length)) {
        registerEntity(
          "FEE_HEAD",
          match[0],
          entry.canonical,
          match.index,
          match.index + match[0].length,
          0.90
        );
        break;
      }
    }
  }

  // 5. Match Bus / Transport Route
  const busMatch = BUS_ROUTE_REGEX.exec(trimmed);
  if (busMatch && busMatch[1] && !isOverlapping(busMatch.index, busMatch.index + busMatch[0].length)) {
    const routeIdentifier = busMatch[1].toUpperCase();
    registerEntity(
      "BUS_ROUTE",
      busMatch[0],
      `Route ${routeIdentifier}`,
      busMatch.index,
      busMatch.index + busMatch[0].length,
      0.90,
      { routeNumber: routeIdentifier }
    );
  }

  // 6. Match Temporal / Date
  for (const regex of DATE_TEMPORAL_REGEXES) {
    const dateMatch = regex.exec(trimmed);
    if (dateMatch && !isOverlapping(dateMatch.index, dateMatch.index + dateMatch[0].length)) {
      registerEntity(
        "DATE_TEMPORAL",
        dateMatch[0],
        dateMatch[0].toLowerCase(),
        dateMatch.index,
        dateMatch.index + dateMatch[0].length,
        0.85
      );
      break;
    }
  }

  // 7. Match Actions / Intents
  let matchedIntentEntry: TokenDictionaryEntry | undefined;
  for (const entry of INTENT_DICTIONARY) {
    // Sort aliases by length descending to match longest phrases first
    const sortedAliases = [...entry.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sortedAliases) {
      const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      const match = regex.exec(trimmed);
      if (match && !isOverlapping(match.index, match.index + match[0].length)) {
        matchedIntentEntry = entry;
        registerEntity(
          "ACTION_INTENT",
          match[0],
          entry.canonical,
          match.index,
          match.index + match[0].length,
          0.95,
          entry.metadata
        );
        break;
      }
    }
    if (matchedIntentEntry) break;
  }

  // 8. Resolve Primary Intent & Deep-Link Route
  const { intent, route, actionLabel, confidence } = resolveIntentAndRoute(
    trimmed,
    recognizedEntities,
    matchedIntentEntry
  );

  const endTime = getNow();
  const parseDurationMs = Math.round((endTime - startTime) * 100) / 100;

  return {
    rawQuery: trimmed,
    normalizedQuery: normalized,
    recognizedEntities,
    primaryIntent: intent,
    targetRoute: route,
    actionLabel,
    confidenceScore: confidence,
    parseDurationMs,
  };
}

function resolveIntentAndRoute(
  rawQuery: string,
  entities: RecognizedEntity[],
  matchedIntentEntry?: TokenDictionaryEntry
): {
  intent?: QueryIntent | undefined;
  route?: string | undefined;
  actionLabel?: string | undefined;
  confidence: number;
} {
  const classEntity = entities.find((e) => e.type === "CLASS_SECTION");
  const subjectEntity = entities.find((e) => e.type === "SUBJECT");
  const examEntity = entities.find((e) => e.type === "EXAM_NAME");
  const feeEntity = entities.find((e) => e.type === "FEE_HEAD");
  const busEntity = entities.find((e) => e.type === "BUS_ROUTE");

  // Query parameter builder
  const params = new URLSearchParams();
  if (classEntity?.metadata?.["class"]) {
    params.set("grade", classEntity.metadata["class"]);
    if (classEntity.metadata["section"]) {
      params.set("section", classEntity.metadata["section"]);
    }
  }
  if (subjectEntity) {
    params.set("subject", subjectEntity.normalized);
  }
  if (examEntity) {
    params.set("exam", examEntity.normalized);
  }
  if (feeEntity) {
    params.set("feeHead", feeEntity.normalized);
  }
  if (busEntity?.metadata?.["routeNumber"]) {
    params.set("route", busEntity.metadata["routeNumber"]);
  }

  const queryString = params.toString() ? `?${params.toString()}` : "";

  // Scenario A: Explicit Action Matched
  if (matchedIntentEntry) {
    const meta = matchedIntentEntry.metadata || {};
    const intentType = meta["action"] as IntentType;
    const baseRoute = meta["route"] as string;
    const label = meta["label"] as string;
    const domain = matchedIntentEntry.category as DatabaseDomain;

    return {
      intent: {
        type: intentType,
        targetDomain: domain,
        confidence: 0.95,
        description: `Execute action: ${label}`,
      },
      route: `${baseRoute}${queryString}`,
      actionLabel: label,
      confidence: 0.95,
    };
  }

  // Scenario B: Implicit Intent from recognized entities
  if (busEntity) {
    return {
      intent: {
        type: "TRACK_BUS",
        targetDomain: "TRANSPORT",
        confidence: 0.88,
        description: `Track ${busEntity.normalized}`,
      },
      route: `/admin/transport/live${queryString}`,
      actionLabel: `Track ${busEntity.normalized}`,
      confidence: 0.88,
    };
  }

  if (feeEntity) {
    return {
      intent: {
        type: "VIEW_FEE_DUES",
        targetDomain: "FEES_FINANCE",
        confidence: 0.85,
        description: `View fee dues for ${feeEntity.normalized}`,
      },
      route: `/admin/fees/dues${queryString}`,
      actionLabel: `Inspect ${feeEntity.normalized} Dues`,
      confidence: 0.85,
    };
  }

  if (examEntity && classEntity) {
    return {
      intent: {
        type: "VIEW_MARKS",
        targetDomain: "EXAMINATIONS",
        confidence: 0.88,
        description: `View ${examEntity.normalized} marks for ${classEntity.normalized}`,
      },
      route: `/admin/exams/marks${queryString}`,
      actionLabel: `View ${examEntity.normalized} Marks for ${classEntity.normalized}`,
      confidence: 0.88,
    };
  }

  if (examEntity) {
    return {
      intent: {
        type: "VIEW_MARKS",
        targetDomain: "EXAMINATIONS",
        confidence: 0.82,
        description: `View examination details for ${examEntity.normalized}`,
      },
      route: `/admin/exams/results${queryString}`,
      actionLabel: `View ${examEntity.normalized} Results`,
      confidence: 0.82,
    };
  }

  if (classEntity) {
    return {
      intent: {
        type: "VIEW_STUDENT_PROFILE",
        targetDomain: "STUDENTS_LIFECYCLE",
        confidence: 0.80,
        description: `View students enrolled in ${classEntity.normalized}`,
      },
      route: `/admin/students${queryString}`,
      actionLabel: `Open ${classEntity.normalized} Roster`,
      confidence: 0.80,
    };
  }

  // General fallback search
  return {
    intent: {
      type: "SEARCH_GENERAL",
      targetDomain: "CORE_IDENTITY",
      confidence: 0.50,
      description: `Search across records for "${rawQuery}"`,
    },
    route: `/admin/search?q=${encodeURIComponent(rawQuery)}`,
    actionLabel: `Search for "${rawQuery}"`,
    confidence: 0.50,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
