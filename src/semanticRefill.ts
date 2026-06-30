import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type CuratedStrongOverride,
  getCuratedStrongOverrides
} from "./curatedStrongOverrides.js";
import {
  type StrongLedgerAnnotation,
  type StrongLedgerToken,
  type StrongLedgerVerse
} from "./strongLedger.js";
import {
  readStrongLedgerSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import { normalizeWord } from "./tokenize.js";

export type CandidateTarget =
  | "word"
  | "phrase"
  | "empty"
  | "technical"
  | "reject";
export type RefillPriority =
  | "semantic-high"
  | "semantic-medium"
  | "function-low"
  | "technical-skip";
export type DecisionStatus = "accept" | "pending-human" | "reject";

export interface SemanticRefillLexiconEntry {
  strong: string;
  forms: string[][];
  priority: RefillPriority;
  source: string;
  evidence: string[];
  confidence: number;
  autoAccept?: boolean;
}

export interface SemanticRefillCandidate {
  target: CandidateTarget;
  strong: string;
  wordIndex?: number;
  normalizedWord?: string;
  startWordIndex?: number;
  endWordIndex?: number;
  normalizedPhrase?: string[];
  score: number;
  evidence: string[];
}

export interface SemanticRefillAuditItem {
  bible: string;
  ref: string;
  text: string;
  tokens: StrongLedgerToken[];
  auditKind?: "missing" | "relocation";
  annotation: Pick<
    StrongLedgerAnnotation,
    | "id"
    | "strong"
    | "visibility"
    | "placement"
    | "insertAfterWordIndex"
    | "confidence"
    | "source"
    | "diagnostics"
    | "referenceSupport"
  >;
  strong: string;
  currentPlacement: string;
  currentTarget?: {
    target: "word" | "phrase" | "empty" | "technical";
    wordIndex?: number;
    normalizedWord?: string;
    startWordIndex?: number;
    endWordIndex?: number;
    normalizedPhrase?: string[];
  };
  referenceSupport: string[];
  originalInventory: string[];
  referenceInventory: Record<string, string[]>;
  candidateForms: string[][];
  candidates: SemanticRefillCandidate[];
  priority: RefillPriority;
  eligible: boolean;
  reason: string;
}

export interface SemanticRefillDecision extends CuratedStrongOverride {
  status: DecisionStatus;
  score: number;
  priority: RefillPriority;
  evidence: string[];
}

export interface SemanticRefillRunResult {
  candidates: SemanticRefillAuditItem[];
  decisions: SemanticRefillDecision[];
  pending: SemanticRefillDecision[];
  rejected: SemanticRefillDecision[];
  metrics: SemanticRefillMetrics;
}

export interface SemanticRefillMetrics {
  bible: string;
  scope: string;
  verseCount: number;
  advancedEmptySemanticBefore: number;
  advancedTechnicalBefore: number;
  accepted: number;
  acceptedWord: number;
  acceptedPhrase: number;
  pendingHuman: number;
  rejected: number;
}

interface RunOptions {
  bible: string;
  scope: string;
  inputDir: string;
  outputDir: string;
  overridesPath: string;
  lexiconPath: string;
  apply: boolean;
}

const DEFAULT_LEXICON: SemanticRefillLexiconEntry[] = [];

const TECHNICAL_STRONG = new Set([
  "H0853",
  "H0834",
  "H0996",
  "H5921",
  "H0413",
  "G3588",
  "G1722",
  "G1519"
]);

export const WEAK_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "car",
  "ce",
  "ces",
  "de",
  "des",
  "du",
  "elle",
  "en",
  "et",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "lui",
  "ne",
  "pas",
  "pour",
  "que",
  "qui",
  "se",
  "sur",
  "un",
  "une",
  "y"
]);

export async function runSemanticRefill(
  options: RunOptions
): Promise<SemanticRefillRunResult> {
  const bible = readStrongLedgerSqlite({
    sqlitePath: strongLedgerSqlitePath(options.inputDir, options.bible),
    onlyRef: options.scope
  });
  const verses = bible.verses;
  const lexicon = await readOrCreateLexicon(options.lexiconPath);
  const result = buildSemanticRefill({
    bible: options.bible,
    scope: options.scope,
    verses,
    lexicon
  });

  await writeRunOutputs(options.outputDir, result);
  await writeFile(
    path.join(options.outputDir, "gap-review-metrics.json"),
    `${JSON.stringify(result.metrics, null, 2)}\n`,
    "utf8"
  );

  if (options.apply) {
    await appendAcceptedOverrides(options.overridesPath, result.decisions);
  }

  return result;
}

