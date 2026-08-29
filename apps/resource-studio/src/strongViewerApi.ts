import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  auditCuratedStrongOverrides,
  type OverrideAuditItem,
  type OverrideAuditReport
} from "./auditCuratedStrongOverrides.js";
import { BOOK_IDS } from "./books.js";
import {
  getCuratedStrongOverrides,
  type CuratedStrongOverride
} from "./curatedStrongOverrides.js";
import type {
  StrongLedgerBookMetrics,
  StrongLedgerMetrics,
  StrongLedgerVerse
} from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import type { StrongReviewDecisionRecord } from "./semanticRefillAgentReview.js";
import { consensusModelIdentities } from "./strongReviewDecisionReuse.js";

const DEFAULT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const BIBLE_ID = /^[a-z][a-z0-9_-]{0,31}$/u;
const STRONG_ID = /^[GH]\d{4,5}[A-Z]?$/u;
const DECISION_STAGES = new Set([
  "model-validation",
  "consensus-validation",
  "post-consensus-filter"
]);
const DECISION_STATUSES = new Set([
  "validated",
  "pending",
  "rejected",
  "accepted-safe",
  "needs-witness-review",
  "rejected-risky"
]);
const DECISION_KINDS = new Set([
  "word",
  "phrase",
  "empty",
  "technical",
  "duplicate",
  "not-rendered",
  "pending-human",
  "reject"
]);
const BOOK_ORDER = new Map<string, number>(
  BOOK_IDS.map((bookId, index) => [bookId, index])
);
const REVIEW_BUCKETS = [
  "actionable",
  "needs-witness-review",
  "accepted-safe",
  "drifted",
  "planned",
  "quarantined"
] as const;

export type StrongReviewBucket = (typeof REVIEW_BUCKETS)[number];
export type StrongReviewPriorityTier = "p0" | "p1" | "p2" | "p3";

export interface StrongViewerMetadataBook {
  bookId: string;
  chapters: number[];
  verseCount: number;
  metrics: StrongLedgerBookMetrics;
}

export interface StrongViewerMetadata {
  bible: string;
  generatedAt: string;
  scope: string;
  metrics: StrongLedgerMetrics;
  books: StrongViewerMetadataBook[];
}

export interface StrongViewerVerses {
  bible: string;
  generatedAt: string;
  verses: StrongLedgerVerse[];
}

export interface StrongReviewSummary {
  generatedAt: string;
  bible: string;
  production: {
    eligible: number;
    consensusFiltered: number;
  };
  quarantine: {
    total: number;
    legacySingleModel: number;
    unverifiedSemanticRefill: number;
  };
  drift: {
    invalidProduction: number;
    invalidTotal: number;
  };
  decisions: {
    total: number;
    uniqueCandidates: number;
    acceptedSafe: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
  plan: {
    available: boolean;
    tasks: number;
    items: number;
    models: string[];
    adaptiveSecondModel: boolean;
    generatedAt?: string;
  };
}

export interface StrongReviewItem {
  id: string;
  kind: string;
  ref: string;
  strong: string[];
  status: string;
  productionState: string;
  target?: string;
  source?: string;
  reason: string;
  confidence?: number;
  model?: string;
  models?: string[];
  stage?: string;
  exactWitnessFamilies?: string[];
  directDeterministicSupport?: boolean;
  evidence?: string[];
  priority: {
    tier: StrongReviewPriorityTier;
    score: number;
    reasons: string[];
  };
  taskId?: string;
}

export interface StrongReviewItemsPage {
  generatedAt: string;
  bible: string;
  bucket: StrongReviewBucket;
  total: number;
  limit: number;
  offset: number;
  items: StrongReviewItem[];
}

interface StrongViewerOptions {
  root?: string;
  bible: string;
}

interface StrongReviewOptions extends StrongViewerOptions {
  auditReport?: OverrideAuditReport;
  curatedOverrides?: CuratedStrongOverride[];
}

interface StrongReviewItemsOptions extends StrongReviewOptions {
  bucket: StrongReviewBucket;
  q?: string;
  limit?: number;
  offset?: number;
}

interface PlanTask {
  id: string;
  itemIds: string[];
}

interface ReviewPlan {
  generatedAt: string;
  bible: string;
  policy: {
    models: string[];
    adaptiveSecondModel: boolean;
  };
  totals: { tasks: number };
  tasks: PlanTask[];
}

interface ReviewState {
  audit: OverrideAuditReport;
  decisions: StrongReviewDecisionRecord[];
  latestDecisions: Map<string, DeduplicatedDecision>;
  productionOverrides: CuratedStrongOverride[];
  plan?: ReviewPlan;
}

interface DeduplicatedDecision {
  record: StrongReviewDecisionRecord;
  conflictStatuses: string[];
  historyConflictReasons: string[];
}

interface ProductionApplicationJoin {
  applied: boolean;
  reasons: string[];
}

export class StrongViewerApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string
  ) {
    super(code);
  }
}

