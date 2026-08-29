import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from "node:fs";
import { dirname, resolve } from "node:path";

import {
  contentHash as frenchEditorialContentHash,
  FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION,
  FRENCH_EDITORIAL_POLICY_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
  FRENCH_MORPHOLOGY_SCHEMA_VERSION,
  FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION,
  THEOLOGICAL_REVIEW_BASE_STRONGS,
  type FrenchEditorialPos,
  type FrenchEditorialStatus
} from "./frenchEditorialPolicy.js";
import {
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "./frenchPackets.js";
import {
  assertFrenchPacketTranslatable,
  FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION,
  FRENCH_PRETRANSLATION_POLICY_VERSION,
  type FrenchPretranslationAuditRecord
} from "./frenchPretranslationQuality.js";
import {
  buildFrenchHtmlTemplate,
  type FrenchHtmlTemplate
} from "./frenchHtmlRenderer.js";
import {
  assertFrenchReuseManifest,
  FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
  FRENCH_REUSE_POLICY_VERSION,
  type FrenchReuseManifestSummary,
  type FrenchReuseMeaningCohort,
  type FrenchReuseRecord
} from "./frenchReuseManifest.js";
import { stripLexiconHtml } from "./frenchValidation.js";
import { buildLexiconEntryKey, extractPrimaryDStrong } from "./identity.js";
import {
  HEBREW_IDENTITY_CORRECTIONS,
  HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
} from "./hebrewIdentityCorrections.js";
import {
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationGateResult
} from "./frenchEntityCanonicalization.js";
import type { FrenchEntityAgentTerminalGateResult } from "./frenchEntityAgentReview.js";
import {
  type FrenchEntityMentionsArtifact,
  type RequiredFrenchEntityMention
} from "./frenchEntityMentions.js";
import { assertFrenchEntityPipelineArtifacts } from "./frenchEntityPipeline.js";
import type { FrenchEntityMentionResolutionAttestation } from "./frenchEntityMentionResolution.js";
import {
  assertFrenchEntityMergeAttestationAtPath,
  assertFrenchEntityMergeAttestationArtifactShape,
  type FrenchEntityMergeAttestationArtifact
} from "./frenchEntityMergeAttestation.js";

export const FRENCH_INTERNAL_WORK_POLICY_VERSION =
  "lexicon-v3-french-internal-work-policy@6" as const;
export const FRENCH_INTERNAL_WORK_VIEW_SCHEMA_VERSION =
  "lexicon-v3-french-internal-work-view@4" as const;
export const FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION =
  "lexicon-v3-french-internal-proposer-input@4" as const;
export const FRENCH_INTERNAL_PILOT_SCHEMA_VERSION =
  "lexicon-v3-french-internal-pilot@3" as const;
export const FRENCH_INTERNAL_PILOT_SELECTION_SCHEMA_VERSION =
  "lexicon-v3-french-internal-pilot-selection@3" as const;
export const FRENCH_INTERNAL_SHARDS_SCHEMA_VERSION =
  "lexicon-v3-french-internal-shards@3" as const;
export const FRENCH_INTERNAL_SHARD_SCHEMA_VERSION =
  "lexicon-v3-french-internal-shard@3" as const;
export const FRENCH_INTERNAL_SHARD_ITEM_SCHEMA_VERSION =
  "lexicon-v3-french-internal-shard-item@3" as const;
export const FRENCH_INTERNAL_WORK_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-internal-work-summary@3" as const;

export const FRENCH_INTERNAL_HISTORICAL_EN_1_BASELINE = {
  expectedEntryCount: 22_717,
  expectedPilotSize: 300,
  packetOutputDigest:
    "fa4bba35ce884008daacac97c6c1c55f4c4f29bc12cad1a2da9a9f8044ab7b63",
  reuseRecordsOutputDigest:
    "0ab2bc6019584f0c93933ee9fda8ec17b5fd7051ceb442d5a7b97bb01bcc8801",
  authoringDigest:
    "e1bcf69d5009f2e99762d24a750faa1a9b4653abec649d80a8f85115e24b3e60",
  legacyFullDigest:
    "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
  releaseKey: "lexicon-v3-en-2026-07-13.1",
  releaseSnapshotFingerprint:
    "7d643c0a9fa72fe7258071b23e363c651d0162517078f2d0901408cb599d8c17"
} as const;

export type FrenchInternalMeaningSize =
  | "short"
  | "medium"
  | "long"
  | "very_long";

export type FrenchInternalLegacyHtmlCategory =
  | "absent"
  | "normalized_equivalent"
  | "normalized_divergent";

export interface FrenchInternalWorkExpectations {
  expectedEntryCount: number;
  expectedPilotSize: number;
  packetOutputDigest?: string;
  reuseRecordsOutputDigest?: string;
  authoringDigest?: string;
  legacyFullDigest?: string;
  releaseKey?: string;
  releaseSnapshotFingerprint?: string;
}

/** Stable gates only; release-specific hashes are replayed from the inputs. */
export const FRENCH_INTERNAL_DEFAULT_EXPECTATIONS = {
  expectedEntryCount: 22_717,
  expectedPilotSize: 300,
  legacyFullDigest:
    "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8"
} as const satisfies FrenchInternalWorkExpectations;

export interface FrenchInternalPacketBuildSummary {
  schemaVersion: "lexicon-v3-french-packet-build@3";
  generatedAt: string;
  inputRecords: number;
  outputPackets: number;
  englishStatusCounts: Record<string, number>;
  sourceDigests: {
    englishEvidence: string;
    fullDatabase: string;
    legacyDatabase: string;
    Sg1910: string;
    Darby: string;
    DarbyR: string;
    englishAuthoring: string;
  };
  englishAuthoring: {
    path: string;
    digest: string;
  };
  englishRelease: {
    releaseKey: string;
    releaseId: number;
    state: "promoted";
    snapshotFingerprint: string;
    codeFingerprint: string;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    policyVersion: string;
    expectedEntryCount: number;
    fieldCount: number;
  };
  outputDigest: string;
}

export interface FrenchEditorialEntityRecord {
  schemaVersion: typeof FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: {
    language: "greek" | "hebrew";
    primaryDStrong: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    morph: string;
  };
  englishGloss: string;
  status: FrenchEditorialStatus;
  canonicalFr: string | null;
  reasons: string[];
  matches: Array<{
    entityId: number;
    significance: string;
    aliasEn: string;
    entityEn: string;
    candidateFr: string;
    category: string;
    type: string;
  }>;
  referenceEvidence: Array<Record<string, unknown>>;
  historicalCandidate: {
    gloss: string;
    trust: "untrusted-candidate";
    sourceHash: string;
  } | null;
  inputHash: string;
  contentHash: string;
}

export interface FrenchEditorialTermbaseRecord {
  schemaVersion: typeof FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: {
    language: "greek" | "hebrew";
    primaryDStrong: string;
    classicalStrong: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  english: {
    gloss: string;
    meaning: string;
    glossStatusHash: string;
    meaningStatusHash: string;
  };
  pos: FrenchEditorialPos;
  status: FrenchEditorialStatus;
  canonicalFr: string | null;
  reasons: string[];
  historicalFrench: {
    gloss: string;
    meaning: string;
    meaningHtml: string;
    trust: "untrusted-candidate";
    sourceHash: string;
  } | null;
  legacyFrench: {
    gloss: string;
    meaning: string;
    type: string;
    trust: "untrusted-candidate";
    evidenceScope: "classical-strong-only";
    sourceHash: string;
  } | null;
  concordanceForms: Array<Record<string, unknown>>;
  deterministicRepairCandidate: {
    gloss: string;
    rule: "remove-pour-before-infinitive-candidate";
    trust: "untrusted-candidate";
  } | null;
  inputHash: string;
  contentHash: string;
}

export interface FrenchEditorialMorphologyRecord {
  schemaVersion: typeof FRENCH_MORPHOLOGY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  inputHash: string;
  contentHash: string;
  morphologyCodeId: number;
  code: string;
  normalizedCode: string;
  source: string;
  scope: string;
  sourceLanguage: string;
  language: "fr";
  meaning: string;
  description: string;
  example: string;
  structuredPairs: Array<{ field: string; source: string; french: string }>;
}

export interface FrenchEditorialBuildSummaryInput {
  schemaVersion: typeof FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_EDITORIAL_POLICY_VERSION;
  generatedAt: string;
  releaseKey: string;
  counts: {
    books: number;
    entries: number;
    entityRegistry: number;
    entityStatus: Record<string, number>;
    termbaseCandidates: number;
    termbaseStatus: Record<string, number>;
    morphologyTranslations: number;
    morphologyScopes: Record<string, number>;
    historicalFrenchCandidates: number;
    legacyCandidates: number;
    concordanceFormsAttached: number;
  };
  sourceDigests: Record<string, string>;
  artifacts: Record<
    "bookRegistry" | "entityRegistry" | "termbaseCandidates" | "morphology",
    { path: string; sha256: string; bytes: number; records: number }
  >;
  summaryContentHash: string;
}

export interface FrenchEditorialGuide extends Record<string, unknown> {
  schemaVersion: "lexicon-v3-french-editorial-guide@1";
  locale: "fr";
  releaseRule: string;
}

export interface FrenchInternalSourcePaths {
  packets: string;
  packetSummary: string;
  reuseRecords: string;
  reuseSummary: string;
  entityRegistry: string;
  canonicalEntities: string;
  canonicalEntryPolicies: string;
  entityMergeAttestation: string;
  entityGate: string;
  entityMentions: string;
  entityMentionResolutionAttestation?: string;
  termbase: string;
  morphology: string;
  editorialSummary: string;
  guide: string;
}

export interface FrenchInternalSourceDigests {
  packets: string;
  packetSummary: string;
  reuseRecords: string;
  reuseSummary: string;
  entityRegistry: string;
  canonicalEntities: string;
  canonicalEntryPolicies: string;
  entityMergeAttestation: string;
  entityGate: string;
  entityMentions: string;
  entityMentionResolutionAttestation?: string;
  termbase: string;
  morphology: string;
  editorialSummary: string;
  guide: string;
}

export interface FrenchInternalGlobalLineage {
  packetOutputDigest: string;
  packetAuthoringDigest: string;
  reuseRecordsOutputDigest: string;
  reuseManifestDigest: string;
  authoringDigest: string;
  legacyFullDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  editorialSummaryContentHash: string;
  editorialPolicyVersion: string;
  identityCorrectionsRegistryDigest: string;
  canonicalEntitiesHash: string;
  canonicalEntryPoliciesHash: string;
  entityMergeAttestationHash: string;
  entityMergeAttestationContentHash: string;
  entityGateHash: string;
  entityGateContentHash: string;
  entityMentionsHash: string;
  entityMentionsContentHash: string;
  entityMentionResolutionAttestationHash?: string;
  entityMentionResolutionAttestationContentHash?: string;
  guideSourceDigest: string;
  guideContentHash: string;
  sourceLogicalDigest: string;
}

export interface FrenchInternalWorkSources {
  packets: LexiconV3FrenchPacket[];
  packetSummary: FrenchInternalPacketBuildSummary;
  reuseRecords: FrenchReuseRecord[];
  reuseSummary: FrenchReuseManifestSummary;
  entities: FrenchEditorialEntityRecord[];
  canonicalEntities: FrenchCanonicalEntityRecord[];
  canonicalEntryPolicies: FrenchCanonicalEntryNamePolicy[];
  quarantinedEntryKeys: string[];
  entityMergeAttestation: FrenchEntityMergeAttestationArtifact;
  entityGate:
    | FrenchEntityCanonicalizationGateResult
    | FrenchEntityAgentTerminalGateResult;
  entityMentions: FrenchEntityMentionsArtifact;
  entityMentionResolutionAttestation: FrenchEntityMentionResolutionAttestation | null;
  termbase: FrenchEditorialTermbaseRecord[];
  morphology: FrenchEditorialMorphologyRecord[];
  editorialSummary: FrenchEditorialBuildSummaryInput;
  guide: FrenchEditorialGuide;
  sourcePaths: FrenchInternalSourcePaths;
  sourceDigests: FrenchInternalSourceDigests;
}

export interface FrenchInternalEntryLineage {
  sourceLogicalDigest: string;
  packetHash: string;
  englishHash: string;
  reuseRecordDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  glossParentContentHash: string;
  meaningParentContentHash: string;
  englishParents: LexiconV3FrenchPacket["englishRelease"]["parents"];
  pretranslationAuditHash: string;
  termbaseContentHash: string;
  entityContentHash: string | null;
  canonicalEntitiesHash: string;
  canonicalEntryPoliciesHash: string;
  entityMergeAttestationHash: string;
  entityMergeAttestationContentHash: string;
  entityGateHash: string;
  entityMentionsHash: string;
  canonicalEntryPolicyContentHash: string | null;
  canonicalEntityContentHashes: string[];
  requiredEntityMentionContentHashes: string[];
  morphologyContentHashes: string[];
  editorialSummaryContentHash: string;
  guideSourceDigest: string;
}

export interface FrenchInternalLegacyHtmlNormalization {
  category: Exclude<FrenchInternalLegacyHtmlCategory, "absent">;
  rawHtmlHash: string;
  normalizedVisibleText: string;
  normalizedVisibleTextHash: string;
  candidateMeaningNormalizedHash: string;
  textEquivalent: boolean;
}

export interface FrenchInternalWorkStrata {
  language: "greek" | "hebrew";
  meaningCohort: FrenchReuseMeaningCohort;
  pos: FrenchEditorialPos;
  properName: boolean;
  theological: boolean;
  legacyHtmlCategory: FrenchInternalLegacyHtmlCategory;
  meaningSize: FrenchInternalMeaningSize;
  riskCategories: string[];
}

export interface FrenchInternalCanonicalRegistryEntry {
  kind: "entity" | "termbase";
  status: "green";
  canonicalFr: string;
  sourceContentHash: string;
}

export interface FrenchInternalEntityConstraints {
  quarantined: boolean;
  entryPolicy: FrenchCanonicalEntryNamePolicy | null;
  mentionPolicies: FrenchCanonicalEntryNamePolicy[];
  canonicalEntities: FrenchCanonicalEntityRecord[];
  requiredMentions: RequiredFrenchEntityMention[];
  contextHash: string;
}

export interface FrenchInternalWorkView {
  schemaVersion: typeof FRENCH_INTERNAL_WORK_VIEW_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  viewKind: "full";
  entryKey: string;
  lineage: FrenchInternalEntryLineage;
  identity: LexiconV3FrenchPacket["identity"];
  english: LexiconV3FrenchPacket["english"];
  sourceEvidence: LexiconV3FrenchPacket["evidence"];
  protectedContent: LexiconV3FrenchPacket["protectedContent"];
  pretranslationAudit: FrenchPretranslationAuditRecord;
  reuse: FrenchReuseRecord;
  editorial: {
    termbase: FrenchEditorialTermbaseRecord;
    entity: FrenchEditorialEntityRecord | null;
    morphology: FrenchEditorialMorphologyRecord[];
  };
  entityConstraints: FrenchInternalEntityConstraints;
  guide: FrenchEditorialGuide;
  guideContentHash: string;
  legacyHtmlNormalization: FrenchInternalLegacyHtmlNormalization | null;
  strata: FrenchInternalWorkStrata;
  viewHash: string;
}

export interface FrenchInternalProposerBaseView {
  schemaVersion: typeof FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  entryKey: string;
  workViewHash: string;
  lineage: FrenchInternalEntryLineage;
  identity: LexiconV3FrenchPacket["identity"];
  english: LexiconV3FrenchPacket["english"];
  protectedContent: LexiconV3FrenchPacket["protectedContent"];
  publicationGate: {
    pretranslationAuditHash: string;
    gateStatus: "ready" | "review_needed";
    translationAllowed: true;
    autoPublicationAllowed: boolean;
    fourAgentReviewRequired: true;
    directPublicationAllowed: false;
  };
  translationTask: {
    locale: "fr";
    outputFields: [
      "glossFr",
      "meaningSegmentsFr",
      "entityMentionsFr",
      "notesFr",
      "carrierTermsFr"
    ];
    htmlRule: "translate-text-segments-only-html-rebuilt-locally";
    identityRule: "translate-exact-step-entry-never-generalize-to-classical-strong";
    htmlTemplate: FrenchHtmlTemplate;
  };
  guide: FrenchEditorialGuide;
  guideContentHash: string;
  canonicalRegistry: FrenchInternalCanonicalRegistryEntry[];
  entityConstraints: FrenchInternalEntityConstraints;
  morphology: FrenchEditorialMorphologyRecord[];
  translationProfile: {
    pos: FrenchEditorialPos;
    properName: boolean;
    theological: boolean;
    meaningCohort: FrenchReuseMeaningCohort;
    meaningSize: FrenchInternalMeaningSize;
    englishRiskCategories: string[];
  };
  viewHash: string;
}

export interface FrenchInternalProposerAView extends FrenchInternalProposerBaseView {
  viewKind: "proposer_a_blind";
  role: "proposerA";
  evidencePolicy: {
    mode: "blind-independent-translation";
    frenchEntryCandidatesExposed: false;
    allowedFrenchContext: [
      "editorial-guide",
      "green-canonical-registry",
      "canonical-entry-name-policies",
      "required-entity-mentions",
      "morphology-registry"
    ];
  };
}

export interface FrenchInternalCandidateEnvelope {
  trust: "untrusted-candidate";
  authoritative: false;
  usage: "compare-diagnose-never-copy-without-independent-validation";
  packet: {
    legacy:
      | (NonNullable<LexiconV3FrenchPacket["evidence"]["legacy"]> & {
          trust: "untrusted-candidate";
        })
      | null;
    existingFrench:
      | (NonNullable<LexiconV3FrenchPacket["evidence"]["existingFrench"]> & {
          sourceTrust: "untrusted-candidate" | "validated-resource";
          trust: "untrusted-candidate";
        })
      | null;
    resourceFrench: Array<
      LexiconV3FrenchPacket["evidence"]["resourceFrench"][number] & {
        sourceTrust: "untrusted-candidate" | "validated-resource";
        trust: "untrusted-candidate";
      }
    >;
    concordanceForms: Array<
      LexiconV3FrenchPacket["evidence"]["concordanceForms"][number] & {
        trust: "attested-carrier-review-only";
      }
    >;
  };
  editorial: {
    entityCandidates: {
      status: FrenchEditorialStatus;
      matches: FrenchEditorialEntityRecord["matches"];
      referenceEvidence: FrenchEditorialEntityRecord["referenceEvidence"];
      historicalCandidate: FrenchEditorialEntityRecord["historicalCandidate"];
      trust: "untrusted-candidate";
    } | null;
    historicalFrench: FrenchEditorialTermbaseRecord["historicalFrench"];
    legacyFrench: FrenchEditorialTermbaseRecord["legacyFrench"];
    concordanceForms: FrenchEditorialTermbaseRecord["concordanceForms"];
    deterministicRepairCandidate: FrenchEditorialTermbaseRecord["deterministicRepairCandidate"];
  };
  normalizedLegacyHtml: FrenchInternalLegacyHtmlNormalization | null;
  evidenceHash: string;
}

export interface FrenchInternalProposerBView extends FrenchInternalProposerBaseView {
  viewKind: "proposer_b_candidates";
  role: "proposerB";
  evidencePolicy: {
    mode: "candidate-aware-independent-review";
    candidatesAreAuthority: false;
    requireEnglishSemanticJustification: true;
  };
  candidateEvidence: FrenchInternalCandidateEnvelope;
}

export interface FrenchInternalPilotSelection {
  schemaVersion: typeof FRENCH_INTERNAL_PILOT_SELECTION_SCHEMA_VERSION;
  entryKey: string;
  workViewHash: string;
  proposerAViewHash: string;
  proposerBViewHash: string;
  lineage: FrenchInternalEntryLineage;
  strata: FrenchInternalWorkStrata;
  selectionReasons: string[];
  selectionHash: string;
}

export interface FrenchInternalPilotPlan {
  schemaVersion: typeof FRENCH_INTERNAL_PILOT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  sourceLogicalDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  pilotSize: number;
  keys: string[];
  selections: FrenchInternalPilotSelection[];
  strataCounts: FrenchInternalStrataCounts;
  contentHash: string;
}

export interface FrenchInternalShardItem {
  schemaVersion: typeof FRENCH_INTERNAL_SHARD_ITEM_SCHEMA_VERSION;
  entryKey: string;
  workViewHash: string;
  proposerAViewHash: string;
  proposerBViewHash: string;
  lineage: FrenchInternalEntryLineage;
  itemHash: string;
}

export interface FrenchInternalShard {
  schemaVersion: typeof FRENCH_INTERNAL_SHARD_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  shardId: string;
  sourceLogicalDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  meaningSize: FrenchInternalMeaningSize;
  maxItems: number;
  estimatedEnglishCharacters: number;
  resumeKey: string;
  items: FrenchInternalShardItem[];
  shardHash: string;
}

export interface FrenchInternalShardPlan {
  schemaVersion: typeof FRENCH_INTERNAL_SHARDS_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  sourceLogicalDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  resumeContract: {
    skipOnlyWhen: "validated-role-output-pins-exact-shard-and-view-hashes";
    changedViewCreatesNewResumeKey: true;
  };
  batchSizes: Record<FrenchInternalMeaningSize, number>;
  shards: FrenchInternalShard[];
  contentHash: string;
}

export interface FrenchInternalStrataCounts {
  languages: Record<string, number>;
  meaningCohorts: Record<string, number>;
  positions: Record<string, number>;
  properNames: Record<string, number>;
  theological: Record<string, number>;
  legacyHtmlCategories: Record<string, number>;
  meaningSizes: Record<string, number>;
  riskCategories: Record<string, number>;
}

export interface FrenchInternalArtifactMetadata {
  path: string;
  sha256: string;
  bytes: number;
  records: number;
  logicalDigest: string;
}

export interface FrenchInternalWorkOutputPaths {
  workItems: string;
  proposerA: string;
  proposerB: string;
  pilotKeys: string;
  shards: string;
  summary: string;
}

export interface FrenchInternalWorkSummary {
  schemaVersion: typeof FRENCH_INTERNAL_WORK_SUMMARY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  generatedAt: string;
  sourcePaths: FrenchInternalSourcePaths;
  sourceDigests: FrenchInternalSourceDigests;
  outputPaths: FrenchInternalWorkOutputPaths;
  lineage: FrenchInternalGlobalLineage;
  counts: {
    workItems: number;
    proposerAViews: number;
    proposerBViews: number;
    pilotKeys: number;
    shards: number;
    shardItems: number;
    sourceStrata: FrenchInternalStrataCounts;
    pilotStrata: FrenchInternalStrataCounts;
  };
  artifacts: {
    workItems: FrenchInternalArtifactMetadata;
    proposerA: FrenchInternalArtifactMetadata;
    proposerB: FrenchInternalArtifactMetadata;
    pilotKeys: FrenchInternalArtifactMetadata;
    shards: FrenchInternalArtifactMetadata;
  };
  summaryHash: string;
}

export interface FrenchInternalWorkBuild {
  workItems: FrenchInternalWorkView[];
  proposerAViews: FrenchInternalProposerAView[];
  proposerBViews: FrenchInternalProposerBView[];
  pilot: FrenchInternalPilotPlan;
  shards: FrenchInternalShardPlan;
  summary: FrenchInternalWorkSummary;
}

export interface FrenchInternalPilotViewExtraction {
  proposerAViews: FrenchInternalProposerAView[];
  proposerBViews: FrenchInternalProposerBView[];
}

export interface FrenchInternalPilotViewOutputPaths {
  proposerA: string;
  proposerB: string;
}

export interface FrenchInternalPilotViewWriteResult {
  outputPaths: FrenchInternalPilotViewOutputPaths;
  proposerA: {
    sha256: string;
    bytes: number;
    records: number;
  };
  proposerB: {
    sha256: string;
    bytes: number;
    records: number;
  };
}

export interface BuildFrenchInternalWorkOptions {
  sources: FrenchInternalWorkSources;
  outputPaths: FrenchInternalWorkOutputPaths;
  generatedAt?: string;
  expectations?: FrenchInternalWorkExpectations | null;
  pilotSize?: number;
  shardBatchSizes?: Partial<Record<FrenchInternalMeaningSize, number>>;
}

export interface LoadFrenchInternalWorkOptions {
  sourcePaths: FrenchInternalSourcePaths;
  expectations?: FrenchInternalWorkExpectations | null;
  /** Explicit fixture/replay override; production callers use canonical defaults. */
  entityExpectations?: FrenchEntityCanonicalizationExpectations;
}

export interface RunFrenchInternalWorkOptions extends LoadFrenchInternalWorkOptions {
  outputPaths: FrenchInternalWorkOutputPaths;
  generatedAt?: string;
  pilotSize?: number;
  shardBatchSizes?: Partial<Record<FrenchInternalMeaningSize, number>>;
}

interface JsonArtifactRead<T> {
  value: T;
  digest: string;
}

interface JsonlArtifactRead<T> {
  records: T[];
  digest: string;
}

interface PilotLabelTarget {
  label: string;
  population: number;
  hardMinimum: number;
  desired: number;
  weight: number;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DEFAULT_SHARD_BATCH_SIZES: Record<FrenchInternalMeaningSize, number> = {
  short: 40,
  medium: 30,
  long: 16,
  very_long: 8
};
const SIZE_ORDER: readonly FrenchInternalMeaningSize[] = [
  "short",
  "medium",
  "long",
  "very_long"
];
const PROPOSER_A_BANNED_KEYS = new Set([
  "candidateEvidence",
  "concordanceForms",
  "deterministicRepairCandidate",
  "existingFrench",
  "historicalCandidate",
  "historicalFrench",
  "legacy",
  "legacyFrench",
  "legacyHtmlNormalization",
  "matches",
  "priorFrench",
  "referenceEvidence",
  "resourceFrench",
  "sourceEvidence"
]);

/** Canonical JSON for all internal-work hashes. Undefined object keys vanish. */
export function canonicalFrenchInternalWorkJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("french-internal-work-non-finite-number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalFrenchInternalWorkJson).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new Error("french-internal-work-unsupported-json-value");
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalFrenchInternalWorkJson(object[key])}`
    )
    .join(",")}}`;
}

export function hashFrenchInternalWorkJson(value: unknown): string {
  return sha256(canonicalFrenchInternalWorkJson(value));
}

export function frenchInternalViewHash(
  value: object & { viewHash?: string }
): string {
  const { viewHash: _viewHash, ...content } = value as Record<
    string,
    unknown
  > & {
    viewHash?: string;
  };
  void _viewHash;
  return hashFrenchInternalWorkJson(content);
}

export function finalizeFrenchInternalView<T extends Record<string, unknown>>(
  value: T
): T & { viewHash: string } {
  const { viewHash: _viewHash, ...content } = value;
  void _viewHash;
  return {
    ...(content as T),
    viewHash: hashFrenchInternalWorkJson(content)
  };
}

export function loadFrenchInternalWorkSources(
  options: LoadFrenchInternalWorkOptions
): FrenchInternalWorkSources {
  const sourcePaths = resolveSourcePaths(options.sourcePaths);
  assertRequiredFiles(
    Object.values(sourcePaths).filter(
      (path): path is string => typeof path === "string"
    )
  );
  const packetRead = readJsonlArtifact<LexiconV3FrenchPacket>(
    sourcePaths.packets,
    "packets"
  );
  const packetSummaryRead = readJsonArtifact<FrenchInternalPacketBuildSummary>(
    sourcePaths.packetSummary,
    "packet-summary"
  );
  const reuseRead = readJsonlArtifact<FrenchReuseRecord>(
    sourcePaths.reuseRecords,
    "reuse-records"
  );
  const reuseSummaryRead = readJsonArtifact<FrenchReuseManifestSummary>(
    sourcePaths.reuseSummary,
    "reuse-summary"
  );
  const entityRead = readJsonlArtifact<FrenchEditorialEntityRecord>(
    sourcePaths.entityRegistry,
    "entity-registry"
  );
  const canonicalEntitiesRead = readJsonlArtifact<FrenchCanonicalEntityRecord>(
    sourcePaths.canonicalEntities,
    "canonical-entities"
  );
  const canonicalEntryPoliciesRead =
    readJsonlArtifact<FrenchCanonicalEntryNamePolicy>(
      sourcePaths.canonicalEntryPolicies,
      "canonical-entry-policies"
    );
  const entityMergeAttestationRead =
    readJsonArtifact<FrenchEntityMergeAttestationArtifact>(
      sourcePaths.entityMergeAttestation,
      "entity-merge-attestation"
    );
  const entityMergeReplay = assertFrenchEntityMergeAttestationAtPath({
    attestationPath: sourcePaths.entityMergeAttestation,
    canonicalEntitiesPath: sourcePaths.canonicalEntities,
    canonicalEntryPoliciesPath: sourcePaths.canonicalEntryPolicies,
    expectedReleaseKey: packetSummaryRead.value.englishRelease.releaseKey,
    ...(options.entityExpectations === undefined
      ? {}
      : { expectations: options.entityExpectations })
  });
  const entityGateRead = readJsonArtifact<
    FrenchEntityCanonicalizationGateResult | FrenchEntityAgentTerminalGateResult
  >(sourcePaths.entityGate, "entity-gate");
  const entityMentionsRead = readJsonArtifact<FrenchEntityMentionsArtifact>(
    sourcePaths.entityMentions,
    "entity-mentions"
  );
  const entityMentionResolutionAttestationRead =
    sourcePaths.entityMentionResolutionAttestation
      ? readJsonArtifact<FrenchEntityMentionResolutionAttestation>(
          sourcePaths.entityMentionResolutionAttestation,
          "entity-mention-resolution-attestation"
        )
      : null;
  const termbaseRead = readJsonlArtifact<FrenchEditorialTermbaseRecord>(
    sourcePaths.termbase,
    "termbase"
  );
  const morphologyRead = readJsonlArtifact<FrenchEditorialMorphologyRecord>(
    sourcePaths.morphology,
    "morphology"
  );
  const editorialSummaryRead =
    readJsonArtifact<FrenchEditorialBuildSummaryInput>(
      sourcePaths.editorialSummary,
      "editorial-summary"
    );
  const guideRead = readJsonArtifact<FrenchEditorialGuide>(
    sourcePaths.guide,
    "editorial-guide"
  );
  const terminalMerge =
    "quarantinedUnitIds" in entityMergeReplay.merged
      ? entityMergeReplay.merged
      : null;
  const reviewUnitById = new Map(
    entityMergeReplay.plan.reviewUnits.map(
      (unit) => [unit.unitId, unit] as const
    )
  );
  const quarantinedEntryKeys = terminalMerge
    ? terminalMerge.quarantinedUnitIds
        .flatMap((unitId) => {
          const unit = reviewUnitById.get(unitId);
          if (!unit) {
            throw new Error(
              `french-internal-work-quarantine-unit-missing:${unitId}`
            );
          }
          return unit.reviewEntryKeys;
        })
        .sort(compareText)
    : [];
  const sources: FrenchInternalWorkSources = {
    packets: packetRead.records,
    packetSummary: packetSummaryRead.value,
    reuseRecords: reuseRead.records,
    reuseSummary: reuseSummaryRead.value,
    entities: entityRead.records,
    canonicalEntities: canonicalEntitiesRead.records,
    canonicalEntryPolicies: canonicalEntryPoliciesRead.records,
    quarantinedEntryKeys,
    entityMergeAttestation: entityMergeReplay.attestation,
    entityGate: entityGateRead.value,
    entityMentions: entityMentionsRead.value,
    entityMentionResolutionAttestation:
      entityMentionResolutionAttestationRead?.value ?? null,
    termbase: termbaseRead.records,
    morphology: morphologyRead.records,
    editorialSummary: editorialSummaryRead.value,
    guide: guideRead.value,
    sourcePaths,
    sourceDigests: {
      packets: packetRead.digest,
      packetSummary: packetSummaryRead.digest,
      reuseRecords: reuseRead.digest,
      reuseSummary: reuseSummaryRead.digest,
      entityRegistry: entityRead.digest,
      canonicalEntities: canonicalEntitiesRead.digest,
      canonicalEntryPolicies: canonicalEntryPoliciesRead.digest,
      entityMergeAttestation: entityMergeAttestationRead.digest,
      entityGate: entityGateRead.digest,
      entityMentions: entityMentionsRead.digest,
      ...(entityMentionResolutionAttestationRead
        ? {
            entityMentionResolutionAttestation:
              entityMentionResolutionAttestationRead.digest
          }
        : {}),
      termbase: termbaseRead.digest,
      morphology: morphologyRead.digest,
      editorialSummary: editorialSummaryRead.digest,
      guide: guideRead.digest
    }
  };
  validateFrenchInternalWorkSources(
    sources,
    options.expectations === undefined
      ? FRENCH_INTERNAL_DEFAULT_EXPECTATIONS
      : options.expectations
  );
  return sources;
}

export function buildFrenchInternalWork(
  options: BuildFrenchInternalWorkOptions
): FrenchInternalWorkBuild {
  const expectations =
    options.expectations === undefined
      ? FRENCH_INTERNAL_DEFAULT_EXPECTATIONS
      : options.expectations;
  validateFrenchInternalWorkSources(options.sources, expectations);
  const expectedEntries =
    expectations?.expectedEntryCount ?? options.sources.packets.length;
  const pilotSize =
    options.pilotSize ??
    expectations?.expectedPilotSize ??
    FRENCH_INTERNAL_DEFAULT_EXPECTATIONS.expectedPilotSize;
  if (
    !Number.isInteger(pilotSize) ||
    pilotSize < 1 ||
    pilotSize > expectedEntries
  ) {
    throw new Error(`french-internal-work-invalid-pilot-size:${pilotSize}`);
  }
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error(`french-internal-work-invalid-generated-at:${generatedAt}`);
  }
  const outputPaths = resolveOutputPaths(options.outputPaths);
  assertDistinctInputsAndOutputs(options.sources.sourcePaths, outputPaths);
  const globalLineage = buildGlobalLineage(options.sources);
  const packetByKey = uniqueMap(
    options.sources.packets,
    (packet) => packet.entryKey,
    "packet-entry"
  );
  const reuseByKey = uniqueMap(
    options.sources.reuseRecords,
    (record) => record.entryKey,
    "reuse-entry"
  );
  const termbaseByKey = uniqueMap(
    options.sources.termbase,
    (record) => record.entryKey,
    "termbase-entry"
  );
  const entityByKey = uniqueMap(
    options.sources.entities,
    (record) => record.entryKey,
    "entity-entry"
  );
  const canonicalEntityById = uniqueMap(
    options.sources.canonicalEntities,
    (record) => record.entityId,
    "canonical-entity"
  );
  const canonicalEntryPolicyByKey = uniqueMap(
    options.sources.canonicalEntryPolicies,
    (record) => record.entryKey,
    "canonical-entry-policy"
  );
  const entityMentionsBySourceEntry = groupEntityMentionsBySourceEntry(
    options.sources.entityMentions.requiredEntityMentions
  );
  const morphologyByCode = buildMorphologyIndex(options.sources.morphology);
  const quarantinedEntryKeys = new Set(options.sources.quarantinedEntryKeys);

  const workItems: FrenchInternalWorkView[] = [];
  const proposerAViews: FrenchInternalProposerAView[] = [];
  const proposerBViews: FrenchInternalProposerBView[] = [];
  const entryKeys = [...packetByKey.keys()].sort(compareText);
  for (const entryKey of entryKeys) {
    const packet = requiredMapValue(packetByKey, entryKey, "packet");
    const reuse = requiredMapValue(reuseByKey, entryKey, "reuse");
    const termbase = requiredMapValue(termbaseByKey, entryKey, "termbase");
    const entity = entityByKey.get(entryKey) ?? null;
    const morphology = morphologyForEntry(
      packet.identity.morph,
      morphologyByCode
    );
    const entityConstraints = buildFrenchInternalEntityConstraints({
      entryKey,
      canonicalEntryPolicyByKey,
      canonicalEntityById,
      quarantinedEntryKeys,
      requiredMentions: entityMentionsBySourceEntry.get(entryKey) ?? []
    });
    validateExactEntryJoin(packet, reuse, termbase, entity);
    const pretranslationAudit = assertFrenchPacketTranslatable(packet);
    const lineage = buildEntryLineage(
      globalLineage,
      packet,
      reuse,
      termbase,
      entity,
      entityConstraints,
      morphology,
      pretranslationAudit
    );
    const legacyHtmlNormalization = normalizeLegacyHtmlEvidence(packet);
    const strata = buildWorkStrata(
      packet,
      reuse,
      termbase,
      legacyHtmlNormalization,
      pretranslationAudit,
      entityConstraints.quarantined
    );
    const canonicalIdentity = canonicalEntryIdentity(packet, reuse);
    const workItem = finalizeFrenchInternalView({
      schemaVersion: FRENCH_INTERNAL_WORK_VIEW_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      viewKind: "full" as const,
      entryKey,
      lineage,
      identity: canonicalIdentity,
      english: packet.english,
      sourceEvidence: packet.evidence,
      protectedContent: packet.protectedContent,
      pretranslationAudit,
      reuse,
      editorial: { termbase, entity, morphology },
      entityConstraints,
      guide: options.sources.guide,
      guideContentHash: globalLineage.guideContentHash,
      legacyHtmlNormalization,
      strata
    }) as unknown as FrenchInternalWorkView;
    const canonicalRegistry = buildCanonicalRegistry(
      termbase,
      entityConstraints
    );
    const htmlTemplate = buildFrenchHtmlTemplate(packet.english.meaningHtml);
    const common = {
      schemaVersion: FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      entryKey,
      workViewHash: workItem.viewHash,
      lineage,
      identity: canonicalIdentity,
      english: packet.english,
      protectedContent: packet.protectedContent,
      publicationGate: buildFrenchInternalPublicationGate(pretranslationAudit),
      translationTask: {
        locale: "fr" as const,
        outputFields: [
          "glossFr",
          "meaningSegmentsFr",
          "entityMentionsFr",
          "notesFr",
          "carrierTermsFr"
        ] as [
          "glossFr",
          "meaningSegmentsFr",
          "entityMentionsFr",
          "notesFr",
          "carrierTermsFr"
        ],
        htmlRule: "translate-text-segments-only-html-rebuilt-locally" as const,
        identityRule:
          "translate-exact-step-entry-never-generalize-to-classical-strong" as const,
        htmlTemplate
      },
      guide: options.sources.guide,
      guideContentHash: globalLineage.guideContentHash,
      canonicalRegistry,
      entityConstraints,
      morphology,
      translationProfile: {
        pos: termbase.pos,
        properName: strata.properName,
        theological: strata.theological,
        meaningCohort: strata.meaningCohort,
        meaningSize: strata.meaningSize,
        englishRiskCategories: strata.riskCategories.filter(
          (category) =>
            !category.includes("historical") &&
            !category.includes("legacy") &&
            !category.includes("french")
        )
      }
    };
    const proposerA = finalizeFrenchInternalView({
      ...common,
      viewKind: "proposer_a_blind" as const,
      role: "proposerA" as const,
      evidencePolicy: {
        mode: "blind-independent-translation" as const,
        frenchEntryCandidatesExposed: false as const,
        allowedFrenchContext: [
          "editorial-guide",
          "green-canonical-registry",
          "canonical-entry-name-policies",
          "required-entity-mentions",
          "morphology-registry"
        ] as [
          "editorial-guide",
          "green-canonical-registry",
          "canonical-entry-name-policies",
          "required-entity-mentions",
          "morphology-registry"
        ]
      }
    }) as unknown as FrenchInternalProposerAView;
    assertProposerABlindView(proposerA);
    const candidateEvidence = buildCandidateEnvelope(
      packet,
      termbase,
      entity,
      legacyHtmlNormalization
    );
    const proposerB = finalizeFrenchInternalView({
      ...common,
      viewKind: "proposer_b_candidates" as const,
      role: "proposerB" as const,
      evidencePolicy: {
        mode: "candidate-aware-independent-review" as const,
        candidatesAreAuthority: false as const,
        requireEnglishSemanticJustification: true as const
      },
      candidateEvidence
    }) as unknown as FrenchInternalProposerBView;
    workItems.push(workItem);
    proposerAViews.push(proposerA);
    proposerBViews.push(proposerB);
  }
  if (
    workItems.length !== expectedEntries ||
    proposerAViews.length !== expectedEntries ||
    proposerBViews.length !== expectedEntries ||
    reuseByKey.size !== expectedEntries ||
    termbaseByKey.size !== expectedEntries
  ) {
    throw new Error(
      `french-internal-work-cardinality-mismatch:${workItems.length}:${reuseByKey.size}:${termbaseByKey.size}:${expectedEntries}`
    );
  }
  const properNameCount = workItems.filter(
    (item) => item.strata.properName
  ).length;
  if (entityByKey.size !== properNameCount) {
    throw new Error(
      `french-internal-work-entity-cardinality-mismatch:${entityByKey.size}:${properNameCount}`
    );
  }
  const pilot = buildFrenchInternalPilot(
    workItems,
    proposerAViews,
    proposerBViews,
    globalLineage.sourceLogicalDigest,
    pilotSize
  );
  const shards = buildFrenchInternalShards(
    workItems,
    proposerAViews,
    proposerBViews,
    globalLineage.sourceLogicalDigest,
    options.shardBatchSizes
  );
  const summary = buildWorkSummary({
    generatedAt,
    sources: options.sources,
    outputPaths,
    globalLineage,
    workItems,
    proposerAViews,
    proposerBViews,
    pilot,
    shards
  });
  const build = {
    workItems,
    proposerAViews,
    proposerBViews,
    pilot,
    shards,
    summary
  };
  assertFrenchInternalWorkBuild(build, expectations);
  return build;
}

export function runFrenchInternalWork(
  options: RunFrenchInternalWorkOptions
): FrenchInternalWorkBuild {
  const sources = loadFrenchInternalWorkSources(options);
  const build = buildFrenchInternalWork({
    sources,
    outputPaths: options.outputPaths,
    generatedAt: options.generatedAt,
    expectations:
      options.expectations === undefined
        ? FRENCH_INTERNAL_DEFAULT_EXPECTATIONS
        : options.expectations,
    pilotSize: options.pilotSize,
    shardBatchSizes: options.shardBatchSizes
  });
  writeBuildAtomically(build);
  return build;
}

export function extractFrenchInternalPilotViews(
  pilot: FrenchInternalPilotPlan,
  proposerAViews: readonly FrenchInternalProposerAView[],
  proposerBViews: readonly FrenchInternalProposerBView[]
): FrenchInternalPilotViewExtraction {
  const { contentHash, ...pilotContent } = pilot;
  if (
    !SHA256_PATTERN.test(contentHash) ||
    hashFrenchInternalWorkJson(pilotContent) !== contentHash ||
    pilot.keys.length !== pilot.pilotSize ||
    pilot.selections.length !== pilot.pilotSize ||
    new Set(pilot.keys).size !== pilot.pilotSize
  ) {
    throw new Error("french-internal-pilot-extraction-plan-invalid");
  }
  const aByKey = uniqueMap(
    proposerAViews,
    (view) => view.entryKey,
    "pilot-extraction-proposer-a"
  );
  const bByKey = uniqueMap(
    proposerBViews,
    (view) => view.entryKey,
    "pilot-extraction-proposer-b"
  );
  const selectionByKey = uniqueMap(
    pilot.selections,
    (selection) => selection.entryKey,
    "pilot-extraction-selection"
  );
  const extractedA: FrenchInternalProposerAView[] = [];
  const extractedB: FrenchInternalProposerBView[] = [];
  for (const entryKey of pilot.keys) {
    const selection = requiredMapValue(
      selectionByKey,
      entryKey,
      "pilot-extraction-selection"
    );
    const { selectionHash, ...selectionContent } = selection;
    if (
      !SHA256_PATTERN.test(selectionHash) ||
      hashFrenchInternalWorkJson(selectionContent) !== selectionHash
    ) {
      throw new Error(
        `french-internal-pilot-extraction-selection-hash:${entryKey}`
      );
    }
    const proposerA = requiredMapValue(
      aByKey,
      entryKey,
      "pilot-extraction-proposer-a"
    );
    const proposerB = requiredMapValue(
      bByKey,
      entryKey,
      "pilot-extraction-proposer-b"
    );
    assertFrenchInternalWorkViewHash(proposerA, "pilot-proposer-a");
    assertFrenchInternalWorkViewHash(proposerB, "pilot-proposer-b");
    assertProposerABlindView(proposerA);
    if (
      proposerA.viewKind !== "proposer_a_blind" ||
      proposerA.role !== "proposerA" ||
      proposerB.viewKind !== "proposer_b_candidates" ||
      proposerB.role !== "proposerB" ||
      proposerA.viewHash !== selection.proposerAViewHash ||
      proposerB.viewHash !== selection.proposerBViewHash ||
      proposerA.workViewHash !== selection.workViewHash ||
      proposerB.workViewHash !== selection.workViewHash ||
      proposerA.lineage.sourceLogicalDigest !== pilot.sourceLogicalDigest ||
      proposerB.lineage.sourceLogicalDigest !== pilot.sourceLogicalDigest ||
      proposerA.lineage.releaseKey !== pilot.releaseKey ||
      proposerB.lineage.releaseKey !== pilot.releaseKey ||
      proposerA.lineage.releaseSnapshotFingerprint !==
        pilot.releaseSnapshotFingerprint ||
      proposerB.lineage.releaseSnapshotFingerprint !==
        pilot.releaseSnapshotFingerprint ||
      canonicalFrenchInternalWorkJson(proposerA.lineage) !==
        canonicalFrenchInternalWorkJson(proposerB.lineage) ||
      canonicalFrenchInternalWorkJson(selection.lineage) !==
        canonicalFrenchInternalWorkJson(proposerA.lineage)
    ) {
      throw new Error(
        `french-internal-pilot-extraction-lineage-mismatch:${entryKey}`
      );
    }
    extractedA.push(proposerA);
    extractedB.push(proposerB);
  }
  return { proposerAViews: extractedA, proposerBViews: extractedB };
}

export function writeFrenchInternalPilotViews(
  build: FrenchInternalWorkBuild,
  outputPaths: FrenchInternalPilotViewOutputPaths = {
    proposerA: resolve(
      dirname(build.summary.outputPaths.pilotKeys),
      "pilot-proposer-a-input.jsonl"
    ),
    proposerB: resolve(
      dirname(build.summary.outputPaths.pilotKeys),
      "pilot-proposer-b-input.jsonl"
    )
  }
): FrenchInternalPilotViewWriteResult {
  const resolvedPaths = {
    proposerA: resolve(outputPaths.proposerA),
    proposerB: resolve(outputPaths.proposerB)
  };
  const protectedPaths = new Set(
    Object.values(build.summary.outputPaths).map((path) => resolve(path))
  );
  if (
    resolvedPaths.proposerA === resolvedPaths.proposerB ||
    protectedPaths.has(resolvedPaths.proposerA) ||
    protectedPaths.has(resolvedPaths.proposerB)
  ) {
    throw new Error("french-internal-pilot-extraction-output-path-invalid");
  }
  const extracted = extractFrenchInternalPilotViews(
    build.pilot,
    build.proposerAViews,
    build.proposerBViews
  );
  const outputs = [
    { path: resolvedPaths.proposerA, records: extracted.proposerAViews },
    { path: resolvedPaths.proposerB, records: extracted.proposerBViews }
  ] as const;
  const temporaryPaths: string[] = [];
  const written: Array<{ sha256: string; bytes: number }> = [];
  try {
    for (const output of outputs) {
      mkdirSync(dirname(output.path), { recursive: true });
      const temporary = `${output.path}.tmp-${process.pid}`;
      rmSync(temporary, { force: true });
      temporaryPaths.push(temporary);
      written.push(writeJsonlFile(temporary, output.records));
    }
    for (let index = 0; index < outputs.length; index += 1) {
      renameSync(temporaryPaths[index]!, outputs[index]!.path);
    }
  } catch (error) {
    for (const temporary of temporaryPaths) rmSync(temporary, { force: true });
    throw error;
  }
  return {
    outputPaths: resolvedPaths,
    proposerA: {
      ...written[0]!,
      records: extracted.proposerAViews.length
    },
    proposerB: {
      ...written[1]!,
      records: extracted.proposerBViews.length
    }
  };
}

export function assertFrenchInternalWorkBuild(
  build: FrenchInternalWorkBuild,
  expectations: FrenchInternalWorkExpectations | null = FRENCH_INTERNAL_DEFAULT_EXPECTATIONS
): void {
  const { workItems, proposerAViews, proposerBViews, pilot, shards, summary } =
    build;
  const expectedEntries = expectations?.expectedEntryCount ?? workItems.length;
  if (
    summary.schemaVersion !== FRENCH_INTERNAL_WORK_SUMMARY_SCHEMA_VERSION ||
    summary.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    workItems.length !== expectedEntries ||
    proposerAViews.length !== expectedEntries ||
    proposerBViews.length !== expectedEntries
  ) {
    throw new Error("french-internal-work-output-cardinality-invalid");
  }
  const aByKey = uniqueMap(
    proposerAViews,
    (view) => view.entryKey,
    "assert-proposer-a"
  );
  const bByKey = uniqueMap(
    proposerBViews,
    (view) => view.entryKey,
    "assert-proposer-b"
  );
  let previousKey = "";
  for (const item of workItems) {
    if (previousKey && compareText(previousKey, item.entryKey) >= 0) {
      throw new Error("french-internal-work-order-invalid");
    }
    previousKey = item.entryKey;
    assertFrenchInternalWorkViewHash(item, "work");
    const a = requiredMapValue(aByKey, item.entryKey, "proposer-a");
    const b = requiredMapValue(bByKey, item.entryKey, "proposer-b");
    assertFrenchInternalWorkViewHash(a, "proposer-a");
    assertFrenchInternalWorkViewHash(b, "proposer-b");
    if (a.workViewHash !== item.viewHash || b.workViewHash !== item.viewHash) {
      throw new Error(
        `french-internal-work-parent-view-stale:${item.entryKey}`
      );
    }
    assertExactEntryLineage(item.lineage, a.lineage, item.entryKey, "work-a");
    assertExactEntryLineage(item.lineage, b.lineage, item.entryKey, "work-b");
    assertEntityConstraints(item.entityConstraints, item.entryKey);
    if (
      canonicalFrenchInternalWorkJson(a.entityConstraints) !==
        canonicalFrenchInternalWorkJson(item.entityConstraints) ||
      canonicalFrenchInternalWorkJson(b.entityConstraints) !==
        canonicalFrenchInternalWorkJson(item.entityConstraints)
    ) {
      throw new Error(
        `french-internal-work-entity-context-mismatch:${item.entryKey}`
      );
    }
    assertEntryLineageMatchesGlobal(
      item.lineage,
      summary.lineage,
      item.entryKey
    );
    const publicationGate = buildFrenchInternalPublicationGate(
      item.pretranslationAudit
    );
    if (
      item.pretranslationAudit.entryKey !== item.entryKey ||
      item.pretranslationAudit.packetHash !== item.lineage.packetHash ||
      item.pretranslationAudit.englishHash !== item.lineage.englishHash ||
      item.lineage.pretranslationAuditHash !==
        hashFrenchInternalWorkJson(item.pretranslationAudit) ||
      canonicalFrenchInternalWorkJson(a.publicationGate) !==
        canonicalFrenchInternalWorkJson(publicationGate) ||
      canonicalFrenchInternalWorkJson(b.publicationGate) !==
        canonicalFrenchInternalWorkJson(publicationGate)
    ) {
      throw new Error(
        `french-internal-publication-gate-mismatch:${item.entryKey}`
      );
    }
    assertProposerABlindView(a);
  }
  assertPilotPlan(pilot, workItems, proposerAViews, proposerBViews);
  assertShardPlan(shards, workItems, proposerAViews, proposerBViews);
  const recomputedSummary = buildWorkSummary({
    generatedAt: summary.generatedAt,
    sources: {
      packets: [],
      packetSummary: {} as FrenchInternalPacketBuildSummary,
      reuseRecords: [],
      reuseSummary: {} as FrenchReuseManifestSummary,
      entities: [],
      canonicalEntities: [],
      canonicalEntryPolicies: [],
      quarantinedEntryKeys: [],
      entityMergeAttestation: {} as FrenchEntityMergeAttestationArtifact,
      entityGate: {} as FrenchEntityCanonicalizationGateResult,
      entityMentions: {} as FrenchEntityMentionsArtifact,
      entityMentionResolutionAttestation: null,
      termbase: [],
      morphology: [],
      editorialSummary: {} as FrenchEditorialBuildSummaryInput,
      guide: {} as FrenchEditorialGuide,
      sourcePaths: summary.sourcePaths,
      sourceDigests: summary.sourceDigests
    },
    outputPaths: summary.outputPaths,
    globalLineage: summary.lineage,
    workItems,
    proposerAViews,
    proposerBViews,
    pilot,
    shards
  });
  if (
    canonicalFrenchInternalWorkJson(recomputedSummary.counts) !==
      canonicalFrenchInternalWorkJson(summary.counts) ||
    canonicalFrenchInternalWorkJson(recomputedSummary.artifacts) !==
      canonicalFrenchInternalWorkJson(summary.artifacts)
  ) {
    throw new Error("french-internal-work-summary-projection-invalid");
  }
  const { summaryHash: _summaryHash, ...summaryContent } = summary;
  void _summaryHash;
  if (hashFrenchInternalWorkJson(summaryContent) !== summary.summaryHash) {
    throw new Error("french-internal-work-summary-hash-invalid");
  }
  if (
    expectations &&
    (pilot.keys.length !== expectations.expectedPilotSize ||
      summary.counts.pilotKeys !== expectations.expectedPilotSize)
  ) {
    throw new Error("french-internal-work-pilot-cardinality-invalid");
  }
}

function assertEntityConstraints(
  constraints: FrenchInternalEntityConstraints,
  entryKey: string
): void {
  const { contextHash, ...content } = constraints;
  if (
    !SHA256_PATTERN.test(contextHash) ||
    hashFrenchInternalWorkJson(content) !== contextHash ||
    typeof constraints.quarantined !== "boolean" ||
    (constraints.quarantined && constraints.entryPolicy !== null) ||
    (constraints.entryPolicy !== null &&
      constraints.entryPolicy.entryKey !== entryKey) ||
    constraints.requiredMentions.some(
      (mention) =>
        mention.sourceEntryKey !== entryKey ||
        mention.resolution === "ambiguous" ||
        mention.resolution === "contextual"
    )
  ) {
    throw new Error(`french-internal-work-entity-context-invalid:${entryKey}`);
  }
  const relevantPolicyKeys = new Set(
    constraints.requiredMentions.flatMap((mention) =>
      mention.targetEntryKey && mention.resolution !== "quarantined"
        ? [mention.targetEntryKey]
        : []
    )
  );
  if (
    constraints.mentionPolicies.some(
      (policy) => !relevantPolicyKeys.has(policy.entryKey)
    ) ||
    constraints.mentionPolicies.length !== relevantPolicyKeys.size
  ) {
    throw new Error(
      `french-internal-work-entity-policy-scope-invalid:${entryKey}`
    );
  }
  const relevantEntityIds = new Set([
    ...constraints.requiredMentions.flatMap(
      (mention) => mention.targetEntityIds
    ),
    ...(constraints.entryPolicy?.entityBindings.map(
      (binding) => binding.entityId
    ) ?? []),
    ...constraints.mentionPolicies.flatMap((policy) =>
      policy.entityBindings.map((binding) => binding.entityId)
    )
  ]);
  if (
    constraints.canonicalEntities.length !== relevantEntityIds.size ||
    constraints.canonicalEntities.some(
      (entity) => !relevantEntityIds.has(entity.entityId)
    )
  ) {
    throw new Error(
      `french-internal-work-canonical-entity-scope-invalid:${entryKey}`
    );
  }
}

export function buildFrenchInternalPilot(
  workItems: readonly FrenchInternalWorkView[],
  proposerAViews: readonly FrenchInternalProposerAView[],
  proposerBViews: readonly FrenchInternalProposerBView[],
  sourceLogicalDigest: string,
  pilotSize: number = FRENCH_INTERNAL_DEFAULT_EXPECTATIONS.expectedPilotSize
): FrenchInternalPilotPlan {
  if (
    !Number.isInteger(pilotSize) ||
    pilotSize < 1 ||
    pilotSize > workItems.length
  ) {
    throw new Error(`french-internal-pilot-size-invalid:${pilotSize}`);
  }
  const aByKey = uniqueMap(proposerAViews, (view) => view.entryKey, "pilot-a");
  const bByKey = uniqueMap(proposerBViews, (view) => view.entryKey, "pilot-b");
  const releaseLineage = requiredPlanReleaseLineage(
    workItems,
    aByKey,
    bByKey,
    sourceLogicalDigest,
    "pilot"
  );
  const candidates = workItems.map((item) => ({
    item,
    labels: pilotLabels(item.strata),
    tie: sha256(`${FRENCH_INTERNAL_PILOT_SCHEMA_VERSION}:${item.entryKey}`)
  }));
  const targets = pilotTargets(candidates, pilotSize);
  const counts = new Map<string, number>();
  const selected = new Set<string>();
  const selectedRows: Array<{
    item: FrenchInternalWorkView;
    reasons: string[];
  }> = [];
  while (selectedRows.length < pilotSize) {
    let best:
      | {
          item: FrenchInternalWorkView;
          labels: string[];
          tie: string;
          score: number;
          reasons: string[];
        }
      | undefined;
    for (const candidate of candidates) {
      if (selected.has(candidate.item.entryKey)) continue;
      const scored = pilotCandidateScore(candidate.labels, counts, targets);
      if (
        !best ||
        scored.score > best.score ||
        (scored.score === best.score &&
          compareText(candidate.tie, best.tie) < 0)
      ) {
        best = { ...candidate, ...scored };
      }
    }
    if (!best) throw new Error("french-internal-pilot-selection-exhausted");
    selected.add(best.item.entryKey);
    selectedRows.push({
      item: best.item,
      reasons: best.reasons.length > 0 ? best.reasons : ["deterministic-fill"]
    });
    for (const label of best.labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const unmet = targets.filter(
    (target) => (counts.get(target.label) ?? 0) < target.hardMinimum
  );
  if (unmet.length > 0) {
    throw new Error(
      `french-internal-pilot-stratification-unmet:${unmet
        .map(
          (target) =>
            `${target.label}:${counts.get(target.label) ?? 0}/${target.hardMinimum}`
        )
        .join(",")}`
    );
  }
  selectedRows.sort((left, right) =>
    compareText(left.item.entryKey, right.item.entryKey)
  );
  const selections = selectedRows.map(({ item, reasons }) => {
    const content = {
      schemaVersion: FRENCH_INTERNAL_PILOT_SELECTION_SCHEMA_VERSION,
      entryKey: item.entryKey,
      workViewHash: item.viewHash,
      proposerAViewHash: requiredMapValue(aByKey, item.entryKey, "pilot-a")
        .viewHash,
      proposerBViewHash: requiredMapValue(bByKey, item.entryKey, "pilot-b")
        .viewHash,
      lineage: item.lineage,
      strata: item.strata,
      selectionReasons: uniqueSorted(reasons)
    };
    return {
      ...content,
      selectionHash: hashFrenchInternalWorkJson(content)
    };
  });
  const content = {
    schemaVersion: FRENCH_INTERNAL_PILOT_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
    sourceLogicalDigest,
    releaseKey: releaseLineage.releaseKey,
    releaseSnapshotFingerprint: releaseLineage.releaseSnapshotFingerprint,
    pilotSize,
    keys: selections.map((selection) => selection.entryKey),
    selections,
    strataCounts: countStrata(selections.map((selection) => selection.strata))
  };
  return { ...content, contentHash: hashFrenchInternalWorkJson(content) };
}

function requiredPlanReleaseLineage(
  workItems: readonly FrenchInternalWorkView[],
  proposerAByKey: Map<string, FrenchInternalProposerAView>,
  proposerBByKey: Map<string, FrenchInternalProposerBView>,
  sourceLogicalDigest: string,
  scope: "pilot" | "shard"
): Pick<
  FrenchInternalEntryLineage,
  "releaseKey" | "releaseSnapshotFingerprint"
> {
  const first = workItems[0]?.lineage;
  if (!first) throw new Error(`french-internal-${scope}-empty-work`);
  for (const item of workItems) {
    const proposerA = requiredMapValue(
      proposerAByKey,
      item.entryKey,
      `${scope}-a`
    );
    const proposerB = requiredMapValue(
      proposerBByKey,
      item.entryKey,
      `${scope}-b`
    );
    assertExactEntryLineage(
      item.lineage,
      proposerA.lineage,
      item.entryKey,
      `${scope}-a`
    );
    assertExactEntryLineage(
      item.lineage,
      proposerB.lineage,
      item.entryKey,
      `${scope}-b`
    );
    if (
      item.lineage.sourceLogicalDigest !== sourceLogicalDigest ||
      item.lineage.releaseKey !== first.releaseKey ||
      item.lineage.releaseSnapshotFingerprint !==
        first.releaseSnapshotFingerprint
    ) {
      throw new Error(
        `french-internal-${scope}-release-lineage-mismatch:${item.entryKey}`
      );
    }
  }
  return {
    releaseKey: first.releaseKey,
    releaseSnapshotFingerprint: first.releaseSnapshotFingerprint
  };
}

export function buildFrenchInternalShards(
  workItems: readonly FrenchInternalWorkView[],
  proposerAViews: readonly FrenchInternalProposerAView[],
  proposerBViews: readonly FrenchInternalProposerBView[],
  sourceLogicalDigest: string,
  batchSizeOverrides: Partial<Record<FrenchInternalMeaningSize, number>> = {}
): FrenchInternalShardPlan {
  const batchSizes = {
    ...DEFAULT_SHARD_BATCH_SIZES,
    ...batchSizeOverrides
  };
  validateBatchSizes(batchSizes);
  const aByKey = uniqueMap(proposerAViews, (view) => view.entryKey, "shard-a");
  const bByKey = uniqueMap(proposerBViews, (view) => view.entryKey, "shard-b");
  const releaseLineage = requiredPlanReleaseLineage(
    workItems,
    aByKey,
    bByKey,
    sourceLogicalDigest,
    "shard"
  );
  const shards: FrenchInternalShard[] = [];
  for (const meaningSize of SIZE_ORDER) {
    const group = workItems
      .filter((item) => item.strata.meaningSize === meaningSize)
      .sort((left, right) => compareText(left.entryKey, right.entryKey));
    const maxItems = batchSizes[meaningSize];
    for (let offset = 0; offset < group.length; offset += maxItems) {
      const slice = group.slice(offset, offset + maxItems);
      const items = slice.map((item) => {
        const content = {
          schemaVersion: FRENCH_INTERNAL_SHARD_ITEM_SCHEMA_VERSION,
          entryKey: item.entryKey,
          workViewHash: item.viewHash,
          proposerAViewHash: requiredMapValue(aByKey, item.entryKey, "shard-a")
            .viewHash,
          proposerBViewHash: requiredMapValue(bByKey, item.entryKey, "shard-b")
            .viewHash,
          lineage: item.lineage
        };
        return { ...content, itemHash: hashFrenchInternalWorkJson(content) };
      });
      const ordinal = Math.floor(offset / maxItems) + 1;
      const shardId = `${meaningSize}-${String(ordinal).padStart(4, "0")}`;
      const resumeKey = hashFrenchInternalWorkJson({
        schemaVersion: "lexicon-v3-french-internal-resume-key@1",
        sourceLogicalDigest,
        releaseKey: releaseLineage.releaseKey,
        releaseSnapshotFingerprint: releaseLineage.releaseSnapshotFingerprint,
        shardId,
        items: items.map((item) => ({
          entryKey: item.entryKey,
          proposerAViewHash: item.proposerAViewHash,
          proposerBViewHash: item.proposerBViewHash
        }))
      });
      const content = {
        schemaVersion: FRENCH_INTERNAL_SHARD_SCHEMA_VERSION,
        policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
        shardId,
        sourceLogicalDigest,
        releaseKey: releaseLineage.releaseKey,
        releaseSnapshotFingerprint: releaseLineage.releaseSnapshotFingerprint,
        meaningSize,
        maxItems,
        estimatedEnglishCharacters: slice.reduce(
          (total, item) =>
            total + item.english.gloss.length + item.english.meaning.length,
          0
        ),
        resumeKey,
        items
      };
      shards.push({
        ...content,
        shardHash: hashFrenchInternalWorkJson(content)
      });
    }
  }
  const content = {
    schemaVersion: FRENCH_INTERNAL_SHARDS_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
    sourceLogicalDigest,
    releaseKey: releaseLineage.releaseKey,
    releaseSnapshotFingerprint: releaseLineage.releaseSnapshotFingerprint,
    resumeContract: {
      skipOnlyWhen:
        "validated-role-output-pins-exact-shard-and-view-hashes" as const,
      changedViewCreatesNewResumeKey: true as const
    },
    batchSizes,
    shards
  };
  return { ...content, contentHash: hashFrenchInternalWorkJson(content) };
}

export function assertProposerABlindView(
  view: FrenchInternalProposerAView
): void {
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>
    )) {
      if (
        path === "proposerA" &&
        ["guide", "canonicalRegistry", "morphology"].includes(key)
      ) {
        continue;
      }
      if (PROPOSER_A_BANNED_KEYS.has(key)) {
        throw new Error(`french-internal-proposer-a-leak:${path}.${key}`);
      }
      visit(child, `${path}.${key}`);
    }
  };
  visit(view, "proposerA");
  if (
    view.canonicalRegistry.some(
      (record) => record.status !== "green" || !record.canonicalFr.trim()
    )
  ) {
    throw new Error("french-internal-proposer-a-non-green-canonical-registry");
  }
}