export function buildSemanticRefill(options: {
  bible: string;
  scope: string;
  verses: StrongLedgerVerse[];
  lexicon?: SemanticRefillLexiconEntry[];
}): SemanticRefillRunResult {
  const lexicon = options.lexicon ?? DEFAULT_LEXICON;
  const lexiconByStrong = new Map(
    lexicon.map((entry) => [entry.strong.toUpperCase(), entry])
  );
  const candidates: SemanticRefillAuditItem[] = [];
  const decisions: SemanticRefillDecision[] = [];
  const pending: SemanticRefillDecision[] = [];
  const rejected: SemanticRefillDecision[] = [];
  let advancedEmptySemanticBefore = 0;
  let advancedTechnicalBefore = 0;

  for (const verse of options.verses) {
    for (const annotation of verse.annotations) {
      if (annotation.visibility !== "advanced") continue;
      if (
        annotation.placement !== "empty" &&
        annotation.placement !== "technical"
      ) {
        continue;
      }

      const strong = annotation.strong.toUpperCase();
      if (annotation.placement === "technical") advancedTechnicalBefore += 1;
      if (annotation.placement === "empty" && !TECHNICAL_STRONG.has(strong)) {
        advancedEmptySemanticBefore += 1;
      }

      const item = buildAuditItem({
        bible: options.bible,
        verse,
        annotation,
        lexiconEntry: lexiconByStrong.get(strong)
      });
      candidates.push(item);

      const decision = decideAuditItem(item);
      if (!decision) continue;

      if (decision.status === "accept") {
        const validation = validateSemanticRefillDecision({ verse, decision });
        if (validation.status === "validated") {
          decisions.push(decision);
        } else {
          rejected.push({
            ...decision,
            status: "reject",
            evidence: [...decision.evidence, validation.reason],
            reason: validation.reason
          });
        }
      } else if (decision.status === "pending-human") {
        pending.push(decision);
      } else {
        rejected.push(decision);
      }
    }

    const relocationItems = buildRelocationAuditItems({
      bible: options.bible,
      verse,
      lexiconByStrong
    });
    candidates.push(...relocationItems);

    const phraseExpansions = buildReaderPhraseExpansions({
      bible: options.bible,
      verse,
      lexicon
    });
    for (const expansion of phraseExpansions) {
      const validation = validateSemanticRefillDecision({
        verse,
        decision: expansion
      });
      if (validation.status === "validated") {
        decisions.push(expansion);
      } else {
        rejected.push({
          ...expansion,
          status: "reject",
          evidence: [...expansion.evidence, validation.reason],
          reason: validation.reason
        });
      }
    }
  }

  const uniqueDecisions = uniqueByOverrideKey(decisions);
  const metrics: SemanticRefillMetrics = {
    bible: options.bible,
    scope: options.scope,
    verseCount: options.verses.length,
    advancedEmptySemanticBefore,
    advancedTechnicalBefore,
    accepted: uniqueDecisions.length,
    acceptedWord: uniqueDecisions.filter(
      (decision) => (decision.target ?? "word") === "word"
    ).length,
    acceptedPhrase: uniqueDecisions.filter(
      (decision) => decision.target === "phrase"
    ).length,
    pendingHuman: pending.length,
    rejected: rejected.length
  };

  return {
    candidates,
    decisions: uniqueDecisions,
    pending,
    rejected,
    metrics
  };
}

export function validateSemanticRefillDecision(options: {
  verse: StrongLedgerVerse;
  decision: SemanticRefillDecision;
}): { status: "validated" } | { status: "rejected"; reason: string } {
  const strong = options.decision.strong.map((item) => item.toUpperCase());
  const allowed = new Set([
    ...options.verse.inventories.original.map((item) => item.toUpperCase()),
    ...Object.values(options.verse.inventories.references)
      .flat()
      .map((item) => item.toUpperCase())
  ]);

  for (const item of strong) {
    if (!allowed.has(item)) {
      return { status: "rejected", reason: "strong-absent-from-verse" };
    }
  }

  if (options.decision.target === "phrase") {
    const start = options.decision.startWordIndex;
    const end = options.decision.endWordIndex;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start === undefined ||
      end === undefined ||
      start < 0 ||
      end < start ||
      end >= options.verse.tokens.length
    ) {
      return { status: "rejected", reason: "invalid-phrase-index" };
    }

    const actual = options.verse.tokens
      .slice(start, end + 1)
      .map((token) => token.normalized);
    if (
      JSON.stringify(actual) !==
      JSON.stringify(options.decision.normalizedPhrase ?? [])
    ) {
      return { status: "rejected", reason: "phrase-normalization-mismatch" };
    }

    if (!actual.some((token) => !WEAK_WORDS.has(token))) {
      return { status: "rejected", reason: "weak-function-phrase" };
    }
    return { status: "validated" };
  }

  if ((options.decision.target ?? "word") === "word") {
    const word = options.verse.tokens[options.decision.wordIndex];
    if (!word) return { status: "rejected", reason: "invalid-word-index" };
    if (word.normalized !== options.decision.normalized) {
      return { status: "rejected", reason: "word-normalization-mismatch" };
    }
    if (WEAK_WORDS.has(word.normalized)) {
      return { status: "rejected", reason: "weak-function-word" };
    }
  }

  return { status: "validated" };
}