export function isStrongReviewBucket(
  value: string | null
): value is StrongReviewBucket {
  return REVIEW_BUCKETS.includes(value as StrongReviewBucket);
}

export function parseStrictInteger(
  value: string | null,
  options: { name: string; min: number; max: number; fallback?: number }
): number {
  if (value === null && options.fallback !== undefined) return options.fallback;
  if (value === null || !/^\d+$/u.test(value)) {
    throw new StrongViewerApiError(400, `invalid-${options.name}`);
  }
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < options.min ||
    parsed > options.max
  ) {
    throw new StrongViewerApiError(400, `invalid-${options.name}`);
  }
  return parsed;
}

export function validateBibleId(bible: string | null): string {
  if (!bible || !BIBLE_ID.test(bible)) {
    throw new StrongViewerApiError(400, "invalid-bible");
  }
  return bible;
}

export function validateBookId(book: string | null): string {
  if (!book || !BOOK_IDS.includes(book as (typeof BOOK_IDS)[number])) {
    throw new StrongViewerApiError(400, "invalid-book");
  }
  return book;
}

export function getStrongViewerMetadata(
  options: StrongViewerOptions
): StrongViewerMetadata {
  const root = options.root ?? DEFAULT_ROOT;
  const bible = validateBibleId(options.bible);
  const sqlitePath = canonicalLedgerPath(root, bible);
  const ledger = readStrongLedgerSqlite({
    sqlitePath,
    includeVerses: false
  });
  assertLedgerBible(ledger.bible, bible);

  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const rows = db
      .prepare(
        `select book_id, chapter, count(*) as verse_count, min(book_order) as book_order
         from verses
         where bible = ?
         group by book_id, chapter
         order by book_order, chapter`
      )
      .all(bible) as Array<{
      book_id: string;
      chapter: number;
      verse_count: number;
      book_order: number;
    }>;
    const books = new Map<string, { chapters: number[]; verseCount: number }>();
    for (const row of rows) {
      const current = books.get(row.book_id) ?? {
        chapters: [],
        verseCount: 0
      };
      current.chapters.push(row.chapter);
      current.verseCount += row.verse_count;
      books.set(row.book_id, current);
    }

    return {
      bible,
      generatedAt: ledger.generatedAt,
      scope: ledger.scope,
      metrics: ledger.metrics,
      books: [...books].map(([bookId, summary]) => {
        const metrics = ledger.metrics.books[bookId];
        if (!metrics) {
          throw new StrongViewerApiError(
            500,
            `strong-ledger-book-metrics-missing:${bookId}`
          );
        }
        return { bookId, ...summary, metrics };
      })
    };
  } finally {
    db.close();
  }
}

