import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isGenericFrenchCarrier } from "./frenchLexicalSafety.js";

import {
  buildStrongVerseMap,
  parseStrongTokens,
  readStrongCsv,
  type StrongVerseMap,
  type StrongToken
} from "./strongCsv.js";
import {
  assertSemanticRefillRawDecisionSubsetContract,
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";
import { assertDistinctConsensusReviewModel } from "./semanticRefillConsensusReview.js";

export const POST_CONSENSUS_FILTER_POLICY_VERSION = 2;

export interface AgentReviewFile {
  bible: string;
  books?: string[];
  scope: string;
  generatedAt: string;
  sourcePacket?: string;
  model?: string;
  contract?: { version?: number };
  decisions: SemanticRefillLlmRawDecision[];
}

export interface AgentPacketFile {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

export interface ReferencePath {
  name: string;
  path: string;
}

interface WitnessHit {
  reference: string;
  family: string;
  exactCarrier: boolean;
  tokens: Array<{
    text: string;
    normalized: string;
  }>;
}

export interface FilteredDecision {
  decision: SemanticRefillLlmRawDecision;
  status: "accepted-safe" | "needs-witness-review" | "rejected-risky";
  reasons: string[];
  witnessHits: WitnessHit[];
  exactWitnessFamilies: string[];
  directDeterministicSupport: boolean;
  carrierSupported: boolean;
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
    candidateId: string;
    choiceId: string;
    ref: string;
    strong: string[];
    target: string;
    wordIndex: number | null;
    normalized: string | null;
    status: FilteredDecision["status"];
    reasons: string[];
    witnessHits: WitnessHit[];
    exactWitnessFamilies: string[];
    directDeterministicSupport: boolean;
  }>;
}

const DEFAULT_REFERENCES: ReferencePath[] = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
];

export async function filterConsensusReview(options: {
  reviewPath: string;
  packetPath?: string;
  outputPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
  referencePaths?: ReferencePath[];
}): Promise<FilterReport> {
  const review = await readJson<AgentReviewFile>(options.reviewPath);
  assertDistinctConsensusReviewModel(review.model);
  const packetPath = options.packetPath ?? review.sourcePacket;
  if (!packetPath) {
    throw new Error("missing-source-packet");
  }
  const packet = await readJson<AgentPacketFile>(packetPath);
  if (
    review.bible.toLowerCase() !== packet.bible.toLowerCase() ||
    review.scope !== packet.scope
  ) {
    throw new Error(
      `consensus-packet-scope-mismatch:${review.bible}:${review.scope}:${packet.bible}:${packet.scope}`
    );
  }
  if (review.contract?.version !== 2) {
    throw new Error("consensus-contract-v2-required");
  }
  assertSemanticRefillRawDecisionSubsetContract({
    batch: packet,
    rawDecisions: review.decisions
  });
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
      policyVersion: POST_CONSENSUS_FILTER_POLICY_VERSION,
      sourceConsensusModel: review.model,
      sourceReview: options.reviewPath,
      sourcePacket: packetPath,
      acceptedSafe: filtered.filter((item) => item.status === "accepted-safe")
        .length,
      needsWitnessReview: filtered.filter(
        (item) => item.status === "needs-witness-review"
      ).length,
      rejectedRisky: filtered.filter((item) => item.status === "rejected-risky")
        .length,
      outcomes: filtered.map((item) => ({
        decision: item.decision,
        status: item.status,
        reasons: item.reasons,
        exactWitnessFamilies: item.exactWitnessFamilies,
        directDeterministicSupport: item.directDeterministicSupport
      }))
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
      candidateId: item.decision.id,
      choiceId: item.decision.choiceId,
      ref: item.decision.ref,
      strong: item.decision.strong,
      target: item.decision.decision,
      wordIndex: item.decision.wordIndex,
      normalized: item.decision.normalized,
      status: item.status,
      reasons: item.reasons,
      witnessHits: item.witnessHits,
      exactWitnessFamilies: item.exactWitnessFamilies,
      directDeterministicSupport: item.directDeterministicSupport
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
  const exactWitnessFamilies = exactCarrierWitnessFamilies(witnessHits);
  const directDeterministicSupport = options.candidate
    ? candidateHasRobustDirectCarrierEvidence(
        options.candidate,
        options.decision
      )
    : false;
  const generic = isGenericCarrier(options.decision);

  if (
    witnessHits.length === 0 &&
    !directDeterministicSupport &&
    options.candidate &&
    !candidateHasReferenceStrong(options.candidate, options.decision.strong)
  ) {
    reasons.push("no-strong-witness-support");
    return {
      decision: options.decision,
      status: "needs-witness-review",
      reasons,
      witnessHits,
      exactWitnessFamilies,
      directDeterministicSupport,
      carrierSupported: false,
      candidate: options.candidate
    };
  }

  if (generic && exactWitnessFamilies.length < 2) {
    reasons.push("generic-carrier-needs-witness-review");
    return {
      decision: options.decision,
      status: "needs-witness-review",
      reasons,
      witnessHits,
      exactWitnessFamilies,
      directDeterministicSupport,
      carrierSupported: false,
      candidate: options.candidate
    };
  }

  if (generic) {
    reasons.push("generic-carrier-exact-witness-supported");
  } else if (exactWitnessFamilies.length > 0) {
    reasons.push("exact-carrier-witness-supported");
  } else if (directDeterministicSupport) {
    reasons.push("direct-deterministic-carrier-evidence");
  } else {
    reasons.push("carrier-needs-exact-witness-or-direct-evidence");
    return {
      decision: options.decision,
      status: "needs-witness-review",
      reasons,
      witnessHits,
      exactWitnessFamilies,
      directDeterministicSupport,
      carrierSupported: false,
      candidate: options.candidate
    };
  }

  return {
    decision: options.decision,
    status: "accepted-safe",
    reasons,
    witnessHits,
    exactWitnessFamilies,
    directDeterministicSupport,
    carrierSupported: true,
    candidate: options.candidate
  };
}

