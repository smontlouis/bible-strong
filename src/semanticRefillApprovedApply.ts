import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeJsonFileAtomic } from "./atomicFile.js";
import { contentFingerprint } from "./contentAddressedCache.js";
import {
  type CuratedStrongOverride,
  getCuratedStrongOverrides
} from "./curatedStrongOverrides.js";
import { writeJsonFileImmutable } from "./immutableFile.js";
import { withReviewFileLock } from "./reviewFileLock.js";
import {
  DEFAULT_REVIEW_TRANSACTION_MARKER,
  beginReviewTransaction,
  commitReviewTransaction,
  markReviewTransactionPhase,
  recoverReviewTransaction,
  rollbackReviewTransaction
} from "./reviewTransaction.js";
import {
  type ApprovalDecision,
  approvalDecisionKey
} from "./semanticRefillApprovalBundle.js";
import {
  type ApprovalApplicationPlan,
  type ApprovalApplicationScope,
  type ValidatedApprovalBundle,
  buildApprovalApplicationScopes,
  validateApprovalBundle
} from "./semanticRefillApprovalPlan.js";
import { upsertCuratedStrongOverrides } from "./semanticRefillAgentReview.js";
import {
  curatedOverrideFingerprints,
  strongLedgerInputFingerprint,
  type StrongLedgerMetrics,
  type StrongLedgerVerse
} from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";

interface ApplicationMetrics {
  verseCount?: number;
  placementRiskCount?: number;
  readerMultiStrongWordCount?: number;
  readerOverBudgetStrongCount?: number;
  originalRepresentationRate?: number;
  referenceStrongCoverage?: number;
  referenceStrongCarrierCoverage?: number;
}

interface HumanApprovalRecord {
  version: 1;
  recordId: string;
  bible: string;
  scope: string;
  scopeOrdinal: number;
  decisionCount: number;
  decisionPayloadSha256: string;
  approvedPayloadSha256: string;
  bundleFileSha256: string;
  planFileSha256: string;
  decisionKeys: string[];
  phase: "applied" | "verified";
  appliedOverrideCount: number;
  createdAt: string;
  verifiedAt?: string;
  beforeMetrics?: ApplicationMetrics;
  afterMetrics?: ApplicationMetrics;
  sameTokenIdentityDuplicatesBefore?: number;
  sameTokenIdentityDuplicatesAfter?: number;
  lexicalReportPath?: string;
  lexicalReportSha256?: string;
  sqliteFileSha256After?: string;
  metricsFileSha256After?: string;
  attemptDir: string;
}

interface AppliedScopeResult {
  ordinal: number;
  scope: string;
  decisionCount: number;
  decisionPayloadSha256: string;
  approvalRecordId: string;
  appliedOverrideCount: number;
  attemptDir: string;
  sqliteFileSha256After: string;
  metricsFileSha256After: string;
  completedAt: string;
  reconciled?: boolean;
}

interface ApprovalApplicationManifest {
  version: 1;
  bible: string;
  status: "in-progress" | "scopes-complete" | "finalized";
  createdAt: string;
  updatedAt: string;
  bundlePath: string;
  bundleFileSha256: string;
  planPath: string;
  planFileSha256: string;
  decisionPayloadSha256: string;
  decisionCount: number;
  scopeCount: number;
  completedScopes: AppliedScopeResult[];
  finalization?: {
    completedAt: string;
    sqliteFileSha256: string;
    metricsFileSha256: string;
    lexicalReportSha256: string;
  };
}

interface LexicalMetrics {
  autoSafeCandidates?: number;
  autoSafeItems?: number;
  groupAutoSafeItems?: number;
}

export function assertNoLexicalAutoSafeRegression(
  before: LexicalMetrics,
  after: LexicalMetrics,
  scope: string
): void {
  for (const key of [
    "autoSafeCandidates",
    "autoSafeItems",
    "groupAutoSafeItems"
  ] as const) {
    const beforeValue = before[key] ?? 0;
    const afterValue = after[key] ?? 0;
    if (afterValue > beforeValue) {
      throw new Error(
        `lexical-auto-safe-regression:${scope}:${key}:${beforeValue}->${afterValue}`
      );
    }
  }
}

