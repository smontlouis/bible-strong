import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type SemanticRefillDecision } from "./semanticRefill.js";
import {
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";

interface AgentReviewFile {
  bible: string;
  books?: string[];
  scope: string;
  generatedAt: string;
  sourcePacket: string;
  model: string;
  decisions: SemanticRefillLlmRawDecision[];
}

interface AgentPacketFile {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

async function buildConsensusReview(options: {
  leftReviewPath: string;
  rightReviewPath: string;
  leftValidationDir: string;
  rightValidationDir: string;
  outputPath: string;
  minConfidence: number;
}): Promise<{
  output: string;
  sourcePacket: string;
  leftAccepted: number;
  rightAccepted: number;
  consensus: number;
  skippedWithoutCandidate: number;
}> {
  const leftReview = await readJson<AgentReviewFile>(options.leftReviewPath);
  const rightReview = await readJson<AgentReviewFile>(options.rightReviewPath);
  if (leftReview.sourcePacket !== rightReview.sourcePacket) {
    throw new Error("source-packet-mismatch");
  }

  const packet = await readJson<AgentPacketFile>(leftReview.sourcePacket);
  const leftAccepted = (
    await readJson<SemanticRefillDecision[]>(
      path.join(options.leftValidationDir, "accepted.json")
    )
  ).filter((decision) => isConsensusEligible(decision, options.minConfidence));
  const rightAccepted = (
    await readJson<SemanticRefillDecision[]>(
      path.join(options.rightValidationDir, "accepted.json")
    )
  ).filter((decision) => isConsensusEligible(decision, options.minConfidence));
  const rightByKey = new Map(
    rightAccepted.map((decision) => [key(decision), decision])
  );

  const decisions: SemanticRefillLlmRawDecision[] = [];
  let skippedWithoutCandidate = 0;
  for (const left of leftAccepted) {
    const right = rightByKey.get(key(left));
    if (!right) continue;
    const candidate = findCandidate(packet.candidates, left);
    if (!candidate) {
      skippedWithoutCandidate += 1;
      continue;
    }
    decisions.push(toRawDecision({ candidate, left, right }));
  }

  const review: AgentReviewFile = {
    bible: packet.bible,
    books: inferBooks(packet.candidates.map((candidate) => candidate.ref)),
    scope: packet.scope,
    generatedAt: new Date().toISOString(),
    sourcePacket: leftReview.sourcePacket,
    model: `consensus(${leftReview.model},${rightReview.model})`,
    decisions
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(review, null, 2)}\n`,
    "utf8"
  );

  return {
    output: options.outputPath,
    sourcePacket: leftReview.sourcePacket,
    leftAccepted: leftAccepted.length,
    rightAccepted: rightAccepted.length,
    consensus: decisions.length,
    skippedWithoutCandidate
  };
}

function isConsensusEligible(
  decision: SemanticRefillDecision,
  minConfidence: number
): boolean {
  return (
    (decision.target ?? "word") !== "empty" &&
    decision.confidence >= minConfidence
  );
}

function key(decision: SemanticRefillDecision): string {
  return [
    decision.ref,
    decision.strong.join(","),
    decision.target ?? "word",
    decision.wordIndex ?? "",
    decision.startWordIndex ?? "",
    decision.endWordIndex ?? "",
    decision.normalized
  ].join("|");
}

function findCandidate(
  candidates: SemanticRefillLlmCandidatePacket[],
  decision: SemanticRefillDecision
): SemanticRefillLlmCandidatePacket | undefined {
  const strong = new Set(decision.strong.map((code) => code.toUpperCase()));
  const target = decision.target ?? "word";
  return candidates.find((candidate) => {
    if (candidate.ref !== decision.ref) return false;
    if (!strong.has(candidate.strong.toUpperCase())) return false;
    return candidate.deterministicCandidates.some((deterministic) => {
      if (deterministic.target !== target) return false;
      if (target === "word") {
        return deterministic.wordIndex === decision.wordIndex;
      }
      return (
        deterministic.startWordIndex === decision.startWordIndex &&
        deterministic.endWordIndex === decision.endWordIndex
      );
    });
  });
}

function toRawDecision(options: {
  candidate: SemanticRefillLlmCandidatePacket;
  left: SemanticRefillDecision;
  right: SemanticRefillDecision;
}): SemanticRefillLlmRawDecision {
  const confidence = Math.min(
    options.left.confidence,
    options.right.confidence
  );
  const target = options.left.target ?? "word";
  return {
    id: options.candidate.id,
    ref: options.left.ref,
    decision: target === "phrase" ? "phrase" : "word",
    strong: options.left.strong,
    confidence,
    reason: `consensus high-confidence visible placement (${options.left.confidence}/${options.right.confidence})`,
    wordIndex: options.left.wordIndex ?? null,
    normalized: options.left.normalized,
    startWordIndex: options.left.startWordIndex ?? null,
    endWordIndex: options.left.endWordIndex ?? null,
    normalizedPhrase:
      target === "phrase"
        ? (options.left.normalizedPhrase ??
          options.left.normalized.split(/\s+/u))
        : null,
    evidence: [
      "consensus-visible-high-confidence",
      `left:${options.left.reason}`,
      `right:${options.right.reason}`
    ]
  };
}

function inferBooks(refs: string[]): string[] {
  return [
    ...new Set(
      refs
        .map((ref) => ref.split(".")[0])
        .filter((book): book is string => !!book)
    )
  ];
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

function readNumberArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: number
): number {
  const value = args.get(name);
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await buildConsensusReview({
    leftReviewPath: readStringArg(args, "left-review", ""),
    rightReviewPath: readStringArg(args, "right-review", ""),
    leftValidationDir: readStringArg(args, "left-validation-dir", ""),
    rightValidationDir: readStringArg(args, "right-validation-dir", ""),
    outputPath: readStringArg(
      args,
      "output",
      "outputs/gap-review/nbs/agent-review/llm-review-consensus.json"
    ),
    minConfidence: readNumberArg(args, "min-confidence", 0.84)
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith("semanticRefillConsensusReview.ts")) {
  await main();
}
