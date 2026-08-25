import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  lexiconV3FieldContentHash,
  lexiconV3MissingFieldReviewTargetHash,
  lexiconV3ReviewArtifactHash,
  lexiconV3ReviewTargetHash,
  type LexiconV3ReviewDecision,
  validateLexiconV3ReviewDecision
} from "../src/lexiconV3/review.js";
import { verifyLexiconV3Schema } from "../src/lexiconV3/schema.js";
import { validateLexiconHtmlPair } from "../src/lexiconV3/frenchValidation.js";

interface FieldRow {
  id: number;
  entryKey: string;
  locale: "en" | "fr";
  field: "gloss" | "meaning" | "notes";
  valueText: string;
  valueHtml: string | null;
  state: string;
  confidence: number;
  method: string;
  generator: string;
  derivedFromVersionId: number | null;
  contentHash: string;
  createdAt: string;
}

interface MissingFieldRow {
  id: null;
  entryKey: string;
  locale: "en";
  field: "gloss" | "meaning";
  valueText: "";
  valueHtml: null;
  state: "missing";
  confidence: null;
  method: null;
  generator: null;
  derivedFromVersionId: null;
  contentHash: null;
  createdAt: string;
}

type ReviewFieldRow = FieldRow | MissingFieldRow;

interface IssueRow {
  id: number;
  entryKey: string;
  fieldVersionId: number | null;
  code: string;
  severity: string;
  status: string;
  detailsJson: string;
}

interface ReviewEntryRow {
  entryKey: string;
  language: string;
  eStrong: string;
  primaryDStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
}

interface ReviewAssertionRow {
  id: number;
  entryKey: string;
  sourceKey: string;
  field: string;
  locale: string;
  valueText: string | null;
  valueHtml: string | null;
  locator: string;
  sha256: string;
  rightsStatus: string;
  allowDisplay: number;
  allowTranslation: number;
}

interface EditorialSourceRow {
  id: number;
  sourceKey: string;
  name: string;
  version: string;
  witnessFamily: string;
  locale: string;
  sha256: string;
  license: string;
  rightsStatus: string;
  allowDisplay: number;
  allowTranslation: number;
  allowCarrier: number;
  metadataJson: string;
}

const DEFAULT_DB = "outputs/lexicon-v3/authoring.sqlite";
const DEFAULT_QUEUE = "outputs/lexicon-v3/review-queue.json";

function main(): void {
  const args = parseLexiconV3ReviewArgs(process.argv.slice(2));
  const command = args._command ?? "export";
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  if (!existsSync(dbPath)) throw new Error(`missing-authoring-db:${dbPath}`);

  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    const verification = verifyLexiconV3Schema(db);
    if (!verification.ok) {
      throw new Error(
        `invalid-authoring-schema:${JSON.stringify(verification)}`
      );
    }
    if (command === "export") exportQueue(db, args);
    else if (command === "apply") applyDecisionFile(db, args);
    else throw new Error(`unknown-command:${command}`);
  } finally {
    db.close();
  }
}