export function getStrongViewerVerses(options: {
  root?: string;
  bible: string;
  book: string;
  chapter: number;
}): StrongViewerVerses {
  const root = options.root ?? DEFAULT_ROOT;
  const bible = validateBibleId(options.bible);
  const book = validateBookId(options.book);
  if (
    !Number.isSafeInteger(options.chapter) ||
    options.chapter < 1 ||
    options.chapter > 999
  ) {
    throw new StrongViewerApiError(400, "invalid-chapter");
  }
  const sqlitePath = canonicalLedgerPath(root, bible);
  const ledger = readStrongLedgerSqlite({
    sqlitePath,
    includeVerses: false
  });
  assertLedgerBible(ledger.bible, bible);
  const verses = readStrongLedgerVersesSqlite({
    sqlitePath,
    bible,
    onlyRef: `${book}.${options.chapter}`
  });
  return { bible, generatedAt: ledger.generatedAt, verses };
}

export async function getStrongReviewSummary(
  options: StrongReviewOptions
): Promise<StrongReviewSummary> {
  const bible = validateBibleId(options.bible);
  const state = await loadReviewState({ ...options, bible });
  const latest = [...state.latestDecisions.values()].map(
    ({ record }) => record
  );
  const planItems = new Set(
    state.plan?.tasks.flatMap((task) => task.itemIds) ?? []
  );

  return {
    generatedAt: new Date().toISOString(),
    bible,
    production: {
      eligible: state.audit.productionEligible,
      consensusFiltered:
        state.audit.bySource["semantic-refill:llm-consensus-filtered"] ?? 0
    },
    quarantine: {
      total:
        state.audit.legacySingleModelAuto +
        state.audit.unverifiedSemanticRefill,
      legacySingleModel: state.audit.legacySingleModelAuto,
      unverifiedSemanticRefill: state.audit.unverifiedSemanticRefill
    },
    drift: {
      invalidProduction: state.audit.invalidProductionTarget,
      invalidTotal: state.audit.invalidTarget
    },
    decisions: {
      total: state.decisions.length,
      uniqueCandidates: state.latestDecisions.size,
      acceptedSafe: latest.filter((item) => item.status === "accepted-safe")
        .length,
      needsWitnessReview: latest.filter(
        (item) => item.status === "needs-witness-review"
      ).length,
      rejectedRisky: latest.filter((item) => item.status === "rejected-risky")
        .length
    },
    plan: state.plan
      ? {
          available: true,
          tasks: state.plan.tasks.length,
          items: planItems.size,
          models: state.plan.policy.models,
          adaptiveSecondModel: state.plan.policy.adaptiveSecondModel,
          generatedAt: state.plan.generatedAt
        }
      : {
          available: false,
          tasks: 0,
          items: 0,
          models: [],
          adaptiveSecondModel: false
        }
  };
}

export async function getStrongReviewItems(
  options: StrongReviewItemsOptions
): Promise<StrongReviewItemsPage> {
  const bible = validateBibleId(options.bible);
  if (!isStrongReviewBucket(options.bucket)) {
    throw new StrongViewerApiError(400, "invalid-bucket");
  }
  const q = (options.q ?? "").trim();
  if (q.length > 200) {
    throw new StrongViewerApiError(400, "invalid-q");
  }
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new StrongViewerApiError(400, "invalid-limit");
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new StrongViewerApiError(400, "invalid-offset");
  }

  const state = await loadReviewState({ ...options, bible });
  const items = itemsForBucket(state, options.bucket)
    .filter((item) => reviewItemMatches(item, q))
    .sort(compareReviewItems);

  return {
    generatedAt: new Date().toISOString(),
    bible,
    bucket: options.bucket,
    total: items.length,
    limit,
    offset,
    items: items.slice(offset, offset + limit)
  };
}

