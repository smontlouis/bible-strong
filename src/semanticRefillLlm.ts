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
  decisions: SemanticRefillLlmRawDecision[];
}

export interface SemanticRefillLlmClientRequest {
  model: string;
  temperature: 0;
  messages: Array<{ role: "system" | "user"; content: string }>;
  responseSchema: typeof SEMANTIC_REFILL_LLM_JSON_SCHEMA;
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
  client?: SemanticRefillLlmClient;
  mockResponse?: SemanticRefillLlmResponse | unknown;
}

export const SEMANTIC_REFILL_LLM_SYSTEM_PROMPT = [
  "Tu es un expert d'alignement biblique Strong pour un backend semantic-refill.",
  "Réponds uniquement avec du JSON conforme au schema fourni.",
  "N'invente jamais de Strong: utilise seulement les codes fournis dans chaque candidat.",
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
  "Pour word et phrase, les index et normalisations doivent correspondre exactement aux tokens fournis.",
  "Ne tague pas articles, pronoms, conjonctions ou mots faibles sauf préposition/construction clairement traduite.",
  "Préserve la différence entre un équivalent lexical visible, un doublon et un original non rendu.",
  "Procédure obligatoire avant chaque décision:",
  "1. Vérifie les Strong déjà présents dans existingReaderStrong/occupiedTargets.",
  "2. Pour auditKind=relocation, compare currentTarget aux alternatives dans deterministicCandidates avant de garder le placement courant.",
  "3. Si la meilleure cible porte déjà un autre Strong, ne l'empile pas par défaut: cherche d'abord une cible française plausible non occupée.",
  "4. N'empile plusieurs Strong sur un même mot que si le français fusionne réellement plusieurs notions et qu'aucune cible non occupée plausible n'existe.",
  "5. Si deux cibles plausibles existent, préfère la distribution qui garde les Strong distincts sur des mots distincts.",
  "6. Traite blockedTargets comme des cibles interdites pour decision=word, sauf fusion française indispensable.",
  "7. Quand sourcePlacement.insertAfterWordIndex existe, consulte nearbyOpenTargets et préfère une cible sémantique proche de l'emplacement original vide.",
  "8. Si tu hésites entre une cible bloquée et une cible ouverte, choisis la cible ouverte ou pending-human, jamais un word auto-confiant sur la cible bloquée.",
  "9. Mentionne explicitement dans reason pourquoi une cible occupée est quand même choisie, ou pourquoi elle est évitée."
].join("\n");

export const SEMANTIC_REFILL_LLM_JSON_SCHEMA = {
  name: "semantic_refill_llm_decisions",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["decisions"],
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "ref",
            "decision",
            "strong",
            "confidence",
            "reason",
            "wordIndex",
            "normalized",
            "startWordIndex",
            "endWordIndex",
            "normalizedPhrase",
            "evidence"
          ],
          properties: {
            id: { type: "string" },
            ref: { type: "string" },
            decision: {
              type: "string",
              enum: SEMANTIC_REFILL_LLM_DECISION_TYPES
            },
            strong: {
              type: "array",
              minItems: 1,
              items: { type: "string", pattern: "^[HG][0-9]{4}$" }
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string" },
            wordIndex: { type: ["integer", "null"] },
            normalized: { type: ["string", "null"] },
            startWordIndex: { type: ["integer", "null"] },
            endWordIndex: { type: ["integer", "null"] },
            normalizedPhrase: {
              type: ["array", "null"],
              items: { type: "string" }
            },
            evidence: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      }
    }
  },
  strict: true
} as const;

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
      : normalizeLlmResponse(
          options.mockResponse ?? (await options.client?.complete(request))
        ).decisions;
  const evaluated = evaluateSemanticRefillLlmDecisions({
    bible: options.bible,
    verses: options.verses,
    batch,
    rawDecisions,
    autoAcceptThreshold: options.autoAcceptThreshold ?? 0.84
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
    candidates: prioritized.map((candidate, index) =>
      auditItemToPacket(
        options.bible,
        candidate,
        index,
        versesByRef.get(candidate.ref)
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
    responseSchema: SEMANTIC_REFILL_LLM_JSON_SCHEMA,
    messages: [
      { role: "system", content: SEMANTIC_REFILL_LLM_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          task: "semantic-refill-candidate-decisions",
          bible: options.batch.bible,
          scope: options.batch.scope,
          schemaName: SEMANTIC_REFILL_LLM_JSON_SCHEMA.name,
          candidates: options.batch.candidates
        })
      }
    ]
  };
}

