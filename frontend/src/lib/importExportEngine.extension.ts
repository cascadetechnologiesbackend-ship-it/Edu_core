/**
 * ImportExportEngine Extension
 *
 * All dataset schemas, export definitions, import definitions, access policies,
 * and spreadsheet formula-injection sanitization now live canonically in
 * `./importExportEngine.ts` so external callers importing `@/lib/importExportEngine`
 * receive the complete unified set.
 *
 * This file preserves backwards-compatible extension exports without duplicate symbol conflicts.
 */

export * from "./importExportEngine";

import {
  DATASET_SCHEMAS,
  type ImportDatasetKey,
  type DatasetSchema,
} from "./importExportEngine";

export type ExtendedImportDatasetKey = ImportDatasetKey;

export const EXTENDED_DATASET_SCHEMAS: Record<ImportDatasetKey, DatasetSchema> = DATASET_SCHEMAS;
