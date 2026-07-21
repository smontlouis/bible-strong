import { BOOK_IDS } from "./books.js";

export const VERSE_CORRESPONDENCE_MANIFEST_VERSION = 2 as const;
export const VERSE_CORRESPONDENCE_DETECTOR_VERSION =
  "deterministic-book-alignment-v3" as const;
export const LEGACY_VERSE_CORRESPONDENCE_DETECTOR_VERSIONS = [
  "deterministic-book-alignment-v2"
] as const;
type VerseCorrespondenceDetectorVersion =
  | typeof VERSE_CORRESPONDENCE_DETECTOR_VERSION
  | (typeof LEGACY_VERSE_CORRESPONDENCE_DETECTOR_VERSIONS)[number];

export type VerseCorrespondenceKind =
  | "identity"
  | "merge"
  | "split"
  | "resegment"
  | "shift"
  | "chapter-boundary"
  | "omitted"
  | "added";

export interface VerseText {
  ref: string;
  text: string;
}

export interface CanonicalWitness {
  name: string;
  verses: readonly VerseText[];
}

export interface VerseCorrespondenceEvidence {
  /** Text similarity before the structural transition penalty, in [0, 1]. */
  score: number;
}

export interface VerseCorrespondenceBlock {
  targetRefs: string[];
  canonicalRefs: string[];
  kind: VerseCorrespondenceKind;
  reason?: string;
  evidence?: VerseCorrespondenceEvidence;
}

export interface VerseCorrespondenceDetectionMetadata {
  detector: VerseCorrespondenceDetectorVersion;
  witnesses: string[];
  score: number;
  margin: number;
}

export interface VerseCorrespondenceManifest {
  schemaVersion: typeof VERSE_CORRESPONDENCE_MANIFEST_VERSION;
  bible: string;
  canonicalVersification: string;
  blocks: VerseCorrespondenceBlock[];
  detection?: VerseCorrespondenceDetectionMetadata;
}

export interface VerseCorrespondenceValidationScope {
  targetRefs: readonly string[];
  canonicalRefs: readonly string[];
}

export interface VerseCorrespondenceDetectionInput {
  bible: string;
  canonicalVersification: string;
  targetVerses: readonly VerseText[];
  canonicalWitnesses: readonly CanonicalWitness[];
}

export interface VerseCorrespondenceDetectionOptions {
  maxTargetSpan?: number;
  maxCanonicalSpan?: number;
  maxOmittedSpan?: number;
  minimumBlockScore?: number;
  ambiguityMargin?: number;
  omissionPenalty?: number;
  structuralPenalty?: number;
  /** Maximum cumulative target/canonical index drift kept by the DP. */
  maxIndexDrift?: number;
}

export interface VerseCorrespondenceAlternative {
  score: number;
  blocks: VerseCorrespondenceBlock[];
}

export type VerseCorrespondenceDetectionResult =
  | {
      status: "accepted";
      score: number;
      margin: number;
      manifest: VerseCorrespondenceManifest;
      alternatives: VerseCorrespondenceAlternative[];
      issues: [];
    }
  | {
      status: "ambiguous" | "unresolved";
      score: number;
      margin: number;
      manifest?: undefined;
      alternatives: VerseCorrespondenceAlternative[];
      issues: string[];
    };

interface ParsedVerseReference {
  ref: string;
  bookId: string;
  bookOrder: number;
  chapter: number;
  verse: number;
}

interface NormalizedVerse extends VerseText {
  parsed: ParsedVerseReference;
  normalizedText: string;
}

interface DetectorSettings {
  maxTargetSpan: number;
  maxCanonicalSpan: number;
  maxOmittedSpan: number;
  minimumBlockScore: number;
  ambiguityMargin: number;
  omissionPenalty: number;
  structuralPenalty: number;
  maxIndexDrift: number;
}

interface PathCandidate {
  rawScore: number;
  blocks: VerseCorrespondenceBlock[];
  signature: string;
}

