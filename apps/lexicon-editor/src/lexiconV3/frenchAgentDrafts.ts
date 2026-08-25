import {
  buildFrenchHtmlTemplate,
  renderFrenchHtmlTemplate,
  type FrenchHtmlSegmentTranslation
} from "./frenchHtmlRenderer.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchEntityMentionTranslation,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  type FrenchValidationResult,
  validateFrenchEntityMentions,
  validateFrenchProposal
} from "./frenchValidation.js";
import type {
  FrenchInternalAuditChecks,
  FrenchInternalRole
} from "./frenchInternalReview.js";
import type { LexiconV3FrenchPacket } from "./frenchPackets.js";
import type { RequiredFrenchEntityMention } from "./frenchEntityMentions.js";

export const FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION =
  "lexicon-v3-french-internal-proposer-draft@3" as const;
export const FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION =
  "lexicon-v3-french-internal-arbiter-draft@1" as const;
export const FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION =
  "lexicon-v3-french-internal-auditor-draft@1" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export interface FrenchInternalProposerDraft {
  schemaVersion: typeof FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION;
  role: "proposerA" | "proposerB";
  entryKey: string;
  inputHash: string;
  glossFr: string;
  meaningSegmentsFr: FrenchHtmlSegmentTranslation[];
  entityMentionsFr: FrenchEntityMentionTranslation[];
  notesFr: string;
  carrierTermsFr: string[];
  confidence: number;
}

export interface FrenchInternalArbiterDraft {
  schemaVersion: typeof FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION;
  role: "arbiter";
  entryKey: string;
  inputHash: string;
  verdict: "accept" | "review_needed";
  selectedProposal: "proposalA" | "proposalB";
  reasons: string[];
}

export interface FrenchInternalAuditorDraft {
  schemaVersion: typeof FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION;
  role: "auditor";
  entryKey: string;
  inputHash: string;
  verdict: "safe" | "hold" | "block";
  reasons: string[];
  confidence: number;
  checks: FrenchInternalAuditChecks;
}

export interface FrenchInternalRenderedDraft {
  proposal: FrenchLexiconProposal;
  validation: FrenchValidationResult;
}

export function assertFrenchInternalProposerDraft(
  value: unknown,
  expectedRole: "proposerA" | "proposerB",
  packet: LexiconV3FrenchPacket,
  expectedInputHash: string,
  requiredEntityMentions: readonly RequiredFrenchEntityMention[] = []
): FrenchInternalProposerDraft {
  assertPlainObject(value, "invalid-french-proposer-draft");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "role",
      "entryKey",
      "inputHash",
      "glossFr",
      "meaningSegmentsFr",
      "entityMentionsFr",
      "notesFr",
      "carrierTermsFr",
      "confidence"
    ],
    "invalid-french-proposer-draft-keys"
  );
  const draft = value as unknown as FrenchInternalProposerDraft;
  if (draft.schemaVersion !== FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION) {
    throw new Error("invalid-french-proposer-draft-schema");
  }
  if (draft.role !== expectedRole) {
    throw new Error("french-proposer-draft-role-mismatch");
  }
  assertDraftLineage(draft, packet.entryKey, expectedInputHash);
  if (typeof draft.glossFr !== "string" || !draft.glossFr.trim()) {
    throw new Error("empty-french-proposer-draft-gloss");
  }
  if (typeof draft.notesFr !== "string") {
    throw new Error("invalid-french-proposer-draft-notes");
  }
  if (
    !Array.isArray(draft.carrierTermsFr) ||
    draft.carrierTermsFr.some(
      (term) => typeof term !== "string" || !term.trim()
    )
  ) {
    throw new Error("invalid-french-proposer-draft-carriers");
  }
  if (
    !Number.isFinite(draft.confidence) ||
    draft.confidence < 0 ||
    draft.confidence > 1
  ) {
    throw new Error("invalid-french-proposer-draft-confidence");
  }
  assertDraftSegments(draft.meaningSegmentsFr, packet);
  const entityIssues = validateFrenchEntityMentions(
    {
      meaningSegmentsFr: draft.meaningSegmentsFr,
      entityMentionsFr: draft.entityMentionsFr
    },
    requiredEntityMentions
  );
  if (entityIssues.length > 0) {
    throw new Error(
      `invalid-french-proposer-draft-entity-mentions:${entityIssues
        .map((issue) => issue.code)
        .join(",")}`
    );
  }
  return draft;
}