interface ApplyOptions {
  bible: string;
  bundlePath: string;
  planPath: string;
  outputRoot: string;
  ledgerDir: string;
  overridesPath: string;
  approvalLedgerPath: string;
  approvedSha256: string;
  maxScopes?: number;
  finalize: boolean;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export async function readLexicalMetricsHeader(
  filePath: string
): Promise<LexicalMetrics> {
  let prefix = "";
  const marker = '\n  "items": [';
  for await (const chunk of createReadStream(filePath, { encoding: "utf8" })) {
    prefix += chunk;
    const markerIndex = prefix.indexOf(marker);
    if (markerIndex >= 0) {
      const metricsLabel = '"metrics":';
      const metricsIndex = prefix.indexOf(metricsLabel);
      if (metricsIndex < 0 || metricsIndex > markerIndex) {
        throw new Error(`lexical-report-metrics-missing:${filePath}`);
      }
      const objectStart = prefix.indexOf(
        "{",
        metricsIndex + metricsLabel.length
      );
      if (objectStart < 0 || objectStart > markerIndex) {
        throw new Error(`lexical-report-metrics-invalid:${filePath}`);
      }
      const objectEnd = matchingJsonObjectEnd(prefix, objectStart);
      if (objectEnd < 0 || objectEnd > markerIndex) {
        throw new Error(`lexical-report-metrics-incomplete:${filePath}`);
      }
      return JSON.parse(
        prefix.slice(objectStart, objectEnd + 1)
      ) as LexicalMetrics;
    }
    if (prefix.length > 4 * 1024 * 1024) {
      throw new Error(`lexical-report-header-too-large:${filePath}`);
    }
  }
  throw new Error(`lexical-report-items-marker-missing:${filePath}`);
}

function matchingJsonObjectEnd(value: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function scopeForRef(ref: string): string {
  const [book, chapter] = ref.split(".");
  if (!book || !chapter) throw new Error(`invalid-approval-ref:${ref}`);
  return `${book}.${chapter}`;
}

function decisionsForScope(
  decisions: ApprovalDecision[],
  scope: string
): ApprovalDecision[] {
  return decisions.filter((decision) => scopeForRef(decision.ref) === scope);
}

export function buildHumanApprovedOverrides(
  decisions: ApprovalDecision[],
  approvedSha256: string,
  beforeVerses: StrongLedgerVerse[] = []
): CuratedStrongOverride[] {
  const versesByRef = new Map(beforeVerses.map((verse) => [verse.ref, verse]));
  const decisionGroupCounts = new Map<string, number>();
  for (const decision of decisions) {
    const key = `${decision.ref}\u0000${decision.strong
      .map((strong) => strong.toUpperCase())
      .sort()
      .join(" ")}`;
    decisionGroupCounts.set(key, (decisionGroupCounts.get(key) ?? 0) + 1);
  }
  return decisions.flatMap((decision) => {
    const beforeVerse = versesByRef.get(decision.ref);
    if (
      !decision.replace &&
      beforeVerse &&
      decisionAlreadyVisible(decision, beforeVerse)
    ) {
      return [];
    }
    const decisionGroupKey = `${decision.ref}\u0000${decision.strong
      .map((strong) => strong.toUpperCase())
      .sort()
      .join(" ")}`;
    const inferredReplace = inferUniqueReaderEmptyRelocation(
      decision,
      beforeVerse,
      decisionGroupCounts.get(decisionGroupKey) === 1
    );
    const clone = {
      ...decision,
      ...(inferredReplace ? { replace: inferredReplace } : {}),
      source: "llm-review:human-approved",
      reason: `Explicit durable human approval of internal-agent payload SHA-256 ${approvedSha256}; ${decision.reason}`
    } as ApprovalDecision & Record<string, unknown>;
    delete clone.status;
    delete clone.score;
    delete clone.priority;
    delete clone.evidence;
    return [clone as CuratedStrongOverride];
  });
}

function decisionAlreadyVisible(
  decision: ApprovalDecision,
  verse: StrongLedgerVerse
): boolean {
  return (
    decisionTargetMatchesText(decision, verse) &&
    decision.strong.every((strong) =>
      verse.annotations.some(
        (annotation) =>
          annotation.visibility === "reader" &&
          annotation.strong.toUpperCase() === strong.toUpperCase() &&
          annotationMatchesDecision(annotation, decision)
      )
    )
  );
}

function inferUniqueReaderEmptyRelocation(
  decision: ApprovalDecision,
  verse: StrongLedgerVerse | undefined,
  allowUnqualifiedReaderFallback: boolean
): CuratedStrongOverride["replace"] | undefined {
  if (decision.replace || (decision.target ?? "word") !== "word" || !verse) {
    return undefined;
  }

  const expected = new Set(
    decision.strong.map((strong) => strong.toUpperCase())
  );
  const evidence = Array.isArray(decision.evidence)
    ? decision.evidence.filter(
        (item): item is string => typeof item === "string"
      )
    : [];
  const evidenceText = [decision.reason, ...evidence].join("\n");
  const identityMatches = verse.annotations.filter((annotation) => {
    if (
      annotation.placement !== "empty" ||
      annotation.visibility === "hidden" ||
      annotation.insertAfterWordIndex === undefined ||
      !expected.has(annotation.strong.toUpperCase())
    ) {
      return false;
    }
    return [annotation.originalTokenId, annotation.originalOccurrenceId]
      .filter((identity): identity is string => !!identity)
      .some(
        (identity) =>
          evidenceText.includes(identity) ||
          evidenceText.includes(identity.replace(/:\d+$/u, ""))
      );
  });
  const readerIdentityPositions = uniqueCompleteEmptyPositions(
    identityMatches.filter((annotation) => annotation.visibility === "reader"),
    expected
  );
  if (readerIdentityPositions.length === 1) {
    return { target: "empty", wordIndex: readerIdentityPositions[0]! };
  }
  if (identityMatches.length > 0) return undefined;
  if (!allowUnqualifiedReaderFallback) return undefined;

  const countsByPosition = new Map<number, Map<string, number>>();
  for (const annotation of verse.annotations) {
    if (
      annotation.visibility !== "reader" ||
      annotation.placement !== "empty" ||
      annotation.insertAfterWordIndex === undefined
    ) {
      continue;
    }
    const strong = annotation.strong.toUpperCase();
    if (!expected.has(strong)) continue;
    const counts =
      countsByPosition.get(annotation.insertAfterWordIndex) ?? new Map();
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
    countsByPosition.set(annotation.insertAfterWordIndex, counts);
  }

  const positions = [...countsByPosition].filter(([, counts]) =>
    [...expected].every((strong) => counts.get(strong) === 1)
  );
  if (positions.length !== 1) return undefined;
  return { target: "empty", wordIndex: positions[0]![0] };
}

function uniqueCompleteEmptyPositions(
  annotations: StrongLedgerVerse["annotations"],
  expected: Set<string>
): number[] {
  const countsByPosition = new Map<number, Map<string, number>>();
  for (const annotation of annotations) {
    if (annotation.insertAfterWordIndex === undefined) continue;
    const strong = annotation.strong.toUpperCase();
    const counts =
      countsByPosition.get(annotation.insertAfterWordIndex) ?? new Map();
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
    countsByPosition.set(annotation.insertAfterWordIndex, counts);
  }
  return [...countsByPosition]
    .filter(([, counts]) =>
      [...expected].every((strong) => counts.get(strong) === 1)
    )
    .map(([position]) => position);
}

export function assertApprovalMetricsGates(
  before: ApplicationMetrics,
  after: ApplicationMetrics,
  approvedMultiStrongRiskAllowance = 0
): void {
  if (
    before.verseCount !== undefined &&
    after.verseCount !== before.verseCount
  ) {
    throw new Error(
      `verse-count-regression:${before.verseCount}->${after.verseCount}`
    );
  }
  if (
    before.placementRiskCount !== undefined &&
    after.placementRiskCount !== undefined &&
    after.placementRiskCount >
      before.placementRiskCount + approvedMultiStrongRiskAllowance
  ) {
    throw new Error(
      `placement-risk-regression:${before.placementRiskCount}->${after.placementRiskCount}:allowance=${approvedMultiStrongRiskAllowance}`
    );
  }
  if (
    before.readerOverBudgetStrongCount !== undefined &&
    after.readerOverBudgetStrongCount !== undefined &&
    after.readerOverBudgetStrongCount > before.readerOverBudgetStrongCount
  ) {
    throw new Error(
      `reader-over-budget-regression:${before.readerOverBudgetStrongCount}->${after.readerOverBudgetStrongCount}`
    );
  }
  for (const key of [
    "originalRepresentationRate",
    "referenceStrongCoverage",
    "referenceStrongCarrierCoverage"
  ] as const) {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (
      beforeValue !== undefined &&
      afterValue !== undefined &&
      afterValue + 1e-12 < beforeValue
    ) {
      throw new Error(`${key}-regression:${beforeValue}->${afterValue}`);
    }
  }
}

export function approvedMultiStrongRiskAllowance(options: {
  decisions: ApprovalDecision[];
  beforeVerses: StrongLedgerVerse[];
  afterVerses: StrongLedgerVerse[];
  auditEveryNewCarrier?: boolean;
}): number {
  const decisionsByTarget = new Map<string, Set<string>>();
  for (const decision of options.decisions) {
    if (
      (decision.target ?? "word") !== "word" ||
      decision.wordIndex === undefined
    ) {
      continue;
    }
    const key = `${decision.ref}\u0000${decision.wordIndex}`;
    const strong = decisionsByTarget.get(key) ?? new Set<string>();
    for (const code of decision.strong) strong.add(code.toUpperCase());
    decisionsByTarget.set(key, strong);
  }

  const beforeByRef = new Map(
    options.beforeVerses.map((verse) => [verse.ref, verse])
  );
  let allowance = 0;
  for (const verse of options.afterVerses) {
    const before = beforeByRef.get(verse.ref);
    const wordIndexes = new Set(
      verse.annotations
        .filter(
          (annotation) =>
            annotation.visibility === "reader" &&
            annotation.placement === "word" &&
            annotation.wordIndex !== undefined
        )
        .map((annotation) => annotation.wordIndex!)
    );
    for (const wordIndex of wordIndexes) {
      const afterItems = verse.annotations.filter(
        (annotation) =>
          annotation.visibility === "reader" &&
          annotation.placement === "word" &&
          annotation.wordIndex === wordIndex
      );
      if (afterItems.length < 2) continue;
      const beforeCount =
        before?.annotations.filter(
          (annotation) =>
            annotation.visibility === "reader" &&
            annotation.placement === "word" &&
            annotation.wordIndex === wordIndex
        ).length ?? 0;
      if (beforeCount >= 2) continue;

      const approved = decisionsByTarget.get(`${verse.ref}\u0000${wordIndex}`);
      const distinct = new Set(
        afterItems.map((annotation) => annotation.strong.toUpperCase())
      );
      const fullyApproved =
        approved !== undefined &&
        distinct.size === afterItems.length &&
        [...distinct].every((strong) => approved.has(strong)) &&
        afterItems.every((annotation) =>
          annotation.diagnostics.includes("llm-review:human-approved")
        );
      if (!fullyApproved) {
        if (options.auditEveryNewCarrier === false && approved === undefined) {
          continue;
        }
        throw new Error(
          `unapproved-new-multi-strong-carrier:${verse.ref}:word:${wordIndex}`
        );
      }
      allowance += 1;
    }
  }
  return allowance;
}

export function readerSameTokenIdentityDuplicateCount(
  verses: StrongLedgerVerse[]
): number {
  let count = 0;
  for (const verse of verses) {
    const seen = new Set<string>();
    for (const annotation of verse.annotations) {
      if (annotation.visibility !== "reader") continue;
      const carrier =
        annotation.placement === "word"
          ? `word:${annotation.wordIndex ?? ""}`
          : annotation.placement === "phrase"
            ? `phrase:${annotation.startWordIndex ?? ""}-${annotation.endWordIndex ?? ""}`
            : annotation.placement === "empty"
              ? `empty:${annotation.insertAfterWordIndex ?? ""}`
              : `${annotation.placement}:${annotation.wordIndex ?? ""}`;
      const key = `${verse.ref}|${carrier}|${annotation.strong.toUpperCase()}`;
      if (seen.has(key)) count += 1;
      else seen.add(key);
    }
  }
  return count;
}

export function assertApprovedDecisionsVisible(
  decisions: ApprovalDecision[],
  verses: StrongLedgerVerse[]
): void {
  const byRef = new Map(verses.map((verse) => [verse.ref, verse]));
  const missing: string[] = [];
  const staleReplacements: string[] = [];
  for (const decision of decisions) {
    const verse = byRef.get(decision.ref);
    if (!verse || !decisionTargetMatchesText(decision, verse)) {
      missing.push(approvalDecisionKey(decision));
      continue;
    }
    for (const strong of decision.strong) {
      const visible = verse.annotations.some(
        (annotation) =>
          annotation.visibility === "reader" &&
          annotation.strong.toUpperCase() === strong.toUpperCase() &&
          annotationMatchesDecision(annotation, decision)
      );
      if (!visible) missing.push(approvalDecisionKey(decision));
      const replacement = decision.replace;
      if (
        replacement &&
        verse.annotations.some(
          (annotation) =>
            annotation.visibility === "reader" &&
            annotation.strong.toUpperCase() === strong.toUpperCase() &&
            annotationMatchesReplacement(annotation, replacement)
        )
      ) {
        staleReplacements.push(approvalDecisionKey(decision));
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `approved-decisions-not-visible:${missing.slice(0, 10).join(";")}`
    );
  }
  if (staleReplacements.length > 0) {
    throw new Error(
      `approved-relocation-source-still-visible:${staleReplacements.slice(0, 10).join(";")}`
    );
  }
}

function decisionTargetMatchesText(
  decision: ApprovalDecision,
  verse: StrongLedgerVerse
): boolean {
  const target = decision.target ?? "word";
  if (target === "empty") return decision.normalized === "";
  if (target === "phrase") {
    const start = decision.startWordIndex;
    const end = decision.endWordIndex;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
    const expected = Array.isArray(decision.normalizedPhrase)
      ? decision.normalizedPhrase
      : [];
    const actual = verse.tokens
      .filter(
        (token) =>
          token.wordIndex >= (start as number) &&
          token.wordIndex <= (end as number)
      )
      .map((token) => token.normalized);
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  return verse.tokens.some(
    (token) =>
      token.wordIndex === decision.wordIndex &&
      token.normalized === decision.normalized
  );
}

function annotationMatchesDecision(
  annotation: StrongLedgerVerse["annotations"][number],
  decision: ApprovalDecision
): boolean {
  const target = decision.target ?? "word";
  if (target === "word") {
    return (
      annotation.placement === "word" &&
      annotation.wordIndex === decision.wordIndex
    );
  }
  if (target === "phrase") {
    return (
      annotation.placement === "phrase" &&
      annotation.startWordIndex === decision.startWordIndex &&
      annotation.endWordIndex === decision.endWordIndex
    );
  }
  return (
    annotation.placement === "empty" &&
    annotation.insertAfterWordIndex === decision.wordIndex
  );
}

function annotationMatchesReplacement(
  annotation: StrongLedgerVerse["annotations"][number],
  replacement: ApprovalDecision["replace"]
): boolean {
  if (!replacement) return false;
  if (replacement.target === "word") {
    return (
      annotation.placement === "word" &&
      annotation.wordIndex === replacement.wordIndex
    );
  }
  if (replacement.target === "phrase") {
    return (
      annotation.placement === "phrase" &&
      annotation.startWordIndex === replacement.startWordIndex &&
      annotation.endWordIndex === replacement.endWordIndex
    );
  }
  return (
    annotation.placement === "empty" &&
    annotation.insertAfterWordIndex === replacement.wordIndex
  );
}

function currentOverrideFingerprint(bible: string): string {
  return contentFingerprint({
    namespace: "curated-strong-overrides-v1",
    values: curatedOverrideFingerprints(bible, getCuratedStrongOverrides())
  });
}

function sqliteIntegrity(sqlitePath: string): string {
  return execFileSync("sqlite3", [sqlitePath, "pragma integrity_check;"], {
    encoding: "utf8"
  }).trim();
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function assertPlanMatchesBundle(options: {
  plan: ApprovalApplicationPlan;
  planPath: string;
  validated: ValidatedApprovalBundle;
  bible: string;
  ledgerDir: string;
}): void {
  const { plan, validated } = options;
  if (
    plan.version !== 1 ||
    plan.status !== "awaiting-explicit-human-durable-approval" ||
    plan.bible.toLowerCase() !== options.bible.toLowerCase()
  ) {
    throw new Error("approval-application-plan-invalid");
  }
  if (
    plan.bundleFileSha256 !== validated.bundleFileSha256 ||
    plan.decisionPayloadSha256 !== validated.bundle.sha256 ||
    plan.decisionCount !== validated.bundle.decisionCount ||
    plan.sourceDecisionCount !== validated.bundle.sourceDecisionCount ||
    plan.duplicateCount !== validated.bundle.duplicateCount
  ) {
    throw new Error("approval-plan-bundle-mismatch");
  }
  const scopes = buildApprovalApplicationScopes(validated.bundle.decisions);
  if (
    plan.scopeCount !== scopes.length ||
    JSON.stringify(plan.scopes) !== JSON.stringify(scopes)
  ) {
    throw new Error("approval-plan-scope-replay-mismatch");
  }
  const expectedSqlite = strongLedgerSqlitePath(
    options.ledgerDir,
    options.bible
  );
  if (
    path.resolve(plan.canonicalPreflight.sqlitePath) !==
    path.resolve(expectedSqlite)
  ) {
    throw new Error("approval-plan-sqlite-path-mismatch");
  }
}

async function assertInitialCanonicalState(options: {
  plan: ApprovalApplicationPlan;
  bible: string;
  ledgerDir: string;
}): Promise<void> {
  const sqlitePath = strongLedgerSqlitePath(options.ledgerDir, options.bible);
  const metricsPath = path.join(
    options.ledgerDir,
    `bible-${options.bible}-strong-metrics.json`
  );
  if (
    (await fileSha256(sqlitePath)) !==
    options.plan.canonicalPreflight.sqliteFileSha256
  ) {
    throw new Error("approval-plan-sqlite-state-drift");
  }
  if (
    options.plan.canonicalPreflight.metricsSha256 &&
    (await fileSha256(metricsPath)) !==
      options.plan.canonicalPreflight.metricsSha256
  ) {
    throw new Error("approval-plan-metrics-state-drift");
  }
  const ledger = readStrongLedgerSqlite({
    sqlitePath,
    includeVerses: false
  });
  const currentInputFingerprint = strongLedgerInputFingerprint({
    bible: options.bible,
    biblePath: path.join("data", "bibles", `bible-${options.bible}.json`),
    outputDir: options.ledgerDir
  });
  if (
    ledger.metrics.verseCount !== options.plan.canonicalPreflight.verseCount ||
    ledger.overrideFingerprint !==
      options.plan.canonicalPreflight.overrideFingerprint ||
    currentOverrideFingerprint(options.bible) !==
      options.plan.canonicalPreflight.overrideFingerprint
  ) {
    throw new Error("approval-plan-canonical-fingerprint-drift");
  }
  if (
    ledger.inputFingerprint !==
      options.plan.canonicalPreflight.inputFingerprint ||
    currentInputFingerprint !== options.plan.canonicalPreflight.inputFingerprint
  ) {
    throw new Error(
      `approval-plan-input-fingerprint-drift:${options.plan.canonicalPreflight.inputFingerprint ?? "missing"}:${ledger.inputFingerprint ?? "missing"}:${currentInputFingerprint}`
    );
  }
  const integrity = sqliteIntegrity(sqlitePath);
  if (integrity !== "ok") {
    throw new Error(`approval-plan-sqlite-integrity-failed:${integrity}`);
  }
  if (existsSync(DEFAULT_REVIEW_TRANSACTION_MARKER)) {
    throw new Error("approval-plan-active-review-transaction");
  }
}

function approvalRecordId(
  plan: ApprovalApplicationPlan,
  scope: ApprovalApplicationScope
): string {
  return sha256(
    JSON.stringify({
      bible: plan.bible,
      approvedPayloadSha256: plan.decisionPayloadSha256,
      scope: scope.scope,
      scopePayloadSha256: scope.decisionPayloadSha256
    })
  );
}

function readApplicationMetrics(
  metrics: StrongLedgerMetrics
): ApplicationMetrics {
  return {
    verseCount: metrics.verseCount,
    placementRiskCount: metrics.placementRiskCount,
    readerMultiStrongWordCount: metrics.readerMultiStrongWordCount,
    readerOverBudgetStrongCount: metrics.readerOverBudgetStrongCount,
    originalRepresentationRate: metrics.originalRepresentationRate,
    referenceStrongCoverage: metrics.referenceStrongCoverage,
    referenceStrongCarrierCoverage: metrics.referenceStrongCarrierCoverage
  };
}

async function readApprovalLedger(
  filePath: string
): Promise<HumanApprovalRecord[]> {
  if (!existsSync(filePath)) return [];
  const raw = await readJson<unknown>(filePath);
  if (!Array.isArray(raw)) {
    throw new Error("invalid-human-approval-ledger");
  }
  return raw as HumanApprovalRecord[];
}

function upsertApprovalRecord(
  records: HumanApprovalRecord[],
  record: HumanApprovalRecord
): HumanApprovalRecord[] {
  const index = records.findIndex((item) => item.recordId === record.recordId);
  if (index < 0) return [...records, record];
  const next = [...records];
  next[index] = record;
  return next;
}

function scopeResultFromRecord(
  record: HumanApprovalRecord,
  reconciled = false
): AppliedScopeResult {
  if (
    record.phase !== "verified" ||
    !record.verifiedAt ||
    !record.sqliteFileSha256After ||
    !record.metricsFileSha256After
  ) {
    throw new Error(`approval-record-not-verified:${record.recordId}`);
  }
  return {
    ordinal: record.scopeOrdinal,
    scope: record.scope,
    decisionCount: record.decisionCount,
    decisionPayloadSha256: record.decisionPayloadSha256,
    approvalRecordId: record.recordId,
    appliedOverrideCount: record.appliedOverrideCount,
    attemptDir: record.attemptDir,
    sqliteFileSha256After: record.sqliteFileSha256After,
    metricsFileSha256After: record.metricsFileSha256After,
    completedAt: record.verifiedAt,
    reconciled: reconciled || undefined
  };
}

function assertApprovalRecordMatchesScope(options: {
  record: HumanApprovalRecord;
  scope: ApprovalApplicationScope;
  plan: ApprovalApplicationPlan;
  planFileSha256: string;
  bundleFileSha256: string;
}): void {
  if (
    options.record.recordId !== approvalRecordId(options.plan, options.scope) ||
    options.record.bible !== options.plan.bible ||
    options.record.scope !== options.scope.scope ||
    options.record.scopeOrdinal !== options.scope.ordinal ||
    options.record.decisionCount !== options.scope.decisionCount ||
    options.record.decisionPayloadSha256 !==
      options.scope.decisionPayloadSha256 ||
    options.record.approvedPayloadSha256 !==
      options.plan.decisionPayloadSha256 ||
    options.record.planFileSha256 !== options.planFileSha256 ||
    options.record.bundleFileSha256 !== options.bundleFileSha256
  ) {
    throw new Error(`human-approval-record-mismatch:${options.scope.scope}`);
  }
}

async function reconcileManifest(options: {
  manifest: ApprovalApplicationManifest;
  plan: ApprovalApplicationPlan;
  planFileSha256: string;
  bundleFileSha256: string;
  approvalLedgerPath: string;
}): Promise<ApprovalApplicationManifest> {
  const records = await readApprovalLedger(options.approvalLedgerPath);
  const byId = new Map(records.map((record) => [record.recordId, record]));
  const completed = new Map(
    options.manifest.completedScopes.map((result) => [result.ordinal, result])
  );
  for (const scope of options.plan.scopes) {
    const record = byId.get(approvalRecordId(options.plan, scope));
    const existing = completed.get(scope.ordinal);
    if (existing) {
      if (!record || record.phase !== "verified") {
        throw new Error(`manifest-scope-lacks-verified-record:${scope.scope}`);
      }
      assertApprovalRecordMatchesScope({
        record,
        scope,
        plan: options.plan,
        planFileSha256: options.planFileSha256,
        bundleFileSha256: options.bundleFileSha256
      });
      continue;
    }
    if (!record) break;
    if (record.phase !== "verified") {
      throw new Error(`uncommitted-human-approval-record:${scope.scope}`);
    }
    assertApprovalRecordMatchesScope({
      record,
      scope,
      plan: options.plan,
      planFileSha256: options.planFileSha256,
      bundleFileSha256: options.bundleFileSha256
    });
    completed.set(scope.ordinal, scopeResultFromRecord(record, true));
  }
  const completedScopes = [...completed.values()].sort(
    (left, right) => left.ordinal - right.ordinal
  );
  for (let index = 0; index < completedScopes.length; index += 1) {
    if (completedScopes[index]?.ordinal !== index + 1) {
      throw new Error("approval-manifest-noncontiguous-scopes");
    }
  }
  return {
    ...options.manifest,
    status:
      completedScopes.length === options.plan.scopeCount
        ? options.manifest.status === "finalized"
          ? "finalized"
          : "scopes-complete"
        : "in-progress",
    updatedAt: new Date().toISOString(),
    completedScopes
  };
}

async function runNpm(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`npm-command-failed:${code ?? signal}:${args.join(" ")}`)
        );
    });
  });
}