async function readOrCreateLexicon(
  lexiconPath: string
): Promise<SemanticRefillLexiconEntry[]> {
  if (existsSync(lexiconPath)) {
    const raw = JSON.parse(await readFile(lexiconPath, "utf8")) as unknown;
    if (Array.isArray(raw)) {
      return mergeLexicons(raw.filter(isLexiconEntry), DEFAULT_LEXICON);
    }
  }

  await mkdir(path.dirname(lexiconPath), { recursive: true });
  await writeFile(
    lexiconPath,
    `${JSON.stringify(DEFAULT_LEXICON, null, 2)}\n`,
    "utf8"
  );
  return DEFAULT_LEXICON;
}

function isLexiconEntry(value: unknown): value is SemanticRefillLexiconEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SemanticRefillLexiconEntry>;
  return (
    typeof candidate.strong === "string" &&
    Array.isArray(candidate.forms) &&
    candidate.forms.every(
      (form) =>
        Array.isArray(form) && form.every((token) => typeof token === "string")
    ) &&
    typeof candidate.priority === "string" &&
    typeof candidate.source === "string" &&
    Array.isArray(candidate.evidence) &&
    typeof candidate.confidence === "number"
  );
}

function mergeLexicons(
  left: SemanticRefillLexiconEntry[],
  right: SemanticRefillLexiconEntry[]
): SemanticRefillLexiconEntry[] {
  const merged = new Map<string, SemanticRefillLexiconEntry>();
  for (const entry of [...right, ...left]) {
    const strong = entry.strong.toUpperCase();
    const existing = merged.get(strong);
    if (!existing) {
      merged.set(strong, { ...entry, strong });
      continue;
    }
    const forms = uniqueForms([...existing.forms, ...entry.forms]);
    merged.set(strong, {
      ...existing,
      ...entry,
      strong,
      forms,
      evidence: [...new Set([...existing.evidence, ...entry.evidence])],
      confidence: Math.max(existing.confidence, entry.confidence),
      autoAccept: existing.autoAccept || entry.autoAccept
    });
  }
  return [...merged.values()].sort((leftEntry, rightEntry) =>
    leftEntry.strong.localeCompare(rightEntry.strong)
  );
}

