import { createHash } from "node:crypto";

import {
  WEAK_WORDS,
  validateSemanticRefillDecision,
  type RefillPriority,
  type SemanticRefillAuditItem,
  type SemanticRefillDecision
} from "./semanticRefill.js";
import { type StrongLedgerVerse } from "./strongLedger.js";

export const SEMANTIC_REFILL_LLM_DECISION_TYPES = [
  "word",
  "phrase",
  "empty",
  "technical",
  "duplicate",
  "not-rendered",
  "pending-human",
  "reject"
] as const;

export type SemanticRefillLlmDecisionType =
  (typeof SEMANTIC_REFILL_LLM_DECISION_TYPES)[number];

export type SemanticRefillLlmMode = "dry-run" | "mock";

export interface SemanticRefillLlmRawDecision {
  id: string;
  choiceId: string;
  ref: string;
  decision: SemanticRefillLlmDecisionType;
  strong: string[];
  confidence: number;
  reason: string;
  wordIndex: number | null;
  normalized: string | null;
  startWordIndex: number | null;
  endWordIndex: number | null;
  normalizedPhrase: string[] | null;
  evidence: string[];
}

export interface SemanticRefillLlmResponse {
  decisions: SemanticRefillLlmSelection[];
}

export interface SemanticRefillLlmSelection {
  id: string;
  choiceId: string;
  confidence: number;
  reason: string;
  evidence: string[];
}

export interface SemanticRefillLlmClientRequest {
  model: string;
  temperature: 0;
  messages: Array<{ role: "system" | "user"; content: string }>;
  responseSchema: SemanticRefillLlmJsonSchema;
}

export interface SemanticRefillLlmClient {
  complete(
    request: SemanticRefillLlmClientRequest
  ): Promise<SemanticRefillLlmResponse | unknown>;
}

export interface SemanticRefillLlmCandidatePacket {
  id: string;
  bible: string;
  ref: string;
  text: string;
  auditKind: "missing" | "relocation";
  priority: RefillPriority;
  strong: string;
  stepIdentity?: SemanticRefillAuditItem["stepIdentity"];
  currentPlacement: string;
  currentTarget?: SemanticRefillAuditItem["currentTarget"];
  sourcePlacement: {
    placement: string;
    insertAfterWordIndex?: number;
  };
  reason: string;
  eligible: boolean;
  tokens: Array<{ wordIndex: number; text: string; normalized: string }>;
  originalInventory: string[];
  referenceInventory: Record<string, string[]>;
  existingReaderStrong: Array<{
    placement: string;
    strong: string;
    wordIndex?: number;
    startWordIndex?: number;
    endWordIndex?: number;
    normalizedWord?: string;
    normalizedPhrase?: string;
  }>;
  occupiedTargets: Array<{
    placement: string;
    strong: string[];
    wordIndex?: number;
    startWordIndex?: number;
    endWordIndex?: number;
    normalizedWord?: string;
    normalizedPhrase?: string;
  }>;
  availableTargets: Array<{
    wordIndex: number;
    text: string;
    normalized: string;
    weak: boolean;
    occupiedStrong: string[];
  }>;
  blockedTargets: Array<{
    wordIndex: number;
    text: string;
    normalized: string;
    occupiedStrong: string[];
    reason: string;
  }>;
  openContentTargets: Array<{
    wordIndex: number;
    text: string;
    normalized: string;
  }>;
  nearbyOpenTargets: Array<{
    wordIndex: number;
    text: string;
    normalized: string;
    distanceFromSource: number;
  }>;
  placementWarnings: string[];
  deterministicCandidates: Array<{
    target: string;
    strong: string;
    score: number;
    wordIndex?: number;
    normalizedWord?: string;
    startWordIndex?: number;
    endWordIndex?: number;
    normalizedPhrase?: string[];
    evidence: string[];
  }>;
  choices: SemanticRefillLlmChoice[];
}

export interface SemanticRefillLlmChoice {
  id: string;
  decision: SemanticRefillLlmDecisionType;
  description: string;
  wordIndex: number | null;
  normalized: string | null;
  startWordIndex: number | null;
  endWordIndex: number | null;
  normalizedPhrase: string[] | null;
}