export function classifyFrenchInternalMeaningSize(
  meaning: string
): FrenchInternalMeaningSize {
  const length = meaning.length;
  if (length < 300) return "short";
  if (length < 900) return "medium";
  if (length < 1_800) return "long";
  return "very_long";
}

export function renderFrenchInternalJsonl(records: readonly unknown[]): string {
  return `${records.map(canonicalFrenchInternalWorkJson).join("\n")}\n`;
}

export function renderFrenchInternalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateFrenchInternalWorkSources(
  sources: FrenchInternalWorkSources,
  expectations: FrenchInternalWorkExpectations | null
): void {
  const expectedEntries =
    expectations?.expectedEntryCount ?? sources.packets.length;
  if (
    sources.packetSummary.schemaVersion !==
      "lexicon-v3-french-packet-build@3" ||
    sources.packetSummary.outputPackets !== expectedEntries ||
    sources.packetSummary.inputRecords !== expectedEntries ||
    sources.packetSummary.outputDigest !== sources.sourceDigests.packets
  ) {
    throw new Error("french-internal-work-packet-summary-invalid");
  }
  const readyEnglish =
    (sources.packetSummary.englishStatusCounts.validated ?? 0) +
    (sources.packetSummary.englishStatusCounts.human_validated ?? 0);
  if (readyEnglish !== expectedEntries) {
    throw new Error(
      `french-internal-work-packets-not-promoted:${readyEnglish}`
    );
  }
  if (
    sources.packetSummary.englishAuthoring.digest !==
      sources.packetSummary.sourceDigests.englishAuthoring ||
    sources.packetSummary.englishAuthoring.digest !==
      sources.reuseSummary.sourceDigests.authoring ||
    sources.packetSummary.sourceDigests.fullDatabase !==
      sources.reuseSummary.sourceDigests.legacyFull
  ) {
    throw new Error("french-internal-work-packet-reuse-lineage-mismatch");
  }
  if (
    sources.packetSummary.englishRelease.releaseKey !==
      sources.reuseSummary.englishRelease.releaseKey ||
    sources.packetSummary.englishRelease.snapshotFingerprint !==
      sources.reuseSummary.englishRelease.snapshotFingerprint ||
    sources.packetSummary.englishRelease.sourceFingerprint !==
      sources.reuseSummary.englishRelease.sourceFingerprint ||
    sources.packetSummary.englishRelease.sourceLogicalFingerprint !==
      sources.reuseSummary.englishRelease.sourceLogicalFingerprint ||
    sources.packetSummary.englishRelease.codeFingerprint !==
      sources.reuseSummary.englishRelease.codeFingerprint ||
    sources.packetSummary.englishRelease.policyVersion !==
      sources.reuseSummary.englishRelease.policyVersion
  ) {
    throw new Error("french-internal-work-release-lineage-mismatch");
  }
  if (
    sources.reuseSummary.schemaVersion !==
      FRENCH_REUSE_MANIFEST_SCHEMA_VERSION ||
    sources.reuseSummary.policyVersion !== FRENCH_REUSE_POLICY_VERSION ||
    sources.reuseSummary.recordsOutputDigest !==
      sources.sourceDigests.reuseRecords ||
    sources.reuseSummary.counts.entries !== expectedEntries ||
    sources.reuseSummary.registryDigests.hebrewIdentityCorrections !==
      HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
  ) {
    throw new Error("french-internal-work-reuse-summary-invalid");
  }
  assertFrenchReuseManifest(
    { records: sources.reuseRecords, summary: sources.reuseSummary },
    null
  );
  assertFrenchEntityMergeAttestationArtifactShape(
    sources.entityMergeAttestation
  );
  if (
    sources.entityMergeAttestation.releaseKey !==
      sources.packetSummary.englishRelease.releaseKey ||
    sources.entityMergeAttestation.releaseSnapshotFingerprint !==
      sources.packetSummary.englishRelease.snapshotFingerprint ||
    sources.entityMergeAttestation.outputs.canonicalEntities.sha256 !==
      sources.sourceDigests.canonicalEntities ||
    sources.entityMergeAttestation.outputs.canonicalEntryPolicies.sha256 !==
      sources.sourceDigests.canonicalEntryPolicies ||
    sources.entityMergeAttestation.gateHash !== sources.entityGate.gateHash
  ) {
    throw new Error("french-internal-work-entity-attestation-lineage-invalid");
  }
  assertFrenchEntityPipelineArtifacts({
    entityGate: sources.entityGate,
    entityMentions: sources.entityMentions,
    canonicalEntities: sources.canonicalEntities,
    canonicalEntryPolicies: sources.canonicalEntryPolicies,
    packets: sources.packets,
    quarantinedEntryKeys: sources.quarantinedEntryKeys,
    mentionResolutionAttestation:
      sources.entityMentionResolutionAttestation ?? undefined
  });
  const entityGatePolicyCount =
    "canonicalPolicyCount" in sources.entityGate
      ? sources.entityGate.canonicalPolicyCount
      : sources.entityGate.policyCount;
  const entityGateEntityCount =
    "canonicalEntityCount" in sources.entityGate
      ? sources.entityGate.canonicalEntityCount
      : sources.entityGate.entityCount;
  if (
    entityGatePolicyCount !== sources.canonicalEntryPolicies.length ||
    entityGateEntityCount !== sources.canonicalEntities.length
  ) {
    throw new Error("french-internal-work-entity-gate-cardinality-invalid");
  }
  const quarantinedEntryKeySet = new Set(sources.quarantinedEntryKeys);
  if (
    quarantinedEntryKeySet.size !== sources.quarantinedEntryKeys.length ||
    sources.canonicalEntryPolicies.some((policy) =>
      quarantinedEntryKeySet.has(policy.entryKey)
    )
  ) {
    throw new Error("french-internal-work-entity-quarantine-invalid");
  }
  validateEditorialSources(sources, expectedEntries);
  const reuseByKey = uniqueMap(
    sources.reuseRecords,
    (record) => record.entryKey,
    "packet-release-reuse"
  );
  for (const packet of sources.packets) {
    const issues = validateFrenchPacket(packet);
    if (issues.length > 0) {
      throw new Error(
        `french-internal-work-packet-invalid:${packet.entryKey}:${issues.join(",")}`
      );
    }
    if (
      packet.english.status !== "validated" &&
      packet.english.status !== "human_validated"
    ) {
      throw new Error(
        `french-internal-work-packet-not-ready:${packet.entryKey}`
      );
    }
    const reuse = requiredMapValue(
      reuseByKey,
      packet.entryKey,
      "packet-release-reuse"
    );
    assertExactEnglishReleaseLineage(packet, reuse);
    assertFrenchPacketTranslatable(packet);
  }
  if (
    sources.packets.length !== expectedEntries ||
    sources.reuseRecords.length !== expectedEntries ||
    sources.termbase.length !== expectedEntries
  ) {
    throw new Error("french-internal-work-source-cardinality-invalid");
  }
  if (expectations) assertSourceExpectations(sources, expectations);
}

