import { createHash } from "node:crypto";

export const LEXICON_V3_REVIEW_DECISION_SCHEMA =
  "lexicon-v3-review-decision@3" as const;
export const LEXICON_V3_LEGACY_REVIEW_DECISION_SCHEMA =
  "lexicon-v3-review-decision@2" as const;

export type LexiconV3ReviewDecisionSchema =
  | typeof LEXICON_V3_REVIEW_DECISION_SCHEMA
  | typeof LEXICON_V3_LEGACY_REVIEW_DECISION_SCHEMA;

export type LexiconV3ReviewVerdict =
  | "accept"
  | "reject"
  | "needs_review"
  | "source_issue"
  | "replace"
  | "create";

export interface LexiconV3ReplacementField {
  valueText: string;
  valueHtml?: string | null;
  confidence: number;
  evidenceMode: "inherit" | "editorial_replacement";
  sourceNote?: string;
}

export interface LexiconV3ReviewDecision {
  schemaVersion: LexiconV3ReviewDecisionSchema;
  entryKey: string;
  locale: "en" | "fr";
  field: "gloss" | "meaning" | "notes";
  /** Informational only; stable resolution never depends on SQLite row ids. */
  fieldVersionId?: number;
  expectedContentHash: string;
  verdict: LexiconV3ReviewVerdict;
  reviewer: string;
  reason: string;
  replacement?: LexiconV3ReplacementField;
  resolveIssueCodes?: string[];
  decidedAt: string;
}

export interface LexiconV3ReviewDecisionValidation {
  valid: boolean;
  issues: string[];
}

export function validateLexiconV3ReviewDecision(
  decision: LexiconV3ReviewDecision
): LexiconV3ReviewDecisionValidation {
  const issues: string[] = [];
  if (
    ![
      LEXICON_V3_REVIEW_DECISION_SCHEMA,
      LEXICON_V3_LEGACY_REVIEW_DECISION_SCHEMA
    ].includes(decision.schemaVersion)
  ) {
    issues.push("invalid-schema-version");
  }
  if (typeof decision.entryKey !== "string" || !decision.entryKey.trim()) {
    issues.push("missing-entry-key");
  }
  if (!["en", "fr"].includes(decision.locale)) issues.push("invalid-locale");
  if (!["gloss", "meaning", "notes"].includes(decision.field)) {
    issues.push("invalid-field");
  }
  if (
    decision.fieldVersionId !== undefined &&
    (!Number.isInteger(decision.fieldVersionId) || decision.fieldVersionId <= 0)
  ) {
    issues.push("invalid-field-version-id");
  }
  if (!/^[a-f0-9]{64}$/u.test(decision.expectedContentHash)) {
    issues.push("invalid-expected-content-hash");
  }
  if (!decision.reviewer.trim()) issues.push("missing-reviewer");
  if (!decision.reason.trim()) issues.push("missing-reason");
  if (
    decision.verdict === "create" &&
    decision.schemaVersion !== LEXICON_V3_REVIEW_DECISION_SCHEMA
  ) {
    issues.push("create-requires-schema-v3");
  }
  if (decision.verdict === "create") {
    if (decision.locale !== "en") issues.push("create-requires-english-locale");
    if (!["gloss", "meaning"].includes(decision.field)) {
      issues.push("invalid-create-field");
    }
    if (decision.fieldVersionId !== undefined) {
      issues.push("unexpected-create-field-version-id");
    }
  }
  if (["replace", "create"].includes(decision.verdict)) {
    if (!decision.replacement?.valueText.trim()) {
      issues.push("missing-replacement-text");
    }
    const confidence = decision.replacement?.confidence;
    if (
      confidence === undefined ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      issues.push("invalid-replacement-confidence");
    }
    if (
      !["inherit", "editorial_replacement"].includes(
        decision.replacement?.evidenceMode ?? ""
      )
    ) {
      issues.push("invalid-evidence-mode");
    }
    if (
      decision.replacement?.evidenceMode === "editorial_replacement" &&
      !decision.replacement.sourceNote?.trim()
    ) {
      issues.push("missing-editorial-source-note");
    }
    if (
      decision.verdict === "create" &&
      decision.replacement?.evidenceMode !== "editorial_replacement"
    ) {
      issues.push("create-requires-editorial-evidence");
    }
  } else if (decision.replacement !== undefined) {
    issues.push("unexpected-replacement");
  }
  if (decision.resolveIssueCodes?.some((code) => !code.trim())) {
    issues.push("invalid-resolved-issue-code");
  }
  if (!Number.isFinite(Date.parse(decision.decidedAt))) {
    issues.push("invalid-decision-date");
  }
  if (
    ![
      "accept",
      "reject",
      "needs_review",
      "source_issue",
      "replace",
      "create"
    ].includes(decision.verdict)
  ) {
    issues.push("invalid-verdict");
  }
  return { valid: issues.length === 0, issues };
}