export interface SemanticRefillLlmBatch {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

export interface SemanticRefillLlmEvaluatedDecision {
  id: string;
  ref: string;
  decisionType: SemanticRefillLlmDecisionType;
  status: "validated" | "pending-human" | "rejected";
  strong: string[];
  confidence: number;
  reason: string;
  evidence: string[];
  override?: SemanticRefillDecision;
}

export interface SemanticRefillLlmRunResult {
  mode: SemanticRefillLlmMode;
  batch: SemanticRefillLlmBatch;
  request: SemanticRefillLlmClientRequest;
  rawDecisions: SemanticRefillLlmRawDecision[];
  validated: SemanticRefillDecision[];
  pending: SemanticRefillLlmEvaluatedDecision[];
  rejected: SemanticRefillLlmEvaluatedDecision[];
  metrics: {
    candidateCount: number;
    rawDecisionCount: number;
    validated: number;
    pending: number;
    rejected: number;
    dryRun: boolean;
  };
}

export interface RunSemanticRefillLlmOptions {
  bible: string;
  scope: string;
  verses: StrongLedgerVerse[];
  candidates: SemanticRefillAuditItem[];
  mode: SemanticRefillLlmMode;
  model?: string;
  limit?: number;
  autoAcceptThreshold?: number;
  referenceStyleFinalization?: boolean;
  client?: SemanticRefillLlmClient;
  mockResponse?: SemanticRefillLlmResponse | unknown;
}

export const SEMANTIC_REFILL_LLM_SYSTEM_PROMPT = [
  "Tu es un expert d'alignement biblique Strong pour un backend semantic-refill.",
  "Réponds uniquement avec du JSON conforme au schema fourni.",
  "Retourne exactement une sélection par candidat, avec son id et un choiceId fourni dans choices.",
  "N'invente jamais d'id, de choiceId, de Strong, d'index ou de cible.",
  "Deux audits existent:",
  "- missing: le Strong attendu n'est pas encore visible; il faut l'ajouter sur word/phrase ou empty.",
  "- relocation: le Strong est déjà visible, mais peut être mal attaché; il faut choisir keep/duplicate si le placement actuel est correct, ou word/phrase/empty si le Strong doit être déplacé.",
  "Décisions autorisées:",
  "- word: le Strong est clairement rendu par un mot français visible.",
  "- phrase: le Strong est clairement rendu par une locution française contiguë.",
  "- empty: le Strong est réel mais doit rester sans porteur français visible.",
  "- technical: particule, marqueur grammatical ou Strong technique à garder hors reader.",
  "- duplicate: le Strong est déjà représenté au bon endroit; pour auditKind=relocation, cela signifie keep.",
  "- not-rendered: l'original n'est pas naturellement rendu dans le français.",
  "- pending-human: cas plausible mais trop ambigu pour automatiser.",
  "- reject: candidat faux ou insuffisamment justifié.",
  "Pour word et phrase, sélectionne uniquement un choiceId fourni; les index et normalisations sont résolus par le backend.",
  "Ne tague pas articles, pronoms, conjonctions ou mots faibles sauf préposition/construction clairement traduite.",
  "Préserve la différence entre un équivalent lexical visible, un doublon et un original non rendu.",
  "Procédure obligatoire avant chaque décision:",
  "1. Vérifie les Strong déjà présents dans verses.tokens[].occupied.",
  "2. Pour auditKind=relocation, compare currentTarget aux alternatives dans deterministicCandidates avant de garder le placement courant.",
  "3. Si la meilleure cible porte déjà un autre Strong, ne l'empile pas par défaut: cherche d'abord une cible française plausible non occupée.",
  "4. N'empile plusieurs Strong sur un même mot que si le français fusionne réellement plusieurs notions et qu'aucune cible non occupée plausible n'existe.",
  "5. Si deux cibles plausibles existent, préfère la distribution qui garde les Strong distincts sur des mots distincts.",
  "6. Traite blockedTargetIndexes comme des cibles interdites pour decision=word, sauf fusion française indispensable.",
  "7. Quand sourcePlacement.insertAfterWordIndex existe, consulte nearbyOpenTargetIndexes et préfère une cible sémantique proche de l'emplacement original vide.",
  "8. Si tu hésites entre une cible bloquée et une cible ouverte, choisis la cible ouverte ou pending-human, jamais un word auto-confiant sur la cible bloquée.",
  "9. Mentionne explicitement dans reason pourquoi une cible occupée est quand même choisie, ou pourquoi elle est évitée."
].join("\n");

export const SEMANTIC_REFILL_LLM_JSON_SCHEMA = {
  name: "semantic_refill_llm_decisions",
  strict: true
} as const;

interface SemanticRefillLlmSelectionSchemaBranch {
  type: "object";
  additionalProperties: false;
  required: readonly ["id", "choiceId", "confidence", "reason", "evidence"];
  properties: {
    id: { type: "string"; enum: string[] };
    choiceId: { type: "string"; enum: string[] };
    confidence: { type: "number"; minimum: 0; maximum: 1 };
    reason: { type: "string"; minLength: 1 };
    evidence: { type: "array"; items: { type: "string" } };
  };
}

export interface SemanticRefillLlmJsonSchema {
  name: typeof SEMANTIC_REFILL_LLM_JSON_SCHEMA.name;
  strict: true;
  schema: {
    type: "object";
    additionalProperties: false;
    required: readonly ["decisions"];
    properties: {
      decisions: {
        type: "array";
        minItems: number;
        maxItems: number;
        items: { anyOf: SemanticRefillLlmSelectionSchemaBranch[] };
      };
    };
  };
}

export function buildSemanticRefillLlmJsonSchema(
  batch: SemanticRefillLlmBatch
): SemanticRefillLlmJsonSchema {
  const candidates = batch.candidates.map(ensureCandidateChoices);
  const branches = candidates.map((candidate) =>
    selectionSchemaBranch(
      [candidate.id],
      candidate.choices.map((choice) => choice.id)
    )
  );

  return {
    name: SEMANTIC_REFILL_LLM_JSON_SCHEMA.name,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["decisions"],
      properties: {
        decisions: {
          type: "array",
          minItems: candidates.length,
          maxItems: candidates.length,
          items: {
            anyOf:
              branches.length > 0
                ? branches
                : [selectionSchemaBranch(["__no_candidate__"], ["reject"])]
          }
        }
      }
    }
  };
}

function selectionSchemaBranch(
  candidateIds: string[],
  choiceIds: string[]
): SemanticRefillLlmSelectionSchemaBranch {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "choiceId", "confidence", "reason", "evidence"],
    properties: {
      id: { type: "string", enum: candidateIds },
      choiceId: { type: "string", enum: choiceIds },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reason: { type: "string", minLength: 1 },
      evidence: { type: "array", items: { type: "string" } }
    }
  };
}

export async function runSemanticRefillLlm(
  options: RunSemanticRefillLlmOptions
): Promise<SemanticRefillLlmRunResult> {
  const batch = buildSemanticRefillLlmBatch(options);
  const request = buildSemanticRefillLlmRequest({
    batch,
    model: options.model ?? "mock-semantic-refill"
  });
  const rawDecisions =
    options.mode === "dry-run"
      ? []
      : parseSemanticRefillLlmResponse(
          options.mockResponse ?? (await options.client?.complete(request)),
          batch
        );
  const evaluated = evaluateSemanticRefillLlmDecisions({
    bible: options.bible,
    verses: options.verses,
    batch,
    rawDecisions,
    autoAcceptThreshold: options.autoAcceptThreshold ?? 0.84,
    referenceStyleFinalization: options.referenceStyleFinalization
  });

  return {
    mode: options.mode,
    batch,
    request,
    rawDecisions,
    ...evaluated,
    metrics: {
      candidateCount: batch.candidates.length,
      rawDecisionCount: rawDecisions.length,
      validated: evaluated.validated.length,
      pending: evaluated.pending.length,
      rejected: evaluated.rejected.length,
      dryRun: options.mode === "dry-run"
    }
  };
}

export function buildSemanticRefillLlmBatch(options: {
  bible: string;
  scope: string;
  candidates: SemanticRefillAuditItem[];
  verses?: StrongLedgerVerse[];
  limit?: number;
}): SemanticRefillLlmBatch {
  const versesByRef = new Map(
    (options.verses ?? []).map((verse) => [verse.ref, verse])
  );
  const prioritized = [...options.candidates]
    .filter((candidate) => candidate.eligible)
    .sort(compareAuditItems)
    .slice(0, options.limit);

  return {
    bible: options.bible.toLowerCase(),
    scope: options.scope,
    candidates: assertUniqueCandidateIds(
      prioritized.map((candidate) =>
        auditItemToPacket(
          options.bible,
          candidate,
          versesByRef.get(candidate.ref)
        )
      )
    )
  };
}