function validateEditorialSources(
  sources: FrenchInternalWorkSources,
  expectedEntries: number
): void {
  const summary = sources.editorialSummary;
  if (
    summary.schemaVersion !== FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION ||
    summary.policyVersion !== FRENCH_EDITORIAL_POLICY_VERSION ||
    summary.releaseKey !== sources.reuseSummary.englishRelease.releaseKey ||
    summary.counts.entries !== expectedEntries ||
    summary.counts.termbaseCandidates !== expectedEntries ||
    summary.counts.entityRegistry !== sources.entities.length ||
    summary.counts.morphologyTranslations !== sources.morphology.length
  ) {
    throw new Error("french-internal-work-editorial-summary-invalid");
  }
  const { summaryContentHash, ...summaryContent } = summary;
  if (
    !SHA256_PATTERN.test(summaryContentHash) ||
    frenchEditorialContentHash(summaryContent) !== summaryContentHash
  ) {
    throw new Error("french-internal-work-editorial-summary-hash-invalid");
  }
  const artifactChecks: Array<
    [
      keyof Pick<
        FrenchInternalSourcePaths,
        "entityRegistry" | "termbase" | "morphology"
      >,
      keyof FrenchEditorialBuildSummaryInput["artifacts"],
      number
    ]
  > = [
    ["entityRegistry", "entityRegistry", sources.entities.length],
    ["termbase", "termbaseCandidates", sources.termbase.length],
    ["morphology", "morphology", sources.morphology.length]
  ];
  for (const [sourceKey, artifactKey, records] of artifactChecks) {
    const artifact = summary.artifacts[artifactKey];
    if (
      resolve(artifact.path) !== sources.sourcePaths[sourceKey] ||
      artifact.sha256 !== sources.sourceDigests[sourceKey] ||
      artifact.bytes !== statSync(sources.sourcePaths[sourceKey]).size ||
      artifact.records !== records
    ) {
      throw new Error(
        `french-internal-work-editorial-artifact-mismatch:${artifactKey}`
      );
    }
  }
  if (
    sources.guide.schemaVersion !== "lexicon-v3-french-editorial-guide@1" ||
    sources.guide.locale !== "fr" ||
    !sources.guide.releaseRule.trim() ||
    summary.sourceDigests.editorialGuide !== sources.sourceDigests.guide
  ) {
    throw new Error("french-internal-work-guide-invalid");
  }
  for (const entity of sources.entities) {
    assertEditorialRecordHash(entity, "entity");
    if (entity.schemaVersion !== FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION) {
      throw new Error(`french-internal-work-entity-schema:${entity.entryKey}`);
    }
  }
  for (const termbase of sources.termbase) {
    assertEditorialRecordHash(termbase, "termbase");
    if (termbase.schemaVersion !== FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION) {
      throw new Error(
        `french-internal-work-termbase-schema:${termbase.entryKey}`
      );
    }
  }
  for (const morphology of sources.morphology) {
    assertEditorialRecordHash(morphology, "morphology");
    if (
      morphology.schemaVersion !== FRENCH_MORPHOLOGY_SCHEMA_VERSION ||
      morphology.language !== "fr"
    ) {
      throw new Error(
        `french-internal-work-morphology-schema:${morphology.morphologyCodeId}`
      );
    }
  }
}