function canonicalLedgerPath(root: string, bible: string): string {
  const outputDir = path.resolve(root, "outputs", "strong", bible);
  const sqlitePath = strongLedgerSqlitePath(outputDir, bible);
  if (!sqlitePath.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new StrongViewerApiError(400, "invalid-bible");
  }
  if (!existsSync(sqlitePath)) {
    throw new StrongViewerApiError(404, "strong-ledger-not-found");
  }
  return sqlitePath;
}

function assertLedgerBible(actual: string, requested: string): void {
  if (actual !== requested) {
    throw new StrongViewerApiError(409, "strong-ledger-bible-mismatch");
  }
}

async function loadReviewState(
  options: StrongReviewOptions
): Promise<ReviewState> {
  const root = options.root ?? DEFAULT_ROOT;
  const audit =
    options.auditReport ??
    (await auditCuratedStrongOverrides({ bible: options.bible }));
  const decisions = await readDecisionLedger(root, options.bible);
  return {
    audit,
    decisions,
    latestDecisions: deduplicateDecisions(decisions),
    productionOverrides: (
      options.curatedOverrides ??
      getCuratedStrongOverrides({ includeLegacySingleModelAuto: true })
    ).filter(
      (override) =>
        override.bible === options.bible &&
        override.source === "semantic-refill:llm-consensus-filtered"
    ),
    plan: await readLatestPlan(root, options.bible)
  };
}

async function readDecisionLedger(
  root: string,
  bible: string
): Promise<StrongReviewDecisionRecord[]> {
  const ledgerPath = path.join(root, "data", "strong-review-decisions.json");
  if (!existsSync(ledgerPath)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(ledgerPath, "utf8")) as unknown;
  } catch {
    throw new StrongViewerApiError(500, "invalid-strong-review-decisions");
  }
  if (!Array.isArray(raw) || !raw.every(isDecisionRecord)) {
    throw new StrongViewerApiError(500, "invalid-strong-review-decisions");
  }
  return raw.filter((record) => record.bible === bible);
}

function isDecisionRecord(value: unknown): value is StrongReviewDecisionRecord {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.recordId) &&
    isNonEmptyString(value.bible) &&
    BIBLE_ID.test(value.bible) &&
    isNonEmptyString(value.candidateId) &&
    isNonEmptyString(value.choiceId) &&
    isValidRef(value.ref) &&
    isNonEmptyString(value.decision) &&
    DECISION_KINDS.has(value.decision) &&
    Array.isArray(value.strong) &&
    value.strong.length > 0 &&
    value.strong.every(
      (item) => typeof item === "string" && STRONG_ID.test(item)
    ) &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    isNonEmptyString(value.stage) &&
    DECISION_STAGES.has(value.stage) &&
    isNonEmptyString(value.status) &&
    DECISION_STATUSES.has(value.status) &&
    isNonEmptyString(value.reason) &&
    Array.isArray(value.evidence) &&
    value.evidence.every((item) => typeof item === "string") &&
    isNonEmptyString(value.sourceReview) &&
    isNonEmptyString(value.createdAt) &&
    Number.isFinite(Date.parse(value.createdAt))
  );
}

function deduplicateDecisions(
  decisions: StrongReviewDecisionRecord[]
): Map<string, DeduplicatedDecision> {
  const histories = new Map<string, StrongReviewDecisionRecord[]>();
  decisions.forEach((record) => {
    const history = histories.get(record.candidateId) ?? [];
    history.push(record);
    histories.set(record.candidateId, history);
  });

  return new Map(
    [...histories].map(([candidateId, history]) => {
      const record = history.reduce((latest, candidate) =>
        decisionIsNewer(candidate, latest) ? candidate : latest
      );
      return [
        candidateId,
        {
          record,
          conflictStatuses: [...new Set(history.map((item) => item.status))]
            .filter((status) => status !== record.status)
            .sort(),
          historyConflictReasons:
            new Set(history.map(decisionTargetSignature)).size > 1
              ? ["decision-history-target-conflict"]
              : []
        }
      ];
    })
  );
}