function exportQueue(db: DatabaseSync, args: Record<string, string>): void {
  const outputPath = resolve(args.output ?? DEFAULT_QUEUE);
  const includeAutoGlosses = args.includeAutoGlosses === "true";
  const includeInfoIssues = args.includeInfoIssues === "true";
  const limit = boundedInteger(args.limit, 1, 1_000_000) ?? 500;
  const only = args.only?.trim();
  const queue = buildLexiconV3ReviewQueue(db, {
    database: dbPathForReport(args.db ?? DEFAULT_DB),
    generatedAt: new Date().toISOString(),
    includeAutoGlosses,
    includeInfoIssues,
    limit,
    only
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({ output: outputPath, total: queue.total }, null, 2)
  );
}

export function buildLexiconV3ReviewQueue(
  db: DatabaseSync,
  options: {
    database: string;
    generatedAt: string;
    includeAutoGlosses: boolean;
    includeInfoIssues?: boolean;
    limit: number;
    only?: string;
  }
): {
  schemaVersion: "lexicon-v3-review-queue@3";
  database: string;
  generatedAt: string;
  includeAutoGlosses: boolean;
  includeInfoIssues: boolean;
  limit: number;
  total: number;
  entries: ReviewEntryRow[];
  sourceAssertions: ReviewAssertionRow[];
  fields: Array<
    ReviewFieldRow & {
      missing: boolean;
      reviewTargetHash: string;
      issues: IssueRow[];
    }
  >;
} {
  const { includeAutoGlosses, limit, only } = options;
  const includeInfoIssues = options.includeInfoIssues === true;
  const conditions = [
    `fv.state <> 'superseded' AND
     (fv.state IN ('candidate', 'blocked_source_issue')
      OR EXISTS (
        SELECT 1 FROM LexiconIssues issue
        WHERE issue.entryKey = fv.entryKey
          AND issue.status = 'open'
          AND ${
            includeInfoIssues
              ? "1 = 1"
              : "issue.severity IN ('blocker', 'warning')"
          }
          AND (issue.fieldVersionId IS NULL OR issue.fieldVersionId = fv.id)
      )${includeAutoGlosses ? " OR (fv.field = 'gloss' AND fv.state = 'auto_validated')" : ""})`
  ];
  const parameters: Array<string | number> = [];
  if (only) {
    conditions.push("(fv.entryKey = ? OR fv.entryKey LIKE ?)");
    parameters.push(only, `%:${only}`);
  }
  const rows = db
    .prepare(
      `SELECT fv.*
       FROM LexiconFieldVersions fv
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE fv.state WHEN 'blocked_source_issue' THEN 0 ELSE 1 END,
         CASE fv.field WHEN 'gloss' THEN 0 WHEN 'meaning' THEN 1 ELSE 2 END,
         fv.entryKey, fv.locale, fv.id
       `
    )
    .all(...parameters) as unknown as FieldRow[];
  const combinedRows: ReviewFieldRow[] = [
    ...rows,
    ...readMissingReviewFields(db, only)
  ];
  combinedRows.sort(compareReviewFields);
  const limitedRows = combinedRows.slice(0, limit);
  const entryKeys = [...new Set(limitedRows.map((row) => row.entryKey))];
  const issues = readIssues(db, entryKeys);
  const entries = readReviewEntries(db, entryKeys);
  const assertions = readReviewAssertions(db, entryKeys);
  const issuesByField = new Map<number | null, IssueRow[]>();
  for (const issue of issues) {
    const key = issue.fieldVersionId;
    const values = issuesByField.get(key) ?? [];
    values.push(issue);
    issuesByField.set(key, values);
  }
  return {
    schemaVersion: "lexicon-v3-review-queue@3",
    database: options.database,
    generatedAt: options.generatedAt,
    includeAutoGlosses,
    includeInfoIssues,
    limit,
    total: limitedRows.length,
    entries,
    sourceAssertions: assertions,
    fields: limitedRows.map((row) => ({
      ...row,
      missing: row.id === null,
      reviewTargetHash:
        row.id === null
          ? lexiconV3MissingFieldReviewTargetHash({
              entryKey: row.entryKey,
              locale: row.locale,
              field: row.field
            })
          : reviewTargetHashForField(db, row),
      issues: reviewIssuesForField(row, issuesByField)
    }))
  };
}

function reviewIssuesForField(
  row: ReviewFieldRow,
  issuesByField: Map<number | null, IssueRow[]>
): IssueRow[] {
  const matchingMissingCode = `missing-english-${row.field}`;
  const entryIssues = (issuesByField.get(null) ?? []).filter(
    (issue) => issue.entryKey === row.entryKey
  );
  return [
    ...(row.id === null ? [] : (issuesByField.get(row.id) ?? [])),
    ...entryIssues.filter((issue) => {
      const isMissingFieldIssue =
        issue.code === "missing-english-gloss" ||
        issue.code === "missing-english-meaning";
      return row.id === null
        ? !isMissingFieldIssue || issue.code === matchingMissingCode
        : !isMissingFieldIssue;
    })
  ];
}

function readMissingReviewFields(
  db: DatabaseSync,
  only?: string
): MissingFieldRow[] {
  const conditions = [
    "issue.status = 'open'",
    "issue.fieldVersionId IS NULL",
    "issue.code IN ('missing-english-gloss', 'missing-english-meaning')"
  ];
  const parameters: string[] = [];
  if (only) {
    conditions.push("(issue.entryKey = ? OR issue.entryKey LIKE ?)");
    parameters.push(only, `%:${only}`);
  }
  const candidates = db
    .prepare(
      `SELECT issue.entryKey, issue.code, issue.createdAt
       FROM LexiconIssues issue
       JOIN LexiconEntries entry ON entry.entryKey = issue.entryKey
       WHERE ${conditions.join(" AND ")}
       ORDER BY issue.entryKey, issue.code, issue.id`
    )
    .all(...parameters) as unknown as Array<{
    entryKey: string;
    code: "missing-english-gloss" | "missing-english-meaning";
    createdAt: string;
  }>;
  const result: MissingFieldRow[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const field =
      candidate.code === "missing-english-gloss" ? "gloss" : "meaning";
    const slotKey = `${candidate.entryKey}\u0000${field}`;
    if (seen.has(slotKey)) continue;
    seen.add(slotKey);
    const active = db
      .prepare(
        `SELECT 1 FROM LexiconFieldVersions
         WHERE entryKey = ? AND locale = 'en' AND field = ?
           AND state <> 'superseded'
         LIMIT 1`
      )
      .get(candidate.entryKey, field);
    if (active) continue;
    result.push({
      id: null,
      entryKey: candidate.entryKey,
      locale: "en",
      field,
      valueText: "",
      valueHtml: null,
      state: "missing",
      confidence: null,
      method: null,
      generator: null,
      derivedFromVersionId: null,
      contentHash: null,
      createdAt: candidate.createdAt
    });
  }
  return result;
}

function compareReviewFields(
  left: ReviewFieldRow,
  right: ReviewFieldRow
): number {
  const stateRank = new Map<string, number>([
    ["missing", 0],
    ["blocked_source_issue", 1],
    ["candidate", 2]
  ]);
  const fieldRank = new Map<string, number>([
    ["gloss", 0],
    ["meaning", 1],
    ["notes", 2]
  ]);
  return (
    (stateRank.get(left.state) ?? 3) - (stateRank.get(right.state) ?? 3) ||
    (fieldRank.get(left.field) ?? 3) - (fieldRank.get(right.field) ?? 3) ||
    left.entryKey.localeCompare(right.entryKey) ||
    left.locale.localeCompare(right.locale) ||
    (left.id ?? 0) - (right.id ?? 0)
  );
}

function readReviewEntries(
  db: DatabaseSync,
  entryKeys: string[]
): ReviewEntryRow[] {
  if (entryKeys.length === 0) return [];
  const placeholders = entryKeys.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT entryKey, language, eStrong, primaryDStrong, dStrong, uStrong,
              original, transliteration, morph
       FROM LexiconEntries
       WHERE entryKey IN (${placeholders})
       ORDER BY entryKey`
    )
    .all(...entryKeys) as unknown as ReviewEntryRow[];
}

function readReviewAssertions(
  db: DatabaseSync,
  entryKeys: string[]
): ReviewAssertionRow[] {
  if (entryKeys.length === 0) return [];
  const placeholders = entryKeys.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT assertion.id, assertion.entryKey, source.sourceKey,
              assertion.field, assertion.locale,
              CASE WHEN source.sourceKey = 'artifact-english-audit'
                   THEN NULL ELSE assertion.valueText END AS valueText,
              CASE WHEN source.sourceKey = 'artifact-english-audit'
                   THEN NULL ELSE assertion.valueHtml END AS valueHtml,
              assertion.locator, assertion.sha256, source.rightsStatus,
              source.allowDisplay, source.allowTranslation
       FROM LexiconSourceAssertions assertion
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE assertion.entryKey IN (${placeholders})
         AND assertion.field IN ('identity', 'gloss', 'meaning', 'resource')
       ORDER BY assertion.entryKey, assertion.field, source.sourceKey,
                assertion.id`
    )
    .all(...entryKeys) as unknown as ReviewAssertionRow[];
}