function assertSourceExpectations(
  sources: FrenchInternalWorkSources,
  expectations: FrenchInternalWorkExpectations
): void {
  const mismatches: string[] = [];
  if (
    expectations.packetOutputDigest &&
    sources.sourceDigests.packets !== expectations.packetOutputDigest
  ) {
    mismatches.push("packet-output-digest");
  }
  if (
    expectations.reuseRecordsOutputDigest &&
    sources.sourceDigests.reuseRecords !== expectations.reuseRecordsOutputDigest
  ) {
    mismatches.push("reuse-records-output-digest");
  }
  if (
    expectations.authoringDigest &&
    sources.reuseSummary.sourceDigests.authoring !==
      expectations.authoringDigest
  ) {
    mismatches.push("authoring-digest");
  }
  if (
    expectations.legacyFullDigest &&
    sources.reuseSummary.sourceDigests.legacyFull !==
      expectations.legacyFullDigest
  ) {
    mismatches.push("legacy-full-digest");
  }
  if (
    expectations.releaseKey &&
    sources.reuseSummary.englishRelease.releaseKey !== expectations.releaseKey
  ) {
    mismatches.push("release-key");
  }
  if (
    expectations.releaseSnapshotFingerprint &&
    sources.reuseSummary.englishRelease.snapshotFingerprint !==
      expectations.releaseSnapshotFingerprint
  ) {
    mismatches.push("release-snapshot");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `french-internal-work-current-baseline-mismatch:${mismatches.join(",")}`
    );
  }
}