export function renderFrenchInternalProposerDraft(
  draft: FrenchInternalProposerDraft,
  packet: LexiconV3FrenchPacket,
  agentId: string,
  requiredEntityMentions: readonly RequiredFrenchEntityMention[] = []
): FrenchInternalRenderedDraft {
  const rendered = renderFrenchHtmlTemplate(
    buildFrenchHtmlTemplate(packet.english.meaningHtml),
    draft.meaningSegmentsFr
  );
  const proposal: FrenchLexiconProposal = {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    derivedFromEnglishHash: packet.english.contentHash,
    model: `internal-agent/${agentId}`,
    glossFr: draft.glossFr.trim(),
    meaningSegmentsFr: draft.meaningSegmentsFr.map((segment) => ({
      id: segment.id,
      text: segment.text
    })),
    entityMentionsFr: draft.entityMentionsFr.map((mention) => ({
      mentionId: mention.mentionId,
      segmentId: mention.segmentId,
      chosenFrenchForm: mention.chosenFrenchForm.trim()
    })),
    meaningFr: rendered.meaningFr,
    meaningHtmlFr: rendered.meaningHtmlFr,
    notesFr: draft.notesFr.trim(),
    carrierTermsFr: draft.carrierTermsFr.map((term) => term.trim()),
    confidence: draft.confidence
  };
  return {
    proposal,
    validation: validateFrenchProposal(
      proposal,
      frenchValidationContext(packet, requiredEntityMentions)
    )
  };
}

export function assertFrenchInternalArbiterDraft(
  value: unknown,
  entryKey: string,
  inputHash: string
): FrenchInternalArbiterDraft {
  assertPlainObject(value, "invalid-french-arbiter-draft");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "role",
      "entryKey",
      "inputHash",
      "verdict",
      "selectedProposal",
      "reasons"
    ],
    "invalid-french-arbiter-draft-keys"
  );
  const draft = value as unknown as FrenchInternalArbiterDraft;
  if (draft.schemaVersion !== FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION) {
    throw new Error("invalid-french-arbiter-draft-schema");
  }
  if (draft.role !== "arbiter") throw new Error("invalid-french-arbiter-role");
  assertDraftLineage(draft, entryKey, inputHash);
  if (!(["accept", "review_needed"] as const).includes(draft.verdict)) {
    throw new Error("invalid-french-arbiter-verdict");
  }
  if (!(["proposalA", "proposalB"] as const).includes(draft.selectedProposal)) {
    throw new Error("invalid-french-arbiter-selection");
  }
  assertReasons(draft.reasons, "invalid-french-arbiter-reasons");
  if (draft.verdict === "accept" && draft.reasons.length > 0) {
    throw new Error("accepted-french-arbiter-draft-has-reasons");
  }
  return draft;
}