export function buildSemanticRefillLlmRequest(options: {
  batch: SemanticRefillLlmBatch;
  model: string;
}): SemanticRefillLlmClientRequest {
  return {
    model: options.model,
    temperature: 0,
    responseSchema: buildSemanticRefillLlmJsonSchema(options.batch),
    messages: [
      { role: "system", content: SEMANTIC_REFILL_LLM_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify(compactSemanticRefillPrompt(options.batch))
      }
    ]
  };
}

export function compactSemanticRefillPrompt(batch: SemanticRefillLlmBatch): {
  task: string;
  bible: string;
  scope: string;
  schemaName: string;
  rules: string[];
  verses: Array<{
    ref: string;
    text: string;
    tokens: Array<{
      i: number;
      t: string;
      n: string;
      occupied: string[];
      weak: boolean;
    }>;
  }>;
  candidates: Array<Record<string, unknown>>;
} {
  const verses = new Map<
    string,
    {
      ref: string;
      text: string;
      tokens: Array<{
        i: number;
        t: string;
        n: string;
        occupied: string[];
        weak: boolean;
      }>;
    }
  >();
  for (const candidate of batch.candidates) {
    if (verses.has(candidate.ref)) continue;
    const available = new Map(
      candidate.availableTargets.map((target) => [target.wordIndex, target])
    );
    verses.set(candidate.ref, {
      ref: candidate.ref,
      text: candidate.text,
      tokens: candidate.tokens.map((token) => ({
        i: token.wordIndex,
        t: token.text,
        n: token.normalized,
        occupied: available.get(token.wordIndex)?.occupiedStrong ?? [],
        weak: available.get(token.wordIndex)?.weak ?? false
      }))
    });
  }

  return {
    task: "semantic-refill-candidate-decisions",
    bible: batch.bible,
    scope: batch.scope,
    schemaName: SEMANTIC_REFILL_LLM_JSON_SCHEMA.name,
    rules: [
      "Return exactly one selection per candidate id.",
      "Use only a choiceId listed in that candidate's choices.",
      "Do not return Strong codes, refs, word indexes, or target text."
    ],
    verses: [...verses.values()],
    candidates: batch.candidates.map((candidate) => ({
      id: candidate.id,
      ref: candidate.ref,
      auditKind: candidate.auditKind,
      priority: candidate.priority,
      strong: candidate.strong,
      stepIdentity: candidate.stepIdentity,
      currentPlacement: candidate.currentPlacement,
      currentTarget: candidate.currentTarget,
      sourcePlacement: candidate.sourcePlacement,
      referenceWitnesses: Object.entries(candidate.referenceInventory)
        .filter(([, strong]) => strong.includes(candidate.strong))
        .map(([name]) => name),
      nearbyOpenTargetIndexes: candidate.nearbyOpenTargets.map(
        (target) => target.wordIndex
      ),
      blockedTargetIndexes: candidate.blockedTargets.map(
        (target) => target.wordIndex
      ),
      warnings: candidate.placementWarnings,
      deterministicCandidates: candidate.deterministicCandidates.map(
        (deterministic) => ({
          target: deterministic.target,
          score: deterministic.score,
          wordIndex: deterministic.wordIndex,
          startWordIndex: deterministic.startWordIndex,
          endWordIndex: deterministic.endWordIndex,
          evidence: deterministic.evidence
        })
      ),
      choices: candidate.choices
    }))
  };
}