function buildGlobalLineage(
  sources: FrenchInternalWorkSources
): FrenchInternalGlobalLineage {
  const base = {
    packetOutputDigest: sources.sourceDigests.packets,
    packetAuthoringDigest: sources.packetSummary.englishAuthoring.digest,
    reuseRecordsOutputDigest: sources.sourceDigests.reuseRecords,
    reuseManifestDigest: sources.reuseSummary.manifestDigest,
    authoringDigest: sources.reuseSummary.sourceDigests.authoring,
    legacyFullDigest: sources.reuseSummary.sourceDigests.legacyFull,
    releaseKey: sources.reuseSummary.englishRelease.releaseKey,
    releaseSnapshotFingerprint:
      sources.reuseSummary.englishRelease.snapshotFingerprint,
    editorialSummaryContentHash: sources.editorialSummary.summaryContentHash,
    editorialPolicyVersion: sources.editorialSummary.policyVersion,
    identityCorrectionsRegistryDigest:
      HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST,
    canonicalEntitiesHash: sources.sourceDigests.canonicalEntities,
    canonicalEntryPoliciesHash: sources.sourceDigests.canonicalEntryPolicies,
    entityMergeAttestationHash: sources.sourceDigests.entityMergeAttestation,
    entityMergeAttestationContentHash:
      sources.entityMergeAttestation.attestationHash,
    entityGateHash: sources.sourceDigests.entityGate,
    entityGateContentHash: sources.entityGate.gateHash,
    entityMentionsHash: sources.sourceDigests.entityMentions,
    entityMentionsContentHash: sources.entityMentions.contentHash,
    ...(sources.entityMentionResolutionAttestation
      ? {
          entityMentionResolutionAttestationHash:
            sources.sourceDigests.entityMentionResolutionAttestation,
          entityMentionResolutionAttestationContentHash:
            sources.entityMentionResolutionAttestation.attestationHash
        }
      : {}),
    guideSourceDigest: sources.sourceDigests.guide,
    guideContentHash: hashFrenchInternalWorkJson(sources.guide)
  };
  return {
    ...base,
    sourceLogicalDigest: hashFrenchInternalWorkJson({
      schemaVersion: "lexicon-v3-french-internal-source-lineage@1",
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      sourceDigests: sources.sourceDigests,
      lineage: base
    })
  };
}

