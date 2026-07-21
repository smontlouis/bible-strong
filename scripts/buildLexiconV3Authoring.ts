import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  createReadStream,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import {
  englishEvidenceRecordDigest,
  normalizeTbeshMeaningHtml,
  selectCanonicalEnglish,
  type FrenchPacketBuildSummary
} from "./buildLexiconV3FrenchPackets.js";
import {
  readFrenchInternalAssemblyConfiguration,
  type FrenchInternalAssemblyConfigurationFile
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  applyLexiconV3ReviewDecisions,
  readLexiconV3ReviewDecisions
} from "./reviewLexiconV3.js";
import {
  readLexiconV3AuthoringEnglishSnapshot,
  type LexiconV3AuthoringEnglishBundle,
  type LexiconV3AuthoringEnglishSnapshot
} from "../src/lexiconV3/authoringEnglish.js";
import { lexiconV3CodeFingerprint } from "../src/lexiconV3/codeFingerprint.js";
import {
  LEXICON_V3_CORE_EN_RELEASE_POLICY_VERSION,
  planLexiconV3Release,
  type LexiconV3ReleasePlan
} from "../src/lexiconV3/release.js";
import {
  assertHebrewEnglishArtifactMatchesSources,
  assertPinnedHebrewEnglishArtifactSummary,
  OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
  readHebrewEnglishArtifact,
  type HebrewEnglishArtifactSummary,
  type HebrewEnglishCandidate
} from "../src/lexiconV3/hebrewEnglish.js";
import {
  proveHebrewEnglishGlossCandidate,
  proveHebrewEnglishPublicationCandidate,
  proveStepTechnicalMarker,
  type HebrewEnglishGlossPublicationProof,
  type HebrewEnglishPublicationProof,
  type StepTechnicalMarkerProof
} from "../src/lexiconV3/hebrewPublicationProof.js";
import {
  CURATED_GREEK_ENGLISH_REPAIR_RULES,
  ENGLISH_EVIDENCE_SCHEMA_VERSION,
  extractSourceReferences,
  isCuratedAutoValidatedEnglishEvidence,
  validateEnglishAlternateStrongAliasEvidence,
  validateEnglishExactOccurrenceEvidence,
  validateEnglishGreekReconstructionEvidence,
  validateEnglishSemanticGlossEvidence,
  type EnglishEvidenceAuditRecord,
  type EnglishFieldRepairEvidence,
  type EnglishEvidenceSourceDigests
} from "../src/lexiconV3/evidence.js";
import {
  applyEnglishExactRepairs,
  validateEnglishExactFieldRepairEvidence,
  type EnglishExactFieldRepairEvidence,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import { GREEK_RECONSTRUCTION_REGISTRY_DIGEST } from "../src/lexiconV3/greekReconstruction.js";
import {
  buildHebrewExactMeaningRepairProjection,
  HEBREW_EXACT_MEANING_REPAIR_PROJECTION_SCHEMA
} from "../src/lexiconV3/hebrewExactMeaningRepair.js";
import {
  PINNED_G20354_PERSEUS_ACCESSED_AT,
  PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_PATH,
  PINNED_G20354_PERSEUS_ATTRIBUTION,
  PINNED_G20354_PERSEUS_LICENSE_URL,
  PINNED_G20354_PERSEUS_MODIFICATIONS,
  PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
  PINNED_G20354_PERSEUS_PROVENANCE_URL,
  PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
  PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST
} from "../src/lexiconV3/perseusLsjG20354.js";
import {
  buildConsensusCarrierTerms,
  composeFrenchModelIdentity,
  evaluateFrenchAutoEligibility,
  type FrenchCarrierDecision,
  type FrenchLexiconProposal,
  type FrenchValidationResult,
  validateFrenchProposal,
  validateLexiconHtmlPair,
  stripLexiconHtml
} from "../src/lexiconV3/frenchValidation.js";
import {
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  assertFrenchInternalReviewRecord,
  FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
  type FrenchInternalReviewRecord
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchEntityCanonicalizationGateResult
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import { type FrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";
import type { FrenchEntityMentionResolutionAttestation } from "../src/lexiconV3/frenchEntityMentionResolution.js";
import {
  assertFrenchEntityPipelineArtifacts,
  frenchEntityQuarantinedEntryKeysFromMerge
} from "../src/lexiconV3/frenchEntityPipeline.js";
import { assertFrenchEntityMergeAttestationAtPath } from "../src/lexiconV3/frenchEntityMergeAttestation.js";
import { assertFrenchInternalPublicationContract } from "../src/lexiconV3/frenchPublicationContract.js";
import {
  buildLexiconEntryIdentity,
  normalizeLexiconLanguage
} from "../src/lexiconV3/identity.js";
import {
  createLexiconV3Schema,
  type LexiconV3SchemaVerification,
  verifyLexiconV3Schema
} from "../src/lexiconV3/schema.js";
import {
  lexiconV3FieldContentHash,
  lexiconV3ReviewDecisionSetFingerprint
} from "../src/lexiconV3/review.js";
import { lexiconV3SourceLogicalFingerprint } from "../src/lexiconV3/sourceFingerprint.js";
import {
  hasMeaningfulTbeshHtml,
  parseTbeshMeaning,
  type TbeshMeaningClassification,
  type TbeshMeaningSections
} from "../src/lexiconV3/tbeshMeaning.js";
import {
  resolveTbeshSectionLedger,
  tbeshSectionLedgerProvesSpecificScope,
  type TbeshSectionLedgerResolution
} from "../src/lexiconV3/tbeshSectionLedger.js";
import {
  proveStrictTbeshTipnrScope,
  type TbeshTipnrScopeProof
} from "../src/lexiconV3/tbeshScopeProof.js";
import {
  decideTbeshPublication,
  type TbeshPublicationDecision
} from "../src/lexiconV3/tbeshPublication.js";
import {
  proveTahotOccurrenceGlossSupport,
  type TahotGlossProof
} from "../src/lexiconV3/tahotGlossProof.js";
import {
  proveStepDirectGloss,
  proveStepDirectMeaning,
  STEP_DIRECT_GLOSS_POLICY_ID,
  STEP_DIRECT_MEANING_POLICY_ID,
  type StepDirectAuditIdentityInput,
  type StepDirectGlossProof,
  type StepDirectMeaningProof
} from "../src/lexiconV3/stepDirectProof.js";
import {
  HEBREW_CANONICAL_GLOSS_POLICY_ID,
  HEBREW_CANONICAL_MEANING_POLICY_ID,
  HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST,
  isHebrewGlossResidualAuditKey,
  proveHebrewCanonicalGloss,
  proveHebrewCanonicalMeaning,
  type HebrewCanonicalGlossProof,
  type HebrewCanonicalMeaningProof
} from "../src/lexiconV3/hebrewCanonicalPolicy.js";
import {
  HEBREW_IDENTITY_CORRECTION_POLICY_ID,
  HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT,
  HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST,
  proveHebrewIdentityCorrection,
  type HebrewIdentityCorrectionProof
} from "../src/lexiconV3/hebrewIdentityCorrections.js";

const DEFAULT_DATABASE =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_ENTITIES_DATABASE =
  "data/entities/bible_entities.production.sqlite";
const DEFAULT_HEBREW_SOURCES = "data/external/openscriptures-hebrew-lexicon";
const DEFAULT_ENGLISH_AUDIT = "outputs/lexicon-v3/english-audit.jsonl";
const DEFAULT_FRENCH_PACKETS = "outputs/lexicon-v3/french-packets.jsonl";
const DEFAULT_FRENCH_PACKET_SUMMARY =
  "outputs/lexicon-v3/french-packets.summary.json";
const DEFAULT_FRENCH_INTERNAL_CONFIGURATION =
  "outputs/lexicon-v3/fr-internal/configuration.json";
const DEFAULT_FRENCH_ENTITY_ROOT = "outputs/lexicon-v3/french-entities";
const DEFAULT_FRENCH_ENTITY_RESOLVED = `${DEFAULT_FRENCH_ENTITY_ROOT}/resolved`;
const DEFAULT_FRENCH_CANONICAL_ENTITIES = `${DEFAULT_FRENCH_ENTITY_RESOLVED}/canonical-entities.jsonl`;
const DEFAULT_FRENCH_CANONICAL_ENTRY_POLICIES = `${DEFAULT_FRENCH_ENTITY_RESOLVED}/canonical-entry-name-policies.jsonl`;
const DEFAULT_FRENCH_ENTITY_MERGE_ATTESTATION = `${DEFAULT_FRENCH_ENTITY_RESOLVED}/entity-merge-attestation.json`;
const DEFAULT_FRENCH_ENTITY_GATE = `${DEFAULT_FRENCH_ENTITY_RESOLVED}/entity-gate.json`;
const DEFAULT_FRENCH_ENTITY_MENTIONS = `${DEFAULT_FRENCH_ENTITY_RESOLVED}/required-entity-mentions.json`;
const DEFAULT_FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION = `${DEFAULT_FRENCH_ENTITY_RESOLVED}/entity-mention-resolution-attestation.json`;
const DEFAULT_FRENCH_ENTITY_PACKETS =
  "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_HEBREW_ENGLISH =
  "outputs/lexicon-v3/hebrew-english.candidates.jsonl";
const DEFAULT_HEBREW_ENGLISH_SUMMARY =
  "outputs/lexicon-v3/hebrew-english.candidates.summary.json";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/authoring.sqlite";
const DEFAULT_SUMMARY = "outputs/lexicon-v3/authoring.summary.json";
const AUTHORING_SUMMARY_SCHEMA = "lexicon-v3-authoring-summary@1" as const;
const BUILDER_GENERATOR = "buildLexiconV3Authoring@1";
const TBESH_PUBLICATION_GENERATOR = "tbesh-publication-selector@1";
const HEBREW_GLOSS_PROOF_GENERATOR = "hebrew-exact-gloss-proof@1";
const TAHOT_GLOSS_PROOF_GENERATOR = "tahot-exact-occurrence-gloss-proof@1";
const STEP_DIRECT_GLOSS_GENERATOR = STEP_DIRECT_GLOSS_POLICY_ID;
const STEP_DIRECT_MEANING_GENERATOR = STEP_DIRECT_MEANING_POLICY_ID;
const HEBREW_CANONICAL_GLOSS_GENERATOR = HEBREW_CANONICAL_GLOSS_POLICY_ID;
const HEBREW_CANONICAL_MEANING_GENERATOR = HEBREW_CANONICAL_MEANING_POLICY_ID;
const STEP_TECHNICAL_MARKER_GENERATOR = "step-technical-marker@1";
const ENGLISH_AUDIT_FIELD_REPAIR_GENERATOR = "english-audit-field-repair@1";
const GREEK_RECONSTRUCTION_GENERATOR = "greek-reconstruction@1";

export interface BuildLexiconV3AuthoringOptions {
  database: string;
  entitiesDatabase: string;
  hebrewSourcesDirectory?: string;
  englishAudit: string;
  frenchReview?: string;
  frenchPackets?: string;
  frenchPacketSummary?: string;
  frenchRemediationSummary?: string;
  frenchConfiguration?: string;
  frenchCanonicalEntities?: string;
  frenchCanonicalEntryPolicies?: string;
  frenchEntityMergeAttestation?: string;
  frenchEntityGate?: string;
  frenchEntityMentions?: string;
  frenchEntityMentionResolutionAttestation?: string;
  frenchEntityPackets?: string;
  hebrewEnglish?: string;
  hebrewEnglishSummary?: string;
  reviewDecisions?: string;
  output: string;
  summaryJson: string;
  generatedAt?: string;
  /** Unit-test-only escape hatch. Deliberately absent from the CLI parser. */
  testOnlySkipHebrewSourceRebuild?: boolean;
  /** Unit-test-only escape hatch. Deliberately absent from the CLI parser. */
  testOnlySkipFrenchEntityArtifactReplay?: boolean;
  /** Unit-test-only escape hatch. Deliberately absent from the CLI parser. */
  testOnlySkipFrozenCoreEnglishReleaseContinuity?: boolean;
  /** Unit-test-only fault injection. Deliberately absent from the CLI parser. */
  testOnlyHooks?: BuildLexiconV3AuthoringTestHooks;
}

export interface BuildLexiconV3AuthoringTestHooks {
  beforeStagingDatabaseOpen?: (paths: {
    transactionDirectory: string;
    stagingDatabase: string;
    stagingSummary: string;
  }) => void;
  afterFirstPairInstall?: (paths: {
    output: string;
    summaryJson: string;
    transactionDirectory: string;
  }) => void;
}

export interface BuildLexiconV3AuthoringSummary {
  schemaVersion: typeof AUTHORING_SUMMARY_SCHEMA;
  generatedAt: string;
  output: string;
  inputs: {
    database: string;
    entitiesDatabase: string;
    hebrewSourcesDirectory: string | null;
    englishAudit: string;
    frenchReview: string | null;
    frenchPackets: string | null;
    frenchPacketSummary: string | null;
    frenchRemediationSummary: string | null;
    hebrewEnglish: string | null;
    hebrewEnglishSummary: string | null;
    reviewDecisions: string | null;
  };
  digests: {
    database: string;
    entitiesDatabase: string;
    englishAudit: string;
    frenchReview: string | null;
    frenchPackets: string | null;
    frenchPacketSummary: string | null;
    frenchRemediationSummary: string | null;
    hebrewEnglish: string | null;
    hebrewEnglishSummary: string | null;
    reviewDecisions: string | null;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    codeFingerprint: string;
    englishReviewDecisionsFingerprint: string;
    englishLineageFingerprint: string;
    englishSnapshotFingerprint: string;
  };
  counts: {
    entries: number;
    entryIds: number;
    sources: number;
    assertions: number;
    englishFields: number;
    frenchFields: number;
    englishCandidateFields: number;
    englishBlockedSourceFields: number;
    frenchCandidateFields: number;
    frenchBlockedSourceFields: number;
    issues: number;
    blockers: number;
    carriers: number;
    carrierEvidence: number;
    hebrewCanonicalRawRestored: number;
    hebrewExactCompanionConservative: number;
    hebrewPositiveConflictRepairs: number;
    hebrewCanonicalGlossReplacements: number;
    hebrewIdentityCorrections: number;
  };
  schema: LexiconV3SchemaVerification;
}

interface FullEntryRow {
  id: number;
  language: string;
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
  classicTransliteration: string;
  pronunciation: string;
}

interface FullResourceRow {
  id: number;
  stepEntryId: number;
  source: string;
  kind: string;
  contentHtml: string;
}

type FrenchReviewStatus =
  | "auto_validated"
  | "human_validated"
  | "review_needed"
  | "blocked_source_issue"
  | "failed";

interface FrenchGatewayReviewRecord {
  schemaVersion: "lexicon-v3-french-review@2";
  entryKey: string;
  packetHash: string;
  englishHash: string;
  generationConfigHash: string;
  status: FrenchReviewStatus;
  models: { proposerA: string; proposerB: string; arbiter: string };
  modelProofs?: Record<
    "proposerA" | "proposerB" | "arbiter",
    {
      requestedModel: string;
      actualModel: string | null;
      provider: string | null;
      identity: string | null;
      verified: boolean;
    }
  >;
  proposalA?: FrenchLexiconProposal;
  proposalB?: FrenchLexiconProposal;
  validationA?: FrenchValidationResult;
  validationB?: FrenchValidationResult;
  arbiter?: {
    verdict: "accept" | "review_needed";
    reasons: string[];
    proposal: FrenchLexiconProposal;
    validation: FrenchValidationResult;
  };
  carrierTerms: FrenchCarrierDecision[];
  issues: string[];
  artifactHash: string;
  generatedAt: string;
  [key: string]: unknown;
}

type FrenchReviewRecord =
  | FrenchGatewayReviewRecord
  | FrenchInternalReviewRecord;

interface SourceIds {
  TBESG: number;
  TBESH_GLOSS: number;
  TBESH_MEANING: number;
  TFLSJ: number;
  TAGNT: number;
  TAHOT: number;
  ENGLISH_AUDIT: number;
  PERSEUS_G20354: number;
  GREEK_RECONSTRUCTION?: number;
  HEBREW_ENGLISH?: number;
  HEBREW_ADJUDICATION: number;
  HEBREW_IDENTITY_ADJUDICATION: number;
  FRENCH_REVIEW?: number;
  resources: Map<string, number>;
}

interface EntryBuildState {
  audit: EnglishEvidenceAuditRecord;
  englishBundleHash: string;
  englishStatus:
    | "validated"
    | "human_validated"
    | "review_needed"
    | "source_issue";
  glossFieldId?: number;
  meaningFieldId?: number;
  glossState?: string;
  meaningState?: string;
}

interface BuildContext {
  target: DatabaseSync;
  entries: FullEntryRow[];
  resourcesByEntry: Map<number, FullResourceRow[]>;
  audits: Map<string, EnglishEvidenceAuditRecord>;
  reviews: Map<string, FrenchReviewRecord>;
  hebrewEnglish: Map<string, HebrewEnglishCandidate>;
  sourceIds: SourceIds;
  hebrewEnglishDigest: string | null;
  hebrewEnglishSummary: HebrewEnglishArtifactSummary | null;
  generatedAt: string;
}

interface CanonicalHebrewMeaningAssessment {
  status: "validated" | "review_needed" | "source_issue";
  confidence: number;
  issueCodes: string[];
  advisoryCodes: string[];
  sectioning: {
    hasSectionSeparator: boolean;
    sectionSeparatorCount: number;
    classification: TbeshMeaningClassification;
    properName: boolean;
    exactTipnrIdentity: boolean;
    lexicalSectionPolicy:
      | "unreviewed"
      | "verified_context"
      | "foreign_sibling"
      | "source_conflict"
      | "empty_tail";
    legacyGeneralSharedAcrossSiblings: boolean;
    stepSpecificScope:
      | "unsectioned"
      | "exact_dstrong"
      | "candidate_dstrong"
      | "absent";
    legacyGeneralScope:
      | "base_strong_context"
      | "exact_or_component_context"
      | "foreign_sibling"
      | "source_conflict"
      | "absent";
    stepSpecificDigest: string | null;
    legacyGeneralDigest: string | null;
    tipnrScopeProof: TbeshTipnrScopeProof | null;
  };
}

interface CanonicalHebrewMeaningPublication {
  decision: TbeshPublicationDecision;
  counterfactualDecision: TbeshPublicationDecision;
  proof: HebrewEnglishPublicationProof | null;
  canonicalPolicyProof: HebrewCanonicalMeaningProof;
  selectionDigest: string;
}

function planCanonicalHebrewMeaningPublication(input: {
  audit: EnglishEvidenceAuditRecord;
  candidate: HebrewEnglishCandidate | undefined;
  assessment: CanonicalHebrewMeaningAssessment;
  sections: TbeshMeaningSections;
  primaryDStrong: string;
  auditIdentity: StepDirectAuditIdentityInput;
  candidateCorpusDigest: string;
}): CanonicalHebrewMeaningPublication {
  const tahotOccurrences =
    input.audit.evidence.exactOccurrence.count > 0
      ? [
          {
            dStrong: input.audit.evidence.exactOccurrence.stepStrong,
            count: input.audit.evidence.exactOccurrence.count,
            references: input.audit.evidence.exactOccurrence.references ?? []
          }
        ]
      : [];
  const proof = input.candidate
    ? proveHebrewEnglishPublicationCandidate({
        candidate: input.candidate,
        primaryDStrong: input.primaryDStrong,
        tahotOccurrences
      })
    : null;
  const publicationInput = {
    sections: input.sections,
    properName: input.assessment.sectioning.properName,
    ledgerCategory: input.assessment.sectioning.lexicalSectionPolicy,
    rawAssessmentStatus: input.assessment.status,
    stepSpecificScopeProven:
      input.assessment.sectioning.stepSpecificScope === "exact_dstrong",
    companion: input.candidate
      ? {
          status: input.candidate.status,
          method: input.candidate.method,
          meaningHtml: input.candidate.english.meaningHtml,
          exactCompanionProven: proof?.proven === true,
          exactTipnrTahotReferenceIntersection:
            proof?.facts.exactOccurrenceIntersectsTipnr === true
        }
      : null
  } as const;
  const counterfactualDecision = decideTbeshPublication(publicationInput);
  const canonicalPolicyProof = proveHebrewCanonicalMeaning({
    ...input.auditIdentity,
    rawHtml: input.sections.rawHtml,
    tbeshSourceDigest: input.audit.sourceDigests.TBESH,
    auditMeaningHtml: input.audit.meaning,
    selectedMeaningHtml: input.audit.meaning,
    meaningSupportsGloss:
      input.audit.evidence.sourceAudit.glossSupport.meaningSupportsGloss,
    sections: input.sections,
    properName: input.assessment.sectioning.properName,
    entityScopeProven:
      input.assessment.sectioning.tipnrScopeProof?.proven === true,
    ledgerCategory: input.assessment.sectioning.lexicalSectionPolicy,
    companionProven: proof?.proven === true,
    rawAssessmentStatus: input.assessment.status,
    stepSpecificScopeProven:
      input.assessment.sectioning.stepSpecificScope === "exact_dstrong",
    fallbackPublicationAction: counterfactualDecision.action,
    fallbackPublicationReasonCodes: counterfactualDecision.reasonCodes,
    candidate: input.candidate,
    candidateCorpusDigest: input.candidateCorpusDigest,
    tahotSourceDigests: input.audit.sourceDigests.TAHOT,
    exactOccurrenceCount: input.audit.evidence.exactOccurrence.count,
    exactOccurrenceCorpusDigest:
      input.audit.evidence.exactOccurrence.occurrenceCorpusDigest
  });
  const canonicalSelection =
    canonicalPolicyProof.proven &&
    canonicalPolicyProof.selection &&
    !["publish_raw", "block_publication"].includes(
      canonicalPolicyProof.disposition
    )
      ? {
          action:
            canonicalPolicyProof.disposition === "publish_step_specific"
              ? ("step_specific_only" as const)
              : canonicalPolicyProof.disposition === "publish_legacy_general"
                ? ("legacy_general_only" as const)
                : canonicalPolicyProof.disposition === "publish_exact_companion"
                  ? ("exact_companion" as const)
                  : ("editorial_reconstruction" as const),
          html: canonicalPolicyProof.selection.html,
          proof: "sealed_semantic_adjudication" as const
        }
      : undefined;
  const decision = decideTbeshPublication({
    ...publicationInput,
    canonicalSelection,
    canonicalRawProof:
      canonicalPolicyProof.proven &&
      canonicalPolicyProof.disposition === "publish_raw"
        ? (canonicalPolicyProof.canonicalRawProof ?? undefined)
        : undefined,
    canonicalBlockProof:
      canonicalPolicyProof.proven &&
      canonicalPolicyProof.disposition === "block_publication"
        ? "fail_closed"
        : undefined
  });
  const selectionDigest = sha256(
    stableJson({
      action: decision.action,
      canonicalPolicyProof,
      contentHtml: decision.content?.html ?? null,
      counterfactualAction: counterfactualDecision.action,
      proof: proof
        ? {
            issueCodes: proof.issueCodes,
            method: proof.method,
            normalizedCandidateDStrong: proof.normalizedCandidateDStrong,
            normalizedPrimaryDStrong: proof.normalizedPrimaryDStrong,
            proven: proof.proven,
            facts: proof.facts,
            references: proof.references
          }
        : null,
      quarantinedParts: decision.quarantinedParts,
      rawDigest: sha256(input.sections.rawHtml),
      reasonCodes: decision.reasonCodes
    })
  );
  return {
    decision,
    counterfactualDecision,
    proof,
    canonicalPolicyProof,
    selectionDigest
  };
}

export function assessCanonicalHebrewMeaning(input: {
  audit: EnglishEvidenceAuditRecord;
  candidate: HebrewEnglishCandidate | undefined;
  selectedStatus: LexiconV3AuthoringEnglishBundle["status"];
  meaningHtml: string;
  primaryDStrong: string;
  morph: string;
  sharedAcrossSiblingGlosses: boolean;
  legacyGeneralSharedAcrossSiblings: boolean;
  baseConfidence: number;
}): CanonicalHebrewMeaningAssessment {
  const issueCodes: string[] = [];
  const advisoryCodes: string[] = [];
  const companionAssessment = input.candidate?.fieldAssessments.meaning;
  const sections = parseTbeshMeaning(input.meaningHtml);
  const properName = input.morph.trim().startsWith("N:");
  const exactTipnrIdentity = Boolean(
    input.candidate?.method === "tipnr-exact-dstrong" &&
    input.candidate.mapping.tipnrEntityIds.length === 1 &&
    !input.candidate.issues.includes("tipnr-exact-dstrong-ambiguous")
  );
  const exactTipnrGlossAlias = Boolean(
    input.candidate?.fieldAssessments?.gloss?.status === "validated" &&
    input.candidate.fieldAssessments.gloss.method === "tipnr-exact-alias"
  );
  const lexicalSectionResolution =
    sections.hasSectionSeparator && !properName
      ? resolveTbeshSectionLedger({
          entryKey: input.audit.key,
          rawHtmlDigest: sha256(input.meaningHtml),
          tbeshDigest: input.audit.sourceDigests.TBESH
        })
      : null;
  const lexicalSectionPolicy =
    lexicalSectionResolution?.reviewed === true
      ? lexicalSectionResolution.category
      : "unreviewed";
  const isSuffixedIdentity = /^H\d{4,5}(?:[A-Za-z]|_[A-Za-z])$/u.test(
    input.primaryDStrong
  );
  const citations = input.audit.evidence.brief.citations;
  const citationMiss =
    citations.resolvedReferences.length > 0 &&
    citations.targetHits.length === 0;
  const stepSpecificCitations = sections.hasSectionSeparator
    ? extractSourceReferences(sections.stepSpecificHtml, "TBESH")
    : [];
  const shouldAttemptTipnrScopeProof =
    sections.classification === "both" &&
    properName &&
    exactTipnrIdentity &&
    (citationMiss || (isSuffixedIdentity && citations.references.length === 0));
  const tipnrScopeProof = shouldAttemptTipnrScopeProof
    ? proveStrictTbeshTipnrScope({
        sectionClassification: sections.classification,
        properName,
        primaryDStrong: input.primaryDStrong,
        tipnrEntityIds: input.candidate?.mapping.tipnrEntityIds ?? [],
        tipnrEntityReferences:
          input.candidate?.mapping.tipnrEntityReferences ?? [],
        stepSpecificCitations,
        tahotOccurrences:
          input.audit.evidence.exactOccurrence.count > 0
            ? [
                {
                  dStrong: input.audit.evidence.exactOccurrence.stepStrong,
                  references:
                    input.audit.evidence.exactOccurrence.references ?? []
                }
              ]
            : []
      })
    : null;
  const properSpecificScopeProven = Boolean(
    properName &&
    exactTipnrIdentity &&
    (shouldAttemptTipnrScopeProof ? tipnrScopeProof?.proven === true : true)
  );

  if (input.selectedStatus === "source_issue") {
    issueCodes.push("tbesh-canonical-source-issue");
  } else if (input.selectedStatus === "review_needed") {
    issueCodes.push("tbesh-canonical-source-review-needed");
  }
  if (!companionAssessment) {
    issueCodes.push("hebrew-open-corroboration-missing");
  } else if (companionAssessment.status === "source_issue") {
    issueCodes.push("hebrew-open-corroboration-source-issue");
  } else if (companionAssessment.status === "review_needed") {
    issueCodes.push("hebrew-open-corroboration-review-needed");
  }

  const sourceAudit = input.audit.evidence.sourceAudit;
  if (!sourceAudit || sourceAudit.status !== "source_ok") {
    issueCodes.push("tbesh-source-audit-review-required");
  }
  if (sourceAudit?.requiresReview) {
    issueCodes.push("tbesh-source-audit-review-required");
  }
  if (!sourceAudit?.glossSupport) {
    issueCodes.push("tbesh-meaning-gloss-support-unavailable");
  } else if (sourceAudit.glossSupport.contentTerms.length === 0) {
    advisoryCodes.push("tbesh-gloss-token-check-inapplicable");
  } else if (!sourceAudit.glossSupport.meaningSupportsGloss) {
    if (
      sections.hasSectionSeparator &&
      sections.classification === "both" &&
      properName &&
      exactTipnrIdentity &&
      exactTipnrGlossAlias
    ) {
      advisoryCodes.push("tbesh-gloss-supported-by-exact-specific-section");
    } else {
      issueCodes.push("tbesh-meaning-gloss-mismatch");
    }
  }

  if (citationMiss) {
    if (tipnrScopeProof?.proven && stepSpecificCitations.length > 0) {
      advisoryCodes.push("tbesh-citations-reconciled-by-tipnr-tahot-scope");
    } else {
      issueCodes.push("tbesh-citations-miss-exact-identity");
    }
  } else if (isSuffixedIdentity && citations.references.length === 0) {
    if (tipnrScopeProof?.proven) {
      advisoryCodes.push("tbesh-suffixed-scope-proven-by-tipnr-tahot");
    } else {
      issueCodes.push("tbesh-suffixed-scope-unproven");
    }
  }
  if (sections.hasSectionSeparator) {
    advisoryCodes.push("tbesh-sectioned-meaning");
    if (sections.sectionSeparatorCount > 1) {
      issueCodes.push("tbesh-multiple-section-separators");
    }
    if (sections.classification === "empty") {
      issueCodes.push("tbesh-empty-sectioned-meaning");
    } else if (!properName) {
      if (lexicalSectionPolicy === "verified_context") {
        advisoryCodes.push("tbesh-lexical-section-scopes-audited");
      } else if (
        lexicalSectionPolicy === "empty_tail" &&
        sections.classification === "specific_only"
      ) {
        advisoryCodes.push("tbesh-audited-empty-legacy-tail");
      } else if (lexicalSectionPolicy === "foreign_sibling") {
        issueCodes.push("tbesh-foreign-sibling-tail-exclusion-required");
      } else if (lexicalSectionPolicy === "source_conflict") {
        issueCodes.push("tbesh-audited-lexical-source-conflict");
      } else {
        issueCodes.push("tbesh-lexical-sectioned-scope-review-required");
      }
    } else if (sections.classification === "legacy_only") {
      if (!exactTipnrIdentity) {
        issueCodes.push("tbesh-proper-name-exact-section-unproven");
      }
      if (input.legacyGeneralSharedAcrossSiblings) {
        issueCodes.push("tbesh-shared-family-context-without-specific-section");
      }
    } else if (sections.classification === "specific_only") {
      advisoryCodes.push("tbesh-empty-legacy-section-after-separator");
    }
    if (
      sections.classification === "both" &&
      input.legacyGeneralSharedAcrossSiblings
    ) {
      advisoryCodes.push("tbesh-shared-legacy-general-context");
    }
    if (properName && !exactTipnrIdentity) {
      advisoryCodes.push("tbesh-proper-name-tipnr-identity-not-exact");
    }
  }
  if (input.sharedAcrossSiblingGlosses) {
    issueCodes.push("tbesh-shared-sibling-meaning-scope-review-required");
  }

  const normalizedIssues = [...new Set(issueCodes)].sort();
  const sourceIssue = normalizedIssues.some((code) =>
    [
      "tbesh-canonical-source-issue",
      "hebrew-open-corroboration-source-issue",
      "tbesh-empty-sectioned-meaning",
      "tbesh-audited-lexical-source-conflict"
    ].includes(code)
  );
  const status: CanonicalHebrewMeaningAssessment["status"] = sourceIssue
    ? "source_issue"
    : normalizedIssues.length > 0
      ? "review_needed"
      : "validated";
  return {
    status,
    confidence:
      status === "source_issue"
        ? 0.2
        : status === "review_needed"
          ? Math.min(
              input.baseConfidence,
              companionAssessment?.confidence ?? 0.72,
              0.72
            )
          : Math.min(
              input.baseConfidence,
              companionAssessment?.confidence ?? input.baseConfidence
            ),
    issueCodes: normalizedIssues,
    advisoryCodes: [...new Set(advisoryCodes)].sort(),
    sectioning: canonicalHebrewMeaningSectioning({
      sections,
      properName,
      exactTipnrIdentity,
      properSpecificScopeProven,
      lexicalSectionResolution,
      legacyGeneralSharedAcrossSiblings:
        input.legacyGeneralSharedAcrossSiblings,
      tipnrScopeProof
    })
  };
}

function canonicalHebrewMeaningSectioning(input: {
  sections: TbeshMeaningSections;
  properName: boolean;
  exactTipnrIdentity: boolean;
  properSpecificScopeProven: boolean;
  lexicalSectionResolution: TbeshSectionLedgerResolution | null;
  legacyGeneralSharedAcrossSiblings: boolean;
  tipnrScopeProof: TbeshTipnrScopeProof | null;
}): CanonicalHebrewMeaningAssessment["sectioning"] {
  const hasSpecific = hasMeaningfulTbeshHtml(input.sections.stepSpecificHtml);
  const hasLegacy = hasMeaningfulTbeshHtml(input.sections.legacyGeneralHtml);
  const lexicalSectionPolicy =
    input.lexicalSectionResolution?.reviewed === true
      ? input.lexicalSectionResolution.category
      : "unreviewed";
  return {
    hasSectionSeparator: input.sections.hasSectionSeparator,
    sectionSeparatorCount: input.sections.sectionSeparatorCount,
    classification: input.sections.classification,
    properName: input.properName,
    exactTipnrIdentity: input.exactTipnrIdentity,
    lexicalSectionPolicy,
    legacyGeneralSharedAcrossSiblings: input.legacyGeneralSharedAcrossSiblings,
    stepSpecificScope: !hasSpecific
      ? "absent"
      : !input.sections.hasSectionSeparator
        ? "unsectioned"
        : (input.properName && input.properSpecificScopeProven) ||
            (input.lexicalSectionResolution?.reviewed === true &&
              tbeshSectionLedgerProvesSpecificScope(
                input.lexicalSectionResolution.category
              ))
          ? "exact_dstrong"
          : "candidate_dstrong",
    legacyGeneralScope: !hasLegacy
      ? "absent"
      : lexicalSectionPolicy === "verified_context"
        ? "exact_or_component_context"
        : lexicalSectionPolicy === "foreign_sibling"
          ? "foreign_sibling"
          : lexicalSectionPolicy === "source_conflict"
            ? "source_conflict"
            : "base_strong_context",
    stepSpecificDigest: hasSpecific
      ? sha256(input.sections.stepSpecificHtml)
      : null,
    legacyGeneralDigest: hasLegacy
      ? sha256(input.sections.legacyGeneralHtml)
      : null,
    tipnrScopeProof: input.tipnrScopeProof
  };
}

function sharedHebrewSiblingMeaningKeys(entries: FullEntryRow[]): Set<string> {
  const groups = new Map<string, FullEntryRow[]>();
  for (const entry of entries) {
    if (normalizeLexiconLanguage(entry.language) !== "hebrew") continue;
    const key = `${entry.eStrong}\u0000${entry.meaning}`;
    const values = groups.get(key) ?? [];
    values.push(entry);
    groups.set(key, values);
  }
  const result = new Set<string>();
  for (const siblings of groups.values()) {
    if (siblings.length < 2) continue;
    const glosses = new Set(siblings.map((entry) => entry.gloss.trim()));
    if (glosses.size < 2) continue;
    for (const entry of siblings) {
      result.add(
        buildLexiconEntryIdentity({
          language: "hebrew",
          eStrong: entry.eStrong,
          dStrong: entry.dStrong,
          uStrong: entry.uStrong
        }).entryKey
      );
    }
  }
  return result;
}

interface HebrewMeaningFamilyMultiplicity {
  rawHtmlCount: number;
  canonicalTextCount: number;
}

function hebrewMeaningFamilyMultiplicities(
  entries: readonly FullEntryRow[]
): Map<string, HebrewMeaningFamilyMultiplicity> {
  const rawHtmlCounts = new Map<string, number>();
  const canonicalTextCounts = new Map<string, number>();
  for (const entry of entries) {
    if (normalizeLexiconLanguage(entry.language) !== "hebrew") continue;
    const rawHtmlKey = `${entry.eStrong}\u0000${entry.meaning}`;
    const canonicalText = stripLexiconHtml(
      normalizeTbeshMeaningHtml(entry.meaning)
    );
    const canonicalTextKey = `${entry.eStrong}\u0000${canonicalText}`;
    rawHtmlCounts.set(rawHtmlKey, (rawHtmlCounts.get(rawHtmlKey) ?? 0) + 1);
    canonicalTextCounts.set(
      canonicalTextKey,
      (canonicalTextCounts.get(canonicalTextKey) ?? 0) + 1
    );
  }

  const result = new Map<string, HebrewMeaningFamilyMultiplicity>();
  for (const entry of entries) {
    if (normalizeLexiconLanguage(entry.language) !== "hebrew") continue;
    const identity = buildLexiconEntryIdentity({
      language: "hebrew",
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong
    });
    const canonicalText = stripLexiconHtml(
      normalizeTbeshMeaningHtml(entry.meaning)
    );
    result.set(identity.entryKey, {
      rawHtmlCount:
        rawHtmlCounts.get(`${entry.eStrong}\u0000${entry.meaning}`) ?? 0,
      canonicalTextCount:
        canonicalTextCounts.get(`${entry.eStrong}\u0000${canonicalText}`) ?? 0
    });
  }
  return result;
}

function sharedHebrewLegacyGeneralKeys(entries: FullEntryRow[]): Set<string> {
  const groups = new Map<string, FullEntryRow[]>();
  for (const entry of entries) {
    if (normalizeLexiconLanguage(entry.language) !== "hebrew") continue;
    const sections = parseTbeshMeaning(entry.meaning);
    if (
      !sections.hasSectionSeparator ||
      !hasMeaningfulTbeshHtml(sections.legacyGeneralHtml)
    ) {
      continue;
    }
    const key = `${entry.eStrong}\u0000${sections.legacyGeneralHtml.trim()}`;
    const values = groups.get(key) ?? [];
    values.push(entry);
    groups.set(key, values);
  }
  const result = new Set<string>();
  for (const siblings of groups.values()) {
    if (siblings.length < 2) continue;
    for (const entry of siblings) {
      result.add(
        buildLexiconEntryIdentity({
          language: "hebrew",
          eStrong: entry.eStrong,
          dStrong: entry.dStrong,
          uStrong: entry.uStrong
        }).entryKey
      );
    }
  }
  return result;
}

export async function buildLexiconV3Authoring(
  rawOptions: BuildLexiconV3AuthoringOptions
): Promise<BuildLexiconV3AuthoringSummary> {
  const options = resolveOptions(rawOptions);
  const transactionDirectory = authoringPairTransactionDirectory(options);
  const temporaryOutput = join(transactionDirectory, "database.new.sqlite");
  const temporarySummary = join(transactionDirectory, "summary.new.json");
  assertSafeAuthoringPaths(options, temporaryOutput, temporarySummary);
  if (
    Boolean(options.hebrewEnglish) !== Boolean(options.hebrewEnglishSummary)
  ) {
    throw new Error("hebrew-english-artifact-pair-required");
  }
  if (options.frenchRemediationSummary && !options.frenchReview) {
    throw new Error("french-remediation-summary-requires-review");
  }
  assertRequiredFiles([
    options.database,
    options.entitiesDatabase,
    options.englishAudit,
    ...(options.frenchReview ? [options.frenchReview] : []),
    ...(options.frenchPackets ? [options.frenchPackets] : []),
    ...(options.frenchPacketSummary ? [options.frenchPacketSummary] : []),
    ...(options.frenchRemediationSummary
      ? [options.frenchRemediationSummary]
      : []),
    ...(options.hebrewEnglish ? [options.hebrewEnglish] : []),
    ...(options.hebrewEnglishSummary ? [options.hebrewEnglishSummary] : []),
    ...(options.reviewDecisions ? [options.reviewDecisions] : []),
    ...(options.hebrewEnglish &&
    !options.testOnlySkipHebrewSourceRebuild &&
    options.hebrewSourcesDirectory
      ? [
          "HebrewStrong.xml",
          "AugIndex.xml",
          "LexicalIndex.xml",
          "BrownDriverBriggs.xml"
        ].map((name) => join(options.hebrewSourcesDirectory!, name))
      : [])
  ]);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const [
    databaseDigest,
    entitiesDatabaseDigest,
    englishAuditDigest,
    frenchReviewDigest,
    frenchPacketsDigest,
    frenchPacketSummaryDigest,
    frenchRemediationSummaryDigest,
    hebrewEnglishDigest,
    hebrewEnglishSummaryDigest,
    reviewDecisionsDigest,
    codeFingerprint
  ] = await Promise.all([
    sha256File(options.database),
    sha256File(options.entitiesDatabase),
    sha256File(options.englishAudit),
    options.frenchReview ? sha256File(options.frenchReview) : null,
    options.frenchPackets ? sha256File(options.frenchPackets) : null,
    options.frenchPacketSummary
      ? sha256File(options.frenchPacketSummary)
      : null,
    options.frenchRemediationSummary
      ? sha256File(options.frenchRemediationSummary)
      : null,
    options.hebrewEnglish ? sha256File(options.hebrewEnglish) : null,
    options.hebrewEnglishSummary
      ? sha256File(options.hebrewEnglishSummary)
      : null,
    options.reviewDecisions ? sha256File(options.reviewDecisions) : null,
    lexiconV3CodeFingerprint()
  ]);
  const reviewDecisions = options.reviewDecisions
    ? readLexiconV3ReviewDecisions(options.reviewDecisions)
    : [];
  const englishReviewDecisions = reviewDecisions.filter(
    (decision) => decision.locale === "en"
  );
  const frenchReviewDecisions = reviewDecisions.filter(
    (decision) => decision.locale === "fr"
  );
  const englishReviewDecisionsFingerprint =
    lexiconV3ReviewDecisionSetFingerprint(reviewDecisions, "en");

  const sourceDatabase = new DatabaseSync(options.database, { readOnly: true });
  let target: DatabaseSync | null = null;
  let transaction: AuthoringPairTransaction | null = null;
  let stagingDatabaseIdentity: AuthoringFileIdentity | null = null;

  try {
    assertFullDatabaseSchema(sourceDatabase);
    const sourceLogicalFingerprint =
      lexiconV3SourceLogicalFingerprint(sourceDatabase);
    const englishLineageFingerprint = sha256(
      stableJson({
        schemaVersion: "lexicon-v3-english-lineage@1",
        databaseDigest,
        entitiesDatabaseDigest,
        englishAuditDigest,
        hebrewEnglishDigest,
        hebrewEnglishSummaryDigest,
        sourceLogicalFingerprint,
        englishReviewDecisionsFingerprint,
        codeFingerprint
      })
    );
    const entries = readFullEntries(sourceDatabase);
    const resources = readFullResources(sourceDatabase);
    const databaseSourceDigests = readDatabaseSourceDigests(sourceDatabase);
    const audits = await readEnglishAudit(options.englishAudit);
    validateEnglishAudit({
      entries,
      audits,
      databaseDigest,
      databaseSourceDigests
    });
    const hebrewEnglishArtifact =
      options.hebrewEnglish && options.hebrewEnglishSummary
        ? readHebrewEnglishArtifact(
            options.hebrewEnglish,
            options.hebrewEnglishSummary
          )
        : null;
    if (hebrewEnglishArtifact) {
      assertPinnedHebrewEnglishArtifactSummary(hebrewEnglishArtifact.summary);
      if (!options.testOnlySkipHebrewSourceRebuild) {
        const sources = options.hebrewSourcesDirectory;
        if (!sources) throw new Error("missing-hebrew-source-directory");
        assertHebrewEnglishArtifactMatchesSources(hebrewEnglishArtifact, {
          lexiconDbPath: options.database,
          entitiesDbPath: options.entitiesDatabase,
          hebrewStrongPath: join(sources, "HebrewStrong.xml"),
          augIndexPath: join(sources, "AugIndex.xml"),
          lexicalIndexPath: join(sources, "LexicalIndex.xml"),
          brownDriverBriggsPath: join(sources, "BrownDriverBriggs.xml"),
          openScripturesRevision: OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT
        });
      }
    }
    if (
      hebrewEnglishArtifact &&
      hebrewEnglishDigest !== hebrewEnglishArtifact.summary.outputDigest
    ) {
      throw new Error("hebrew-english-output-digest-mismatch");
    }
    const hebrewEnglish = validateHebrewEnglishCoverage(
      entries,
      hebrewEnglishArtifact?.records ?? []
    );
    const frenchPackets = options.frenchPackets
      ? await readFrenchPackets(options.frenchPackets, audits)
      : new Map<string, LexiconV3FrenchPacket>();
    const frenchPacketBuildSummary =
      options.frenchPackets &&
      options.frenchPacketSummary &&
      frenchPacketsDigest
        ? await validateFrenchPacketBuildSummary({
            path: options.frenchPacketSummary,
            packetsPath: options.frenchPackets,
            packetsDigest: frenchPacketsDigest,
            packetCount: frenchPackets.size,
            databaseDigest,
            englishAuditDigest
          })
        : null;
    const reviews = options.frenchReview
      ? await readFrenchReview(
          options.frenchReview,
          audits,
          frenchPackets,
          options.frenchPackets!,
          options.frenchRemediationSummary
        )
      : new Map<string, FrenchReviewRecord>();
    if (
      [...reviews.values()].some(
        (review) => review.schemaVersion === "lexicon-v3-french-review@4"
      ) &&
      !options.testOnlySkipFrenchEntityArtifactReplay
    ) {
      await assertFrenchInternalEntityArtifactBoundary({
        options,
        audits,
        selectedPackets: frenchPackets,
        reviews
      });
    }
    const sourceDigests = firstAudit(audits).sourceDigests;
    const sourceFingerprint = sha256(
      stableJson({
        databaseDigest,
        entitiesDatabaseDigest,
        englishAuditDigest,
        frenchReviewDigest,
        frenchPacketsDigest,
        frenchPacketSummaryDigest,
        frenchRemediationSummaryDigest,
        hebrewEnglishDigest,
        hebrewEnglishSummaryDigest,
        reviewDecisionsDigest,
        sourceLogicalFingerprint,
        sourceDigests
      })
    );

    mkdirSync(dirname(options.output), { recursive: true });
    mkdirSync(dirname(options.summaryJson), { recursive: true });
    transaction = beginAuthoringPairTransaction(
      options,
      transactionDirectory,
      temporaryOutput,
      temporarySummary
    );
    options.testOnlyHooks?.beforeStagingDatabaseOpen?.({
      transactionDirectory,
      stagingDatabase: temporaryOutput,
      stagingSummary: temporarySummary
    });
    assertPrivateTransactionDirectory(transaction);
    assertPathAbsent(temporaryOutput, "staging-database-before-open");
    target = new DatabaseSync(temporaryOutput);
    stagingDatabaseIdentity = assertSecureRegularFile(
      temporaryOutput,
      "staging-database-after-open"
    );
    assertFileInsideTransactionDirectory(
      transaction,
      stagingDatabaseIdentity,
      "staging-database-after-open"
    );
    target.exec("PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;");
    createLexiconV3Schema(target);
    let sourceIds: SourceIds;
    target.exec("BEGIN IMMEDIATE;");
    try {
      sourceIds = insertSources(target, {
        sourceDigests,
        englishAuditDigest,
        frenchReviewDigest,
        frenchPacketsDigest,
        frenchPacketSummaryDigest,
        frenchRemediationSummaryDigest,
        hebrewEnglishDigest,
        hebrewEnglishSummaryDigest,
        hebrewEnglishSummary: hebrewEnglishArtifact?.summary ?? null,
        options,
        generatedAt
      });
      populateAuthoringDatabase({
        target,
        entries,
        resourcesByEntry: groupResourcesByEntry(resources),
        audits,
        reviews,
        hebrewEnglish,
        sourceIds,
        hebrewEnglishDigest,
        hebrewEnglishSummary: hebrewEnglishArtifact?.summary ?? null,
        generatedAt
      });
      assertCanonicalHebrewPolicyLedger(target);
      insertEnglishLineageMetadata(target, {
        databaseDigest,
        englishAuditDigest,
        englishReviewDecisionsFingerprint,
        englishLineageFingerprint
      });
      target.exec("COMMIT;");
    } catch (error) {
      target.exec("ROLLBACK;");
      throw error;
    }

    if (englishReviewDecisions.length > 0) {
      applyLexiconV3ReviewDecisions(target, englishReviewDecisions);
    }

    const englishSnapshot = readLexiconV3AuthoringEnglishSnapshot(target);
    if (englishSnapshot.lineageFingerprint !== englishLineageFingerprint) {
      throw new Error("computed-english-lineage-mismatch");
    }
    if (reviews.size > 0) {
      assertFrenchPacketsMatchReviewedEnglish({
        packets: frenchPackets,
        summary: frenchPacketBuildSummary,
        snapshot: englishSnapshot,
        englishReviewDecisionsFingerprint,
        sourceLogicalFingerprint
      });
      const entryStates = buildReviewedEnglishEntryStates(
        target,
        audits,
        englishSnapshot.records,
        reviews.keys()
      );
      target.exec("BEGIN IMMEDIATE;");
      try {
        insertFrenchReviewContent(
          {
            target,
            entries,
            resourcesByEntry: groupResourcesByEntry(resources),
            audits,
            reviews,
            hebrewEnglish,
            sourceIds,
            hebrewEnglishDigest,
            hebrewEnglishSummary: hebrewEnglishArtifact?.summary ?? null,
            generatedAt
          },
          entryStates
        );
        target.exec("COMMIT;");
      } catch (error) {
        target.exec("ROLLBACK;");
        throw error;
      }
    }

    if (frenchReviewDecisions.length > 0) {
      applyLexiconV3ReviewDecisions(target, frenchReviewDecisions);
    }

    insertMetadata(target, {
      generatedAt,
      options,
      databaseDigest,
      entitiesDatabaseDigest,
      englishAuditDigest,
      frenchReviewDigest,
      frenchPacketsDigest,
      frenchPacketSummaryDigest,
      frenchRemediationSummaryDigest,
      hebrewEnglishDigest,
      hebrewEnglishSummaryDigest,
      reviewDecisionsDigest,
      sourceFingerprint,
      sourceLogicalFingerprint,
      codeFingerprint,
      englishReviewDecisionsFingerprint,
      englishLineageFingerprint,
      englishSnapshotFingerprint: englishSnapshot.fingerprint,
      sourceDigests,
      entryCount: entries.length
    });

    if (
      reviews.size > 0 &&
      !options.testOnlySkipFrozenCoreEnglishReleaseContinuity
    ) {
      assertFrozenCoreEnglishReleaseContinuity({
        plan: planLexiconV3Release(target, { profile: "core-en" }),
        summary: frenchPacketBuildSummary
      });
    }

    target.exec("VACUUM;");
    const schema = verifyLexiconV3Schema(target);
    if (!schema.ok) {
      throw new Error(`invalid-authoring-schema:${JSON.stringify(schema)}`);
    }
    const summary = buildSummary(target, {
      generatedAt,
      options,
      databaseDigest,
      entitiesDatabaseDigest,
      englishAuditDigest,
      frenchReviewDigest,
      frenchPacketsDigest,
      frenchPacketSummaryDigest,
      frenchRemediationSummaryDigest,
      hebrewEnglishDigest,
      hebrewEnglishSummaryDigest,
      reviewDecisionsDigest,
      sourceFingerprint,
      sourceLogicalFingerprint,
      codeFingerprint,
      englishReviewDecisionsFingerprint,
      englishLineageFingerprint,
      englishSnapshotFingerprint: englishSnapshot.fingerprint,
      schema
    });

    assertSameFileIdentity(
      temporaryOutput,
      stagingDatabaseIdentity,
      "staging-database-before-close"
    );
    target.close();
    target = null;
    fsyncRegularFile(
      temporaryOutput,
      stagingDatabaseIdentity,
      "staging-database-after-close"
    );
    const stagingSummaryIdentity = writeStagedJson(temporarySummary, summary);
    installAuthoringPair(transaction, {
      options,
      stagingDatabaseIdentity,
      stagingSummaryIdentity
    });
    transaction = null;
    return summary;
  } catch (error) {
    if (target) target.close();
    if (transaction) {
      try {
        rollbackAuthoringPairTransaction(transaction);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "authoring-pair-rollback-failed"
        );
      }
    }
    throw error;
  } finally {
    sourceDatabase.close();
  }
}

function assertCanonicalHebrewPolicyLedger(db: DatabaseSync): void {
  const meaningRows = db
    .prepare(
      `SELECT DISTINCT field.id AS fieldVersionId, field.entryKey,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.action') AS action,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.counterfactualAction') AS counterfactualAction,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.selectionDigest') AS selectionDigest,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.canonicalPolicyProof.policy.id') AS policyId,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.canonicalPolicyProof.proven') AS proven,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.canonicalPolicyProof.disposition') AS disposition,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.canonicalPolicyProof.reasonCodes') AS reasonCodes,
              json_extract(evidence.detailsJson,
                '$.publicationSelection.canonicalPolicyProof.digests.proof') AS proofDigest
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       WHERE field.entryKey LIKE 'hebrew:%'
         AND field.locale = 'en' AND field.field = 'meaning'
         AND evidence.stance = 'supports'
         AND json_type(evidence.detailsJson,
           '$.publicationSelection') = 'object'`
    )
    .all() as Array<{
    fieldVersionId: number;
    entryKey: string;
    action: string;
    counterfactualAction: string;
    selectionDigest: string;
    policyId: string;
    proven: number;
    disposition: string;
    reasonCodes: string;
    proofDigest: string;
  }>;
  const expectedDisposition: Record<string, string> = {
    raw_combined: "publish_raw",
    exact_companion: "publish_exact_companion",
    step_specific_only: "publish_step_specific",
    legacy_general_only: "publish_legacy_general",
    editorial_reconstruction: "publish_editorial_reconstruction",
    blocked: "block_publication"
  };
  for (const row of meaningRows) {
    if (
      row.policyId !== HEBREW_CANONICAL_MEANING_POLICY_ID ||
      row.proven !== 1 ||
      expectedDisposition[row.action] !== row.disposition ||
      !row.counterfactualAction ||
      !isSha256Digest(row.selectionDigest) ||
      !isSha256Digest(row.proofDigest)
    ) {
      throw new Error(
        `invalid-hebrew-canonical-meaning-ledger:${row.entryKey}:${stableJson(row)}`
      );
    }
  }

  const exactRepairRows = db
    .prepare(
      `SELECT DISTINCT field.id AS fieldVersionId, field.entryKey,
              field.generator, field.method, field.state,
              json_extract(evidence.detailsJson,
                '$.repair.schemaVersion') AS repairSchema,
              json_extract(evidence.detailsJson,
                '$.repair.repairDigest') AS repairDigest,
              json_extract(evidence.detailsJson,
                '$.exactMeaningRepairProjection.schemaVersion') AS projectionSchema,
              json_extract(evidence.detailsJson,
                '$.exactMeaningRepairProjection.projectionDigest') AS projectionDigest,
              json_extract(evidence.detailsJson,
                '$.exactMeaningRepairProjection.publishedHtmlDigest') AS publishedHtmlDigest
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       WHERE field.entryKey LIKE 'hebrew:%'
         AND field.locale = 'en' AND field.field = 'meaning'
         AND evidence.stance = 'supports'
         AND evidence.witnessFamily = 'lexicon-v3-audit-field-repair'
         AND json_type(evidence.detailsJson,
           '$.exactMeaningRepairProjection') = 'object'`
    )
    .all() as Array<{
    fieldVersionId: number;
    entryKey: string;
    generator: string;
    method: string;
    state: string;
    repairSchema: string;
    repairDigest: string;
    projectionSchema: string;
    projectionDigest: string;
    publishedHtmlDigest: string;
  }>;
  for (const row of exactRepairRows) {
    if (
      row.generator !== ENGLISH_AUDIT_FIELD_REPAIR_GENERATOR ||
      row.method !== "rule" ||
      row.state !== "auto_validated" ||
      row.repairSchema !== "lexicon-v3-english-exact-repair@1" ||
      row.projectionSchema !== HEBREW_EXACT_MEANING_REPAIR_PROJECTION_SCHEMA ||
      !isSha256Digest(row.repairDigest) ||
      !isSha256Digest(row.projectionDigest) ||
      !isSha256Digest(row.publishedHtmlDigest)
    ) {
      throw new Error(
        `invalid-hebrew-exact-meaning-repair-ledger:${row.entryKey}:${stableJson(row)}`
      );
    }
  }

  const meaningCoverage = db
    .prepare(
      `SELECT
         (SELECT count(*) FROM LexiconFieldVersions
          WHERE entryKey LIKE 'hebrew:%' AND locale = 'en'
            AND field = 'meaning') AS fields,
         (SELECT count(DISTINCT field.id)
          FROM LexiconFieldVersions field
          JOIN LexiconFieldEvidence evidence
            ON evidence.fieldVersionId = field.id
          WHERE field.entryKey LIKE 'hebrew:%' AND field.locale = 'en'
            AND field.field = 'meaning' AND evidence.stance = 'supports'
            AND json_extract(evidence.detailsJson,
              '$.technicalMarkerProof.proven') = 1) AS technical`
    )
    .get() as { fields: number; technical: number };
  if (
    meaningRows.length + meaningCoverage.technical + exactRepairRows.length !==
    meaningCoverage.fields
  ) {
    throw new Error(
      `incomplete-hebrew-canonical-meaning-ledger:${meaningRows.length}:${meaningCoverage.technical}:${exactRepairRows.length}:${meaningCoverage.fields}`
    );
  }

  const glossRows = db
    .prepare(
      `SELECT DISTINCT field.entryKey,
              json_extract(evidence.detailsJson, '$.proof.action') AS action,
              json_extract(evidence.detailsJson, '$.proof.proven') AS proven,
              json_extract(evidence.detailsJson,
                '$.proof.publicationApproved') AS publicationApproved,
              json_extract(evidence.detailsJson,
                '$.proof.digests.proof') AS proofDigest
       FROM LexiconFieldVersions field
       JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
       WHERE field.entryKey LIKE 'hebrew:%'
         AND field.locale = 'en' AND field.field = 'gloss'
         AND json_extract(evidence.detailsJson, '$.proof.policy.id') = ?`
    )
    .all(HEBREW_CANONICAL_GLOSS_POLICY_ID) as Array<{
    entryKey: string;
    action: string;
    proven: number;
    publicationApproved: number;
    proofDigest: string;
  }>;
  for (const row of glossRows) {
    const expectedApproval = [
      "keep_step",
      "replace_lexical_definition",
      "replace_tipnr_alias",
      "residual_keep_step",
      "residual_replace_source_value",
      "residual_editorial_reconstruction"
    ].includes(row.action);
    if (
      row.proven !== 1 ||
      Boolean(row.publicationApproved) !== expectedApproval ||
      !isSha256Digest(row.proofDigest)
    ) {
      throw new Error(
        `invalid-hebrew-canonical-gloss-ledger:${row.entryKey}:${stableJson(row)}`
      );
    }
  }
}

function isSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function resolveOptions(
  options: BuildLexiconV3AuthoringOptions
): BuildLexiconV3AuthoringOptions {
  return {
    database: resolve(options.database),
    entitiesDatabase: resolve(options.entitiesDatabase),
    hebrewSourcesDirectory: resolve(
      options.hebrewSourcesDirectory ?? DEFAULT_HEBREW_SOURCES
    ),
    englishAudit: resolve(options.englishAudit),
    frenchReview: options.frenchReview
      ? resolve(options.frenchReview)
      : undefined,
    frenchPackets: options.frenchReview
      ? resolve(options.frenchPackets ?? DEFAULT_FRENCH_PACKETS)
      : undefined,
    frenchPacketSummary: options.frenchReview
      ? resolve(options.frenchPacketSummary ?? DEFAULT_FRENCH_PACKET_SUMMARY)
      : undefined,
    frenchRemediationSummary: options.frenchRemediationSummary
      ? resolve(options.frenchRemediationSummary)
      : undefined,
    frenchConfiguration: options.frenchReview
      ? resolve(
          options.frenchConfiguration ?? DEFAULT_FRENCH_INTERNAL_CONFIGURATION
        )
      : undefined,
    frenchCanonicalEntities: options.frenchReview
      ? resolve(
          options.frenchCanonicalEntities ?? DEFAULT_FRENCH_CANONICAL_ENTITIES
        )
      : undefined,
    frenchCanonicalEntryPolicies: options.frenchReview
      ? resolve(
          options.frenchCanonicalEntryPolicies ??
            DEFAULT_FRENCH_CANONICAL_ENTRY_POLICIES
        )
      : undefined,
    frenchEntityMergeAttestation: options.frenchReview
      ? resolve(
          options.frenchEntityMergeAttestation ??
            DEFAULT_FRENCH_ENTITY_MERGE_ATTESTATION
        )
      : undefined,
    frenchEntityGate: options.frenchReview
      ? resolve(options.frenchEntityGate ?? DEFAULT_FRENCH_ENTITY_GATE)
      : undefined,
    frenchEntityMentions: options.frenchReview
      ? resolve(options.frenchEntityMentions ?? DEFAULT_FRENCH_ENTITY_MENTIONS)
      : undefined,
    frenchEntityMentionResolutionAttestation: options.frenchReview
      ? resolve(
          options.frenchEntityMentionResolutionAttestation ??
            DEFAULT_FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION
        )
      : undefined,
    frenchEntityPackets: options.frenchReview
      ? resolve(options.frenchEntityPackets ?? DEFAULT_FRENCH_ENTITY_PACKETS)
      : undefined,
    hebrewEnglish: options.hebrewEnglish
      ? resolve(options.hebrewEnglish)
      : undefined,
    hebrewEnglishSummary: options.hebrewEnglishSummary
      ? resolve(options.hebrewEnglishSummary)
      : undefined,
    reviewDecisions: options.reviewDecisions
      ? resolve(options.reviewDecisions)
      : undefined,
    output: resolve(options.output),
    summaryJson: resolve(options.summaryJson),
    generatedAt: options.generatedAt,
    testOnlySkipHebrewSourceRebuild: options.testOnlySkipHebrewSourceRebuild,
    testOnlySkipFrenchEntityArtifactReplay:
      options.testOnlySkipFrenchEntityArtifactReplay,
    testOnlySkipFrozenCoreEnglishReleaseContinuity:
      options.testOnlySkipFrozenCoreEnglishReleaseContinuity,
    testOnlyHooks: options.testOnlyHooks
  };
}

const AUTHORING_PAIR_TRANSACTION_SCHEMA =
  "lexicon-v3-authoring-pair-transaction@1" as const;

type AuthoringPairTransactionPhase =
  | "building"
  | "prepared"
  | "output-backed-up"
  | "pair-backed-up"
  | "output-installed"
  | "pair-installed"
  | "committed";

interface AuthoringFileIdentity {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  size: number;
  uid: number;
}

interface AuthoringDestinationSnapshot {
  path: string;
  existed: boolean;
  identity: AuthoringFileIdentity | null;
}

interface AuthoringPairTransactionJournal {
  schemaVersion: typeof AUTHORING_PAIR_TRANSACTION_SCHEMA;
  pairKey: string;
  pid: number;
  phase: AuthoringPairTransactionPhase;
  output: AuthoringDestinationSnapshot;
  summary: AuthoringDestinationSnapshot;
  stagingDatabase: string;
  stagingSummary: string;
  backupDatabase: string;
  backupSummary: string;
  newDigests: { database: string; summary: string } | null;
}

interface AuthoringPairTransaction {
  directory: string;
  directoryIdentity: AuthoringFileIdentity;
  journalPath: string;
  journal: AuthoringPairTransactionJournal;
  commitDurable: boolean;
}

function authoringPairTransactionDirectory(
  options: BuildLexiconV3AuthoringOptions
): string {
  const pairKey = authoringPairKey(options.output, options.summaryJson);
  return join(
    dirname(options.output),
    `.${basename(options.output)}.pair-${pairKey.slice(0, 20)}.transaction`
  );
}

function authoringPairKey(output: string, summaryJson: string): string {
  return sha256(
    stableJson({
      schemaVersion: AUTHORING_PAIR_TRANSACTION_SCHEMA,
      output: resolve(output),
      summaryJson: resolve(summaryJson)
    })
  );
}

function beginAuthoringPairTransaction(
  options: BuildLexiconV3AuthoringOptions,
  transactionDirectory: string,
  stagingDatabase: string,
  stagingSummary: string
): AuthoringPairTransaction {
  const outputParent = dirname(options.output);
  const summaryParent = dirname(options.summaryJson);
  if (statSync(outputParent).dev !== statSync(summaryParent).dev) {
    throw new Error("authoring-pair-cross-device-install-unsupported");
  }
  if (pathEntryExists(transactionDirectory)) {
    recoverInterruptedAuthoringPairTransaction(transactionDirectory, options);
  }
  mkdirSync(transactionDirectory, { mode: 0o700 });
  chmodSync(transactionDirectory, 0o700);
  fsyncDirectory(outputParent);
  const directoryIdentity = assertPrivateDirectory(
    transactionDirectory,
    "transaction-directory"
  );
  const pairKey = authoringPairKey(options.output, options.summaryJson);
  const transaction: AuthoringPairTransaction = {
    directory: transactionDirectory,
    directoryIdentity,
    journalPath: join(transactionDirectory, "transaction.json"),
    commitDurable: false,
    journal: {
      schemaVersion: AUTHORING_PAIR_TRANSACTION_SCHEMA,
      pairKey,
      pid: process.pid,
      phase: "building",
      output: snapshotAuthoringDestination(options.output, "output"),
      summary: snapshotAuthoringDestination(options.summaryJson, "summaryJson"),
      stagingDatabase,
      stagingSummary,
      backupDatabase: join(transactionDirectory, "database.previous"),
      backupSummary: join(transactionDirectory, "summary.previous"),
      newDigests: null
    }
  };
  persistAuthoringPairJournal(transaction);
  return transaction;
}

function installAuthoringPair(
  transaction: AuthoringPairTransaction,
  input: {
    options: BuildLexiconV3AuthoringOptions;
    stagingDatabaseIdentity: AuthoringFileIdentity;
    stagingSummaryIdentity: AuthoringFileIdentity;
  }
): void {
  const { options, stagingDatabaseIdentity, stagingSummaryIdentity } = input;
  assertPrivateTransactionDirectory(transaction);
  assertSameFileIdentity(
    transaction.journal.stagingDatabase,
    stagingDatabaseIdentity,
    "staging-database-before-install"
  );
  assertSameFileIdentity(
    transaction.journal.stagingSummary,
    stagingSummaryIdentity,
    "staging-summary-before-install"
  );
  assertFileInsideTransactionDirectory(
    transaction,
    stagingDatabaseIdentity,
    "staging-database-before-install"
  );
  assertFileInsideTransactionDirectory(
    transaction,
    stagingSummaryIdentity,
    "staging-summary-before-install"
  );
  assertSafeAuthoringPaths(
    options,
    transaction.journal.stagingDatabase,
    transaction.journal.stagingSummary
  );
  assertDestinationUnchanged(transaction.journal.output, "output");
  assertDestinationUnchanged(transaction.journal.summary, "summaryJson");

  transaction.journal.newDigests = {
    database: sha256FileSyncSecure(
      transaction.journal.stagingDatabase,
      stagingDatabaseIdentity,
      "staging-database-digest"
    ),
    summary: sha256FileSyncSecure(
      transaction.journal.stagingSummary,
      stagingSummaryIdentity,
      "staging-summary-digest"
    )
  };
  transaction.journal.phase = "prepared";
  persistAuthoringPairJournal(transaction);

  backupAuthoringDestination(
    transaction,
    transaction.journal.output,
    transaction.journal.backupDatabase,
    "output"
  );
  transaction.journal.phase = "output-backed-up";
  persistAuthoringPairJournal(transaction);
  backupAuthoringDestination(
    transaction,
    transaction.journal.summary,
    transaction.journal.backupSummary,
    "summaryJson"
  );
  transaction.journal.phase = "pair-backed-up";
  persistAuthoringPairJournal(transaction);

  // POSIX cannot switch two independent pathnames in one namespace operation.
  // Backups and the fsynced journal therefore remain authoritative until both
  // renames are installed and verified; every pre-commit exception rolls the
  // namespace back to the exact old pair.
  renameSync(
    transaction.journal.stagingDatabase,
    transaction.journal.output.path
  );
  fsyncRenameDirectories(
    transaction.directory,
    dirname(transaction.journal.output.path)
  );
  assertSameFileIdentity(
    transaction.journal.output.path,
    stagingDatabaseIdentity,
    "installed-database"
  );
  transaction.journal.phase = "output-installed";
  persistAuthoringPairJournal(transaction);

  options.testOnlyHooks?.afterFirstPairInstall?.({
    output: options.output,
    summaryJson: options.summaryJson,
    transactionDirectory: transaction.directory
  });

  renameSync(
    transaction.journal.stagingSummary,
    transaction.journal.summary.path
  );
  fsyncRenameDirectories(
    transaction.directory,
    dirname(transaction.journal.summary.path)
  );
  assertSameFileIdentity(
    transaction.journal.summary.path,
    stagingSummaryIdentity,
    "installed-summary"
  );
  transaction.journal.phase = "pair-installed";
  persistAuthoringPairJournal(transaction);

  assertInstalledAuthoringPair(transaction);
  transaction.journal.phase = "committed";
  persistAuthoringPairJournal(transaction);
  transaction.commitDurable = true;
  cleanupCommittedAuthoringPair(transaction);
}

function backupAuthoringDestination(
  transaction: AuthoringPairTransaction,
  snapshot: AuthoringDestinationSnapshot,
  backup: string,
  label: string
): void {
  assertPathAbsent(backup, `${label}-backup-before-rename`);
  if (!snapshot.existed) return;
  assertDestinationUnchanged(snapshot, label);
  renameSync(snapshot.path, backup);
  fsyncRenameDirectories(dirname(snapshot.path), transaction.directory);
  assertIdentityMatchesSnapshot(backup, snapshot, `${label}-backup`);
}

function assertInstalledAuthoringPair(
  transaction: AuthoringPairTransaction
): void {
  const digests = transaction.journal.newDigests;
  if (!digests) throw new Error("authoring-pair-missing-new-digests");
  const outputIdentity = assertSecureRegularFile(
    transaction.journal.output.path,
    "installed-output"
  );
  const summaryIdentity = assertSecureRegularFile(
    transaction.journal.summary.path,
    "installed-summary"
  );
  fsyncRegularFile(
    transaction.journal.output.path,
    outputIdentity,
    "installed-output"
  );
  fsyncRegularFile(
    transaction.journal.summary.path,
    summaryIdentity,
    "installed-summary"
  );
  if (
    sha256FileSyncSecure(
      transaction.journal.output.path,
      outputIdentity,
      "installed-output"
    ) !== digests.database
  ) {
    throw new Error("authoring-pair-installed-database-digest-mismatch");
  }
  if (
    sha256FileSyncSecure(
      transaction.journal.summary.path,
      summaryIdentity,
      "installed-summary"
    ) !== digests.summary
  ) {
    throw new Error("authoring-pair-installed-summary-digest-mismatch");
  }
  fsyncRenameDirectories(
    dirname(transaction.journal.output.path),
    dirname(transaction.journal.summary.path)
  );
}

function rollbackAuthoringPairTransaction(
  transaction: AuthoringPairTransaction
): void {
  assertPrivateTransactionDirectory(transaction);
  if (transaction.commitDurable) {
    assertInstalledAuthoringPair(transaction);
    cleanupCommittedAuthoringPair(transaction);
    return;
  }
  restoreAuthoringDestination(
    transaction,
    transaction.journal.summary,
    transaction.journal.backupSummary,
    transaction.journal.newDigests?.summary ?? null,
    "summaryJson"
  );
  restoreAuthoringDestination(
    transaction,
    transaction.journal.output,
    transaction.journal.backupDatabase,
    transaction.journal.newDigests?.database ?? null,
    "output"
  );
  cleanupAuthoringTransactionDirectory(transaction);
}

function restoreAuthoringDestination(
  transaction: AuthoringPairTransaction,
  snapshot: AuthoringDestinationSnapshot,
  backup: string,
  installedDigest: string | null,
  label: string
): void {
  if (pathEntryExists(backup)) {
    if (pathEntryExists(snapshot.path)) {
      assertRollbackRemovalIsSafe(snapshot.path, installedDigest, label);
      rmSync(snapshot.path, { force: true });
      fsyncDirectory(dirname(snapshot.path));
    }
    renameSync(backup, snapshot.path);
    fsyncRenameDirectories(transaction.directory, dirname(snapshot.path));
    assertIdentityMatchesSnapshot(snapshot.path, snapshot, `${label}-restored`);
    return;
  }
  if (snapshot.existed) {
    assertIdentityMatchesSnapshot(
      snapshot.path,
      snapshot,
      `${label}-unchanged`
    );
    return;
  }
  if (!pathEntryExists(snapshot.path)) return;
  assertRollbackRemovalIsSafe(snapshot.path, installedDigest, label);
  rmSync(snapshot.path, { force: true });
  fsyncDirectory(dirname(snapshot.path));
}

function assertRollbackRemovalIsSafe(
  path: string,
  installedDigest: string | null,
  label: string
): void {
  if (!installedDigest) {
    throw new Error(`authoring-pair-rollback-unexpected-destination:${label}`);
  }
  const identity = assertSecureRegularFile(path, `${label}-rollback-current`);
  if (
    sha256FileSyncSecure(path, identity, `${label}-rollback-current`) !==
    installedDigest
  ) {
    throw new Error(`authoring-pair-rollback-destination-drift:${label}`);
  }
}

function cleanupCommittedAuthoringPair(
  transaction: AuthoringPairTransaction
): void {
  rmSync(transaction.journal.backupDatabase, { force: true });
  rmSync(transaction.journal.backupSummary, { force: true });
  fsyncDirectory(transaction.directory);
  cleanupAuthoringTransactionDirectory(transaction);
}

function cleanupAuthoringTransactionDirectory(
  transaction: AuthoringPairTransaction
): void {
  assertPrivateTransactionDirectory(transaction);
  rmSync(transaction.directory, { recursive: true, force: true });
  fsyncDirectory(dirname(transaction.directory));
}

function recoverInterruptedAuthoringPairTransaction(
  transactionDirectory: string,
  options: BuildLexiconV3AuthoringOptions
): void {
  const directoryIdentity = assertPrivateDirectory(
    transactionDirectory,
    "recovery-transaction-directory"
  );
  const journalPath = join(transactionDirectory, "transaction.json");
  if (!pathEntryExists(journalPath)) {
    throw new Error("authoring-pair-recovery-journal-missing");
  }
  const journal = JSON.parse(
    readFileSync(journalPath, "utf8")
  ) as AuthoringPairTransactionJournal;
  const pairKey = authoringPairKey(options.output, options.summaryJson);
  if (
    journal.schemaVersion !== AUTHORING_PAIR_TRANSACTION_SCHEMA ||
    journal.pairKey !== pairKey ||
    journal.output?.path !== options.output ||
    journal.summary?.path !== options.summaryJson ||
    journal.stagingDatabase !==
      join(transactionDirectory, "database.new.sqlite") ||
    journal.stagingSummary !== join(transactionDirectory, "summary.new.json") ||
    journal.backupDatabase !==
      join(transactionDirectory, "database.previous") ||
    journal.backupSummary !== join(transactionDirectory, "summary.previous")
  ) {
    throw new Error("authoring-pair-recovery-journal-invalid");
  }
  const transaction: AuthoringPairTransaction = {
    directory: transactionDirectory,
    directoryIdentity,
    journalPath,
    journal,
    commitDurable: journal.phase === "committed"
  };
  if (journal.phase !== "committed" && processIsAlive(journal.pid)) {
    throw new Error(`authoring-pair-transaction-in-progress:${journal.pid}`);
  }
  rollbackAuthoringPairTransaction(transaction);
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function persistAuthoringPairJournal(
  transaction: AuthoringPairTransaction
): void {
  assertPrivateTransactionDirectory(transaction);
  const temporary = join(
    transaction.directory,
    `transaction.next-${randomUUID()}`
  );
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(
      descriptor,
      `${JSON.stringify(transaction.journal, null, 2)}\n`,
      "utf8"
    );
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  assertSecureRegularFile(temporary, "transaction-journal-staging");
  renameSync(temporary, transaction.journalPath);
  fsyncDirectory(transaction.directory);
  assertPrivateTransactionDirectory(transaction);
}

function snapshotAuthoringDestination(
  path: string,
  label: string
): AuthoringDestinationSnapshot {
  assertWritableFilePath(path, label);
  if (!pathEntryExists(path)) return { path, existed: false, identity: null };
  return {
    path,
    existed: true,
    identity: authoringFileIdentity(lstatSync(path))
  };
}

function assertDestinationUnchanged(
  snapshot: AuthoringDestinationSnapshot,
  label: string
): void {
  assertWritableFilePath(snapshot.path, label);
  if (!snapshot.existed) {
    if (pathEntryExists(snapshot.path)) {
      throw new Error(
        `authoring-pair-destination-created-during-build:${label}`
      );
    }
    return;
  }
  assertIdentityMatchesSnapshot(
    snapshot.path,
    snapshot,
    `${label}-before-install`
  );
}

function assertIdentityMatchesSnapshot(
  path: string,
  snapshot: AuthoringDestinationSnapshot,
  label: string
): void {
  if (!snapshot.existed || !snapshot.identity) {
    throw new Error(`authoring-pair-missing-destination-snapshot:${label}`);
  }
  const current = assertRegularNonSymlink(path, label);
  if (!sameAuthoringFileIdentity(current, snapshot.identity)) {
    throw new Error(`authoring-pair-destination-identity-drift:${label}`);
  }
}

function writeStagedJson(path: string, value: unknown): AuthoringFileIdentity {
  assertPathAbsent(path, "staging-summary-before-write");
  const descriptor = openSync(path, "wx", 0o600);
  const opened = authoringFileIdentity(fstatSync(descriptor));
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  assertSameFileIdentity(path, opened, "staging-summary-after-write");
  return opened;
}

function fsyncRegularFile(
  path: string,
  identity: AuthoringFileIdentity,
  label: string
): void {
  assertSameFileIdentity(path, identity, `${label}-before-fsync`);
  const descriptor = openSync(path, "r");
  try {
    const opened = authoringFileIdentity(fstatSync(descriptor));
    if (!sameAuthoringFileIdentity(opened, identity)) {
      throw new Error(`authoring-file-descriptor-identity-drift:${label}`);
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  assertSameFileIdentity(path, identity, `${label}-after-fsync`);
}

function sha256FileSyncSecure(
  path: string,
  identity: AuthoringFileIdentity,
  label: string
): string {
  assertSameFileIdentity(path, identity, `${label}-before-hash`);
  const descriptor = openSync(path, "r");
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    const opened = authoringFileIdentity(fstatSync(descriptor));
    if (!sameAuthoringFileIdentity(opened, identity)) {
      throw new Error(`authoring-file-descriptor-identity-drift:${label}`);
    }
    for (;;) {
      const bytes = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytes === 0) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally {
    closeSync(descriptor);
  }
  assertSameFileIdentity(path, identity, `${label}-after-hash`);
  return hash.digest("hex");
}

function assertPrivateTransactionDirectory(
  transaction: AuthoringPairTransaction
): void {
  const current = assertPrivateDirectory(
    transaction.directory,
    "transaction-directory"
  );
  if (!sameAuthoringFileIdentity(current, transaction.directoryIdentity)) {
    throw new Error("authoring-transaction-directory-identity-drift");
  }
}

function assertPrivateDirectory(
  path: string,
  label: string
): AuthoringFileIdentity {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`authoring-private-directory-invalid:${label}`);
  }
  if ((stats.mode & 0o077) !== 0) {
    throw new Error(`authoring-private-directory-permissions:${label}`);
  }
  assertCurrentUserOwns(stats.uid, label);
  return authoringFileIdentity(stats);
}

function assertSecureRegularFile(
  path: string,
  label: string
): AuthoringFileIdentity {
  const identity = assertRegularNonSymlink(path, label);
  if (identity.nlink !== 1) {
    throw new Error(`authoring-secure-file-hardlinked:${label}`);
  }
  assertCurrentUserOwns(identity.uid, label);
  return identity;
}

function assertRegularNonSymlink(
  path: string,
  label: string
): AuthoringFileIdentity {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`authoring-secure-file-not-regular:${label}`);
  }
  return authoringFileIdentity(stats);
}

function assertCurrentUserOwns(uid: number, label: string): void {
  const effectiveUid = process.geteuid?.();
  if (effectiveUid !== undefined && uid !== effectiveUid) {
    throw new Error(`authoring-path-owner-mismatch:${label}`);
  }
}

function assertSameFileIdentity(
  path: string,
  expected: AuthoringFileIdentity,
  label: string
): void {
  const current = assertSecureRegularFile(path, label);
  if (!sameAuthoringFileIdentity(current, expected)) {
    throw new Error(`authoring-file-identity-drift:${label}`);
  }
}

function assertFileInsideTransactionDirectory(
  transaction: AuthoringPairTransaction,
  identity: AuthoringFileIdentity,
  label: string
): void {
  if (identity.dev !== transaction.directoryIdentity.dev) {
    throw new Error(`authoring-staging-file-filesystem-drift:${label}`);
  }
}

function authoringFileIdentity(stats: {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  size: number;
  uid: number;
}): AuthoringFileIdentity {
  return {
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode,
    nlink: stats.nlink,
    size: stats.size,
    uid: stats.uid
  };
}

function sameAuthoringFileIdentity(
  left: AuthoringFileIdentity,
  right: AuthoringFileIdentity
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertPathAbsent(path: string, label: string): void {
  if (pathEntryExists(path)) {
    throw new Error(`authoring-staging-path-not-empty:${label}`);
  }
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function fsyncRenameDirectories(...paths: string[]): void {
  for (const path of new Set(paths.map((value) => resolve(value)))) {
    fsyncDirectory(path);
  }
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      process.platform !== "win32" ||
      (code !== "EINVAL" && code !== "ENOTSUP")
    ) {
      throw error;
    }
  } finally {
    closeSync(descriptor);
  }
}

function assertSafeAuthoringPaths(
  options: BuildLexiconV3AuthoringOptions,
  temporaryOutput: string,
  temporarySummary: string
): void {
  const writes = [
    { label: "output", path: options.output },
    { label: "summaryJson", path: options.summaryJson },
    { label: "temporaryOutput", path: temporaryOutput },
    { label: "temporarySummary", path: temporarySummary }
  ];
  const inputs = [
    { label: "database", path: options.database, directory: false },
    {
      label: "entitiesDatabase",
      path: options.entitiesDatabase,
      directory: false
    },
    {
      label: "hebrewSourcesDirectory",
      path: options.hebrewSourcesDirectory,
      directory: true
    },
    { label: "englishAudit", path: options.englishAudit, directory: false },
    { label: "frenchReview", path: options.frenchReview, directory: false },
    { label: "frenchPackets", path: options.frenchPackets, directory: false },
    {
      label: "frenchPacketSummary",
      path: options.frenchPacketSummary,
      directory: false
    },
    {
      label: "frenchRemediationSummary",
      path: options.frenchRemediationSummary,
      directory: false
    },
    {
      label: "frenchConfiguration",
      path: options.frenchConfiguration,
      directory: false
    },
    {
      label: "frenchCanonicalEntities",
      path: options.frenchCanonicalEntities,
      directory: false
    },
    {
      label: "frenchCanonicalEntryPolicies",
      path: options.frenchCanonicalEntryPolicies,
      directory: false
    },
    {
      label: "frenchEntityMergeAttestation",
      path: options.frenchEntityMergeAttestation,
      directory: false
    },
    {
      label: "frenchEntityGate",
      path: options.frenchEntityGate,
      directory: false
    },
    {
      label: "frenchEntityMentions",
      path: options.frenchEntityMentions,
      directory: false
    },
    {
      label: "frenchEntityMentionResolutionAttestation",
      path: options.frenchEntityMentionResolutionAttestation,
      directory: false
    },
    {
      label: "frenchEntityPackets",
      path: options.frenchEntityPackets,
      directory: false
    },
    { label: "hebrewEnglish", path: options.hebrewEnglish, directory: false },
    {
      label: "hebrewEnglishSummary",
      path: options.hebrewEnglishSummary,
      directory: false
    },
    {
      label: "reviewDecisions",
      path: options.reviewDecisions,
      directory: false
    }
  ].filter(
    (input): input is { label: string; path: string; directory: boolean } =>
      typeof input.path === "string"
  );

  for (let leftIndex = 0; leftIndex < writes.length; leftIndex += 1) {
    const left = writes[leftIndex]!;
    assertWritableFilePath(left.path, left.label);
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < writes.length;
      rightIndex += 1
    ) {
      const right = writes[rightIndex]!;
      if (pathsReferToSameEntry(left.path, right.path)) {
        throw new Error(
          `authoring-write-path-collision:${left.label}:${right.label}`
        );
      }
    }
    for (const input of inputs) {
      const collides = input.directory
        ? pathsOverlapDirectory(left.path, input.path)
        : pathsReferToSameEntry(left.path, input.path);
      if (collides) {
        throw new Error(
          `authoring-write-input-path-collision:${left.label}:${input.label}`
        );
      }
    }
  }
}