export function evaluateSemanticRefillLlmDecisions(options: {
  bible: string;
  verses: StrongLedgerVerse[];
  batch: SemanticRefillLlmBatch;
  rawDecisions: SemanticRefillLlmRawDecision[];
  autoAcceptThreshold?: number;
  referenceStyleFinalization?: boolean;
}): Pick<SemanticRefillLlmRunResult, "validated" | "pending" | "rejected"> {
  const autoAcceptThreshold = options.autoAcceptThreshold ?? 0.84;
  if (
    !Number.isFinite(autoAcceptThreshold) ||
    autoAcceptThreshold < 0 ||
    autoAcceptThreshold > 1
  ) {
    throw new Error(`invalid-auto-accept-threshold:${autoAcceptThreshold}`);
  }
  if (options.referenceStyleFinalization) {
    assertSemanticRefillRawDecisionContract({
      batch: options.batch,
      rawDecisions: options.rawDecisions
    });
  }
  const versesByRef = new Map(
    options.verses.map((verse) => [verse.ref, verse])
  );
  const candidatesById = new Map(
    options.batch.candidates.map((candidate) => [candidate.id, candidate])
  );
  const validated: SemanticRefillDecision[] = [];
  const validatedRaw = new Map<
    SemanticRefillDecision,
    SemanticRefillLlmRawDecision
  >();
  const pending: SemanticRefillLlmEvaluatedDecision[] = [];
  const rejected: SemanticRefillLlmEvaluatedDecision[] = [];

  const accept = (
    decision: SemanticRefillDecision,
    raw: SemanticRefillLlmRawDecision
  ): void => {
    validated.push(decision);
    validatedRaw.set(decision, raw);
  };

  for (const raw of options.rawDecisions) {
    const candidate = candidatesById.get(raw.id);
    const verse = raw.ref ? versesByRef.get(raw.ref) : undefined;
    const normalizedRaw = normalizeRawDecision(raw);

    if (!candidate || !verse) {
      rejected.push(
        rejectedEvaluation(normalizedRaw, "unknown-candidate-or-verse")
      );
      continue;
    }
    const structural = validateRawDecision(candidate, normalizedRaw);
    if (structural) {
      rejected.push(rejectedEvaluation(normalizedRaw, structural));
      continue;
    }

    if (isReferenceStyleEmptyType(normalizedRaw.decision)) {
      if (options.referenceStyleFinalization) {
        const fallback = referenceStyleEmptyOverride({
          bible: options.bible,
          candidate,
          raw: normalizedRaw,
          reason: `reference-style-empty-fallback:llm-classified-${normalizedRaw.decision}`
        });
        if (normalizedRaw.confidence < autoAcceptThreshold) {
          pending.push(
            pendingEvaluation(
              normalizedRaw,
              belowAutoAcceptThresholdReason(
                normalizedRaw.confidence,
                autoAcceptThreshold
              ),
              fallback
            )
          );
        } else {
          accept(fallback, normalizedRaw);
        }
      } else {
        rejected.push(
          rejectedEvaluation(
            normalizedRaw,
            `llm-classified-${normalizedRaw.decision}`
          )
        );
      }
      continue;
    }

    if (
      normalizedRaw.decision === "duplicate" ||
      normalizedRaw.decision === "reject"
    ) {
      rejected.push(
        rejectedEvaluation(
          normalizedRaw,
          `llm-classified-${normalizedRaw.decision}`
        )
      );
      continue;
    }

    if (normalizedRaw.decision === "pending-human") {
      pending.push(
        pendingEvaluation(
          normalizedRaw,
          "llm requested human review before a durable override"
        )
      );
      continue;
    }

    const override = rawDecisionToOverride({
      bible: options.bible,
      candidate,
      raw: normalizedRaw
    });
    if (!override) {
      pending.push(
        pendingEvaluation(
          normalizedRaw,
          "llm requested human review before a durable override"
        )
      );
      continue;
    }

    if (normalizedRaw.confidence < autoAcceptThreshold) {
      pending.push(
        pendingEvaluation(
          normalizedRaw,
          belowAutoAcceptThresholdReason(
            normalizedRaw.confidence,
            autoAcceptThreshold
          ),
          override
        )
      );
      continue;
    }

    const validation = validateSemanticRefillDecision({
      verse,
      decision: override
    });
    if (validation.status === "rejected") {
      if (options.referenceStyleFinalization) {
        accept(
          referenceStyleEmptyOverride({
            bible: options.bible,
            candidate,
            raw: normalizedRaw,
            reason: `reference-style-empty-fallback:${validation.reason}`
          }),
          normalizedRaw
        );
      } else {
        rejected.push(rejectedEvaluation(normalizedRaw, validation.reason));
      }
      continue;
    }

    const duplicateReason = findDuplicateReaderStrong(verse, override);
    if (duplicateReason) {
      rejected.push(rejectedEvaluation(normalizedRaw, duplicateReason));
      continue;
    }

    const stackingReason = findSuspiciousStacking(verse, override);
    if (stackingReason) {
      if (options.referenceStyleFinalization) {
        accept(
          referenceStyleEmptyOverride({
            bible: options.bible,
            candidate,
            raw: normalizedRaw,
            reason: `reference-style-empty-fallback:${stackingReason}`
          }),
          normalizedRaw
        );
      } else {
        pending.push(
          pendingEvaluation(normalizedRaw, stackingReason, override)
        );
      }
      continue;
    }

    accept(override, normalizedRaw);
  }

  if (!options.referenceStyleFinalization) {
    const batchStacking = findSuspiciousBatchStacking(validated);
    if (batchStacking.size > 0) {
      const retained: SemanticRefillDecision[] = [];
      for (const decision of validated) {
        if (!batchStacking.has(decision)) {
          retained.push(decision);
          continue;
        }
        const raw = validatedRaw.get(decision);
        if (!raw) throw new Error("missing-raw-decision-for-batch-stacking");
        pending.push(
          pendingEvaluation(
            raw,
            "suspicious-batch-stacking-on-same-word",
            decision
          )
        );
      }
      return { validated: retained, pending, rejected };
    }
  }

  return { validated, pending, rejected };
}

function findSuspiciousBatchStacking(
  decisions: SemanticRefillDecision[]
): Set<SemanticRefillDecision> {
  const byWord = new Map<string, SemanticRefillDecision[]>();
  for (const decision of decisions) {
    if ((decision.target ?? "word") !== "word") continue;
    const key = `${decision.ref}\u0000${decision.wordIndex}`;
    const grouped = byWord.get(key) ?? [];
    grouped.push(decision);
    byWord.set(key, grouped);
  }

  return new Set(
    [...byWord.values()].filter((grouped) => grouped.length > 1).flat()
  );
}

function belowAutoAcceptThresholdReason(
  confidence: number,
  threshold: number
): string {
  return `below-auto-accept-threshold:${confidence}<${threshold}`;
}