function validateExactEntryJoin(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord,
  termbase: FrenchEditorialTermbaseRecord,
  entity: FrenchEditorialEntityRecord | null
): void {
  const entryKey = packet.entryKey;
  const computedKey = buildLexiconEntryKey(
    packet.identity.language,
    packet.identity.dStrong
  );
  const primaryDStrong = extractPrimaryDStrong(packet.identity.dStrong);
  if (
    computedKey !== entryKey ||
    reuse.entryKey !== entryKey ||
    termbase.entryKey !== entryKey ||
    reuse.stepEntryId !== packet.identity.stepEntryId ||
    termbase.stepEntryId !== packet.identity.stepEntryId ||
    !primaryDStrong ||
    reuse.identity.primaryDStrong !== primaryDStrong ||
    termbase.identity.primaryDStrong !== primaryDStrong
  ) {
    throw new Error(`french-internal-work-entry-lineage-mismatch:${entryKey}`);
  }
  for (const identity of [reuse.identity, termbase.identity]) {
    for (const key of [
      "language",
      "eStrong",
      "dStrong",
      "uStrong",
      "original",
      "transliteration",
      "morph"
    ] as const) {
      if (identity[key] !== reuse.identity[key]) {
        throw new Error(
          `french-internal-work-canonical-identity-mismatch:${entryKey}:${key}`
        );
      }
    }
  }
  assertPacketIdentityTransition(packet, reuse);
  assertExactEnglishReleaseLineage(packet, reuse);
  if (
    termbase.english.gloss !== packet.english.gloss ||
    termbase.english.meaning !== packet.english.meaningHtml ||
    termbase.english.glossStatusHash !== reuse.parents.gloss.contentHash ||
    termbase.english.meaningStatusHash !== reuse.parents.meaning.contentHash
  ) {
    throw new Error(`french-internal-work-english-parent-mismatch:${entryKey}`);
  }
  const existingFrench = packet.evidence.existingFrench;
  if (
    !existingFrench ||
    sha256(existingFrench.gloss) !== reuse.priorFrench.glossHash ||
    sha256(existingFrench.meaning) !== reuse.priorFrench.meaningTextHash ||
    sha256(existingFrench.meaningHtml) !== reuse.priorFrench.meaningHtmlHash
  ) {
    throw new Error(
      `french-internal-work-prior-french-lineage-mismatch:${entryKey}`
    );
  }
  if (termbase.pos === "proper-name") {
    if (!entity || entity.entryKey !== entryKey) {
      throw new Error(`french-internal-work-proper-entity-missing:${entryKey}`);
    }
    if (
      entity.stepEntryId !== packet.identity.stepEntryId ||
      entity.englishGloss !== packet.english.gloss
    ) {
      throw new Error(
        `french-internal-work-entity-lineage-mismatch:${entryKey}`
      );
    }
    for (const key of [
      "language",
      "primaryDStrong",
      "eStrong",
      "dStrong",
      "uStrong",
      "morph"
    ] as const) {
      const expected =
        key === "primaryDStrong" ? primaryDStrong : packet.identity[key];
      if (entity.identity[key] !== expected) {
        throw new Error(
          `french-internal-work-entity-identity-mismatch:${entryKey}:${key}`
        );
      }
    }
  } else if (entity) {
    throw new Error(`french-internal-work-non-proper-entity:${entryKey}`);
  }
}

function assertExactEnglishReleaseLineage(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord
): void {
  const release = packet.englishRelease;
  for (const field of ["gloss", "meaning"] as const) {
    const packetParent = release.parents[field];
    const reuseParent = reuse.parents[field];
    if (
      release.releaseKey !== reuseParent.releaseKey ||
      release.releaseSnapshotFingerprint !==
        reuseParent.releaseSnapshotFingerprint ||
      packetParent.entryKey !== reuseParent.entryKey ||
      packetParent.field !== reuseParent.field ||
      packetParent.fieldVersionId !== reuseParent.fieldVersionId ||
      packetParent.contentHash !== reuseParent.contentHash ||
      packetParent.valueTextHash !== reuseParent.valueTextHash ||
      packetParent.valueHtmlHash !== reuseParent.valueHtmlHash ||
      packetParent.state !== reuseParent.state ||
      packetParent.method !== reuseParent.method ||
      packetParent.generator !== reuseParent.generator
    ) {
      throw new Error(
        `french-internal-work-exact-english-parent-mismatch:${packet.entryKey}:${field}`
      );
    }
  }
}

function assertPacketIdentityTransition(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord
): void {
  const fields = [
    "eStrong",
    "dStrong",
    "uStrong",
    "original",
    "transliteration",
    "morph"
  ] as const;
  const changed = fields.filter(
    (field) => packet.identity[field] !== reuse.identity[field]
  );
  if (changed.length === 0) return;
  const primary = extractPrimaryDStrong(packet.identity.dStrong);
  const correction = HEBREW_IDENTITY_CORRECTIONS.find(
    (record) => record.key === primary
  );
  if (
    !correction ||
    correction.stepEntryId !== packet.identity.stepEntryId ||
    canonicalFrenchInternalWorkJson(changed) !==
      canonicalFrenchInternalWorkJson(correction.changedFields) ||
    !reuse.glossRiskFlags.includes("hebrew-identity-correction")
  ) {
    throw new Error(
      `french-internal-work-unsealed-identity-transition:${packet.entryKey}`
    );
  }
  for (const field of fields) {
    if (
      packet.identity[field] !== correction.before[field] ||
      reuse.identity[field] !== correction.after[field]
    ) {
      throw new Error(
        `french-internal-work-identity-correction-mismatch:${packet.entryKey}:${field}`
      );
    }
  }
}

function canonicalEntryIdentity(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord
): LexiconV3FrenchPacket["identity"] {
  return {
    stepEntryId: packet.identity.stepEntryId,
    language: reuse.identity.language,
    eStrong: reuse.identity.eStrong,
    dStrong: reuse.identity.dStrong,
    uStrong: reuse.identity.uStrong,
    original: reuse.identity.original,
    transliteration: reuse.identity.transliteration,
    morph: reuse.identity.morph
  };
}

function buildEntryLineage(
  global: FrenchInternalGlobalLineage,
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord,
  termbase: FrenchEditorialTermbaseRecord,
  entity: FrenchEditorialEntityRecord | null,
  entityConstraints: FrenchInternalEntityConstraints,
  morphology: FrenchEditorialMorphologyRecord[],
  pretranslationAudit: FrenchPretranslationAuditRecord
): FrenchInternalEntryLineage {
  return {
    sourceLogicalDigest: global.sourceLogicalDigest,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    reuseRecordDigest: reuse.recordDigest,
    releaseKey: reuse.parents.meaning.releaseKey,
    releaseSnapshotFingerprint:
      reuse.parents.meaning.releaseSnapshotFingerprint,
    glossParentContentHash: reuse.parents.gloss.contentHash,
    meaningParentContentHash: reuse.parents.meaning.contentHash,
    englishParents: packet.englishRelease.parents,
    pretranslationAuditHash: hashFrenchInternalWorkJson(pretranslationAudit),
    termbaseContentHash: termbase.contentHash,
    entityContentHash: entity?.contentHash ?? null,
    canonicalEntitiesHash: global.canonicalEntitiesHash,
    canonicalEntryPoliciesHash: global.canonicalEntryPoliciesHash,
    entityMergeAttestationHash: global.entityMergeAttestationHash,
    entityMergeAttestationContentHash: global.entityMergeAttestationContentHash,
    entityGateHash: global.entityGateHash,
    entityMentionsHash: global.entityMentionsHash,
    canonicalEntryPolicyContentHash:
      entityConstraints.entryPolicy?.contentHash ?? null,
    canonicalEntityContentHashes: entityConstraints.canonicalEntities.map(
      (record) => record.contentHash
    ),
    requiredEntityMentionContentHashes: entityConstraints.requiredMentions.map(
      (record) => record.contentHash
    ),
    morphologyContentHashes: morphology.map((record) => record.contentHash),
    editorialSummaryContentHash: global.editorialSummaryContentHash,
    guideSourceDigest: global.guideSourceDigest
  };
}

function buildWorkStrata(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord,
  termbase: FrenchEditorialTermbaseRecord,
  legacyHtml: FrenchInternalLegacyHtmlNormalization | null,
  pretranslationAudit: FrenchPretranslationAuditRecord,
  entityPolicyQuarantined: boolean
): FrenchInternalWorkStrata {
  const theological =
    THEOLOGICAL_REVIEW_BASE_STRONGS.has(termbase.identity.classicalStrong) ||
    termbase.reasons.includes("theological-or-tradition-sensitive-base-strong");
  const meaningSize = classifyFrenchInternalMeaningSize(packet.english.meaning);
  const risk = new Set<string>();
  if (reuse.glossReviewSeed || reuse.meaningReviewSeed) {
    risk.add("sealed-review-seed");
  }
  if (reuse.meaningCohort === "other_changed") {
    risk.add("english-selection-changed");
  }
  if (reuse.meaningCohort === "step_specific_only") {
    risk.add("sub-step-boundary");
  }
  if (termbase.pos === "proper-name") risk.add("proper-name");
  if (!pretranslationAudit.autoPublicationAllowed) {
    risk.add("pretranslation-review-needed");
  }
  if (entityPolicyQuarantined) {
    risk.add("entity-policy-quarantined");
  }
  if (theological) risk.add("theological");
  if (legacyHtml && !legacyHtml.textEquivalent) {
    risk.add("legacy-html-normalized-divergence");
  }
  if (
    reuse.highRiskFlags.some((flag) =>
      [
        "protected-bible-reference",
        "protected-original-script",
        "protected-strong-code"
      ].includes(flag)
    )
  ) {
    risk.add("protected-content");
  }
  if (
    reuse.glossRiskFlags.some((flag) =>
      [
        "legacy-french-known-false-friend",
        "legacy-french-verb-not-infinitive",
        "legacy-french-gloss-terminal-punctuation"
      ].includes(flag)
    )
  ) {
    risk.add("historical-french-risk");
  }
  if (meaningSize === "long" || meaningSize === "very_long") {
    risk.add("long-notice");
  }
  if (risk.size === 0) risk.add("baseline");
  return {
    language: packet.identity.language,
    meaningCohort: reuse.meaningCohort,
    pos: termbase.pos,
    properName: termbase.pos === "proper-name",
    theological,
    legacyHtmlCategory: legacyHtml?.category ?? "absent",
    meaningSize,
    riskCategories: [...risk].sort(compareText)
  };
}

export function buildFrenchInternalPublicationGate(
  audit: FrenchPretranslationAuditRecord
): FrenchInternalProposerBaseView["publicationGate"] {
  if (
    audit.schemaVersion !== FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION ||
    audit.policyVersion !== FRENCH_PRETRANSLATION_POLICY_VERSION ||
    !audit.translationAllowed ||
    audit.gateStatus === "source_issue" ||
    audit.autoPublicationAllowed !== (audit.gateStatus === "ready")
  ) {
    throw new Error(`french-internal-pretranslation-gate:${audit.entryKey}`);
  }
  return {
    pretranslationAuditHash: hashFrenchInternalWorkJson(audit),
    gateStatus: audit.gateStatus,
    translationAllowed: true,
    autoPublicationAllowed: audit.autoPublicationAllowed,
    fourAgentReviewRequired: true,
    directPublicationAllowed: false
  };
}

function normalizeLegacyHtmlEvidence(
  packet: LexiconV3FrenchPacket
): FrenchInternalLegacyHtmlNormalization | null {
  const candidate = packet.evidence.existingFrench;
  if (!candidate?.meaningHtml.trim()) return null;
  const normalizedVisibleText = normalizeVisibleFrench(
    stripLexiconHtml(candidate.meaningHtml)
  );
  const candidateMeaning = normalizeVisibleFrench(candidate.meaning);
  const textEquivalent = normalizedVisibleText === candidateMeaning;
  return {
    category: textEquivalent ? "normalized_equivalent" : "normalized_divergent",
    rawHtmlHash: sha256(candidate.meaningHtml),
    normalizedVisibleText,
    normalizedVisibleTextHash: sha256(normalizedVisibleText),
    candidateMeaningNormalizedHash: sha256(candidateMeaning),
    textEquivalent
  };
}

