import { existsSync } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { writeJsonFileAtomic } from "./atomicFile.js";
import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { type CuratedStrongOverride } from "./curatedStrongOverrides.js";
import {
  type LexicalCandidate,
  type LexicalCandidateReport
} from "./lexicalCandidateReport.js";
import { withReviewFileLock } from "./reviewFileLock.js";
import {
  decisionRecord,
  type StrongReviewDecisionRecord
} from "./semanticRefillAgentReview.js";
import {
  filterDecisions,
  readReferenceMaps,
  type AgentPacketFile,
  type AgentReviewFile,
  type FilteredDecision
} from "./semanticRefillConsensusFilter.js";
import {
  assertSemanticRefillRawDecisionSubsetContract,
  ensureCandidateChoices,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";
import { referenceKey } from "./strongCsv.js";
import { tokenizeText } from "./tokenize.js";

export interface MigrationProof {
  exactWitnessFamilies: Set<string>;
  sourceReviews: Set<string>;
  currentDirectDeterministicSupport: boolean;
}

export function revertArtifactMigrations(overrides: CuratedStrongOverride[]): {
  overrides: CuratedStrongOverride[];
  reverted: number;
} {
  let reverted = 0;
  return {
    overrides: overrides.map((override) => {
      const marker = "; artifact-migration:current-post-consensus-filter";
      const markerIndex = override.reason.indexOf(marker);
      if (
        override.source !== "semantic-refill:llm-consensus-filtered" ||
        markerIndex < 0
      ) {
        return override;
      }
      reverted += 1;
      return {
        ...override,
        source: "semantic-refill:llm",
        reason: override.reason.slice(0, markerIndex)
      };
    }),
    reverted
  };
}

interface ArtifactMigrationAnalysis {
  consensusFiles: number;
  validConsensusFiles: number;
  invalidConsensusFiles: number;
  missingPackets: number;
  outcomes: number;
  acceptedSafe: number;
  needsWitnessReview: number;
  rejectedRisky: number;
  witnessBackedProofs: Map<string, MigrationProof>;
  currentOpenProofs: number;
  currentDirectProofs: number;
  decisionRecords: StrongReviewDecisionRecord[];
  errors: Array<{ file: string; error: string }>;
}

interface ArtifactMigrationReport {
  generatedAt: string;
  bible: string;
  artifactRoot: string;
  apply: boolean;
  consensusFiles: number;
  validConsensusFiles: number;
  invalidConsensusFiles: number;
  missingPackets: number;
  outcomes: number;
  acceptedSafe: number;
  needsWitnessReview: number;
  rejectedRisky: number;
  witnessBackedProofs: number;
  currentOpenProofs: number;
  currentDirectProofs: number;
  legacyUnfilteredOverrides: number;
  promotedOverrides: number;
  skippedInvalidTarget: number;
  skippedRelocation: number;
  skippedCarrierConflict: number;
  legacyWithoutCurrentWitnessProof: number;
  decisionRecordsAdded: number;
  errors: Array<{ file: string; error: string }>;
}

export async function migrateSemanticRefillArtifacts(options: {
  bible: string;
  artifactRoot: string;
  overridesPath: string;
  decisionLedgerPath: string;
  lexicalReportPath?: string;
  outputPath: string;
  apply: boolean;
}): Promise<ArtifactMigrationReport> {
  const bible = options.bible.toLowerCase();
  const referenceMaps = await readReferenceMaps();
  const consensusFiles = await findConsensusReviews(options.artifactRoot);
  const currentLexicalProof = options.lexicalReportPath
    ? await currentLexicalProofs(bible, options.lexicalReportPath)
    : { open: new Set<string>(), direct: new Set<string>() };
  const analysis = await analyzeArtifacts({
    bible,
    consensusFiles,
    referenceMaps,
    currentOpenProofs: currentLexicalProof.open,
    currentDirectProofs: currentLexicalProof.direct
  });
  const verses = await readBibleJson(`data/bibles/bible-${bible}.json`);
  const versesByRef = new Map(
    verses.map((verse) => [
      referenceKey(verse.bookId, verse.chapter, verse.verse),
      verse
    ])
  );

  let migrationCounts = {
    legacyUnfilteredOverrides: 0,
    promotedOverrides: 0,
    skippedInvalidTarget: 0,
    skippedRelocation: 0,
    skippedCarrierConflict: 0,
    legacyWithoutCurrentWitnessProof: 0,
    decisionRecordsAdded: 0
  };
  const persist = async (): Promise<void> => {
    const overrides = await readArray<CuratedStrongOverride>(
      options.overridesPath
    );
    const migrated = migrateOverrides({
      bible,
      overrides,
      proofs: analysis.witnessBackedProofs,
      versesByRef
    });
    const existingRecords = await readArray<StrongReviewDecisionRecord>(
      options.decisionLedgerPath
    );
    const existingRecordIds = new Set(
      existingRecords.map((record) => record.recordId)
    );
    const additions = analysis.decisionRecords.filter(
      (record) => !existingRecordIds.has(record.recordId)
    );
    migrationCounts = {
      ...migrated.counts,
      decisionRecordsAdded: additions.length
    };

    if (!options.apply) return;
    // Negative/history records are written first. If the process stops before
    // the override write, rerunning is idempotent and production remains
    // conservatively quarantined.
    await writeJsonFileAtomic(options.decisionLedgerPath, [
      ...existingRecords,
      ...additions
    ]);
    await writeJsonFileAtomic(options.overridesPath, migrated.overrides);
  };

  if (options.apply) await withReviewFileLock(persist);
  else await persist();

  const report: ArtifactMigrationReport = {
    generatedAt: new Date().toISOString(),
    bible,
    artifactRoot: options.artifactRoot,
    apply: options.apply,
    consensusFiles: analysis.consensusFiles,
    validConsensusFiles: analysis.validConsensusFiles,
    invalidConsensusFiles: analysis.invalidConsensusFiles,
    missingPackets: analysis.missingPackets,
    outcomes: analysis.outcomes,
    acceptedSafe: analysis.acceptedSafe,
    needsWitnessReview: analysis.needsWitnessReview,
    rejectedRisky: analysis.rejectedRisky,
    witnessBackedProofs: analysis.witnessBackedProofs.size,
    currentOpenProofs: analysis.currentOpenProofs,
    currentDirectProofs: analysis.currentDirectProofs,
    ...migrationCounts,
    errors: analysis.errors.slice(0, 100)
  };
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeJsonFileAtomic(options.outputPath, report);
  return report;
}

async function analyzeArtifacts(options: {
  bible: string;
  consensusFiles: string[];
  referenceMaps: Awaited<ReturnType<typeof readReferenceMaps>>;
  currentOpenProofs: Set<string>;
  currentDirectProofs: Set<string>;
}): Promise<ArtifactMigrationAnalysis> {
  const proofs = new Map<string, MigrationProof>();
  const records = new Map<string, StrongReviewDecisionRecord>();
  const errors: Array<{ file: string; error: string }> = [];
  let validConsensusFiles = 0;
  let invalidConsensusFiles = 0;
  let missingPackets = 0;
  const allOutcomes: FilteredDecision[] = [];

  for (const reviewPath of options.consensusFiles) {
    try {
      const review = await readJson<AgentReviewFile>(reviewPath);
      if (review.bible.toLowerCase() !== options.bible) {
        throw new Error(`bible-mismatch:${review.bible}`);
      }
      assertDistinctConsensusModel(review.model);
      const packetPath = resolveSourcePacket(review.sourcePacket, reviewPath);
      if (!packetPath) {
        missingPackets += 1;
        throw new Error(`source-packet-missing:${review.sourcePacket ?? ""}`);
      }
      const packet = await readJson<AgentPacketFile>(packetPath);
      const rawDecisions = upgradeLegacyDecisionChoices(
        review.decisions,
        packet
      );
      assertSemanticRefillRawDecisionSubsetContract({
        batch: packet,
        rawDecisions
      });
      const upgradedReview = { ...review, decisions: rawDecisions };
      const outcomes = filterDecisions({
        review: upgradedReview,
        packet,
        referenceMaps: options.referenceMaps
      });
      validConsensusFiles += 1;
      allOutcomes.push(...outcomes);
      const candidateById = new Map(
        packet.candidates.map((candidate) => [candidate.id, candidate])
      );

      for (const outcome of outcomes) {
        const record = decisionRecord({
          bible: options.bible,
          inputPath: reviewPath,
          sourcePacket: packetPath,
          model: review.model,
          generatedAt: review.generatedAt,
          decision: outcome.decision,
          stage: "post-consensus-filter",
          status: outcome.status,
          verdictReasons: outcome.reasons,
          exactWitnessFamilies: outcome.exactWitnessFamilies,
          directDeterministicSupport: outcome.directDeterministicSupport
        });
        records.set(record.recordId, record);
        const key = decisionPlacementKey(options.bible, outcome.decision);
        const currentDirectDeterministicSupport =
          outcome.directDeterministicSupport &&
          options.currentDirectProofs.has(key);
        if (
          !artifactOutcomeCanProveProduction({
            outcome,
            candidateAuditKind: candidateById.get(outcome.decision.id)
              ?.auditKind,
            currentOpenCandidate: options.currentOpenProofs.has(key),
            currentDirectDeterministicSupport
          })
        ) {
          continue;
        }
        const proof = proofs.get(key) ?? {
          exactWitnessFamilies: new Set<string>(),
          sourceReviews: new Set<string>(),
          currentDirectDeterministicSupport: false
        };
        for (const family of outcome.exactWitnessFamilies) {
          proof.exactWitnessFamilies.add(family);
        }
        proof.sourceReviews.add(reviewPath);
        proof.currentDirectDeterministicSupport ||=
          currentDirectDeterministicSupport;
        proofs.set(key, proof);
      }
    } catch (error) {
      invalidConsensusFiles += 1;
      errors.push({ file: reviewPath, error: errorMessage(error) });
    }
  }

  return {
    consensusFiles: options.consensusFiles.length,
    validConsensusFiles,
    invalidConsensusFiles,
    missingPackets,
    outcomes: allOutcomes.length,
    acceptedSafe: allOutcomes.filter((item) => item.status === "accepted-safe")
      .length,
    needsWitnessReview: allOutcomes.filter(
      (item) => item.status === "needs-witness-review"
    ).length,
    rejectedRisky: allOutcomes.filter(
      (item) => item.status === "rejected-risky"
    ).length,
    witnessBackedProofs: proofs,
    currentOpenProofs: options.currentOpenProofs.size,
    currentDirectProofs: options.currentDirectProofs.size,
    decisionRecords: [...records.values()],
    errors
  };
}

export function artifactOutcomeCanProveProduction(options: {
  outcome: Pick<FilteredDecision, "status" | "exactWitnessFamilies">;
  candidateAuditKind?: string;
  currentOpenCandidate: boolean;
  currentDirectDeterministicSupport: boolean;
}): boolean {
  return (
    options.outcome.status === "accepted-safe" &&
    options.candidateAuditKind === "missing" &&
    options.currentOpenCandidate &&
    (options.outcome.exactWitnessFamilies.length > 0 ||
      options.currentDirectDeterministicSupport)
  );
}

const CURRENT_DIRECT_EVIDENCE_SOURCES = new Set([
  "seed-term",
  "seed-stem",
  "number-component",
  "kaikki-gloss",
  "proper-name-step",
  "proper-name-dictionary"
]);

async function currentLexicalProofs(
  bible: string,
  lexicalReportPath: string
): Promise<{ open: Set<string>; direct: Set<string> }> {
  const report = await readJson<LexicalCandidateReport>(lexicalReportPath);
  if (report.bible.toLowerCase() !== bible) {
    throw new Error(`lexical-report-bible-mismatch:${bible}:${report.bible}`);
  }
  const open = new Set<string>();
  const direct = new Set<string>();
  for (const item of report.items) {
    if (item.auditKind !== "empty") continue;
    for (const candidate of item.candidates) {
      if (candidate.occupied) continue;
      const key = placementKey({
        bible,
        ref: item.ref,
        target: candidate.target,
        wordIndex: candidate.wordIndex,
        normalized: candidate.normalized,
        startWordIndex: candidate.startWordIndex,
        endWordIndex: candidate.endWordIndex,
        normalizedPhrase:
          candidate.target === "phrase"
            ? candidate.normalized.split(/\s+/u).filter(Boolean)
            : undefined,
        strong: [item.strong]
      });
      open.add(key);
      if (currentCandidateHasDirectEvidence(candidate)) direct.add(key);
    }
  }
  return { open, direct };
}

function currentCandidateHasDirectEvidence(
  candidate: LexicalCandidate
): boolean {
  return (
    !candidate.occupied &&
    candidate.score >= 0.84 &&
    candidate.evidence.some(
      (evidence) =>
        evidence.reviewOnly !== true &&
        CURRENT_DIRECT_EVIDENCE_SOURCES.has(evidence.source)
    )
  );
}

export function upgradeLegacyDecisionChoices(
  decisions: SemanticRefillLlmRawDecision[],
  packet: AgentPacketFile
): SemanticRefillLlmRawDecision[] {
  const candidates = new Map(
    packet.candidates.map((candidate) => [
      candidate.id,
      ensureCandidateChoices(candidate)
    ])
  );
  return decisions.map((decision) => {
    const candidate = candidates.get(decision.id);
    if (!candidate) return decision;
    const matches = candidate.choices.filter(
      (choice) =>
        choice.decision === decision.decision &&
        choice.wordIndex === decision.wordIndex &&
        choice.normalized === decision.normalized &&
        choice.startWordIndex === decision.startWordIndex &&
        choice.endWordIndex === decision.endWordIndex &&
        sameNullableStrings(choice.normalizedPhrase, decision.normalizedPhrase)
    );
    if (matches.length !== 1) return decision;
    return { ...decision, choiceId: matches[0]!.id };
  });
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

export function migrateOverrides(options: {
  bible: string;
  overrides: CuratedStrongOverride[];
  proofs: Map<string, MigrationProof>;
  versesByRef: Map<string, BibleVerse>;
}): {
  overrides: CuratedStrongOverride[];
  counts: Omit<
    ArtifactMigrationReport,
    | "generatedAt"
    | "bible"
    | "artifactRoot"
    | "apply"
    | "consensusFiles"
    | "validConsensusFiles"
    | "invalidConsensusFiles"
    | "missingPackets"
    | "outcomes"
    | "acceptedSafe"
    | "needsWitnessReview"
    | "rejectedRisky"
    | "witnessBackedProofs"
    | "currentOpenProofs"
    | "currentDirectProofs"
    | "decisionRecordsAdded"
    | "errors"
  >;
} {
  let legacyUnfilteredOverrides = 0;
  let promotedOverrides = 0;
  let skippedInvalidTarget = 0;
  let skippedRelocation = 0;
  let skippedCarrierConflict = 0;
  let legacyWithoutCurrentWitnessProof = 0;
  const conflictedIndexes = migrationCarrierConflicts(options);

  const overrides = options.overrides.map((override, index) => {
    if (
      override.bible.toLowerCase() !== options.bible ||
      override.source !== "semantic-refill:llm"
    ) {
      return override;
    }
    legacyUnfilteredOverrides += 1;
    if (override.replace) {
      skippedRelocation += 1;
      return override;
    }
    const proof = options.proofs.get(overridePlacementKey(override));
    if (!proof) {
      legacyWithoutCurrentWitnessProof += 1;
      return override;
    }
    if (!overrideTargetIsCurrent(override, options.versesByRef)) {
      skippedInvalidTarget += 1;
      return override;
    }
    if (conflictedIndexes.has(index)) {
      skippedCarrierConflict += 1;
      return override;
    }
    promotedOverrides += 1;
    return {
      ...override,
      source: "semantic-refill:llm-consensus-filtered",
      reason: [
        override.reason,
        "artifact-migration:current-post-consensus-filter",
        proof.exactWitnessFamilies.size > 0
          ? `exact-witness-families:${[...proof.exactWitnessFamilies].sort().join(",")}`
          : undefined,
        proof.currentDirectDeterministicSupport
          ? "current-direct-deterministic-support:true"
          : undefined,
        `source-review-count:${proof.sourceReviews.size}`
      ]
        .filter(Boolean)
        .join("; ")
    };
  });

  return {
    overrides,
    counts: {
      legacyUnfilteredOverrides,
      promotedOverrides,
      skippedInvalidTarget,
      skippedRelocation,
      skippedCarrierConflict,
      legacyWithoutCurrentWitnessProof
    }
  };
}

function migrationCarrierConflicts(options: {
  bible: string;
  overrides: CuratedStrongOverride[];
  proofs: Map<string, MigrationProof>;
  versesByRef: Map<string, BibleVerse>;
}): Set<number> {
  const candidates = options.overrides.flatMap((override, index) => {
    if (
      override.bible.toLowerCase() !== options.bible ||
      override.source !== "semantic-refill:llm" ||
      override.replace ||
      !options.proofs.has(overridePlacementKey(override)) ||
      !overrideTargetIsCurrent(override, options.versesByRef)
    ) {
      return [];
    }
    return [{ index, override }];
  });
  const conflicted = new Set<number>();
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    const left = candidates[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < candidates.length;
      rightIndex += 1
    ) {
      const right = candidates[rightIndex]!;
      if (!overrideCarriersConflict(left.override, right.override)) continue;
      conflicted.add(left.index);
      conflicted.add(right.index);
    }
  }
  return conflicted;
}

function overrideCarriersConflict(
  left: CuratedStrongOverride,
  right: CuratedStrongOverride
): boolean {
  if (left.ref !== right.ref) return false;
  const leftTarget = left.target ?? "word";
  const rightTarget = right.target ?? "word";
  if (leftTarget === "empty" || rightTarget === "empty") {
    return (
      leftTarget === "empty" &&
      rightTarget === "empty" &&
      left.wordIndex === right.wordIndex
    );
  }
  const leftStart =
    leftTarget === "phrase"
      ? (left.startWordIndex ?? left.wordIndex)
      : left.wordIndex;
  const leftEnd =
    leftTarget === "phrase"
      ? (left.endWordIndex ?? left.wordIndex)
      : left.wordIndex;
  const rightStart =
    rightTarget === "phrase"
      ? (right.startWordIndex ?? right.wordIndex)
      : right.wordIndex;
  const rightEnd =
    rightTarget === "phrase"
      ? (right.endWordIndex ?? right.wordIndex)
      : right.wordIndex;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function overrideTargetIsCurrent(
  override: CuratedStrongOverride,
  versesByRef: Map<string, BibleVerse>
): boolean {
  const verse = versesByRef.get(override.ref);
  if (!verse) return false;
  const words = tokenizeText(verse.text).filter(
    (segment) => segment.kind === "word"
  );
  const target = override.target ?? "word";
  if (target === "empty") {
    return override.wordIndex >= -1 && override.wordIndex < words.length;
  }
  if (target === "phrase") {
    const start = override.startWordIndex ?? override.wordIndex;
    const end = override.endWordIndex ?? override.wordIndex;
    const expected = override.normalizedPhrase ?? [];
    return (
      start >= 0 &&
      end >= start &&
      expected.length === end - start + 1 &&
      expected.every(
        (normalized, offset) => words[start + offset]?.normalized === normalized
      )
    );
  }
  return words[override.wordIndex]?.normalized === override.normalized;
}

export function overridePlacementKey(override: CuratedStrongOverride): string {
  return placementKey({
    bible: override.bible,
    ref: override.ref,
    target: override.target ?? "word",
    wordIndex: override.wordIndex,
    normalized: override.normalized,
    startWordIndex: override.startWordIndex,
    endWordIndex: override.endWordIndex,
    normalizedPhrase: override.normalizedPhrase,
    strong: override.strong
  });
}

function decisionPlacementKey(
  bible: string,
  decision: FilteredDecision["decision"]
): string {
  return placementKey({
    bible,
    ref: decision.ref,
    target: decision.decision,
    wordIndex: decision.wordIndex,
    normalized: decision.normalized,
    startWordIndex: decision.startWordIndex,
    endWordIndex: decision.endWordIndex,
    normalizedPhrase: decision.normalizedPhrase ?? undefined,
    strong: decision.strong
  });
}

function placementKey(options: {
  bible: string;
  ref: string;
  target: string;
  wordIndex?: number | null;
  normalized?: string | null;
  startWordIndex?: number | null;
  endWordIndex?: number | null;
  normalizedPhrase?: string[];
  strong: string[];
}): string {
  const wordIndex =
    options.target === "word" || options.target === "empty"
      ? (options.wordIndex ?? "")
      : "";
  const normalized =
    options.target === "word" ? (options.normalized ?? "") : "";
  const startWordIndex =
    options.target === "phrase" ? (options.startWordIndex ?? "") : "";
  const endWordIndex =
    options.target === "phrase" ? (options.endWordIndex ?? "") : "";
  const normalizedPhrase =
    options.target === "phrase"
      ? (options.normalizedPhrase?.join(" ") ?? "")
      : "";
  return [
    options.bible.toLowerCase(),
    options.ref,
    options.target,
    wordIndex,
    normalized,
    startWordIndex,
    endWordIndex,
    normalizedPhrase,
    [...options.strong]
      .map((strong) => strong.toUpperCase())
      .sort()
      .join(",")
  ].join("|");
}

function assertDistinctConsensusModel(model: string | undefined): void {
  const match = model?.match(/^consensus\(([^,]+),([^,]+)\)$/u);
  if (!match) throw new Error(`unverified-consensus-model:${model ?? ""}`);
  const left = match[1]!.trim().toLowerCase();
  const right = match[2]!.trim().toLowerCase();
  if (!left || !right || left === right) {
    throw new Error(`unverified-consensus-model:${model}`);
  }
}

function resolveSourcePacket(
  sourcePacket: string | undefined,
  reviewPath: string
): string | undefined {
  if (!sourcePacket) return undefined;
  const candidates = [
    path.resolve(sourcePacket),
    path.resolve(path.dirname(reviewPath), sourcePacket)
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function findConsensusReviews(root: string): Promise<string[]> {
  const output: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.name.endsWith("-consensus-visible-high.json")) {
        output.push(candidate);
      }
    }
  }
  await visit(root);
  return output.sort();
}

async function readArray<T>(filePath: string): Promise<T[]> {
  if (!existsSync(filePath)) return [];
  const value = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!Array.isArray(value)) {
    throw new Error(`expected-json-array:${filePath}`);
  }
  return value as T[];
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

async function main(): Promise<void> {
  const bible = readArg("bible", "nbs").toLowerCase();
  const overridesPath = readArg(
    "overrides",
    "data/curated-strong-overrides.json"
  );
  if (process.argv.includes("--revert-artifact-migration")) {
    let reverted = 0;
    await withReviewFileLock(async () => {
      const current = await readArray<CuratedStrongOverride>(overridesPath);
      const result = revertArtifactMigrations(current);
      reverted = result.reverted;
      await writeJsonFileAtomic(overridesPath, result.overrides);
    });
    console.log(JSON.stringify({ bible, overridesPath, reverted }, null, 2));
    return;
  }
  const report = await migrateSemanticRefillArtifacts({
    bible,
    artifactRoot: readArg("artifact-root", `outputs/gap-review/${bible}`),
    overridesPath,
    decisionLedgerPath: readArg(
      "decision-ledger",
      "data/strong-review-decisions.json"
    ),
    lexicalReportPath: readArg(
      "lexical-report",
      `outputs/lexical-candidates/${bible}/bible-${bible}-lexical-candidates-all.json`
    ),
    outputPath: readArg(
      "output",
      `outputs/gap-review/${bible}/semantic-refill-artifact-migration.json`
    ),
    apply: process.argv.includes("--apply")
  });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1]?.endsWith("migrateSemanticRefillArtifacts.ts")) {
  await main();
}
