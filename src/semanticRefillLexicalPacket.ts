import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildSemanticRefillLlmBatch,
  SEMANTIC_REFILL_LLM_SYSTEM_PROMPT,
  type SemanticRefillLlmCandidatePacket
} from "./semanticRefillLlm.js";
import {
  type LexicalCandidate,
  type LexicalCandidateItem,
  type LexicalCandidateReport
} from "./lexicalCandidateReport.js";
import {
  type StrongLedgerAnnotation,
  type StrongLedgerVerse
} from "./strongLedger.js";
import {
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import {
  type RefillPriority,
  type SemanticRefillAuditItem,
  type SemanticRefillCandidate
} from "./semanticRefill.js";

type CandidateConfidence = LexicalCandidate["confidence"];

interface LexicalAgentPacketFile {
  generatedAt: string;
  bible: string;
  scope: string;
  sourceLexicalReport: string;
  instructions: string;
  promptPolicy: string;
  filters: {
    minConfidence: CandidateConfidence;
    includeOccupied: boolean;
    allowDuplicateTargets: boolean;
    auditKind: "all" | "empty" | "relocation";
    offset: number;
    limit?: number;
  };
  summary: {
    lexicalItems: number;
    selectedItems: number;
    verses: number;
    candidates: number;
    highConfidenceItems: number;
    mediumConfidenceItems: number;
    openItems: number;
    relocationItems: number;
    topStrong: Array<[string, number]>;
  };
  verses: Array<{
    ref: string;
    text: string;
    tokens: StrongLedgerVerse["tokens"];
  }>;
  candidates: SemanticRefillLlmCandidatePacket[];
}

export async function buildLexicalAgentPacket(options: {
  bible: string;
  scope: string;
  lexicalReportPath: string;
  ledgerDir: string;
  outputPath: string;
  offset?: number;
  limit?: number;
  minConfidence: CandidateConfidence;
  includeOccupied: boolean;
  allowDuplicateTargets: boolean;
  auditKind: "all" | "empty" | "relocation";
}): Promise<LexicalAgentPacketFile> {
  const report = JSON.parse(
    await readFile(options.lexicalReportPath, "utf8")
  ) as LexicalCandidateReport;
  const verses = await readVerses(
    options.ledgerDir,
    options.bible,
    options.scope
  );
  const versesByRef = new Map(verses.map((verse) => [verse.ref, verse]));
  const lexicalItems = report.items.filter((item) =>
    refInScope(item.ref, options.scope)
  );
  const ranked = lexicalItems
    .map((item) =>
      lexicalItemToAuditItem({
        bible: options.bible,
        item,
        verse: versesByRef.get(item.ref),
        minConfidence: options.minConfidence,
        includeOccupied: options.includeOccupied,
        auditKind: options.auditKind
      })
    )
    .filter((item): item is SemanticRefillAuditItem => !!item)
    .sort(compareAuditItems);
  const deduplicated = options.allowDuplicateTargets
    ? ranked
    : uniqueByBestTarget(ranked);
  const selected = slicePacketItems(
    deduplicated,
    options.offset ?? 0,
    options.limit
  );

  const batch = buildSemanticRefillLlmBatch({
    bible: options.bible,
    scope: options.scope,
    candidates: selected,
    verses
  });
  const candidateRefs = new Set(
    batch.candidates.map((candidate) => candidate.ref)
  );
  const packetVerses = verses.filter((verse) => candidateRefs.has(verse.ref));

  const packet: LexicalAgentPacketFile = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    scope: options.scope,
    sourceLexicalReport: options.lexicalReportPath,
    instructions: [
      "Semantic lexical agent packet.",
      "These candidates come from lexical-candidate reports, not the function-low gap queue.",
      "Use deterministicCandidates as evidence, but still validate the French carrier against the verse context.",
      "Prefer word/phrase only when the visible French carrier is reliable; use empty when the lexical evidence is too weak."
    ].join(" "),
    promptPolicy: SEMANTIC_REFILL_LLM_SYSTEM_PROMPT,
    filters: {
      minConfidence: options.minConfidence,
      includeOccupied: options.includeOccupied,
      allowDuplicateTargets: options.allowDuplicateTargets,
      auditKind: options.auditKind,
      offset: options.offset ?? 0,
      limit: options.limit
    },
    summary: {
      lexicalItems: lexicalItems.length,
      selectedItems: selected.length,
      verses: packetVerses.length,
      candidates: batch.candidates.length,
      highConfidenceItems: selected.filter(
        (item) => item.priority === "semantic-high"
      ).length,
      mediumConfidenceItems: selected.filter(
        (item) => item.priority === "semantic-medium"
      ).length,
      openItems: selected.filter((item) =>
        item.candidates.some(
          (candidate) => !candidate.evidence.includes("occupied-target")
        )
      ).length,
      relocationItems: selected.filter(
        (item) => item.auditKind === "relocation"
      ).length,
      topStrong: topStrong(selected.map((item) => item.strong))
    },
    verses: packetVerses.map((verse) => ({
      ref: verse.ref,
      text: verse.text,
      tokens: verse.tokens
    })),
    candidates: batch.candidates
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(packet, null, 2)}\n`,
    "utf8"
  );
  return packet;
}

function lexicalItemToAuditItem(options: {
  bible: string;
  item: LexicalCandidateItem;
  verse?: StrongLedgerVerse;
  minConfidence: CandidateConfidence;
  includeOccupied: boolean;
  auditKind: "all" | "empty" | "relocation";
}): SemanticRefillAuditItem | undefined {
  if (!options.verse) return undefined;
  if (
    options.auditKind !== "all" &&
    options.item.auditKind !== options.auditKind
  ) {
    return undefined;
  }

  const currentCandidates = options.item.candidates.map((candidate) =>
    recomputeLexicalCandidateOccupation(candidate, options.verse!)
  );
  const candidates = currentCandidates
    .filter(
      (candidate) =>
        confidenceRank(candidate.confidence) >=
        confidenceRank(options.minConfidence)
    )
    .filter((candidate) => options.includeOccupied || !candidate.occupied)
    .map((candidate) => lexicalCandidateToSemantic(candidate, options.item))
    .sort(
      (left, right) =>
        right.score - left.score ||
        candidateTargetKey(
          options.item.ref,
          options.item.strong,
          left
        ).localeCompare(
          candidateTargetKey(options.item.ref, options.item.strong, right)
        )
    );
  if (candidates.length === 0) return undefined;

  const annotation = findAnnotation(options.verse, options.item);
  const bestConfidence = candidates[0]?.score ?? 0;
  const priority = priorityForConfidence(
    currentCandidates.find(
      (candidate) => candidate.score === candidates[0]?.score
    )?.confidence ?? options.minConfidence
  );

  return {
    bible: options.bible,
    ref: options.item.ref,
    text: options.item.text,
    tokens: options.verse.tokens,
    auditKind:
      options.item.auditKind === "relocation" ? "relocation" : "missing",
    annotation: {
      id: annotation?.id ?? options.item.annotationId,
      strong: options.item.strong.toUpperCase(),
      visibility: annotation?.visibility ?? "advanced",
      placement:
        annotation?.placement ??
        (options.item.auditKind === "relocation" ? "word" : "empty"),
      insertAfterWordIndex:
        annotation?.insertAfterWordIndex ?? options.item.insertAfterWordIndex,
      confidence: annotation?.confidence ?? bestConfidence,
      source: annotation?.source ?? "semantic-lexicon",
      diagnostics: annotation?.diagnostics ?? ["lexical-candidate-packet"],
      referenceSupport: annotation?.referenceSupport ?? []
    },
    strong: options.item.strong.toUpperCase(),
    currentPlacement:
      annotation?.placement ??
      (options.item.auditKind === "relocation" ? "word" : "empty"),
    currentTarget: annotation
      ? annotationTarget(annotation)
      : lexicalCurrentTarget(options.item),
    referenceSupport: annotation?.referenceSupport ?? [],
    originalInventory: options.verse.inventories.original.map((strong) =>
      strong.toUpperCase()
    ),
    referenceInventory: Object.fromEntries(
      Object.entries(options.verse.inventories.references).map(
        ([name, strong]) => [name, strong.map((code) => code.toUpperCase())]
      )
    ),
    candidateForms: candidates.map((candidate) =>
      candidate.target === "phrase"
        ? (candidate.normalizedPhrase ?? [])
        : [candidate.normalizedWord ?? candidate.normalizedPhrase?.[0] ?? ""]
    ),
    candidates,
    priority,
    eligible: true,
    reason: `lexical-candidate:${options.item.auditKind}:${options.minConfidence}-or-better`
  };
}

export function recomputeLexicalCandidateOccupation(
  candidate: LexicalCandidate,
  verse: StrongLedgerVerse
): LexicalCandidate {
  const start = candidate.startWordIndex ?? candidate.wordIndex;
  const end = candidate.endWordIndex ?? candidate.wordIndex;
  const occupied = verse.annotations.some((annotation) => {
    if (annotation.visibility !== "reader") return false;
    if (annotation.placement === "word") {
      return (
        annotation.wordIndex !== undefined &&
        annotation.wordIndex >= start &&
        annotation.wordIndex <= end
      );
    }
    if (annotation.placement !== "phrase") return false;
    const annotationStart = annotation.startWordIndex;
    const annotationEnd = annotation.endWordIndex;
    return (
      annotationStart !== undefined &&
      annotationEnd !== undefined &&
      annotationStart <= end &&
      start <= annotationEnd
    );
  });
  return occupied === candidate.occupied
    ? candidate
    : { ...candidate, occupied };
}

export function uniqueByBestTarget(
  items: SemanticRefillAuditItem[]
): SemanticRefillAuditItem[] {
  const seen = new Set<string>();
  const output: SemanticRefillAuditItem[] = [];
  for (const item of items) {
    const key = candidateTargetKey(item.ref, item.strong, item.candidates[0]);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function candidateTargetKey(
  ref: string,
  strong: string,
  candidate: SemanticRefillCandidate | undefined
): string {
  if (!candidate) return `${ref}|${strong.toUpperCase()}|none`;
  return [
    ref,
    strong.toUpperCase(),
    candidate.target,
    candidate.wordIndex ?? "",
    candidate.startWordIndex ?? "",
    candidate.endWordIndex ?? "",
    candidate.normalizedWord ?? "",
    candidate.normalizedPhrase?.join(" ") ?? ""
  ].join("|");
}

export function slicePacketItems<T>(
  items: T[],
  offset: number,
  limit?: number
): T[] {
  const start = Math.max(0, Math.trunc(offset));
  return items.slice(start, limit === undefined ? undefined : start + limit);
}

function lexicalCandidateToSemantic(
  candidate: LexicalCandidate,
  item: LexicalCandidateItem
): SemanticRefillCandidate {
  const evidence = [
    `lexical-score:${candidate.score}`,
    `lexical-confidence:${candidate.confidence}`,
    candidate.occupied ? "occupied-target" : "open-target",
    ...candidate.evidence.map(
      (entry) =>
        `${entry.reviewOnly ? "review-only:" : ""}${entry.source}:${entry.detail}:${entry.weight}`
    )
  ];

  if (candidate.target === "phrase") {
    return {
      target: "phrase",
      strong: item.strong.toUpperCase(),
      wordIndex: candidate.wordIndex,
      startWordIndex: candidate.startWordIndex ?? candidate.wordIndex,
      endWordIndex: candidate.endWordIndex ?? candidate.wordIndex,
      normalizedPhrase: candidate.normalized.split(/\s+/u).filter(Boolean),
      score: candidate.score,
      evidence
    };
  }

  return {
    target: "word",
    strong: item.strong.toUpperCase(),
    wordIndex: candidate.wordIndex,
    normalizedWord: candidate.normalized,
    score: candidate.score,
    evidence
  };
}

function findAnnotation(
  verse: StrongLedgerVerse,
  item: LexicalCandidateItem
): StrongLedgerAnnotation | undefined {
  return (
    verse.annotations.find(
      (annotation) => annotation.id === item.annotationId
    ) ??
    verse.annotations.find(
      (annotation) =>
        annotation.strong.toUpperCase() === item.strong.toUpperCase() &&
        annotation.insertAfterWordIndex === item.insertAfterWordIndex
    )
  );
}

function annotationTarget(
  annotation: StrongLedgerAnnotation
): SemanticRefillAuditItem["currentTarget"] {
  if (annotation.placement === "phrase") {
    return {
      target: "phrase",
      wordIndex: annotation.startWordIndex ?? annotation.wordIndex,
      startWordIndex: annotation.startWordIndex,
      endWordIndex: annotation.endWordIndex,
      normalizedPhrase:
        typeof annotation.normalizedPhrase === "string"
          ? annotation.normalizedPhrase.split(" ")
          : annotation.normalizedPhrase
    };
  }
  if (annotation.placement === "word") {
    return {
      target: "word",
      wordIndex: annotation.wordIndex,
      normalizedWord: annotation.normalizedWord
    };
  }
  return {
    target: annotation.placement === "technical" ? "technical" : "empty",
    wordIndex: annotation.insertAfterWordIndex
  };
}

function lexicalCurrentTarget(
  item: LexicalCandidateItem
): SemanticRefillAuditItem["currentTarget"] {
  if (item.currentTarget) {
    return {
      target: "word",
      wordIndex: item.currentTarget.wordIndex,
      normalizedWord: item.currentTarget.normalized
    };
  }
  return {
    target: "empty",
    wordIndex: item.insertAfterWordIndex
  };
}

async function readVerses(
  ledgerDir: string,
  bible: string,
  scope: string
): Promise<StrongLedgerVerse[]> {
  return readStrongLedgerVersesSqlite({
    sqlitePath: strongLedgerSqlitePath(ledgerDir, bible),
    bible,
    onlyRef: scope
  });
}

function refInScope(ref: string, scope: string): boolean {
  const scopes = scope
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (scopes.length > 1) {
    return scopes.some((item) => refInScope(ref, item));
  }
  if (scope === "all") return true;
  if (ref === scope) return true;
  return ref.startsWith(`${scope}.`);
}

function compareAuditItems(
  left: SemanticRefillAuditItem,
  right: SemanticRefillAuditItem
): number {
  return (
    priorityRank(right.priority) - priorityRank(left.priority) ||
    bestScore(right) - bestScore(left) ||
    Number(left.candidates[0]?.evidence.includes("open-target") ?? false) -
      Number(right.candidates[0]?.evidence.includes("open-target") ?? false) ||
    left.ref.localeCompare(right.ref) ||
    left.strong.localeCompare(right.strong)
  );
}

function priorityForConfidence(
  confidence: CandidateConfidence
): RefillPriority {
  if (confidence === "high") return "semantic-high";
  if (confidence === "medium") return "semantic-medium";
  return "function-low";
}

function priorityRank(priority: RefillPriority): number {
  switch (priority) {
    case "semantic-high":
      return 4;
    case "semantic-medium":
      return 3;
    case "function-low":
      return 2;
    case "technical-skip":
      return 1;
  }
}

function confidenceRank(confidence: CandidateConfidence): number {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function bestScore(item: SemanticRefillAuditItem): number {
  return item.candidates[0]?.score ?? 0;
}

function topStrong(strong: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const code of strong) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, 30);
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

function readOptionalNumberArg(
  args: Map<string, string | boolean>,
  name: string
): number | undefined {
  const value = args.get(name);
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readConfidenceArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: CandidateConfidence
): CandidateConfidence {
  const value = args.get(name);
  if (value === undefined) return fallback;
  if (value === "high" || value === "medium" || value === "low") return value;
  throw new Error(`invalid-${name}:${String(value)}`);
}

function readAuditKindArg(
  args: Map<string, string | boolean>
): "all" | "empty" | "relocation" {
  const value = args.get("audit-kind");
  if (value === undefined) return "all";
  if (value === "all" || value === "empty" || value === "relocation") {
    return value;
  }
  throw new Error(`invalid-audit-kind:${String(value)}`);
}

function defaultOutputPath(bible: string, scope: string): string {
  const safeScope = scope.replace(/[^0-9A-Za-z]+/gu, "-");
  return `outputs/gap-review/${bible}/agent-packets/agent-packet-${bible}-${safeScope}-lexical.json`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bible = readStringArg(args, "bible", "nbs").toLowerCase();
  const scope = readStringArg(args, "only", "Gen");
  const outputPath = readStringArg(
    args,
    "output",
    defaultOutputPath(bible, scope)
  );
  const packet = await buildLexicalAgentPacket({
    bible,
    scope,
    lexicalReportPath: readStringArg(
      args,
      "lexical-report",
      `outputs/lexical-candidates/${bible}/bible-${bible}-lexical-candidates-${scope}.json`
    ),
    ledgerDir: readStringArg(args, "ledger-dir", `outputs/strong/${bible}`),
    outputPath,
    offset: readOptionalNumberArg(args, "offset"),
    limit: readOptionalNumberArg(args, "limit"),
    minConfidence: readConfidenceArg(args, "min-confidence", "high"),
    includeOccupied: args.get("include-occupied") === true,
    allowDuplicateTargets: args.get("allow-duplicate-targets") === true,
    auditKind: readAuditKindArg(args)
  });

  console.log(
    JSON.stringify(
      {
        output: outputPath,
        summary: packet.summary,
        filters: packet.filters
      },
      null,
      2
    )
  );
}

if (process.argv[1]?.endsWith("semanticRefillLexicalPacket.ts")) {
  await main();
}