function assertWritableFilePath(path: string, label: string): void {
  if (!pathEntryExists(path)) return;
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) {
    throw new Error(`authoring-write-path-is-symlink:${label}`);
  }
  if (stats.isDirectory()) {
    throw new Error(`authoring-write-path-is-directory:${label}`);
  }
  if (!stats.isFile()) {
    throw new Error(`authoring-write-path-is-not-regular:${label}`);
  }
}

function pathsReferToSameEntry(left: string, right: string): boolean {
  if (comparablePath(left) === comparablePath(right)) return true;
  if (!existsSync(left) || !existsSync(right)) return false;
  const leftStats = statSync(left);
  const rightStats = statSync(right);
  return leftStats.dev === rightStats.dev && leftStats.ino === rightStats.ino;
}

function pathsOverlapDirectory(path: string, directory: string): boolean {
  const canonicalPath = comparablePath(path);
  const canonicalDirectory = comparablePath(directory);
  return (
    pathIsInside(canonicalPath, canonicalDirectory) ||
    pathIsInside(canonicalDirectory, canonicalPath)
  );
}

function pathIsInside(path: string, directory: string): boolean {
  const relation = relative(directory, path);
  return (
    relation === "" ||
    (!isAbsolute(relation) &&
      relation !== ".." &&
      !relation.startsWith(`..${sep}`))
  );
}