function applyDecisionFile(
  db: DatabaseSync,
  args: Record<string, string>
): void {
  const inputPath = resolve(
    args.input ?? "outputs/lexicon-v3/review-decisions.jsonl"
  );
  if (!existsSync(inputPath)) throw new Error(`missing-decisions:${inputPath}`);
  const decisions = readLexiconV3ReviewDecisions(inputPath);
  const result = applyLexiconV3ReviewDecisions(db, decisions);
  console.log(JSON.stringify({ input: inputPath, ...result }, null, 2));
}

export function applyLexiconV3ReviewDecisions(
  db: DatabaseSync,
  decisions: LexiconV3ReviewDecision[]
): {
  decisions: number;
  applied: number;
  replacements: number;
  creations: number;
} {
  const decisionKeys = new Set<string>();
  for (const decision of decisions) {
    const key = `${decision.entryKey}\u0000${decision.locale}\u0000${decision.field}\u0000${decision.expectedContentHash}`;
    if (decisionKeys.has(key)) {
      throw new Error(
        `duplicate-review-decision:${decision.entryKey}:${decision.locale}:${decision.field}`
      );
    }
    decisionKeys.add(key);
  }
  let applied = 0;
  let replacements = 0;
  let creations = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const decision of decisions) {
      const validation = validateLexiconV3ReviewDecision(decision);
      if (!validation.valid) {
        throw new Error(
          `invalid-review-decision:${decision.entryKey}:${decision.locale}:${decision.field}:${validation.issues.join(",")}`
        );
      }
      if (decision.verdict === "create") {
        const missingField = resolveMissingReviewField(db, decision);
        validateReviewedFieldContent(missingField, decision);
        const createdField = insertCreatedField(db, missingField, decision);
        insertEditorialReplacementEvidence(
          db,
          createdField.id,
          createdField,
          decision
        );
        const reviewId = insertReview(db, createdField.id, decision, "accept");
        resolveIssues(db, decision, createdField, reviewId);
        creations += 1;
        applied += 1;
        continue;
      }
      const field = resolveReviewField(db, decision);
      if (
        !["candidate", "blocked_source_issue", "auto_validated"].includes(
          field.state
        )
      ) {
        throw new Error(
          `review-decision-on-terminal-field:${field.id}:${field.state}`
        );
      }
      validateReviewedFieldContent(field, decision);

      if (invalidatesFrenchCarrierDescendants(decision)) {
        supersedeFrenchCarrierDescendants(db, field.id);
      }
      if (invalidatesFrenchDescendants(decision)) {
        supersedeFrenchDescendants(db, field.id);
      }

      if (decision.verdict === "replace") {
        const replacementId = insertReplacement(db, field, decision);
        if (decision.replacement?.evidenceMode === "editorial_replacement") {
          inheritFieldEvidence(db, field.id, replacementId, "context");
          insertEditorialReplacementEvidence(
            db,
            replacementId,
            field,
            decision
          );
        } else {
          inheritFieldEvidence(db, field.id, replacementId);
        }
        const reviewId = insertReview(db, replacementId, decision, "accept");
        db.prepare(
          "UPDATE LexiconFieldVersions SET state = 'superseded' WHERE id = ?"
        ).run(field.id);
        resolveIssues(db, decision, field, reviewId);
        replacements += 1;
      } else {
        const state = stateForVerdict(decision.verdict);
        const reviewId = insertReview(db, field.id, decision, decision.verdict);
        db.prepare(
          "UPDATE LexiconFieldVersions SET state = ? WHERE id = ?"
        ).run(state, field.id);
        resolveIssues(db, decision, field, reviewId);
      }
      applied += 1;
    }
    const verification = verifyLexiconV3Schema(db);
    if (!verification.ok) {
      throw new Error(
        `post-review-verification-failed:${JSON.stringify(verification)}`
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { decisions: decisions.length, applied, replacements, creations };
}

function invalidatesFrenchCarrierDescendants(
  decision: LexiconV3ReviewDecision
): boolean {
  return (
    decision.locale === "fr" &&
    decision.field === "gloss" &&
    ["replace", "reject", "source_issue", "needs_review"].includes(
      decision.verdict
    )
  );
}

function supersedeFrenchCarrierDescendants(
  db: DatabaseSync,
  frenchGlossFieldVersionId: number
): void {
  db.prepare(
    `UPDATE LexiconCarrierTerms
     SET state = 'superseded',
         policy = CASE
           WHEN policy = 'auto_safe' THEN 'review_only'
           ELSE policy
         END
     WHERE derivedFromVersionId = ?
       AND state IN ('candidate', 'auto_validated', 'human_validated')`
  ).run(frenchGlossFieldVersionId);
}

function invalidatesFrenchDescendants(
  decision: LexiconV3ReviewDecision
): boolean {
  return (
    decision.locale === "en" &&
    ["replace", "reject", "source_issue", "needs_review"].includes(
      decision.verdict
    )
  );
}

function supersedeFrenchDescendants(
  db: DatabaseSync,
  englishFieldVersionId: number
): void {
  db.prepare(
    `UPDATE LexiconCarrierTerms
     SET state = 'superseded',
         policy = CASE
           WHEN policy = 'auto_safe' THEN 'review_only'
           ELSE policy
         END
     WHERE derivedFromVersionId IN (
       SELECT id
       FROM LexiconFieldVersions
       WHERE locale = 'fr' AND derivedFromVersionId = ?
     )
       AND state IN ('candidate', 'auto_validated', 'human_validated')`
  ).run(englishFieldVersionId);
  db.prepare(
    `UPDATE LexiconFieldVersions
     SET state = 'superseded'
     WHERE locale = 'fr' AND derivedFromVersionId = ?
       AND state IN (
         'candidate', 'auto_validated', 'human_validated',
         'blocked_source_issue'
       )`
  ).run(englishFieldVersionId);
}

function validateReviewedFieldContent(
  field: {
    id: number | null;
    field: FieldRow["field"];
    valueText: string;
    valueHtml: string | null;
  },
  decision: LexiconV3ReviewDecision
): void {
  const replacement = decision.replacement;
  const valueText = replacement?.valueText ?? field.valueText;
  const valueHtml = replacement?.valueHtml ?? field.valueHtml;
  if (field.field !== "meaning") {
    if (replacement?.valueHtml) {
      throw new Error(`unexpected-review-html:${field.id}:${field.field}`);
    }
    return;
  }
  if (!valueHtml) return;
  const issues = validateLexiconHtmlPair(valueText, valueHtml);
  if (issues.length > 0) {
    throw new Error(
      `invalid-reviewed-html:${field.id}:${issues.map((issue) => issue.code).join(",")}`
    );
  }
}

function resolveMissingReviewField(
  db: DatabaseSync,
  decision: LexiconV3ReviewDecision
): MissingFieldRow {
  if (
    decision.locale !== "en" ||
    !["gloss", "meaning"].includes(decision.field)
  ) {
    throw new Error(
      `invalid-create-target:${decision.entryKey}:${decision.locale}:${decision.field}`
    );
  }
  const field = decision.field as "gloss" | "meaning";
  const entry = db
    .prepare("SELECT 1 FROM LexiconEntries WHERE entryKey = ?")
    .get(decision.entryKey);
  const expectedHash = lexiconV3MissingFieldReviewTargetHash({
    entryKey: decision.entryKey,
    locale: "en",
    field
  });
  const existing = db
    .prepare(
      `SELECT 1 FROM LexiconFieldVersions
       WHERE entryKey = ? AND locale = 'en' AND field = ?
         AND state <> 'superseded'
       LIMIT 1`
    )
    .get(decision.entryKey, field);
  if (!entry || existing || decision.expectedContentHash !== expectedHash) {
    throw new Error(
      `stale-review-decision:${decision.entryKey}:${decision.locale}:${decision.field}`
    );
  }
  const issueCode = `missing-english-${field}`;
  const issue = db
    .prepare(
      `SELECT createdAt FROM LexiconIssues
       WHERE entryKey = ? AND fieldVersionId IS NULL AND code = ?
         AND status = 'open'
       ORDER BY id LIMIT 1`
    )
    .get(decision.entryKey, issueCode) as { createdAt: string } | undefined;
  if (!issue) {
    throw new Error(
      `missing-create-issue:${decision.entryKey}:${decision.locale}:${decision.field}`
    );
  }
  if (!(decision.resolveIssueCodes ?? []).includes(issueCode)) {
    throw new Error(
      `create-must-resolve-missing-issue:${decision.entryKey}:${issueCode}`
    );
  }
  return {
    id: null,
    entryKey: decision.entryKey,
    locale: "en",
    field,
    valueText: "",
    valueHtml: null,
    state: "missing",
    confidence: null,
    method: null,
    generator: null,
    derivedFromVersionId: null,
    contentHash: null,
    createdAt: issue.createdAt
  };
}

function insertCreatedField(
  db: DatabaseSync,
  missingField: MissingFieldRow,
  decision: LexiconV3ReviewDecision
): FieldRow {
  const replacement = decision.replacement;
  if (!replacement) throw new Error("missing-replacement");
  const valueHtml =
    missingField.field === "meaning" ? (replacement.valueHtml ?? null) : null;
  const contentHash = lexiconV3FieldContentHash({
    entryKey: missingField.entryKey,
    locale: "en",
    field: missingField.field,
    valueText: replacement.valueText,
    valueHtml,
    derivedFromVersionId: null
  });
  const result = db
    .prepare(
      `INSERT INTO LexiconFieldVersions (
         entryKey, locale, field, valueText, valueHtml, state, confidence,
         method, generator, promptVersion, derivedFromVersionId, supersedesId,
         contentHash, createdAt
       ) VALUES (?, 'en', ?, ?, ?, 'human_validated', ?, 'editorial', ?, NULL,
                 NULL, NULL, ?, ?)`
    )
    .run(
      missingField.entryKey,
      missingField.field,
      replacement.valueText,
      valueHtml,
      replacement.confidence,
      `human:${decision.reviewer}`,
      contentHash,
      decision.decidedAt
    );
  const field = db
    .prepare("SELECT * FROM LexiconFieldVersions WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as FieldRow | undefined;
  if (!field) throw new Error("missing-created-field-after-insert");
  return field;
}

function inheritFieldEvidence(
  db: DatabaseSync,
  sourceFieldVersionId: number,
  replacementFieldVersionId: number,
  stanceOverride?: "context"
): void {
  db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight, detailsJson, createdAt
     )
     SELECT ?, sourceAssertionId, evidenceKind, coalesce(?, stance),
            witnessFamily, weight, detailsJson, createdAt
     FROM LexiconFieldEvidence
     WHERE fieldVersionId = ?
     ORDER BY id`
  ).run(
    replacementFieldVersionId,
    stanceOverride ?? null,
    sourceFieldVersionId
  );
}

function insertEditorialReplacementEvidence(
  db: DatabaseSync,
  replacementFieldVersionId: number,
  field: FieldRow,
  decision: LexiconV3ReviewDecision
): void {
  const sourceDigest = createHash("sha256")
    .update("lexicon-v3-project-editorial-review@1")
    .digest("hex");
  const metadataJson = JSON.stringify({
    policy: "human-editorial-replacement@1"
  });
  db.prepare(
    `INSERT INTO LexiconSources (
       sourceKey, name, version, witnessFamily, locale, sha256, license,
       rightsStatus, allowDisplay, allowTranslation, allowCarrier,
       metadataJson, createdAt
     ) VALUES (
       'project-editorial-review', 'Project editorial review', '1',
       'project-editorial-review', 'mul', ?, 'Project-authored editorial content',
       'cleared', 1, 1, 0, ?, ?
     ) ON CONFLICT(sourceKey) DO NOTHING`
  ).run(sourceDigest, metadataJson, decision.decidedAt);
  const source = db
    .prepare(
      `SELECT id, sourceKey, name, version, witnessFamily, locale, sha256,
              license, rightsStatus, allowDisplay, allowTranslation,
              allowCarrier, metadataJson
       FROM LexiconSources
       WHERE sourceKey = 'project-editorial-review'`
    )
    .get() as EditorialSourceRow | undefined;
  if (!source) throw new Error("missing-project-editorial-source-after-upsert");
  const expectedSource = {
    sourceKey: "project-editorial-review",
    name: "Project editorial review",
    version: "1",
    witnessFamily: "project-editorial-review",
    locale: "mul",
    sha256: sourceDigest,
    license: "Project-authored editorial content",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadataJson
  };
  const actualSource = {
    sourceKey: source.sourceKey,
    name: source.name,
    version: source.version,
    witnessFamily: source.witnessFamily,
    locale: source.locale,
    sha256: source.sha256,
    license: source.license,
    rightsStatus: source.rightsStatus,
    allowDisplay: source.allowDisplay,
    allowTranslation: source.allowTranslation,
    allowCarrier: source.allowCarrier,
    metadataJson: source.metadataJson
  };
  if (JSON.stringify(actualSource) !== JSON.stringify(expectedSource)) {
    throw new Error(
      `project-editorial-source-collision:${JSON.stringify(actualSource)}`
    );
  }
  const replacement = decision.replacement!;
  const assertionDigest = createHash("sha256")
    .update(`${replacement.valueText}\u0000${replacement.valueHtml ?? ""}`)
    .digest("hex");
  const assertion = db
    .prepare(
      `INSERT INTO LexiconSourceAssertions (
         sourceId, entryKey, scope, field, locale, valueText, valueHtml,
         locator, sha256, createdAt
       ) VALUES (?, ?, 'entry', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      source.id,
      field.entryKey,
      field.field,
      field.locale,
      replacement.valueText,
      field.field === "meaning" ? (replacement.valueHtml ?? null) : null,
      `editorial-review:${lexiconV3ReviewArtifactHash(decision)}`,
      assertionDigest,
      decision.decidedAt
    );
  db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight, detailsJson, createdAt
     ) VALUES (?, ?, 'review', 'supports', 'project-editorial-review', 1, ?, ?)`
  ).run(
    replacementFieldVersionId,
    Number(assertion.lastInsertRowid),
    JSON.stringify({
      sourceNote: replacement.sourceNote,
      artifactHash: lexiconV3ReviewArtifactHash(decision)
    }),
    decision.decidedAt
  );
}

function insertReplacement(
  db: DatabaseSync,
  field: FieldRow,
  decision: LexiconV3ReviewDecision
): number {
  const replacement = decision.replacement;
  if (!replacement) throw new Error("missing-replacement");
  const derivedFromVersionId =
    field.locale === "fr" ? field.derivedFromVersionId : null;
  const contentHash = lexiconV3FieldContentHash({
    entryKey: field.entryKey,
    locale: field.locale,
    field: field.field,
    valueText: replacement.valueText,
    valueHtml: replacement.valueHtml ?? null,
    derivedFromVersionId
  });
  const result = db
    .prepare(
      `INSERT INTO LexiconFieldVersions (
         entryKey, locale, field, valueText, valueHtml, state, confidence,
         method, generator, promptVersion, derivedFromVersionId, supersedesId,
         contentHash
       ) VALUES (?, ?, ?, ?, ?, 'human_validated', ?, ?, ?, NULL, ?, ?, ?)`
    )
    .run(
      field.entryKey,
      field.locale,
      field.field,
      replacement.valueText,
      field.field === "meaning" ? (replacement.valueHtml ?? null) : null,
      replacement.confidence,
      field.locale === "fr" ? "translation" : "editorial",
      `human:${decision.reviewer}`,
      derivedFromVersionId,
      field.id,
      contentHash
    );
  return Number(result.lastInsertRowid);
}

function insertReview(
  db: DatabaseSync,
  fieldVersionId: number,
  decision: LexiconV3ReviewDecision,
  verdict: "accept" | "reject" | "needs_review" | "source_issue"
): number {
  const result = db
    .prepare(
      `INSERT INTO LexiconFieldReviews (
         fieldVersionId, reviewerType, reviewer, verdict, reason, artifactHash,
         createdAt
       ) VALUES (?, 'human', ?, ?, ?, ?, ?)`
    )
    .run(
      fieldVersionId,
      decision.reviewer,
      verdict,
      decision.reason,
      lexiconV3ReviewArtifactHash(decision),
      decision.decidedAt
    );
  return Number(result.lastInsertRowid);
}

function resolveIssues(
  db: DatabaseSync,
  decision: LexiconV3ReviewDecision,
  field: FieldRow,
  reviewId: number
): void {
  for (const issueCode of new Set(decision.resolveIssueCodes ?? [])) {
    const result = db
      .prepare(
        `UPDATE LexiconIssues
         SET status = 'resolved', resolutionReviewId = ?, resolvedAt = ?
         WHERE entryKey = ? AND code = ? AND status = 'open'
           AND (fieldVersionId IS NULL OR fieldVersionId = ?)`
      )
      .run(reviewId, decision.decidedAt, field.entryKey, issueCode, field.id);
    if (Number(result.changes) < 1) {
      throw new Error(`unresolvable-issue:${issueCode}:${field.entryKey}`);
    }
  }
}

function readIssues(db: DatabaseSync, entryKeys: string[]): IssueRow[] {
  if (entryKeys.length === 0) return [];
  const placeholders = entryKeys.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT id, entryKey, fieldVersionId, code, severity, status, detailsJson
       FROM LexiconIssues
       WHERE status = 'open' AND entryKey IN (${placeholders})
       ORDER BY severity DESC, id`
    )
    .all(...entryKeys) as unknown as IssueRow[];
}

