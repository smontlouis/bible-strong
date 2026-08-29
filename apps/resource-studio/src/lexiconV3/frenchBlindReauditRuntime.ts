import {
  FRENCH_PILOT_BLIND_REAUDIT_DECISION_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION,
  type FrenchPilotBlindReauditView
} from "./frenchPilotBlindReaudit.js";
import {
  hashFrenchInternalJson,
  type FrenchInternalAuditCheck,
  type FrenchInternalAuditChecks,
  type FrenchInternalReviewRecord
} from "./frenchInternalReview.js";
import type { LexiconV3FrenchPacket } from "./frenchPackets.js";

export const FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION =
  "lexicon-v3-french-blind-reaudit-agent-response@1" as const;
export const FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION =
  "lexicon-v3-french-blind-reaudit-runtime-policy@2" as const;

export const FRENCH_BLIND_REAUDIT_CHECKS = [
  "identityExact",
  "semanticCoverage",
  "noSemanticAddition",
  "noSemanticOmission",
  "polarityModalityUncertaintyPreserved",
  "glossMorphologyConform",
  "properNamesAndTermsConform",
  "protectedContentPreserved",
  "htmlStructurePreserved",
  "naturalFrench",
  "siblingStepConsistency"
] as const satisfies readonly FrenchInternalAuditCheck[];

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export interface FrenchBlindReauditAgentDecision {
  entryKey: string;
  inputHash: string;
  verdict: "safe" | "hold" | "block";
  reasons: string[];
  confidence: number;
  checks: FrenchInternalAuditChecks;
}

export interface FrenchBlindReauditAgentResponse {
  schemaVersion: typeof FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION;
  decisions: FrenchBlindReauditAgentDecision[];
}

/**
 * Builds the only view a blind re-auditor may receive. In particular this
 * function has no parameter through which proposer, arbiter, auditor, legacy,
 * or resource evidence could accidentally enter the view.
 */
export function buildFrenchBlindReauditView(input: {
  packet: LexiconV3FrenchPacket;
  finalReview: FrenchInternalReviewRecord;
  siblingContext: FrenchPilotBlindReauditView["siblingContext"];
}): FrenchPilotBlindReauditView {
  const { packet, finalReview, siblingContext } = input;
  const proposal = finalReview.arbiter?.proposal;
  if (
    finalReview.entryKey !== packet.entryKey ||
    finalReview.packetHash !== packet.packetHash ||
    finalReview.englishHash !== packet.english.contentHash ||
    finalReview.status !== "auto_validated" ||
    !proposal ||
    proposal.entryKey !== packet.entryKey ||
    proposal.derivedFromEnglishHash !== packet.english.contentHash
  ) {
    throw new Error(
      `french-blind-reaudit-final-review-invalid:${packet.entryKey}`
    );
  }
  const content = {
    schemaVersion: FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION,
    policyVersion: FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
    role: "blindReauditor" as const,
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    finalReviewArtifactHash: finalReview.artifactHash,
    source: {
      identity: structuredClone(packet.identity) as Record<string, unknown>,
      english: structuredClone(packet.english) as Record<string, unknown>,
      protectedContent: structuredClone(
        packet.protectedContent
      ) as unknown as Record<string, unknown>
    },
    finalFrench: {
      glossFr: proposal.glossFr,
      meaningFr: proposal.meaningFr,
      meaningHtmlFr: proposal.meaningHtmlFr,
      notesFr: proposal.notesFr,
      carrierTermsFr: [...proposal.carrierTermsFr]
    },
    siblingContext: structuredClone(siblingContext),
    exposurePolicy: {
      proposerOutputsExposed: false as const,
      arbiterOutputExposed: false as const,
      auditorOutputExposed: false as const,
      priorReasonsExposed: false as const,
      priorVerdictsExposed: false as const,
      historicalFrenchExposed: false as const,
      resourceFrenchExposed: false as const
    }
  };
  return { ...content, viewHash: hashFrenchInternalJson(content) };
}