function auditItemToPacket(
  bible: string,
  item: SemanticRefillAuditItem,
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket {
  const packet = {
    id: stableCandidateId(bible, item),
    bible: bible.toLowerCase(),
    ref: item.ref,
    text: item.text,
    auditKind: item.auditKind ?? "missing",
    priority: item.priority,
    strong: item.strong,
    stepIdentity: item.stepIdentity,
    currentPlacement: item.currentPlacement,
    currentTarget: item.currentTarget,
    sourcePlacement: {
      placement: item.annotation.placement,
      insertAfterWordIndex: item.annotation.insertAfterWordIndex
    },
    reason: item.reason,
    eligible: item.eligible,
    tokens: item.tokens.map((token) => ({
      wordIndex: token.wordIndex,
      text: token.text,
      normalized: token.normalized
    })),
    originalInventory: item.originalInventory.map((strong) =>
      strong.toUpperCase()
    ),
    referenceInventory: Object.fromEntries(
      Object.entries(item.referenceInventory).map(([name, strong]) => [
        name,
        strong.map((code) => code.toUpperCase())
      ])
    ),
    existingReaderStrong:
      verse?.annotations
        .filter((annotation) => annotation.visibility === "reader")
        .map((annotation) => ({
          placement: annotation.placement,
          strong: annotation.strong.toUpperCase(),
          wordIndex: annotation.wordIndex,
          startWordIndex: annotation.startWordIndex,
          endWordIndex: annotation.endWordIndex,
          normalizedWord: annotation.normalizedWord,
          normalizedPhrase: annotation.normalizedPhrase
        })) ?? [],
    occupiedTargets: buildOccupiedTargets(verse),
    availableTargets: buildAvailableTargets(item.tokens, verse),
    blockedTargets: buildBlockedTargets(item.tokens, verse),
    openContentTargets: buildOpenContentTargets(item.tokens, verse),
    nearbyOpenTargets: buildNearbyOpenTargets(item, verse),
    placementWarnings: buildPlacementWarnings(item, verse),
    deterministicCandidates: item.candidates.map((candidate) => ({
      target: candidate.target,
      strong: candidate.strong.toUpperCase(),
      score: candidate.score,
      wordIndex: candidate.wordIndex,
      normalizedWord: candidate.normalizedWord,
      startWordIndex: candidate.startWordIndex,
      endWordIndex: candidate.endWordIndex,
      normalizedPhrase: candidate.normalizedPhrase,
      evidence: candidate.evidence
    })),
    choices: []
  };
  return {
    ...packet,
    choices: buildSemanticRefillLlmChoices(packet)
  };
}

function buildOccupiedTargets(
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket["occupiedTargets"] {
  if (!verse) return [];
  const wordTargets = new Map<
    number,
    SemanticRefillLlmCandidatePacket["occupiedTargets"][number]
  >();
  const phraseTargets: SemanticRefillLlmCandidatePacket["occupiedTargets"] = [];

  for (const annotation of verse.annotations) {
    if (annotation.visibility !== "reader") continue;
    const strong = annotation.strong.toUpperCase();
    if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
      const current = wordTargets.get(annotation.wordIndex) ?? {
        placement: "word" as const,
        strong: [],
        wordIndex: annotation.wordIndex,
        normalizedWord: annotation.normalizedWord
      };
      current.strong.push(strong);
      wordTargets.set(annotation.wordIndex, current);
      continue;
    }

    if (annotation.placement === "phrase") {
      phraseTargets.push({
        placement: "phrase",
        strong: [strong],
        startWordIndex: annotation.startWordIndex,
        endWordIndex: annotation.endWordIndex,
        normalizedPhrase: annotation.normalizedPhrase
      });
    }
  }

  return [...wordTargets.values(), ...phraseTargets].sort(
    (left, right) =>
      (left.wordIndex ?? left.startWordIndex ?? 0) -
      (right.wordIndex ?? right.startWordIndex ?? 0)
  );
}

function buildAvailableTargets(
  tokens: SemanticRefillAuditItem["tokens"],
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket["availableTargets"] {
  const occupiedByWord = new Map<number, string[]>();
  for (const annotation of verse?.annotations ?? []) {
    if (annotation.visibility !== "reader") continue;
    if (annotation.placement === "word" && annotation.wordIndex !== undefined) {
      const current = occupiedByWord.get(annotation.wordIndex) ?? [];
      current.push(annotation.strong.toUpperCase());
      occupiedByWord.set(annotation.wordIndex, current);
      continue;
    }
    if (
      annotation.placement === "phrase" &&
      annotation.startWordIndex !== undefined &&
      annotation.endWordIndex !== undefined
    ) {
      for (
        let wordIndex = annotation.startWordIndex;
        wordIndex <= annotation.endWordIndex;
        wordIndex += 1
      ) {
        const current = occupiedByWord.get(wordIndex) ?? [];
        current.push(annotation.strong.toUpperCase());
        occupiedByWord.set(wordIndex, current);
      }
    }
  }

  return tokens.map((token) => ({
    wordIndex: token.wordIndex,
    text: token.text,
    normalized: token.normalized,
    weak: WEAK_WORDS.has(token.normalized),
    occupiedStrong: occupiedByWord.get(token.wordIndex) ?? []
  }));
}

function buildBlockedTargets(
  tokens: SemanticRefillAuditItem["tokens"],
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket["blockedTargets"] {
  return buildAvailableTargets(tokens, verse)
    .filter((target) => target.occupiedStrong.length > 0)
    .map((target) => ({
      wordIndex: target.wordIndex,
      text: target.text,
      normalized: target.normalized,
      occupiedStrong: target.occupiedStrong,
      reason: "already-has-reader-strong"
    }));
}

function buildOpenContentTargets(
  tokens: SemanticRefillAuditItem["tokens"],
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket["openContentTargets"] {
  return buildAvailableTargets(tokens, verse)
    .filter((target) => !target.weak && target.occupiedStrong.length === 0)
    .map((target) => ({
      wordIndex: target.wordIndex,
      text: target.text,
      normalized: target.normalized
    }));
}

function buildNearbyOpenTargets(
  item: SemanticRefillAuditItem,
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket["nearbyOpenTargets"] {
  const sourceIndex = item.annotation.insertAfterWordIndex;
  if (sourceIndex === undefined) return [];
  return buildOpenContentTargets(item.tokens, verse)
    .map((target) => ({
      ...target,
      distanceFromSource: Math.abs(target.wordIndex - sourceIndex)
    }))
    .sort(
      (left, right) =>
        left.distanceFromSource - right.distanceFromSource ||
        left.wordIndex - right.wordIndex
    )
    .slice(0, 8);
}

function buildPlacementWarnings(
  item: SemanticRefillAuditItem,
  verse?: StrongLedgerVerse
): string[] {
  if (!verse) return [];
  const availableTargets = buildAvailableTargets(item.tokens, verse);
  const occupiedWords = availableTargets.filter(
    (target) => target.occupiedStrong.length > 0
  );
  const openContentWords = availableTargets.filter(
    (target) => !target.weak && target.occupiedStrong.length === 0
  );
  const warnings: string[] = [];

  if (occupiedWords.length > 0 && openContentWords.length > 0) {
    warnings.push(
      "avoid-stacking-on-occupied-word-while-unoccupied-content-targets-exist"
    );
  }
  if (item.candidates.every((candidate) => candidate.target === "empty")) {
    warnings.push(
      "deterministic-backend-found-no-visible-carrier-check-semantics-carefully"
    );
  }

  return warnings;
}

function stableCandidateId(
  bible: string,
  item: SemanticRefillAuditItem
): string {
  const identity = JSON.stringify({
    bible: bible.toLowerCase(),
    ref: item.ref,
    strong: item.strong.toUpperCase(),
    auditKind: item.auditKind ?? "missing",
    annotationId: item.stepIdentity ? undefined : item.annotation.id,
    originalTokenId: item.stepIdentity?.originalTokenId,
    originalOccurrenceIds: item.stepIdentity?.originalOccurrenceIds,
    stepDStrong: item.stepIdentity?.dStrong,
    currentPlacement: item.currentPlacement,
    sourcePlacement: item.annotation.placement,
    insertAfterWordIndex: item.annotation.insertAfterWordIndex ?? null,
    currentTarget: item.currentTarget ?? null
  });
  const digest = createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 20);
  return `srl:${bible.toLowerCase()}:${item.ref}:${item.strong.toUpperCase()}:${digest}`;
}

function assertUniqueCandidateIds<T extends SemanticRefillLlmCandidatePacket>(
  candidates: T[]
): T[] {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      throw new Error(`duplicate-semantic-refill-candidate-id:${candidate.id}`);
    }
    seen.add(candidate.id);
  }
  return candidates;
}

export function ensureCandidateChoices(
  candidate: SemanticRefillLlmCandidatePacket
): SemanticRefillLlmCandidatePacket {
  if (Array.isArray(candidate.choices) && candidate.choices.length > 0) {
    return candidate;
  }
  return {
    ...candidate,
    choices: buildSemanticRefillLlmChoices(candidate)
  };
}

export function buildSemanticRefillLlmChoices(
  candidate:
    | Omit<SemanticRefillLlmCandidatePacket, "choices">
    | SemanticRefillLlmCandidatePacket
): SemanticRefillLlmChoice[] {
  const choices: SemanticRefillLlmChoice[] = [];
  const seen = new Set<string>();
  const add = (choice: SemanticRefillLlmChoice): void => {
    if (seen.has(choice.id)) return;
    seen.add(choice.id);
    choices.push(choice);
  };

  for (const target of candidate.availableTargets) {
    add({
      id: `word:${target.wordIndex}`,
      decision: "word",
      description: [
        `word ${target.wordIndex}: ${target.text} (${target.normalized})`,
        target.weak ? "weak" : "content",
        target.occupiedStrong.length > 0
          ? `occupied:${target.occupiedStrong.join(",")}`
          : "open"
      ].join("; "),
      wordIndex: target.wordIndex,
      normalized: target.normalized,
      startWordIndex: null,
      endWordIndex: null,
      normalizedPhrase: null
    });
  }

  for (const target of candidate.deterministicCandidates) {
    if (
      target.target !== "phrase" ||
      target.startWordIndex === undefined ||
      target.endWordIndex === undefined ||
      !target.normalizedPhrase ||
      target.normalizedPhrase.length === 0
    ) {
      continue;
    }
    add({
      id: `phrase:${target.startWordIndex}-${target.endWordIndex}`,
      decision: "phrase",
      description: `phrase ${target.startWordIndex}-${target.endWordIndex}: ${target.normalizedPhrase.join(" ")}`,
      wordIndex: null,
      normalized: null,
      startWordIndex: target.startWordIndex,
      endWordIndex: target.endWordIndex,
      normalizedPhrase: target.normalizedPhrase
    });
  }

  const emptyWordIndex =
    candidate.sourcePlacement.insertAfterWordIndex ??
    candidate.currentTarget?.wordIndex ??
    0;
  add({
    id: "empty",
    decision: "empty",
    description: "Keep the Strong off visible French words.",
    wordIndex: emptyWordIndex,
    normalized: null,
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null
  });

  for (const decision of [
    "technical",
    "duplicate",
    "not-rendered",
    "pending-human",
    "reject"
  ] as const) {
    add({
      id: decision,
      decision,
      description: terminalChoiceDescription(decision),
      wordIndex: null,
      normalized: null,
      startWordIndex: null,
      endWordIndex: null,
      normalizedPhrase: null
    });
  }

  return choices;
}

function terminalChoiceDescription(
  decision: Exclude<SemanticRefillLlmDecisionType, "word" | "phrase" | "empty">
): string {
  switch (decision) {
    case "technical":
      return "Technical or grammatical Strong; no reader carrier.";
    case "duplicate":
      return "Already represented correctly; keep the existing placement.";
    case "not-rendered":
      return "The source notion is not naturally rendered in French.";
    case "pending-human":
      return "No bounded choice is reliable enough; require human review.";
    case "reject":
      return "The candidate itself is invalid or unsupported.";
  }
}

function compareAuditItems(
  left: SemanticRefillAuditItem,
  right: SemanticRefillAuditItem
): number {
  return (
    priorityRank(right.priority) - priorityRank(left.priority) ||
    bestScore(right) - bestScore(left) ||
    left.ref.localeCompare(right.ref) ||
    left.strong.localeCompare(right.strong)
  );
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

function bestScore(item: SemanticRefillAuditItem): number {
  return item.candidates[0]?.score ?? 0;
}

export function parseSemanticRefillLlmResponse(
  value: unknown,
  batch: SemanticRefillLlmBatch
): SemanticRefillLlmRawDecision[] {
  if (!isRecord(value)) throw llmContractError("response-not-object");
  assertExactKeys(value, ["decisions"], "response");
  if (!Array.isArray(value.decisions)) {
    throw llmContractError("missing-decisions-array");
  }

  const candidates = assertUniqueCandidateIds(
    batch.candidates.map(ensureCandidateChoices)
  );
  if (value.decisions.length !== candidates.length) {
    throw llmContractError(
      `decision-count-mismatch:expected-${candidates.length}:received-${value.decisions.length}`
    );
  }

  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate])
  );
  const seen = new Set<string>();
  const decisions: SemanticRefillLlmRawDecision[] = [];

  for (const [index, raw] of value.decisions.entries()) {
    if (!isRecord(raw)) {
      throw llmContractError(`decision-${index}-not-object`);
    }
    assertExactKeys(
      raw,
      ["id", "choiceId", "confidence", "reason", "evidence"],
      `decision-${index}`
    );
    if (typeof raw.id !== "string" || !raw.id) {
      throw llmContractError(`decision-${index}-invalid-id`);
    }
    if (seen.has(raw.id)) {
      throw llmContractError(`duplicate-candidate-id:${raw.id}`);
    }
    const candidate = candidatesById.get(raw.id);
    if (!candidate) {
      throw llmContractError(`unknown-candidate-id:${raw.id}`);
    }
    if (typeof raw.choiceId !== "string" || !raw.choiceId) {
      throw llmContractError(`decision-${raw.id}-invalid-choice-id`);
    }
    const choice = candidate.choices.find(
      (candidateChoice) => candidateChoice.id === raw.choiceId
    );
    if (!choice) {
      throw llmContractError(
        `unknown-choice-id:${raw.id}:${String(raw.choiceId)}`
      );
    }
    if (
      typeof raw.confidence !== "number" ||
      !Number.isFinite(raw.confidence) ||
      raw.confidence < 0 ||
      raw.confidence > 1
    ) {
      throw llmContractError(`decision-${raw.id}-invalid-confidence`);
    }
    if (typeof raw.reason !== "string" || raw.reason.trim().length === 0) {
      throw llmContractError(`decision-${raw.id}-missing-reason`);
    }
    if (
      !Array.isArray(raw.evidence) ||
      !raw.evidence.every((entry) => typeof entry === "string")
    ) {
      throw llmContractError(`decision-${raw.id}-invalid-evidence`);
    }

    seen.add(raw.id);
    decisions.push(
      choiceSelectionToRawDecision(candidate, choice, {
        id: raw.id,
        choiceId: raw.choiceId,
        confidence: raw.confidence,
        reason: raw.reason,
        evidence: raw.evidence as string[]
      })
    );
  }

  const missing = candidates
    .map((candidate) => candidate.id)
    .filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw llmContractError(`missing-candidate-ids:${missing.join(",")}`);
  }
  return decisions;
}