function decisionIsNewer(
  candidate: StrongReviewDecisionRecord,
  current: StrongReviewDecisionRecord
): boolean {
  const candidateTime = Date.parse(candidate.createdAt);
  const currentTime = Date.parse(current.createdAt);
  if (Number.isFinite(candidateTime) && Number.isFinite(currentTime)) {
    if (candidateTime !== currentTime) return candidateTime > currentTime;
  }
  return candidate.recordId.localeCompare(current.recordId) > 0;
}

async function readLatestPlan(
  root: string,
  bible: string
): Promise<ReviewPlan | undefined> {
  const planRoot = path.join(root, "outputs", "gap-review", bible);
  if (!existsSync(planRoot)) return undefined;
  const planPaths = await findPlanPaths(planRoot);
  if (planPaths.length === 0) return undefined;

  const plans = await Promise.all(
    planPaths.map(async (planPath) => {
      let value: unknown;
      try {
        value = JSON.parse(await readFile(planPath, "utf8")) as unknown;
      } catch {
        throw new StrongViewerApiError(500, "invalid-strong-review-plan");
      }
      if (!isReviewPlan(value) || value.bible !== bible) {
        throw new StrongViewerApiError(500, "invalid-strong-review-plan");
      }
      return value;
    })
  );
  return plans.sort((left, right) => {
    const dateOrder =
      Date.parse(right.generatedAt) - Date.parse(left.generatedAt);
    return dateOrder || right.generatedAt.localeCompare(left.generatedAt);
  })[0];
}

async function findPlanPaths(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    if (entry.isSymbolicLink()) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findPlanPaths(entryPath)));
    } else if (entry.isFile() && entry.name === "plan.json") {
      results.push(entryPath);
    }
  }
  return results;
}

function isReviewPlan(value: unknown): value is ReviewPlan {
  if (!isObject(value) || !isObject(value.policy) || !isObject(value.totals)) {
    return false;
  }
  return (
    typeof value.generatedAt === "string" &&
    Number.isFinite(Date.parse(value.generatedAt)) &&
    typeof value.bible === "string" &&
    Array.isArray(value.policy.models) &&
    value.policy.models.every((model) => typeof model === "string") &&
    typeof value.policy.adaptiveSecondModel === "boolean" &&
    Number.isSafeInteger(value.totals.tasks) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(
      (task) =>
        isObject(task) &&
        typeof task.id === "string" &&
        Array.isArray(task.itemIds) &&
        task.itemIds.every((itemId) => typeof itemId === "string")
    ) &&
    value.totals.tasks === value.tasks.length
  );
}

function itemsForBucket(
  state: ReviewState,
  bucket: StrongReviewBucket
): StrongReviewItem[] {
  if (bucket === "planned") return plannedItems(state.plan);

  const auditItems = state.audit.items.map(auditItemToReviewItem);
  const applicationJoins = productionApplicationJoins(
    state.latestDecisions,
    state.productionOverrides
  );
  const decisionItems = [...state.latestDecisions.values()].map((decision) =>
    decisionToReviewItem(
      decision,
      applicationJoins.get(decision.record.candidateId)
    )
  );
  if (bucket === "actionable") {
    return [
      ...auditItems.filter(
        (item) =>
          item.priority.tier === "p0" &&
          item.productionState === "drifted-production"
      ),
      ...decisionItems.filter((item) => item.status === "needs-witness-review")
    ];
  }
  if (bucket === "needs-witness-review") {
    return decisionItems.filter(
      (item) => item.status === "needs-witness-review"
    );
  }
  if (bucket === "accepted-safe") {
    return decisionItems.filter((item) => item.status === "accepted-safe");
  }
  if (bucket === "drifted") {
    return auditItems.filter((item) => item.status === "invalid-target");
  }
  return auditItems.filter((item) => item.productionState === "quarantined");
}

