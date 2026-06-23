import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type CuratedStrongOverride } from "./curatedStrongOverrides.js";
import {
  type EnrichedStrongBible,
  type EnrichedVerse
} from "./enrichedStrongBible.js";
import {
  buildSemanticRefillLlmBatch,
  evaluateSemanticRefillLlmDecisions,
  SEMANTIC_REFILL_LLM_DECISION_TYPES,
  type SemanticRefillLlmDecisionType,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";
import { type SemanticRefillAuditItem } from "./semanticRefill.js";

interface AgentReviewFile {
  bible?: string;
  books?: string[];
  decisions?: unknown[];
}

interface AgentReviewResult {
  input: string;
  outputDir: string;
  bible: string;
  books: string[];
  rawDecisionCount: number;
  validatedCount: number;
  pendingCount: number;
  rejectedCount: number;
}

async function validateAgentReview(options: {
  inputPath: string;
  outputDir: string;
  bible: string;
  candidatesPath: string;
  enrichedDir: string;
  overridesPath: string;
  apply: boolean;
}): Promise<AgentReviewResult> {
  const review = JSON.parse(
    await readFile(options.inputPath, "utf8")
  ) as AgentReviewFile;
  const rawDecisions = normalizeRawDecisions(review.decisions ?? []);
  const books = inferBooks(review.books, rawDecisions);
  const candidates = (
    JSON.parse(
      await readFile(options.candidatesPath, "utf8")
    ) as SemanticRefillAuditItem[]
  ).filter((candidate) => books.includes(candidate.ref.split(".")[0] ?? ""));
  const patchedRaw = patchUnknownIds({
    bible: options.bible,
    candidates,
    rawDecisions
  });
  const verses = await readBookVerses(options.enrichedDir, books);
  const batch = buildSemanticRefillLlmBatch({
    bible: options.bible,
    scope: books.join(","),
    candidates,
    verses
  });
  const evaluated = evaluateSemanticRefillLlmDecisions({
    bible: options.bible,
    verses,
    batch,
    rawDecisions: patchedRaw
  });

  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeJson(
      path.join(options.outputDir, "accepted.json"),
      evaluated.validated
    ),
    writeJson(path.join(options.outputDir, "pending.json"), evaluated.pending),
    writeJson(path.join(options.outputDir, "rejected.json"), evaluated.rejected)
  ]);

  if (options.apply && evaluated.validated.length > 0) {
    await appendOverrides(options.overridesPath, evaluated.validated);
  }

  return {
    input: options.inputPath,
    outputDir: options.outputDir,
    bible: options.bible,
    books,
    rawDecisionCount: rawDecisions.length,
    validatedCount: evaluated.validated.length,
    pendingCount: evaluated.pending.length,
    rejectedCount: evaluated.rejected.length
  };
}

function inferBooks(
  rawBooks: unknown,
  decisions: SemanticRefillLlmRawDecision[]
): string[] {
  const explicitBooks = Array.isArray(rawBooks)
    ? rawBooks.filter(
        (book): book is string => typeof book === "string" && book.length > 0
      )
    : [];
  if (explicitBooks.length > 0) return [...new Set(explicitBooks)];

  return [
    ...new Set(
      decisions
        .map((decision) => decision.ref.split(".")[0])
        .filter((book): book is string => !!book)
    )
  ];
}

function normalizeRawDecisions(
  value: unknown[]
): SemanticRefillLlmRawDecision[] {
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object"
    )
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      ref: typeof item.ref === "string" ? item.ref : "",
      decision: readDecisionType(item.decision),
      strong: Array.isArray(item.strong)
        ? item.strong.filter(
            (strong): strong is string => typeof strong === "string"
          )
        : [],
      confidence: typeof item.confidence === "number" ? item.confidence : 0,
      reason: typeof item.reason === "string" ? item.reason : "",
      wordIndex: Number.isInteger(item.wordIndex)
        ? (item.wordIndex as number)
        : null,
      normalized: typeof item.normalized === "string" ? item.normalized : null,
      startWordIndex: Number.isInteger(item.startWordIndex)
        ? (item.startWordIndex as number)
        : null,
      endWordIndex: Number.isInteger(item.endWordIndex)
        ? (item.endWordIndex as number)
        : null,
      normalizedPhrase: Array.isArray(item.normalizedPhrase)
        ? item.normalizedPhrase.filter(
            (token): token is string => typeof token === "string"
          )
        : null,
      evidence: Array.isArray(item.evidence)
        ? item.evidence.filter(
            (entry): entry is string => typeof entry === "string"
          )
        : []
    }));
}