async function refreshScope(bible: string, scope: string): Promise<void> {
  await runNpm([
    "run",
    "strong:refresh",
    "--",
    "--bible",
    bible,
    "--only",
    scope
  ]);
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/gu, "_");
}

async function applyScope(options: {
  applyOptions: ApplyOptions;
  plan: ApprovalApplicationPlan;
  planFileSha256: string;
  validated: ValidatedApprovalBundle;
  manifest: ApprovalApplicationManifest;
  scope: ApprovalApplicationScope;
}): Promise<ApprovalApplicationManifest> {
  return withReviewFileLock(
    async () => {
      if (existsSync(DEFAULT_REVIEW_TRANSACTION_MARKER)) {
        await recoverReviewTransaction({
          refresh: (target) => refreshScope(target.bible, target.scope)
        });
      }
      const decisions = decisionsForScope(
        options.validated.bundle.decisions,
        options.scope.scope
      );
      if (
        decisions.length !== options.scope.decisionCount ||
        sha256(JSON.stringify(decisions)) !==
          options.scope.decisionPayloadSha256
      ) {
        throw new Error(`approval-scope-decision-drift:${options.scope.scope}`);
      }
      const sqlitePath = strongLedgerSqlitePath(
        options.applyOptions.ledgerDir,
        options.applyOptions.bible
      );
      const ledgerBefore = readStrongLedgerSqlite({
        sqlitePath,
        includeVerses: false
      });
      if (
        currentOverrideFingerprint(options.applyOptions.bible) !==
        ledgerBefore.overrideFingerprint
      ) {
        throw new Error("approval-apply-overrides-and-ledger-out-of-sync");
      }
      const beforeMetrics = readApplicationMetrics(ledgerBefore.metrics);
      const beforeVerses = readStrongLedgerVersesSqlite({
        sqlitePath,
        bible: options.applyOptions.bible,
        onlyRef: options.scope.scope
      });
      const duplicatesBefore =
        readerSameTokenIdentityDuplicateCount(beforeVerses);
      const attemptDir = path.join(
        options.applyOptions.outputRoot,
        "scopes",
        `${String(options.scope.ordinal).padStart(3, "0")}-${sanitize(options.scope.scope)}`,
        `attempt-${Date.now()}-${process.pid}`
      );
      await writeJsonFileImmutable(
        path.join(attemptDir, "before-metrics.json"),
        ledgerBefore.metrics
      );
      await writeJsonFileImmutable(
        path.join(attemptDir, "before-scope-verses.json"),
        beforeVerses
      );
      const lexicalBeforeDir = path.join(attemptDir, "lexical-before");
      await runNpm([
        "run",
        "strong:lexical-candidates",
        "--",
        "--bible",
        options.applyOptions.bible,
        "--only",
        options.scope.scope,
        "--output-dir",
        lexicalBeforeDir
      ]);
      const lexicalBeforeReportPath = path.join(
        lexicalBeforeDir,
        `bible-${options.applyOptions.bible}-lexical-candidates-${sanitize(options.scope.scope)}.json`
      );
      const lexicalMetricsBefore = await readLexicalMetricsHeader(
        lexicalBeforeReportPath
      );
      let transaction = await beginReviewTransaction({
        bible: options.applyOptions.bible,
        scope: options.scope.scope,
        files: [
          {
            role: "curated-overrides",
            filePath: options.applyOptions.overridesPath,
            backupPath: path.join(attemptDir, "curated-overrides.before.json")
          },
          {
            role: "decision-ledger",
            filePath: options.applyOptions.approvalLedgerPath,
            backupPath: path.join(attemptDir, "human-approvals.before.json")
          }
        ]
      });
      let committed = false;
      try {
        const currentOverrides = existsSync(options.applyOptions.overridesPath)
          ? await readJson<unknown[]>(options.applyOptions.overridesPath)
          : [];
        if (!Array.isArray(currentOverrides)) {
          throw new Error("invalid-curated-overrides-file");
        }
        const upserted = upsertCuratedStrongOverrides(
          currentOverrides,
          buildHumanApprovedOverrides(
            decisions,
            options.applyOptions.approvedSha256,
            beforeVerses
          )
        );
        await writeJsonFileAtomic(
          options.applyOptions.overridesPath,
          upserted.overrides
        );

        const records = await readApprovalLedger(
          options.applyOptions.approvalLedgerPath
        );
        const recordId = approvalRecordId(options.plan, options.scope);
        const appliedRecord: HumanApprovalRecord = {
          version: 1,
          recordId,
          bible: options.plan.bible,
          scope: options.scope.scope,
          scopeOrdinal: options.scope.ordinal,
          decisionCount: decisions.length,
          decisionPayloadSha256: options.scope.decisionPayloadSha256,
          approvedPayloadSha256: options.plan.decisionPayloadSha256,
          bundleFileSha256: options.validated.bundleFileSha256,
          planFileSha256: options.planFileSha256,
          decisionKeys: decisions.map(approvalDecisionKey),
          phase: "applied",
          appliedOverrideCount: upserted.appliedOverrideCount,
          createdAt: new Date().toISOString(),
          attemptDir
        };
        await writeJsonFileAtomic(
          options.applyOptions.approvalLedgerPath,
          upsertApprovalRecord(records, appliedRecord)
        );
        transaction = await markReviewTransactionPhase(transaction, "applied");

        await refreshScope(options.applyOptions.bible, options.scope.scope);
        transaction = await markReviewTransactionPhase(
          transaction,
          "refreshed"
        );

        const ledgerAfter = readStrongLedgerSqlite({
          sqlitePath,
          includeVerses: false
        });
        const afterMetrics = readApplicationMetrics(ledgerAfter.metrics);
        const afterVerses = readStrongLedgerVersesSqlite({
          sqlitePath,
          bible: options.applyOptions.bible,
          onlyRef: options.scope.scope
        });
        await writeJsonFileImmutable(
          path.join(attemptDir, "after-refresh-metrics.json"),
          ledgerAfter.metrics
        );
        await writeJsonFileImmutable(
          path.join(attemptDir, "after-refresh-scope-verses.json"),
          afterVerses
        );
        const multiStrongRiskAllowance = approvedMultiStrongRiskAllowance({
          decisions,
          beforeVerses,
          afterVerses
        });
        assertApprovalMetricsGates(
          beforeMetrics,
          afterMetrics,
          multiStrongRiskAllowance
        );
        assertApprovedDecisionsVisible(decisions, afterVerses);
        const duplicatesAfter =
          readerSameTokenIdentityDuplicateCount(afterVerses);
        if (duplicatesAfter > duplicatesBefore) {
          throw new Error(
            `same-token-identity-duplication-regression:${duplicatesBefore}->${duplicatesAfter}`
          );
        }
        const integrity = sqliteIntegrity(sqlitePath);
        if (integrity !== "ok") {
          throw new Error(`sqlite-integrity-failed:${integrity}`);
        }
        if (
          currentOverrideFingerprint(options.applyOptions.bible) !==
          ledgerAfter.overrideFingerprint
        ) {
          throw new Error(
            "approval-apply-refreshed-override-fingerprint-mismatch"
          );
        }

        const lexicalDir = path.join(attemptDir, "lexical");
        await runNpm([
          "run",
          "strong:lexical-candidates",
          "--",
          "--bible",
          options.applyOptions.bible,
          "--only",
          options.scope.scope,
          "--output-dir",
          lexicalDir
        ]);
        const lexicalReportPath = path.join(
          lexicalDir,
          `bible-${options.applyOptions.bible}-lexical-candidates-${sanitize(options.scope.scope)}.json`
        );
        const lexicalMetrics =
          await readLexicalMetricsHeader(lexicalReportPath);
        assertNoLexicalAutoSafeRegression(
          lexicalMetricsBefore,
          lexicalMetrics,
          options.scope.scope
        );

        const sqliteFileSha256After = await fileSha256(sqlitePath);
        const metricsPath = path.join(
          options.applyOptions.ledgerDir,
          `bible-${options.applyOptions.bible}-strong-metrics.json`
        );
        const metricsFileSha256After = await fileSha256(metricsPath);
        const verifiedAt = new Date().toISOString();
        const verifiedRecord: HumanApprovalRecord = {
          ...appliedRecord,
          phase: "verified",
          verifiedAt,
          beforeMetrics,
          afterMetrics,
          sameTokenIdentityDuplicatesBefore: duplicatesBefore,
          sameTokenIdentityDuplicatesAfter: duplicatesAfter,
          lexicalReportPath,
          lexicalReportSha256: await fileSha256(lexicalReportPath),
          sqliteFileSha256After,
          metricsFileSha256After
        };
        await writeJsonFileAtomic(
          options.applyOptions.approvalLedgerPath,
          upsertApprovalRecord(records, verifiedRecord)
        );
        await writeJsonFileImmutable(
          path.join(attemptDir, "result.json"),
          verifiedRecord
        );
        await commitReviewTransaction(transaction);
        committed = true;

        const result = scopeResultFromRecord(verifiedRecord);
        const manifest: ApprovalApplicationManifest = {
          ...options.manifest,
          status:
            options.manifest.completedScopes.length + 1 ===
            options.plan.scopeCount
              ? "scopes-complete"
              : "in-progress",
          updatedAt: new Date().toISOString(),
          completedScopes: [...options.manifest.completedScopes, result]
        };
        await writeJsonFileAtomic(
          path.join(options.applyOptions.outputRoot, "manifest.json"),
          manifest
        );
        return manifest;
      } catch (error) {
        if (committed) {
          throw new Error(
            `human-approval-scope-committed-manifest-reconciliation-required:${options.scope.scope}:${errorMessage(error)}`
          );
        }
        try {
          await rollbackReviewTransaction({
            refresh: (target) => refreshScope(target.bible, target.scope)
          });
        } catch (rollbackError) {
          throw new Error(
            `human-approval-scope-failed-and-rollback-failed:${errorMessage(error)}:${errorMessage(rollbackError)}`
          );
        }
        throw new Error(
          `human-approval-scope-failed-rolled-back:${options.scope.scope}:${errorMessage(error)}`
        );
      }
    },
    { timeoutMs: 10 * 60_000, staleAfterMs: 60 * 60_000 }
  );
}