function comparablePath(path: string): string {
  const resolved = resolve(path);
  if (existsSync(resolved)) return realpathSync(resolved);
  const suffix: string[] = [];
  let ancestor = resolved;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) return resolved;
    suffix.unshift(basename(ancestor));
    ancestor = parent;
  }
  return resolve(realpathSync(ancestor), ...suffix);
}

function assertRequiredFiles(paths: string[]): void {
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(`missing-required-authoring-input:${missing.join(",")}`);
  }
}

function assertFullDatabaseSchema(db: DatabaseSync): void {
  const required = ["StepEntries", "LexiconResources", "DictionaryMeta"];
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  const present = new Set(rows.map((row) => row.name));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length > 0) {
    throw new Error(`missing-full-database-tables:${missing.join(",")}`);
  }
}

function readFullEntries(db: DatabaseSync): FullEntryRow[] {
  const rows = db
    .prepare(
      `SELECT id, language, baseCode, eStrong, dStrong, uStrong, original,
              transliteration, morph, gloss, meaning,
              classicTransliteration, pronunciation
       FROM StepEntries
       ORDER BY id`
    )
    .all() as unknown as FullEntryRow[];
  if (rows.length === 0) throw new Error("empty-full-lexicon-database");
  return rows;
}

function readFullResources(db: DatabaseSync): FullResourceRow[] {
  return db
    .prepare(
      `SELECT id, stepEntryId, source, kind, contentHtml
       FROM LexiconResources
       ORDER BY stepEntryId, id`
    )
    .all() as unknown as FullResourceRow[];
}

function readDatabaseSourceDigests(db: DatabaseSync): Record<string, string> {
  const row = db
    .prepare("SELECT value FROM DictionaryMeta WHERE key = 'sourceDigests'")
    .get() as { value?: string } | undefined;
  if (!row?.value) throw new Error("missing-full-database-source-digests");
  const parsed = JSON.parse(row.value) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

async function readEnglishAudit(
  path: string
): Promise<Map<string, EnglishEvidenceAuditRecord>> {
  const records = new Map<string, EnglishEvidenceAuditRecord>();
  for await (const {
    lineNumber,
    value
  } of readJsonl<EnglishEvidenceAuditRecord>(path)) {
    if (value.schemaVersion !== ENGLISH_EVIDENCE_SCHEMA_VERSION) {
      throw new Error(`invalid-english-audit-schema:${lineNumber}`);
    }
    if (records.has(value.key)) {
      throw new Error(`duplicate-english-audit-entry:${value.key}`);
    }
    if (englishEvidenceRecordDigest(value) !== value.recordDigest) {
      throw new Error(`english-audit-record-digest-mismatch:${value.key}`);
    }
    const exactOccurrenceIssues = validateEnglishExactOccurrenceEvidence(value);
    if (exactOccurrenceIssues.length > 0) {
      throw new Error(
        `invalid-english-audit-exact-occurrences:${value.key}:${exactOccurrenceIssues.join(",")}`
      );
    }
    const alternateAliasIssues =
      validateEnglishAlternateStrongAliasEvidence(value);
    if (alternateAliasIssues.length > 0) {
      throw new Error(
        `invalid-english-audit-alternate-strong-alias:${value.key}:${alternateAliasIssues.join(",")}`
      );
    }
    const reconstructionIssues =
      validateEnglishGreekReconstructionEvidence(value);
    if (reconstructionIssues.length > 0) {
      throw new Error(
        `invalid-english-audit-greek-reconstruction:${value.key}:${reconstructionIssues.join(",")}`
      );
    }
    const semanticGlossIssues = validateEnglishSemanticGlossEvidence(value);
    if (semanticGlossIssues.length > 0) {
      throw new Error(
        `invalid-english-audit-semantic-gloss:${value.key}:${semanticGlossIssues.join(",")}`
      );
    }
    records.set(value.key, value);
  }
  if (records.size === 0) throw new Error("empty-english-audit");
  return records;
}

async function readFrenchPackets(
  path: string,
  audits: Map<string, EnglishEvidenceAuditRecord>
): Promise<Map<string, LexiconV3FrenchPacket>> {
  const packets = new Map<string, LexiconV3FrenchPacket>();
  for await (const { lineNumber, value } of readJsonl<LexiconV3FrenchPacket>(
    path
  )) {
    if (packets.has(value.entryKey)) {
      throw new Error(`duplicate-french-packet:${value.entryKey}`);
    }
    const issues = validateFrenchPacket(value);
    if (issues.length > 0) {
      throw new Error(
        `invalid-french-packet:${lineNumber}:${value.entryKey}:${issues.join(",")}`
      );
    }
    const audit = audits.get(value.entryKey);
    if (!audit) throw new Error(`orphan-french-packet:${value.entryKey}`);
    const expectedIdentity = {
      stepEntryId: audit.stepEntryId,
      language: audit.language,
      eStrong: audit.eStrong,
      dStrong: audit.dStrong,
      uStrong: audit.uStrong,
      original: audit.original,
      transliteration: audit.transliteration,
      morph: audit.morph
    };
    if (stableJson(value.identity) !== stableJson(expectedIdentity)) {
      throw new Error(`french-packet-identity-mismatch:${value.entryKey}`);
    }
    packets.set(value.entryKey, value);
  }
  if (packets.size === 0) throw new Error("empty-french-packets");
  return packets;
}

async function validateFrenchPacketBuildSummary(input: {
  path: string;
  packetsPath: string;
  packetsDigest: string;
  packetCount: number;
  databaseDigest: string;
  englishAuditDigest: string;
}): Promise<FrenchPacketBuildSummary> {
  const summary = JSON.parse(
    readFileSync(input.path, "utf8")
  ) as FrenchPacketBuildSummary;
  if (summary.schemaVersion !== "lexicon-v3-french-packet-build@3") {
    throw new Error("invalid-french-packet-summary-schema");
  }
  if (
    summary.outputDigest !== input.packetsDigest ||
    summary.outputPackets !== input.packetCount
  ) {
    throw new Error("french-packet-summary-output-mismatch");
  }
  if (
    summary.sourceDigests.englishEvidence !== input.englishAuditDigest ||
    summary.sourceDigests.fullDatabase !== input.databaseDigest
  ) {
    throw new Error("french-packet-summary-primary-source-mismatch");
  }
  if (resolve(summary.sourcePaths.output) !== resolve(input.packetsPath)) {
    throw new Error("french-packet-summary-path-mismatch");
  }
  const sourceChecks = [
    [summary.sourcePaths.input, summary.sourceDigests.englishEvidence],
    [summary.sourcePaths.database, summary.sourceDigests.fullDatabase],
    [summary.sourcePaths.legacyDatabase, summary.sourceDigests.legacyDatabase],
    [summary.sourcePaths.sg1910, summary.sourceDigests.Sg1910],
    [summary.sourcePaths.darby, summary.sourceDigests.Darby],
    [summary.sourcePaths.darbyR, summary.sourceDigests.DarbyR],
    [summary.sourcePaths.authoring, summary.sourceDigests.englishAuthoring]
  ];
  assertRequiredFiles(sourceChecks.map(([path]) => resolve(path)));
  const currentDigests = await Promise.all(
    sourceChecks.map(([path]) => sha256File(resolve(path)))
  );
  for (let index = 0; index < sourceChecks.length; index += 1) {
    if (currentDigests[index] !== sourceChecks[index]?.[1]) {
      throw new Error(`french-packet-summary-source-digest-mismatch:${index}`);
    }
  }
  if (
    resolve(summary.englishAuthoring.path) !==
      resolve(summary.sourcePaths.authoring) ||
    summary.englishAuthoring.digest !== summary.sourceDigests.englishAuthoring
  ) {
    throw new Error("french-packet-summary-authoring-attestation-mismatch");
  }
  assertFrenchPacketSummaryRelease(summary);
  return summary;
}

function assertFrenchPacketSummaryRelease(
  summary: FrenchPacketBuildSummary
): void {
  const attestation = summary.englishRelease;
  if (
    !attestation.releaseKey?.trim() ||
    !Number.isInteger(attestation.releaseId) ||
    attestation.releaseId < 1 ||
    attestation.state !== "promoted" ||
    !isSha256Digest(attestation.snapshotFingerprint) ||
    !isSha256Digest(attestation.codeFingerprint) ||
    !isSha256Digest(attestation.sourceFingerprint) ||
    !isSha256Digest(attestation.sourceLogicalFingerprint) ||
    !attestation.policyVersion?.trim() ||
    !Number.isInteger(attestation.expectedEntryCount) ||
    attestation.expectedEntryCount < 1 ||
    attestation.fieldCount !== attestation.expectedEntryCount * 2
  ) {
    throw new Error("french-packet-summary-release-attestation-invalid");
  }
  const database = new DatabaseSync(summary.englishAuthoring.path, {
    readOnly: true
  });
  try {
    const release = database
      .prepare(
        `SELECT id, state, expectedEntryCount, sourceFingerprint,
                codeFingerprint, policyVersion, manifestJson
         FROM LexiconReleases WHERE releaseKey = ?`
      )
      .get(attestation.releaseKey) as
      | {
          id: number;
          state: string;
          expectedEntryCount: number;
          sourceFingerprint: string;
          codeFingerprint: string;
          policyVersion: string;
          manifestJson: string;
        }
      | undefined;
    if (!release) {
      throw new Error("french-packet-summary-release-missing");
    }
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(release.manifestJson) as Record<string, unknown>;
    } catch {
      throw new Error("french-packet-summary-release-manifest-invalid");
    }
    if (
      release.id !== attestation.releaseId ||
      release.state !== "promoted" ||
      release.expectedEntryCount !== attestation.expectedEntryCount ||
      release.sourceFingerprint !== attestation.sourceFingerprint ||
      release.codeFingerprint !== attestation.codeFingerprint ||
      release.policyVersion !== attestation.policyVersion ||
      manifest.releaseProfile !== "core-en" ||
      manifest.snapshotFingerprint !== attestation.snapshotFingerprint ||
      manifest.sourceLogicalFingerprint !==
        attestation.sourceLogicalFingerprint ||
      manifest.fieldCount !== attestation.fieldCount
    ) {
      throw new Error("french-packet-summary-release-mismatch");
    }
  } finally {
    database.close();
  }
}