function uniqueForms(forms: string[][]): string[][] {
  const seen = new Set<string>();
  const output: string[][] = [];
  for (const form of forms) {
    const normalized = form.map(normalizeWord).filter(Boolean);
    const key = normalized.join(" ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function buildAuditItem(options: {
  bible: string;
  verse: StrongLedgerVerse;
  annotation: StrongLedgerAnnotation;
  lexiconEntry?: SemanticRefillLexiconEntry;
}): SemanticRefillAuditItem {
  const strong = options.annotation.strong.toUpperCase();
  const support = options.annotation.referenceSupport ?? [];
  const priority = classifyAnnotation(options.annotation, options.lexiconEntry);
  const eligible =
    priority !== "technical-skip" &&
    options.annotation.visibility === "advanced" &&
    (options.annotation.placement === "empty" ||
      options.annotation.placement === "technical") &&
    (options.verse.inventories.original.includes(strong) || support.length > 0);
  const candidates = eligible
    ? buildCandidates({
        verse: options.verse,
        annotation: options.annotation,
        lexiconEntry: options.lexiconEntry
      })
    : [];

  return {
    bible: options.bible,
    ref: options.verse.ref,
    text: options.verse.text,
    tokens: options.verse.tokens,
    auditKind: "missing",
    annotation: {
      id: options.annotation.id,
      strong,
      visibility: options.annotation.visibility,
      placement: options.annotation.placement,
      insertAfterWordIndex: options.annotation.insertAfterWordIndex,
      confidence: options.annotation.confidence,
      source: options.annotation.source,
      diagnostics: options.annotation.diagnostics,
      referenceSupport: options.annotation.referenceSupport
    },
    strong,
    currentPlacement: options.annotation.placement,
    currentTarget: annotationTarget(options.annotation),
    referenceSupport: support,
    originalInventory: options.verse.inventories.original,
    referenceInventory: options.verse.inventories.references,
    candidateForms: options.lexiconEntry?.forms ?? [],
    candidates,
    priority,
    eligible,
    reason: eligible
      ? "eligible advanced empty/technical Strong with original/reference support"
      : ineligibleReason(options.annotation, priority)
  };
}

function buildRelocationAuditItems(options: {
  bible: string;
  verse: StrongLedgerVerse;
  lexiconByStrong: Map<string, SemanticRefillLexiconEntry>;
}): SemanticRefillAuditItem[] {
  const items: SemanticRefillAuditItem[] = [];

  for (const annotation of options.verse.annotations) {
    if (annotation.visibility !== "reader") continue;
    if (annotation.placement !== "word" && annotation.placement !== "phrase") {
      continue;
    }

    const strong = annotation.strong.toUpperCase();
    if (TECHNICAL_STRONG.has(strong)) continue;
    const entry = options.lexiconByStrong.get(strong);
    if (!entry) continue;

    const candidates = buildRelocationCandidates({
      verse: options.verse,
      annotation,
      lexiconEntry: entry
    });
    if (candidates.length === 0) continue;

    const best = candidates[0];
    if (!best) continue;
    const currentScore = currentTargetScore({
      annotation,
      lexiconEntry: entry,
      verse: options.verse
    });
    if (best.score < 0.86 || best.score - currentScore < 0.08) continue;

    const priority = entry.priority;
    items.push({
      bible: options.bible,
      ref: options.verse.ref,
      text: options.verse.text,
      tokens: options.verse.tokens,
      auditKind: "relocation",
      annotation: {
        id: annotation.id,
        strong,
        visibility: annotation.visibility,
        placement: annotation.placement,
        insertAfterWordIndex: annotation.insertAfterWordIndex,
        confidence: annotation.confidence,
        source: annotation.source,
        diagnostics: annotation.diagnostics,
        referenceSupport: annotation.referenceSupport
      },
      strong,
      currentPlacement: annotation.placement,
      currentTarget: annotationTarget(annotation),
      referenceSupport: annotation.referenceSupport ?? [],
      originalInventory: options.verse.inventories.original,
      referenceInventory: options.verse.inventories.references,
      candidateForms: entry.forms,
      candidates,
      priority,
      eligible: true,
      reason:
        "eligible reader Strong relocation audit: a better open French carrier may exist"
    });
  }

  return items;
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

function classifyAnnotation(
  annotation: StrongLedgerAnnotation,
  lexiconEntry?: SemanticRefillLexiconEntry
): RefillPriority {
  const strong = annotation.strong.toUpperCase();
  if (TECHNICAL_STRONG.has(strong)) return "technical-skip";
  if (lexiconEntry) return lexiconEntry.priority;
  if ((annotation.referenceSupport ?? []).length >= 3) return "semantic-medium";
  return "function-low";
}

function ineligibleReason(
  annotation: StrongLedgerAnnotation,
  priority: RefillPriority
): string {
  if (priority === "technical-skip") {
    return "technical or weak Strong should stay advanced unless explicitly proven";
  }
  return `not eligible from placement ${annotation.placement}/${annotation.visibility}`;
}

function buildCandidates(options: {
  verse: StrongLedgerVerse;
  annotation: StrongLedgerAnnotation;
  lexiconEntry?: SemanticRefillLexiconEntry;
}): SemanticRefillCandidate[] {
  const entry = options.lexiconEntry;
  if (!entry) {
    return [
      {
        target: "empty",
        strong: options.annotation.strong,
        score: 0.35,
        evidence: ["no semantic-refill lexicon entry yet"]
      }
    ];
  }

  const candidates: SemanticRefillCandidate[] = [];
  for (const form of uniqueForms(entry.forms)) {
    candidates.push(
      ...findPhraseMatches(options.verse.tokens, form)
        .filter(
          (match) =>
            !tokenStrongSet(options.verse, match).has(
              options.annotation.strong.toUpperCase()
            )
        )
        .map((match) =>
          scoreMatch({
            strong: options.annotation.strong,
            form,
            match,
            entry,
            annotation: options.annotation,
            verse: options.verse
          })
        )
    );
  }

  return candidates.sort(
    (left, right) =>
      right.score - left.score ||
      candidateSpanLength(right) - candidateSpanLength(left)
  );
}

function buildRelocationCandidates(options: {
  verse: StrongLedgerVerse;
  annotation: StrongLedgerAnnotation;
  lexiconEntry: SemanticRefillLexiconEntry;
}): SemanticRefillCandidate[] {
  const candidates: SemanticRefillCandidate[] = [];
  for (const form of uniqueForms(options.lexiconEntry.forms)) {
    candidates.push(
      ...findPhraseMatches(options.verse.tokens, form)
        .filter(
          (match) =>
            !matchContainsCurrentAnnotation(options.annotation, match) &&
            !tokenStrongSet(options.verse, match).has(
              options.annotation.strong.toUpperCase()
            )
        )
        .map((match) => {
          const candidate = scoreMatch({
            strong: options.annotation.strong,
            form,
            match,
            entry: options.lexiconEntry,
            annotation: options.annotation,
            verse: options.verse
          });
          return {
            ...candidate,
            evidence: [
              ...candidate.evidence,
              `relocation from current ${describeAnnotationTarget(options.annotation)}`
            ]
          };
        })
    );
  }

  return candidates.sort(
    (left, right) =>
      right.score - left.score ||
      targetOccupancyRank(options.verse, left) -
        targetOccupancyRank(options.verse, right) ||
      candidateSpanLength(right) - candidateSpanLength(left)
  );
}

function matchContainsCurrentAnnotation(
  annotation: StrongLedgerAnnotation,
  match: { start: number; end: number }
): boolean {
  if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
    return (
      annotation.wordIndex >= match.start && annotation.wordIndex <= match.end
    );
  }
  if (
    annotation.placement === "phrase" &&
    annotation.startWordIndex !== undefined &&
    annotation.endWordIndex !== undefined
  ) {
    return (
      annotation.startWordIndex === match.start &&
      annotation.endWordIndex === match.end
    );
  }
  return false;
}

function currentTargetScore(options: {
  annotation: StrongLedgerAnnotation;
  lexiconEntry: SemanticRefillLexiconEntry;
  verse: StrongLedgerVerse;
}): number {
  const target =
    options.annotation.placement === "phrase"
      ? normalizedPhraseFromAnnotation(options.annotation)
      : options.annotation.wordIndex !== undefined
        ? [options.verse.tokens[options.annotation.wordIndex]?.normalized ?? ""]
        : [];
  if (target.length === 0) return 0;

  const forms = uniqueForms(options.lexiconEntry.forms);
  const directMatch = forms.some(
    (form) => JSON.stringify(form) === JSON.stringify(target)
  );
  const occupancyPenalty = currentTargetHasOtherReaderStrong(
    options.verse,
    options.annotation
  )
    ? 0.14
    : 0;
  if (directMatch) return 0.92 - occupancyPenalty;

  const tokenOverlap = forms.some((form) =>
    form.some((token) => target.includes(token))
  );
  return (tokenOverlap ? 0.78 : 0.55) - occupancyPenalty;
}

function currentTargetHasOtherReaderStrong(
  verse: StrongLedgerVerse,
  annotation: StrongLedgerAnnotation
): boolean {
  const currentStrong = annotation.strong.toUpperCase();
  const start =
    annotation.placement === "phrase"
      ? annotation.startWordIndex
      : annotation.wordIndex;
  const end =
    annotation.placement === "phrase" ? annotation.endWordIndex : start;
  if (start === undefined || end === undefined) return false;

  return verse.annotations.some((other) => {
    if (other === annotation || other.visibility !== "reader") return false;
    if (other.strong.toUpperCase() === currentStrong) return false;
    if (other.placement === "word" && other.wordIndex !== undefined) {
      return other.wordIndex >= start && other.wordIndex <= end;
    }
    if (
      other.placement === "phrase" &&
      other.startWordIndex !== undefined &&
      other.endWordIndex !== undefined
    ) {
      return other.startWordIndex <= end && other.endWordIndex >= start;
    }
    return false;
  });
}

function normalizedPhraseFromAnnotation(
  annotation: StrongLedgerAnnotation
): string[] {
  if (Array.isArray(annotation.normalizedPhrase)) {
    return annotation.normalizedPhrase;
  }
  if (typeof annotation.normalizedPhrase === "string") {
    return annotation.normalizedPhrase.split(" ");
  }
  return [];
}

function describeAnnotationTarget(annotation: StrongLedgerAnnotation): string {
  if (annotation.placement === "phrase") {
    return `phrase:${normalizedPhraseFromAnnotation(annotation).join(" ")}`;
  }
  if (annotation.placement === "word") {
    return `word:${annotation.wordIndex}:${annotation.normalizedWord ?? ""}`;
  }
  return annotation.placement;
}

function targetOccupancyRank(
  verse: StrongLedgerVerse,
  candidate: SemanticRefillCandidate
): number {
  const match =
    candidate.target === "phrase"
      ? {
          start: candidate.startWordIndex ?? candidate.wordIndex ?? 0,
          end: candidate.endWordIndex ?? candidate.wordIndex ?? 0
        }
      : {
          start: candidate.wordIndex ?? 0,
          end: candidate.wordIndex ?? 0
        };
  return tokenStrongSet(verse, match).size;
}

function candidateSpanLength(candidate: SemanticRefillCandidate): number {
  if (candidate.target !== "phrase") return 1;
  return (
    (candidate.endWordIndex ?? candidate.wordIndex ?? 0) -
    (candidate.startWordIndex ?? candidate.wordIndex ?? 0) +
    1
  );
}

function findPhraseMatches(
  tokens: StrongLedgerToken[],
  form: string[]
): Array<{ start: number; end: number }> {
  const normalized = form.map(normalizeWord).filter(Boolean);
  if (normalized.length === 0) return [];
  const matches: Array<{ start: number; end: number }> = [];

  for (let start = 0; start <= tokens.length - normalized.length; start += 1) {
    const slice = tokens
      .slice(start, start + normalized.length)
      .map((token) => token.normalized);
    if (JSON.stringify(slice) === JSON.stringify(normalized)) {
      matches.push({ start, end: start + normalized.length - 1 });
    }
  }

  return matches;
}

function scoreMatch(options: {
  strong: string;
  form: string[];
  match: { start: number; end: number };
  entry: SemanticRefillLexiconEntry;
  annotation: StrongLedgerAnnotation;
  verse: StrongLedgerVerse;
}): SemanticRefillCandidate {
  const referenceCount = options.annotation.referenceSupport?.length ?? 0;
  const originalPresent = options.verse.inventories.original.includes(
    options.strong.toUpperCase()
  );
  const proximity = proximityScore(
    options.annotation.insertAfterWordIndex,
    options.match.start
  );
  const phrase = options.verse.tokens
    .slice(options.match.start, options.match.end + 1)
    .map((token) => token.normalized);
  const score = roundScore(
    Math.min(
      0.99,
      entryConfidence(options.entry) +
        (originalPresent ? 0.08 : 0) +
        Math.min(0.06, referenceCount * 0.02) +
        proximity
    )
  );
  const evidence = [
    `${options.strong.toUpperCase()} present in ${
      originalPresent ? "original" : "reference"
    } inventory`,
    `${options.strong.toUpperCase()} supported by ${referenceCount} reference(s)`,
    `semantic-refill form match: ${options.form.join(" ")}`,
    `target phrase: ${phrase.join(" ")}`,
    `proximity score ${proximity.toFixed(2)}`
  ];

  if (options.match.start === options.match.end) {
    return {
      target: "word",
      strong: options.strong.toUpperCase(),
      wordIndex: options.match.start,
      normalizedWord: phrase[0],
      score,
      evidence
    };
  }

  return {
    target: "phrase",
    strong: options.strong.toUpperCase(),
    wordIndex: options.match.start,
    startWordIndex: options.match.start,
    endWordIndex: options.match.end,
    normalizedPhrase: phrase,
    score,
    evidence
  };
}

function entryConfidence(entry: SemanticRefillLexiconEntry): number {
  return Math.min(0.9, Math.max(0.65, entry.confidence));
}

function tokenStrongSet(
  verse: StrongLedgerVerse,
  match: { start: number; end: number }
): Set<string> {
  const strong = new Set<string>();
  for (const annotation of verse.annotations) {
    if (annotation.visibility !== "reader") continue;
    if (
      annotation.placement === "word" &&
      annotation.wordIndex !== undefined &&
      annotation.wordIndex >= match.start &&
      annotation.wordIndex <= match.end
    ) {
      strong.add(annotation.strong.toUpperCase());
    }
    if (
      annotation.placement === "phrase" &&
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined &&
      annotation.startWordIndex <= match.end &&
      annotation.endWordIndex >= match.start
    ) {
      strong.add(annotation.strong.toUpperCase());
    }
  }
  return strong;
}

function proximityScore(
  insertAfterWordIndex: number | undefined,
  targetWordIndex: number
): number {
  if (insertAfterWordIndex === undefined) return 0;
  const distance = Math.abs(insertAfterWordIndex - targetWordIndex);
  if (distance <= 2) return 0.04;
  if (distance <= 6) return 0.02;
  return 0;
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}

function decideAuditItem(
  item: SemanticRefillAuditItem
): SemanticRefillDecision | undefined {
  const best = item.candidates[0];
  if (!item.eligible || !best) {
    return item.currentPlacement === "technical"
      ? rejectedDecision(item, "technical Strong kept out of reader mode")
      : undefined;
  }

  if (best.target === "empty") {
    return pendingDecision(
      item,
      best,
      "no deterministic visible French carrier found"
    );
  }

  if (best.score >= 0.84 && item.priority !== "function-low") {
    return acceptedDecision(item, best);
  }

  return pendingDecision(item, best, "candidate below auto-accept threshold");
}

function acceptedDecision(
  item: SemanticRefillAuditItem,
  candidate: SemanticRefillCandidate
): SemanticRefillDecision {
  return {
    ...candidateToOverride(item, candidate),
    status: "accept",
    score: candidate.score,
    priority: item.priority,
    evidence: candidate.evidence
  };
}

function pendingDecision(
  item: SemanticRefillAuditItem,
  candidate: SemanticRefillCandidate,
  reason: string
): SemanticRefillDecision {
  return {
    ...candidateToOverride(item, candidate),
    status: "pending-human",
    score: candidate.score,
    priority: item.priority,
    evidence: [...candidate.evidence, reason],
    reason: `${candidate.evidence.join("; ")}. ${reason}.`
  };
}

function rejectedDecision(
  item: SemanticRefillAuditItem,
  reason: string
): SemanticRefillDecision {
  return {
    bible: item.bible,
    ref: item.ref,
    target: "empty",
    wordIndex: item.annotation.insertAfterWordIndex ?? 0,
    normalized: "",
    strong: [item.strong],
    confidence: 0.35,
    source: "semantic-refill:reject",
    reason,
    status: "reject",
    score: 0,
    priority: item.priority,
    evidence: [reason]
  };
}

function candidateToOverride(
  item: SemanticRefillAuditItem,
  candidate: SemanticRefillCandidate
): CuratedStrongOverride {
  const replace =
    item.auditKind === "relocation" &&
    item.currentTarget &&
    item.currentTarget.target !== "technical"
      ? {
          target: item.currentTarget.target,
          wordIndex: item.currentTarget.wordIndex,
          startWordIndex: item.currentTarget.startWordIndex,
          endWordIndex: item.currentTarget.endWordIndex
        }
      : undefined;
  if (candidate.target === "phrase") {
    return {
      bible: item.bible.toLowerCase(),
      ref: item.ref,
      target: "phrase",
      replace,
      wordIndex: candidate.startWordIndex ?? candidate.wordIndex ?? 0,
      normalized: candidate.normalizedPhrase?.join(" ") ?? "",
      startWordIndex: candidate.startWordIndex,
      endWordIndex: candidate.endWordIndex,
      normalizedPhrase: candidate.normalizedPhrase,
      strong: [candidate.strong],
      confidence: candidate.score,
      source: "semantic-refill",
      reason: candidate.evidence.join("; ")
    };
  }

  return {
    bible: item.bible.toLowerCase(),
    ref: item.ref,
    target: "word",
    replace,
    wordIndex: candidate.wordIndex ?? 0,
    normalized: candidate.normalizedWord ?? "",
    strong: [candidate.strong],
    confidence: candidate.score,
    source: "semantic-refill",
    reason: candidate.evidence.join("; ")
  };
}

function buildReaderPhraseExpansions(options: {
  bible: string;
  verse: StrongLedgerVerse;
  lexicon: SemanticRefillLexiconEntry[];
}): SemanticRefillDecision[] {
  const decisions: SemanticRefillDecision[] = [];
  const hayah = options.lexicon.find((entry) => entry.strong === "H1961");
  if (!hayah) return decisions;

  for (const annotation of options.verse.annotations) {
    if (
      annotation.visibility !== "reader" ||
      annotation.placement !== "word" ||
      annotation.strong !== "H1961" ||
      annotation.wordIndex === undefined
    ) {
      continue;
    }

    const currentWordIndex = annotation.wordIndex;
    for (const form of uniqueForms(hayah.forms)) {
      const matches = findPhraseMatches(options.verse.tokens, form).filter(
        (match) =>
          match.start <= currentWordIndex &&
          match.end >= currentWordIndex &&
          match.end > match.start
      );
      const match = matches[0];
      if (!match) continue;
      const phrase = options.verse.tokens
        .slice(match.start, match.end + 1)
        .map((token) => token.normalized);
      decisions.push({
        bible: options.bible.toLowerCase(),
        ref: options.verse.ref,
        target: "phrase",
        wordIndex: match.start,
        normalized: phrase.join(" "),
        startWordIndex: match.start,
        endWordIndex: match.end,
        normalizedPhrase: phrase,
        strong: ["H1961"],
        confidence: 0.88,
        source: "semantic-refill:phrase-expansion",
        reason:
          "Existing reader H1961 is better represented by the full French existential phrase.",
        status: "accept",
        score: 0.88,
        priority: "semantic-medium",
        evidence: [
          "H1961 already visible in reader mode",
          `phrase expansion matched ${phrase.join(" ")}`,
          "curated phrase override removes duplicate word-level H1961 inside the phrase"
        ]
      });
      break;
    }
  }

  return decisions;
}

function uniqueByOverrideKey(
  decisions: SemanticRefillDecision[]
): SemanticRefillDecision[] {
  const merged = new Map<string, SemanticRefillDecision>();
  for (const decision of decisions) {
    const key = [
      decision.bible,
      decision.ref,
      decision.target ?? "word",
      decision.startWordIndex ?? decision.wordIndex,
      decision.endWordIndex ?? decision.wordIndex,
      decision.normalized
    ].join("|");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, decision);
      continue;
    }
    const strong = [
      ...new Set([...existing.strong, ...decision.strong])
    ].sort();
    merged.set(key, {
      ...existing,
      strong,
      confidence: Math.max(existing.confidence, decision.confidence),
      score: Math.max(existing.score, decision.score),
      evidence: [...new Set([...existing.evidence, ...decision.evidence])],
      reason: [...new Set([existing.reason, decision.reason])].join(" | ")
    });
  }
  return [...merged.values()].sort(
    (left, right) =>
      left.ref.localeCompare(right.ref) ||
      left.wordIndex - right.wordIndex ||
      left.strong.join(" ").localeCompare(right.strong.join(" "))
  );
}

