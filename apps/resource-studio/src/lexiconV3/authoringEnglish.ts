import { createHash } from "node:crypto";
import { type DatabaseSync } from "node:sqlite";

import { type LexiconV3FrenchPacket } from "./frenchPackets.js";
import { lexiconV3FieldContentHash } from "./review.js";

export const LEXICON_V3_AUTHORING_ENGLISH_SCHEMA =
  "lexicon-v3-authoring-english@1" as const;

export type LexiconV3AuthoringEnglishBundle = LexiconV3FrenchPacket["english"];
type EnglishBundle = LexiconV3AuthoringEnglishBundle;
type EnglishFieldName = "gloss" | "meaning";

interface EntryRow {
  entryKey: string;
}

interface FieldRow {
  id: number;
  entryKey: string;
  field: EnglishFieldName;
  valueText: string;
  valueHtml: string | null;
  state:
    | "candidate"
    | "auto_validated"
    | "human_validated"
    | "blocked_source_issue"
    | "rejected";
  contentHash: string;
}

interface IssueRow {
  entryKey: string;
  fieldVersionId: number | null;
  code: string;
  severity: "warning" | "blocker";
}

interface SupportingSourceRow {
  fieldVersionId: number;
  sourceKey: string;
  sourceSha256: string;
  assertionSha256: string;
  license: string;
  rightsStatus: string;
  allowDisplay: number;
  allowTranslation: number;
}

interface HumanReviewRow {
  fieldVersionId: number;
  artifactHash: string;
}

export interface LexiconV3AuthoringEnglishSnapshot {
  schemaVersion: typeof LEXICON_V3_AUTHORING_ENGLISH_SCHEMA;
  lineageFingerprint: string;
  fingerprint: string;
  records: Map<string, LexiconV3AuthoringEnglishBundle>;
}

/**
 * Read the exact English parent that may be sent to French translation.
 * This view is deliberately stricter than the authoring schema: unresolved
 * issues, missing human reviews, ambiguous active versions, and unusable
 * source rights all fail closed before a packet can call a model.
 */
export function readLexiconV3AuthoringEnglish(
  db: DatabaseSync
): Map<string, EnglishBundle> {
  return readLexiconV3AuthoringEnglishSnapshot(db).records;
}

