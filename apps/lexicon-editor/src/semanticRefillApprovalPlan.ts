import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { BOOK_IDS } from "./books.js";
import { contentFingerprint } from "./contentAddressedCache.js";
import { getCuratedStrongOverrides } from "./curatedStrongOverrides.js";
import { writeJsonFileImmutable } from "./immutableFile.js";
import {
  approvalDecisionKey,
  dedupeApprovalDecisions,
  type ApprovalDecision
} from "./semanticRefillApprovalBundle.js";
import {
  curatedOverrideFingerprints,
  strongLedgerInputFingerprint
} from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";

interface ApprovalSource {
  label: string;
  path: string;
  sha256: string;
  decisionCount: number;
}

interface ApprovalDuplicate {
  key: string;
  keptSource: string;
  skippedSource: string;
}

interface ApprovalBundle {
  generatedAt: string;
  bible: string;
  status: string;
  internalOnly: boolean;
  aiGatewayCalls: number;
  sourceDecisionCount: number;
  decisionCount: number;
  duplicateCount: number;
  sources: ApprovalSource[];
  duplicates: ApprovalDuplicate[];
  sha256: string;
  decisions: ApprovalDecision[];
}

export interface ValidatedApprovalBundle {
  bundle: ApprovalBundle;
  bundlePath: string;
  bundleFileSha256: string;
}

export interface ApprovalApplicationScope {
  ordinal: number;
  scope: string;
  decisionCount: number;
  refs: string[];
  decisionPayloadSha256: string;
  status: "pending-explicit-approval";
}

export interface ApprovalApplicationPlan {
  version: 1;
  generatedAt: string;
  bible: string;
  status: "awaiting-explicit-human-durable-approval";
  bundlePath: string;
  bundleFileSha256: string;
  decisionPayloadSha256: string;
  sourceDecisionCount: number;
  decisionCount: number;
  duplicateCount: number;
  scopeCount: number;
  scopes: ApprovalApplicationScope[];
  canonicalPreflight: {
    sqlitePath: string;
    sqliteFileSha256: string;
    sqliteIntegrity: "ok";
    verseCount: number;
    metricsSha256?: string;
    inputFingerprint?: string;
    overrideFingerprint?: string;
  };
  requiredApplicationGates: string[];
}

const BOOK_ORDER = new Map<string, number>(
  BOOK_IDS.map((book, index) => [book, index])
);

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function extractDecisions(value: unknown): ApprovalDecision[] {
  const decisions = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { decisions?: unknown }).decisions)
      ? (value as { decisions: unknown[] }).decisions
      : undefined;
  if (!decisions) throw new Error("approval-source-missing-decisions");
  return decisions.map((decision, index) =>
    parseApprovalDecision(decision, `source-decision:${index}`)
  );
}