export function buildCanonicalRegistry(
  termbase: FrenchEditorialTermbaseRecord,
  entityConstraints: FrenchInternalEntityConstraints
): FrenchInternalCanonicalRegistryEntry[] {
  const records: FrenchInternalCanonicalRegistryEntry[] = [];
  const policy = entityConstraints.entryPolicy;
  for (const canonicalFr of uniqueSorted(
    [policy?.primaryFr, policy?.derivedFr]
      .filter((form): form is string => typeof form === "string")
      .map((form) => form.trim())
      .filter(Boolean)
  )) {
    records.push({
      kind: "entity",
      status: "green",
      canonicalFr,
      sourceContentHash: policy!.contentHash
    });
  }
  if (termbase.status === "green" && termbase.canonicalFr?.trim()) {
    records.push({
      kind: "termbase",
      status: "green",
      canonicalFr: termbase.canonicalFr,
      sourceContentHash: termbase.contentHash
    });
  }
  return records.sort((left, right) => {
    const kind = compareText(left.kind, right.kind);
    return kind || compareText(left.canonicalFr, right.canonicalFr);
  });
}

function groupEntityMentionsBySourceEntry(
  mentions: readonly RequiredFrenchEntityMention[]
): Map<string, RequiredFrenchEntityMention[]> {
  const result = new Map<string, RequiredFrenchEntityMention[]>();
  for (const mention of mentions) {
    const values = result.get(mention.sourceEntryKey) ?? [];
    values.push(mention);
    result.set(mention.sourceEntryKey, values);
  }
  for (const values of result.values()) {
    values.sort((left, right) => compareText(left.mentionId, right.mentionId));
  }
  return result;
}

export function buildFrenchInternalEntityConstraints(input: {
  entryKey: string;
  canonicalEntryPolicyByKey: Map<string, FrenchCanonicalEntryNamePolicy>;
  canonicalEntityById: Map<number, FrenchCanonicalEntityRecord>;
  quarantinedEntryKeys: ReadonlySet<string>;
  requiredMentions: readonly RequiredFrenchEntityMention[];
}): FrenchInternalEntityConstraints {
  const quarantined = input.quarantinedEntryKeys.has(input.entryKey);
  const entryPolicy =
    input.canonicalEntryPolicyByKey.get(input.entryKey) ?? null;
  if (quarantined && entryPolicy !== null) {
    throw new Error(
      `french-internal-work-quarantined-entry-policy-present:${input.entryKey}`
    );
  }
  const mentionPolicyKeys = uniqueSorted(
    input.requiredMentions.flatMap((mention) =>
      mention.targetEntryKey && mention.resolution !== "quarantined"
        ? [mention.targetEntryKey]
        : []
    )
  );
  const mentionPolicies = mentionPolicyKeys.map((entryKey) =>
    requiredMapValue(
      input.canonicalEntryPolicyByKey,
      entryKey,
      "entity-mention-policy"
    )
  );
  const policyByKey = new Map<string, FrenchCanonicalEntryNamePolicy>();
  if (entryPolicy) policyByKey.set(entryPolicy.entryKey, entryPolicy);
  for (const policy of mentionPolicies)
    policyByKey.set(policy.entryKey, policy);
  const entityIds = [
    ...new Set([
      ...input.requiredMentions.flatMap((mention) => mention.targetEntityIds),
      ...[...policyByKey.values()].flatMap((policy) =>
        policy.entityBindings.map((binding) => binding.entityId)
      )
    ])
  ].sort((left, right) => left - right);
  const canonicalEntities = entityIds.map((entityId) =>
    requiredMapValue(
      input.canonicalEntityById,
      entityId,
      "entity-mention-canonical-entity"
    )
  );
  const requiredMentions = [...input.requiredMentions].sort((left, right) =>
    compareText(left.mentionId, right.mentionId)
  );
  for (const mention of requiredMentions) {
    if (mention.sourceEntryKey !== input.entryKey) {
      throw new Error(
        `french-internal-work-entity-mention-source-mismatch:${input.entryKey}:${mention.mentionId}`
      );
    }
    if (
      mention.resolution === "ambiguous" ||
      mention.resolution === "contextual"
    ) {
      throw new Error(
        `french-internal-work-entity-mention-ambiguous:${input.entryKey}:${mention.mentionId}`
      );
    }
  }
  const withoutHash = {
    quarantined,
    entryPolicy,
    mentionPolicies,
    canonicalEntities,
    requiredMentions
  };
  return {
    ...withoutHash,
    contextHash: hashFrenchInternalWorkJson(withoutHash)
  };
}

function buildCandidateEnvelope(
  packet: LexiconV3FrenchPacket,
  termbase: FrenchEditorialTermbaseRecord,
  entity: FrenchEditorialEntityRecord | null,
  normalizedLegacyHtml: FrenchInternalLegacyHtmlNormalization | null
): FrenchInternalCandidateEnvelope {
  const packetLegacy = packet.evidence.legacy
    ? { ...packet.evidence.legacy, trust: "untrusted-candidate" as const }
    : null;
  const packetExisting = packet.evidence.existingFrench
    ? {
        ...packet.evidence.existingFrench,
        sourceTrust: packet.evidence.existingFrench.trust,
        trust: "untrusted-candidate" as const
      }
    : null;
  const packetResources = packet.evidence.resourceFrench
    .filter((record) => record.trust === "validated-resource")
    .map((record) => ({
      ...record,
      sourceTrust: record.trust,
      trust: "untrusted-candidate" as const
    }));
  const packetConcordance = packet.evidence.concordanceForms
    .slice(0, 20)
    .map((record) => ({
      ...record,
      trust: "attested-carrier-review-only" as const
    }));
  const content = {
    trust: "untrusted-candidate" as const,
    authoritative: false as const,
    usage:
      "compare-diagnose-never-copy-without-independent-validation" as const,
    packet: {
      legacy: packetLegacy,
      existingFrench: packetExisting,
      resourceFrench: packetResources,
      concordanceForms: packetConcordance
    },
    editorial: {
      entityCandidates: entity
        ? {
            status: entity.status,
            matches: entity.matches,
            referenceEvidence: entity.referenceEvidence,
            historicalCandidate: entity.historicalCandidate,
            trust: "untrusted-candidate" as const
          }
        : null,
      historicalFrench: null,
      legacyFrench: null,
      concordanceForms: [],
      deterministicRepairCandidate: termbase.deterministicRepairCandidate
    },
    normalizedLegacyHtml
  };
  return { ...content, evidenceHash: hashFrenchInternalWorkJson(content) };
}

function buildMorphologyIndex(
  records: FrenchEditorialMorphologyRecord[]
): Map<string, FrenchEditorialMorphologyRecord[]> {
  const index = new Map<string, FrenchEditorialMorphologyRecord[]>();
  for (const record of records) {
    for (const code of uniqueSorted([record.code, record.normalizedCode])) {
      const values = index.get(code) ?? [];
      values.push(record);
      index.set(code, values);
    }
  }
  for (const values of index.values()) {
    values.sort(
      (left, right) => left.morphologyCodeId - right.morphologyCodeId
    );
  }
  return index;
}

function morphologyForEntry(
  morph: string,
  index: Map<string, FrenchEditorialMorphologyRecord[]>
): FrenchEditorialMorphologyRecord[] {
  const codes = uniqueSorted([
    morph.trim(),
    ...morph
      .split(/\s*(?:\/|\+)\s*/u)
      .map((value) => value.trim())
      .filter(Boolean)
  ]);
  const byId = new Map<number, FrenchEditorialMorphologyRecord>();
  for (const code of codes) {
    for (const record of index.get(code) ?? []) {
      byId.set(record.morphologyCodeId, record);
    }
  }
  return [...byId.values()].sort(
    (left, right) => left.morphologyCodeId - right.morphologyCodeId
  );
}

function pilotLabels(strata: FrenchInternalWorkStrata): string[] {
  return uniqueSorted([
    `language:${strata.language}`,
    `cohort:${strata.meaningCohort}`,
    `position:${strata.pos}`,
    `proper-name:${strata.properName}`,
    `theological:${strata.theological}`,
    `legacy-html:${strata.legacyHtmlCategory}`,
    `size:${strata.meaningSize}`,
    `language-cohort:${strata.language}:${strata.meaningCohort}`,
    ...strata.riskCategories.map((category) => `risk:${category}`)
  ]);
}

function pilotTargets(
  candidates: Array<{ labels: string[] }>,
  pilotSize: number
): PilotLabelTarget[] {
  const populations = new Map<string, number>();
  for (const candidate of candidates) {
    for (const label of candidate.labels) {
      populations.set(label, (populations.get(label) ?? 0) + 1);
    }
  }
  const result: PilotLabelTarget[] = [];
  for (const [label, population] of [...populations.entries()].sort(
    ([left], [right]) => compareText(left, right)
  )) {
    let hardFloor = 0;
    let desiredFloor = 0;
    let weight = 1;
    if (label.startsWith("language:")) {
      hardFloor = 40;
      desiredFloor = 80;
      weight = 5;
    } else if (label.startsWith("cohort:")) {
      hardFloor = 30;
      desiredFloor = 45;
      weight = 5;
    } else if (label.startsWith("language-cohort:")) {
      hardFloor = 8;
      desiredFloor = 15;
      weight = 4;
    } else if (label === "proper-name:true") {
      hardFloor = 30;
      desiredFloor = 50;
      weight = 4;
    } else if (label === "theological:true") {
      hardFloor = 20;
      desiredFloor = 30;
      weight = 5;
    } else if (label.startsWith("legacy-html:") || label.startsWith("size:")) {
      hardFloor = 15;
      desiredFloor = 25;
      weight = 3;
    } else if (label.startsWith("risk:")) {
      hardFloor = 10;
      desiredFloor = 20;
      weight = 3;
    } else if (label.startsWith("position:")) {
      hardFloor = 4;
      desiredFloor = 10;
      weight = 2;
    }
    const proportional = Math.round(
      (pilotSize * population) / candidates.length
    );
    result.push({
      label,
      population,
      hardMinimum: Math.min(population, hardFloor),
      desired: Math.min(
        population,
        Math.max(hardFloor, desiredFloor, proportional)
      ),
      weight
    });
  }
  return result;
}

function pilotCandidateScore(
  labels: string[],
  counts: Map<string, number>,
  targets: PilotLabelTarget[]
): { score: number; reasons: string[] } {
  const targetByLabel = new Map(
    targets.map((target) => [target.label, target])
  );
  let score = 0;
  const reasons: string[] = [];
  for (const label of labels) {
    const target = targetByLabel.get(label);
    if (!target) continue;
    const current = counts.get(label) ?? 0;
    if (current < target.hardMinimum) {
      score +=
        target.weight *
        100 *
        ((target.hardMinimum - current) / Math.max(1, target.hardMinimum));
      reasons.push(label);
    } else if (current < target.desired) {
      score +=
        target.weight *
        ((target.desired - current) / Math.max(1, target.desired));
      reasons.push(label);
    }
  }
  return { score, reasons };
}

function countStrata(
  strataValues: readonly FrenchInternalWorkStrata[]
): FrenchInternalStrataCounts {
  const counts: FrenchInternalStrataCounts = {
    languages: {},
    meaningCohorts: {},
    positions: {},
    properNames: {},
    theological: {},
    legacyHtmlCategories: {},
    meaningSizes: {},
    riskCategories: {}
  };
  for (const strata of strataValues) {
    increment(counts.languages, strata.language);
    increment(counts.meaningCohorts, strata.meaningCohort);
    increment(counts.positions, strata.pos);
    increment(counts.properNames, String(strata.properName));
    increment(counts.theological, String(strata.theological));
    increment(counts.legacyHtmlCategories, strata.legacyHtmlCategory);
    increment(counts.meaningSizes, strata.meaningSize);
    for (const category of strata.riskCategories) {
      increment(counts.riskCategories, category);
    }
  }
  return {
    languages: sortedRecord(counts.languages),
    meaningCohorts: sortedRecord(counts.meaningCohorts),
    positions: sortedRecord(counts.positions),
    properNames: sortedRecord(counts.properNames),
    theological: sortedRecord(counts.theological),
    legacyHtmlCategories: sortedRecord(counts.legacyHtmlCategories),
    meaningSizes: sortedRecord(counts.meaningSizes),
    riskCategories: sortedRecord(counts.riskCategories)
  };
}

function buildWorkSummary(input: {
  generatedAt: string;
  sources: FrenchInternalWorkSources;
  outputPaths: FrenchInternalWorkOutputPaths;
  globalLineage: FrenchInternalGlobalLineage;
  workItems: FrenchInternalWorkView[];
  proposerAViews: FrenchInternalProposerAView[];
  proposerBViews: FrenchInternalProposerBView[];
  pilot: FrenchInternalPilotPlan;
  shards: FrenchInternalShardPlan;
}): FrenchInternalWorkSummary {
  const artifacts = {
    workItems: jsonlMetadata(
      input.outputPaths.workItems,
      input.workItems,
      input.workItems.map((item) => ({
        entryKey: item.entryKey,
        viewHash: item.viewHash
      }))
    ),
    proposerA: jsonlMetadata(
      input.outputPaths.proposerA,
      input.proposerAViews,
      input.proposerAViews.map((item) => ({
        entryKey: item.entryKey,
        viewHash: item.viewHash
      }))
    ),
    proposerB: jsonlMetadata(
      input.outputPaths.proposerB,
      input.proposerBViews,
      input.proposerBViews.map((item) => ({
        entryKey: item.entryKey,
        viewHash: item.viewHash
      }))
    ),
    pilotKeys: jsonMetadata(
      input.outputPaths.pilotKeys,
      input.pilot,
      input.pilot.selections.map((selection) => ({
        entryKey: selection.entryKey,
        selectionHash: selection.selectionHash
      })),
      input.pilot.keys.length
    ),
    shards: jsonMetadata(
      input.outputPaths.shards,
      input.shards,
      input.shards.shards.map((shard) => ({
        shardId: shard.shardId,
        shardHash: shard.shardHash
      })),
      input.shards.shards.length
    )
  };
  const content = {
    schemaVersion: FRENCH_INTERNAL_WORK_SUMMARY_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
    generatedAt: input.generatedAt,
    sourcePaths: input.sources.sourcePaths,
    sourceDigests: input.sources.sourceDigests,
    outputPaths: input.outputPaths,
    lineage: input.globalLineage,
    counts: {
      workItems: input.workItems.length,
      proposerAViews: input.proposerAViews.length,
      proposerBViews: input.proposerBViews.length,
      pilotKeys: input.pilot.keys.length,
      shards: input.shards.shards.length,
      shardItems: input.shards.shards.reduce(
        (total, shard) => total + shard.items.length,
        0
      ),
      sourceStrata: countStrata(input.workItems.map((item) => item.strata)),
      pilotStrata: input.pilot.strataCounts
    },
    artifacts
  };
  return { ...content, summaryHash: hashFrenchInternalWorkJson(content) };
}

function jsonlMetadata(
  path: string,
  records: readonly unknown[],
  logicalProjection: unknown
): FrenchInternalArtifactMetadata {
  const hash = createHash("sha256");
  let bytes = 0;
  for (const record of records) {
    const line = `${canonicalFrenchInternalWorkJson(record)}\n`;
    hash.update(line);
    bytes += Buffer.byteLength(line);
  }
  return {
    path,
    sha256: hash.digest("hex"),
    bytes,
    records: records.length,
    logicalDigest: hashFrenchInternalWorkJson(logicalProjection)
  };
}

