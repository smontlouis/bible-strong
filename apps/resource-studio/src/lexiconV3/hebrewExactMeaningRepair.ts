import { createHash } from "node:crypto";

import type { EnglishExactFieldRepairEvidence } from "./englishExactRepairs.js";
import { hasMeaningfulTbeshHtml, parseTbeshMeaning } from "./tbeshMeaning.js";

export const HEBREW_EXACT_MEANING_REPAIR_PROJECTION_SCHEMA =
  "lexicon-v3-hebrew-exact-meaning-repair-projection@1" as const;

export type HebrewExactMeaningRepairProjectionMode =
  | "repaired_step_specific"
  | "repaired_full_replacement";

export interface HebrewExactMeaningRepairProjection {
  schemaVersion: typeof HEBREW_EXACT_MEANING_REPAIR_PROJECTION_SCHEMA;
  entryKey: string;
  ruleId: string;
  repairDigest: string;
  method: EnglishExactFieldRepairEvidence["method"];
  mode: HebrewExactMeaningRepairProjectionMode;
  sourceValueDigest: string;
  repairedValueDigest: string;
  sourceStepSpecificDigest: string;
  sourceLegacyGeneralDigest: string;
  repairedStepSpecificDigest: string;
  repairedLegacyGeneralDigest: string | null;
  publishedHtml: string;
  publishedHtmlDigest: string;
  projectionDigest: string;
}

/**
 * Project a sealed exact Hebrew meaning repair into the publishable English
 * field without reclassifying the repaired bytes as raw TBESH source text.
 *
 * The contract is intentionally narrow. A sectioned notice may only be:
 *
 * - corrected inside its exact STEP-specific section while preserving the
 *   legacy/base-Strong context byte-for-byte; or
 * - superseded in full by an exact external witness.
 *
 * Any other shape fails closed and requires a new reviewed policy.
 */
export function buildHebrewExactMeaningRepairProjection(
  repair: EnglishExactFieldRepairEvidence
): HebrewExactMeaningRepairProjection {
  if (repair.field !== "meaning") {
    throw new Error(
      `hebrew-exact-meaning-repair-field-invalid:${repair.entryKey}:${repair.field}`
    );
  }
  if (
    sha256(repair.sourceValue) !== repair.sourceValueDigest ||
    sha256(repair.repairedValue) !== repair.repairedValueDigest
  ) {
    throw new Error(
      `hebrew-exact-meaning-repair-value-digest-invalid:${repair.entryKey}`
    );
  }

  const source = parseTbeshMeaning(repair.sourceValue);
  const repaired = parseTbeshMeaning(repair.repairedValue);
  if (
    !source.hasSectionSeparator ||
    source.sectionSeparatorCount !== 1 ||
    source.classification !== "both"
  ) {
    throw new Error(
      `hebrew-exact-meaning-repair-source-shape-invalid:${repair.entryKey}`
    );
  }

  let mode: HebrewExactMeaningRepairProjectionMode;
  let publishedHtml: string;
  if (
    repair.method === "exact-companion-field-recovery" &&
    repaired.hasSectionSeparator &&
    repaired.sectionSeparatorCount === 1 &&
    repaired.classification === "both" &&
    repaired.legacyGeneralHtml === source.legacyGeneralHtml &&
    repaired.stepSpecificHtml !== source.stepSpecificHtml
  ) {
    mode = "repaired_step_specific";
    publishedHtml = repaired.stepSpecificHtml;
  } else if (
    repair.method === "exact-external-witness-recovery" &&
    !repaired.hasSectionSeparator &&
    repaired.sectionSeparatorCount === 0 &&
    repaired.classification === "specific_only" &&
    hasMeaningfulTbeshHtml(repaired.stepSpecificHtml)
  ) {
    mode = "repaired_full_replacement";
    publishedHtml = repaired.rawHtml;
  } else {
    throw new Error(
      `hebrew-exact-meaning-repair-projection-unsupported:${repair.entryKey}:${repair.method}`
    );
  }

  if (!hasMeaningfulTbeshHtml(publishedHtml)) {
    throw new Error(
      `hebrew-exact-meaning-repair-publication-empty:${repair.entryKey}`
    );
  }
  const withoutDigest = {
    schemaVersion: HEBREW_EXACT_MEANING_REPAIR_PROJECTION_SCHEMA,
    entryKey: repair.entryKey,
    ruleId: repair.ruleId,
    repairDigest: repair.repairDigest,
    method: repair.method,
    mode,
    sourceValueDigest: repair.sourceValueDigest,
    repairedValueDigest: repair.repairedValueDigest,
    sourceStepSpecificDigest: sha256(source.stepSpecificHtml),
    sourceLegacyGeneralDigest: sha256(source.legacyGeneralHtml),
    repairedStepSpecificDigest: sha256(repaired.stepSpecificHtml),
    repairedLegacyGeneralDigest: repaired.hasSectionSeparator
      ? sha256(repaired.legacyGeneralHtml)
      : null,
    publishedHtml,
    publishedHtmlDigest: sha256(publishedHtml)
  };
  return {
    ...withoutDigest,
    projectionDigest: sha256(stableJson(withoutDigest))
  };
}

export function validateHebrewExactMeaningRepairProjection(
  repair: EnglishExactFieldRepairEvidence,
  projection: unknown
): string[] {
  try {
    const expected = buildHebrewExactMeaningRepairProjection(repair);
    return stableJson(expected) === stableJson(projection)
      ? []
      : ["hebrew-exact-meaning-repair-projection-mismatch"];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)].sort();
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