function parseApprovalDecision(
  value: unknown,
  location: string
): ApprovalDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid-approval-decision:${location}`);
  }
  const decision = value as Partial<ApprovalDecision>;
  const target = decision.target ?? "word";
  if (
    typeof decision.bible !== "string" ||
    typeof decision.ref !== "string" ||
    !/^[1-3]?[A-Za-z]+\.\d+\.\d+$/u.test(decision.ref) ||
    !Array.isArray(decision.strong) ||
    decision.strong.length === 0 ||
    !decision.strong.every(
      (strong) =>
        typeof strong === "string" && /^[GH]\d{4}[A-Za-z]*$/u.test(strong)
    ) ||
    !["word", "empty", "phrase"].includes(target) ||
    !Number.isInteger(decision.wordIndex) ||
    typeof decision.normalized !== "string" ||
    typeof decision.confidence !== "number" ||
    !Number.isFinite(decision.confidence) ||
    decision.confidence < 0 ||
    decision.confidence > 1 ||
    typeof decision.source !== "string" ||
    typeof decision.reason !== "string"
  ) {
    throw new Error(`invalid-approval-decision:${location}`);
  }
  if (
    target === "phrase" &&
    (!Number.isInteger(decision.startWordIndex) ||
      !Number.isInteger(decision.endWordIndex) ||
      !Array.isArray(decision.normalizedPhrase) ||
      !decision.normalizedPhrase.every((item) => typeof item === "string"))
  ) {
    throw new Error(`invalid-approval-phrase:${location}`);
  }
  return decision as ApprovalDecision;
}

function parseBundle(value: unknown): ApprovalBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid-approval-bundle");
  }
  const bundle = value as Partial<ApprovalBundle>;
  if (
    typeof bundle.generatedAt !== "string" ||
    typeof bundle.bible !== "string" ||
    typeof bundle.status !== "string" ||
    typeof bundle.internalOnly !== "boolean" ||
    typeof bundle.aiGatewayCalls !== "number" ||
    !Number.isInteger(bundle.sourceDecisionCount) ||
    !Number.isInteger(bundle.decisionCount) ||
    !Number.isInteger(bundle.duplicateCount) ||
    !Array.isArray(bundle.sources) ||
    !Array.isArray(bundle.duplicates) ||
    typeof bundle.sha256 !== "string" ||
    !Array.isArray(bundle.decisions)
  ) {
    throw new Error("invalid-approval-bundle");
  }
  return {
    ...(bundle as ApprovalBundle),
    decisions: bundle.decisions.map((decision, index) =>
      parseApprovalDecision(decision, `bundle-decision:${index}`)
    )
  };
}

export async function validateApprovalBundle(options: {
  bundlePath: string;
  bible: string;
  approvedSha256?: string;
}): Promise<ValidatedApprovalBundle> {
  const bundleRaw = await readFile(options.bundlePath, "utf8");
  const bundle = parseBundle(JSON.parse(bundleRaw));
  const bible = options.bible.toLowerCase();
  if (bundle.bible.toLowerCase() !== bible) {
    throw new Error(`approval-bible-mismatch:${bible}:${bundle.bible}`);
  }
  if (bundle.status !== "awaiting-explicit-human-durable-approval") {
    throw new Error(`approval-bundle-status-invalid:${bundle.status}`);
  }
  if (!bundle.internalOnly || bundle.aiGatewayCalls !== 0) {
    throw new Error("approval-bundle-not-internal-only");
  }
  if (
    bundle.decisions.some((decision) => decision.bible.toLowerCase() !== bible)
  ) {
    throw new Error("approval-decision-bible-mismatch");
  }

  const payloadSha256 = sha256(JSON.stringify(bundle.decisions));
  if (payloadSha256 !== bundle.sha256) {
    throw new Error(
      `approval-payload-hash-mismatch:${bundle.sha256}:${payloadSha256}`
    );
  }
  if (
    options.approvedSha256 !== undefined &&
    options.approvedSha256 !== payloadSha256
  ) {
    throw new Error(
      `explicit-approval-hash-mismatch:${options.approvedSha256}:${payloadSha256}`
    );
  }
  if (bundle.decisionCount !== bundle.decisions.length) {
    throw new Error("approval-decision-count-mismatch");
  }

  const labels = new Set<string>();
  const groups: Array<{ label: string; decisions: ApprovalDecision[] }> = [];
  let sourceDecisionCount = 0;
  for (const source of bundle.sources) {
    if (
      !source ||
      typeof source.label !== "string" ||
      typeof source.path !== "string" ||
      typeof source.sha256 !== "string" ||
      !Number.isInteger(source.decisionCount)
    ) {
      throw new Error("invalid-approval-source");
    }
    if (labels.has(source.label)) {
      throw new Error(`duplicate-approval-source-label:${source.label}`);
    }
    labels.add(source.label);
    const raw = await readFile(source.path, "utf8");
    if (sha256(raw) !== source.sha256) {
      throw new Error(`approval-source-hash-mismatch:${source.label}`);
    }
    const decisions = extractDecisions(JSON.parse(raw));
    if (decisions.length !== source.decisionCount) {
      throw new Error(`approval-source-count-mismatch:${source.label}`);
    }
    sourceDecisionCount += decisions.length;
    groups.push({ label: source.label, decisions });
  }
  if (sourceDecisionCount !== bundle.sourceDecisionCount) {
    throw new Error("approval-source-decision-count-mismatch");
  }

  const rebuilt = dedupeApprovalDecisions(groups);
  if (JSON.stringify(rebuilt.decisions) !== JSON.stringify(bundle.decisions)) {
    throw new Error("approval-bundle-decisions-do-not-replay");
  }
  if (
    JSON.stringify(rebuilt.duplicates) !== JSON.stringify(bundle.duplicates)
  ) {
    throw new Error("approval-bundle-duplicates-do-not-replay");
  }
  if (
    rebuilt.duplicates.length !== bundle.duplicateCount ||
    sourceDecisionCount - rebuilt.decisions.length !== bundle.duplicateCount
  ) {
    throw new Error("approval-duplicate-count-mismatch");
  }
  const keys = bundle.decisions.map(approvalDecisionKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error("approval-bundle-retains-duplicate-decisions");
  }

  return {
    bundle,
    bundlePath: options.bundlePath,
    bundleFileSha256: sha256(bundleRaw)
  };
}

export function buildApprovalApplicationScopes(
  decisions: ApprovalDecision[]
): ApprovalApplicationScope[] {
  const byScope = new Map<string, ApprovalDecision[]>();
  for (const decision of decisions) {
    const [book, chapter] = decision.ref.split(".");
    if (!book || !chapter)
      throw new Error(`invalid-approval-ref:${decision.ref}`);
    const scope = `${book}.${chapter}`;
    const group = byScope.get(scope) ?? [];
    group.push(decision);
    byScope.set(scope, group);
  }
  return [...byScope.entries()]
    .sort(([left], [right]) => compareScopes(left, right))
    .map(([scope, group], index) => ({
      ordinal: index + 1,
      scope,
      decisionCount: group.length,
      refs: [...new Set(group.map((decision) => decision.ref))].sort(
        compareRefsWithinBook
      ),
      decisionPayloadSha256: sha256(JSON.stringify(group)),
      status: "pending-explicit-approval"
    }));
}

function compareScopes(left: string, right: string): number {
  const [leftBook = "", leftChapter = "0"] = left.split(".");
  const [rightBook = "", rightChapter = "0"] = right.split(".");
  return (
    (BOOK_ORDER.get(leftBook) ?? Number.MAX_SAFE_INTEGER) -
      (BOOK_ORDER.get(rightBook) ?? Number.MAX_SAFE_INTEGER) ||
    Number(leftChapter) - Number(rightChapter) ||
    left.localeCompare(right)
  );
}

function compareRefsWithinBook(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  return (
    Number(leftParts[1]) - Number(rightParts[1]) ||
    Number(leftParts[2]) - Number(rightParts[2]) ||
    left.localeCompare(right)
  );
}

export async function buildApprovalApplicationPlan(options: {
  validated: ValidatedApprovalBundle;
  ledgerDir: string;
}): Promise<ApprovalApplicationPlan> {
  const { bundle, bundlePath, bundleFileSha256 } = options.validated;
  const sqlitePath = strongLedgerSqlitePath(options.ledgerDir, bundle.bible);
  const sqliteIntegrity = execFileSync(
    "sqlite3",
    [sqlitePath, "pragma integrity_check;"],
    { encoding: "utf8" }
  ).trim();
  if (sqliteIntegrity !== "ok") {
    throw new Error(`approval-plan-sqlite-integrity-failed:${sqliteIntegrity}`);
  }
  const ledger = readStrongLedgerSqlite({
    sqlitePath,
    includeVerses: false
  });
  if (ledger.bible.toLowerCase() !== bundle.bible.toLowerCase()) {
    throw new Error(`approval-plan-ledger-bible-mismatch:${ledger.bible}`);
  }
  const currentInputFingerprint = strongLedgerInputFingerprint({
    bible: bundle.bible,
    biblePath: path.join("data", "bibles", `bible-${bundle.bible}.json`),
    outputDir: options.ledgerDir
  });
  if (currentInputFingerprint !== ledger.inputFingerprint) {
    throw new Error(
      `approval-plan-input-fingerprint-drift:${ledger.inputFingerprint ?? "missing"}:${currentInputFingerprint}`
    );
  }
  const currentOverrideFingerprint = contentFingerprint({
    namespace: "curated-strong-overrides-v1",
    values: curatedOverrideFingerprints(
      bundle.bible,
      getCuratedStrongOverrides()
    )
  });
  if (currentOverrideFingerprint !== ledger.overrideFingerprint) {
    throw new Error(
      `approval-plan-override-fingerprint-drift:${ledger.overrideFingerprint ?? "missing"}:${currentOverrideFingerprint}`
    );
  }
  const metricsPath = path.join(
    options.ledgerDir,
    `bible-${bundle.bible}-strong-metrics.json`
  );
  const metricsRaw = existsSync(metricsPath)
    ? await readFile(metricsPath, "utf8")
    : undefined;
  const scopes = buildApprovalApplicationScopes(bundle.decisions);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    bible: bundle.bible,
    status: "awaiting-explicit-human-durable-approval",
    bundlePath,
    bundleFileSha256,
    decisionPayloadSha256: bundle.sha256,
    sourceDecisionCount: bundle.sourceDecisionCount,
    decisionCount: bundle.decisionCount,
    duplicateCount: bundle.duplicateCount,
    scopeCount: scopes.length,
    scopes,
    canonicalPreflight: {
      sqlitePath,
      sqliteFileSha256: await fileSha256(sqlitePath),
      sqliteIntegrity: "ok",
      verseCount: ledger.metrics.verseCount,
      metricsSha256: metricsRaw ? sha256(metricsRaw) : undefined,
      inputFingerprint: ledger.inputFingerprint,
      overrideFingerprint: ledger.overrideFingerprint
    },
    requiredApplicationGates: [
      "exact explicit approval of decisionPayloadSha256",
      "source and bundle hashes replay before every application/resume",
      "one locked transaction and immutable backups per chapter scope",
      "exact scoped refresh with rollback on failure",
      "unchanged verse count and SQLite integrity ok",
      "no placementRiskCount increase",
      "no original representation or reference coverage decrease",
      "no new same-token identity duplication",
      "no residual lexical auto-safe item",
      "complete ledger regeneration and global validation before publication"
    ]
  };
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

async function main(): Promise<void> {
  const bible = requiredArg("--bible").toLowerCase();
  const outputPath = requiredArg("--output");
  if (existsSync(outputPath)) {
    throw new Error(`approval-plan-already-exists:${outputPath}`);
  }
  const validated = await validateApprovalBundle({
    bundlePath: requiredArg("--bundle"),
    bible
  });
  const plan = await buildApprovalApplicationPlan({
    validated,
    ledgerDir:
      optionalArg("--ledger-dir") ?? path.join("outputs", "strong", bible)
  });
  await writeJsonFileImmutable(outputPath, plan);
  process.stdout.write(
    `${JSON.stringify(
      {
        output: path.resolve(outputPath),
        bible: plan.bible,
        status: plan.status,
        decisionPayloadSha256: plan.decisionPayloadSha256,
        decisionCount: plan.decisionCount,
        scopeCount: plan.scopeCount,
        canonicalPreflight: plan.canonicalPreflight
      },
      null,
      2
    )}\n`
  );
}

if (process.argv[1]?.endsWith("semanticRefillApprovalPlan.ts")) {
  await main();
}