function resolveStackingGroup(group: FilteredDecision[]): void {
  const supported = group.filter(
    (item) => item.carrierSupported && item.status === "accepted-safe"
  );
  if (supported.length === 1) {
    const keep = supported[0];
    if (!keep) return;
    if (!keep.reasons.includes("generic-carrier-needs-witness-review")) {
      keep.status = "accepted-safe";
    }
    keep.reasons.push("same-target-stacking-resolved-by-carrier-support");
    for (const item of group) {
      if (item === keep) continue;
      item.status = "rejected-risky";
      item.reasons.push("same-target-stacking-lacks-carrier-support");
    }
    return;
  }

  for (const item of group) {
    item.status = "needs-witness-review";
    item.reasons.push(
      supported.length > 1
        ? "same-target-stacking-multiple-carriers-supported"
        : "same-target-stacking-no-carrier-supported"
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
    const verseTokens = parseStrongTokens(verse.row.text);
    const tokens = tokensWithStrong(verseTokens, decision.strong);
    if (tokens.length === 0) continue;
    hits.push({
      reference,
      family: editorialReferenceFamily(reference),
      exactCarrier: referenceHasExactCarrier(verseTokens, decision),
      tokens: tokens.map((token) => ({
        text: token.text,
        normalized: token.normalized
      }))
    });
  }
  return hits;
}

function exactCarrierWitnessFamilies(witnessHits: WitnessHit[]): string[] {
  const families = new Set<string>();
  for (const hit of witnessHits) {
    if (hit.exactCarrier) {
      families.add(hit.family);
    }
  }
  return [...families].sort();
}

function referenceHasExactCarrier(
  tokens: StrongToken[],
  decision: SemanticRefillLlmRawDecision
): boolean {
  const wanted = new Set(decision.strong.map((strong) => strong.toUpperCase()));
  const carriesWantedStrong = (token: StrongToken): boolean =>
    token.strong.some((strong) => wanted.has(strong.toUpperCase()));

  if (decision.decision === "word") {
    return (
      typeof decision.normalized === "string" &&
      tokens.some(
        (token) =>
          carriesWantedStrong(token) && token.normalized === decision.normalized
      )
    );
  }

  if (decision.decision === "phrase" && decision.normalizedPhrase) {
    const phrase = decision.normalizedPhrase;
    for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
      const window = tokens.slice(start, start + phrase.length);
      if (
        phrase.every(
          (normalized, offset) => window[offset]?.normalized === normalized
        ) &&
        window.every(carriesWantedStrong)
      ) {
        return true;
      }
    }
  }

  return false;
}

const DIRECT_EVIDENCE_PREFIXES = [
  "seed-term:",
  "seed-stem:",
  "number-component:",
  "kaikki-gloss:",
  "proper-name-step:",
  "proper-name-dictionary:"
];