export function assertSemanticRefillRawDecisionContract(options: {
  batch: SemanticRefillLlmBatch;
  rawDecisions: SemanticRefillLlmRawDecision[];
}): void {
  const candidates = assertUniqueCandidateIds(
    options.batch.candidates.map(ensureCandidateChoices)
  );
  if (options.rawDecisions.length !== candidates.length) {
    throw llmContractError(
      `decision-count-mismatch:expected-${candidates.length}:received-${options.rawDecisions.length}`
    );
  }
  assertSemanticRefillRawDecisionSubsetContract(options);
  const seen = new Set(options.rawDecisions.map((raw) => raw.id));
  const missing = candidates
    .map((candidate) => candidate.id)
    .filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw llmContractError(`missing-candidate-ids:${missing.join(",")}`);
  }
}

export function assertSemanticRefillRawDecisionSubsetContract(options: {
  batch: SemanticRefillLlmBatch;
  rawDecisions: SemanticRefillLlmRawDecision[];
}): void {
  const candidates = assertUniqueCandidateIds(
    options.batch.candidates.map(ensureCandidateChoices)
  );
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate])
  );
  const seen = new Set<string>();
  for (const raw of options.rawDecisions) {
    if (seen.has(raw.id)) {
      throw llmContractError(`duplicate-candidate-id:${raw.id}`);
    }
    const candidate = byId.get(raw.id);
    if (!candidate) throw llmContractError(`unknown-candidate-id:${raw.id}`);
    const error = validateRawDecision(candidate, raw);
    if (error) throw llmContractError(`${raw.id}:${error}`);
    seen.add(raw.id);
  }
}