async function writeRunOutputs(
  outputDir: string,
  result: SemanticRefillRunResult
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson(
      path.join(outputDir, "gap-review-candidates.json"),
      result.candidates
    ),
    writeJson(
      path.join(outputDir, "gap-review-decisions.json"),
      result.decisions
    ),
    writeJson(path.join(outputDir, "gap-review-pending.json"), result.pending),
    writeJson(path.join(outputDir, "gap-review-rejected.json"), result.rejected)
  ]);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function appendAcceptedOverrides(
  overridesPath: string,
  decisions: SemanticRefillDecision[]
): Promise<void> {
  const accepted = decisions.filter((decision) => decision.status === "accept");
  if (accepted.length === 0) return;

  const current = existsSync(overridesPath)
    ? (JSON.parse(await readFile(overridesPath, "utf8")) as unknown)
    : [];
  const overrides = Array.isArray(current) ? current : [];
  const existingKeys = new Set(
    getCuratedStrongOverrides().map((override) => overrideKey(override))
  );
  const additions = accepted
    .map(stripDecisionFields)
    .filter((override) => !existingKeys.has(overrideKey(override)));

  if (additions.length === 0) return;

  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeFile(
    overridesPath,
    `${JSON.stringify([...overrides, ...additions], null, 2)}\n`,
    "utf8"
  );
}

