import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildStrongVerseMap,
  parseStrongTokens,
  readStrongCsv,
  type StrongVerseMap,
  type StrongToken
} from "./strongCsv.js";
import {
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";

interface AgentReviewFile {
  bible: string;
  books?: string[];
  scope: string;
  generatedAt: string;
  sourcePacket?: string;
  model?: string;
  decisions: SemanticRefillLlmRawDecision[];
}

interface AgentPacketFile {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

interface ReferencePath {
  name: string;
  path: string;
}

interface WitnessHit {
  reference: string;
  tokens: Array<{
    text: string;
    normalized: string;
  }>;
}

interface FilteredDecision {
  decision: SemanticRefillLlmRawDecision;
  status: "accepted-safe" | "needs-witness-review" | "rejected-risky";
  reasons: string[];
  witnessHits: WitnessHit[];
  candidate?: SemanticRefillLlmCandidatePacket;
}

interface FilterReport {
  generatedAt: string;
  bible: string;
  scope: string;
  sourceReview: string;
  sourcePacket: string;
  outputReview: string;
  counts: {
    input: number;
    acceptedSafe: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
  decisions: Array<{
    ref: string;
    strong: string[];
    target: string;
    wordIndex: number | null;
    normalized: string | null;
    status: FilteredDecision["status"];
    reasons: string[];
    witnessHits: WitnessHit[];
  }>;
}

const DEFAULT_REFERENCES: ReferencePath[] = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

const GENERIC_CARRIERS = new Set([
  "a",
  "ai",
  "as",
  "avons",
  "avez",
  "aurait",
  "auriez",
  "auront",
  "avait",
  "avaient",
  "ce",
  "cela",
  "celle",
  "celles",
  "celui",
  "ceux",
  "est",
  "etait",
  "etaient",
  "etre",
  "faire",
  "fais",
  "faisait",
  "faisaient",
  "faisant",
  "fasse",
  "fassent",
  "fait",
  "faites",
  "faits",
  "fera",
  "ferai",
  "feraient",
  "ferais",
  "ferait",
  "feras",
  "ferez",
  "ferons",
  "feront",
  "fit",
  "font",
  "irai",
  "ira",
  "iront",
  "met",
  "mets",
  "mettra",
  "mettrai",
  "mettre",
  "mis",
  "peut",
  "peuvent",
  "puisse",
  "puissent",
  "quoi",
  "suis",
  "va",
  "vais",
  "vas",
  "vont"
]);

export async function filterConsensusReview(options: {
  reviewPath: string;
  packetPath?: string;
  outputPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  referencePaths?: ReferencePath[];
}): Promise<FilterReport> {
  const review = await readJson<AgentReviewFile>(options.reviewPath);
  const packetPath = options.packetPath ?? review.sourcePacket;
  if (!packetPath) {
    throw new Error("missing-source-packet");
  }
  const packet = await readJson<AgentPacketFile>(packetPath);
  const referenceMaps = await readReferenceMaps(
    options.referencePaths ?? DEFAULT_REFERENCES
  );
  const filtered = filterDecisions({
    review,
    packet,
    referenceMaps
  });

  const outputReview: AgentReviewFile & {
    postConsensusFilter: Record<string, unknown>;
  } = {
    ...review,
    generatedAt: new Date().toISOString(),
    model: `${review.model ?? "unknown"}+post-consensus-filter`,
    decisions: filtered
      .filter((item) => item.status === "accepted-safe")
      .map((item) => item.decision),
    postConsensusFilter: {
      sourceReview: options.reviewPath,
      sourcePacket: packetPath,
      acceptedSafe: filtered.filter((item) => item.status === "accepted-safe")
        .length,
      needsWitnessReview: filtered.filter(
        (item) => item.status === "needs-witness-review"
      ).length,
      rejectedRisky: filtered.filter((item) => item.status === "rejected-risky")
        .length
    }
  };

  const report: FilterReport = {
    generatedAt: new Date().toISOString(),
    bible: review.bible,
    scope: review.scope,
    sourceReview: options.reviewPath,
    sourcePacket: packetPath,
    outputReview: options.outputPath,
    counts: {
      input: review.decisions.length,
      acceptedSafe: outputReview.decisions.length,
      needsWitnessReview: filtered.filter(
        (item) => item.status === "needs-witness-review"
      ).length,
      rejectedRisky: filtered.filter((item) => item.status === "rejected-risky")
        .length
    },
    decisions: filtered.map((item) => ({
      ref: item.decision.ref,
      strong: item.decision.strong,
      target: item.decision.decision,
      wordIndex: item.decision.wordIndex,
      normalized: item.decision.normalized,
      status: item.status,
      reasons: item.reasons,
      witnessHits: item.witnessHits
    }))
  };

  await Promise.all([
    writeJson(options.outputPath, outputReview),
    writeJson(options.reportJsonPath, report),
    writeMarkdown(options.reportMarkdownPath, renderMarkdown(report))
  ]);
  return report;
}

export function filterDecisions(options: {
  review: AgentReviewFile;
  packet: AgentPacketFile;
  referenceMaps: Map<string, StrongVerseMap>;
}): FilteredDecision[] {
  const candidateById = new Map(
    options.packet.candidates.map((candidate) => [candidate.id, candidate])
  );
  const initial = options.review.decisions.map((decision) => {
    const candidate = candidateById.get(decision.id);
    return classifySingleDecision({
      decision,
      candidate,
      referenceMaps: options.referenceMaps
    });
  });

  const groups = groupByTarget(initial);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    resolveStackingGroup(group);
  }

  return initial;
}

function classifySingleDecision(options: {
  decision: SemanticRefillLlmRawDecision;
  candidate?: SemanticRefillLlmCandidatePacket;
  referenceMaps: Map<string, StrongVerseMap>;
}): FilteredDecision {
  const witnessHits = witnessHitsForDecision(
    options.decision,
    options.referenceMaps
  );
  const reasons: string[] = [];
  const normalized = options.decision.normalized ?? "";
  const exactWitnessSupport = witnessHits.filter((hit) =>
    hit.tokens.some((token) => token.normalized === normalized)
  ).length;
  const generic = isGenericCarrier(options.decision);

  if (
    witnessHits.length === 0 &&
    options.candidate &&
    !candidateHasReferenceStrong(options.candidate, options.decision.strong)
  ) {
    reasons.push("no-strong-witness-support");
    return {
      decision: options.decision,
      status: "needs-witness-review",
      reasons,
      witnessHits,
      candidate: options.candidate
    };
  }

  if (generic && exactWitnessSupport < 2) {
    reasons.push("generic-carrier-needs-witness-review");
    return {
      decision: options.decision,
      status: "needs-witness-review",
      reasons,
      witnessHits,
      candidate: options.candidate
    };
  }

  if (generic) {
    reasons.push("generic-carrier-exact-witness-supported");
  }

  return {
    decision: options.decision,
    status: "accepted-safe",
    reasons,
    witnessHits,
    candidate: options.candidate
  };
}

function resolveStackingGroup(group: FilteredDecision[]): void {
  const supported = group.filter((item) => item.witnessHits.length > 0);
  if (supported.length === 1) {
    const keep = supported[0];
    if (!keep) return;
    if (!keep.reasons.includes("generic-carrier-needs-witness-review")) {
      keep.status = "accepted-safe";
    }
    keep.reasons.push("same-target-stacking-resolved-by-witness");
    for (const item of group) {
      if (item === keep) continue;
      item.status = "rejected-risky";
      item.reasons.push("same-target-stacking-lacks-witness-support");
    }
    return;
  }

  for (const item of group) {
    item.status = "needs-witness-review";
    item.reasons.push(
      supported.length > 1
        ? "same-target-stacking-multiple-witness-supported"
        : "same-target-stacking-no-witness-supported"
    );
  }
}

function witnessHitsForDecision(
  decision: SemanticRefillLlmRawDecision,
  referenceMaps: Map<string, StrongVerseMap>
): WitnessHit[] {
  const hits: WitnessHit[] = [];
  for (const [reference, map] of referenceMaps) {
    const verse = map.get(decision.ref);
    if (!verse) continue;
    const tokens = tokensWithStrong(verse.row.text, decision.strong);
    if (tokens.length === 0) continue;
    hits.push({
      reference,
      tokens: tokens.map((token) => ({
        text: token.text,
        normalized: token.normalized
      }))
    });
  }
  return hits;
}

function tokensWithStrong(text: string, strong: string[]): StrongToken[] {
  const wanted = new Set(strong.map((code) => code.toUpperCase()));
  return parseStrongTokens(text).filter((token) =>
    token.strong.some((code) => wanted.has(code.toUpperCase()))
  );
}

function groupByTarget(
  decisions: FilteredDecision[]
): Map<string, FilteredDecision[]> {
  const groups = new Map<string, FilteredDecision[]>();
  for (const decision of decisions) {
    if (decision.decision.decision === "phrase") continue;
    const key = [
      decision.decision.ref,
      decision.decision.decision,
      decision.decision.wordIndex ?? "",
      decision.decision.normalized ?? ""
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(decision);
    groups.set(key, group);
  }
  return groups;
}

function isGenericCarrier(decision: SemanticRefillLlmRawDecision): boolean {
  return (
    decision.decision === "word" &&
    decision.normalized !== null &&
    GENERIC_CARRIERS.has(decision.normalized)
  );
}

function candidateHasReferenceStrong(
  candidate: SemanticRefillLlmCandidatePacket,
  strong: string[]
): boolean {
  const wanted = new Set(strong.map((code) => code.toUpperCase()));
  return Object.values(candidate.referenceInventory).some((inventory) =>
    inventory.some((code) => wanted.has(code.toUpperCase()))
  );
}

async function readReferenceMaps(
  referencePaths: ReferencePath[]
): Promise<Map<string, StrongVerseMap>> {
  const maps = new Map<string, StrongVerseMap>();
  for (const reference of referencePaths) {
    maps.set(
      reference.name,
      buildStrongVerseMap(await readStrongCsv(reference.path))
    );
  }
  return maps;
}

function renderMarkdown(report: FilterReport): string {
  const lines = [
    `# Post-Consensus Filter: ${report.bible} ${report.scope}`,
    "",
    `- generatedAt: \`${report.generatedAt}\``,
    `- sourceReview: \`${report.sourceReview}\``,
    `- sourcePacket: \`${report.sourcePacket}\``,
    `- outputReview: \`${report.outputReview}\``,
    `- input decisions: \`${report.counts.input}\``,
    `- accepted safe: \`${report.counts.acceptedSafe}\``,
    `- needs witness review: \`${report.counts.needsWitnessReview}\``,
    `- rejected risky: \`${report.counts.rejectedRisky}\``,
    "",
    "| status | ref | Strong | target | reasons | witness hits |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  for (const decision of report.decisions) {
    lines.push(
      [
        decision.status,
        decision.ref,
        decision.strong.join(", "),
        `${decision.wordIndex ?? ""}:${decision.normalized ?? ""}`,
        decision.reasons.join("; "),
        decision.witnessHits
          .map(
            (hit) =>
              `${hit.reference}:${hit.tokens
                .map((token) => token.normalized)
                .join("+")}`
          )
          .join("; ")
      ]
        .map(escapeCell)
        .join(" | ")
        .replace(/^/u, "| ")
        .replace(/$/u, " |")
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/gu, "\\|");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeMarkdown(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
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

function readOptionalStringArg(
  args: Map<string, string | boolean>,
  name: string
): string | undefined {
  const value = args.get(name);
  return typeof value === "string" ? value : undefined;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = readStringArg(
    args,
    "output",
    "outputs/gap-review/nbs/agent-review/llm-review-consensus-filtered.json"
  );
  const reportJsonPath = readStringArg(
    args,
    "report-json",
    outputPath.replace(/\.json$/u, "-filter-report.json")
  );
  const reportMarkdownPath = readStringArg(
    args,
    "report-md",
    reportJsonPath.replace(/\.json$/u, ".md")
  );
  const result = await filterConsensusReview({
    reviewPath: readStringArg(args, "review", ""),
    packetPath: readOptionalStringArg(args, "packet"),
    outputPath,
    reportJsonPath,
    reportMarkdownPath
  });
  console.log(JSON.stringify(result.counts, null, 2));
}

if (process.argv[1]?.endsWith("semanticRefillConsensusFilter.ts")) {
  await main();
}