export function assertFrenchBlindReauditView(
  value: unknown
): asserts value is FrenchPilotBlindReauditView {
  assertObject(value, "french-blind-reaudit-view-invalid");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "policyVersion",
      "role",
      "entryKey",
      "packetHash",
      "englishHash",
      "finalReviewArtifactHash",
      "source",
      "finalFrench",
      "siblingContext",
      "exposurePolicy",
      "viewHash"
    ],
    "french-blind-reaudit-view-keys-invalid"
  );
  const view = value as unknown as FrenchPilotBlindReauditView;
  assertExactKeys(
    view.source,
    ["identity", "english", "protectedContent"],
    "french-blind-reaudit-view-source-keys-invalid"
  );
  assertExactKeys(
    view.finalFrench,
    ["glossFr", "meaningFr", "meaningHtmlFr", "notesFr", "carrierTermsFr"],
    "french-blind-reaudit-view-french-keys-invalid"
  );
  assertExactKeys(
    view.exposurePolicy,
    [
      "proposerOutputsExposed",
      "arbiterOutputExposed",
      "auditorOutputExposed",
      "priorReasonsExposed",
      "priorVerdictsExposed",
      "historicalFrenchExposed",
      "resourceFrenchExposed"
    ],
    "french-blind-reaudit-view-exposure-keys-invalid"
  );
  assertSiblingContext(view);
  const { viewHash, ...content } = view;
  if (
    view.schemaVersion !== FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION ||
    view.policyVersion !== FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION ||
    view.role !== "blindReauditor" ||
    !view.entryKey.trim() ||
    !SHA256_PATTERN.test(view.packetHash) ||
    !SHA256_PATTERN.test(view.englishHash) ||
    !SHA256_PATTERN.test(view.finalReviewArtifactHash) ||
    !isObject(view.source.identity) ||
    !isObject(view.source.english) ||
    !isObject(view.source.protectedContent) ||
    !nonEmptyString(view.finalFrench.glossFr) ||
    !nonEmptyString(view.finalFrench.meaningFr) ||
    !nonEmptyString(view.finalFrench.meaningHtmlFr) ||
    typeof view.finalFrench.notesFr !== "string" ||
    !Array.isArray(view.finalFrench.carrierTermsFr) ||
    view.finalFrench.carrierTermsFr.some((term) => !nonEmptyString(term)) ||
    Object.values(view.exposurePolicy).some((exposed) => exposed !== false) ||
    !SHA256_PATTERN.test(viewHash) ||
    hashFrenchInternalJson(content) !== viewHash
  ) {
    throw new Error("french-blind-reaudit-view-invalid");
  }
}

function assertSiblingContext(view: FrenchPilotBlindReauditView): void {
  const context = view.siblingContext;
  assertObject(context, "french-blind-reaudit-sibling-context-invalid");
  assertExactKeys(
    context,
    ["scope", "familyKey", "members"],
    "french-blind-reaudit-sibling-context-keys-invalid"
  );
  if (
    context.scope !== "selected-pilot-family-members" ||
    !nonEmptyString(context.familyKey) ||
    !Array.isArray(context.members) ||
    context.members.length < 1
  ) {
    throw new Error("french-blind-reaudit-sibling-context-invalid");
  }
  const keys: string[] = [];
  for (const member of context.members) {
    assertObject(member, "french-blind-reaudit-sibling-member-invalid");
    assertExactKeys(
      member,
      ["entryKey", "identity", "english", "finalFrench"],
      "french-blind-reaudit-sibling-member-keys-invalid"
    );
    assertObject(
      member.identity,
      "french-blind-reaudit-sibling-member-invalid"
    );
    assertObject(member.english, "french-blind-reaudit-sibling-member-invalid");
    assertObject(
      member.finalFrench,
      "french-blind-reaudit-sibling-member-invalid"
    );
    assertExactKeys(
      member.finalFrench,
      ["glossFr", "meaningFr", "meaningHtmlFr", "notesFr", "carrierTermsFr"],
      "french-blind-reaudit-sibling-french-keys-invalid"
    );
    if (
      !nonEmptyString(member.entryKey) ||
      !nonEmptyString(member.finalFrench.glossFr) ||
      !nonEmptyString(member.finalFrench.meaningFr) ||
      !nonEmptyString(member.finalFrench.meaningHtmlFr) ||
      typeof member.finalFrench.notesFr !== "string" ||
      !Array.isArray(member.finalFrench.carrierTermsFr) ||
      member.finalFrench.carrierTermsFr.some((term) => !nonEmptyString(term))
    ) {
      throw new Error("french-blind-reaudit-sibling-member-invalid");
    }
    keys.push(member.entryKey);
  }
  if (
    new Set(keys).size !== keys.length ||
    keys.some((key, index) => key !== [...keys].sort()[index])
  ) {
    throw new Error("french-blind-reaudit-sibling-order-invalid");
  }
  const self = context.members.find(
    (member) => member.entryKey === view.entryKey
  );
  if (
    !self ||
    hashFrenchInternalJson(self.identity) !==
      hashFrenchInternalJson(view.source.identity) ||
    hashFrenchInternalJson(self.english) !==
      hashFrenchInternalJson(view.source.english) ||
    hashFrenchInternalJson(self.finalFrench) !==
      hashFrenchInternalJson(view.finalFrench)
  ) {
    throw new Error("french-blind-reaudit-sibling-self-invalid");
  }
}