function resolveReviewField(
  db: DatabaseSync,
  decision: LexiconV3ReviewDecision
): FieldRow {
  const rows = db
    .prepare(
      `SELECT * FROM LexiconFieldVersions
       WHERE entryKey = ? AND locale = ? AND field = ?
       ORDER BY id`
    )
    .all(
      decision.entryKey,
      decision.locale,
      decision.field
    ) as unknown as FieldRow[];
  const matches = rows.filter(
    (field) =>
      reviewTargetHashForField(db, field) === decision.expectedContentHash
  );
  if (matches.length === 0) {
    throw new Error(
      `stale-review-decision:${decision.entryKey}:${decision.locale}:${decision.field}`
    );
  }
  if (matches.length !== 1) {
    throw new Error(
      `ambiguous-review-decision:${decision.entryKey}:${decision.locale}:${decision.field}`
    );
  }
  return matches[0]!;
}

function reviewTargetHashForField(db: DatabaseSync, field: FieldRow): string {
  const parent = field.derivedFromVersionId
    ? (db
        .prepare("SELECT contentHash FROM LexiconFieldVersions WHERE id = ?")
        .get(field.derivedFromVersionId) as
        | { contentHash?: string }
        | undefined)
    : undefined;
  return lexiconV3ReviewTargetHash({
    entryKey: field.entryKey,
    locale: field.locale,
    field: field.field,
    valueText: field.valueText,
    valueHtml: field.valueHtml,
    derivedFromContentHash: parent?.contentHash ?? null
  });
}