export function lexiconV3ReviewTargetHash(value: {
  entryKey: string;
  locale: "en" | "fr";
  field: "gloss" | "meaning" | "notes";
  valueText: string;
  valueHtml?: string | null;
  derivedFromContentHash?: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        entryKey: value.entryKey,
        locale: value.locale,
        field: value.field,
        valueText: value.valueText,
        valueHtml: value.valueHtml ?? null,
        derivedFromContentHash: value.derivedFromContentHash ?? null
      })
    )
    .digest("hex");
}

export function lexiconV3MissingFieldReviewTargetHash(value: {
  entryKey: string;
  locale: "en";
  field: "gloss" | "meaning";
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: "lexicon-v3-missing-field-target@1",
        entryKey: value.entryKey,
        locale: value.locale,
        field: value.field,
        state: "missing"
      })
    )
    .digest("hex");
}

export function lexiconV3FieldContentHash(value: {
  entryKey: string;
  locale: "en" | "fr";
  field: "gloss" | "meaning" | "notes";
  valueText: string;
  valueHtml?: string | null;
  derivedFromVersionId?: number | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        entryKey: value.entryKey,
        locale: value.locale,
        field: value.field,
        valueText: value.valueText,
        valueHtml: value.valueHtml ?? null,
        derivedFromVersionId: value.derivedFromVersionId ?? null
      })
    )
    .digest("hex");
}

export function lexiconV3ReviewArtifactHash(
  decision: LexiconV3ReviewDecision
): string {
  return createHash("sha256")
    .update(canonicalJson(canonicalReviewDecision(decision)))
    .digest("hex");
}

export function lexiconV3ReviewDecisionSetFingerprint(
  decisions: readonly LexiconV3ReviewDecision[],
  locale?: "en" | "fr"
): string {
  const artifactHashes = decisions
    .filter((decision) => !locale || decision.locale === locale)
    .map(lexiconV3ReviewArtifactHash)
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: LEXICON_V3_REVIEW_DECISION_SCHEMA,
        locale: locale ?? "all",
        artifactHashes
      })
    )
    .digest("hex");
}

function canonicalReviewDecision(
  decision: LexiconV3ReviewDecision
): Record<string, unknown> {
  return {
    schemaVersion: decision.schemaVersion,
    entryKey: decision.entryKey,
    locale: decision.locale,
    field: decision.field,
    expectedContentHash: decision.expectedContentHash,
    verdict: decision.verdict,
    reviewer: decision.reviewer,
    reason: decision.reason,
    replacement: decision.replacement
      ? {
          ...decision.replacement,
          valueHtml: decision.replacement.valueHtml ?? null,
          sourceNote: decision.replacement.sourceNote ?? null
        }
      : null,
    resolveIssueCodes: [...new Set(decision.resolveIssueCodes ?? [])]
      .map((code) => code.trim())
      .sort(),
    decidedAt: decision.decidedAt
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