const BOOK_ORDER = new Map<string, number>(
  BOOK_IDS.map((bookId, index) => [bookId, index])
);
const REFERENCE_PATTERN = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/u;
const DEFAULT_SETTINGS: DetectorSettings = {
  maxTargetSpan: 3,
  maxCanonicalSpan: 3,
  maxOmittedSpan: 2,
  minimumBlockScore: 0.34,
  ambiguityMargin: 0.06,
  omissionPenalty: 0.62,
  structuralPenalty: 0.2,
  maxIndexDrift: 24
};
const KEPT_PATHS_PER_STATE = 2;

export class VerseCorrespondenceValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid verse correspondence manifest:\n- ${issues.join("\n- ")}`);
    this.name = "VerseCorrespondenceValidationError";
    this.issues = issues;
  }
}

/**
 * Validates a frozen correspondence manifest against the exact target and
 * canonical scopes it is intended to reconcile. Invalid or incomplete maps are
 * rejected; callers must never fall back to equal-looking verse numbers.
 */
export function validateVerseCorrespondenceManifest(
  manifest: VerseCorrespondenceManifest,
  scope: VerseCorrespondenceValidationScope
): VerseCorrespondenceManifest {
  const issues: string[] = [];
  if (manifest.schemaVersion !== VERSE_CORRESPONDENCE_MANIFEST_VERSION) {
    issues.push(
      `unsupported schemaVersion ${String(manifest.schemaVersion)}; expected ${VERSE_CORRESPONDENCE_MANIFEST_VERSION}`
    );
  }
  if (!manifest.bible.trim()) issues.push("bible must not be empty");
  if (!manifest.canonicalVersification.trim()) {
    issues.push("canonicalVersification must not be empty");
  }
  if (manifest.blocks.length === 0 && scope.targetRefs.length > 0) {
    issues.push("blocks must cover the non-empty target scope");
  }

  const expectedTargets = validateScopeReferences(
    scope.targetRefs,
    "target scope",
    issues
  );
  const expectedCanonical = validateScopeReferences(
    scope.canonicalRefs,
    "canonical scope",
    issues
  );
  const actualTargets: string[] = [];
  const actualCanonical: string[] = [];
  const seenTargets = new Set<string>();
  const seenCanonical = new Set<string>();

  for (const [index, block] of manifest.blocks.entries()) {
    const label = `block ${index + 1}`;
    const targets = validateBlockReferences(
      block.targetRefs,
      `${label} targetRefs`,
      issues
    );
    const canonical = validateBlockReferences(
      block.canonicalRefs,
      `${label} canonicalRefs`,
      issues
    );

    validateBlockShape(block, label, targets, canonical, issues);
    appendUnique(
      targets,
      actualTargets,
      seenTargets,
      `${label} target`,
      issues
    );
    appendUnique(
      canonical,
      actualCanonical,
      seenCanonical,
      `${label} canonical source`,
      issues
    );

    if (block.evidence) {
      if (
        !Number.isFinite(block.evidence.score) ||
        block.evidence.score < 0 ||
        block.evidence.score > 1
      ) {
        issues.push(`${label} evidence.score must be in [0, 1]`);
      }
    }
  }

  validateFlattenedCoverage(actualTargets, expectedTargets, "target", issues);
  validateFlattenedCoverage(
    actualCanonical,
    expectedCanonical,
    "canonical source",
    issues
  );

  if (manifest.detection) {
    if (!isSupportedDetectorVersion(manifest.detection.detector)) {
      issues.push(`unsupported detector ${manifest.detection.detector}`);
    }
    validateUnitInterval(manifest.detection.score, "detection.score", issues);
    validateUnitInterval(manifest.detection.margin, "detection.margin", issues);
    if (manifest.detection.witnesses.length === 0) {
      issues.push("detection.witnesses must not be empty");
    }
  }

  if (issues.length > 0) {
    throw new VerseCorrespondenceValidationError(issues);
  }
  return manifest;
}

function isSupportedDetectorVersion(
  detector: string
): detector is VerseCorrespondenceDetectorVersion {
  return (
    detector === VERSE_CORRESPONDENCE_DETECTOR_VERSION ||
    LEGACY_VERSE_CORRESPONDENCE_DETECTOR_VERSIONS.some(
      (legacy) => legacy === detector
    )
  );
}

/**
 * Produces an offline candidate manifest by monotone dynamic programming over
 * one complete Bible book. It returns no manifest unless the best path clears
 * both the text-quality gate and the best-vs-runner-up margin.
 */
export function detectVerseCorrespondence(
  input: VerseCorrespondenceDetectionInput,
  options: VerseCorrespondenceDetectionOptions = {}
): VerseCorrespondenceDetectionResult {
  const settings = detectorSettings(options);
  const inputIssues: string[] = [];
  if (!input.bible.trim()) inputIssues.push("bible must not be empty");
  if (!input.canonicalVersification.trim()) {
    inputIssues.push("canonicalVersification must not be empty");
  }

  const targets = normalizeDetectorVerses(
    input.targetVerses,
    "target verses",
    inputIssues,
    false
  );
  if (input.canonicalWitnesses.length === 0) {
    inputIssues.push("at least one canonical witness is required");
  }
  const primaryWitness = input.canonicalWitnesses[0];
  const canonical = normalizeDetectorVerses(
    primaryWitness?.verses ?? [],
    "primary canonical witness",
    inputIssues,
    true
  );
  validateDetectorBookScope(targets, canonical, inputIssues);

  const witnessMaps = input.canonicalWitnesses.map((witness, index) => {
    if (!witness.name.trim()) {
      inputIssues.push(`canonical witness ${index + 1} has an empty name`);
    }
    const verses = normalizeDetectorVerses(
      witness.verses,
      `canonical witness ${witness.name || index + 1}`,
      inputIssues,
      true
    );
    const map = new Map(
      verses.map((verse) => [verse.ref, verse.normalizedText])
    );
    for (const verse of verses) {
      if (!canonical.some((candidate) => candidate.ref === verse.ref)) {
        inputIssues.push(
          `canonical witness ${witness.name || index + 1} contains out-of-scope ref ${verse.ref}`
        );
      }
    }
    return { name: witness.name, map };
  });

  if (targets.length === 0 || canonical.length === 0) {
    inputIssues.push("target and canonical book scopes must both be non-empty");
  }
  if (inputIssues.length > 0) {
    return unresolvedResult(inputIssues);
  }

  const paths = bestAlignmentPaths(targets, canonical, witnessMaps, settings);
  const best = paths[0];
  if (!best) {
    return unresolvedResult([
      "no monotone alignment path covers the target and canonical scopes"
    ]);
  }

  const score = mappedSimilarityScore(best.blocks);
  const runnerUp = paths[1];
  const margin = runnerUp ? clamp01(best.rawScore - runnerUp.rawScore) : 1;
  const alternatives = paths.map((path) => ({
    score: mappedSimilarityScore(path.blocks),
    blocks: path.blocks
  }));
  const weakBlocks = best.blocks.filter(
    (block) =>
      block.kind !== "omitted" &&
      block.kind !== "added" &&
      (block.evidence?.score ?? 0) < settings.minimumBlockScore
  );
  const issues: string[] = [];
  if (weakBlocks.length > 0) {
    issues.push(
      `${weakBlocks.length} mapped block(s) fall below minimumBlockScore ${settings.minimumBlockScore}`
    );
  }
  if (runnerUp && margin < settings.ambiguityMargin) {
    issues.push(
      `best-path margin ${margin.toFixed(6)} is below ambiguityMargin ${settings.ambiguityMargin}`
    );
  }

  if (issues.length > 0) {
    return {
      status:
        runnerUp && margin < settings.ambiguityMargin
          ? "ambiguous"
          : "unresolved",
      score,
      margin,
      alternatives,
      issues
    };
  }

  const manifest: VerseCorrespondenceManifest = {
    schemaVersion: VERSE_CORRESPONDENCE_MANIFEST_VERSION,
    bible: input.bible,
    canonicalVersification: input.canonicalVersification,
    blocks: best.blocks,
    detection: {
      detector: VERSE_CORRESPONDENCE_DETECTOR_VERSION,
      witnesses: witnessMaps.map((witness) => witness.name),
      score,
      margin
    }
  };
  validateVerseCorrespondenceManifest(manifest, {
    targetRefs: targets.map((verse) => verse.ref),
    canonicalRefs: canonical.map((verse) => verse.ref)
  });

  return {
    status: "accepted",
    score,
    margin,
    manifest,
    alternatives,
    issues: []
  };
}

/** Removes markup and normalizes punctuation/diacritics for witness scoring. */
export function normalizeVerseText(text: string): string {
  return text
    .replace(/<[^>]*>/gu, " ")
    .replace(/&(?:nbsp|#160);/giu, " ")
    .replace(/&(?:amp|#38);/giu, "&")
    .replace(/&(?:quot|#34);/giu, '"')
    .replace(/&(?:apos|#39);/giu, "'")
    .normalize("NFD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[’']/gu, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function bestAlignmentPaths(
  targets: readonly NormalizedVerse[],
  canonical: readonly NormalizedVerse[],
  witnesses: readonly { name: string; map: Map<string, string> }[],
  settings: DetectorSettings
): PathCandidate[] {
  const width = canonical.length + 1;
  const states: PathCandidate[][] = Array.from(
    { length: (targets.length + 1) * width },
    () => []
  );
  states[0] = [{ rawScore: 0, blocks: [], signature: "" }];
  const blockCache = new Map<string, VerseCorrespondenceBlock>();

  for (let targetIndex = 0; targetIndex <= targets.length; targetIndex += 1) {
    for (
      let canonicalIndex = 0;
      canonicalIndex <= canonical.length;
      canonicalIndex += 1
    ) {
      const candidates = states[targetIndex * width + canonicalIndex] ?? [];
      if (Math.abs(targetIndex - canonicalIndex) > settings.maxIndexDrift) {
        continue;
      }
      if (candidates.length === 0) continue;

      for (const candidate of candidates) {
        for (
          let targetSpan = 1;
          targetSpan <= settings.maxTargetSpan &&
          targetIndex + targetSpan <= targets.length;
          targetSpan += 1
        ) {
          for (
            let canonicalSpan = 1;
            canonicalSpan <= settings.maxCanonicalSpan &&
            canonicalIndex + canonicalSpan <= canonical.length;
            canonicalSpan += 1
          ) {
            const targetSlice = targets.slice(
              targetIndex,
              targetIndex + targetSpan
            );
            const canonicalSlice = canonical.slice(
              canonicalIndex,
              canonicalIndex + canonicalSpan
            );
            const cacheKey = `${targetIndex}:${targetSpan}:${canonicalIndex}:${canonicalSpan}`;
            const block =
              blockCache.get(cacheKey) ??
              scoredBlock(targetSlice, canonicalSlice, witnesses);
            blockCache.set(cacheKey, block);
            const contribution =
              (block.evidence?.score ?? 0) *
                Math.max(targetSpan, canonicalSpan) -
              transitionPenalty(block, targetSpan, canonicalSpan, settings);
            addPathCandidate(
              states,
              width,
              targetIndex + targetSpan,
              canonicalIndex + canonicalSpan,
              candidate,
              block,
              contribution
            );
          }
        }

        for (
          let canonicalSpan = 1;
          canonicalSpan <= settings.maxOmittedSpan &&
          canonicalIndex + canonicalSpan <= canonical.length;
          canonicalSpan += 1
        ) {
          const refs = canonical
            .slice(canonicalIndex, canonicalIndex + canonicalSpan)
            .map((verse) => verse.ref);
          const block: VerseCorrespondenceBlock = {
            targetRefs: [],
            canonicalRefs: refs,
            kind: "omitted",
            reason:
              "No target verse was assigned by the deterministic detector."
          };
          addPathCandidate(
            states,
            width,
            targetIndex,
            canonicalIndex + canonicalSpan,
            candidate,
            block,
            -settings.omissionPenalty * canonicalSpan
          );
        }

        for (
          let targetSpan = 1;
          targetSpan <= settings.maxOmittedSpan &&
          targetIndex + targetSpan <= targets.length;
          targetSpan += 1
        ) {
          const refs = targets
            .slice(targetIndex, targetIndex + targetSpan)
            .map((verse) => verse.ref);
          const block: VerseCorrespondenceBlock = {
            targetRefs: refs,
            canonicalRefs: [],
            kind: "added",
            reason:
              "No canonical source verse was assigned by the deterministic detector."
          };
          addPathCandidate(
            states,
            width,
            targetIndex + targetSpan,
            canonicalIndex,
            candidate,
            block,
            -settings.omissionPenalty * targetSpan
          );
        }
      }
    }
  }

  return states[targets.length * width + canonical.length] ?? [];
}

function addPathCandidate(
  states: PathCandidate[][],
  width: number,
  targetIndex: number,
  canonicalIndex: number,
  previous: PathCandidate,
  block: VerseCorrespondenceBlock,
  contribution: number
): void {
  const signature = `${previous.signature}|${block.kind}:${block.targetRefs.join(",")}=${block.canonicalRefs.join(",")}`;
  const next: PathCandidate = {
    rawScore: previous.rawScore + contribution,
    blocks: [...previous.blocks, block],
    signature
  };
  const state = states[targetIndex * width + canonicalIndex];
  if (!state) return;
  const bySignature = new Map(
    state.map((candidate) => [candidate.signature, candidate])
  );
  const existing = bySignature.get(signature);
  if (!existing || next.rawScore > existing.rawScore) {
    bySignature.set(signature, next);
  }
  state.splice(
    0,
    state.length,
    ...[...bySignature.values()]
      .sort(
        (left, right) =>
          right.rawScore - left.rawScore ||
          compareSignatures(left.signature, right.signature)
      )
      .slice(0, KEPT_PATHS_PER_STATE)
  );
}

function scoredBlock(
  targets: readonly NormalizedVerse[],
  canonical: readonly NormalizedVerse[],
  witnesses: readonly { name: string; map: Map<string, string> }[]
): VerseCorrespondenceBlock {
  const targetText = targets.map((verse) => verse.normalizedText).join(" ");
  const scores = witnesses.flatMap((witness) => {
    const texts = canonical.map((verse) => witness.map.get(verse.ref));
    return texts.some((text) => text === undefined)
      ? []
      : [normalizedTextSimilarity(targetText, texts.join(" "))];
  });
  const score =
    scores.length === 0
      ? 0
      : scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return {
    targetRefs: targets.map((verse) => verse.ref),
    canonicalRefs: canonical.map((verse) => verse.ref),
    kind: inferBlockKind(targets, canonical),
    evidence: { score: clamp01(score) }
  };
}

function inferBlockKind(
  targets: readonly NormalizedVerse[],
  canonical: readonly NormalizedVerse[]
): VerseCorrespondenceKind {
  if (crossesOrMovesChapter(targets, canonical)) return "chapter-boundary";
  if (targets.length === 1 && canonical.length > 1) return "merge";
  if (targets.length > 1 && canonical.length === 1) return "split";
  if (targets.length > 1 && canonical.length > 1) return "resegment";
  return targets[0]?.ref === canonical[0]?.ref ? "identity" : "shift";
}

function crossesOrMovesChapter(
  targets: readonly NormalizedVerse[],
  canonical: readonly NormalizedVerse[]
): boolean {
  const targetChapters = new Set(targets.map((verse) => verse.parsed.chapter));
  const canonicalChapters = new Set(
    canonical.map((verse) => verse.parsed.chapter)
  );
  return (
    targetChapters.size > 1 ||
    canonicalChapters.size > 1 ||
    targets[0]?.parsed.chapter !== canonical[0]?.parsed.chapter ||
    targets.at(-1)?.parsed.chapter !== canonical.at(-1)?.parsed.chapter
  );
}

function transitionPenalty(
  block: VerseCorrespondenceBlock,
  targetSpan: number,
  canonicalSpan: number,
  settings: DetectorSettings
): number {
  const kind = block.kind;
  if (kind === "identity") return 0;
  const spanCost = Math.max(targetSpan, canonicalSpan) - 1;
  // A broad N:M block can otherwise tie exactly with the more informative
  // sequence of identity/merge/split/shift blocks because both concatenate the
  // same text. Prefer the narrower explanation unless crossing material makes
  // its per-verse similarities genuinely worse.
  const jointSpanCost = Math.max(0, Math.min(targetSpan, canonicalSpan) - 1);
  if (
    kind === "resegment" &&
    targetSpan === 2 &&
    canonicalSpan === 2 &&
    block.targetRefs.every((ref, index) => ref === block.canonicalRefs[index])
  ) {
    return settings.structuralPenalty * 1.25;
  }
  return (
    settings.structuralPenalty * (1 + spanCost) +
    settings.structuralPenalty * 0.5 * jointSpanCost
  );
}

function normalizedTextSimilarity(
  normalizedLeft: string,
  normalizedRight: string
): number {
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftTokens = normalizedLeft.split(" ");
  const rightTokens = normalizedRight.split(" ");
  const tokenScore = multisetDice(leftTokens, rightTokens);
  const trigramScore = multisetDice(
    characterNgrams(normalizedLeft, 3),
    characterNgrams(normalizedRight, 3)
  );
  const lengthRatio =
    Math.min(normalizedLeft.length, normalizedRight.length) /
    Math.max(normalizedLeft.length, normalizedRight.length);
  return clamp01(tokenScore * 0.55 + trigramScore * 0.35 + lengthRatio * 0.1);
}

function characterNgrams(value: string, width: number): string[] {
  const compact = ` ${value} `;
  if (compact.length <= width) return [compact];
  const grams: string[] = [];
  for (let index = 0; index <= compact.length - width; index += 1) {
    grams.push(compact.slice(index, index + width));
  }
  return grams;
}

function multisetDice(
  left: readonly string[],
  right: readonly string[]
): number {
  if (left.length === 0 || right.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const value of left) counts.set(value, (counts.get(value) ?? 0) + 1);
  let intersection = 0;
  for (const value of right) {
    const count = counts.get(value) ?? 0;
    if (count === 0) continue;
    intersection += 1;
    counts.set(value, count - 1);
  }
  return (2 * intersection) / (left.length + right.length);
}

function mappedSimilarityScore(
  blocks: readonly VerseCorrespondenceBlock[]
): number {
  let weightedScore = 0;
  let weight = 0;
  for (const block of blocks) {
    if (block.kind === "omitted" || block.kind === "added") continue;
    const blockWeight = Math.max(
      block.targetRefs.length,
      block.canonicalRefs.length
    );
    weightedScore += (block.evidence?.score ?? 0) * blockWeight;
    weight += blockWeight;
  }
  return weight === 0 ? 0 : clamp01(weightedScore / weight);
}

function normalizeDetectorVerses(
  verses: readonly VerseText[],
  label: string,
  issues: string[],
  allowEmpty: boolean
): NormalizedVerse[] {
  const normalized: NormalizedVerse[] = [];
  const seen = new Set<string>();
  for (const [index, verse] of verses.entries()) {
    const parsed = parseVerseReference(verse.ref);
    if (!parsed) {
      issues.push(`${label} item ${index + 1} has invalid ref ${verse.ref}`);
      continue;
    }
    if (seen.has(parsed.ref)) {
      issues.push(`${label} duplicates ref ${parsed.ref}`);
      continue;
    }
    seen.add(parsed.ref);
    if (!allowEmpty && !normalizeVerseText(verse.text)) {
      issues.push(`${label} ref ${parsed.ref} has empty normalized text`);
    }
    normalized.push({
      ref: parsed.ref,
      text: verse.text,
      parsed,
      normalizedText: normalizeVerseText(verse.text)
    });
  }
  normalized.sort((left, right) =>
    compareParsedRefs(left.parsed, right.parsed)
  );
  return normalized;
}

function validateDetectorBookScope(
  targets: readonly NormalizedVerse[],
  canonical: readonly NormalizedVerse[],
  issues: string[]
): void {
  const books = new Set(
    [...targets, ...canonical].map((verse) => verse.parsed.bookId)
  );
  if (books.size > 1) {
    issues.push(
      `detector input must contain exactly one complete book; found ${[...books].join(", ")}`
    );
  }
}

function detectorSettings(
  options: VerseCorrespondenceDetectionOptions
): DetectorSettings {
  const settings = { ...DEFAULT_SETTINGS, ...options };
  for (const key of [
    "maxTargetSpan",
    "maxCanonicalSpan",
    "maxOmittedSpan",
    "maxIndexDrift"
  ] as const) {
    if (!Number.isInteger(settings[key]) || settings[key] < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  for (const key of ["minimumBlockScore", "ambiguityMargin"] as const) {
    if (
      !Number.isFinite(settings[key]) ||
      settings[key] < 0 ||
      settings[key] > 1
    ) {
      throw new Error(`${key} must be in [0, 1]`);
    }
  }
  for (const key of ["omissionPenalty", "structuralPenalty"] as const) {
    if (!Number.isFinite(settings[key]) || settings[key] < 0) {
      throw new Error(`${key} must be a non-negative finite number`);
    }
  }
  return settings;
}

function validateScopeReferences(
  refs: readonly string[],
  label: string,
  issues: string[]
): string[] {
  const parsed: ParsedVerseReference[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const value = parseVerseReference(ref);
    if (!value) {
      issues.push(`${label} has invalid ref ${ref}`);
      continue;
    }
    if (seen.has(value.ref))
      issues.push(`${label} duplicates ref ${value.ref}`);
    seen.add(value.ref);
    parsed.push(value);
  }
  validateStrictOrder(parsed, label, issues);
  return parsed.map((value) => value.ref);
}

function validateBlockReferences(
  refs: readonly string[],
  label: string,
  issues: string[]
): ParsedVerseReference[] {
  const parsed: ParsedVerseReference[] = [];
  for (const ref of refs) {
    const value = parseVerseReference(ref);
    if (!value) issues.push(`${label} has invalid ref ${ref}`);
    else parsed.push(value);
  }
  validateStrictOrder(parsed, label, issues);
  return parsed;
}

function validateBlockShape(
  block: VerseCorrespondenceBlock,
  label: string,
  targets: readonly ParsedVerseReference[],
  canonical: readonly ParsedVerseReference[],
  issues: string[]
): void {
  if (block.kind === "omitted") {
    if (targets.length !== 0 || canonical.length === 0) {
      issues.push(
        `${label} omitted blocks require zero targets and at least one source`
      );
    }
  } else if (block.kind === "added") {
    if (targets.length === 0 || canonical.length !== 0) {
      issues.push(
        `${label} added blocks require at least one target and zero sources`
      );
    }
  } else if (targets.length === 0 || canonical.length === 0) {
    issues.push(`${label} mapped blocks require target and canonical refs`);
  }

  if (block.kind === "identity") {
    if (
      targets.length !== 1 ||
      canonical.length !== 1 ||
      targets[0]?.ref !== canonical[0]?.ref
    ) {
      issues.push(`${label} identity must map one ref to the identical ref`);
    }
  }
  if (
    block.kind === "merge" &&
    !(targets.length === 1 && canonical.length > 1)
  ) {
    issues.push(`${label} merge must map one target to multiple sources`);
  }
  if (
    block.kind === "split" &&
    !(targets.length > 1 && canonical.length === 1)
  ) {
    issues.push(`${label} split must map multiple targets to one source`);
  }
  if (
    block.kind === "resegment" &&
    !(targets.length > 1 && canonical.length > 1)
  ) {
    issues.push(
      `${label} resegment must map multiple targets to multiple sources`
    );
  }
  if (
    block.kind === "shift" &&
    !(
      targets.length === 1 &&
      canonical.length === 1 &&
      targets[0]?.ref !== canonical[0]?.ref
    )
  ) {
    issues.push(
      `${label} shift must map one target to one different source ref`
    );
  }
  if (block.kind === "chapter-boundary") {
    if (targets.length === 0 || canonical.length === 0) {
      issues.push(`${label} chapter-boundary must be a mapped block`);
    } else if (!crossesParsedChapter(targets, canonical)) {
      issues.push(`${label} chapter-boundary does not cross or move a chapter`);
    }
  }

  const blockBooks = new Set(
    [...targets, ...canonical].map((value) => value.bookId)
  );
  if (blockBooks.size > 1) {
    issues.push(`${label} must not cross a book boundary`);
  }
}

function crossesParsedChapter(
  targets: readonly ParsedVerseReference[],
  canonical: readonly ParsedVerseReference[]
): boolean {
  return (
    new Set(targets.map((value) => value.chapter)).size > 1 ||
    new Set(canonical.map((value) => value.chapter)).size > 1 ||
    targets[0]?.chapter !== canonical[0]?.chapter ||
    targets.at(-1)?.chapter !== canonical.at(-1)?.chapter
  );
}

function appendUnique(
  refs: readonly ParsedVerseReference[],
  flattened: string[],
  seen: Set<string>,
  label: string,
  issues: string[]
): void {
  for (const ref of refs) {
    if (seen.has(ref.ref)) issues.push(`${label} ref ${ref.ref} is duplicated`);
    seen.add(ref.ref);
    const previous = flattened.at(-1);
    const parsedPrevious = previous ? parseVerseReference(previous) : undefined;
    if (parsedPrevious && compareParsedRefs(parsedPrevious, ref) >= 0) {
      issues.push(`${label} ref ${ref.ref} is not globally monotone`);
    }
    flattened.push(ref.ref);
  }
}

function validateFlattenedCoverage(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
  issues: string[]
): void {
  if (actual.length !== expected.length) {
    issues.push(
      `${label} coverage has ${actual.length} refs; expected ${expected.length}`
    );
  }
  const maximum = Math.max(actual.length, expected.length);
  for (let index = 0; index < maximum; index += 1) {
    if (actual[index] !== expected[index]) {
      issues.push(
        `${label} coverage differs at index ${index}: got ${actual[index] ?? "<missing>"}, expected ${expected[index] ?? "<none>"}`
      );
      break;
    }
  }
}

function validateStrictOrder(
  refs: readonly ParsedVerseReference[],
  label: string,
  issues: string[]
): void {
  for (let index = 1; index < refs.length; index += 1) {
    const previous = refs[index - 1];
    const current = refs[index];
    if (previous && current && compareParsedRefs(previous, current) >= 0) {
      issues.push(`${label} must be strictly ordered at ${current.ref}`);
    }
  }
}

function validateUnitInterval(
  value: number,
  label: string,
  issues: string[]
): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    issues.push(`${label} must be in [0, 1]`);
  }
}

function parseVerseReference(ref: string): ParsedVerseReference | undefined {
  const match = ref.match(REFERENCE_PATTERN);
  if (!match) return undefined;
  const bookId = match[1] ?? "";
  const bookOrder = BOOK_ORDER.get(bookId);
  const chapter = Number.parseInt(match[2] ?? "", 10);
  const verse = Number.parseInt(match[3] ?? "", 10);
  if (
    bookOrder === undefined ||
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    !Number.isSafeInteger(verse) ||
    verse < 1
  ) {
    return undefined;
  }
  return {
    ref: `${bookId}.${chapter}.${verse}`,
    bookId,
    bookOrder,
    chapter,
    verse
  };
}

function compareParsedRefs(
  left: ParsedVerseReference,
  right: ParsedVerseReference
): number {
  return (
    left.bookOrder - right.bookOrder ||
    left.chapter - right.chapter ||
    left.verse - right.verse
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function compareSignatures(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function unresolvedResult(
  issues: string[]
): VerseCorrespondenceDetectionResult {
  return {
    status: "unresolved",
    score: 0,
    margin: 0,
    alternatives: [],
    issues
  };
}