export function readLexiconV3ReviewDecisions(
  path: string
): LexiconV3ReviewDecision[] {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  if (text.startsWith("["))
    return JSON.parse(text) as LexiconV3ReviewDecision[];
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as LexiconV3ReviewDecision);
}

function stateForVerdict(
  verdict: Exclude<LexiconV3ReviewDecision["verdict"], "replace" | "create">
): string {
  if (verdict === "accept") return "human_validated";
  if (verdict === "reject") return "rejected";
  if (verdict === "source_issue") return "blocked_source_issue";
  return "candidate";
}

export function parseLexiconV3ReviewArgs(
  args: readonly string[]
): Record<string, string> {
  const allowed = new Set([
    "db",
    "output",
    "includeAutoGlosses",
    "includeInfoIssues",
    "limit",
    "only",
    "input"
  ]);
  const parsed: Record<string, string> = {};
  let commandSet = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (!arg.startsWith("--") && !commandSet) {
      parsed._command = arg;
      commandSet = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected-argument:${arg}`);
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/gu, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (!allowed.has(key)) throw new Error(`unknown-option:${rawKey}`);
    if (parsed[key] !== undefined) {
      throw new Error(`duplicate-option:${rawKey}`);
    }
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`missing-value:${rawKey}`);
      parsed[key] = inlineValue;
    } else if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else throw new Error(`missing-value:${rawKey}`);
  }
  const command = parsed._command ?? "export";
  if (command !== "export" && command !== "apply") {
    throw new Error(`unknown-command:${command}`);
  }
  const commandSpecific =
    command === "export"
      ? new Set([
          "db",
          "output",
          "includeAutoGlosses",
          "includeInfoIssues",
          "limit",
          "only"
        ])
      : new Set(["db", "input"]);
  for (const key of Object.keys(parsed).filter((key) => key !== "_command")) {
    if (!commandSpecific.has(key)) {
      throw new Error(`option-not-valid-for-command:${command}:${key}`);
    }
  }
  for (const key of ["includeAutoGlosses", "includeInfoIssues"] as const) {
    if (
      parsed[key] !== undefined &&
      parsed[key] !== "true" &&
      parsed[key] !== "false"
    ) {
      throw new Error(`invalid-boolean:${key}:${parsed[key]}`);
    }
  }
  if (parsed.limit !== undefined) {
    const limit = Number(parsed.limit);
    if (
      !/^[1-9]\d*$/u.test(parsed.limit) ||
      !Number.isSafeInteger(limit) ||
      limit > 1_000_000
    ) {
      throw new Error(`invalid-limit:${parsed.limit}`);
    }
  }
  return parsed;
}

function boundedInteger(
  value: string | undefined,
  min: number,
  max: number
): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function dbPathForReport(value: string): string {
  return value;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) main();