function readDecisionType(value: unknown): SemanticRefillLlmDecisionType {
  return SEMANTIC_REFILL_LLM_DECISION_TYPES.includes(
    value as SemanticRefillLlmDecisionType
  )
    ? (value as SemanticRefillLlmDecisionType)
    : "pending-human";
}

function patchUnknownIds(options: {
  bible: string;
  candidates: SemanticRefillAuditItem[];
  rawDecisions: SemanticRefillLlmRawDecision[];
}): SemanticRefillLlmRawDecision[] {
  const batch = buildSemanticRefillLlmBatch({
    bible: options.bible,
    scope: "agent-review",
    candidates: options.candidates
  });
  const byId = new Map(
    batch.candidates.map((candidate) => [candidate.id, candidate])
  );

  return options.rawDecisions.map((raw) => {
    if (byId.has(raw.id)) return raw;
    const matching = batch.candidates.filter(
      (candidate) =>
        candidate.ref === raw.ref &&
        raw.strong.some((strong) => strong.toUpperCase() === candidate.strong)
    );
    if (matching.length !== 1) return raw;
    return { ...raw, id: matching[0]?.id ?? raw.id };
  });
}

async function readBookVerses(
  enrichedDir: string,
  books: string[]
): Promise<EnrichedVerse[]> {
  const canonicalPath = path.join(
    enrichedDir,
    "bible-nbs-strong-enriched.json"
  );
  const canonical = JSON.parse(
    await readFile(canonicalPath, "utf8")
  ) as EnrichedStrongBible;

  if (!canonical.split) {
    return canonical.verses.filter((verse) => books.includes(verse.bookId));
  }

  const files = (canonical.verseFiles ?? []).filter((file) =>
    books.includes(file.bookId)
  );
  return (
    await Promise.all(
      files.map(async (file) => {
        const content = await readFile(file.path, "utf8");
        return JSON.parse(content) as EnrichedVerse[];
      })
    )
  ).flat();
}

async function appendOverrides(
  overridesPath: string,
  decisions: CuratedStrongOverride[]
): Promise<void> {
  const current = existsSync(overridesPath)
    ? (JSON.parse(await readFile(overridesPath, "utf8")) as unknown)
    : [];
  const overrides = Array.isArray(current) ? current : [];
  const existing = new Set(overrides.map((override) => overrideKey(override)));
  const additions = decisions
    .map(stripDecisionFields)
    .filter((override) => !existing.has(overrideKey(override)));

  if (additions.length === 0) return;
  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeJson(overridesPath, [...overrides, ...additions]);
}

function stripDecisionFields(
  value: CuratedStrongOverride
): CuratedStrongOverride {
  const clone = { ...value } as CuratedStrongOverride & Record<string, unknown>;
  delete clone.status;
  delete clone.score;
  delete clone.priority;
  delete clone.evidence;
  return clone;
}

function overrideKey(value: unknown): string {
  const item = value as Partial<CuratedStrongOverride>;
  return [
    item.bible,
    item.ref,
    item.target ?? "word",
    item.wordIndex,
    item.startWordIndex ?? "",
    item.endWordIndex ?? "",
    item.normalized,
    (item.strong ?? []).join(",")
  ].join("|");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function readStringArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: string
): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = readStringArg(
    args,
    "input",
    "outputs/semantic-refill/nbs/agent-review/agent-review.json"
  );
  const outputDir = readStringArg(
    args,
    "output-dir",
    path.join(path.dirname(inputPath), "validated")
  );
  const result = await validateAgentReview({
    inputPath,
    outputDir,
    bible: readStringArg(args, "bible", "nbs"),
    candidatesPath: readStringArg(
      args,
      "candidates",
      "outputs/semantic-refill/nbs/post-lexicon-v2-final/semantic-refill-candidates.json"
    ),
    enrichedDir: readStringArg(args, "enriched-dir", "outputs/enriched/nbs"),
    overridesPath: readStringArg(
      args,
      "overrides",
      "data/curated-strong-overrides.json"
    ),
    apply: args.get("apply") === true
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith("semanticRefillAgentReview.ts")) {
  await main();
}