export function evaluateSemanticRefillLlmDecisions(options: {
  bible: string;
  verses: StrongLedgerVerse[];
  batch: SemanticRefillLlmBatch;
  rawDecisions: SemanticRefillLlmRawDecision[];
  autoAcceptThreshold?: number;
}): Pick<SemanticRefillLlmRunResult, "validated" | "pending" | "rejected"> {
  const versesByRef = new Map(
    options.verses.map((verse) => [verse.ref, verse])
  );
  const candidatesById = new Map(
    options.batch.candidates.map((candidate) => [candidate.id, candidate])
  );
  const validated: SemanticRefillDecision[] = [];
  const pending: SemanticRefillLlmEvaluatedDecision[] = [];
  const rejected: SemanticRefillLlmEvaluatedDecision[] = [];

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

    if (isTerminalRejectType(normalizedRaw.decision)) {
      rejected.push(
        rejectedEvaluation(
          normalizedRaw,
          `llm-classified-${normalizedRaw.decision}`
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

    const validation = validateSemanticRefillDecision({
      verse,
      decision: override
    });
    if (validation.status === "rejected") {
      rejected.push(rejectedEvaluation(normalizedRaw, validation.reason));
      continue;
    }

    const duplicateReason = findDuplicateReaderStrong(verse, override);
    if (duplicateReason) {
      rejected.push(rejectedEvaluation(normalizedRaw, duplicateReason));
      continue;
    }

    const stackingReason = findSuspiciousStacking(verse, override);
    if (stackingReason) {
      pending.push(pendingEvaluation(normalizedRaw, stackingReason, override));
      continue;
    }

    validated.push(override);
  }

  return { validated, pending, rejected };
}

function auditItemToPacket(
  bible: string,
  item: SemanticRefillAuditItem,
  index: number,
  verse?: StrongLedgerVerse
): SemanticRefillLlmCandidatePacket {
  return {
    id: [
      bible.toLowerCase(),
      item.ref,
      item.strong,
      item.annotation.id || item.currentPlacement,
      index
    ].join(":"),
    bible: bible.toLowerCase(),
    ref: item.ref,
    text: item.text,
    auditKind: item.auditKind ?? "missing",
    priority: item.priority,
    strong: item.strong,
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
    }))
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

function normalizeLlmResponse(value: unknown): SemanticRefillLlmResponse {
  if (!value || typeof value !== "object") return { decisions: [] };
  const decisions = (value as { decisions?: unknown }).decisions;
  if (!Array.isArray(decisions)) return { decisions: [] };
  return {
    decisions: decisions
      .filter((decision): decision is SemanticRefillLlmRawDecision =>
        Boolean(decision && typeof decision === "object")
      )
      .map((decision) =>
        normalizeRawDecision(decision as Partial<SemanticRefillLlmRawDecision>)
      )
  };
}

function normalizeRawDecision(
  raw: Partial<SemanticRefillLlmRawDecision>
): SemanticRefillLlmRawDecision {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
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
  const allowedStrong = new Set([
    candidate.strong.toUpperCase(),
    ...candidate.originalInventory,
    ...Object.values(candidate.referenceInventory).flat()
  ]);
  if (!raw.strong.every((strong) => allowedStrong.has(strong))) {
    return "strong-not-allowed-for-candidate";
  }
  return undefined;
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

function isTerminalRejectType(
  decision: SemanticRefillLlmDecisionType
): boolean {
  return (
    decision === "technical" ||
    decision === "duplicate" ||
    decision === "not-rendered" ||
    decision === "reject"
  );
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