function assertFrenchPacketsMatchReviewedEnglish(input: {
  packets: Map<string, LexiconV3FrenchPacket>;
  summary: FrenchPacketBuildSummary | null;
  snapshot: LexiconV3AuthoringEnglishSnapshot;
  englishReviewDecisionsFingerprint: string;
  sourceLogicalFingerprint: string;
}): void {
  const summary = input.summary;
  if (!summary) throw new Error("french-packets-require-release-summary");
  const attestation = summary.englishRelease;
  const mismatches = [
    [
      "source-logical",
      attestation.sourceLogicalFingerprint,
      input.sourceLogicalFingerprint
    ]
  ].filter(([, actual, expected]) => actual !== expected);
  if (mismatches.length > 0) {
    throw new Error(
      `french-packet-release-authoring-mismatch:${mismatches
        .map(([name]) => name)
        .join(",")}`
    );
  }
  const source = new DatabaseSync(summary.englishAuthoring.path, {
    readOnly: true
  });
  try {
    const releasedField = source.prepare(
      `SELECT rf.fieldVersionId, fv.contentHash
       FROM LexiconReleaseFields rf
       JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
       WHERE rf.releaseId = ? AND rf.entryKey = ? AND rf.locale = 'en'
         AND rf.field = ?`
    );
    for (const [entryKey, packet] of input.packets) {
      if (
        packet.englishRelease.releaseKey !== attestation.releaseKey ||
        packet.englishRelease.releaseSnapshotFingerprint !==
          attestation.snapshotFingerprint
      ) {
        throw new Error(`french-packet-release-mismatch:${entryKey}`);
      }
      const expected = input.snapshot.records.get(entryKey);
      if (!expected)
        throw new Error(`orphan-released-french-packet:${entryKey}`);
      if (
        packet.english.gloss !== expected.gloss ||
        packet.english.meaning !== expected.meaning ||
        packet.english.meaningHtml !== expected.meaningHtml
      ) {
        throw new Error(`french-packet-english-mismatch:${entryKey}`);
      }
      for (const field of ["gloss", "meaning"] as const) {
        const parent = packet.englishRelease.parents[field];
        const row = releasedField.get(
          attestation.releaseId,
          entryKey,
          field
        ) as { fieldVersionId: number; contentHash: string } | undefined;
        if (
          !row ||
          row.fieldVersionId !== parent.fieldVersionId ||
          row.contentHash !== parent.contentHash
        ) {
          throw new Error(
            `french-packet-release-parent-mismatch:${entryKey}:${field}`
          );
        }
      }
    }
  } finally {
    source.close();
  }
}

/**
 * A French run may outlive code-only changes to the wider Lexicon V3
 * pipeline. In that case the pinned English release remains a historical
 * parent, not the current on-disk release. Accept that parent only when the
 * current projector reconstructs the exact same core-English release
 * snapshot. The snapshot binds identities, rights, fields, states,
 * confidence, methods, generators, review/issue trails and parent hashes.
 */
export function assertFrozenCoreEnglishReleaseContinuity(input: {
  plan: LexiconV3ReleasePlan;
  summary: FrenchPacketBuildSummary | null;
}): void {
  const summary = input.summary;
  if (!summary) throw new Error("french-packets-require-release-summary");
  const attestation = summary.englishRelease;
  if (input.plan.errors.length > 0) {
    throw new Error(
      `french-packet-core-en-replay-invalid:${input.plan.errors.join(",")}`
    );
  }
  const mismatches: string[] = [];
  if (input.plan.profile !== "core-en") mismatches.push("profile");
  if (attestation.policyVersion !== LEXICON_V3_CORE_EN_RELEASE_POLICY_VERSION) {
    mismatches.push("policy");
  }
  if (input.plan.expectedEntryCount !== attestation.expectedEntryCount) {
    mismatches.push("entry-count");
  }
  if (input.plan.fields.length !== attestation.fieldCount) {
    mismatches.push("field-count");
  }
  if (input.plan.carriers.length !== 0) mismatches.push("carriers");
  if (
    input.plan.sourceLogicalFingerprint !== attestation.sourceLogicalFingerprint
  ) {
    mismatches.push("source-logical");
  }
  if (input.plan.snapshotFingerprint !== attestation.snapshotFingerprint) {
    mismatches.push("snapshot");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `french-packet-release-authoring-mismatch:${mismatches.join(",")}`
    );
  }
}

function buildReviewedEnglishEntryStates(
  db: DatabaseSync,
  audits: Map<string, EnglishEvidenceAuditRecord>,
  records: Map<string, LexiconV3AuthoringEnglishBundle>,
  entryKeys: Iterable<string>
): Map<string, EntryBuildState> {
  const rows = db
    .prepare(
      `SELECT id, entryKey, field, state
       FROM LexiconFieldVersions
       WHERE locale = 'en' AND field IN ('gloss', 'meaning')
         AND state <> 'superseded'
       ORDER BY entryKey, field, id`
    )
    .all() as unknown as Array<{
    id: number;
    entryKey: string;
    field: "gloss" | "meaning";
    state: string;
  }>;
  const bySlot = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.entryKey}\u0000${row.field}`;
    const values = bySlot.get(key) ?? [];
    values.push(row);
    bySlot.set(key, values);
  }
  const states = new Map<string, EntryBuildState>();
  for (const entryKey of entryKeys) {
    const audit = audits.get(entryKey);
    if (!audit) throw new Error(`missing-audit-for-french:${entryKey}`);
    const english = records.get(entryKey);
    if (!english) throw new Error(`missing-effective-english:${entryKey}`);
    const gloss = bySlot.get(`${entryKey}\u0000gloss`) ?? [];
    const meaning = bySlot.get(`${entryKey}\u0000meaning`) ?? [];
    if (gloss.length !== 1 || meaning.length !== 1) {
      throw new Error(`ambiguous-effective-english-parent:${entryKey}`);
    }
    states.set(entryKey, {
      audit,
      englishBundleHash: english.contentHash,
      englishStatus: english.status,
      glossFieldId: gloss[0]!.id,
      meaningFieldId: meaning[0]!.id,
      glossState: gloss[0]!.state,
      meaningState: meaning[0]!.state
    });
  }
  return states;
}

async function readFrenchReview(
  path: string,
  audits: Map<string, EnglishEvidenceAuditRecord>,
  packets: Map<string, LexiconV3FrenchPacket>,
  packetsPath: string,
  remediationSummaryPath?: string
): Promise<Map<string, FrenchReviewRecord>> {
  const records = new Map<string, FrenchReviewRecord>();
  for await (const { lineNumber, value } of readJsonl<FrenchReviewRecord>(
    path
  )) {
    const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
    if (schemaVersion === "lexicon-v3-french-review@3") {
      throw new Error(
        `legacy-french-internal-review-requires-reassembly:${lineNumber}`
      );
    }
    if (
      schemaVersion !== "lexicon-v3-french-review@2" &&
      schemaVersion !== "lexicon-v3-french-review@4"
    ) {
      throw new Error(`invalid-french-review-schema:${lineNumber}`);
    }
    if (!/^[a-f0-9]{64}$/u.test(value.generationConfigHash)) {
      throw new Error(`invalid-french-review-config-hash:${lineNumber}`);
    }
    if (records.has(value.entryKey)) {
      throw new Error(`duplicate-french-review-entry:${value.entryKey}`);
    }
    const audit = audits.get(value.entryKey);
    if (!audit) throw new Error(`orphan-french-review:${value.entryKey}`);
    const packet = packets.get(value.entryKey);
    if (!packet)
      throw new Error(`missing-french-review-packet:${value.entryKey}`);
    if (value.packetHash !== packet.packetHash) {
      throw new Error(`french-review-packet-hash-mismatch:${value.entryKey}`);
    }
    if (value.schemaVersion === "lexicon-v3-french-review@2") {
      const content = Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "artifactHash")
      );
      if (sha256(JSON.stringify(content)) !== value.artifactHash) {
        throw new Error(
          `french-review-artifact-hash-mismatch:${value.entryKey}`
        );
      }
    }
    if (value.englishHash !== packet.english.contentHash) {
      throw new Error(`french-review-english-hash-mismatch:${value.entryKey}`);
    }
    const proposal = value.arbiter?.proposal;
    if (value.status === "human_validated") {
      throw new Error(
        `model-artifact-cannot-be-human-validated:${value.entryKey}`
      );
    }
    if (
      proposal &&
      (proposal.entryKey !== value.entryKey ||
        proposal.derivedFromEnglishHash !== value.englishHash)
    ) {
      throw new Error(
        `french-review-proposal-derivation-mismatch:${value.entryKey}`
      );
    }
    if (value.schemaVersion === "lexicon-v3-french-review@4") {
      assertFrenchInternalReviewRecord({ record: value, packet });
    } else {
      validateFrenchReviewModelsAndProposals(value, packet);
    }
    if (value.status === "auto_validated" && !proposal) {
      throw new Error(
        `french-review-missing-arbiter-proposal:${value.entryKey}`
      );
    }
    if (proposal) {
      const htmlIssues = validateLexiconHtmlPair(
        proposal.meaningFr,
        proposal.meaningHtmlFr
      ).filter((issue) =>
        ["unsafe-html-tag", "unsafe-html-attribute"].includes(issue.code)
      );
      if (htmlIssues.length > 0) {
        throw new Error(
          `unsafe-french-review-html:${value.entryKey}:${htmlIssues.map((issue) => issue.code).join(",")}`
        );
      }
    }
    if (value.status === "auto_validated") {
      if (value.schemaVersion === "lexicon-v3-french-review@4") {
        const evaluation = assertFrenchInternalReviewRecord({
          record: value,
          packet
        });
        if (!evaluation.autoEligible) {
          throw new Error(
            `unsafe-auto-validated-french-review:${value.entryKey}`
          );
        }
      } else {
        assertVerifiedModelExecution(value);
        assertAutoValidatedFrenchReview(value, packet);
      }
    }
    assertFrenchReviewCarriers(value, packet);
    records.set(value.entryKey, value);
  }
  const generationConfigs = new Set(
    [...records.values()].map((record) => record.generationConfigHash)
  );
  if (generationConfigs.size > 1) {
    throw new Error("french-review-generation-config-drift");
  }
  assertFrenchExecutionAttestationSet(
    records,
    path,
    packets,
    packetsPath,
    remediationSummaryPath
  );
  return records;
}

async function assertFrenchInternalEntityArtifactBoundary(input: {
  options: BuildLexiconV3AuthoringOptions;
  audits: Map<string, EnglishEvidenceAuditRecord>;
  selectedPackets: Map<string, LexiconV3FrenchPacket>;
  reviews: Map<string, FrenchReviewRecord>;
}): Promise<void> {
  const paths = requiredFrenchInternalEntityArtifactPaths(input.options);
  assertRequiredFiles(Object.values(paths));

  const hashEntries = Object.entries(paths) as Array<
    [keyof typeof paths, string]
  >;
  const before = Object.fromEntries(
    await Promise.all(
      hashEntries.map(async ([key, path]) => [key, await sha256File(path)])
    )
  ) as Record<keyof typeof paths, string>;

  const configuration = readFrenchInternalAssemblyConfiguration(
    paths.configuration
  );
  const canonicalEntities =
    await readFrenchEntityArtifactJsonl<FrenchCanonicalEntityRecord>(
      paths.canonicalEntities
    );
  const canonicalEntryPolicies =
    await readFrenchEntityArtifactJsonl<FrenchCanonicalEntryNamePolicy>(
      paths.canonicalEntryPolicies
    );
  const entityGate =
    readFrenchEntityArtifactJson<FrenchEntityCanonicalizationGateResult>(
      paths.entityGate
    );
  const entityMentions =
    readFrenchEntityArtifactJson<FrenchEntityMentionsArtifact>(
      paths.entityMentions
    );
  const entityMentionResolutionAttestation =
    readFrenchEntityArtifactJson<FrenchEntityMentionResolutionAttestation>(
      paths.entityMentionResolutionAttestation
    );
  const entityPackets = await readFrenchPackets(
    paths.entityPackets,
    input.audits
  );

  const mergeReplay = assertFrenchEntityMergeAttestationAtPath({
    attestationPath: paths.entityMergeAttestation,
    canonicalEntitiesPath: paths.canonicalEntities,
    canonicalEntryPoliciesPath: paths.canonicalEntryPolicies,
    expectedReleaseKey: input.selectedPackets.values().next().value
      ?.englishRelease.releaseKey
  });

  const after = Object.fromEntries(
    await Promise.all(
      hashEntries.map(async ([key, path]) => [key, await sha256File(path)])
    )
  ) as Record<keyof typeof paths, string>;
  for (const [key] of hashEntries) {
    if (before[key] !== after[key]) {
      throw new Error(`french-internal-entity-artifact-input-drift:${key}`);
    }
  }

  assertFrenchInternalEntityArtifactHashes(configuration, before);
  for (const [entryKey, packet] of input.selectedPackets) {
    if (entityPackets.get(entryKey)?.packetHash !== packet.packetHash) {
      throw new Error(
        `french-internal-entity-packet-selection-drift:${entryKey}`
      );
    }
  }
  assertFrenchEntityPipelineArtifacts({
    entityGate,
    entityMentions,
    canonicalEntities,
    canonicalEntryPolicies,
    packets: [...entityPackets.values()],
    quarantinedEntryKeys: frenchEntityQuarantinedEntryKeysFromMerge({
      plan: mergeReplay.plan,
      merged: mergeReplay.merged
    }),
    mentionResolutionAttestation: entityMentionResolutionAttestation,
    allowConfigurationPinnedResolution: true
  });
  for (const review of input.reviews.values()) {
    if (
      review.schemaVersion === "lexicon-v3-french-review@4" &&
      review.generationConfigHash !== configuration.generationConfigHash
    ) {
      throw new Error(
        `french-internal-entity-configuration-lineage-drift:${review.entryKey}`
      );
    }
  }
}

function requiredFrenchInternalEntityArtifactPaths(
  options: BuildLexiconV3AuthoringOptions
): {
  configuration: string;
  canonicalEntities: string;
  canonicalEntryPolicies: string;
  entityMergeAttestation: string;
  entityGate: string;
  entityMentions: string;
  entityMentionResolutionAttestation: string;
  entityPackets: string;
} {
  const values = {
    configuration: options.frenchConfiguration,
    canonicalEntities: options.frenchCanonicalEntities,
    canonicalEntryPolicies: options.frenchCanonicalEntryPolicies,
    entityMergeAttestation: options.frenchEntityMergeAttestation,
    entityGate: options.frenchEntityGate,
    entityMentions: options.frenchEntityMentions,
    entityMentionResolutionAttestation:
      options.frenchEntityMentionResolutionAttestation,
    entityPackets: options.frenchEntityPackets
  };
  for (const [key, value] of Object.entries(values)) {
    if (!value) {
      throw new Error(`french-internal-entity-artifact-path-required:${key}`);
    }
  }
  return values as Record<keyof typeof values, string>;
}

function assertFrenchInternalEntityArtifactHashes(
  configuration: FrenchInternalAssemblyConfigurationFile,
  hashes: {
    canonicalEntities: string;
    canonicalEntryPolicies: string;
    entityMergeAttestation: string;
    entityGate: string;
    entityMentions: string;
  }
): void {
  const expected = configuration.configuration;
  const actual = {
    canonicalEntitiesHash: hashes.canonicalEntities,
    canonicalEntryPoliciesHash: hashes.canonicalEntryPolicies,
    entityMergeAttestationHash: hashes.entityMergeAttestation,
    entityGateHash: hashes.entityGate,
    entityMentionsHash: hashes.entityMentions
  };
  for (const [key, hash] of Object.entries(actual) as Array<
    [keyof typeof actual, string]
  >) {
    if (expected[key] !== hash) {
      throw new Error(`french-internal-entity-artifact-drift:${key}`);
    }
  }
}

async function readFrenchEntityArtifactJsonl<T>(path: string): Promise<T[]> {
  const records: T[] = [];
  for await (const { value } of readJsonl<T>(path)) records.push(value);
  return records;
}

function readFrenchEntityArtifactJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(`invalid-french-internal-entity-artifact-json:${path}`);
  }
}

function assertFrenchExecutionAttestationSet(
  records: Map<string, FrenchReviewRecord>,
  reviewsPath: string,
  packets: Map<string, LexiconV3FrenchPacket>,
  packetsPath: string,
  remediationSummaryPath?: string
): void {
  const internal = [...records.values()].filter(
    (record): record is FrenchInternalReviewRecord =>
      record.schemaVersion === "lexicon-v3-french-review@4"
  );
  if (internal.length === 0) return;
  if (internal.length !== records.size) {
    throw new Error("mixed-french-review-execution-contracts");
  }
  assertFrenchInternalPublicationContract({
    finalReviewsPath: reviewsPath,
    finalReviews: internal,
    packetsPath,
    packets: [...packets.values()],
    remediationSummaryPath
  });
}

function assertVerifiedModelExecution(review: FrenchGatewayReviewRecord): void {
  const proofs = review.modelProofs;
  if (!proofs) {
    throw new Error(`missing-model-execution-proof:${review.entryKey}`);
  }
  for (const role of ["proposerA", "proposerB", "arbiter"] as const) {
    const proof = proofs[role];
    if (
      !proof.verified ||
      !proof.actualModel ||
      !proof.provider ||
      !proof.identity ||
      proof.identity !==
        composeFrenchModelIdentity(proof.provider, proof.actualModel) ||
      normalizeModelIdentity(proof.identity) !==
        normalizeModelIdentity(review.models[role])
    ) {
      throw new Error(`unverified-model-execution:${review.entryKey}:${role}`);
    }
  }
}

function assertAutoValidatedFrenchReview(
  review: FrenchGatewayReviewRecord,
  packet: LexiconV3FrenchPacket
): void {
  const proposalA = review.proposalA;
  const proposalB = review.proposalB;
  const arbiter = review.arbiter;
  if (!proposalA || !proposalB || !arbiter) {
    throw new Error(`unsafe-auto-validated-french-review:${review.entryKey}`);
  }
  const validations = [proposalA, proposalB, arbiter.proposal].map((proposal) =>
    validateFrenchProposal(proposal, frenchValidationContext(packet))
  );
  const eligibility = evaluateFrenchAutoEligibility({
    proposalA,
    proposalB,
    arbiterProposal: arbiter.proposal,
    validationA: validations[0]!,
    validationB: validations[1]!,
    arbiterValidation: validations[2]!,
    models: review.models,
    modelProofs: review.modelProofs!,
    arbiterVerdict: arbiter.verdict,
    arbiterReasons: arbiter.reasons,
    englishStatus: packet.english.status
  });
  if (!eligibility.eligible) {
    throw new Error(`unsafe-auto-validated-french-review:${review.entryKey}`);
  }
}

function validateFrenchReviewModelsAndProposals(
  review: FrenchGatewayReviewRecord,
  packet: LexiconV3FrenchPacket
): void {
  const pairs: Array<{
    label: string;
    proposal: FrenchLexiconProposal | undefined;
    validation: FrenchValidationResult | undefined;
    declaredModel: string;
  }> = [
    {
      label: "proposal-a",
      proposal: review.proposalA,
      validation: review.validationA,
      declaredModel: review.models.proposerA
    },
    {
      label: "proposal-b",
      proposal: review.proposalB,
      validation: review.validationB,
      declaredModel: review.models.proposerB
    },
    {
      label: "arbiter",
      proposal: review.arbiter?.proposal,
      validation: review.arbiter?.validation,
      declaredModel: review.models.arbiter
    }
  ];
  for (const pair of pairs) {
    if (Boolean(pair.proposal) !== Boolean(pair.validation)) {
      throw new Error(
        `french-review-proposal-validation-pair-mismatch:${review.entryKey}:${pair.label}`
      );
    }
    if (!pair.proposal || !pair.validation) continue;
    if (
      pair.proposal.entryKey !== review.entryKey ||
      pair.proposal.derivedFromEnglishHash !== review.englishHash
    ) {
      throw new Error(
        `french-review-proposal-derivation-mismatch:${review.entryKey}:${pair.label}`
      );
    }
    if (
      normalizeModelIdentity(pair.proposal.model) !==
      normalizeModelIdentity(pair.declaredModel)
    ) {
      throw new Error(
        `french-review-model-identity-mismatch:${review.entryKey}:${pair.label}`
      );
    }
    const recomputed = validateFrenchProposal(
      pair.proposal,
      frenchValidationContext(packet)
    );
    if (stableJson(recomputed) !== stableJson(pair.validation)) {
      throw new Error(
        `french-review-validation-mismatch:${review.entryKey}:${pair.label}`
      );
    }
  }
}

function assertFrenchReviewCarriers(
  review: FrenchReviewRecord,
  packet: LexiconV3FrenchPacket
): void {
  if (review.schemaVersion === "lexicon-v3-french-review@4") {
    const evaluation = assertFrenchInternalReviewRecord({
      record: review,
      packet
    });
    if (
      stableJson(review.carrierTerms) !== stableJson(evaluation.carrierTerms)
    ) {
      throw new Error(`french-review-carrier-mismatch:${review.entryKey}`);
    }
    return;
  }
  const expected =
    review.proposalA && review.proposalB && review.arbiter?.proposal
      ? buildConsensusCarrierTerms(
          review.proposalA,
          review.proposalB,
          review.arbiter.proposal,
          frenchValidationContext(packet)
        )
      : [];
  if (stableJson(review.carrierTerms) !== stableJson(expected)) {
    throw new Error(`french-review-carrier-mismatch:${review.entryKey}`);
  }
}

function frenchReviewGenerator(review: FrenchReviewRecord): string {
  return review.schemaVersion === "lexicon-v3-french-review@4"
    ? FRENCH_INTERNAL_REVIEW_POLICY_VERSION
    : review.models.arbiter || BUILDER_GENERATOR;
}

function frenchReviewWitnessFamily(review: FrenchReviewRecord): string {
  return review.schemaVersion === "lexicon-v3-french-review@4"
    ? "lexicon-v3-french-internal-review"
    : "lexicon-v3-french-review";
}

function frenchReviewEvidenceProvenance(
  review: FrenchReviewRecord
): Record<string, unknown> {
  if (review.schemaVersion === "lexicon-v3-french-review@2") {
    return {
      reviewSchemaVersion: review.schemaVersion,
      models: review.models
    };
  }
  return {
    reviewSchemaVersion: review.schemaVersion,
    reviewMode: review.reviewMode,
    policyVersion: review.policyVersion,
    generationConfigHash: review.generationConfigHash,
    executionAttestationHash:
      review.executionAttestation?.attestationHash ?? null,
    executionReceiptsDigest:
      review.executionAttestation?.executionReceiptsDigest ?? null,
    adjudicationSummaryHash:
      review.executionAttestation?.adjudicationSummaryHash ?? null,
    executionReceiptHashes: Object.fromEntries(
      (["proposerA", "proposerB", "arbiter", "auditor"] as const).map(
        (role) => [
          role,
          review.executionAttestation?.roleReceipts[role].receiptHash ?? null
        ]
      )
    ),
    siblingConsistencyProofHash: review.siblingConsistency?.proofHash ?? null,
    agentProofHashes: Object.fromEntries(
      (["proposerA", "proposerB", "arbiter", "auditor"] as const).map(
        (role) => [role, review.agentProofs?.[role]?.proofHash ?? null]
      )
    )
  };
}

function frenchValidationContext(
  packet: LexiconV3FrenchPacket
): Parameters<typeof validateFrenchProposal>[1] {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    legacyGloss: packet.evidence.legacy?.gloss,
    legacyMeaning: packet.evidence.legacy?.meaning,
    concordanceForms: packet.evidence.concordanceForms
  };
}

function normalizeModelIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function validateEnglishAudit(input: {
  entries: FullEntryRow[];
  audits: Map<string, EnglishEvidenceAuditRecord>;
  databaseDigest: string;
  databaseSourceDigests: Record<string, string>;
}): void {
  if (input.audits.size !== input.entries.length) {
    throw new Error(
      `english-audit-coverage-mismatch:${input.audits.size}:${input.entries.length}`
    );
  }
  const sourceKeys = new Set<string>();
  for (const entry of input.entries) {
    const identity = buildLexiconEntryIdentity({
      language: normalizeLexiconLanguage(entry.language),
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong
    });
    if (sourceKeys.has(identity.entryKey)) {
      throw new Error(`duplicate-full-database-entry-key:${identity.entryKey}`);
    }
    sourceKeys.add(identity.entryKey);
    const audit = input.audits.get(identity.entryKey);
    if (!audit)
      throw new Error(`missing-english-audit-entry:${identity.entryKey}`);
    const auditedFields = validateEnglishAuditFieldRepairValues(entry, audit);
    const sourceIdentity = {
      stepEntryId: entry.id,
      language: normalizeLexiconLanguage(entry.language),
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: audit.reconstruction ? entry.morph : auditedFields.morph,
      gloss: audit.reconstruction ? entry.gloss : auditedFields.gloss,
      meaning: audit.reconstruction ? entry.meaning : auditedFields.meaning,
      ...(audit.reconstruction
        ? {
            classicTransliteration: entry.classicTransliteration,
            pronunciation: entry.pronunciation
          }
        : {})
    };
    const auditIdentity = audit.reconstruction
      ? {
          stepEntryId: audit.stepEntryId,
          ...audit.reconstruction.rawEntry
        }
      : {
          stepEntryId: audit.stepEntryId,
          language: audit.language,
          eStrong: audit.eStrong,
          dStrong: audit.dStrong,
          uStrong: audit.uStrong,
          original: audit.original,
          transliteration: audit.transliteration,
          morph: audit.morph,
          gloss: audit.gloss,
          meaning: audit.meaning
        };
    if (stableJson(sourceIdentity) !== stableJson(auditIdentity)) {
      throw new Error(`english-audit-full-entry-mismatch:${identity.entryKey}`);
    }
    if (audit.sourceDigests.database !== input.databaseDigest) {
      throw new Error(
        `english-audit-database-digest-mismatch:${identity.entryKey}`
      );
    }
  }

  const digests = firstAudit(input.audits).sourceDigests;
  for (const audit of input.audits.values()) {
    if (stableJson(audit.sourceDigests) !== stableJson(digests)) {
      throw new Error(`english-audit-source-digests-drift:${audit.key}`);
    }
  }
  for (const [metadataKey, auditKey] of [
    ["TBESG.txt", "TBESG"],
    ["TBESH.txt", "TBESH"],
    ["TFLSJ.txt", "TFLSJ"]
  ] as const) {
    if (input.databaseSourceDigests[metadataKey] !== digests[auditKey]) {
      throw new Error(`english-audit-source-digest-mismatch:${metadataKey}`);
    }
  }
}

export function validateEnglishAuditFieldRepairs(
  entry: FullEntryRow,
  audit: EnglishEvidenceAuditRecord
): string {
  return validateEnglishAuditFieldRepairValues(entry, audit).gloss;
}

export function validateEnglishAuditFieldRepairValues(
  entry: FullEntryRow,
  audit: EnglishEvidenceAuditRecord
): Pick<EnglishExactRepairEntry, "gloss" | "meaning" | "morph"> {
  const repairs = audit.evidence.fieldRepairs ?? [];
  if (repairs.length === 0) {
    return { gloss: entry.gloss, meaning: entry.meaning, morph: entry.morph };
  }
  const exactRepairs = repairs.filter(
    (repair): repair is EnglishExactFieldRepairEvidence =>
      "schemaVersion" in repair
  );
  if (exactRepairs.length > 0) {
    if (exactRepairs.length !== repairs.length) {
      throw new Error(`english-audit-field-repair-ambiguous:${audit.key}`);
    }
    return replayExactEnglishAuditFieldRepairs(entry, audit, exactRepairs);
  }
  if (repairs.length !== 1) {
    throw new Error(`english-audit-field-repair-ambiguous:${audit.key}`);
  }
  const repair = repairs[0]!;
  if (
    repair.field !== "gloss" ||
    repair.method !== "exact-tbesg-definition-extraction"
  ) {
    throw new Error(
      `english-audit-field-repair-unsupported:${audit.key}:${repair.field}`
    );
  }
  assertEnglishGlossRepairProof(entry, audit, repair);
  return {
    gloss: repair.repairedValue,
    meaning: entry.meaning,
    morph: entry.morph
  };
}

function replayExactEnglishAuditFieldRepairs(
  entry: FullEntryRow,
  audit: EnglishEvidenceAuditRecord,
  repairs: readonly EnglishExactFieldRepairEvidence[]
): Pick<EnglishExactRepairEntry, "gloss" | "meaning" | "morph"> {
  const sourceEntry: EnglishExactRepairEntry = {
    language: normalizeLexiconLanguage(entry.language),
    eStrong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong,
    original: entry.original,
    transliteration: entry.transliteration,
    morph: entry.morph,
    gloss: entry.gloss,
    meaning: entry.meaning
  };
  let replay: ReturnType<typeof applyEnglishExactRepairs>;
  try {
    replay = applyEnglishExactRepairs(sourceEntry, {
      databaseDigest: audit.sourceDigests.database,
      sourceDigests: {
        TBESG: audit.sourceDigests.TBESG,
        TBESH: audit.sourceDigests.TBESH,
        TIPNR: audit.sourceDigests.greekReconstruction?.tipnrPeople
      }
    });
  } catch {
    throw new Error(`english-audit-field-repair-proof-invalid:${audit.key}`);
  }
  const valid = Boolean(
    replay &&
    stableJson(replay.repairs) === stableJson(repairs) &&
    replay.entry.gloss === audit.gloss &&
    replay.entry.meaning === audit.meaning &&
    replay.entry.morph === audit.morph &&
    repairs.every(
      (repair) =>
        validateEnglishExactFieldRepairEvidence({
          sourceEntry,
          repairedEntry: replay!.entry,
          repair,
          context: {
            databaseDigest: audit.sourceDigests.database,
            sourceDigests: {
              TBESG: audit.sourceDigests.TBESG,
              TBESH: audit.sourceDigests.TBESH,
              TIPNR: audit.sourceDigests.greekReconstruction?.tipnrPeople
            }
          }
        }).length === 0
    ) &&
    audit.decision.reasonCodes.includes(
      "curated-auto-validated-exact-source-field-repair"
    )
  );
  if (!valid || !replay) {
    throw new Error(`english-audit-field-repair-proof-invalid:${audit.key}`);
  }
  return {
    gloss: replay.entry.gloss,
    meaning: replay.entry.meaning,
    morph: replay.entry.morph
  };
}

function assertEnglishGlossRepairProof(
  entry: FullEntryRow,
  audit: EnglishEvidenceAuditRecord,
  repair: Extract<
    EnglishFieldRepairEvidence,
    { method: "exact-tbesg-definition-extraction" }
  >
): void {
  const rule = CURATED_GREEK_ENGLISH_REPAIR_RULES.get(audit.key);
  const proof = audit.decision.curatedRuleProof;
  const sourceRecordDigest = sha256(
    stableJson({
      language: normalizeLexiconLanguage(entry.language),
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph,
      gloss: entry.gloss,
      meaning: entry.meaning
    })
  );
  const sourceMeaningDigest = sha256(entry.meaning);
  const ruleDigest = rule ? sha256(stableJson(rule)) : null;
  const repairWithoutDigest = {
    field: repair.field,
    sourceValue: repair.sourceValue,
    repairedValue: repair.repairedValue,
    method: repair.method,
    ruleId: repair.ruleId,
    ruleDigest: repair.ruleDigest,
    sourceRecordDigest: repair.sourceRecordDigest,
    sourceMeaningDigest: repair.sourceMeaningDigest
  };
  const proofWithoutDigest = proof
    ? {
        ruleId: proof.ruleId,
        action: proof.action,
        ruleDigest: proof.ruleDigest,
        sourceRecordDigest: proof.sourceRecordDigest,
        sourceMeaningDigest: proof.sourceMeaningDigest,
        facts: proof.facts
      }
    : null;
  const valid = Boolean(
    audit.language === "greek" &&
    rule?.action === "extract_gloss_from_exact_brief_definition" &&
    rule.repairedGloss &&
    repair.method === "exact-tbesg-definition-extraction" &&
    repair.sourceValue === entry.gloss &&
    repair.repairedValue === audit.gloss &&
    repair.repairedValue === rule.repairedGloss &&
    repair.ruleId === rule.ruleId &&
    repair.ruleDigest === ruleDigest &&
    repair.sourceRecordDigest === sourceRecordDigest &&
    repair.sourceRecordDigest === rule.expectedSourceRecordDigest &&
    repair.sourceMeaningDigest === sourceMeaningDigest &&
    repair.sourceMeaningDigest === rule.expectedMeaningDigest &&
    repair.repairDigest === sha256(stableJson(repairWithoutDigest)) &&
    proof &&
    proof.ruleId === rule.ruleId &&
    proof.action === rule.action &&
    proof.ruleDigest === ruleDigest &&
    proof.sourceRecordDigest === sourceRecordDigest &&
    proof.sourceMeaningDigest === sourceMeaningDigest &&
    proof.proofDigest === sha256(stableJson(proofWithoutDigest)) &&
    audit.decision.reasonCodes.includes(
      "curated-auto-validated-exact-brief-gloss-repair"
    )
  );
  if (!valid) {
    throw new Error(`english-audit-field-repair-proof-invalid:${audit.key}`);
  }
}

function validateHebrewEnglishCoverage(
  entries: FullEntryRow[],
  records: HebrewEnglishCandidate[]
): Map<string, HebrewEnglishCandidate> {
  if (records.length === 0) return new Map();
  const hebrewEntries = entries.filter(
    (entry) => normalizeLexiconLanguage(entry.language) === "hebrew"
  );
  if (records.length !== hebrewEntries.length) {
    throw new Error(
      `hebrew-english-coverage-mismatch:${records.length}:${hebrewEntries.length}`
    );
  }
  const byKey = new Map<string, HebrewEnglishCandidate>();
  for (const record of records) {
    if (byKey.has(record.entryKey)) {
      throw new Error(`duplicate-hebrew-english-candidate:${record.entryKey}`);
    }
    byKey.set(record.entryKey, record);
  }
  for (const entry of hebrewEntries) {
    const identity = buildLexiconEntryIdentity({
      language: "hebrew",
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong
    });
    const record = byKey.get(identity.entryKey);
    if (!record) {
      throw new Error(`missing-hebrew-english-candidate:${identity.entryKey}`);
    }
    const expectedIdentity = {
      stepEntryId: entry.id,
      language: "hebrew",
      baseCode: entry.baseCode,
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph
    };
    if (stableJson(record.identity) !== stableJson(expectedIdentity)) {
      throw new Error(`hebrew-english-identity-mismatch:${identity.entryKey}`);
    }
    if (record.english.gloss.trim() !== entry.gloss.trim()) {
      throw new Error(`hebrew-english-gloss-mismatch:${identity.entryKey}`);
    }
    const meaningText = stripLexiconHtml(record.english.meaningHtml);
    if (
      record.status !== "source_issue" &&
      (!meaningText || !record.english.gloss.trim())
    ) {
      throw new Error(`hebrew-english-content-missing:${identity.entryKey}`);
    }
    const htmlIssues = validateLexiconHtmlPair(
      meaningText,
      record.english.meaningHtml
    );
    if (record.english.meaningHtml && htmlIssues.length > 0) {
      throw new Error(
        `hebrew-english-html-invalid:${identity.entryKey}:${htmlIssues
          .map((issue) => issue.code)
          .join(",")}`
      );
    }
  }
  return byKey;
}

async function* readJsonl<T>(
  path: string
): AsyncGenerator<{ lineNumber: number; value: T }> {
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield { lineNumber, value: JSON.parse(line) as T };
    } catch (error) {
      throw new Error(
        `invalid-jsonl:${path}:${lineNumber}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function firstAudit(
  audits: Map<string, EnglishEvidenceAuditRecord>
): EnglishEvidenceAuditRecord {
  const record = audits.values().next().value as
    | EnglishEvidenceAuditRecord
    | undefined;
  if (!record) throw new Error("empty-english-audit");
  return record;
}

