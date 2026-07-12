import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { type SemanticRefillDecision } from "./semanticRefill.js";
import {
  ensureCandidateChoices,
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmChoice,
  type SemanticRefillLlmEvaluatedDecision,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";

interface AgentReviewFile {
  bible: string;
  books?: string[];
  scope: string;
  generatedAt: string;
  sourcePacket: string;
  model: string;
  contract?: {
    version: 2;
    schemaName: string;
    candidateCount: number;
    subset: boolean;
  };
  decisions: SemanticRefillLlmRawDecision[];
}

interface AgentPacketFile {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

interface ValidatedSelection {
  raw: SemanticRefillLlmRawDecision;
  candidate: SemanticRefillLlmCandidatePacket;
  choice: SemanticRefillLlmChoice;
}

export async function buildConsensusReview(options: {
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
  if (
    normalizeModelIdentity(leftReview.model) ===
    normalizeModelIdentity(rightReview.model)
  ) {
    throw new Error(
      `consensus-requires-distinct-models:${leftReview.model}:${rightReview.model}`
    );
  }

  const packet = await readJson<AgentPacketFile>(leftReview.sourcePacket);
  const [leftAccepted, rightAccepted] = await Promise.all([
    readValidatedSelections({
      review: leftReview,
      validationDir: options.leftValidationDir,
      packet,
      minConfidence: options.minConfidence
    }),
    readValidatedSelections({
      review: rightReview,
      validationDir: options.rightValidationDir,
      packet,
      minConfidence: options.minConfidence
    })
  ]);
  const rightByIdentity = new Map(
    rightAccepted.map((selection) => [
      selectionIdentity(selection.raw),
      selection
    ])
  );

  const decisions: SemanticRefillLlmRawDecision[] = [];
  for (const left of leftAccepted) {
    const right = rightByIdentity.get(selectionIdentity(left.raw));
    if (!right) continue;
    decisions.push(toRawDecision({ left, right }));
  }

  const review: AgentReviewFile = {
    bible: packet.bible,
    books: inferBooks(packet.candidates.map((candidate) => candidate.ref)),
    scope: packet.scope,
    generatedAt: new Date().toISOString(),
    sourcePacket: leftReview.sourcePacket,
    model: `consensus(${leftReview.model},${rightReview.model})`,
    contract: {
      version: 2,
      schemaName: "semantic_refill_llm_decisions",
      candidateCount: packet.candidates.length,
      subset: true
    },
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
    skippedWithoutCandidate: 0
  };
}

async function readValidatedSelections(options: {
  review: AgentReviewFile;
  validationDir: string;
  packet: AgentPacketFile;
  minConfidence: number;
}): Promise<ValidatedSelection[]> {
  const [accepted, pending, rejected] = await Promise.all([
    readJson<SemanticRefillDecision[]>(
      path.join(options.validationDir, "accepted.json")
    ),
    readJson<SemanticRefillLlmEvaluatedDecision[]>(
      path.join(options.validationDir, "pending.json")
    ),
    readJson<SemanticRefillLlmEvaluatedDecision[]>(
      path.join(options.validationDir, "rejected.json")
    )
  ]);
  const packetById = uniqueCandidatesById(options.packet.candidates);
  const rawById = uniqueRawDecisionsById(options.review.decisions);
  const blockedIds = new Set<string>();
  for (const evaluation of [...pending, ...rejected]) {
    if (!rawById.has(evaluation.id)) {
      throw new Error(`validation-result-unknown-candidate:${evaluation.id}`);
    }
    if (blockedIds.has(evaluation.id)) {
      throw new Error(`duplicate-validation-result:${evaluation.id}`);
    }
    blockedIds.add(evaluation.id);
  }

  const acceptedKeyCounts = countAcceptedKeys(
    accepted.filter((decision) =>
      isValidatedConsensusEligible(decision, options.minConfidence)
    )
  );
  const selections: ValidatedSelection[] = [];
  for (const raw of options.review.decisions) {
    if (blockedIds.has(raw.id)) continue;
    const candidate = packetById.get(raw.id);
    if (!candidate) {
      throw new Error(`review-candidate-not-in-packet:${raw.id}`);
    }
    const choice = ensureCandidateChoices(candidate).choices.find(
      (candidateChoice) => candidateChoice.id === raw.choiceId
    );
    if (!choice || !rawMatchesChoice(raw, choice)) {
      throw new Error(
        `validated-choice-identity-mismatch:${raw.id}:${raw.choiceId}`
      );
    }
    if (!isConsensusEligible(raw, options.minConfidence)) continue;
    const acceptedKey = rawAcceptedKey(raw);
    const remaining = acceptedKeyCounts.get(acceptedKey) ?? 0;
    // Reference-style validation deliberately turns unsafe visible decisions
    // into low-confidence empty fallbacks. They are valid validation outputs,
    // but cannot participate in a visible two-model consensus.
    if (remaining < 1) continue;
    acceptedKeyCounts.set(acceptedKey, remaining - 1);
    selections.push({ raw, candidate, choice });
  }

  const unmatchedAccepted = [...acceptedKeyCounts.values()].reduce(
    (sum, count) => sum + count,
    0
  );
  if (unmatchedAccepted !== 0) {
    throw new Error(`unmatched-validated-decisions:${unmatchedAccepted}`);
  }
  return selections;
}

function isConsensusEligible(
  decision: SemanticRefillLlmRawDecision,
  minConfidence: number
): boolean {
  return (
    (decision.decision === "word" || decision.decision === "phrase") &&
    decision.confidence >= minConfidence
  );
}

function isValidatedConsensusEligible(
  decision: SemanticRefillDecision,
  minConfidence: number
): boolean {
  const target = decision.target ?? "word";
  return (
    (target === "word" || target === "phrase") &&
    decision.confidence >= minConfidence
  );
}

function selectionIdentity(decision: SemanticRefillLlmRawDecision): string {
  return `${decision.id}|${decision.choiceId}`;
}

function uniqueCandidatesById(
  candidates: SemanticRefillLlmCandidatePacket[]
): Map<string, SemanticRefillLlmCandidatePacket> {
  const byId = new Map<string, SemanticRefillLlmCandidatePacket>();
  for (const candidate of candidates) {
    if (byId.has(candidate.id)) {
      throw new Error(`duplicate-packet-candidate-id:${candidate.id}`);
    }
    byId.set(candidate.id, candidate);
  }
  return byId;
}

function uniqueRawDecisionsById(
  decisions: SemanticRefillLlmRawDecision[]
): Map<string, SemanticRefillLlmRawDecision> {
  const byId = new Map<string, SemanticRefillLlmRawDecision>();
  for (const decision of decisions) {
    if (byId.has(decision.id)) {
      throw new Error(`duplicate-review-candidate-id:${decision.id}`);
    }
    byId.set(decision.id, decision);
  }
  return byId;
}

function rawMatchesChoice(
  raw: SemanticRefillLlmRawDecision,
  choice: SemanticRefillLlmChoice
): boolean {
  return (
    raw.decision === choice.decision &&
    raw.wordIndex === choice.wordIndex &&
    raw.normalized === choice.normalized &&
    raw.startWordIndex === choice.startWordIndex &&
    raw.endWordIndex === choice.endWordIndex &&
    sameNullableStrings(raw.normalizedPhrase, choice.normalizedPhrase)
  );
}

function sameNullableStrings(
  left: string[] | null,
  right: string[] | null
): boolean {
  if (left === null || right === null) return left === right;
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function countAcceptedKeys(
  decisions: SemanticRefillDecision[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const decision of decisions) {
    const key = validatedAcceptedKey(decision);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rawAcceptedKey(decision: SemanticRefillLlmRawDecision): string {
  const phrase = decision.normalizedPhrase;
  return acceptedKey({
    ref: decision.ref,
    strong: decision.strong,
    target: decision.decision,
    wordIndex:
      decision.decision === "phrase"
        ? decision.startWordIndex
        : decision.wordIndex,
    normalized:
      decision.decision === "phrase"
        ? (phrase?.join(" ") ?? null)
        : decision.decision === "empty"
          ? ""
          : decision.normalized,
    startWordIndex: decision.startWordIndex,
    endWordIndex: decision.endWordIndex,
    normalizedPhrase: decision.normalizedPhrase
  });
}

function validatedAcceptedKey(decision: SemanticRefillDecision): string {
  return acceptedKey({
    ref: decision.ref,
    strong: decision.strong,
    target: decision.target ?? "word",
    wordIndex: decision.wordIndex,
    normalized: decision.normalized,
    startWordIndex: decision.startWordIndex ?? null,
    endWordIndex: decision.endWordIndex ?? null,
    normalizedPhrase: decision.normalizedPhrase ?? null
  });
}

function acceptedKey(options: {
  ref: string;
  strong: string[];
  target: string;
  wordIndex: number | null;
  normalized: string | null;
  startWordIndex: number | null;
  endWordIndex: number | null;
  normalizedPhrase: string[] | null;
}): string {
  return JSON.stringify({
    ref: options.ref,
    strong: options.strong.map((strong) => strong.toUpperCase()).sort(),
    target: options.target,
    wordIndex: options.wordIndex,
    normalized: options.normalized,
    startWordIndex: options.startWordIndex,
    endWordIndex: options.endWordIndex,
    normalizedPhrase: options.normalizedPhrase
  });
}

function toRawDecision(options: {
  left: ValidatedSelection;
  right: ValidatedSelection;
}): SemanticRefillLlmRawDecision {
  const confidence = Math.min(
    options.left.raw.confidence,
    options.right.raw.confidence
  );
  const candidate = options.left.candidate;
  const choice = options.left.choice;
  return {
    id: candidate.id,
    choiceId: choice.id,
    ref: candidate.ref,
    decision: choice.decision === "phrase" ? "phrase" : "word",
    strong: [candidate.strong.toUpperCase()],
    confidence,
    reason: `consensus high-confidence visible placement (${options.left.raw.confidence}/${options.right.raw.confidence})`,
    wordIndex: choice.wordIndex,
    normalized: choice.normalized,
    startWordIndex: choice.startWordIndex,
    endWordIndex: choice.endWordIndex,
    normalizedPhrase: choice.normalizedPhrase,
    evidence: [
      "consensus-visible-high-confidence",
      `candidate:${candidate.id}`,
      `choice:${choice.id}`,
      `left:${options.left.raw.reason}`,
      `right:${options.right.raw.reason}`
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

function normalizeModelIdentity(model: string): string {
  return model.trim().toLowerCase();
}

export function assertDistinctConsensusReviewModel(model: string | undefined): {
  left: string;
  right: string;
} {
  const match = model?.match(
    /^consensus\(([^,()]+),([^,()]+)\)(?:\+post-consensus-filter)?$/u
  );
  if (!match) {
    throw new Error(`consensus-model-provenance-required:${model ?? ""}`);
  }
  const left = normalizeModelIdentity(match[1]!);
  const right = normalizeModelIdentity(match[2]!);
  if (!left || !right || left === right) {
    throw new Error(`consensus-requires-distinct-models:${left}:${right}`);
  }
  return { left, right };
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