function auditItemToReviewItem(item: OverrideAuditItem): StrongReviewItem {
  const quarantined =
    item.legacySingleModelAuto || item.unverifiedSemanticRefill;
  const invalidProduction = !item.targetValid && !quarantined;
  const itemPriority = invalidProduction
    ? priority("p0", 100, ["invalid-production-target"])
    : priority(
        "p3",
        item.targetValid ? 10 : 15,
        item.targetValid
          ? ["quarantined-not-actionable"]
          : ["quarantined-target-drift-not-actionable"]
      );
  return {
    id: overrideItemId(item),
    kind: "override",
    ref: item.ref,
    strong: item.strong,
    status: item.targetValid ? "quarantined" : "invalid-target",
    productionState: quarantined
      ? "quarantined"
      : invalidProduction
        ? "drifted-production"
        : "production-eligible",
    target: item.target,
    source: item.source,
    reason: item.reason,
    priority: itemPriority
  };
}

function decisionToReviewItem(
  value: DeduplicatedDecision,
  applicationJoin?: ProductionApplicationJoin
): StrongReviewItem {
  const { record, conflictStatuses, historyConflictReasons } = value;
  const conflictEvidence = [
    ...(conflictStatuses.length
      ? [`decision-history-conflict:${conflictStatuses.join(",")}`]
      : []),
    ...historyConflictReasons,
    ...(applicationJoin?.reasons ?? []).map(
      (reason) => `production-join:${reason}`
    )
  ];
  const models = record.model
    ? consensusModelIdentities(record.model)
    : undefined;
  const itemPriority =
    record.status === "needs-witness-review"
      ? priority("p1", 80, ["needs-witness-review"])
      : priority("p3", record.status === "accepted-safe" ? 20 : 5, [
          record.status === "accepted-safe"
            ? "accepted-safe-not-actionable"
            : "terminal-or-intermediate-decision"
        ]);
  return {
    id: record.candidateId,
    kind: record.decision,
    ref: record.ref,
    strong: record.strong,
    status: record.status,
    productionState:
      record.status === "accepted-safe"
        ? applicationJoin?.applied
          ? "applied-production"
          : "accepted-safe-not-applied"
        : record.status === "needs-witness-review"
          ? "pending-review"
          : record.status === "rejected-risky"
            ? "rejected"
            : "intermediate",
    target: record.choiceId,
    source: record.sourceReview,
    reason: record.reason,
    confidence: record.confidence,
    model: record.model,
    models,
    stage: record.stage,
    exactWitnessFamilies: record.exactWitnessFamilies,
    directDeterministicSupport: record.directDeterministicSupport,
    evidence: [...record.evidence, ...conflictEvidence],
    priority: itemPriority
  };
}

function plannedItems(plan: ReviewPlan | undefined): StrongReviewItem[] {
  if (!plan) return [];
  const byId = new Map<string, StrongReviewItem>();
  for (const task of plan.tasks) {
    for (const id of task.itemIds) {
      if (byId.has(id)) continue;
      const parsed = parsePlannedItemId(id);
      byId.set(id, {
        id,
        kind: parsed.kind,
        ref: parsed.ref,
        strong: parsed.strong,
        status: "planned",
        productionState: "not-applied",
        target: parsed.kind,
        source: "semantic-refill-batch-plan",
        reason: "Scheduled for bounded deterministic and two-model review.",
        models: plan.policy.models,
        priority: priority("p2", 50, ["planned-bounded-review"]),
        taskId: task.id
      });
    }
  }
  return [...byId.values()];
}

function parsePlannedItemId(id: string): {
  ref: string;
  strong: string[];
  kind: string;
} {
  const parts = id.split("|");
  if (parts.length < 4) {
    throw new StrongViewerApiError(500, "invalid-strong-review-plan-item");
  }
  const ref = parts[0];
  const kind = parts.at(-2);
  const strong = parts.at(-1);
  const strongIds = strong?.split(",").filter(Boolean) ?? [];
  if (
    !isValidRef(ref) ||
    (kind !== "empty" && kind !== "relocation") ||
    strongIds.length === 0 ||
    !strongIds.every((item) => STRONG_ID.test(item))
  ) {
    throw new StrongViewerApiError(500, "invalid-strong-review-plan-item");
  }
  return { ref, kind, strong: strongIds };
}