function choiceSelectionToRawDecision(
  candidate: SemanticRefillLlmCandidatePacket,
  choice: SemanticRefillLlmChoice,
  selection: SemanticRefillLlmSelection
): SemanticRefillLlmRawDecision {
  return {
    id: candidate.id,
    choiceId: choice.id,
    ref: candidate.ref,
    decision: choice.decision,
    strong: [candidate.strong.toUpperCase()],
    confidence: selection.confidence,
    reason: selection.reason,
    wordIndex: choice.wordIndex,
    normalized: choice.normalized,
    startWordIndex: choice.startWordIndex,
    endWordIndex: choice.endWordIndex,
    normalizedPhrase: choice.normalizedPhrase,
    evidence: selection.evidence
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  path: string
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw llmContractError(
      `${path}-invalid-keys:expected-${wanted.join(",")}:received-${actual.join(",")}`
    );
  }
}

function llmContractError(reason: string): Error {
  return new Error(`semantic-refill-llm-contract:${reason}`);
}

function normalizeRawDecision(
  raw: Partial<SemanticRefillLlmRawDecision>
): SemanticRefillLlmRawDecision {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    choiceId: typeof raw.choiceId === "string" ? raw.choiceId : "",
    ref: typeof raw.ref === "string" ? raw.ref : "",
    decision: isLlmDecisionType(raw.decision) ? raw.decision : "reject",
    strong: Array.isArray(raw.strong)
      ? raw.strong
          .filter((strong): strong is string => typeof strong === "string")
          .map((strong) => strong.toUpperCase())
      : [],
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    reason: typeof raw.reason === "string" ? raw.reason : "",
    wordIndex:
      typeof raw.wordIndex === "number" && Number.isInteger(raw.wordIndex)
        ? raw.wordIndex
        : null,
    normalized: typeof raw.normalized === "string" ? raw.normalized : null,
    startWordIndex:
      typeof raw.startWordIndex === "number" &&
      Number.isInteger(raw.startWordIndex)
        ? raw.startWordIndex
        : null,
    endWordIndex:
      typeof raw.endWordIndex === "number" && Number.isInteger(raw.endWordIndex)
        ? raw.endWordIndex
        : null,
    normalizedPhrase: Array.isArray(raw.normalizedPhrase)
      ? raw.normalizedPhrase.filter(
          (token): token is string => typeof token === "string"
        )
      : null,
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence.filter((item): item is string => typeof item === "string")
      : []
  };
}