function candidateHasRobustDirectCarrierEvidence(
  candidate: SemanticRefillLlmCandidatePacket,
  decision: SemanticRefillLlmRawDecision
): boolean {
  const wantedStrong = new Set(
    decision.strong.map((strong) => strong.toUpperCase())
  );
  return candidate.deterministicCandidates.some(
    (deterministic) =>
      wantedStrong.has(deterministic.strong.toUpperCase()) &&
      deterministic.score >= 0.84 &&
      deterministicCandidateMatchesDecision(deterministic, decision) &&
      deterministic.evidence.some((evidence) =>
        DIRECT_EVIDENCE_PREFIXES.some((prefix) => evidence.startsWith(prefix))
      )
  );
}

function deterministicCandidateMatchesDecision(
  deterministic: SemanticRefillLlmCandidatePacket["deterministicCandidates"][number],
  decision: SemanticRefillLlmRawDecision
): boolean {
  if (deterministic.target !== decision.decision) return false;
  if (decision.decision === "word") {
    return (
      deterministic.wordIndex === decision.wordIndex &&
      deterministic.normalizedWord === decision.normalized
    );
  }
  if (decision.decision === "phrase") {
    return (
      deterministic.startWordIndex === decision.startWordIndex &&
      deterministic.endWordIndex === decision.endWordIndex &&
      sameStrings(deterministic.normalizedPhrase, decision.normalizedPhrase)
    );
  }
  return false;
}

function sameStrings(
  left: string[] | undefined,
  right: string[] | null
): boolean {
  if (!left || !right) return left === undefined && right === null;
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function editorialReferenceFamily(reference: string): string {
  const normalized = reference.toLowerCase().replace(/[^a-z0-9]+/gu, "");
  if (normalized.startsWith("darby")) return "Darby-family";
  return reference;
}

function tokensWithStrong(
  tokens: StrongToken[],
  strong: string[]
): StrongToken[] {
  const wanted = new Set(strong.map((code) => code.toUpperCase()));
  return tokens.filter((token) =>
    token.strong.some((code) => wanted.has(code.toUpperCase()))
  );
}

function groupByTarget(
  decisions: FilteredDecision[]
): Map<string, FilteredDecision[]> {
  const groups = new Map<string, FilteredDecision[]>();
  const unseen = new Set(decisions);
  let groupIndex = 0;

  while (unseen.size > 0) {
    const seed = unseen.values().next().value as FilteredDecision;
    unseen.delete(seed);
    const group = [seed];
    const queue = [seed];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const candidate of [...unseen]) {
        if (!carrierTargetsConflict(current.decision, candidate.decision)) {
          continue;
        }
        unseen.delete(candidate);
        group.push(candidate);
        queue.push(candidate);
      }
    }
    groups.set(`carrier-component:${groupIndex}`, group);
    groupIndex += 1;
  }
  return groups;
}

function carrierTargetsConflict(
  left: SemanticRefillLlmRawDecision,
  right: SemanticRefillLlmRawDecision
): boolean {
  if (left.ref !== right.ref) return false;
  const leftInterval = visibleCarrierInterval(left);
  const rightInterval = visibleCarrierInterval(right);
  if (leftInterval && rightInterval) {
    return (
      leftInterval.start <= rightInterval.end &&
      rightInterval.start <= leftInterval.end
    );
  }
  return (
    left.decision === "empty" &&
    right.decision === "empty" &&
    left.wordIndex === right.wordIndex
  );
}

function visibleCarrierInterval(
  decision: SemanticRefillLlmRawDecision
): { start: number; end: number } | undefined {
  if (decision.decision === "word" && decision.wordIndex !== null) {
    return { start: decision.wordIndex, end: decision.wordIndex };
  }
  if (
    decision.decision === "phrase" &&
    decision.startWordIndex !== null &&
    decision.endWordIndex !== null
  ) {
    return {
      start: decision.startWordIndex,
      end: decision.endWordIndex
    };
  }
  return undefined;
}

function isGenericCarrier(decision: SemanticRefillLlmRawDecision): boolean {
  return (
    decision.decision === "word" &&
    decision.normalized !== null &&
    isGenericFrenchCarrier(decision.normalized)
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

export async function readReferenceMaps(
  referencePaths: ReferencePath[] = DEFAULT_REFERENCES
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
              `${hit.reference}[${hit.family}]:${hit.tokens
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