function reviewItemMatches(item: StrongReviewItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.id,
    item.kind,
    item.ref,
    ...item.strong,
    item.status,
    item.productionState,
    item.target,
    item.source,
    item.reason,
    item.model,
    ...(item.models ?? []),
    ...(item.evidence ?? []),
    ...(item.priority.reasons ?? []),
    item.taskId
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("fr");
  return query
    .toLocaleLowerCase("fr")
    .split(/\s+/u)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function productionApplicationJoins(
  decisions: Map<string, DeduplicatedDecision>,
  productionOverrides: CuratedStrongOverride[]
): Map<string, ProductionApplicationJoin> {
  const result = new Map<string, ProductionApplicationJoin>();
  const preliminary = new Map<string, number>();

  for (const [candidateId, decision] of decisions) {
    if (decision.record.status !== "accepted-safe") continue;
    const reasons = [
      ...(decision.conflictStatuses.length > 0
        ? ["conflicting-decision-status-history"]
        : []),
      ...decision.historyConflictReasons
    ];
    const raw = decision.record.rawDecision;
    if (!rawDecisionProvesRecordTarget(decision.record)) {
      reasons.push("missing-or-invalid-exact-raw-target-proof");
    }
    const matches = raw
      ? productionOverrides.flatMap((override, index) =>
          overrideExactlyMatchesRawDecision(override, decision.record, raw)
            ? [index]
            : []
        )
      : [];
    if (matches.length === 0) reasons.push("exact-production-override-missing");
    if (matches.length > 1) {
      reasons.push("ambiguous-duplicate-production-overrides");
    }
    if (reasons.length === 0 && matches.length === 1) {
      preliminary.set(candidateId, matches[0]!);
    }
    result.set(candidateId, { applied: false, reasons });
  }

  const candidatesByOverride = new Map<number, string[]>();
  for (const [candidateId, overrideIndex] of preliminary) {
    const candidates = candidatesByOverride.get(overrideIndex) ?? [];
    candidates.push(candidateId);
    candidatesByOverride.set(overrideIndex, candidates);
  }
  for (const [candidateId, overrideIndex] of preliminary) {
    const join = result.get(candidateId)!;
    if ((candidatesByOverride.get(overrideIndex)?.length ?? 0) > 1) {
      join.reasons.push("ambiguous-multiple-decisions-for-production-override");
      continue;
    }
    join.applied = true;
    join.reasons.push("exact-current-production-override");
  }
  return result;
}

function rawDecisionProvesRecordTarget(
  record: StrongReviewDecisionRecord
): boolean {
  const raw = record.rawDecision;
  if (!raw) return false;
  if (
    raw.id !== record.candidateId ||
    raw.choiceId !== record.choiceId ||
    raw.ref !== record.ref ||
    raw.decision !== record.decision ||
    !sameStrings(raw.strong, record.strong)
  ) {
    return false;
  }
  if (raw.decision === "word") {
    return (
      Number.isInteger(raw.wordIndex) && typeof raw.normalized === "string"
    );
  }
  if (raw.decision === "phrase") {
    return (
      Number.isInteger(raw.startWordIndex) &&
      Number.isInteger(raw.endWordIndex) &&
      Array.isArray(raw.normalizedPhrase) &&
      raw.normalizedPhrase.length > 0 &&
      raw.normalizedPhrase.every((item) => typeof item === "string")
    );
  }
  if (raw.decision === "empty") {
    return Number.isInteger(raw.wordIndex) && raw.normalized === null;
  }
  return false;
}

function overrideExactlyMatchesRawDecision(
  override: CuratedStrongOverride,
  record: StrongReviewDecisionRecord,
  raw: NonNullable<StrongReviewDecisionRecord["rawDecision"]>
): boolean {
  if (
    override.source !== "semantic-refill:llm-consensus-filtered" ||
    override.bible !== record.bible ||
    override.ref !== record.ref ||
    raw.ref !== record.ref ||
    !sameStrings(override.strong, record.strong) ||
    !sameStrings(raw.strong, record.strong)
  ) {
    return false;
  }
  const target = override.target ?? "word";
  if (raw.decision !== target) return false;
  if (target === "word") {
    return (
      raw.wordIndex === override.wordIndex &&
      raw.normalized === override.normalized
    );
  }
  if (target === "phrase") {
    return (
      raw.startWordIndex === (override.startWordIndex ?? override.wordIndex) &&
      raw.endWordIndex === (override.endWordIndex ?? override.wordIndex) &&
      Array.isArray(raw.normalizedPhrase) &&
      sameStrings(raw.normalizedPhrase, override.normalizedPhrase ?? []) &&
      override.normalized === raw.normalizedPhrase.join(" ")
    );
  }
  return (
    raw.wordIndex === override.wordIndex &&
    raw.normalized === null &&
    override.normalized === ""
  );
}

function decisionTargetSignature(record: StrongReviewDecisionRecord): string {
  const raw = record.rawDecision;
  return JSON.stringify({
    status: record.status,
    choiceId: record.choiceId,
    decision: record.decision,
    strong: record.strong,
    rawTarget: raw
      ? {
          id: raw.id,
          choiceId: raw.choiceId,
          ref: raw.ref,
          decision: raw.decision,
          strong: raw.strong,
          wordIndex: raw.wordIndex,
          normalized: raw.normalized,
          startWordIndex: raw.startWordIndex,
          endWordIndex: raw.endWordIndex,
          normalizedPhrase: raw.normalizedPhrase
        }
      : null
  });
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function compareReviewItems(
  left: StrongReviewItem,
  right: StrongReviewItem
): number {
  return (
    right.priority.score - left.priority.score ||
    compareRefs(left.ref, right.ref) ||
    left.id.localeCompare(right.id)
  );
}

function compareRefs(left: string, right: string): number {
  const leftRef = parseRef(left);
  const rightRef = parseRef(right);
  return (
    (BOOK_ORDER.get(leftRef.bookId) ?? 999) -
      (BOOK_ORDER.get(rightRef.bookId) ?? 999) ||
    leftRef.chapter - rightRef.chapter ||
    leftRef.verse - rightRef.verse ||
    left.localeCompare(right)
  );
}

function parseRef(ref: string): {
  bookId: string;
  chapter: number;
  verse: number;
} {
  const [bookId = "", rawChapter = "0", rawVerse = "0"] = ref.split(".");
  return {
    bookId,
    chapter: Number.parseInt(rawChapter, 10) || 0,
    verse: Number.parseInt(rawVerse, 10) || 0
  };
}

function priority(
  tier: StrongReviewPriorityTier,
  score: number,
  reasons: string[]
): StrongReviewItem["priority"] {
  return { tier, score, reasons };
}

function overrideItemId(item: OverrideAuditItem): string {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        item.bible,
        item.ref,
        item.source,
        item.strong,
        item.target,
        item.reason
      ])
    )
    .digest("hex")
    .slice(0, 20);
  return `override:${fingerprint}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const [bookId, rawChapter, rawVerse, ...rest] = value.split(".");
  return (
    rest.length === 0 &&
    BOOK_IDS.includes(bookId as (typeof BOOK_IDS)[number]) &&
    /^[1-9]\d{0,2}$/u.test(rawChapter ?? "") &&
    /^[1-9]\d{0,2}$/u.test(rawVerse ?? "")
  );
}