function validateRawDecision(
  candidate: SemanticRefillLlmCandidatePacket,
  raw: SemanticRefillLlmRawDecision
): string | undefined {
  if (!isLlmDecisionType(raw.decision)) return "invalid-decision-type";
  if (raw.ref !== candidate.ref) return "ref-mismatch";
  if (raw.confidence < 0 || raw.confidence > 1) return "invalid-confidence";
  if (raw.strong.length === 0) return "missing-strong";
  if (!raw.strong.every((strong) => /^[HG]\d{4}$/u.test(strong))) {
    return "invalid-strong-format";
  }
  if (
    raw.strong.length !== 1 ||
    raw.strong[0] !== candidate.strong.toUpperCase()
  ) {
    return "strong-not-allowed-for-candidate";
  }
  const candidateWithChoices = ensureCandidateChoices(candidate);
  const choice = candidateWithChoices.choices.find(
    (candidateChoice) => candidateChoice.id === raw.choiceId
  );
  if (!choice) return "choice-not-allowed-for-candidate";
  if (raw.decision !== choice.decision) return "choice-decision-mismatch";
  if (
    raw.wordIndex !== choice.wordIndex ||
    raw.normalized !== choice.normalized ||
    raw.startWordIndex !== choice.startWordIndex ||
    raw.endWordIndex !== choice.endWordIndex ||
    !sameNullableStrings(raw.normalizedPhrase, choice.normalizedPhrase)
  ) {
    return "choice-target-mismatch";
  }
  return undefined;
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

function rawDecisionToOverride(options: {
  bible: string;
  candidate: SemanticRefillLlmCandidatePacket;
  raw: SemanticRefillLlmRawDecision;
}): SemanticRefillDecision | undefined {
  const evidence = [
    ...options.raw.evidence,
    `llm-decision:${options.raw.decision}`,
    options.raw.reason
  ].filter(Boolean);
  const base = {
    bible: options.bible.toLowerCase(),
    ref: options.raw.ref,
    replace:
      options.candidate.auditKind === "relocation" &&
      options.candidate.currentTarget &&
      options.candidate.currentTarget.target !== "technical"
        ? {
            target: options.candidate.currentTarget.target,
            wordIndex: options.candidate.currentTarget.wordIndex,
            startWordIndex: options.candidate.currentTarget.startWordIndex,
            endWordIndex: options.candidate.currentTarget.endWordIndex
          }
        : undefined,
    strong: options.raw.strong,
    confidence: options.raw.confidence,
    source: "semantic-refill:llm",
    reason: evidence.join("; "),
    status: "accept" as const,
    score: options.raw.confidence,
    priority: options.candidate.priority,
    evidence
  };

  if (options.raw.decision === "word") {
    if (
      options.raw.wordIndex === null ||
      typeof options.raw.normalized !== "string"
    ) {
      return undefined;
    }
    return {
      ...base,
      target: "word",
      wordIndex: options.raw.wordIndex,
      normalized: options.raw.normalized
    };
  }

  if (options.raw.decision === "phrase") {
    if (
      options.raw.startWordIndex === null ||
      options.raw.endWordIndex === null ||
      !options.raw.normalizedPhrase
    ) {
      return undefined;
    }
    return {
      ...base,
      target: "phrase",
      wordIndex: options.raw.startWordIndex,
      normalized: options.raw.normalizedPhrase.join(" "),
      startWordIndex: options.raw.startWordIndex,
      endWordIndex: options.raw.endWordIndex,
      normalizedPhrase: options.raw.normalizedPhrase
    };
  }

  if (options.raw.decision === "empty") {
    return {
      ...base,
      target: "empty",
      wordIndex:
        options.raw.wordIndex ??
        options.candidate.sourcePlacement.insertAfterWordIndex ??
        options.candidate.currentTarget?.wordIndex ??
        0,
      normalized: ""
    };
  }

  return undefined;
}

function referenceStyleEmptyOverride(options: {
  bible: string;
  candidate: SemanticRefillLlmCandidatePacket;
  raw?: SemanticRefillLlmRawDecision;
  reason: string;
}): SemanticRefillDecision {
  const confidence = Math.min(options.raw?.confidence ?? 0.7, 0.83);
  const evidence = [
    ...(options.raw?.evidence ?? []),
    options.raw ? `llm-decision:${options.raw.decision}` : undefined,
    options.raw?.reason,
    options.reason
  ].filter((item): item is string => Boolean(item));

  return {
    bible: options.bible.toLowerCase(),
    ref: options.candidate.ref,
    replace:
      options.candidate.auditKind === "relocation" &&
      options.candidate.currentTarget &&
      options.candidate.currentTarget.target !== "technical"
        ? {
            target: options.candidate.currentTarget.target,
            wordIndex: options.candidate.currentTarget.wordIndex,
            startWordIndex: options.candidate.currentTarget.startWordIndex,
            endWordIndex: options.candidate.currentTarget.endWordIndex
          }
        : undefined,
    target: "empty",
    wordIndex:
      options.candidate.sourcePlacement.insertAfterWordIndex ??
      options.candidate.currentTarget?.wordIndex ??
      0,
    normalized: "",
    strong: [options.candidate.strong.toUpperCase()],
    confidence,
    source: "semantic-refill:llm-reference-style",
    reason: evidence.join("; "),
    status: "accept",
    score: confidence,
    priority: options.candidate.priority,
    evidence
  };
}

function findDuplicateReaderStrong(
  verse: StrongLedgerVerse,
  decision: SemanticRefillDecision
): string | undefined {
  const target = decision.target ?? "word";
  for (const annotation of verse.annotations) {
    if (annotation.visibility !== "reader") continue;
    if (!decision.strong.includes(annotation.strong.toUpperCase())) continue;
    if (
      target === "word" &&
      annotation.placement === "word" &&
      annotation.wordIndex === decision.wordIndex
    ) {
      return "duplicate-reader-word-strong";
    }
    if (
      target === "phrase" &&
      annotation.placement === "phrase" &&
      annotation.startWordIndex === decision.startWordIndex &&
      annotation.endWordIndex === decision.endWordIndex
    ) {
      return "duplicate-reader-phrase-strong";
    }
  }
  return undefined;
}

function findSuspiciousStacking(
  verse: StrongLedgerVerse,
  decision: SemanticRefillDecision
): string | undefined {
  if ((decision.target ?? "word") !== "word") return undefined;
  const chosen = verse.tokens[decision.wordIndex];
  if (!chosen || WEAK_WORDS.has(chosen.normalized)) return undefined;

  const decisionStrong = new Set(
    decision.strong.map((strong) => strong.toUpperCase())
  );
  const occupiedByOtherStrong = verse.annotations.some(
    (annotation) =>
      annotation.visibility === "reader" &&
      annotation.placement === "word" &&
      annotation.wordIndex === decision.wordIndex &&
      !decisionStrong.has(annotation.strong.toUpperCase())
  );
  if (!occupiedByOtherStrong) return undefined;

  const hasOpenContentTarget = verse.tokens.some((token) => {
    if (token.wordIndex === decision.wordIndex) return false;
    if (WEAK_WORDS.has(token.normalized)) return false;
    return !verse.annotations.some(
      (annotation) =>
        annotation.visibility === "reader" &&
        annotation.placement === "word" &&
        annotation.wordIndex === token.wordIndex
    );
  });
  if (!hasOpenContentTarget) return undefined;

  return "suspicious-stacking-on-occupied-word";
}

function isReferenceStyleEmptyType(
  decision: SemanticRefillLlmDecisionType
): boolean {
  return decision === "technical" || decision === "not-rendered";
}

function rejectedEvaluation(
  raw: SemanticRefillLlmRawDecision,
  reason: string
): SemanticRefillLlmEvaluatedDecision {
  return {
    id: raw.id,
    ref: raw.ref,
    decisionType: raw.decision,
    status: "rejected",
    strong: raw.strong,
    confidence: raw.confidence,
    reason,
    evidence: [...raw.evidence, raw.reason, reason].filter(Boolean)
  };
}

function pendingEvaluation(
  raw: SemanticRefillLlmRawDecision,
  reason: string,
  override?: SemanticRefillDecision
): SemanticRefillLlmEvaluatedDecision {
  return {
    id: raw.id,
    ref: raw.ref,
    decisionType: raw.decision,
    status: "pending-human",
    strong: raw.strong,
    confidence: raw.confidence,
    reason,
    evidence: [...raw.evidence, raw.reason, reason].filter(Boolean),
    override
  };
}

function isLlmDecisionType(
  value: unknown
): value is SemanticRefillLlmDecisionType {
  return SEMANTIC_REFILL_LLM_DECISION_TYPES.includes(
    value as SemanticRefillLlmDecisionType
  );
}