export function readLexiconV3AuthoringEnglishSnapshot(
  db: DatabaseSync
): LexiconV3AuthoringEnglishSnapshot {
  const lineageFingerprint = requiredMeta(db, "englishLineageFingerprint");
  const entries = db
    .prepare("SELECT entryKey FROM LexiconEntries ORDER BY entryKey")
    .all() as unknown as EntryRow[];
  const fields = db
    .prepare(
      `SELECT id, entryKey, field, valueText, valueHtml, state, contentHash
       FROM LexiconFieldVersions
       WHERE locale = 'en' AND field IN ('gloss', 'meaning')
         AND state <> 'superseded'
       ORDER BY entryKey, field, id`
    )
    .all() as unknown as FieldRow[];
  const issues = db
    .prepare(
      `SELECT issue.entryKey, issue.fieldVersionId, issue.code, issue.severity
       FROM LexiconIssues issue
       LEFT JOIN LexiconFieldVersions field ON field.id = issue.fieldVersionId
       WHERE issue.status = 'open'
         AND issue.severity IN ('warning', 'blocker')
         AND (
           field.locale = 'en'
           OR (issue.fieldVersionId IS NULL AND issue.code NOT LIKE 'french-%')
         )
       ORDER BY issue.entryKey, issue.code, issue.id`
    )
    .all() as unknown as IssueRow[];
  const supportingSources = db
    .prepare(
      `SELECT evidence.fieldVersionId, source.sourceKey,
              source.sha256 AS sourceSha256,
              assertion.sha256 AS assertionSha256, source.license,
              source.rightsStatus,
              source.allowDisplay, source.allowTranslation
       FROM LexiconFieldEvidence evidence
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       JOIN LexiconFieldVersions field ON field.id = evidence.fieldVersionId
       WHERE field.locale = 'en' AND evidence.stance = 'supports'
       ORDER BY evidence.fieldVersionId, source.sourceKey`
    )
    .all() as unknown as SupportingSourceRow[];
  const humanReviews = db
    .prepare(
      `SELECT fieldVersionId, artifactHash
       FROM LexiconFieldReviews
       WHERE reviewerType = 'human' AND verdict = 'accept'
       ORDER BY fieldVersionId, artifactHash`
    )
    .all() as unknown as HumanReviewRow[];
  const humanAccepted = new Set(humanReviews.map((row) => row.fieldVersionId));
  const reviewsByField = groupBy(
    humanReviews,
    (review) => review.fieldVersionId
  );

  const fieldsBySlot = new Map<string, FieldRow[]>();
  for (const field of fields) {
    const key = `${field.entryKey}\u0000${field.field}`;
    const values = fieldsBySlot.get(key) ?? [];
    values.push(field);
    fieldsBySlot.set(key, values);
  }
  const issuesByEntry = groupBy(issues, (issue) => issue.entryKey);
  const sourcesByField = groupBy(
    supportingSources,
    (source) => source.fieldVersionId
  );
  const result = new Map<string, EnglishBundle>();

  for (const entry of entries) {
    const entryIssues: string[] = [];
    const selected = new Map<EnglishFieldName, FieldRow>();
    for (const fieldName of ["gloss", "meaning"] as const) {
      const candidates =
        fieldsBySlot.get(`${entry.entryKey}\u0000${fieldName}`) ?? [];
      if (candidates.length !== 1) {
        entryIssues.push(
          candidates.length === 0
            ? `missing-active-english-field:${fieldName}`
            : `ambiguous-active-english-field:${fieldName}`
        );
        continue;
      }
      const field = candidates[0]!;
      const expectedHash = lexiconV3FieldContentHash({
        entryKey: field.entryKey,
        locale: "en",
        field: field.field,
        valueText: field.valueText,
        valueHtml: field.valueHtml,
        derivedFromVersionId: null
      });
      if (expectedHash !== field.contentHash) {
        throw new Error(
          `authoring-english-content-hash-mismatch:${entry.entryKey}:${fieldName}`
        );
      }
      selected.set(fieldName, field);
    }

    const selectedIds = new Set(
      [...selected.values()].map((field) => field.id)
    );
    for (const issue of issuesByEntry.get(entry.entryKey) ?? []) {
      if (
        issue.fieldVersionId === null ||
        selectedIds.has(issue.fieldVersionId)
      ) {
        entryIssues.push(`${issue.severity}:${issue.code}`);
      }
    }

    const sourceKeys = new Set<string>();
    const sourceAttestations: Array<Record<string, unknown>> = [];
    const reviewArtifactHashes = new Set<string>();
    for (const [fieldName, field] of selected) {
      if (
        field.state === "blocked_source_issue" ||
        field.state === "rejected"
      ) {
        entryIssues.push(`blocked-field-state:${fieldName}:${field.state}`);
      } else if (field.state === "candidate") {
        entryIssues.push(`review-field-state:${fieldName}:candidate`);
      }
      if (field.state === "human_validated" && !humanAccepted.has(field.id)) {
        entryIssues.push(`missing-human-accept-review:${fieldName}`);
      }
      const sources = sourcesByField.get(field.id) ?? [];
      if (sources.length === 0) {
        entryIssues.push(`missing-supporting-source:${fieldName}`);
      }
      for (const source of sources) {
        sourceKeys.add(source.sourceKey);
        sourceAttestations.push({
          field: fieldName,
          sourceKey: source.sourceKey,
          sourceSha256: source.sourceSha256,
          assertionSha256: source.assertionSha256,
          license: source.license,
          rightsStatus: source.rightsStatus,
          allowDisplay: source.allowDisplay,
          allowTranslation: source.allowTranslation
        });
        if (
          source.rightsStatus !== "cleared" ||
          source.allowDisplay !== 1 ||
          source.allowTranslation !== 1
        ) {
          entryIssues.push(
            `translation-rights-blocked:${fieldName}:${source.sourceKey}`
          );
        }
      }
      for (const review of reviewsByField.get(field.id) ?? []) {
        reviewArtifactHashes.add(review.artifactHash);
      }
    }

    const normalizedIssues = [...new Set(entryIssues)].sort();
    const gloss = selected.get("gloss");
    const meaning = selected.get("meaning");
    const hasBlockingIssue = normalizedIssues.some(
      (issue) =>
        issue.startsWith("blocker:") ||
        issue.startsWith("blocked-") ||
        issue.startsWith("missing-") ||
        issue.startsWith("ambiguous-") ||
        issue.startsWith("translation-rights-blocked:")
    );
    const hasReviewIssue = normalizedIssues.some(
      (issue) => issue.startsWith("warning:") || issue.startsWith("review-")
    );
    const status: EnglishBundle["status"] = hasBlockingIssue
      ? "source_issue"
      : hasReviewIssue
        ? "review_needed"
        : [...selected.values()].some(
              (field) => field.state === "human_validated"
            )
          ? "human_validated"
          : "validated";
    const sources = [...sourceKeys].sort();
    const contentHash = sha256(
      stableJson({
        schemaVersion: LEXICON_V3_AUTHORING_ENGLISH_SCHEMA,
        entryKey: entry.entryKey,
        lineageFingerprint,
        glossContentHash: gloss?.contentHash ?? null,
        meaningContentHash: meaning?.contentHash ?? null,
        status,
        sources,
        sourceAttestations: sourceAttestations.sort((left, right) =>
          stableJson(left).localeCompare(stableJson(right))
        ),
        reviewArtifactHashes: [...reviewArtifactHashes].sort(),
        issues: normalizedIssues
      })
    );
    result.set(entry.entryKey, {
      contentHash,
      status,
      gloss: gloss?.valueText.trim() ?? "",
      meaning: meaning?.valueText.trim() ?? "",
      meaningHtml:
        meaning?.valueHtml?.trim() || meaning?.valueText.trim() || "",
      sources,
      issues: normalizedIssues
    });
  }

  const fingerprint = sha256(
    stableJson({
      schemaVersion: LEXICON_V3_AUTHORING_ENGLISH_SCHEMA,
      lineageFingerprint,
      records: [...result.entries()].map(([entryKey, bundle]) => ({
        entryKey,
        contentHash: bundle.contentHash
      }))
    })
  );
  return {
    schemaVersion: LEXICON_V3_AUTHORING_ENGLISH_SCHEMA,
    lineageFingerprint,
    fingerprint,
    records: result
  };
}

export function requiredLexiconV3Meta(db: DatabaseSync, key: string): string {
  return requiredMeta(db, key);
}

function requiredMeta(db: DatabaseSync, key: string): string {
  const row = db
    .prepare("SELECT value FROM LexiconV3Meta WHERE key = ?")
    .get(key) as { value?: string } | undefined;
  if (!row?.value) throw new Error(`missing-authoring-meta:${key}`);
  return row.value;
}

function groupBy<T, K>(
  values: readonly T[],
  keyFor: (value: T) => K
): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const rows = result.get(key) ?? [];
    rows.push(value);
    result.set(key, rows);
  }
  return result;
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