async function finalizeApplication(options: {
  applyOptions: ApplyOptions;
  plan: ApprovalApplicationPlan;
  validated: ValidatedApprovalBundle;
  manifest: ApprovalApplicationManifest;
  baselineMetrics: ApplicationMetrics;
}): Promise<ApprovalApplicationManifest> {
  await runNpm([
    "run",
    "strong:generate",
    "--",
    "--bible",
    options.applyOptions.bible
  ]);
  const sqlitePath = strongLedgerSqlitePath(
    options.applyOptions.ledgerDir,
    options.applyOptions.bible
  );
  const ledger = readStrongLedgerSqlite({ sqlitePath, includeVerses: false });
  if (
    currentOverrideFingerprint(options.applyOptions.bible) !==
    ledger.overrideFingerprint
  ) {
    throw new Error("final-override-fingerprint-mismatch");
  }
  const finalVerses = readStrongLedgerVersesSqlite({
    sqlitePath,
    bible: options.applyOptions.bible
  });
  const finalMultiStrongRiskAllowance = approvedMultiStrongRiskAllowance({
    decisions: options.validated.bundle.decisions,
    beforeVerses: [],
    afterVerses: finalVerses,
    auditEveryNewCarrier: false
  });
  assertApprovalMetricsGates(
    options.baselineMetrics,
    readApplicationMetrics(ledger.metrics),
    finalMultiStrongRiskAllowance
  );
  const approvalRecords = await readApprovalLedger(
    options.applyOptions.approvalLedgerPath
  );
  const recordsById = new Map(
    approvalRecords.map((record) => [record.recordId, record])
  );
  for (const scope of options.plan.scopes) {
    const verses = readStrongLedgerVersesSqlite({
      sqlitePath,
      bible: options.applyOptions.bible,
      onlyRef: scope.scope
    });
    assertApprovedDecisionsVisible(
      decisionsForScope(options.validated.bundle.decisions, scope.scope),
      verses
    );
    const record = recordsById.get(approvalRecordId(options.plan, scope));
    if (!record || record.phase !== "verified") {
      throw new Error(`final-missing-verified-approval-record:${scope.scope}`);
    }
    const duplicateCount = readerSameTokenIdentityDuplicateCount(verses);
    if (
      record.sameTokenIdentityDuplicatesAfter !== undefined &&
      duplicateCount > record.sameTokenIdentityDuplicatesAfter
    ) {
      throw new Error(
        `final-same-token-identity-duplication-regression:${scope.scope}:${record.sameTokenIdentityDuplicatesAfter}->${duplicateCount}`
      );
    }
  }
  const integrity = sqliteIntegrity(sqlitePath);
  if (integrity !== "ok") {
    throw new Error(`final-sqlite-integrity-failed:${integrity}`);
  }
  const lexicalReportPath = path.join(
    "outputs",
    "lexical-candidates",
    options.applyOptions.bible,
    `bible-${options.applyOptions.bible}-lexical-candidates-all.json`
  );
  const lexicalMetrics = await readLexicalMetricsHeader(lexicalReportPath);
  if (
    lexicalMetrics.autoSafeCandidates !== 0 ||
    lexicalMetrics.autoSafeItems !== 0 ||
    lexicalMetrics.groupAutoSafeItems !== 0
  ) {
    throw new Error("final-residual-lexical-auto-safe");
  }
  await runNpm([
    "run",
    "strong:export",
    "--",
    "--bible",
    options.applyOptions.bible,
    "--view",
    "reader"
  ]);
  await runNpm([
    "run",
    "strong:export",
    "--",
    "--bible",
    options.applyOptions.bible,
    "--view",
    "advanced"
  ]);
  const metricsPath = path.join(
    options.applyOptions.ledgerDir,
    `bible-${options.applyOptions.bible}-strong-metrics.json`
  );
  const manifest: ApprovalApplicationManifest = {
    ...options.manifest,
    status: "finalized",
    updatedAt: new Date().toISOString(),
    finalization: {
      completedAt: new Date().toISOString(),
      sqliteFileSha256: await fileSha256(sqlitePath),
      metricsFileSha256: await fileSha256(metricsPath),
      lexicalReportSha256: await fileSha256(lexicalReportPath)
    }
  };
  await writeJsonFileAtomic(
    path.join(options.applyOptions.outputRoot, "manifest.json"),
    manifest
  );
  return manifest;
}