export function assertFrenchInternalAuditorDraft(
  value: unknown,
  entryKey: string,
  inputHash: string
): FrenchInternalAuditorDraft {
  assertPlainObject(value, "invalid-french-auditor-draft");
  assertExactKeys(
    value,
    [
      "schemaVersion",
      "role",
      "entryKey",
      "inputHash",
      "verdict",
      "reasons",
      "confidence",
      "checks"
    ],
    "invalid-french-auditor-draft-keys"
  );
  const draft = value as unknown as FrenchInternalAuditorDraft;
  if (draft.schemaVersion !== FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION) {
    throw new Error("invalid-french-auditor-draft-schema");
  }
  if (draft.role !== "auditor") throw new Error("invalid-french-auditor-role");
  assertDraftLineage(draft, entryKey, inputHash);
  if (!(["safe", "hold", "block"] as const).includes(draft.verdict)) {
    throw new Error("invalid-french-auditor-verdict");
  }
  assertReasons(draft.reasons, "invalid-french-auditor-reasons");
  if (
    !Number.isFinite(draft.confidence) ||
    draft.confidence < 0 ||
    draft.confidence > 1
  ) {
    throw new Error("invalid-french-auditor-confidence");
  }
  assertPlainObject(draft.checks, "invalid-french-auditor-checks");
  const expectedChecks = [
    "identityExact",
    "semanticCoverage",
    "noSemanticAddition",
    "noSemanticOmission",
    "polarityModalityUncertaintyPreserved",
    "glossMorphologyConform",
    "properNamesAndTermsConform",
    "entityMentionsConform",
    "protectedContentPreserved",
    "htmlStructurePreserved",
    "naturalFrench",
    "siblingStepConsistency"
  ];
  assertExactKeys(
    draft.checks,
    expectedChecks,
    "invalid-french-auditor-check-keys"
  );
  if (
    Object.values(draft.checks).some(
      (check) => !["pass", "fail"].includes(check)
    )
  ) {
    throw new Error("invalid-french-auditor-check");
  }
  const allPass = Object.values(draft.checks).every(
    (check) => check === "pass"
  );
  if (
    draft.verdict === "safe" &&
    (!allPass || draft.reasons.length > 0 || draft.confidence < 0.9)
  ) {
    throw new Error("unsafe-french-auditor-safe-verdict");
  }
  return draft;
}

function assertDraftSegments(
  value: unknown,
  packet: LexiconV3FrenchPacket
): asserts value is FrenchHtmlSegmentTranslation[] {
  if (!Array.isArray(value)) throw new Error("invalid-french-draft-segments");
  const expectedIds = buildFrenchHtmlTemplate(
    packet.english.meaningHtml
  ).tokens.flatMap((token) =>
    token.kind === "text" && token.translatable ? [token.id] : []
  );
  const actualIds: string[] = [];
  for (const segment of value) {
    assertPlainObject(segment, "invalid-french-draft-segment");
    assertExactKeys(
      segment,
      ["id", "text"],
      "invalid-french-draft-segment-keys"
    );
    if (
      typeof segment.id !== "string" ||
      typeof segment.text !== "string" ||
      !segment.text.trim()
    ) {
      throw new Error("invalid-french-draft-segment");
    }
    actualIds.push(segment.id);
  }
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error("french-draft-segment-coverage-mismatch");
  }
}

function assertDraftLineage(
  draft: { entryKey: unknown; inputHash: unknown },
  entryKey: string,
  inputHash: string
): void {
  if (draft.entryKey !== entryKey)
    throw new Error("french-draft-entry-mismatch");
  if (
    typeof draft.inputHash !== "string" ||
    !SHA256_PATTERN.test(draft.inputHash) ||
    draft.inputHash !== inputHash
  ) {
    throw new Error("french-draft-input-hash-mismatch");
  }
}

function assertReasons(
  value: unknown,
  code: string
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((reason) => typeof reason !== "string" || !reason.trim())
  ) {
    throw new Error(code);
  }
}

function assertPlainObject(
  value: unknown,
  code: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  code: string
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    throw new Error(code);
  }
}

function frenchValidationContext(
  packet: LexiconV3FrenchPacket,
  requiredEntityMentions: readonly RequiredFrenchEntityMention[]
): FrenchValidationContext {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    morph: packet.identity.morph,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    legacyGloss: packet.evidence.legacy?.gloss,
    legacyMeaning: packet.evidence.legacy?.meaning,
    concordanceForms: packet.evidence.concordanceForms,
    requiredEntityMentions: [...requiredEntityMentions]
  };
}

export function frenchInternalDraftRole(
  value: unknown
): FrenchInternalRole | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const role = (value as Record<string, unknown>).role;
  return ["proposerA", "proposerB", "arbiter", "auditor"].includes(String(role))
    ? (role as FrenchInternalRole)
    : null;
}