function jsonMetadata(
  path: string,
  value: unknown,
  logicalProjection: unknown,
  records: number
): FrenchInternalArtifactMetadata {
  const body = renderFrenchInternalJson(value);
  return {
    path,
    sha256: sha256(body),
    bytes: Buffer.byteLength(body),
    records,
    logicalDigest: hashFrenchInternalWorkJson(logicalProjection)
  };
}

function assertExactEntryLineage(
  expected: FrenchInternalEntryLineage,
  actual: FrenchInternalEntryLineage,
  entryKey: string,
  scope: string
): void {
  if (
    canonicalFrenchInternalWorkJson(actual) !==
    canonicalFrenchInternalWorkJson(expected)
  ) {
    throw new Error(
      `french-internal-entry-lineage-mismatch:${entryKey}:${scope}`
    );
  }
}

function assertEntryLineageMatchesGlobal(
  lineage: FrenchInternalEntryLineage,
  global: FrenchInternalGlobalLineage,
  entryKey: string
): void {
  if (
    lineage.sourceLogicalDigest !== global.sourceLogicalDigest ||
    lineage.releaseKey !== global.releaseKey ||
    lineage.releaseSnapshotFingerprint !== global.releaseSnapshotFingerprint ||
    lineage.editorialSummaryContentHash !==
      global.editorialSummaryContentHash ||
    lineage.canonicalEntitiesHash !== global.canonicalEntitiesHash ||
    lineage.canonicalEntryPoliciesHash !== global.canonicalEntryPoliciesHash ||
    lineage.entityMergeAttestationHash !== global.entityMergeAttestationHash ||
    lineage.entityMergeAttestationContentHash !==
      global.entityMergeAttestationContentHash ||
    lineage.entityGateHash !== global.entityGateHash ||
    lineage.entityMentionsHash !== global.entityMentionsHash ||
    lineage.guideSourceDigest !== global.guideSourceDigest ||
    lineage.glossParentContentHash !==
      lineage.englishParents.gloss.contentHash ||
    lineage.meaningParentContentHash !==
      lineage.englishParents.meaning.contentHash
  ) {
    throw new Error(`french-internal-global-lineage-mismatch:${entryKey}`);
  }
}

function assertPilotPlan(
  pilot: FrenchInternalPilotPlan,
  workItems: FrenchInternalWorkView[],
  proposerAViews: FrenchInternalProposerAView[],
  proposerBViews: FrenchInternalProposerBView[]
): void {
  const { contentHash, ...content } = pilot;
  if (hashFrenchInternalWorkJson(content) !== contentHash) {
    throw new Error("french-internal-pilot-content-hash-invalid");
  }
  if (
    pilot.releaseKey !== workItems[0]?.lineage.releaseKey ||
    pilot.releaseSnapshotFingerprint !==
      workItems[0]?.lineage.releaseSnapshotFingerprint ||
    pilot.sourceLogicalDigest !== workItems[0]?.lineage.sourceLogicalDigest ||
    pilot.keys.length !== pilot.pilotSize ||
    pilot.selections.length !== pilot.pilotSize ||
    new Set(pilot.keys).size !== pilot.pilotSize
  ) {
    throw new Error("french-internal-pilot-cardinality-invalid");
  }
  const workByKey = uniqueMap(workItems, (item) => item.entryKey, "pilot-work");
  const aByKey = uniqueMap(
    proposerAViews,
    (item) => item.entryKey,
    "pilot-check-a"
  );
  const bByKey = uniqueMap(
    proposerBViews,
    (item) => item.entryKey,
    "pilot-check-b"
  );
  for (let index = 0; index < pilot.selections.length; index += 1) {
    const selection = pilot.selections[index]!;
    const { selectionHash, ...selectionContent } = selection;
    if (
      pilot.keys[index] !== selection.entryKey ||
      hashFrenchInternalWorkJson(selectionContent) !== selectionHash
    ) {
      throw new Error(
        `french-internal-pilot-selection-invalid:${selection.entryKey}`
      );
    }
    if (
      requiredMapValue(workByKey, selection.entryKey, "pilot-work").viewHash !==
        selection.workViewHash ||
      requiredMapValue(aByKey, selection.entryKey, "pilot-a").viewHash !==
        selection.proposerAViewHash ||
      requiredMapValue(bByKey, selection.entryKey, "pilot-b").viewHash !==
        selection.proposerBViewHash
    ) {
      throw new Error(`french-internal-pilot-view-stale:${selection.entryKey}`);
    }
    const work = requiredMapValue(
      workByKey,
      selection.entryKey,
      "pilot-work-lineage"
    );
    const proposerA = requiredMapValue(
      aByKey,
      selection.entryKey,
      "pilot-a-lineage"
    );
    const proposerB = requiredMapValue(
      bByKey,
      selection.entryKey,
      "pilot-b-lineage"
    );
    assertExactEntryLineage(
      work.lineage,
      selection.lineage,
      selection.entryKey,
      "pilot-selection"
    );
    assertExactEntryLineage(
      work.lineage,
      proposerA.lineage,
      selection.entryKey,
      "pilot-a"
    );
    assertExactEntryLineage(
      work.lineage,
      proposerB.lineage,
      selection.entryKey,
      "pilot-b"
    );
  }
}

function assertShardPlan(
  plan: FrenchInternalShardPlan,
  workItems: FrenchInternalWorkView[],
  proposerAViews: FrenchInternalProposerAView[],
  proposerBViews: FrenchInternalProposerBView[]
): void {
  const { contentHash, ...content } = plan;
  if (hashFrenchInternalWorkJson(content) !== contentHash) {
    throw new Error("french-internal-shards-content-hash-invalid");
  }
  if (
    plan.releaseKey !== workItems[0]?.lineage.releaseKey ||
    plan.releaseSnapshotFingerprint !==
      workItems[0]?.lineage.releaseSnapshotFingerprint ||
    plan.sourceLogicalDigest !== workItems[0]?.lineage.sourceLogicalDigest
  ) {
    throw new Error("french-internal-shards-release-lineage-invalid");
  }
  validateBatchSizes(plan.batchSizes);
  const workByKey = uniqueMap(workItems, (item) => item.entryKey, "shard-work");
  const aByKey = uniqueMap(
    proposerAViews,
    (item) => item.entryKey,
    "shard-check-a"
  );
  const bByKey = uniqueMap(
    proposerBViews,
    (item) => item.entryKey,
    "shard-check-b"
  );
  const seen = new Set<string>();
  for (const shard of plan.shards) {
    const { shardHash, ...shardContent } = shard;
    if (
      hashFrenchInternalWorkJson(shardContent) !== shardHash ||
      shard.releaseKey !== plan.releaseKey ||
      shard.releaseSnapshotFingerprint !== plan.releaseSnapshotFingerprint ||
      shard.sourceLogicalDigest !== plan.sourceLogicalDigest ||
      shard.items.length < 1 ||
      shard.items.length > shard.maxItems ||
      shard.maxItems !== plan.batchSizes[shard.meaningSize]
    ) {
      throw new Error(`french-internal-shard-invalid:${shard.shardId}`);
    }
    for (const item of shard.items) {
      const { itemHash, ...itemContent } = item;
      if (hashFrenchInternalWorkJson(itemContent) !== itemHash) {
        throw new Error(`french-internal-shard-item-hash:${item.entryKey}`);
      }
      if (seen.has(item.entryKey)) {
        throw new Error(
          `french-internal-shard-item-duplicate:${item.entryKey}`
        );
      }
      seen.add(item.entryKey);
      if (
        requiredMapValue(workByKey, item.entryKey, "shard-work").viewHash !==
          item.workViewHash ||
        requiredMapValue(aByKey, item.entryKey, "shard-a").viewHash !==
          item.proposerAViewHash ||
        requiredMapValue(bByKey, item.entryKey, "shard-b").viewHash !==
          item.proposerBViewHash
      ) {
        throw new Error(`french-internal-shard-view-stale:${item.entryKey}`);
      }
      const work = requiredMapValue(
        workByKey,
        item.entryKey,
        "shard-work-lineage"
      );
      assertExactEntryLineage(
        work.lineage,
        item.lineage,
        item.entryKey,
        "shard-item"
      );
      assertExactEntryLineage(
        work.lineage,
        requiredMapValue(aByKey, item.entryKey, "shard-a-lineage").lineage,
        item.entryKey,
        "shard-a"
      );
      assertExactEntryLineage(
        work.lineage,
        requiredMapValue(bByKey, item.entryKey, "shard-b-lineage").lineage,
        item.entryKey,
        "shard-b"
      );
    }
  }
  if (seen.size !== workItems.length) {
    throw new Error(
      `french-internal-shard-cardinality:${seen.size}:${workItems.length}`
    );
  }
}

function validateBatchSizes(
  sizes: Record<FrenchInternalMeaningSize, number>
): void {
  for (const size of SIZE_ORDER) {
    if (!Number.isInteger(sizes[size]) || sizes[size] < 1) {
      throw new Error(`french-internal-shard-batch-size-invalid:${size}`);
    }
  }
  if (
    !(
      sizes.short > sizes.medium &&
      sizes.medium > sizes.long &&
      sizes.long > sizes.very_long
    )
  ) {
    throw new Error("french-internal-shard-batch-sizes-not-descending");
  }
}

function writeBuildAtomically(build: FrenchInternalWorkBuild): void {
  const outputs: Array<{
    path: string;
    records?: readonly unknown[];
    value?: unknown;
    expectedDigest?: string;
  }> = [
    {
      path: build.summary.outputPaths.workItems,
      records: build.workItems,
      expectedDigest: build.summary.artifacts.workItems.sha256
    },
    {
      path: build.summary.outputPaths.proposerA,
      records: build.proposerAViews,
      expectedDigest: build.summary.artifacts.proposerA.sha256
    },
    {
      path: build.summary.outputPaths.proposerB,
      records: build.proposerBViews,
      expectedDigest: build.summary.artifacts.proposerB.sha256
    },
    {
      path: build.summary.outputPaths.pilotKeys,
      value: build.pilot,
      expectedDigest: build.summary.artifacts.pilotKeys.sha256
    },
    {
      path: build.summary.outputPaths.shards,
      value: build.shards,
      expectedDigest: build.summary.artifacts.shards.sha256
    },
    { path: build.summary.outputPaths.summary, value: build.summary }
  ];
  const temporaryPaths: string[] = [];
  try {
    for (const output of outputs) {
      mkdirSync(dirname(output.path), { recursive: true });
      const temporary = `${output.path}.tmp-${process.pid}`;
      rmSync(temporary, { force: true });
      temporaryPaths.push(temporary);
      const written = output.records
        ? writeJsonlFile(temporary, output.records)
        : writeJsonFile(temporary, output.value);
      if (output.expectedDigest && written.sha256 !== output.expectedDigest) {
        throw new Error(
          `french-internal-work-written-digest-mismatch:${output.path}`
        );
      }
    }
    for (let index = 0; index < outputs.length; index += 1) {
      renameSync(temporaryPaths[index]!, outputs[index]!.path);
    }
  } catch (error) {
    for (const temporary of temporaryPaths) rmSync(temporary, { force: true });
    throw error;
  }
}

function writeJsonlFile(
  path: string,
  records: readonly unknown[]
): { sha256: string; bytes: number } {
  const descriptor = openSync(path, "wx");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for (const record of records) {
      const line = `${canonicalFrenchInternalWorkJson(record)}\n`;
      writeSync(descriptor, line, undefined, "utf8");
      hash.update(line);
      bytes += Buffer.byteLength(line);
    }
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  return { sha256: hash.digest("hex"), bytes };
}

function writeJsonFile(
  path: string,
  value: unknown
): { sha256: string; bytes: number } {
  const body = renderFrenchInternalJson(value);
  writeFileSync(path, body, { encoding: "utf8", flag: "wx" });
  return { sha256: sha256(body), bytes: Buffer.byteLength(body) };
}

function readJsonArtifact<T>(path: string, label: string): JsonArtifactRead<T> {
  const body = readFileSync(path, "utf8");
  let value: T;
  try {
    value = JSON.parse(body) as T;
  } catch {
    throw new Error(`french-internal-work-json-invalid:${label}`);
  }
  return { value, digest: sha256(body) };
}

function readJsonlArtifact<T>(
  path: string,
  label: string
): JsonlArtifactRead<T> {
  const body = readFileSync(path, "utf8");
  const records: T[] = [];
  for (const [index, line] of body.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as T);
    } catch {
      throw new Error(
        `french-internal-work-jsonl-invalid:${label}:${index + 1}`
      );
    }
  }
  if (records.length === 0) {
    throw new Error(`french-internal-work-jsonl-empty:${label}`);
  }
  return { records, digest: sha256(body) };
}

function assertEditorialRecordHash(
  record: { contentHash: string },
  label: string
): void {
  const { contentHash, ...content } = record;
  if (
    !SHA256_PATTERN.test(contentHash) ||
    frenchEditorialContentHash(content) !== contentHash
  ) {
    throw new Error(`french-internal-work-${label}-content-hash-invalid`);
  }
}

export function assertFrenchInternalWorkViewHash(
  view: { entryKey: string; viewHash: string },
  label = "view"
): void {
  if (
    !SHA256_PATTERN.test(view.viewHash) ||
    frenchInternalViewHash(view) !== view.viewHash
  ) {
    throw new Error(`french-internal-work-${label}-view-hash:${view.entryKey}`);
  }
}

function resolveSourcePaths(
  paths: FrenchInternalSourcePaths
): FrenchInternalSourcePaths {
  return Object.fromEntries(
    Object.entries(paths)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
      .map(([key, path]) => [key, resolve(path)])
  ) as unknown as FrenchInternalSourcePaths;
}

function resolveOutputPaths(
  paths: FrenchInternalWorkOutputPaths
): FrenchInternalWorkOutputPaths {
  return Object.fromEntries(
    Object.entries(paths).map(([key, path]) => [key, resolve(path)])
  ) as unknown as FrenchInternalWorkOutputPaths;
}

function assertRequiredFiles(paths: string[]): void {
  for (const path of paths) {
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`french-internal-work-required-file-missing:${path}`);
    }
  }
}

function assertDistinctInputsAndOutputs(
  inputs: FrenchInternalSourcePaths,
  outputs: FrenchInternalWorkOutputPaths
): void {
  const inputPaths = new Set(
    Object.values(inputs)
      .filter((path): path is string => typeof path === "string")
      .map((path) => resolve(path))
  );
  const outputPaths = Object.values(outputs).map((path) => resolve(path));
  if (new Set(outputPaths).size !== outputPaths.length) {
    throw new Error("french-internal-work-output-paths-not-distinct");
  }
  for (const output of outputPaths) {
    if (inputPaths.has(output)) {
      throw new Error(`french-internal-work-output-overwrites-input:${output}`);
    }
  }
}

function uniqueMap<T, K>(
  values: readonly T[],
  keyFor: (value: T) => K,
  label: string
): Map<K, T> {
  const result = new Map<K, T>();
  for (const value of values) {
    const key = keyFor(value);
    if (result.has(key)) {
      throw new Error(`french-internal-work-duplicate-${label}:${String(key)}`);
    }
    result.set(key, value);
  }
  return result;
}

function requiredMapValue<K, V>(map: Map<K, V>, key: K, label: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-internal-work-${label}-missing:${String(key)}`);
  }
  return value;
}

function normalizeVisibleFrench(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function sortedRecord(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => compareText(left, right))
  );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