export function frenchBlindReauditOutputSchema(
  expectedItems: number
): Record<string, unknown> {
  if (!Number.isInteger(expectedItems) || expectedItems < 1) {
    throw new Error("french-blind-reaudit-schema-cardinality-invalid");
  }
  const checks = Object.fromEntries(
    FRENCH_BLIND_REAUDIT_CHECKS.map((check) => [
      check,
      { type: "string", enum: ["pass", "fail"] }
    ])
  );
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "decisions"],
    properties: {
      schemaVersion: {
        type: "string",
        enum: [FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION]
      },
      decisions: {
        type: "array",
        minItems: expectedItems,
        maxItems: expectedItems,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "entryKey",
            "inputHash",
            "verdict",
            "reasons",
            "confidence",
            "checks"
          ],
          properties: {
            entryKey: { type: "string", minLength: 1 },
            inputHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
            verdict: { type: "string", enum: ["safe", "hold", "block"] },
            reasons: {
              type: "array",
              minItems: 0,
              maxItems: 8,
              items: { type: "string", minLength: 1, maxLength: 400 }
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            checks: {
              type: "object",
              additionalProperties: false,
              required: [...FRENCH_BLIND_REAUDIT_CHECKS],
              properties: checks
            }
          }
        }
      }
    }
  };
}

export function buildFrenchBlindReauditPrompt(input: {
  namespace: string;
  batchId: string;
  views: readonly FrenchPilotBlindReauditView[];
}): string {
  if (
    !/^\/fr-internal\/[a-z0-9][a-z0-9./_-]*$/u.test(input.namespace) ||
    !/^[a-z0-9][a-z0-9._-]*$/u.test(input.batchId) ||
    input.views.length < 1
  ) {
    throw new Error("french-blind-reaudit-prompt-input-invalid");
  }
  for (const view of input.views) assertFrenchBlindReauditView(view);
  if (
    new Set(input.views.map((view) => view.entryKey)).size !==
    input.views.length
  ) {
    throw new Error("french-blind-reaudit-prompt-duplicate-entry");
  }
  return `Tu es le cinquième relecteur français indépendant d'un pilote de lexique biblique STEP/Strong.

CONTRAT AVEUGLE ET SCELLÉ :
- Utilise exclusivement les vues JSONL incluses ci-dessous. Aucun outil, shell, réseau, recherche, fichier ou autre source n'est autorisé.
- Tu ne vois volontairement ni traduction historique, ni ressource française, ni proposition A/B, ni arbitrage, ni audit précédent, ni raisonnement antérieur.
- Pour chaque entrée, compare seulement l'identité STEP/sous-STEP exacte, le contenu anglais exact, les littéraux/structures protégés et la traduction française finale.
- Utilise siblingContext pour contrôler la cohérence entre tous les membres disponibles de la même famille STEP; ce contexte ne contient lui aussi que l'identité, l'anglais et le français final.
- Ne réécris pas la traduction et ne propose aucune variante. Rends uniquement safe, hold ou block et les contrôles bornés.
- safe exige que les onze contrôles valent tous pass. Utilise hold pour un doute réel et block pour une erreur certaine ou une violation de contenu/identité.
- Pour safe, rends reasons=[] et confidence >= 0.90. Pour hold/block, donne au moins une raison précise et au moins un contrôle fail.
- Préserve l'ordre exact des entrées. entryKey et inputHash doivent être copiés à l'identique depuis la vue.
- Ta réponse finale est uniquement l'objet JSON conforme au schéma, sans Markdown ni commentaire.

NAMESPACE : ${input.namespace}
LOT : ${input.batchId}
CLÉS ATTENDUES :
${input.views.map((view) => view.entryKey).join("\n")}

<sealed_blind_views_jsonl>
${input.views.map((view) => JSON.stringify(view)).join("\n")}
</sealed_blind_views_jsonl>`;
}