function stripDecisionFields(
  decision: SemanticRefillDecision
): CuratedStrongOverride {
  const override = { ...decision };
  delete (override as Partial<SemanticRefillDecision>).status;
  delete (override as Partial<SemanticRefillDecision>).score;
  delete (override as Partial<SemanticRefillDecision>).priority;
  delete (override as Partial<SemanticRefillDecision>).evidence;
  return override;
}

function overrideKey(override: CuratedStrongOverride): string {
  return [
    override.bible,
    override.ref,
    override.target ?? "word",
    override.wordIndex,
    override.startWordIndex ?? "",
    override.endWordIndex ?? "",
    override.normalized,
    override.strong
      .map((strong) => strong.toUpperCase())
      .sort()
      .join(",")
  ].join("|");
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
  const bible = readStringArg(args, "bible", "nbs").toLowerCase();
  const scope = readStringArg(args, "only", "Gen");
  const inputDir = readStringArg(args, "input-dir", `outputs/strong/${bible}`);
  const outputDir = readStringArg(
    args,
    "output-dir",
    `outputs/gap-review/${bible}/${scope}`
  );
  const result = await runSemanticRefill({
    bible,
    scope,
    inputDir,
    outputDir,
    overridesPath: readStringArg(
      args,
      "overrides",
      "data/curated-strong-overrides.json"
    ),
    lexiconPath: readStringArg(
      args,
      "lexicon",
      "data/semantic-refill-lexicon.json"
    ),
    apply: args.get("audit") !== true && args.get("apply") !== "false"
  });

  console.log(
    JSON.stringify(
      {
        outputDir,
        metrics: result.metrics
      },
      null,
      2
    )
  );
}

if (process.argv[1]?.endsWith("semanticRefill.ts")) {
  await main();
}