function groupResourcesByEntry(
  resources: FullResourceRow[]
): Map<number, FullResourceRow[]> {
  const grouped = new Map<number, FullResourceRow[]>();
  for (const resource of resources) {
    const rows = grouped.get(resource.stepEntryId) ?? [];
    rows.push(resource);
    grouped.set(resource.stepEntryId, rows);
  }
  return grouped;
}

function insertSources(
  db: DatabaseSync,
  input: {
    sourceDigests: EnglishEvidenceSourceDigests;
    englishAuditDigest: string;
    frenchReviewDigest: string | null;
    frenchPacketsDigest: string | null;
    frenchPacketSummaryDigest: string | null;
    frenchRemediationSummaryDigest: string | null;
    hebrewEnglishDigest: string | null;
    hebrewEnglishSummaryDigest: string | null;
    hebrewEnglishSummary: HebrewEnglishArtifactSummary | null;
    options: BuildLexiconV3AuthoringOptions;
    generatedAt: string;
  }
): SourceIds {
  const insert = db.prepare(
    `INSERT INTO LexiconSources (
       sourceKey, name, version, witnessFamily, locale, sha256, license,
       rightsStatus, allowDisplay, allowTranslation, allowCarrier,
       metadataJson, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const add = (source: {
    sourceKey: string;
    name: string;
    witnessFamily: string;
    locale: string;
    sha256: string;
    license: string;
    rightsStatus: "cleared" | "restricted" | "pending" | "unknown";
    allowDisplay: number;
    allowTranslation: number;
    allowCarrier: number;
    metadata?: Record<string, unknown>;
  }): number =>
    rowId(
      insert.run(
        source.sourceKey,
        source.name,
        source.sha256.slice(0, 16),
        source.witnessFamily,
        source.locale,
        source.sha256,
        source.license,
        source.rightsStatus,
        source.allowDisplay,
        source.allowTranslation,
        source.allowCarrier,
        JSON.stringify(source.metadata ?? {}),
        input.generatedAt
      ).lastInsertRowid
    );

  const TBESG = add({
    sourceKey: "step-tbesg",
    name: "TBESG",
    witnessFamily: "STEP-TBES",
    locale: "en",
    sha256: input.sourceDigests.TBESG,
    license: "CC BY 4.0",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0
  });
  const TBESH_GLOSS = add({
    sourceKey: "step-tbesh-gloss",
    name: "TBESH Gloss",
    witnessFamily: "STEP-TBES",
    locale: "en",
    sha256: input.sourceDigests.TBESH,
    license: "CC BY 4.0 (Tyndale House glosses)",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: { fieldScope: "gloss" }
  });
  const TBESH_MEANING = add({
    sourceKey: "step-tbesh-meaning",
    name: "TBESH Meaning",
    witnessFamily: "STEP-TBES",
    locale: "en",
    sha256: input.sourceDigests.TBESH,
    license:
      "STEP TBESH / Online Bible; project-held reuse and translation permission",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: {
      fieldScope: "meaning",
      rightsBasis: "Project-held permission confirmed by the project owner.",
      rightsConfirmedAt: "2026-07-13",
      canonicalRole: "primary-hebrew-meaning"
    }
  });
  const TFLSJ = add({
    sourceKey: "step-tflsj",
    name: "TFLSJ",
    witnessFamily: "STEP-TFLSJ",
    locale: "en",
    sha256: input.sourceDigests.TFLSJ,
    license: "CC BY 4.0",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0
  });
  const TAGNT = add({
    sourceKey: "step-tagnt",
    name: "TAGNT",
    witnessFamily: "STEP-original-Greek",
    locale: "grc",
    sha256: sha256(stableJson(input.sourceDigests.TAGNT)),
    license: "CC BY 4.0",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: {
      fileDigests: input.sourceDigests.TAGNT,
      rightsBasis:
        "CC BY 4.0 plus project-held STEP reuse and translation permission confirmed by the project owner.",
      rightsConfirmedAt: "2026-07-13"
    }
  });
  const TAHOT = add({
    sourceKey: "step-tahot",
    name: "TAHOT",
    witnessFamily: "STEP-original-Hebrew",
    locale: "hbo",
    sha256: sha256(stableJson(input.sourceDigests.TAHOT)),
    license: "CC BY 4.0",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: {
      fileDigests: input.sourceDigests.TAHOT,
      rightsBasis:
        "CC BY 4.0 plus project-held STEP reuse and translation permission confirmed by the project owner.",
      rightsConfirmedAt: "2026-07-13"
    }
  });
  const ENGLISH_AUDIT = add({
    sourceKey: "artifact-english-audit",
    name: "Lexicon v3 English audit",
    witnessFamily: "lexicon-v3-audit",
    locale: "en",
    sha256: input.englishAuditDigest,
    license: "generated project artifact",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: {
      path: input.options.englishAudit,
      rightsBasis:
        "Project-generated validation artifact derived from rights-cleared inputs; STEP display and translation permission confirmed by the project owner.",
      rightsConfirmedAt: "2026-07-13"
    }
  });
  const PERSEUS_G20354 = add({
    sourceKey: "perseus-lsj-g20354",
    name: "Perseus LSJ entry n35193 (G20354)",
    witnessFamily: "Perseus-LSJ",
    locale: "en",
    sha256: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
    license: "CC-BY-SA-4.0",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: {
      canonicalRole: "independent-external-lexicon-repair-g20354",
      provider: "Perseus Digital Library",
      work: "A Greek-English Lexicon (LSJ)",
      repository: "https://github.com/PerseusDL/lexica",
      commit: "b5e707bdda2d6c8e0bb6c29657454996b4fb04d7",
      urn: "urn:cite2:scaife-viewer:dictionaries.v1:lsj-n35193",
      artifactPath: PINNED_G20354_PERSEUS_ARTIFACT_PATH,
      artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
      artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
      payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
      sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
      sourceFragmentDigest: PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
      licenseUrl: PINNED_G20354_PERSEUS_LICENSE_URL,
      attribution: PINNED_G20354_PERSEUS_ATTRIBUTION,
      provenanceUrl: PINNED_G20354_PERSEUS_PROVENANCE_URL,
      accessedAt: PINNED_G20354_PERSEUS_ACCESSED_AT,
      modifications: PINNED_G20354_PERSEUS_MODIFICATIONS
    }
  });
  const GREEK_RECONSTRUCTION = input.sourceDigests.greekReconstruction
    ? add({
        sourceKey: "artifact-greek-reconstruction",
        name: "Lexicon v3 Greek reconstructed notices",
        witnessFamily: "lexicon-v3-greek-reconstruction",
        locale: "en",
        sha256: sha256(
          stableJson({
            audit: input.englishAuditDigest,
            catalog: input.sourceDigests.greekReconstruction.witnessCatalog,
            registry: GREEK_RECONSTRUCTION_REGISTRY_DIGEST
          })
        ),
        license:
          "Project-authored synthesis from rights-cleared STEP sources; Perseus-derived G0001H evidence CC BY-SA 4.0",
        rightsStatus: "cleared",
        allowDisplay: 1,
        allowTranslation: 1,
        allowCarrier: 0,
        metadata: {
          auditPath: input.options.englishAudit,
          auditDigest: input.englishAuditDigest,
          registryDigest: GREEK_RECONSTRUCTION_REGISTRY_DIGEST,
          sourceDigests: input.sourceDigests.greekReconstruction,
          witnessCatalogDigest:
            input.sourceDigests.greekReconstruction.witnessCatalog,
          rightsBasis:
            "Project-held STEP reuse and translation permission confirmed by the project owner; pinned open-source witnesses retain their recorded attribution."
        }
      })
    : undefined;
  const HEBREW_ENGLISH =
    input.hebrewEnglishDigest && input.hebrewEnglishSummary
      ? add({
          sourceKey: "artifact-hebrew-open-english",
          name: "Lexicon v3 Hebrew open-source corroboration",
          witnessFamily: "OpenScriptures+STEP-TIPNR",
          locale: "en",
          sha256: input.hebrewEnglishDigest,
          license:
            "CC BY 4.0; OpenScriptures Strong/BDB text public domain; STEP gloss/TIPNR CC BY 4.0",
          rightsStatus: "cleared",
          allowDisplay: 1,
          allowTranslation: 1,
          allowCarrier: 0,
          metadata: {
            canonicalRole: "corroboration-enrichment-and-proven-exact-fallback",
            path: input.options.hebrewEnglish,
            summaryPath: input.options.hebrewEnglishSummary,
            summaryDigest: input.hebrewEnglishSummaryDigest,
            summary: input.hebrewEnglishSummary
          }
        })
      : undefined;
  const HEBREW_ADJUDICATION = add({
    sourceKey: "artifact-hebrew-meaning-adjudication",
    name: "Lexicon v3 Hebrew meaning adjudication",
    witnessFamily: "lexicon-v3-hebrew-adjudication",
    locale: "en",
    sha256: HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST,
    license:
      "Project-authored synthesis from rights-cleared STEP and OpenScriptures evidence",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 1,
    allowCarrier: 0,
    metadata: {
      canonicalRole: "sealed-residual-hebrew-meaning-adjudication",
      policyId: HEBREW_CANONICAL_MEANING_POLICY_ID,
      registryDigest: HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST,
      rightsBasis:
        "Project-held STEP reuse and translation permission confirmed by the project owner; OpenScriptures witnesses retain their recorded attribution."
    }
  });
  const HEBREW_IDENTITY_ADJUDICATION = add({
    sourceKey: "artifact-hebrew-identity-adjudication",
    name: "Lexicon v3 Hebrew identity adjudication",
    witnessFamily: "lexicon-v3-hebrew-identity-adjudication",
    locale: "hbo",
    sha256: HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST,
    license:
      "Project-authored adjudication from rights-cleared STEP and OpenScriptures evidence",
    rightsStatus: "cleared",
    allowDisplay: 1,
    allowTranslation: 0,
    allowCarrier: 0,
    metadata: {
      canonicalRole: "sealed-hebrew-identity-corrections",
      policyId: HEBREW_IDENTITY_CORRECTION_POLICY_ID,
      registryDigest: HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST,
      sourceArtifact: HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT,
      rightsBasis:
        "Project-held STEP reuse permission confirmed by the project owner; OpenScriptures witnesses retain their recorded attribution."
    }
  });
  const FRENCH_REVIEW = input.frenchReviewDigest
    ? add({
        sourceKey: "artifact-french-review",
        name: "Lexicon v3 French review",
        witnessFamily: "lexicon-v3-french-review",
        locale: "fr",
        sha256: input.frenchReviewDigest,
        license: "generated project artifact",
        rightsStatus: "cleared",
        allowDisplay: 1,
        allowTranslation: 0,
        allowCarrier: 1,
        metadata: {
          path: input.options.frenchReview,
          packetsPath: input.options.frenchPackets,
          packetsDigest: input.frenchPacketsDigest,
          packetSummaryPath: input.options.frenchPacketSummary,
          packetSummaryDigest: input.frenchPacketSummaryDigest,
          remediationSummaryPath: input.options.frenchRemediationSummary,
          remediationSummaryDigest: input.frenchRemediationSummaryDigest
        }
      })
    : undefined;

  return {
    TBESG,
    TBESH_GLOSS,
    TBESH_MEANING,
    TFLSJ,
    TAGNT,
    TAHOT,
    ENGLISH_AUDIT,
    PERSEUS_G20354,
    GREEK_RECONSTRUCTION,
    HEBREW_ENGLISH,
    HEBREW_ADJUDICATION,
    HEBREW_IDENTITY_ADJUDICATION,
    FRENCH_REVIEW,
    resources: new Map([["TFLSJ", TFLSJ]])
  };
}

function insertMetadata(
  db: DatabaseSync,
  input: {
    generatedAt: string;
    options: BuildLexiconV3AuthoringOptions;
    databaseDigest: string;
    entitiesDatabaseDigest: string;
    englishAuditDigest: string;
    frenchReviewDigest: string | null;
    frenchPacketsDigest: string | null;
    frenchPacketSummaryDigest: string | null;
    frenchRemediationSummaryDigest: string | null;
    hebrewEnglishDigest: string | null;
    hebrewEnglishSummaryDigest: string | null;
    reviewDecisionsDigest: string | null;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    codeFingerprint: string;
    englishReviewDecisionsFingerprint: string;
    englishLineageFingerprint: string;
    englishSnapshotFingerprint: string;
    sourceDigests: EnglishEvidenceSourceDigests;
    entryCount: number;
  }
): void {
  const manifest = {
    schemaVersion: "lexicon-v3-authoring-manifest@1",
    generatedAt: input.generatedAt,
    inputs: {
      database: input.options.database,
      entitiesDatabase: input.options.entitiesDatabase,
      hebrewSourcesDirectory: input.options.hebrewSourcesDirectory ?? null,
      englishAudit: input.options.englishAudit,
      frenchReview: input.options.frenchReview ?? null,
      frenchPackets: input.options.frenchPackets ?? null,
      frenchPacketSummary: input.options.frenchPacketSummary ?? null,
      frenchRemediationSummary: input.options.frenchRemediationSummary ?? null,
      hebrewEnglish: input.options.hebrewEnglish ?? null,
      hebrewEnglishSummary: input.options.hebrewEnglishSummary ?? null,
      reviewDecisions: input.options.reviewDecisions ?? null
    },
    digests: {
      database: input.databaseDigest,
      entitiesDatabase: input.entitiesDatabaseDigest,
      englishAudit: input.englishAuditDigest,
      frenchReview: input.frenchReviewDigest,
      frenchPackets: input.frenchPacketsDigest,
      frenchPacketSummary: input.frenchPacketSummaryDigest,
      frenchRemediationSummary: input.frenchRemediationSummaryDigest,
      hebrewEnglish: input.hebrewEnglishDigest,
      hebrewEnglishSummary: input.hebrewEnglishSummaryDigest,
      reviewDecisions: input.reviewDecisionsDigest,
      sourceFingerprint: input.sourceFingerprint,
      sourceLogicalFingerprint: input.sourceLogicalFingerprint,
      codeFingerprint: input.codeFingerprint,
      englishReviewDecisionsFingerprint:
        input.englishReviewDecisionsFingerprint,
      englishLineageFingerprint: input.englishLineageFingerprint,
      englishSnapshotFingerprint: input.englishSnapshotFingerprint,
      STEP: input.sourceDigests
    },
    expectedEntryCount: input.entryCount
  };
  const insert = db.prepare(
    `INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  for (const [key, value] of [
    ["builtAt", input.generatedAt],
    ["sourceFingerprint", input.sourceFingerprint],
    ["sourceLogicalFingerprint", input.sourceLogicalFingerprint],
    ["codeFingerprint", input.codeFingerprint],
    [
      "englishReviewDecisionsFingerprint",
      input.englishReviewDecisionsFingerprint
    ],
    ["englishLineageFingerprint", input.englishLineageFingerprint],
    ["englishSnapshotFingerprint", input.englishSnapshotFingerprint],
    ["databaseDigest", input.databaseDigest],
    ["entitiesDatabaseDigest", input.entitiesDatabaseDigest],
    ["englishAuditDigest", input.englishAuditDigest],
    ["buildManifest", JSON.stringify(manifest)]
  ]) {
    insert.run(key, value);
  }
}

function insertEnglishLineageMetadata(
  db: DatabaseSync,
  input: {
    databaseDigest: string;
    englishAuditDigest: string;
    englishReviewDecisionsFingerprint: string;
    englishLineageFingerprint: string;
  }
): void {
  const insert = db.prepare(
    `INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  for (const [key, value] of [
    ["databaseDigest", input.databaseDigest],
    ["englishAuditDigest", input.englishAuditDigest],
    [
      "englishReviewDecisionsFingerprint",
      input.englishReviewDecisionsFingerprint
    ],
    ["englishLineageFingerprint", input.englishLineageFingerprint]
  ]) {
    insert.run(key, value);
  }
}

function populateAuthoringDatabase(context: BuildContext): void {
  const db = context.target;
  const insertEntry = db.prepare(
    `INSERT INTO LexiconEntries (
       entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
       uStrong, original, transliteration, morph, classicTransliteration,
       pronunciation, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEntryId = db.prepare(
    `INSERT INTO LexiconEntryIds (entryKey, stepEntryId, assignedAt)
     VALUES (?, ?, ?)`
  );
  const insertAssertion = db.prepare(
    `INSERT INTO LexiconSourceAssertions (
       sourceId, entryKey, scope, field, locale, valueText, valueHtml,
       locator, sha256, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertField = db.prepare(
    `INSERT INTO LexiconFieldVersions (
       entryKey, locale, field, valueText, valueHtml, state, confidence,
       method, generator, promptVersion, derivedFromVersionId, contentHash,
       createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertFieldEvidence = db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight, detailsJson, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertIssue = db.prepare(
    `INSERT INTO LexiconIssues (
       entryKey, fieldVersionId, sourceAssertionId, code, severity, status,
       detailsJson, createdAt
     ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
  );

  const assertion = (input: {
    sourceId: number;
    entryKey: string;
    scope: "entry" | "base_strong" | "resource" | "occurrence";
    field:
      | "identity"
      | "gloss"
      | "meaning"
      | "morph"
      | "resource"
      | "occurrence_gloss"
      | "carrier";
    locale: "en" | "fr" | "grc" | "hbo" | "arc" | "mul";
    valueText?: string | null;
    valueHtml?: string | null;
    locator: string;
    digest?: string;
  }): number =>
    rowId(
      insertAssertion.run(
        input.sourceId,
        input.entryKey,
        input.scope,
        input.field,
        input.locale,
        input.valueText ?? null,
        input.valueHtml ?? null,
        input.locator,
        input.digest ??
          sha256(`${input.valueText ?? ""}\u0000${input.valueHtml ?? ""}`),
        context.generatedAt
      ).lastInsertRowid
    );
  const field = (input: {
    entryKey: string;
    locale: "en" | "fr";
    field: "gloss" | "meaning" | "notes";
    valueText: string;
    valueHtml?: string | null;
    state: string;
    confidence: number;
    method:
      | "source"
      | "editorial"
      | "translation"
      | "model"
      | "rule"
      | "import";
    generator: string;
    promptVersion?: string | null;
    derivedFromVersionId?: number | null;
    anchor: string;
  }): number => {
    const contentHash = fieldContentHash({
      entryKey: input.entryKey,
      locale: input.locale,
      field: input.field,
      valueText: input.valueText,
      valueHtml: input.valueHtml ?? null,
      derivedFromVersionId: input.derivedFromVersionId ?? null,
      anchor: input.anchor
    });
    return rowId(
      insertField.run(
        input.entryKey,
        input.locale,
        input.field,
        input.valueText,
        input.valueHtml ?? null,
        input.state,
        input.confidence,
        input.method,
        input.generator,
        input.promptVersion ?? null,
        input.derivedFromVersionId ?? null,
        contentHash,
        context.generatedAt
      ).lastInsertRowid
    );
  };
  const evidence = (input: {
    fieldVersionId: number;
    sourceAssertionId?: number | null;
    evidenceKind:
      | "direct_source"
      | "cross_source"
      | "occurrence"
      | "legacy"
      | "concordance"
      | "validator"
      | "review";
    stance: "supports" | "contradicts" | "context";
    witnessFamily: string;
    weight: number;
    details?: Record<string, unknown>;
  }): void => {
    insertFieldEvidence.run(
      input.fieldVersionId,
      input.sourceAssertionId ?? null,
      input.evidenceKind,
      input.stance,
      input.witnessFamily,
      input.weight,
      JSON.stringify(input.details ?? {}),
      context.generatedAt
    );
  };
  const issue = (input: {
    entryKey: string;
    fieldVersionId?: number | null;
    sourceAssertionId?: number | null;
    code: string;
    severity: "info" | "warning" | "blocker";
    details?: Record<string, unknown>;
  }): void => {
    insertIssue.run(
      input.entryKey,
      input.fieldVersionId ?? null,
      input.sourceAssertionId ?? null,
      input.code,
      input.severity,
      JSON.stringify(input.details ?? {}),
      context.generatedAt
    );
  };
  const sharedSiblingMeaningKeys = sharedHebrewSiblingMeaningKeys(
    context.entries
  );
  const sharedLegacyGeneralKeys = sharedHebrewLegacyGeneralKeys(
    context.entries
  );
  const meaningFamilyMultiplicities = hebrewMeaningFamilyMultiplicities(
    context.entries
  );

  for (const entry of context.entries) {
    const identity = buildLexiconEntryIdentity({
      language: normalizeLexiconLanguage(entry.language),
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong
    });
    const audit = context.audits.get(identity.entryKey);
    if (!audit)
      throw new Error(`missing-audit-during-build:${identity.entryKey}`);
    const auditedFields = validateEnglishAuditFieldRepairValues(entry, audit);
    const greekReconstruction =
      audit.reconstruction?.applied === true ? audit.reconstruction : null;
    const greekReconstructionSourceId = greekReconstruction
      ? context.sourceIds.GREEK_RECONSTRUCTION
      : undefined;
    if (greekReconstruction && !greekReconstructionSourceId) {
      throw new Error(
        `missing-greek-reconstruction-source:${identity.entryKey}`
      );
    }
    const hebrewCandidate = context.hebrewEnglish.get(identity.entryKey);
    const hebrewIdentityCorrectionProof: HebrewIdentityCorrectionProof | null =
      identity.language === "hebrew"
        ? proveHebrewIdentityCorrection({
            key: identity.primaryDStrong,
            stepEntryId: entry.id,
            sourceIdentity: {
              eStrong: entry.eStrong,
              dStrong: entry.dStrong,
              uStrong: entry.uStrong,
              original: entry.original,
              transliteration: entry.transliteration,
              morph: entry.morph
            },
            auditIdentity: {
              eStrong: audit.eStrong,
              dStrong: audit.dStrong,
              uStrong: audit.uStrong,
              original: audit.original,
              transliteration: audit.transliteration,
              morph: audit.morph
            },
            candidate: hebrewCandidate ?? null,
            databaseDigest: audit.sourceDigests.database,
            tbeshSourceDigest: audit.sourceDigests.TBESH,
            tahotSourceDigests: audit.sourceDigests.TAHOT,
            hebrewEnglishSummary: context.hebrewEnglishSummary
          })
        : null;
    if (
      hebrewIdentityCorrectionProof &&
      !hebrewIdentityCorrectionProof.proven
    ) {
      throw new Error(
        `hebrew-identity-correction-proof-failed:${identity.entryKey}:${hebrewIdentityCorrectionProof.issueCodes.join(",")}`
      );
    }
    const correctedHebrewIdentity =
      hebrewIdentityCorrectionProof?.selectedIdentity ?? null;
    const publishedIdentity = greekReconstruction
      ? {
          original: audit.original,
          transliteration: audit.transliteration,
          morph: audit.morph,
          classicTransliteration:
            audit.classicTransliteration ?? entry.classicTransliteration,
          pronunciation: audit.pronunciation ?? entry.pronunciation
        }
      : correctedHebrewIdentity
        ? {
            original: correctedHebrewIdentity.original,
            transliteration: correctedHebrewIdentity.transliteration,
            morph: correctedHebrewIdentity.morph,
            classicTransliteration: entry.classicTransliteration,
            pronunciation: entry.pronunciation
          }
        : {
            original: entry.original,
            transliteration: entry.transliteration,
            morph: auditedFields.morph,
            classicTransliteration: entry.classicTransliteration,
            pronunciation: entry.pronunciation
          };
    const tbeshSections =
      identity.language === "hebrew" ? parseTbeshMeaning(audit.meaning) : null;
    const rawTbeshSections =
      identity.language === "hebrew" ? parseTbeshMeaning(entry.meaning) : null;
    insertEntry.run(
      identity.entryKey,
      identity.language,
      entry.baseCode,
      entry.eStrong,
      identity.primaryDStrong,
      entry.dStrong,
      entry.uStrong,
      publishedIdentity.original,
      publishedIdentity.transliteration,
      publishedIdentity.morph,
      publishedIdentity.classicTransliteration,
      publishedIdentity.pronunciation,
      context.generatedAt
    );
    insertEntryId.run(identity.entryKey, entry.id, context.generatedAt);

    const briefGlossSource =
      identity.language === "greek"
        ? context.sourceIds.TBESG
        : context.sourceIds.TBESH_GLOSS;
    const briefMeaningSource =
      identity.language === "greek"
        ? context.sourceIds.TBESG
        : context.sourceIds.TBESH_MEANING;
    const originalLocale = identity.language === "greek" ? "grc" : "hbo";
    const identityAssertionId = assertion({
      sourceId: briefGlossSource,
      entryKey: identity.entryKey,
      scope: "entry",
      field: "identity",
      locale: originalLocale,
      valueText: stableJson({
        original: entry.original,
        transliteration: entry.transliteration,
        morph: entry.morph,
        eStrong: entry.eStrong,
        dStrong: entry.dStrong,
        uStrong: entry.uStrong
      }),
      locator: `StepEntries:${entry.id}:identity`
    });
    const greekReconstructionIdentityAssertionId = greekReconstruction
      ? assertion({
          sourceId: greekReconstructionSourceId!,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "identity",
          locale: originalLocale,
          valueText: stableJson({
            original: publishedIdentity.original,
            transliteration: publishedIdentity.transliteration,
            morph: publishedIdentity.morph,
            classicTransliteration: publishedIdentity.classicTransliteration,
            pronunciation: publishedIdentity.pronunciation,
            eStrong: audit.eStrong,
            dStrong: audit.dStrong,
            uStrong: audit.uStrong
          }),
          locator: `greek-reconstruction:${identity.entryKey}:identity:${greekReconstruction.proof.ruleId ?? "unknown"}`,
          digest: greekReconstruction.reconstructionDigest
        })
      : undefined;
    const hebrewCorrectedIdentityAssertionId = hebrewIdentityCorrectionProof
      ? assertion({
          sourceId: context.sourceIds.HEBREW_IDENTITY_ADJUDICATION,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "identity",
          locale: originalLocale,
          valueText: stableJson({
            original: publishedIdentity.original,
            transliteration: publishedIdentity.transliteration,
            morph: publishedIdentity.morph,
            eStrong: entry.eStrong,
            dStrong: entry.dStrong,
            uStrong: entry.uStrong
          }),
          locator: `hebrew-identity-adjudication:${identity.primaryDStrong}:${hebrewIdentityCorrectionProof.correctionRecordDigest}`,
          digest: hebrewIdentityCorrectionProof.correctionRecordDigest
        })
      : undefined;
    if (hebrewIdentityCorrectionProof && hebrewCorrectedIdentityAssertionId) {
      issue({
        entryKey: identity.entryKey,
        sourceAssertionId: hebrewCorrectedIdentityAssertionId,
        code: "hebrew-identity-canonical-correction-applied",
        severity: "info",
        details: {
          policyId: hebrewIdentityCorrectionProof.policyId,
          correctionRecordDigest:
            hebrewIdentityCorrectionProof.correctionRecordDigest,
          registryDigest: hebrewIdentityCorrectionProof.registryDigest,
          sourceArtifactDigest:
            hebrewIdentityCorrectionProof.sourceArtifactDigest,
          facts: hebrewIdentityCorrectionProof.facts,
          rawIdentityAssertionId: identityAssertionId
        }
      });
    }
    const glossAssertionId = entry.gloss.trim()
      ? assertion({
          sourceId: briefGlossSource,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "gloss",
          locale: "en",
          valueText: entry.gloss.trim(),
          locator: `StepEntries:${entry.id}:gloss`
        })
      : undefined;
    const greekReconstructionGlossAssertionId = greekReconstruction
      ? assertion({
          sourceId: greekReconstructionSourceId!,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "gloss",
          locale: "en",
          valueText: audit.gloss.trim(),
          locator: `greek-reconstruction:${identity.entryKey}:gloss:${greekReconstruction.proof.ruleId ?? "unknown"}`,
          digest: greekReconstruction.reconstructionDigest
        })
      : undefined;
    const auditGlossRepair = audit.evidence.fieldRepairs.find(
      (repair) => repair.field === "gloss"
    );
    const auditGlossRepairAssertionId = auditGlossRepair
      ? assertion({
          sourceId: context.sourceIds.ENGLISH_AUDIT,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "gloss",
          locale: "en",
          valueText: auditGlossRepair.repairedValue,
          locator: `english-audit-field-repair:${identity.entryKey}:gloss:${auditGlossRepair.ruleId}`,
          digest: auditGlossRepair.repairDigest
        })
      : undefined;
    const auditMeaningRepair = audit.evidence.fieldRepairs.find(
      (repair) => repair.field === "meaning"
    );
    const exactAuditMeaningRepair =
      auditMeaningRepair && "schemaVersion" in auditMeaningRepair
        ? (auditMeaningRepair as EnglishExactFieldRepairEvidence)
        : undefined;
    const auditMeaningRepairAssertionId = auditMeaningRepair
      ? assertion({
          sourceId: context.sourceIds.ENGLISH_AUDIT,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "meaning",
          locale: "en",
          valueText: stripLexiconHtml(auditMeaningRepair.repairedValue),
          valueHtml: auditMeaningRepair.repairedValue,
          locator: `english-audit-field-repair:${identity.entryKey}:meaning:${auditMeaningRepair.ruleId}`,
          digest: auditMeaningRepair.repairDigest
        })
      : undefined;
    const exactHebrewMeaningRepairProjection =
      identity.language === "hebrew" &&
      exactAuditMeaningRepair &&
      rawTbeshSections?.hasSectionSeparator
        ? buildHebrewExactMeaningRepairProjection(exactAuditMeaningRepair)
        : null;
    const isPinnedPerseusG20354Repair =
      identity.entryKey === "greek:G20354" &&
      auditGlossRepair?.method === "exact-pinned-external-lexicon-recovery" &&
      auditMeaningRepair?.method === "exact-pinned-external-lexicon-recovery";
    const perseusG20354GlossAssertionId = isPinnedPerseusG20354Repair
      ? assertion({
          sourceId: context.sourceIds.PERSEUS_G20354,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "gloss",
          locale: "en",
          valueText: auditGlossRepair!.repairedValue,
          locator: "perseus-lsj:n35193:payload:definition:active-passive-gloss",
          digest: sha256(
            stableJson({
              artifact: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
              payload: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
              field: "gloss",
              value: auditGlossRepair!.repairedValue
            })
          )
        })
      : undefined;
    const perseusG20354MeaningAssertionId = isPinnedPerseusG20354Repair
      ? assertion({
          sourceId: context.sourceIds.PERSEUS_G20354,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "meaning",
          locale: "en",
          valueText: stripLexiconHtml(auditMeaningRepair!.repairedValue),
          valueHtml: auditMeaningRepair!.repairedValue,
          locator: "perseus-lsj:n35193:payload:definition-and-citations",
          digest: sha256(
            stableJson({
              artifact: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
              payload: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
              field: "meaning",
              value: auditMeaningRepair!.repairedValue
            })
          )
        })
      : undefined;
    const sourceMeaningForText =
      identity.language === "hebrew"
        ? normalizeTbeshMeaningHtml(entry.meaning)
        : entry.meaning;
    const meaningAssertionId = stripLexiconHtml(sourceMeaningForText)
      ? assertion({
          sourceId: briefMeaningSource,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "meaning",
          locale: "en",
          valueText: stripLexiconHtml(sourceMeaningForText),
          valueHtml: entry.meaning,
          locator: `StepEntries:${entry.id}:meaning`
        })
      : undefined;
    const greekReconstructionMeaningAssertionId = greekReconstruction
      ? assertion({
          sourceId: greekReconstructionSourceId!,
          entryKey: identity.entryKey,
          scope: "entry",
          field: "meaning",
          locale: "en",
          valueText: stripLexiconHtml(audit.meaning),
          valueHtml: audit.meaning,
          locator: `greek-reconstruction:${identity.entryKey}:meaning:${greekReconstruction.proof.ruleId ?? "unknown"}`,
          digest: greekReconstruction.reconstructionDigest
        })
      : undefined;
    const tbeshStepSpecificAssertionId =
      rawTbeshSections?.hasSectionSeparator &&
      hasMeaningfulTbeshHtml(rawTbeshSections.stepSpecificHtml)
        ? assertion({
            sourceId: context.sourceIds.TBESH_MEANING,
            entryKey: identity.entryKey,
            scope: "entry",
            field: "meaning",
            locale: "en",
            valueText: stripLexiconHtml(
              normalizeTbeshMeaningHtml(rawTbeshSections.stepSpecificHtml)
            ),
            valueHtml: rawTbeshSections.stepSpecificHtml,
            locator: `StepEntries:${entry.id}:meaning:step-specific`
          })
        : undefined;
    const tbeshLegacyGeneralAssertionId =
      rawTbeshSections?.hasSectionSeparator &&
      hasMeaningfulTbeshHtml(rawTbeshSections.legacyGeneralHtml)
        ? assertion({
            sourceId: context.sourceIds.TBESH_MEANING,
            entryKey: identity.entryKey,
            scope: "base_strong",
            field: "meaning",
            locale: "en",
            valueText: stripLexiconHtml(
              normalizeTbeshMeaningHtml(rawTbeshSections.legacyGeneralHtml)
            ),
            valueHtml: rawTbeshSections.legacyGeneralHtml,
            locator: `StepEntries:${entry.id}:meaning:legacy-general`
          })
        : undefined;
    const hebrewCandidateMeaning = hebrewCandidate
      ? stripLexiconHtml(hebrewCandidate.english.meaningHtml)
      : "";
    const hebrewMeaningAssertionId =
      identity.language === "hebrew" &&
      hebrewCandidate &&
      hebrewCandidateMeaning &&
      context.sourceIds.HEBREW_ENGLISH
        ? assertion({
            sourceId: context.sourceIds.HEBREW_ENGLISH,
            entryKey: identity.entryKey,
            scope: "entry",
            field: "meaning",
            locale: "en",
            valueText: hebrewCandidateMeaning,
            valueHtml: hebrewCandidate.english.meaningHtml,
            locator: `hebrew-open-english:${hebrewCandidate.recordDigest}`,
            digest: hebrewCandidate.recordDigest
          })
        : undefined;
    const hebrewGlossValidationAssertionId =
      identity.language === "hebrew" &&
      hebrewCandidate &&
      hebrewCandidate.english.gloss.trim() &&
      context.sourceIds.HEBREW_ENGLISH
        ? assertion({
            sourceId: context.sourceIds.HEBREW_ENGLISH,
            entryKey: identity.entryKey,
            scope: "entry",
            field: "gloss",
            locale: "en",
            valueText: hebrewCandidate.english.gloss.trim(),
            locator: `hebrew-open-english-gloss:${hebrewCandidate.recordDigest}`,
            digest: hebrewCandidate.recordDigest
          })
        : undefined;

    const resourceAssertionIds = new Map<string, number>();
    for (const resource of context.resourcesByEntry.get(entry.id) ?? []) {
      const sourceId = context.sourceIds.resources.get(resource.source);
      if (!sourceId) {
        throw new Error(
          `unsupported-lexicon-resource-source:${resource.source}`
        );
      }
      const resourceAssertionId = assertion({
        sourceId,
        entryKey: identity.entryKey,
        scope: "resource",
        // LexiconResources rows are lexical meaning witnesses. Keeping the
        // resource scope preserves their auxiliary role, while the field must
        // remain `meaning` so a selected TFLSJ repair carries admissible,
        // field-specific release evidence.
        field: "meaning",
        locale: "en",
        valueText: stripLexiconHtml(resource.contentHtml),
        valueHtml: resource.contentHtml,
        locator: `LexiconResources:${resource.id}`
      });
      resourceAssertionIds.set(
        `${resource.source}:${resource.id}`,
        resourceAssertionId
      );
    }
    const auditAssertionId = assertion({
      sourceId: context.sourceIds.ENGLISH_AUDIT,
      entryKey: identity.entryKey,
      scope: "entry",
      field: "resource",
      locale: "en",
      valueText: JSON.stringify(audit),
      locator: `english-audit:${identity.entryKey}`,
      digest: audit.recordDigest
    });
    const occurrenceEvidence =
      identity.language === "greek"
        ? (audit.evidence.TFLSJ?.citations ?? audit.evidence.brief.citations)
        : audit.evidence.exactOccurrence;
    const occurrenceAssertionId = assertion({
      sourceId:
        identity.language === "greek"
          ? context.sourceIds.TAGNT
          : context.sourceIds.TAHOT,
      entryKey: identity.entryKey,
      scope: "occurrence",
      field: "occurrence_gloss",
      locale: identity.language === "hebrew" ? "en" : originalLocale,
      valueText: JSON.stringify(occurrenceEvidence),
      locator: `english-audit-occurrences:${identity.entryKey}`,
      digest:
        identity.language === "hebrew"
          ? audit.evidence.exactOccurrence.occurrenceCorpusDigest
          : undefined
    });

    const selected = selectEnglishForAuthoring(audit);
    const stepDirectAuditIdentity: StepDirectAuditIdentityInput | null =
      identity.language === "hebrew"
        ? {
            entryKey: identity.entryKey,
            stepEntryId: entry.id,
            primaryDStrong: identity.primaryDStrong,
            dStrong: entry.dStrong,
            uStrong: entry.uStrong,
            auditKey: audit.key,
            auditStepEntryId: audit.stepEntryId,
            auditDStrong: audit.dStrong,
            auditUStrong: audit.uStrong,
            auditDecisionStatus: audit.decision.status,
            auditCanonicalSource: audit.decision.canonicalSource,
            sourceAuditStatus: audit.evidence.sourceAudit.status,
            sourceAuditRequiresReview:
              audit.evidence.sourceAudit.requiresReview,
            sourceAuditEntryKey: audit.evidence.sourceAudit.identity.entryKey,
            sourceAuditPrimaryDStrong:
              audit.evidence.sourceAudit.identity.primaryDStrong,
            sourceAuditDStrong: audit.evidence.sourceAudit.identity.dStrong,
            sourceAuditUStrong: audit.evidence.sourceAudit.identity.uStrong,
            sourceSelectionStrategy:
              audit.evidence.sourceAudit.selection?.strategy ?? "",
            sourceSelectionSource:
              audit.evidence.sourceAudit.selection?.source ?? null,
            sourceSelectionKind:
              audit.evidence.sourceAudit.selection?.kind ?? null,
            sourceSelectionAutomatic:
              audit.evidence.sourceAudit.selection?.automatic ?? false,
            auditRecordDigest: audit.recordDigest
          }
        : null;
    const forcedIdentityBlock =
      !publishedIdentity.original.trim() && !greekReconstruction;
    const baseState = forcedIdentityBlock
      ? "blocked_source_issue"
      : selected.english.status === "validated"
        ? "auto_validated"
        : selected.english.status === "review_needed"
          ? "candidate"
          : "blocked_source_issue";
    const baseConfidence =
      selected.english.status === "validated"
        ? audit.decision.status === "repaired"
          ? 0.95
          : 0.98
        : selected.english.status === "review_needed"
          ? 0.72
          : 0.2;
    const tahotOccurrences =
      audit.evidence.exactOccurrence.count > 0
        ? [
            {
              dStrong: audit.evidence.exactOccurrence.stepStrong,
              count: audit.evidence.exactOccurrence.count,
              references: audit.evidence.exactOccurrence.references ?? []
            }
          ]
        : [];
    const technicalMarkerProof: StepTechnicalMarkerProof | null =
      identity.language === "hebrew" &&
      entry.baseCode >= 9001 &&
      entry.baseCode <= 9049
        ? proveStepTechnicalMarker({
            baseCode: entry.baseCode,
            eStrong: entry.eStrong,
            dStrong: entry.dStrong,
            uStrong: entry.uStrong,
            original: entry.original,
            morph: entry.morph,
            gloss: entry.gloss,
            meaningHtml: entry.meaning
          })
        : null;
    const technicalMarkerResolved = technicalMarkerProof?.proven === true;
    const hebrewGlossAssessment = hebrewCandidate?.fieldAssessments.gloss;
    const preliminaryHebrewGlossState = forcedIdentityBlock
      ? "blocked_source_issue"
      : hebrewGlossAssessment?.status === "validated"
        ? "auto_validated"
        : hebrewGlossAssessment?.status === "review_needed"
          ? "candidate"
          : "blocked_source_issue";
    const hebrewGlossProof: HebrewEnglishGlossPublicationProof | null =
      identity.language === "hebrew" &&
      hebrewCandidate &&
      preliminaryHebrewGlossState === "candidate" &&
      !technicalMarkerResolved
        ? proveHebrewEnglishGlossCandidate({
            candidate: hebrewCandidate,
            primaryDStrong: identity.primaryDStrong,
            tahotOccurrences
          })
        : null;
    const strictGlossResolved = hebrewGlossProof?.proven === true;
    const tahotGlossProof: TahotGlossProof | null =
      identity.language === "hebrew" &&
      preliminaryHebrewGlossState === "candidate" &&
      !technicalMarkerResolved &&
      !strictGlossResolved
        ? proveTahotOccurrenceGlossSupport({
            dStrong: identity.primaryDStrong,
            gloss: selected.english.gloss,
            occurrences: audit.evidence.exactOccurrence.occurrences.map(
              (occurrence) => ({
                dStrong: occurrence.dStrong,
                gloss: occurrence.gloss,
                locator: occurrence.locator
              })
            )
          })
        : null;
    const tahotGlossResolved = tahotGlossProof?.proven === true;
    const stepDirectGlossProof: StepDirectGlossProof | null =
      identity.language === "hebrew" &&
      stepDirectAuditIdentity &&
      preliminaryHebrewGlossState === "candidate" &&
      !technicalMarkerResolved &&
      !strictGlossResolved &&
      !tahotGlossResolved
        ? proveStepDirectGloss({
            ...stepDirectAuditIdentity,
            stepGloss: entry.gloss,
            auditGloss: audit.gloss,
            selectedGloss: selected.english.gloss,
            glossContentTerms:
              audit.evidence.sourceAudit.glossSupport.contentTerms,
            meaningSupportsGloss:
              audit.evidence.sourceAudit.glossSupport.meaningSupportsGloss,
            fieldIssueCodes: hebrewGlossAssessment?.issueCodes ?? [],
            candidateIssueCodes: hebrewCandidate?.issues ?? [],
            preliminaryState: preliminaryHebrewGlossState,
            exactGlossProofProven: strictGlossResolved,
            tahotGlossProofProven: tahotGlossResolved,
            technicalMarkerProofProven: technicalMarkerResolved
          })
        : null;
    const stepDirectGlossResolved = stepDirectGlossProof?.proven === true;
    const canonicalGlossProof: HebrewCanonicalGlossProof | null =
      identity.language === "hebrew" &&
      stepDirectAuditIdentity &&
      hebrewCandidate &&
      (preliminaryHebrewGlossState === "candidate" ||
        isHebrewGlossResidualAuditKey(identity.primaryDStrong)) &&
      !technicalMarkerResolved &&
      !strictGlossResolved &&
      !tahotGlossResolved &&
      !stepDirectGlossResolved
        ? proveHebrewCanonicalGloss({
            ...stepDirectAuditIdentity,
            stepGloss: entry.gloss,
            auditGloss: audit.gloss,
            selectedGloss: selected.english.gloss,
            meaningSupportsGloss:
              audit.evidence.sourceAudit.glossSupport.meaningSupportsGloss,
            candidate: hebrewCandidate,
            candidateCorpusDigest: context.hebrewEnglishDigest ?? "",
            tbeshSourceDigest: audit.sourceDigests.TBESH,
            tahotSourceDigests: audit.sourceDigests.TAHOT,
            exactOccurrenceCount: audit.evidence.exactOccurrence.count,
            exactOccurrenceCorpusDigest:
              audit.evidence.exactOccurrence.occurrenceCorpusDigest,
            tahotGlossProofProven: tahotGlossResolved,
            strictGlossProofProven: strictGlossResolved,
            technicalMarkerProofProven: technicalMarkerResolved
          })
        : null;
    const canonicalGlossResolved = Boolean(
      canonicalGlossProof?.proven === true &&
      canonicalGlossProof.publicationApproved === true
    );
    const canonicalGlossReplaced = Boolean(
      canonicalGlossResolved &&
      canonicalGlossProof &&
      [
        "replace_lexical_definition",
        "replace_tipnr_alias",
        "residual_replace_source_value",
        "residual_editorial_reconstruction"
      ].includes(canonicalGlossProof.action)
    );
    const publishedGloss = canonicalGlossReplaced
      ? canonicalGlossProof!.value.trim()
      : selected.english.gloss.trim();
    const glossState = forcedIdentityBlock
      ? "blocked_source_issue"
      : identity.language !== "hebrew"
        ? baseState
        : technicalMarkerResolved ||
            strictGlossResolved ||
            tahotGlossResolved ||
            stepDirectGlossResolved ||
            canonicalGlossResolved
          ? "auto_validated"
          : preliminaryHebrewGlossState;
    const glossConfidence =
      identity.language === "hebrew"
        ? technicalMarkerResolved
          ? 0.98
          : strictGlossResolved
            ? Math.max(hebrewGlossAssessment?.confidence ?? 0.95, 0.95)
            : tahotGlossResolved
              ? Math.max(hebrewGlossAssessment?.confidence ?? 0.9, 0.9)
              : stepDirectGlossResolved && stepDirectGlossProof
                ? stepDirectGlossProof.confidence
                : canonicalGlossResolved && canonicalGlossProof
                  ? canonicalGlossProof.confidence
                  : (hebrewGlossAssessment?.confidence ?? 0.2)
        : baseConfidence;
    const hebrewMeaningAssessment = hebrewCandidate?.fieldAssessments.meaning;
    const canonicalHebrewMeaningAssessment =
      identity.language === "hebrew"
        ? assessCanonicalHebrewMeaning({
            audit,
            candidate: hebrewCandidate,
            selectedStatus: selected.english.status,
            meaningHtml: selected.english.meaningHtml,
            primaryDStrong: identity.primaryDStrong,
            morph: entry.morph,
            sharedAcrossSiblingGlosses: sharedSiblingMeaningKeys.has(
              identity.entryKey
            ),
            legacyGeneralSharedAcrossSiblings: sharedLegacyGeneralKeys.has(
              identity.entryKey
            ),
            baseConfidence
          })
        : undefined;
    const canonicalHebrewMeaningPublication =
      identity.language === "hebrew" &&
      tbeshSections &&
      canonicalHebrewMeaningAssessment &&
      !technicalMarkerResolved
        ? planCanonicalHebrewMeaningPublication({
            audit,
            candidate: hebrewCandidate,
            assessment: canonicalHebrewMeaningAssessment,
            sections: tbeshSections,
            primaryDStrong: identity.primaryDStrong,
            auditIdentity: stepDirectAuditIdentity!,
            candidateCorpusDigest: context.hebrewEnglishDigest ?? ""
          })
        : undefined;
    const publicationOverridesRaw = Boolean(
      canonicalHebrewMeaningPublication &&
      [
        "exact_companion",
        "step_specific_only",
        "legacy_general_only",
        "editorial_reconstruction"
      ].includes(canonicalHebrewMeaningPublication.decision.action)
    );
    const ledgerValidatesRaw = Boolean(
      canonicalHebrewMeaningPublication?.decision.action === "raw_combined" &&
      canonicalHebrewMeaningAssessment?.status === "review_needed" &&
      canonicalHebrewMeaningAssessment.sectioning.lexicalSectionPolicy ===
        "verified_context"
    );
    const canonicalMeaningPolicyProof =
      canonicalHebrewMeaningPublication?.canonicalPolicyProof ?? null;
    const canonicalMeaningDecisionAligned = Boolean(
      canonicalMeaningPolicyProof?.proven &&
      ((canonicalMeaningPolicyProof.disposition === "publish_raw" &&
        canonicalHebrewMeaningPublication?.decision.action ===
          "raw_combined") ||
        (canonicalMeaningPolicyProof.disposition ===
          "publish_exact_companion" &&
          canonicalHebrewMeaningPublication?.decision.action ===
            "exact_companion") ||
        (canonicalMeaningPolicyProof.disposition === "publish_step_specific" &&
          canonicalHebrewMeaningPublication?.decision.action ===
            "step_specific_only") ||
        (canonicalMeaningPolicyProof.disposition === "publish_legacy_general" &&
          canonicalHebrewMeaningPublication?.decision.action ===
            "legacy_general_only") ||
        (canonicalMeaningPolicyProof.disposition ===
          "publish_editorial_reconstruction" &&
          canonicalHebrewMeaningPublication?.decision.action ===
            "editorial_reconstruction") ||
        (canonicalMeaningPolicyProof.disposition === "block_publication" &&
          canonicalHebrewMeaningPublication?.decision.action === "blocked"))
    );
    if (
      canonicalMeaningPolicyProof?.proven &&
      !canonicalMeaningDecisionAligned
    ) {
      throw new Error(
        `hebrew-canonical-meaning-decision-proof-mismatch:${identity.entryKey}:${canonicalMeaningPolicyProof.disposition}:${canonicalHebrewMeaningPublication?.decision.action ?? "missing"}`
      );
    }
    const canonicalMeaningPolicyResolved = Boolean(
      canonicalMeaningDecisionAligned &&
      canonicalMeaningPolicyProof?.disposition !== "block_publication"
    );
    const canonicalMeaningPolicyBlocked = Boolean(
      canonicalMeaningDecisionAligned &&
      canonicalMeaningPolicyProof?.disposition === "block_publication"
    );
    const publicationResolvesAssessment =
      publicationOverridesRaw ||
      ledgerValidatesRaw ||
      canonicalMeaningPolicyResolved ||
      technicalMarkerResolved;
    const publicationBlocksAutomaticValidation =
      canonicalHebrewMeaningPublication?.decision.action === "blocked";
    const preliminaryMeaningState = forcedIdentityBlock
      ? "blocked_source_issue"
      : identity.language === "hebrew"
        ? technicalMarkerResolved
          ? "auto_validated"
          : publicationResolvesAssessment
            ? "auto_validated"
            : publicationBlocksAutomaticValidation
              ? canonicalHebrewMeaningAssessment?.status === "source_issue"
                ? "blocked_source_issue"
                : "candidate"
              : canonicalHebrewMeaningAssessment?.status === "source_issue"
                ? "blocked_source_issue"
                : canonicalHebrewMeaningAssessment?.status === "review_needed"
                  ? "candidate"
                  : "auto_validated"
        : baseState;
    const meaningFamilyMultiplicity =
      identity.language === "hebrew"
        ? (meaningFamilyMultiplicities.get(identity.entryKey) ?? {
            rawHtmlCount: 0,
            canonicalTextCount: 0
          })
        : null;
    const stepDirectMeaningProof: StepDirectMeaningProof | null =
      identity.language === "hebrew" &&
      stepDirectAuditIdentity &&
      tbeshSections &&
      canonicalHebrewMeaningAssessment &&
      canonicalHebrewMeaningPublication &&
      meaningFamilyMultiplicity &&
      preliminaryMeaningState === "candidate" &&
      !technicalMarkerResolved &&
      !canonicalMeaningPolicyResolved &&
      !canonicalMeaningPolicyBlocked &&
      canonicalHebrewMeaningAssessment.sectioning.properName === false &&
      !publicationOverridesRaw
        ? proveStepDirectMeaning({
            ...stepDirectAuditIdentity,
            rawHtml: entry.meaning,
            rawText: stripLexiconHtml(normalizeTbeshMeaningHtml(entry.meaning)),
            auditMeaningHtml: audit.meaning,
            hasSectionSeparator: tbeshSections.hasSectionSeparator,
            exactOccurrenceStepStrong:
              audit.evidence.exactOccurrence.stepStrong,
            exactOccurrenceCount: audit.evidence.exactOccurrence.count,
            rawFamilyHtmlCount: meaningFamilyMultiplicity.rawHtmlCount,
            rawFamilyTextCount: meaningFamilyMultiplicity.canonicalTextCount,
            glossContentTerms:
              audit.evidence.sourceAudit.glossSupport.contentTerms,
            meaningSupportsGloss:
              audit.evidence.sourceAudit.glossSupport.meaningSupportsGloss,
            assessmentIssueCodes: canonicalHebrewMeaningAssessment.issueCodes,
            companionIssueCodes:
              hebrewCandidate?.fieldAssessments.meaning.issueCodes ?? [],
            publicationAction:
              canonicalHebrewMeaningPublication.decision.action,
            publicationReasonCodes:
              canonicalHebrewMeaningPublication.decision.reasonCodes
          })
        : null;
    const stepDirectMeaningResolved = stepDirectMeaningProof?.proven === true;
    const meaningState = exactHebrewMeaningRepairProjection
      ? "auto_validated"
      : stepDirectMeaningResolved || canonicalMeaningPolicyResolved
        ? "auto_validated"
        : preliminaryMeaningState;
    const meaningConfidence = exactHebrewMeaningRepairProjection
      ? 0.99
      : canonicalMeaningPolicyResolved
        ? canonicalHebrewMeaningPublication?.decision.action ===
          "editorial_reconstruction"
          ? 0.95
          : 0.98
        : stepDirectMeaningResolved && stepDirectMeaningProof
          ? stepDirectMeaningProof.confidence
          : publicationResolvesAssessment
            ? technicalMarkerResolved
              ? 0.98
              : publicationOverridesRaw &&
                  canonicalHebrewMeaningPublication?.decision.action ===
                    "exact_companion"
                ? Math.max(hebrewMeaningAssessment?.confidence ?? 0.95, 0.95)
                : 0.95
            : publicationBlocksAutomaticValidation
              ? Math.min(
                  canonicalHebrewMeaningAssessment?.confidence ??
                    baseConfidence,
                  0.72
                )
              : (canonicalHebrewMeaningAssessment?.confidence ??
                baseConfidence);
    const publishedMeaningHtml = exactHebrewMeaningRepairProjection
      ? normalizeTbeshMeaningHtml(
          exactHebrewMeaningRepairProjection.publishedHtml
        )
      : publicationOverridesRaw
        ? normalizeTbeshMeaningHtml(
            canonicalHebrewMeaningPublication?.decision.content?.html ?? ""
          )
        : selected.english.meaningHtml;
    const publishedMeaningText =
      exactHebrewMeaningRepairProjection || publicationOverridesRaw
        ? stripLexiconHtml(publishedMeaningHtml)
        : selected.english.meaning;

    let glossFieldId: number | undefined;
    let meaningFieldId: number | undefined;
    const canonicalGlossReplacementAssertionId =
      canonicalGlossReplaced &&
      canonicalGlossProof &&
      context.sourceIds.HEBREW_ENGLISH
        ? assertion({
            sourceId: context.sourceIds.HEBREW_ENGLISH,
            entryKey: identity.entryKey,
            scope: "entry",
            field: "gloss",
            locale: "en",
            valueText: publishedGloss,
            locator: `hebrew-canonical-gloss:${canonicalGlossProof.action}:${canonicalGlossProof.source.recordId}`,
            digest: canonicalGlossProof.digests.content
          })
        : undefined;
    const canonicalGlossAssertionId =
      perseusG20354GlossAssertionId ??
      greekReconstructionGlossAssertionId ??
      auditGlossRepairAssertionId ??
      canonicalGlossReplacementAssertionId ??
      glossAssertionId;
    if (publishedGloss && canonicalGlossAssertionId) {
      glossFieldId = field({
        entryKey: identity.entryKey,
        locale: "en",
        field: "gloss",
        valueText: publishedGloss,
        state: glossState,
        confidence: glossConfidence,
        method:
          strictGlossResolved ||
          tahotGlossResolved ||
          stepDirectGlossResolved ||
          canonicalGlossResolved ||
          auditGlossRepair ||
          greekReconstruction
            ? "rule"
            : "source",
        generator: greekReconstruction
          ? GREEK_RECONSTRUCTION_GENERATOR
          : auditGlossRepair
            ? ENGLISH_AUDIT_FIELD_REPAIR_GENERATOR
            : technicalMarkerResolved
              ? STEP_TECHNICAL_MARKER_GENERATOR
              : strictGlossResolved
                ? HEBREW_GLOSS_PROOF_GENERATOR
                : tahotGlossResolved
                  ? TAHOT_GLOSS_PROOF_GENERATOR
                  : stepDirectGlossResolved
                    ? STEP_DIRECT_GLOSS_GENERATOR
                    : canonicalGlossResolved
                      ? HEBREW_CANONICAL_GLOSS_GENERATOR
                      : BUILDER_GENERATOR,
        anchor:
          greekReconstruction?.reconstructionDigest ??
          canonicalGlossProof?.digests.proof ??
          stepDirectGlossProof?.digests.proof ??
          selected.english.contentHash
      });
      evidence({
        fieldVersionId: glossFieldId,
        sourceAssertionId: canonicalGlossAssertionId,
        evidenceKind: isPinnedPerseusG20354Repair
          ? "cross_source"
          : greekReconstruction || auditGlossRepair
            ? "validator"
            : canonicalGlossReplaced
              ? "cross_source"
              : "direct_source",
        stance: "supports",
        witnessFamily: greekReconstruction
          ? "lexicon-v3-greek-reconstruction"
          : isPinnedPerseusG20354Repair
            ? "Perseus-LSJ"
            : auditGlossRepair
              ? "lexicon-v3-audit-field-repair"
              : canonicalGlossReplaced && canonicalGlossProof
                ? canonicalGlossProof.source.family
                : "STEP-TBES",
        weight: 1,
        details: greekReconstruction
          ? {
              catalogDigest: greekReconstruction.catalogDigest,
              input: greekReconstruction.input,
              proof: greekReconstruction.proof,
              reconstructionDigest: greekReconstruction.reconstructionDigest,
              role: "reconstructed-canonical-gloss"
            }
          : isPinnedPerseusG20354Repair
            ? {
                artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
                artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
                payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
                sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
                sourceFragmentDigest:
                  PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
                role: "canonical-independent-external-lexicon-gloss"
              }
            : auditGlossRepair
              ? {
                  repair: auditGlossRepair,
                  curatedRuleProof: audit.decision.curatedRuleProof ?? null
                }
              : stepDirectGlossResolved && stepDirectGlossProof
                ? {
                    role: "step-direct",
                    proof: stepDirectGlossProof
                  }
                : canonicalGlossProof
                  ? {
                      role: canonicalGlossResolved
                        ? canonicalGlossReplaced
                          ? "canonical-gloss-replacement"
                          : "step-source-priority"
                        : "canonical-gloss-publication-blocked",
                      proof: canonicalGlossProof
                    }
                  : undefined
      });
      if (isPinnedPerseusG20354Repair) {
        if (auditGlossRepairAssertionId) {
          evidence({
            fieldVersionId: glossFieldId,
            sourceAssertionId: auditGlossRepairAssertionId,
            evidenceKind: "validator",
            stance: "context",
            witnessFamily: "lexicon-v3-audit-field-repair",
            weight: 0.9,
            details: {
              repair: auditGlossRepair,
              role: "validator-not-semantic-authority"
            }
          });
        }
        if (glossAssertionId) {
          evidence({
            fieldVersionId: glossFieldId,
            sourceAssertionId: glossAssertionId,
            evidenceKind: "direct_source",
            stance: "contradicts",
            witnessFamily: "STEP-TBES-raw",
            weight: 0.4,
            details: {
              role: "challenged-target-gloss",
              rawValueDigest: sha256(entry.gloss.trim())
            }
          });
        }
      }
      if (
        canonicalGlossReplaced &&
        glossAssertionId &&
        glossAssertionId !== canonicalGlossAssertionId
      ) {
        evidence({
          fieldVersionId: glossFieldId,
          sourceAssertionId: glossAssertionId,
          evidenceKind: "direct_source",
          stance: "contradicts",
          witnessFamily: "STEP-TBES-raw",
          weight: 0.5,
          details: {
            role: "challenged-step-gloss",
            proofDigest: canonicalGlossProof?.digests.proof ?? null,
            rawValueDigest: sha256(entry.gloss.trim())
          }
        });
      }
      if (
        greekReconstruction &&
        glossAssertionId &&
        glossAssertionId !== canonicalGlossAssertionId
      ) {
        evidence({
          fieldVersionId: glossFieldId,
          sourceAssertionId: glossAssertionId,
          evidenceKind: "direct_source",
          stance:
            entry.gloss.trim() === selected.english.gloss.trim()
              ? "context"
              : "contradicts",
          witnessFamily: "STEP-TBES-raw",
          weight: 0.4,
          details: {
            rawEntryDigest: greekReconstruction.input.sourceRecordDigest,
            role: "quarantined-raw-source"
          }
        });
      }
      if (
        auditGlossRepair?.method === "exact-tbesg-definition-extraction" &&
        meaningAssertionId
      ) {
        evidence({
          fieldVersionId: glossFieldId,
          sourceAssertionId: meaningAssertionId,
          evidenceKind: "cross_source",
          stance: "supports",
          witnessFamily: "STEP-TBES-exact-definition",
          weight: 1,
          details: {
            repairDigest: auditGlossRepair.repairDigest,
            ruleId: auditGlossRepair.ruleId,
            sourceMeaningDigest: auditGlossRepair.sourceMeaningDigest
          }
        });
      }
      evidence({
        fieldVersionId: glossFieldId,
        sourceAssertionId: auditAssertionId,
        evidenceKind: "validator",
        stance: "context",
        witnessFamily: "lexicon-v3-audit",
        weight: 0.9,
        details: {
          status: selected.english.status,
          issues: selected.english.issues
        }
      });
      if (tahotGlossResolved && tahotGlossProof) {
        evidence({
          fieldVersionId: glossFieldId,
          sourceAssertionId: occurrenceAssertionId,
          evidenceKind: "cross_source",
          stance: "supports",
          witnessFamily: "STEP-TAHOT-exact-dstrong-gloss",
          weight: 0.9,
          details: {
            proof: tahotGlossProof,
            occurrenceCorpusDigest:
              audit.evidence.exactOccurrence.occurrenceCorpusDigest,
            englishAuditRecordDigest: audit.recordDigest,
            sourceDigests: audit.sourceDigests.TAHOT
          }
        });
      }
      if (
        identity.language === "hebrew" &&
        hebrewCandidate &&
        hebrewGlossValidationAssertionId
      ) {
        evidence({
          fieldVersionId: glossFieldId,
          sourceAssertionId: hebrewGlossValidationAssertionId,
          evidenceKind: strictGlossResolved ? "cross_source" : "validator",
          stance: strictGlossResolved ? "supports" : "context",
          witnessFamily: "lexicon-v3-hebrew-open-gloss",
          weight: strictGlossResolved
            ? 1
            : hebrewCandidate.fieldAssessments.gloss.confidence,
          details: {
            assessment: hebrewCandidate.fieldAssessments.gloss,
            publicationProof: hebrewGlossProof,
            recordDigest: hebrewCandidate.recordDigest
          }
        });
      }
    }
    if (publishedMeaningText.trim()) {
      if (identity.language === "hebrew") {
        const htmlIssues = validateLexiconHtmlPair(
          publishedMeaningText,
          publishedMeaningHtml
        );
        if (htmlIssues.length > 0) {
          throw new Error(
            `tbesh-meaning-html-invalid:${identity.entryKey}:${htmlIssues
              .map((htmlIssue) => htmlIssue.code)
              .join(",")}`
          );
        }
      }
      const hebrewMeaningAdjudicationAssertionId =
        canonicalHebrewMeaningPublication?.decision.action ===
          "editorial_reconstruction" && canonicalMeaningPolicyProof?.selection
          ? assertion({
              sourceId: context.sourceIds.HEBREW_ADJUDICATION,
              entryKey: identity.entryKey,
              scope: "entry",
              field: "meaning",
              locale: "en",
              valueText: publishedMeaningText,
              valueHtml: publishedMeaningHtml,
              locator: `hebrew-meaning-adjudication:${identity.primaryDStrong}:${canonicalMeaningPolicyProof.selection.recordDigest}`,
              digest: canonicalMeaningPolicyProof.selection.recordDigest
            })
          : undefined;
      const canonicalMeaningAssertionId =
        perseusG20354MeaningAssertionId ??
        greekReconstructionMeaningAssertionId ??
        (exactHebrewMeaningRepairProjection
          ? auditMeaningRepairAssertionId
          : canonicalHebrewMeaningPublication?.decision.action ===
              "exact_companion"
            ? hebrewMeaningAssertionId
            : canonicalHebrewMeaningPublication?.decision.action ===
                "step_specific_only"
              ? tbeshStepSpecificAssertionId
              : canonicalHebrewMeaningPublication?.decision.action ===
                  "legacy_general_only"
                ? tbeshLegacyGeneralAssertionId
                : canonicalHebrewMeaningPublication?.decision.action ===
                    "editorial_reconstruction"
                  ? hebrewMeaningAdjudicationAssertionId
                  : selected.canonicalSource === "TFLSJ"
                    ? findCanonicalResourceAssertion(
                        audit,
                        resourceAssertionIds,
                        "TFLSJ"
                      )
                    : (auditMeaningRepairAssertionId ?? meaningAssertionId));
      if (!canonicalMeaningAssertionId) {
        throw new Error(
          `missing-canonical-meaning-assertion:${identity.entryKey}:${canonicalHebrewMeaningPublication?.decision.action ?? selected.canonicalSource}`
        );
      }
      meaningFieldId = field({
        entryKey: identity.entryKey,
        locale: "en",
        field: "meaning",
        valueText: publishedMeaningText,
        valueHtml: publishedMeaningHtml,
        state: meaningState,
        confidence: meaningConfidence,
        method: greekReconstruction
          ? "rule"
          : auditMeaningRepair
            ? "rule"
            : canonicalHebrewMeaningPublication?.decision.action ===
                "editorial_reconstruction"
              ? "editorial"
              : canonicalMeaningPolicyResolved
                ? "rule"
                : stepDirectMeaningResolved
                  ? "rule"
                  : canonicalHebrewMeaningPublication?.decision.action ===
                      "exact_companion"
                    ? "import"
                    : canonicalHebrewMeaningPublication?.decision.action ===
                        "step_specific_only"
                      ? "rule"
                      : selected.canonicalSource === "TFLSJ"
                        ? "editorial"
                        : "source",
        generator: greekReconstruction
          ? GREEK_RECONSTRUCTION_GENERATOR
          : auditMeaningRepair
            ? ENGLISH_AUDIT_FIELD_REPAIR_GENERATOR
            : technicalMarkerResolved
              ? STEP_TECHNICAL_MARKER_GENERATOR
              : canonicalMeaningPolicyResolved
                ? HEBREW_CANONICAL_MEANING_GENERATOR
                : stepDirectMeaningResolved
                  ? STEP_DIRECT_MEANING_GENERATOR
                  : publicationResolvesAssessment
                    ? TBESH_PUBLICATION_GENERATOR
                    : BUILDER_GENERATOR,
        anchor:
          greekReconstruction?.reconstructionDigest ??
          auditMeaningRepair?.repairDigest ??
          canonicalMeaningPolicyProof?.digests.proof ??
          stepDirectMeaningProof?.digests.proof ??
          canonicalHebrewMeaningPublication?.selectionDigest ??
          selected.english.contentHash
      });
      const publicationAction =
        canonicalHebrewMeaningPublication?.decision.action;
      const publicationSelection =
        !exactHebrewMeaningRepairProjection && canonicalHebrewMeaningPublication
          ? {
              action: canonicalHebrewMeaningPublication.decision.action,
              canonicalPolicyProof:
                canonicalHebrewMeaningPublication.canonicalPolicyProof,
              counterfactualAction:
                canonicalHebrewMeaningPublication.counterfactualDecision.action,
              proof: canonicalHebrewMeaningPublication.proof,
              quarantinedParts:
                canonicalHebrewMeaningPublication.decision.quarantinedParts.map(
                  (part) => ({
                    digest: sha256(part.html),
                    part: part.part,
                    reasonCode: part.reasonCode
                  })
                ),
              reasonCodes:
                canonicalHebrewMeaningPublication.decision.reasonCodes,
              selectionDigest: canonicalHebrewMeaningPublication.selectionDigest
            }
          : null;
      const exactCompanionSelected = publicationAction === "exact_companion";
      const stepSpecificSelected = publicationAction === "step_specific_only";
      const legacyGeneralSelected = publicationAction === "legacy_general_only";
      const editorialReconstructionSelected =
        publicationAction === "editorial_reconstruction";
      evidence({
        fieldVersionId: meaningFieldId,
        sourceAssertionId: canonicalMeaningAssertionId,
        evidenceKind: greekReconstruction
          ? "validator"
          : isPinnedPerseusG20354Repair
            ? "cross_source"
            : auditMeaningRepair
              ? "validator"
              : editorialReconstructionSelected
                ? "validator"
                : exactCompanionSelected
                  ? "cross_source"
                  : "direct_source",
        stance: "supports",
        witnessFamily: greekReconstruction
          ? "lexicon-v3-greek-reconstruction"
          : isPinnedPerseusG20354Repair
            ? "Perseus-LSJ"
            : auditMeaningRepair
              ? "lexicon-v3-audit-field-repair"
              : editorialReconstructionSelected
                ? "lexicon-v3-hebrew-adjudication"
                : exactCompanionSelected
                  ? "OpenScriptures+STEP-TIPNR"
                  : stepSpecificSelected
                    ? "STEP-TBESH-step-specific"
                    : legacyGeneralSelected
                      ? "STEP-TBESH-legacy-general"
                      : selected.canonicalSource === "TFLSJ"
                        ? "STEP-TFLSJ"
                        : "STEP-TBES",
        weight: 1,
        details: greekReconstruction
          ? {
              catalogDigest: greekReconstruction.catalogDigest,
              input: greekReconstruction.input,
              proof: greekReconstruction.proof,
              reconstructionDigest: greekReconstruction.reconstructionDigest,
              role: "reconstructed-canonical-meaning"
            }
          : isPinnedPerseusG20354Repair
            ? {
                artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
                artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
                payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
                sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
                sourceFragmentDigest:
                  PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
                role: "canonical-independent-external-lexicon-meaning"
              }
            : auditMeaningRepair
              ? {
                  repair: auditMeaningRepair,
                  role: "exact-source-field-repair",
                  ...(exactHebrewMeaningRepairProjection
                    ? {
                        exactMeaningRepairProjection:
                          exactHebrewMeaningRepairProjection
                      }
                    : {}),
                  ...(identity.language === "hebrew" &&
                  !exactHebrewMeaningRepairProjection
                    ? {
                        advisoryCodes:
                          canonicalHebrewMeaningAssessment?.advisoryCodes ?? [],
                        publicationSelection,
                        sectioning:
                          canonicalHebrewMeaningAssessment?.sectioning,
                        canonicalMeaningPolicyProof,
                        technicalMarkerProof,
                        stepDirectMeaningProof
                      }
                    : {})
                }
              : identity.language === "hebrew"
                ? {
                    advisoryCodes:
                      canonicalHebrewMeaningAssessment?.advisoryCodes ?? [],
                    publicationSelection,
                    role: exactCompanionSelected
                      ? canonicalMeaningPolicyProof?.basis ===
                        "positive_conflict_ledger"
                        ? "positive-conflict-repair"
                        : "exact-companion-conservative"
                      : stepSpecificSelected
                        ? canonicalMeaningPolicyProof?.basis ===
                          "positive_conflict_ledger"
                          ? "positive-conflict-step-specific-repair"
                          : "step-specific"
                        : legacyGeneralSelected
                          ? "legacy-general-exact-section"
                          : editorialReconstructionSelected
                            ? "editorial-reconstruction"
                            : stepDirectMeaningResolved
                              ? "step-direct"
                              : canonicalMeaningPolicyResolved
                                ? "canonical-raw-proven"
                                : "canonical-raw",
                    sectioning: canonicalHebrewMeaningAssessment?.sectioning,
                    canonicalMeaningPolicyProof,
                    technicalMarkerProof,
                    stepDirectMeaningProof
                  }
                : undefined
      });
      if (isPinnedPerseusG20354Repair) {
        if (auditMeaningRepairAssertionId) {
          evidence({
            fieldVersionId: meaningFieldId,
            sourceAssertionId: auditMeaningRepairAssertionId,
            evidenceKind: "validator",
            stance: "context",
            witnessFamily: "lexicon-v3-audit-field-repair",
            weight: 0.9,
            details: {
              repair: auditMeaningRepair,
              role: "validator-not-semantic-authority"
            }
          });
        }
        if (meaningAssertionId) {
          evidence({
            fieldVersionId: meaningFieldId,
            sourceAssertionId: meaningAssertionId,
            evidenceKind: "direct_source",
            stance: "contradicts",
            witnessFamily: "STEP-TBES-raw",
            weight: 0.4,
            details: {
              role: "challenged-target-meaning",
              rawValueDigest: sha256(entry.meaning)
            }
          });
        }
      }
      if (
        greekReconstruction &&
        meaningAssertionId &&
        meaningAssertionId !== canonicalMeaningAssertionId
      ) {
        evidence({
          fieldVersionId: meaningFieldId,
          sourceAssertionId: meaningAssertionId,
          evidenceKind: "direct_source",
          stance:
            entry.meaning === selected.english.meaningHtml
              ? "context"
              : "contradicts",
          witnessFamily: "STEP-TBES-raw",
          weight: 0.4,
          details: {
            rawEntryDigest: greekReconstruction.input.sourceRecordDigest,
            role: "quarantined-raw-source"
          }
        });
      }
      if (
        identity.language === "hebrew" &&
        meaningAssertionId &&
        canonicalMeaningAssertionId !== meaningAssertionId
      ) {
        evidence({
          fieldVersionId: meaningFieldId,
          sourceAssertionId: meaningAssertionId,
          evidenceKind: "direct_source",
          stance:
            editorialReconstructionSelected ||
            legacyGeneralSelected ||
            exactCompanionSelected ||
            canonicalHebrewMeaningAssessment?.sectioning.legacyGeneralScope ===
              "source_conflict" ||
            canonicalHebrewMeaningAssessment?.sectioning.legacyGeneralScope ===
              "foreign_sibling"
              ? "contradicts"
              : "context",
          witnessFamily: "STEP-TBES",
          weight: 0.4,
          details: {
            ...(publicationSelection ? { publicationSelection } : {}),
            ...(exactHebrewMeaningRepairProjection
              ? {
                  exactMeaningRepairProjection:
                    exactHebrewMeaningRepairProjection
                }
              : {}),
            role: "quarantined-raw-source"
          }
        });
      }
      if (
        identity.language === "hebrew" &&
        tbeshStepSpecificAssertionId &&
        canonicalHebrewMeaningAssessment &&
        canonicalMeaningAssertionId !== tbeshStepSpecificAssertionId
      ) {
        evidence({
          fieldVersionId: meaningFieldId,
          sourceAssertionId: tbeshStepSpecificAssertionId,
          evidenceKind: "direct_source",
          stance: "context",
          witnessFamily: "STEP-TBESH-step-specific",
          weight:
            canonicalHebrewMeaningAssessment.sectioning.stepSpecificScope ===
            "exact_dstrong"
              ? 1
              : 0.8,
          details: {
            ...(publicationSelection ? { publicationSelection } : {}),
            ...(exactHebrewMeaningRepairProjection
              ? {
                  exactMeaningRepairProjection:
                    exactHebrewMeaningRepairProjection
                }
              : {}),
            role: "step-specific",
            scope: exactHebrewMeaningRepairProjection
              ? "raw_step_specific_context"
              : canonicalHebrewMeaningAssessment.sectioning.stepSpecificScope,
            digest: exactHebrewMeaningRepairProjection
              ? sha256(rawTbeshSections!.stepSpecificHtml)
              : canonicalHebrewMeaningAssessment.sectioning.stepSpecificDigest
          }
        });
      }
      if (
        identity.language === "hebrew" &&
        tbeshLegacyGeneralAssertionId &&
        canonicalHebrewMeaningAssessment
      ) {
        evidence({
          fieldVersionId: meaningFieldId,
          sourceAssertionId: tbeshLegacyGeneralAssertionId,
          evidenceKind: "direct_source",
          stance:
            canonicalHebrewMeaningAssessment.sectioning.legacyGeneralScope ===
              "source_conflict" ||
            canonicalHebrewMeaningAssessment.sectioning.legacyGeneralScope ===
              "foreign_sibling"
              ? "contradicts"
              : "context",
          witnessFamily: "STEP-TBESH-legacy-general",
          weight: 0.8,
          details: {
            ...(publicationSelection ? { publicationSelection } : {}),
            ...(exactHebrewMeaningRepairProjection
              ? {
                  exactMeaningRepairProjection:
                    exactHebrewMeaningRepairProjection
                }
              : {}),
            role: "legacy-general",
            scope: exactHebrewMeaningRepairProjection
              ? "raw_base_strong_context"
              : canonicalHebrewMeaningAssessment.sectioning.legacyGeneralScope,
            sharedAcrossSiblings:
              canonicalHebrewMeaningAssessment.sectioning
                .legacyGeneralSharedAcrossSiblings,
            digest: exactHebrewMeaningRepairProjection
              ? sha256(rawTbeshSections!.legacyGeneralHtml)
              : canonicalHebrewMeaningAssessment.sectioning.legacyGeneralDigest
          }
        });
      }
      evidence({
        fieldVersionId: meaningFieldId,
        sourceAssertionId: auditAssertionId,
        evidenceKind: "validator",
        stance: "context",
        witnessFamily: "lexicon-v3-audit",
        weight: 0.95,
        details: {
          status: selected.english.status,
          issues: selected.english.issues
        }
      });
      if (
        identity.language === "hebrew" &&
        hebrewCandidate &&
        hebrewMeaningAssertionId &&
        canonicalMeaningAssertionId !== hebrewMeaningAssertionId
      ) {
        evidence({
          fieldVersionId: meaningFieldId,
          sourceAssertionId: hebrewMeaningAssertionId,
          evidenceKind: "cross_source",
          stance: "context",
          witnessFamily: "OpenScriptures+STEP-TIPNR",
          weight: hebrewMeaningAssessment?.confidence ?? 0.2,
          details: {
            role: "corroboration-enrichment-and-exact-fallback",
            assessment: hebrewMeaningAssessment,
            method: hebrewCandidate.method,
            mapping: hebrewCandidate.mapping,
            provenance: hebrewCandidate.provenance,
            recordDigest: hebrewCandidate.recordDigest,
            companionMeaning: hebrewCandidateMeaning,
            publicationSelection,
            tbeshSectioning: canonicalHebrewMeaningAssessment?.sectioning,
            tbeshAdvisoryCodes:
              canonicalHebrewMeaningAssessment?.advisoryCodes ?? []
          }
        });
      }
    }

    if (greekReconstruction) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: meaningFieldId,
        sourceAssertionId:
          greekReconstructionIdentityAssertionId ?? auditAssertionId,
        code: "greek-reconstruction-applied",
        severity: "info",
        details: {
          catalogDigest: greekReconstruction.catalogDigest,
          input: greekReconstruction.input,
          proof: greekReconstruction.proof,
          rawEntry: greekReconstruction.rawEntry,
          reconstructionDigest: greekReconstruction.reconstructionDigest
        }
      });
    }
    if (forcedIdentityBlock) {
      issue({
        entryKey: identity.entryKey,
        sourceAssertionId: identityAssertionId,
        code: "missing-original",
        severity: "blocker",
        details: { stepEntryId: entry.id }
      });
    }
    if (!glossFieldId) {
      issue({
        entryKey: identity.entryKey,
        sourceAssertionId: glossAssertionId,
        code: "missing-english-gloss",
        severity: "blocker"
      });
    }
    if (
      identity.language === "hebrew" &&
      tahotGlossResolved &&
      !technicalMarkerResolved
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: glossFieldId,
        sourceAssertionId: occurrenceAssertionId,
        code: "hebrew-open-gloss-review-resolved-by-tahot",
        severity: "info",
        details: {
          previousIssueCode: "hebrew-open-gloss-review-needed",
          assessment: hebrewCandidate?.fieldAssessments.gloss ?? null,
          proof: tahotGlossProof,
          occurrenceCorpusDigest:
            audit.evidence.exactOccurrence.occurrenceCorpusDigest
        }
      });
    } else if (
      identity.language === "hebrew" &&
      strictGlossResolved &&
      !technicalMarkerResolved
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: glossFieldId,
        sourceAssertionId: hebrewGlossValidationAssertionId,
        code: "hebrew-open-gloss-strictly-proven",
        severity: "info",
        details: {
          assessment: hebrewCandidate?.fieldAssessments.gloss ?? null,
          publicationProof: hebrewGlossProof
        }
      });
    } else if (
      identity.language === "hebrew" &&
      stepDirectGlossResolved &&
      stepDirectGlossProof &&
      !technicalMarkerResolved
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: glossFieldId,
        sourceAssertionId: glossAssertionId,
        code: "hebrew-step-direct-gloss-proven",
        severity: "info",
        details: {
          previousIssueCode: "hebrew-open-gloss-review-needed",
          assessment: hebrewCandidate?.fieldAssessments.gloss ?? null,
          proof: stepDirectGlossProof
        }
      });
    } else if (
      identity.language === "hebrew" &&
      canonicalGlossResolved &&
      canonicalGlossProof &&
      !technicalMarkerResolved
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: glossFieldId,
        sourceAssertionId: canonicalGlossAssertionId,
        code: canonicalGlossReplaced
          ? "hebrew-canonical-gloss-replaced"
          : "hebrew-canonical-gloss-source-priority-proven",
        severity: "info",
        details: {
          previousIssueCode: "hebrew-open-gloss-review-needed",
          assessment: hebrewCandidate?.fieldAssessments.gloss ?? null,
          proof: canonicalGlossProof
        }
      });
    } else if (
      identity.language === "hebrew" &&
      !technicalMarkerResolved &&
      (!hebrewCandidate ||
        hebrewCandidate.fieldAssessments.gloss.status === "source_issue")
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: glossFieldId,
        sourceAssertionId: hebrewGlossValidationAssertionId,
        code: "hebrew-open-gloss-source-issue",
        severity: "blocker",
        details: {
          requiredAction:
            "Resolve the exact rights-cleared open-source support for this Hebrew gloss.",
          assessment: hebrewCandidate?.fieldAssessments.gloss ?? null
        }
      });
    } else if (
      identity.language === "hebrew" &&
      !technicalMarkerResolved &&
      hebrewCandidate?.fieldAssessments.gloss.status === "review_needed"
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: glossFieldId,
        sourceAssertionId: hebrewGlossValidationAssertionId,
        code: "hebrew-open-gloss-review-needed",
        severity: "warning",
        details: {
          assessment: hebrewCandidate.fieldAssessments.gloss,
          canonicalPolicyProof: canonicalGlossProof
        }
      });
    }
    if (!meaningFieldId) {
      issue({
        entryKey: identity.entryKey,
        sourceAssertionId: meaningAssertionId,
        code: "missing-english-meaning",
        severity: "blocker"
      });
    }
    if (
      exactHebrewMeaningRepairProjection &&
      exactAuditMeaningRepair &&
      auditMeaningRepairAssertionId &&
      meaningAssertionId &&
      tbeshStepSpecificAssertionId &&
      tbeshLegacyGeneralAssertionId &&
      rawTbeshSections
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: meaningFieldId,
        sourceAssertionId: auditMeaningRepairAssertionId,
        code: "hebrew-tbesh-exact-meaning-repair-applied",
        severity: "info",
        details: {
          repair: exactAuditMeaningRepair,
          projection: exactHebrewMeaningRepairProjection,
          rawSource: {
            assertionId: meaningAssertionId,
            rawHtmlDigest: sha256(entry.meaning),
            sectionSeparatorCount: rawTbeshSections.sectionSeparatorCount,
            stepSpecificAssertionId: tbeshStepSpecificAssertionId,
            stepSpecificDigest: sha256(rawTbeshSections.stepSpecificHtml),
            legacyGeneralAssertionId: tbeshLegacyGeneralAssertionId,
            legacyGeneralDigest: sha256(rawTbeshSections.legacyGeneralHtml)
          },
          publicationSource: "artifact-english-audit"
        }
      });
    }
    if (
      identity.language === "hebrew" &&
      !exactHebrewMeaningRepairProjection &&
      canonicalHebrewMeaningAssessment &&
      canonicalHebrewMeaningAssessment.status !== "validated"
    ) {
      if (technicalMarkerResolved && technicalMarkerProof) {
        issue({
          entryKey: identity.entryKey,
          fieldVersionId: meaningFieldId,
          sourceAssertionId: meaningAssertionId,
          code: "hebrew-step-technical-marker-attested",
          severity: "info",
          details: {
            assessment: canonicalHebrewMeaningAssessment,
            technicalMarkerProof
          }
        });
      } else if (
        canonicalMeaningPolicyResolved &&
        canonicalMeaningPolicyProof &&
        canonicalHebrewMeaningPublication
      ) {
        const restoredRaw =
          canonicalMeaningPolicyProof.disposition === "publish_raw" &&
          ["exact_companion", "step_specific_only"].includes(
            canonicalHebrewMeaningPublication.counterfactualDecision.action
          );
        issue({
          entryKey: identity.entryKey,
          fieldVersionId: meaningFieldId,
          sourceAssertionId:
            canonicalMeaningPolicyProof.disposition ===
            "publish_exact_companion"
              ? hebrewMeaningAssertionId
              : meaningAssertionId,
          code: restoredRaw
            ? "hebrew-tbesh-canonical-raw-restored"
            : canonicalMeaningPolicyProof.basis === "positive_conflict_ledger"
              ? "hebrew-tbesh-positive-conflict-repair-retained"
              : canonicalMeaningPolicyProof.disposition ===
                  "publish_exact_companion"
                ? "hebrew-tbesh-exact-companion-conservative"
                : "hebrew-tbesh-canonical-policy-proven",
          severity: "info",
          details: {
            assessment: canonicalHebrewMeaningAssessment,
            counterfactualDecision:
              canonicalHebrewMeaningPublication.counterfactualDecision,
            proof: canonicalMeaningPolicyProof,
            publicationDecision: canonicalHebrewMeaningPublication.decision,
            selectionDigest: canonicalHebrewMeaningPublication.selectionDigest
          }
        });
      } else if (stepDirectMeaningResolved && stepDirectMeaningProof) {
        issue({
          entryKey: identity.entryKey,
          fieldVersionId: meaningFieldId,
          sourceAssertionId: meaningAssertionId,
          code: "hebrew-step-direct-meaning-proven",
          severity: "info",
          details: {
            assessment: canonicalHebrewMeaningAssessment,
            companionIssues:
              hebrewCandidate?.fieldAssessments.meaning.issueCodes ?? [],
            proof: stepDirectMeaningProof,
            publicationDecision:
              canonicalHebrewMeaningPublication?.decision ?? null
          }
        });
      } else if (
        publicationResolvesAssessment &&
        canonicalHebrewMeaningPublication
      ) {
        issue({
          entryKey: identity.entryKey,
          fieldVersionId: meaningFieldId,
          sourceAssertionId: meaningAssertionId,
          code: publicationOverridesRaw
            ? "hebrew-tbesh-raw-quarantined"
            : "hebrew-tbesh-ledger-validated",
          severity: "info",
          details: {
            assessment: canonicalHebrewMeaningAssessment,
            companionMethod: hebrewCandidate?.method ?? null,
            publicationAction:
              canonicalHebrewMeaningPublication.decision.action,
            publicationProof: canonicalHebrewMeaningPublication.proof,
            reasonCodes: canonicalHebrewMeaningPublication.decision.reasonCodes,
            selectionDigest: canonicalHebrewMeaningPublication.selectionDigest
          }
        });
      } else {
        issue({
          entryKey: identity.entryKey,
          fieldVersionId: meaningFieldId,
          sourceAssertionId: meaningAssertionId,
          code:
            canonicalHebrewMeaningAssessment.status === "source_issue"
              ? "hebrew-tbesh-meaning-source-issue"
              : "hebrew-tbesh-meaning-review-needed",
          severity:
            canonicalHebrewMeaningAssessment.status === "source_issue"
              ? "blocker"
              : "warning",
          details: {
            canonicalSource: "TBESH",
            assessment: canonicalHebrewMeaningAssessment,
            companionMethod: hebrewCandidate?.method ?? null,
            companionIssues:
              hebrewCandidate?.fieldAssessments.meaning.issueCodes ?? [],
            publicationDecision:
              canonicalHebrewMeaningPublication?.decision ?? null,
            canonicalPolicyProof:
              canonicalHebrewMeaningPublication?.canonicalPolicyProof ?? null,
            publicationProof: canonicalHebrewMeaningPublication?.proof ?? null,
            selectionDigest:
              canonicalHebrewMeaningPublication?.selectionDigest ?? null
          }
        });
      }
    }
    if (
      identity.language === "hebrew" &&
      !exactHebrewMeaningRepairProjection &&
      canonicalHebrewMeaningAssessment?.status === "validated" &&
      canonicalHebrewMeaningPublication?.decision.action === "blocked" &&
      canonicalHebrewMeaningPublication.canonicalPolicyProof.proven !== true
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: meaningFieldId,
        sourceAssertionId: meaningAssertionId,
        code: "hebrew-tbesh-publication-unproven",
        severity: "warning",
        details: {
          publicationDecision: canonicalHebrewMeaningPublication.decision,
          publicationProof: canonicalHebrewMeaningPublication.proof,
          selectionDigest: canonicalHebrewMeaningPublication.selectionDigest
        }
      });
    }
    if (
      identity.language === "hebrew" &&
      !exactHebrewMeaningRepairProjection &&
      canonicalHebrewMeaningAssessment?.status === "validated" &&
      canonicalHebrewMeaningPublication?.decision.action === "blocked" &&
      canonicalHebrewMeaningPublication.canonicalPolicyProof.proven === true &&
      canonicalHebrewMeaningPublication.canonicalPolicyProof.disposition ===
        "block_publication"
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: meaningFieldId,
        sourceAssertionId: meaningAssertionId,
        code: "hebrew-tbesh-publication-blocked-by-policy",
        severity: "warning",
        details: {
          canonicalPolicyProof:
            canonicalHebrewMeaningPublication.canonicalPolicyProof,
          counterfactualDecision:
            canonicalHebrewMeaningPublication.counterfactualDecision,
          publicationDecision: canonicalHebrewMeaningPublication.decision,
          selectionDigest: canonicalHebrewMeaningPublication.selectionDigest
        }
      });
    }
    if (
      identity.language === "hebrew" &&
      !exactHebrewMeaningRepairProjection &&
      canonicalHebrewMeaningAssessment?.sectioning.hasSectionSeparator
    ) {
      issue({
        entryKey: identity.entryKey,
        fieldVersionId: meaningFieldId,
        sourceAssertionId: meaningAssertionId,
        code: "hebrew-tbesh-meaning-sectioned",
        severity: "info",
        details: {
          sectioning: canonicalHebrewMeaningAssessment.sectioning,
          advisoryCodes: canonicalHebrewMeaningAssessment.advisoryCodes,
          publicationDecision:
            canonicalHebrewMeaningPublication?.decision ?? null,
          publicationProof: canonicalHebrewMeaningPublication?.proof ?? null,
          selectionDigest:
            canonicalHebrewMeaningPublication?.selectionDigest ?? null
        }
      });
    }
    if (identity.language === "greek") {
      addEnglishAuditIssues({
        audit,
        entryKey: identity.entryKey,
        meaningFieldId,
        auditAssertionId,
        issue
      });
    }
  }
}

function selectEnglishForAuthoring(audit: EnglishEvidenceAuditRecord): {
  english: ReturnType<typeof selectCanonicalEnglish>;
  canonicalSource: string;
} {
  try {
    const english = selectCanonicalEnglish(audit);
    return {
      english,
      canonicalSource:
        english.sources[0] ?? (audit.language === "greek" ? "TBESG" : "TBESH")
    };
  } catch (error) {
    const meaningHtml = audit.meaning;
    const meaning = stripLexiconHtml(meaningHtml);
    const sources = [audit.language === "greek" ? "TBESG" : "TBESH"];
    const issues = [
      "invalid-selected-english-content",
      error instanceof Error ? error.message : String(error)
    ];
    const status = "source_issue" as const;
    return {
      english: {
        contentHash: sha256(
          stableJson({
            entryKey: audit.key,
            recordDigest: audit.recordDigest,
            status,
            gloss: audit.gloss,
            meaning,
            meaningHtml,
            sources,
            issues
          })
        ),
        status,
        gloss: audit.gloss.trim(),
        meaning,
        meaningHtml,
        sources,
        issues
      },
      canonicalSource: sources[0] ?? "unknown"
    };
  }
}

function findCanonicalResourceAssertion(
  audit: EnglishEvidenceAuditRecord,
  assertionIds: Map<string, number>,
  source: string
): number {
  const resource = audit.resources.find(
    (candidate) => candidate.source === source
  );
  const id = resource?.resourceId;
  const assertionId =
    id === undefined ? undefined : assertionIds.get(`${source}:${id}`);
  if (!assertionId) {
    throw new Error(
      `missing-canonical-resource-assertion:${audit.key}:${source}`
    );
  }
  return assertionId;
}

function addEnglishAuditIssues(input: {
  audit: EnglishEvidenceAuditRecord;
  entryKey: string;
  meaningFieldId?: number;
  auditAssertionId: number;
  issue: (input: {
    entryKey: string;
    fieldVersionId?: number | null;
    sourceAssertionId?: number | null;
    code: string;
    severity: "info" | "warning" | "blocker";
    details?: Record<string, unknown>;
  }) => void;
}): void {
  const { audit } = input;
  const status = selectCanonicalEnglishStatus(audit);
  if (audit.reconstruction && !audit.reconstruction.applied) {
    input.issue({
      entryKey: input.entryKey,
      fieldVersionId: input.meaningFieldId,
      sourceAssertionId: input.auditAssertionId,
      code: "greek-reconstruction-blocked",
      severity: "blocker",
      details: {
        blockers: audit.reconstruction.blockers,
        catalogDigest: audit.reconstruction.catalogDigest,
        proof: audit.reconstruction.proof,
        reconstructionDigest: audit.reconstruction.reconstructionDigest
      }
    });
  }
  if (audit.decision.status === "repaired" && status !== "validated") {
    input.issue({
      entryKey: input.entryKey,
      fieldVersionId: input.meaningFieldId,
      sourceAssertionId: input.auditAssertionId,
      code: "english-source-repaired-review-needed",
      severity: "blocker",
      details: {
        canonicalSource: audit.decision.canonicalSource,
        quarantinedSources: audit.decision.quarantinedSources,
        reasonCodes: audit.decision.reasonCodes
      }
    });
  } else if (status === "review_needed") {
    input.issue({
      entryKey: input.entryKey,
      fieldVersionId: input.meaningFieldId,
      sourceAssertionId: input.auditAssertionId,
      code: "english-source-review-needed",
      severity: "blocker",
      details: {
        canonicalSource: audit.decision.canonicalSource,
        quarantinedSources: audit.decision.quarantinedSources,
        reasonCodes: audit.decision.reasonCodes
      }
    });
  } else if (status === "source_issue") {
    input.issue({
      entryKey: input.entryKey,
      fieldVersionId: input.meaningFieldId,
      sourceAssertionId: input.auditAssertionId,
      code: "english-source-quarantined",
      severity: "blocker",
      details: {
        canonicalSource: audit.decision.canonicalSource,
        quarantinedSources: audit.decision.quarantinedSources,
        reasonCodes: audit.decision.reasonCodes
      }
    });
  }

  const sourceAudit = audit.evidence.sourceAudit as {
    findings?: Array<{
      code?: string;
      severity?: "info" | "warning" | "error";
      message?: string;
      evidence?: Record<string, unknown>;
    }>;
  };
  const curatedVariant = audit.decision.reasonCodes.includes(
    "curated-source-variant"
  );
  const curatedAutoValidated = isCuratedAutoValidatedEnglishEvidence(
    audit.decision
  );
  const quarantinedSupplement = audit.decision.reasonCodes.includes(
    "tflsj-supplemental-quarantined-headword-mismatch"
  );
  for (const finding of sourceAudit.findings ?? []) {
    if (!finding.code) continue;
    const severity =
      curatedAutoValidated ||
      (quarantinedSupplement && finding.code === "resource-headword-mismatch")
        ? "info"
        : finding.severity === "error"
          ? curatedVariant
            ? "info"
            : audit.decision.status === "repaired"
              ? "warning"
              : "blocker"
          : finding.severity === "warning"
            ? "warning"
            : "info";
    input.issue({
      entryKey: input.entryKey,
      fieldVersionId: input.meaningFieldId,
      sourceAssertionId: input.auditAssertionId,
      code: `english-audit-${finding.code}`,
      severity,
      details: { message: finding.message, evidence: finding.evidence }
    });
  }
}

function selectCanonicalEnglishStatus(
  audit: EnglishEvidenceAuditRecord
): "validated" | "review_needed" | "source_issue" {
  if (audit.decision.status === "quarantined") return "source_issue";
  if (isCuratedAutoValidatedEnglishEvidence(audit.decision)) {
    return "validated";
  }
  if (
    audit.decision.status === "source-conflict" ||
    audit.decision.status === "repaired"
  ) {
    return "review_needed";
  }
  return "validated";
}

function insertFrenchReviewContent(
  context: BuildContext,
  entryStates: Map<string, EntryBuildState>
): void {
  const sourceId = context.sourceIds.FRENCH_REVIEW;
  if (!sourceId) throw new Error("missing-french-review-source");
  const db = context.target;
  const insertAssertion = db.prepare(
    `INSERT INTO LexiconSourceAssertions (
       sourceId, entryKey, scope, field, locale, valueText, valueHtml,
       locator, sha256, createdAt
     ) VALUES (?, ?, ?, ?, 'fr', ?, ?, ?, ?, ?)`
  );
  const insertField = db.prepare(
    `INSERT INTO LexiconFieldVersions (
       entryKey, locale, field, valueText, valueHtml, state, confidence,
       method, generator, promptVersion, derivedFromVersionId, contentHash,
       createdAt
     ) VALUES (?, 'fr', ?, ?, ?, ?, ?, 'model', ?, ?, ?, ?, ?)`
  );
  const insertEvidence = db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight, detailsJson, createdAt
     ) VALUES (?, ?, 'review', 'supports', ?, ?, ?, ?)`
  );
  const insertReview = db.prepare(
    `INSERT INTO LexiconFieldReviews (
       fieldVersionId, reviewerType, reviewer, verdict, reason,
       artifactHash, createdAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertIssue = db.prepare(
    `INSERT INTO LexiconIssues (
       entryKey, fieldVersionId, sourceAssertionId, code, severity, status,
       detailsJson, createdAt
     ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
  );
  const insertCarrier = db.prepare(
    `INSERT INTO LexiconCarrierTerms (
       entryKey, strong, stepStrong, locale, surface, normalized, termKind,
       state, policy, confidence, derivedFromVersionId, contentHash, createdAt
     ) VALUES (?, ?, ?, 'fr', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertCarrierEvidence = db.prepare(
    `INSERT INTO LexiconCarrierEvidence (
       carrierTermId, sourceId, sourceAssertionId, witnessFamily, verseRef,
       evidenceKind, stance, observedSurface, occurrenceCount, weight,
       detailsJson, createdAt
     ) VALUES (?, ?, ?, ?, NULL, 'review', ?, ?, 1, ?, ?, ?)`
  );

  for (const review of context.reviews.values()) {
    const state = entryStates.get(review.entryKey);
    if (!state)
      throw new Error(`missing-entry-state-for-french:${review.entryKey}`);
    const audit = state.audit;
    // The review hash is sealed against the release-scoped French packet,
    // while the rebuilt authoring bundle has its own source-lineage hash.
    // Their visible English and exact release parents were already compared
    // by assertFrenchPacketsMatchReviewedEnglish/readFrenchReview above.
    const reviewAssertionId = rowId(
      insertAssertion.run(
        sourceId,
        review.entryKey,
        "entry",
        "resource",
        JSON.stringify(review),
        null,
        `french-review:${review.artifactHash}`,
        review.artifactHash,
        context.generatedAt
      ).lastInsertRowid
    );
    const proposal = review.arbiter?.proposal;
    if (
      review.status === "blocked_source_issue" ||
      review.status === "failed" ||
      !proposal
    ) {
      insertIssue.run(
        review.entryKey,
        null,
        reviewAssertionId,
        review.status === "failed"
          ? "french-review-failed"
          : "french-review-not-importable",
        review.status === "failed" ? "warning" : "blocker",
        JSON.stringify({ status: review.status, issues: review.issues }),
        context.generatedAt
      );
      continue;
    }
    if (!proposal.glossFr.trim() || !proposal.meaningFr.trim()) {
      insertIssue.run(
        review.entryKey,
        null,
        reviewAssertionId,
        "missing-french-display-content",
        "blocker",
        JSON.stringify({ status: review.status }),
        context.generatedAt
      );
      continue;
    }
    if (
      review.status === "auto_validated" &&
      review.arbiter?.validation.canPublishDisplay !== true
    ) {
      throw new Error(`unsafe-auto-validated-french-review:${review.entryKey}`);
    }
    if (!state.glossFieldId || !state.meaningFieldId) {
      insertIssue.run(
        review.entryKey,
        null,
        reviewAssertionId,
        "french-missing-english-parent",
        "blocker",
        JSON.stringify({
          glossFieldId: state.glossFieldId,
          meaningFieldId: state.meaningFieldId
        }),
        context.generatedAt
      );
      continue;
    }

    const reviewState =
      review.status === "human_validated"
        ? "human_validated"
        : review.status === "auto_validated"
          ? "auto_validated"
          : "candidate";
    const glossState =
      state.glossState === "blocked_source_issue"
        ? "blocked_source_issue"
        : state.englishStatus === "review_needed"
          ? "candidate"
          : reviewState;
    const meaningState =
      state.meaningState === "blocked_source_issue"
        ? "blocked_source_issue"
        : state.englishStatus === "review_needed"
          ? "candidate"
          : reviewState;
    const generator = frenchReviewGenerator(review);
    const glossAssertionId = rowId(
      insertAssertion.run(
        sourceId,
        review.entryKey,
        "entry",
        "gloss",
        proposal.glossFr.trim(),
        null,
        `french-review:${review.artifactHash}:gloss`,
        sha256(proposal.glossFr.trim()),
        context.generatedAt
      ).lastInsertRowid
    );
    const meaningAssertionId = rowId(
      insertAssertion.run(
        sourceId,
        review.entryKey,
        "entry",
        "meaning",
        proposal.meaningFr.trim(),
        proposal.meaningHtmlFr.trim() || null,
        `french-review:${review.artifactHash}:meaning`,
        sha256(
          `${proposal.meaningFr.trim()}\u0000${proposal.meaningHtmlFr.trim()}`
        ),
        context.generatedAt
      ).lastInsertRowid
    );
    const glossFieldId = rowId(
      insertField.run(
        review.entryKey,
        "gloss",
        proposal.glossFr.trim(),
        null,
        glossState,
        proposal.confidence,
        generator,
        review.packetHash,
        state.glossFieldId,
        fieldContentHash({
          entryKey: review.entryKey,
          locale: "fr",
          field: "gloss",
          valueText: proposal.glossFr.trim(),
          valueHtml: null,
          derivedFromVersionId: state.glossFieldId,
          anchor: review.artifactHash
        }),
        context.generatedAt
      ).lastInsertRowid
    );
    const meaningFieldId = rowId(
      insertField.run(
        review.entryKey,
        "meaning",
        proposal.meaningFr.trim(),
        proposal.meaningHtmlFr.trim() || null,
        meaningState,
        proposal.confidence,
        generator,
        review.packetHash,
        state.meaningFieldId,
        fieldContentHash({
          entryKey: review.entryKey,
          locale: "fr",
          field: "meaning",
          valueText: proposal.meaningFr.trim(),
          valueHtml: proposal.meaningHtmlFr.trim() || null,
          derivedFromVersionId: state.meaningFieldId,
          anchor: review.artifactHash
        }),
        context.generatedAt
      ).lastInsertRowid
    );
    for (const [fieldVersionId, assertionId, fieldName] of [
      [glossFieldId, glossAssertionId, "gloss"],
      [meaningFieldId, meaningAssertionId, "meaning"]
    ] as const) {
      insertEvidence.run(
        fieldVersionId,
        assertionId,
        frenchReviewWitnessFamily(review),
        proposal.confidence,
        JSON.stringify({
          artifactHash: review.artifactHash,
          field: fieldName,
          ...frenchReviewEvidenceProvenance(review)
        }),
        context.generatedAt
      );
      insertReview.run(
        fieldVersionId,
        review.status === "human_validated" ? "human" : "model",
        generator,
        reviewState === "candidate" ? "needs_review" : "accept",
        review.issues.join("; ") || "French review artifact imported.",
        review.artifactHash,
        context.generatedAt
      );
    }
    if (meaningState === "blocked_source_issue") {
      insertIssue.run(
        review.entryKey,
        meaningFieldId,
        meaningAssertionId,
        "french-meaning-blocked-by-english-rights",
        "blocker",
        JSON.stringify({ englishMeaningFieldId: state.meaningFieldId }),
        context.generatedAt
      );
    }
    if (reviewState === "candidate" || review.issues.length > 0) {
      insertIssue.run(
        review.entryKey,
        meaningFieldId,
        reviewAssertionId,
        "french-review-needed",
        "warning",
        JSON.stringify({ issues: review.issues }),
        context.generatedAt
      );
    }
    if (proposal.notesFr.trim()) {
      insertIssue.run(
        review.entryKey,
        null,
        reviewAssertionId,
        "french-notes-retained-in-review-artifact",
        "info",
        JSON.stringify({ notesFr: proposal.notesFr.trim() }),
        context.generatedAt
      );
    }

    insertFrenchCarriers({
      context,
      review,
      proposal,
      audit,
      sourceId,
      glossFieldId,
      glossState,
      insertAssertion,
      insertCarrier,
      insertCarrierEvidence
    });
  }
}

function insertFrenchCarriers(input: {
  context: BuildContext;
  review: FrenchReviewRecord;
  proposal: FrenchLexiconProposal;
  audit: EnglishEvidenceAuditRecord;
  sourceId: number;
  glossFieldId: number;
  glossState: string;
  insertAssertion: StatementSync;
  insertCarrier: StatementSync;
  insertCarrierEvidence: StatementSync;
}): void {
  const identity = buildLexiconEntryIdentity(input.audit);
  const strong = normalizeClassicalStrong(input.audit.eStrong);
  if (!strong) return;
  const seen = new Set<string>();
  for (const [index, decision] of input.review.carrierTerms.entries()) {
    const surface = decision.surface.trim();
    const normalized = decision.normalized.trim();
    if (!surface || !normalized) continue;
    const duplicateKey = `${strong}:${identity.primaryDStrong}:${normalized}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    const parentPublishable = ["auto_validated", "human_validated"].includes(
      input.glossState
    );
    const parentBlocked = input.glossState === "blocked_source_issue";
    const state = parentBlocked
      ? "rejected"
      : parentPublishable
        ? decision.state === "blocked"
          ? "rejected"
          : decision.state
        : "candidate";
    const policy = parentBlocked
      ? "blocked"
      : parentPublishable
        ? decision.policy
        : "review_only";
    const termKind = /\s/u.test(surface) ? "phrase" : "word";
    const carrierAssertionId = rowId(
      input.insertAssertion.run(
        input.sourceId,
        input.review.entryKey,
        "entry",
        "carrier",
        surface,
        null,
        `french-review:${input.review.artifactHash}:carrier:${index}`,
        sha256(
          stableJson({ decision, artifactHash: input.review.artifactHash })
        ),
        input.context.generatedAt
      ).lastInsertRowid
    );
    const contentHash = sha256(
      stableJson({
        entryKey: input.review.entryKey,
        strong,
        stepStrong: identity.primaryDStrong,
        surface,
        normalized,
        termKind,
        state,
        policy,
        artifactHash: input.review.artifactHash
      })
    );
    const carrierTermId = rowId(
      input.insertCarrier.run(
        input.review.entryKey,
        strong,
        identity.primaryDStrong,
        surface,
        normalized,
        termKind,
        state,
        policy,
        decision.confidence,
        input.glossFieldId,
        contentHash,
        input.context.generatedAt
      ).lastInsertRowid
    );
    const families =
      decision.witnessFamilies.length > 0
        ? [...new Set(decision.witnessFamilies)]
        : ["lexicon-v3-french-review"];
    for (const family of families) {
      input.insertCarrierEvidence.run(
        carrierTermId,
        input.sourceId,
        carrierAssertionId,
        family,
        policy === "blocked" ? "context" : "supports",
        surface,
        decision.confidence,
        JSON.stringify({
          sources: decision.sources,
          reason: decision.reason,
          artifactHash: input.review.artifactHash
        }),
        input.context.generatedAt
      );
    }
  }
}

function normalizeClassicalStrong(value: string): string | null {
  const match = /^([GH])0*(\d{1,5})/iu.exec(value.trim());
  if (!match) return null;
  return `${match[1]?.toUpperCase()}${String(Number(match[2])).padStart(4, "0")}`;
}

function fieldContentHash(input: {
  entryKey: string;
  locale: "en" | "fr";
  field: "gloss" | "meaning" | "notes";
  valueText: string;
  valueHtml: string | null;
  derivedFromVersionId?: number | null;
  anchor: string;
}): string {
  void input.anchor;
  return lexiconV3FieldContentHash({
    entryKey: input.entryKey,
    locale: input.locale,
    field: input.field,
    valueText: input.valueText,
    valueHtml: input.valueHtml,
    derivedFromVersionId: input.derivedFromVersionId ?? null
  });
}

function buildSummary(
  db: DatabaseSync,
  input: {
    generatedAt: string;
    options: BuildLexiconV3AuthoringOptions;
    databaseDigest: string;
    entitiesDatabaseDigest: string;
    englishAuditDigest: string;
    frenchReviewDigest: string | null;
    frenchPacketsDigest: string | null;
    frenchPacketSummaryDigest: string | null;
    frenchRemediationSummaryDigest: string | null;
    hebrewEnglishDigest: string | null;
    hebrewEnglishSummaryDigest: string | null;
    reviewDecisionsDigest: string | null;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    codeFingerprint: string;
    englishReviewDecisionsFingerprint: string;
    englishLineageFingerprint: string;
    englishSnapshotFingerprint: string;
    schema: LexiconV3SchemaVerification;
  }
): BuildLexiconV3AuthoringSummary {
  const count = (sql: string): number => {
    const row = db.prepare(sql).get() as { count: number };
    return Number(row.count);
  };
  return {
    schemaVersion: AUTHORING_SUMMARY_SCHEMA,
    generatedAt: input.generatedAt,
    output: input.options.output,
    inputs: {
      database: input.options.database,
      entitiesDatabase: input.options.entitiesDatabase,
      hebrewSourcesDirectory: input.options.hebrewSourcesDirectory ?? null,
      englishAudit: input.options.englishAudit,
      frenchReview: input.options.frenchReview ?? null,
      frenchPackets: input.options.frenchPackets ?? null,
      frenchPacketSummary: input.options.frenchPacketSummary ?? null,
      frenchRemediationSummary: input.options.frenchRemediationSummary ?? null,
      hebrewEnglish: input.options.hebrewEnglish ?? null,
      hebrewEnglishSummary: input.options.hebrewEnglishSummary ?? null,
      reviewDecisions: input.options.reviewDecisions ?? null
    },
    digests: {
      database: input.databaseDigest,
      entitiesDatabase: input.entitiesDatabaseDigest,
      englishAudit: input.englishAuditDigest,
      frenchReview: input.frenchReviewDigest,
      frenchPackets: input.frenchPacketsDigest,
      frenchPacketSummary: input.frenchPacketSummaryDigest,
      frenchRemediationSummary: input.frenchRemediationSummaryDigest,
      hebrewEnglish: input.hebrewEnglishDigest,
      hebrewEnglishSummary: input.hebrewEnglishSummaryDigest,
      reviewDecisions: input.reviewDecisionsDigest,
      sourceFingerprint: input.sourceFingerprint,
      sourceLogicalFingerprint: input.sourceLogicalFingerprint,
      codeFingerprint: input.codeFingerprint,
      englishReviewDecisionsFingerprint:
        input.englishReviewDecisionsFingerprint,
      englishLineageFingerprint: input.englishLineageFingerprint,
      englishSnapshotFingerprint: input.englishSnapshotFingerprint
    },
    counts: {
      entries: count("SELECT count(*) AS count FROM LexiconEntries"),
      entryIds: count("SELECT count(*) AS count FROM LexiconEntryIds"),
      sources: count("SELECT count(*) AS count FROM LexiconSources"),
      assertions: count(
        "SELECT count(*) AS count FROM LexiconSourceAssertions"
      ),
      englishFields: count(
        "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'en'"
      ),
      frenchFields: count(
        "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'fr'"
      ),
      englishCandidateFields: count(
        "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'en' AND state = 'candidate'"
      ),
      englishBlockedSourceFields: count(
        "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'en' AND state = 'blocked_source_issue'"
      ),
      frenchCandidateFields: count(
        "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'fr' AND state = 'candidate'"
      ),
      frenchBlockedSourceFields: count(
        "SELECT count(*) AS count FROM LexiconFieldVersions WHERE locale = 'fr' AND state = 'blocked_source_issue'"
      ),
      issues: count("SELECT count(*) AS count FROM LexiconIssues"),
      blockers: count(
        "SELECT count(*) AS count FROM LexiconIssues WHERE severity = 'blocker' AND status = 'open'"
      ),
      carriers: count("SELECT count(*) AS count FROM LexiconCarrierTerms"),
      carrierEvidence: count(
        "SELECT count(*) AS count FROM LexiconCarrierEvidence"
      ),
      hebrewCanonicalRawRestored: count(
        `SELECT count(DISTINCT field.entryKey) AS count
         FROM LexiconFieldVersions field
         JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
         WHERE field.entryKey LIKE 'hebrew:%'
           AND field.locale = 'en' AND field.field = 'meaning'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.action') = 'raw_combined'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.counterfactualAction')
               IN ('exact_companion', 'step_specific_only')
           AND json_extract(evidence.detailsJson, '$.publicationSelection.canonicalPolicyProof.proven') = 1`
      ),
      hebrewExactCompanionConservative: count(
        `SELECT count(DISTINCT field.entryKey) AS count
         FROM LexiconFieldVersions field
         JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
         WHERE field.entryKey LIKE 'hebrew:%'
           AND field.locale = 'en' AND field.field = 'meaning'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.action') = 'exact_companion'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.canonicalPolicyProof.basis') = 'conservative_exact_companion'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.canonicalPolicyProof.proven') = 1`
      ),
      hebrewPositiveConflictRepairs: count(
        `SELECT count(DISTINCT field.entryKey) AS count
         FROM LexiconFieldVersions field
         JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = field.id
         WHERE field.entryKey LIKE 'hebrew:%'
           AND field.locale = 'en' AND field.field = 'meaning'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.canonicalPolicyProof.basis') = 'positive_conflict_ledger'
           AND json_extract(evidence.detailsJson, '$.publicationSelection.canonicalPolicyProof.disposition')
               IN ('publish_exact_companion', 'publish_step_specific')
           AND json_extract(evidence.detailsJson, '$.publicationSelection.canonicalPolicyProof.proven') = 1`
      ),
      hebrewCanonicalGlossReplacements: count(
        "SELECT count(*) AS count FROM LexiconIssues WHERE code = 'hebrew-canonical-gloss-replaced'"
      ),
      hebrewIdentityCorrections: count(
        "SELECT count(*) AS count FROM LexiconIssues WHERE code = 'hebrew-identity-canonical-correction-applied'"
      )
    },
    schema: input.schema
  };
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function rowId(value: number | bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new Error(`invalid-sqlite-row-id:${String(value)}`);
  }
  return result;
}

export function parseBuildLexiconV3AuthoringArgs(
  args: readonly string[]
): BuildLexiconV3AuthoringOptions {
  const allowed = new Set([
    "db",
    "entities-db",
    "hebrew-sources-dir",
    "english-audit",
    "audit-en",
    "french-review",
    "review-fr",
    "french-packets",
    "packets-fr",
    "french-packet-summary",
    "packet-summary-fr",
    "french-remediation-summary",
    "remediation-summary-fr",
    "french-configuration",
    "french-canonical-entities",
    "french-canonical-entry-policies",
    "french-entity-merge-attestation",
    "french-entity-gate",
    "french-entity-mentions",
    "french-entity-mention-resolution-attestation",
    "french-entity-packets",
    "hebrew-english",
    "hebrew-english-summary",
    "review-decisions",
    "decisions",
    "output",
    "summary-json"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (!arg.startsWith("--")) throw new Error(`unexpected-argument:${arg}`);
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key || !allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const next = args[index + 1];
    if (inlineValue !== undefined) {
      if (!inlineValue) throw new Error(`missing-value:${key}`);
      values.set(key, inlineValue);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else throw new Error(`missing-value:${key}`);
  }
  for (const [left, right] of [
    ["english-audit", "audit-en"],
    ["french-review", "review-fr"],
    ["french-packets", "packets-fr"],
    ["french-packet-summary", "packet-summary-fr"],
    ["french-remediation-summary", "remediation-summary-fr"],
    ["review-decisions", "decisions"]
  ] as const) {
    if (values.has(left) && values.has(right)) {
      throw new Error(`conflicting-options:${left}:${right}`);
    }
  }
  const frenchReview =
    values.get("french-review") ?? values.get("review-fr") ?? undefined;
  const frenchPackets = frenchReview
    ? (values.get("french-packets") ??
      values.get("packets-fr") ??
      DEFAULT_FRENCH_PACKETS)
    : undefined;
  const frenchPacketSummary = frenchReview
    ? (values.get("french-packet-summary") ??
      values.get("packet-summary-fr") ??
      DEFAULT_FRENCH_PACKET_SUMMARY)
    : undefined;
  const frenchRemediationSummary =
    values.get("french-remediation-summary") ??
    values.get("remediation-summary-fr") ??
    undefined;
  if (frenchRemediationSummary && !frenchReview) {
    throw new Error("french-remediation-summary-requires-review");
  }
  const reviewDecisions =
    values.get("review-decisions") ?? values.get("decisions") ?? undefined;
  const hebrewEnglishValue =
    values.get("hebrew-english") ?? DEFAULT_HEBREW_ENGLISH;
  const hebrewEnglishSummaryValue =
    values.get("hebrew-english-summary") ?? DEFAULT_HEBREW_ENGLISH_SUMMARY;
  return {
    database: values.get("db") ?? DEFAULT_DATABASE,
    entitiesDatabase: values.get("entities-db") ?? DEFAULT_ENTITIES_DATABASE,
    hebrewSourcesDirectory:
      values.get("hebrew-sources-dir") ?? DEFAULT_HEBREW_SOURCES,
    englishAudit:
      values.get("english-audit") ??
      values.get("audit-en") ??
      DEFAULT_ENGLISH_AUDIT,
    frenchReview,
    frenchPackets,
    frenchPacketSummary,
    frenchRemediationSummary,
    frenchConfiguration: frenchReview
      ? (values.get("french-configuration") ??
        DEFAULT_FRENCH_INTERNAL_CONFIGURATION)
      : undefined,
    frenchCanonicalEntities: frenchReview
      ? (values.get("french-canonical-entities") ??
        DEFAULT_FRENCH_CANONICAL_ENTITIES)
      : undefined,
    frenchCanonicalEntryPolicies: frenchReview
      ? (values.get("french-canonical-entry-policies") ??
        DEFAULT_FRENCH_CANONICAL_ENTRY_POLICIES)
      : undefined,
    frenchEntityMergeAttestation: frenchReview
      ? (values.get("french-entity-merge-attestation") ??
        DEFAULT_FRENCH_ENTITY_MERGE_ATTESTATION)
      : undefined,
    frenchEntityGate: frenchReview
      ? (values.get("french-entity-gate") ?? DEFAULT_FRENCH_ENTITY_GATE)
      : undefined,
    frenchEntityMentions: frenchReview
      ? (values.get("french-entity-mentions") ?? DEFAULT_FRENCH_ENTITY_MENTIONS)
      : undefined,
    frenchEntityMentionResolutionAttestation: frenchReview
      ? (values.get("french-entity-mention-resolution-attestation") ??
        DEFAULT_FRENCH_ENTITY_MENTION_RESOLUTION_ATTESTATION)
      : undefined,
    frenchEntityPackets: frenchReview
      ? (values.get("french-entity-packets") ?? DEFAULT_FRENCH_ENTITY_PACKETS)
      : undefined,
    hebrewEnglish:
      hebrewEnglishValue === "none" ? undefined : hebrewEnglishValue,
    hebrewEnglishSummary:
      hebrewEnglishSummaryValue === "none"
        ? undefined
        : hebrewEnglishSummaryValue,
    reviewDecisions,
    output: values.get("output") ?? DEFAULT_OUTPUT,
    summaryJson: values.get("summary-json") ?? DEFAULT_SUMMARY
  };
}

async function main(): Promise<void> {
  const summary = await buildLexiconV3Authoring(
    parseBuildLexiconV3AuthoringArgs(process.argv.slice(2))
  );
  console.log(JSON.stringify(summary, null, 2));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `${basename(process.argv[1] ?? "buildLexiconV3Authoring")}: ${message}`
    );
    process.exitCode = 1;
  });
}