export function parseFrenchBlindReauditAgentResponse(input: {
  responseText: string;
  views: readonly FrenchPilotBlindReauditView[];
}): FrenchBlindReauditAgentResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.responseText);
  } catch {
    throw new Error("french-blind-reaudit-response-invalid-json");
  }
  assertObject(parsed, "french-blind-reaudit-response-invalid");
  assertExactKeys(
    parsed,
    ["schemaVersion", "decisions"],
    "french-blind-reaudit-response-keys-invalid"
  );
  if (
    parsed.schemaVersion !==
      FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION ||
    !Array.isArray(parsed.decisions) ||
    parsed.decisions.length !== input.views.length
  ) {
    throw new Error("french-blind-reaudit-response-invalid");
  }
  const decisions = parsed.decisions.map((value, index) =>
    assertAgentDecision(value, input.views[index])
  );
  if (
    new Set(decisions.map((decision) => decision.entryKey)).size !==
    decisions.length
  ) {
    throw new Error("french-blind-reaudit-response-duplicate-entry");
  }
  return {
    schemaVersion: FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION,
    decisions
  };
}

function assertAgentDecision(
  value: unknown,
  view: FrenchPilotBlindReauditView | undefined
): FrenchBlindReauditAgentDecision {
  assertObject(value, "french-blind-reaudit-decision-invalid");
  assertExactKeys(
    value,
    ["entryKey", "inputHash", "verdict", "reasons", "confidence", "checks"],
    "french-blind-reaudit-decision-keys-invalid"
  );
  assertObject(value.checks, "french-blind-reaudit-checks-invalid");
  assertExactKeys(
    value.checks,
    [...FRENCH_BLIND_REAUDIT_CHECKS],
    "french-blind-reaudit-checks-keys-invalid"
  );
  const verdict = value.verdict;
  const reasons = value.reasons;
  const confidence = value.confidence;
  const checks = value.checks as FrenchInternalAuditChecks;
  const failedChecks = FRENCH_BLIND_REAUDIT_CHECKS.filter(
    (check) => checks[check] === "fail"
  );
  if (
    !view ||
    value.entryKey !== view.entryKey ||
    value.inputHash !== view.viewHash ||
    (verdict !== "safe" && verdict !== "hold" && verdict !== "block") ||
    !Array.isArray(reasons) ||
    reasons.length > 8 ||
    reasons.some(
      (reason) =>
        typeof reason !== "string" || !reason.trim() || reason.length > 400
    ) ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    FRENCH_BLIND_REAUDIT_CHECKS.some(
      (check) => checks[check] !== "pass" && checks[check] !== "fail"
    ) ||
    (verdict === "safe" && failedChecks.length > 0) ||
    (verdict === "safe" && reasons.length !== 0) ||
    (verdict === "safe" && confidence < 0.9) ||
    (verdict !== "safe" && reasons.length === 0) ||
    (verdict !== "safe" && failedChecks.length === 0)
  ) {
    throw new Error(
      `french-blind-reaudit-decision-invalid:${String(value.entryKey)}`
    );
  }
  return {
    entryKey: view.entryKey,
    inputHash: view.viewHash,
    verdict,
    reasons: [...reasons],
    confidence,
    checks: { ...checks }
  };
}

export function frenchBlindReauditDecisionEnvelope(input: {
  decision: FrenchBlindReauditAgentDecision;
  agentId: string;
  taskName: string;
  threadId: string;
  completedAt: string;
  receiptHash: string;
}): Omit<
  import("./frenchPilotBlindReaudit.js").FrenchPilotBlindReauditDecision,
  "artifactHash"
> {
  return {
    schemaVersion: FRENCH_PILOT_BLIND_REAUDIT_DECISION_SCHEMA_VERSION,
    policyVersion: FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
    role: "blindReauditor",
    ...input.decision,
    agentId: input.agentId,
    taskName: input.taskName,
    threadId: input.threadId,
    completedAt: input.completedAt,
    receiptHash: input.receiptHash
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(
  value: unknown,
  error: string
): asserts value is Record<string, unknown> {
  if (!isObject(value)) throw new Error(error);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  error: string
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(error);
}