async function runApplication(options: {
  applyOptions: ApplyOptions;
  plan: ApprovalApplicationPlan;
  planFileSha256: string;
  validated: ValidatedApprovalBundle;
}): Promise<ApprovalApplicationManifest> {
  const manifestPath = path.join(
    options.applyOptions.outputRoot,
    "manifest.json"
  );
  const baselineMetricsPath = path.join(
    options.applyOptions.outputRoot,
    "baseline-metrics.json"
  );
  let manifest = await withReviewFileLock(
    async () => {
      if (existsSync(DEFAULT_REVIEW_TRANSACTION_MARKER)) {
        await recoverReviewTransaction({
          refresh: (target) => refreshScope(target.bible, target.scope)
        });
      }
      let current: ApprovalApplicationManifest;
      if (existsSync(manifestPath)) {
        current = await readJson<ApprovalApplicationManifest>(manifestPath);
        if (
          current.version !== 1 ||
          current.bible !== options.plan.bible ||
          current.planFileSha256 !== options.planFileSha256 ||
          current.bundleFileSha256 !== options.validated.bundleFileSha256 ||
          current.decisionPayloadSha256 !== options.plan.decisionPayloadSha256
        ) {
          throw new Error("approval-application-manifest-mismatch");
        }
      } else {
        await assertInitialCanonicalState({
          plan: options.plan,
          bible: options.applyOptions.bible,
          ledgerDir: options.applyOptions.ledgerDir
        });
        const sqlitePath = strongLedgerSqlitePath(
          options.applyOptions.ledgerDir,
          options.applyOptions.bible
        );
        const ledger = readStrongLedgerSqlite({
          sqlitePath,
          includeVerses: false
        });
        await writeJsonFileImmutable(baselineMetricsPath, ledger.metrics);
        const now = new Date().toISOString();
        current = {
          version: 1,
          bible: options.plan.bible,
          status: "in-progress",
          createdAt: now,
          updatedAt: now,
          bundlePath: options.applyOptions.bundlePath,
          bundleFileSha256: options.validated.bundleFileSha256,
          planPath: options.applyOptions.planPath,
          planFileSha256: options.planFileSha256,
          decisionPayloadSha256: options.plan.decisionPayloadSha256,
          decisionCount: options.plan.decisionCount,
          scopeCount: options.plan.scopeCount,
          completedScopes: []
        };
      }
      const reconciled = await reconcileManifest({
        manifest: current,
        plan: options.plan,
        planFileSha256: options.planFileSha256,
        bundleFileSha256: options.validated.bundleFileSha256,
        approvalLedgerPath: options.applyOptions.approvalLedgerPath
      });
      await writeJsonFileAtomic(manifestPath, reconciled);
      return reconciled;
    },
    { timeoutMs: 10 * 60_000, staleAfterMs: 60 * 60_000 }
  );

  const completedOrdinals = new Set(
    manifest.completedScopes.map((scope) => scope.ordinal)
  );
  const pending = options.plan.scopes.filter(
    (scope) => !completedOrdinals.has(scope.ordinal)
  );
  const selected = options.applyOptions.maxScopes
    ? pending.slice(0, options.applyOptions.maxScopes)
    : pending;
  for (const scope of selected) {
    manifest = await applyScope({
      applyOptions: options.applyOptions,
      plan: options.plan,
      planFileSha256: options.planFileSha256,
      validated: options.validated,
      manifest,
      scope
    });
  }

  if (
    options.applyOptions.finalize &&
    manifest.completedScopes.length === options.plan.scopeCount &&
    manifest.status !== "finalized"
  ) {
    const baseline = await readJson<StrongLedgerMetrics>(baselineMetricsPath);
    manifest = await finalizeApplication({
      applyOptions: options.applyOptions,
      plan: options.plan,
      validated: options.validated,
      manifest,
      baselineMetrics: readApplicationMetrics(baseline)
    });
  }
  return manifest;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing-argument:${name}`);
  return value;
}

function optionalArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positiveIntegerArg(name: string): number | undefined {
  const raw = optionalArg(name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`invalid-positive-integer:${name}:${raw}`);
  }
  return value;
}

async function main(): Promise<void> {
  const bible = requiredArg("--bible").toLowerCase();
  const planPath = requiredArg("--plan");
  const planRaw = await readFile(planPath, "utf8");
  const plan = JSON.parse(planRaw) as ApprovalApplicationPlan;
  const bundlePath = optionalArg("--bundle") ?? plan.bundlePath;
  const apply = process.argv.includes("--apply");
  const approvedSha256 = optionalArg("--approved-sha256");
  if (apply && !approvedSha256) {
    throw new Error("apply-requires-explicit-approved-sha256");
  }
  const validated = await validateApprovalBundle({
    bundlePath,
    bible,
    approvedSha256: apply ? approvedSha256 : undefined
  });
  const ledgerDir =
    optionalArg("--ledger-dir") ?? path.join("outputs", "strong", bible);
  assertPlanMatchesBundle({
    plan,
    planPath,
    validated,
    bible,
    ledgerDir
  });
  const planFileSha256 = sha256(planRaw);

  if (!apply) {
    await assertInitialCanonicalState({ plan, bible, ledgerDir });
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "verified-awaiting-explicit-human-durable-approval",
          bible,
          planPath: path.resolve(planPath),
          planFileSha256,
          bundlePath: path.resolve(bundlePath),
          bundleFileSha256: validated.bundleFileSha256,
          decisionPayloadSha256: plan.decisionPayloadSha256,
          decisionCount: plan.decisionCount,
          scopeCount: plan.scopeCount,
          canonicalPreflight: plan.canonicalPreflight,
          appliedOverrideCount: 0
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const outputRoot =
    optionalArg("--output-root") ??
    path.join(path.dirname(planPath), "human-approval-application");
  const applyOptions: ApplyOptions = {
    bible,
    bundlePath,
    planPath,
    outputRoot,
    ledgerDir,
    overridesPath:
      optionalArg("--overrides") ?? "data/curated-strong-overrides.json",
    approvalLedgerPath:
      optionalArg("--approval-ledger") ??
      "data/strong-review-human-approvals.json",
    approvedSha256: approvedSha256 as string,
    maxScopes: positiveIntegerArg("--max-scopes"),
    finalize: process.argv.includes("--finalize")
  };
  const manifest = await runApplication({
    applyOptions,
    plan,
    planFileSha256,
    validated
  });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("semanticRefillApprovedApply.ts")) {
  await main();
}
