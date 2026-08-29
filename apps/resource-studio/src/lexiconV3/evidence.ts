import { createHash } from "node:crypto";

import type { StepOriginalToken } from "../stepOriginals.js";
import type {
  LexiconLanguage,
  LexiconV3ResourceWitness,
  LexiconV3SourceAuditResult,
  LexiconV3SourceEntry
} from "./contracts.js";
import {
  applyEnglishExactRepairs,
  ENGLISH_EXACT_REPAIR_RULES,
  type EnglishExactFieldRepairEvidence
} from "./englishExactRepairs.js";
import {
  attestEnglishSemanticGloss,
  ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES,
  validateEnglishSemanticGlossAttestationEnvelope,
  type EnglishSemanticGlossAttestationEvidence
} from "./englishSemanticGlossAttestations.js";
import { buildLexiconEntryKey, extractPrimaryDStrong } from "./identity.js";
import {
  applyProvenGreekReconstruction,
  digestGreekReconstructionSourceRecord,
  getGreekReconstructionRule,
  GREEK_RECONSTRUCTION_RULES,
  GREEK_RECONSTRUCTION_SOURCE_DIGESTS,
  PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST,
  PINNED_G0567_FORM_ALIAS,
  proveGreekReconstruction,
  type GreekReconstructionProof,
  type GreekReconstructionProofInput
} from "./greekReconstruction.js";
import {
  auditLexiconV3Source,
  compareLexiconHeadword,
  extractLexiconHeadword
} from "./sourceAudit.js";

export const ENGLISH_EVIDENCE_SCHEMA_VERSION = 12 as const;

export const GREEK_RECONSTRUCTION_WITNESS_CATALOG_SCHEMA_VERSION =
  "lexicon-v3-greek-witness-catalog@1" as const;
export const PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_PATH =
  "src/lexiconV3/sources/greek-reconstruction-witness-catalog.json" as const;
export const PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_DIGEST =
  "dc922ca9e0a610674d88d4de8998e6abedab668ca75f96b9c181a2e1be018dde" as const;

const EXPECTED_GREEK_RECONSTRUCTION_CATALOG_SOURCES = Object.freeze({
  "step.database": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.stepDatabase,
  TBESG: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tbesg,
  TBESH: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tbesh,
  TFLSJ: GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tflsj,
  "TAGNT.Act-Rev": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tagntActsRevelation,
  "TAGNT.Mat-Jhn": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tagntMatthewJohn,
  "TIPNR.people": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.tipnrPeople,
  "legacy.database": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.legacyDatabase,
  "perseus.lsj": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.perseusLsj,
  "perseus.artifact": PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST,
  "internal-adjudication.G20464.artifact":
    PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST,
  "internal-adjudication.G20464.artifact-file":
    PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST,
  "kaikki.fr": GREEK_RECONSTRUCTION_SOURCE_DIGESTS.kaikkiFrench
});

/**
 * Curated conclusions below are valid only for the audited source snapshots.
 * If STEP changes either source, affected entries fail closed and must be
 * audited again instead of silently inheriting a stale exception.
 */
export const CURATED_SOURCE_SNAPSHOT_DIGESTS = {
  TBESG: "e8f58a8f841f2a338b3df648466a773928127e6080c06d32ee88694fb761facb",
  TFLSJ: "fcc2845412132a7bb91fc3dbb5a544c807daf57e4791c4d9af61efe209e97691",
  TAGNT: {
    "TAGNT Act-Rev.txt":
      "524e32375361e6d3fa2f7ef00b87605fdc4317a762f395651a05fdc31ad031b7",
    "TAGNT Mat-Jhn.txt":
      "ab8eaaeb68e17a1dcfa34e1e9350358f22f03bc2a97244d848750ad81044bc8e"
  }
} as const;

/**
 * These entries may bypass human English review only while the complete
 * TBESG/TFLSJ/TAGNT snapshot and the entry-specific evidence still match.
 * Keeping the lists separate makes the selected canonical source explicit.
 */
export const CURATED_AUTO_TFLSJ_REPAIRS = new Set<string>([
  "greek:G0062",
  "greek:G1492G",
  "greek:G1623",
  "greek:G1633",
  "greek:G2046",
  "greek:G2600",
  "greek:G3426",
  "greek:G4483",
  "greek:G4571",
  "greek:G4776",
  "greek:G4821",
  "greek:G4844"
]);

export const CURATED_AUTO_BRIEF_RETENTIONS = new Set<string>([
  "greek:G1561",
  "greek:G2653",
  "greek:G3327",
  "greek:G4619",
  "greek:G4895",
  "greek:G4896"
]);

export const CURATED_AUTO_TFLSJ_BUNDLE_REPAIRS = new Set<string>([
  "greek:G2624",
  "greek:G3022",
  "greek:G4955"
]);

export const CURATED_AUTO_SOURCE_VARIANTS = new Set<string>([
  "greek:G1714",
  "greek:G1740",
  "greek:G1757",
  "greek:G4803",
  "greek:G4852",
  "greek:G5282"
]);

/**
 * The TBESG notice for G4245H contains the attested comparative correctly,
 * while its attached TFLSJ resource is the distinct noun G4244. The
 * supplemental resource may therefore be quarantined without blocking the
 * exact STEP sub-entry, but only under the fully pinned Greek snapshot.
 */
export const CURATED_AUTO_TFLSJ_SUPPLEMENTAL_QUARANTINES = new Set<string>([
  "greek:G4245H"
]);

export type CuratedGreekEnglishRepairAction =
  | "extract_gloss_from_exact_brief_definition"
  | "retain_exact_brief_quarantine_tflsj";

export interface CuratedGreekEnglishRepairRule {
  ruleId: string;
  action: CuratedGreekEnglishRepairAction;
  expectedSourceRecordDigest: string;
  expectedMeaningDigest: string;
  repairedGloss?: string;
  expectedTflsjConflictOwner?: string;
}

/**
 * Entry-level repairs whose inputs were exhaustively checked against the
 * pinned STEP snapshot. The row digest covers language, all Strong identity
 * columns, original, transliteration, morphology, gloss, and the complete
 * raw meaning. A near match therefore never inherits one of these rules.
 */
export const CURATED_GREEK_ENGLISH_REPAIR_RULES = new Map<
  string,
  CuratedGreekEnglishRepairRule
>([
  [
    "greek:G21370",
    {
      ruleId: "greek-g21370-exact-definition-gloss@1",
      action: "extract_gloss_from_exact_brief_definition",
      expectedSourceRecordDigest:
        "05de43f441e213cb1805ba89b56c02cf858c98567e5b04c0dcd30687a5da1109",
      expectedMeaningDigest:
        "afb62012ac64546ac036bb02a101b7cf32a984792679534c4221ba03e7ad6204",
      repairedGloss: "wanderer"
    }
  ],
  [
    "greek:G4191",
    {
      ruleId: "greek-g4191-exact-brief-retention@1",
      action: "retain_exact_brief_quarantine_tflsj",
      expectedSourceRecordDigest:
        "0a60ff898fa3b3a1d325fc58e2565fca014e73acad000670530b1e198b260d6a",
      expectedMeaningDigest:
        "84806e09ff62aa30bdeb2ac8897f873383ceed206f56a0a2e4f92cd58dfecf67",
      expectedTflsjConflictOwner: "G4190"
    }
  ],
  [
    "greek:G5024",
    {
      ruleId: "greek-g5024-exact-brief-retention@1",
      action: "retain_exact_brief_quarantine_tflsj",
      expectedSourceRecordDigest:
        "258124c7d89cd4b6b4ed202a519a5786d92123ad84d6f7bc181c26f45567f3a8",
      expectedMeaningDigest:
        "383efddd2f07f6cbf32daf3b083875578fe6143b1287666f42baeeeddcbccd0f",
      expectedTflsjConflictOwner: "G3778"
    }
  ]
]);

/** Entries intentionally left closed for an entry-specific editorial repair. */
export const CURATED_GREEK_REQUIRED_REVIEW_ENTRIES = new Map<
  string,
  { reason: string; retainBrief: boolean }
>([
  [
    "greek:G0001H",
    { reason: "identity-source-conflict-review-required", retainBrief: false }
  ],
  [
    "greek:G0567",
    {
      reason: "source-reconciled-form-alias-required",
      retainBrief: false
    }
  ],
  [
    "greek:G1489",
    { reason: "source-bundle-trim-required", retainBrief: false }
  ],
  [
    "greek:G1490",
    { reason: "source-bundle-trim-required", retainBrief: false }
  ],
  [
    "greek:G1503",
    { reason: "exact-source-extraction-required", retainBrief: false }
  ],
  [
    "greek:G1507",
    { reason: "exact-spelling-alias-extraction-required", retainBrief: false }
  ],
  [
    "greek:G1970",
    { reason: "corrupt-source-extraction-required", retainBrief: false }
  ],
  [
    "greek:G2199H",
    { reason: "missing-original-review-required", retainBrief: false }
  ],
  [
    "greek:G2424K",
    { reason: "relation-context-review-required", retainBrief: false }
  ],
  [
    "greek:G4245G",
    { reason: "source-bundle-trim-required", retainBrief: false }
  ],
  ["greek:G5441", { reason: "identity-repair-required", retainBrief: false }],
  [
    "greek:G6087",
    { reason: "compositional-notice-required", retainBrief: false }
  ],
  [
    "greek:G6243",
    { reason: "adjectival-reconstruction-required", retainBrief: false }
  ],
  [
    "greek:G8216",
    {
      reason: "homograph-accent-reconciliation-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20014",
    {
      reason: "cross-reference-headword-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20128",
    { reason: "adjectival-source-extraction-required", retainBrief: false }
  ],
  [
    "greek:G20209",
    {
      reason: "truncated-agent-noun-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20278",
    {
      reason: "incomplete-verbal-notice-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20394",
    {
      reason: "opaque-source-fragment-replacement-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20464",
    {
      reason: "opaque-etymon-source-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20467",
    { reason: "foreign-carry-over-reconciliation-required", retainBrief: false }
  ],
  [
    "greek:G20490",
    {
      reason: "explicit-form-relation-reconciliation-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20583",
    {
      reason: "foreign-carry-over-morphological-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20654",
    {
      reason: "editorial-hebrew-phrase-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20665",
    {
      reason: "editorial-mythological-name-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20765",
    {
      reason: "editorial-morphological-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G20937",
    {
      reason: "truncated-adjectival-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G21057",
    {
      reason: "editorial-attention-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G21118",
    { reason: "truncated-compound-reconstruction-required", retainBrief: false }
  ],
  [
    "greek:G21241",
    {
      reason: "truncated-administrative-noun-reconstruction-required",
      retainBrief: false
    }
  ],
  [
    "greek:G21273",
    {
      reason: "compound-verbal-reconstruction-required",
      retainBrief: false
    }
  ]
]);

const CURATED_AUTO_VALIDATION_REASONS = new Set([
  "curated-auto-validated-greek-reconstruction",
  "curated-auto-validated-tflsj-repair",
  "curated-auto-validated-brief-retention",
  "curated-auto-validated-source-variant",
  "curated-auto-validated-supplemental-quarantine",
  "curated-auto-validated-exact-brief-gloss-repair",
  "curated-auto-validated-exact-brief-retention",
  "curated-auto-validated-exact-source-field-repair",
  "curated-auto-validated-semantic-gloss-attestation"
]);

export function isCuratedAutoValidatedEnglishEvidence(
  decision: EnglishEvidenceDecision
): boolean {
  return decision.reasonCodes.some((reason) =>
    CURATED_AUTO_VALIDATION_REASONS.has(reason)
  );
}

export const CONFIRMED_BRIEF_SOURCE_CONFLICTS = new Map<string, string>([
  ["greek:G0062", "G0063"],
  ["greek:G1623", "G1622"],
  ["greek:G1633", "G1632"],
  ["greek:G2600", "G6046"],
  ["greek:G3426", "G3428"],
  ["greek:G4821", "G4823"],
  ["greek:G4844", "G4849"],
  ["greek:G4776", "G8731"]
]);

export const CONFIRMED_TFLSJ_SOURCE_CONFLICTS = new Map<string, string>([
  ["greek:G1561", "G1391"],
  ["greek:G3327", "G3328"],
  ["greek:G4895", "G4896"],
  ["greek:G4896", "G4895"]
]);

/**
 * Exhaustively reviewed STEP entries whose leading TBESG headword differs
 * from the entry for a legitimate orthographic, textual, or morphological
 * reason. These remain publishable, but retain an explicit audit annotation.
 */
export const CURATED_SOURCE_VARIANT_ENTRIES = new Set<string>([
  "greek:G0015",
  "greek:G0098",
  "greek:G0099",
  "greek:G0170",
  "greek:G0196",
  "greek:G0239",
  "greek:G0346",
  "greek:G0365",
  "greek:G0392",
  "greek:G0398",
  "greek:G0416",
  "greek:G0448",
  "greek:G0508",
  "greek:G0527",
  "greek:G0554",
  "greek:G0572",
  "greek:G0581",
  "greek:G0715",
  "greek:G0948",
  "greek:G0964",
  "greek:G1226",
  "greek:G1256",
  "greek:G1284",
  "greek:G1492H",
  "greek:G1531",
  "greek:G1595",
  "greek:G1600",
  "greek:G1714",
  "greek:G1740",
  "greek:G1757",
  "greek:G1812",
  "greek:G1818",
  "greek:G1838",
  "greek:G1843",
  "greek:G1865",
  "greek:G1901",
  "greek:G1950",
  "greek:G1966",
  "greek:G2033",
  "greek:G2034",
  "greek:G2035",
  "greek:G2097",
  "greek:G2123",
  "greek:G2148",
  "greek:G2242",
  "greek:G2274",
  "greek:G2584",
  "greek:G2655",
  "greek:G2728",
  "greek:G2831",
  "greek:G2866",
  "greek:G2895",
  "greek:G2910",
  "greek:G3032",
  "greek:G3104",
  "greek:G3344",
  "greek:G3561",
  "greek:G3647",
  "greek:G3755",
  "greek:G3757",
  "greek:G4300",
  "greek:G4326",
  "greek:G4411",
  "greek:G4441",
  "greek:G4576",
  "greek:G4583",
  "greek:G4697",
  "greek:G4785",
  "greek:G4803",
  "greek:G4809",
  "greek:G4852",
  "greek:G4910",
  "greek:G4957",
  "greek:G5063",
  "greek:G5112",
  "greek:G5114",
  "greek:G5271",
  "greek:G5282",
  "greek:G5309",
  "greek:G5433",
  "greek:G5483",
  "greek:G5493",
  "greek:G5516",
  "greek:G5530",
  "greek:G5574",
  "greek:G6034",
  "greek:G7013",
  "greek:G20833"
]);

/** Notices that legitimately cover related STEP entries but are not safe to
 * translate until the target entry's segment has been extracted explicitly. */
export const CURATED_BUNDLED_NOTICE_ENTRIES = new Set<string>([
  "greek:G1489",
  "greek:G1490",
  "greek:G2624",
  "greek:G3022",
  "greek:G4245G",
  "greek:G4955"
]);

/** Entry-specific cases where relation, identity, and publishable content must
 * be repaired separately rather than accepting or translating the raw notice. */
export const CURATED_ISOLATED_SOURCE_ISSUES = new Map<string, string>([
  ["greek:G2424K", "relation-context-review-required"],
  ["greek:G5441", "identity-repair-required"],
  ["greek:G6087", "compositional-notice-required"]
]);

export interface EnglishEvidenceSourceDigests {
  database: string;
  TBESG: string;
  TBESH: string;
  TFLSJ: string;
  TAGNT: Record<string, string>;
  TAHOT: Record<string, string>;
  greekReconstruction?: {
    witnessCatalog: string;
    witnessCatalogFile: string;
    tipnrPeople: string;
    legacyDatabase: string;
    perseusArtifact: string;
    perseusArtifactFile: string;
    perseusSourceFile: string;
    g20464AdjudicationArtifact: string;
    g20464AdjudicationArtifactFile: string;
    g20464AdjudicationPayload: string;
    kaikkiFrench: string;
  };
}

export interface EnglishLexiconEntry extends LexiconV3SourceEntry {
  stepEntryId: number;
  baseCode: number;
  classicTransliteration?: string;
  pronunciation?: string;
}

export interface EnglishLexiconResource extends LexiconV3ResourceWitness {
  resourceId: number;
  stepEntryId: number;
}

export interface CitationEvidence {
  references: string[];
  resolvedReferences: string[];
  targetHits: string[];
  otherStrongHits: Record<string, string[]>;
}

export interface SourceEvidence {
  source: "TBESG" | "TBESH" | "TFLSJ";
  digest: string;
  headword: string | null;
  headwordMatchesEntry: boolean | null;
  headwordOwnerKeys: string[];
  declaredRelatedStrongCodes: string[];
  headwordMatchesDeclaredRelation: boolean;
  contentMentionsEntryOriginal: boolean;
  conflictOwner: string | null;
  citations: CitationEvidence;
  issues: string[];
  quarantined: boolean;
}

export interface CuratedGreekEnglishRuleProof {
  ruleId: string;
  action: CuratedGreekEnglishRepairAction;
  ruleDigest: string;
  sourceRecordDigest: string;
  sourceMeaningDigest: string;
  facts: Record<string, string | number | boolean>;
  proofDigest: string;
}

export interface CuratedGreekEnglishFieldRepairEvidence {
  field: "gloss";
  sourceValue: string;
  repairedValue: string;
  method: "exact-tbesg-definition-extraction";
  ruleId: string;
  ruleDigest: string;
  sourceRecordDigest: string;
  sourceMeaningDigest: string;
  repairDigest: string;
}

export type EnglishFieldRepairEvidence =
  | CuratedGreekEnglishFieldRepairEvidence
  | EnglishExactFieldRepairEvidence;

export interface EnglishEvidenceDecision {
  status: "accepted" | "repaired" | "source-conflict" | "quarantined";
  canonicalSource: "TBESG" | "TBESH" | "TFLSJ" | null;
  extendedSource: "TFLSJ" | null;
  quarantinedSources: Array<"TBESG" | "TBESH" | "TFLSJ">;
  reasonCodes: string[];
  curatedRuleProof?: CuratedGreekEnglishRuleProof;
}

export interface EnglishExactOccurrenceGlossEvidence {
  /** Exact normalized STEP dStrong; suffix and variant case remain data. */
  dStrong: string;
  /** Raw contextual English gloss from TAHOT/TAGNT. */
  gloss: string;
  /** Stable native token locator, including the source family. */
  locator: string;
  /** Digest of source, identity, locator, and unmodified gloss. */
  digest: string;
}

export interface EnglishExactOccurrenceEvidence {
  source: "TAGNT" | "TAHOT";
  stepStrong: string;
  count: number;
  references: string[];
  occurrences: EnglishExactOccurrenceGlossEvidence[];
  occurrenceCorpusDigest: string;
}

export interface EnglishAlternateStrongAliasOccurrenceEvidence {
  /** Alternate Strong attached to the token, never its primary dStrong. */
  aliasStrong: string;
  /** Exact primary STEP dStrong carried by the same token. */
  primaryDStrong: string;
  /** Canonical OSIS-style reference of this native token occurrence. */
  reference: string;
  /** Stable native token locator, including the source family. */
  locator: string;
  /** Raw contextual English gloss from TAGNT. */
  gloss: string;
  /** Raw TAGNT morphology, used to prove the relevant form/voice. */
  morph: string;
  /** Digest of the complete, unmodified alias occurrence. */
  digest: string;
}

/**
 * Separate evidence channel for STEP Alternate Strong aliases. It must never
 * be merged into `exactOccurrence`, whose dStrong semantics remain exact.
 */
export interface EnglishAlternateStrongAliasEvidence {
  source: "TAGNT";
  proofKind: "alternate_strong_alias";
  relationKind: "form_of";
  aliasStrong: string;
  primaryDStrong: string;
  uStrong: string;
  count: number;
  references: string[];
  sourceDigests: Record<string, string>;
  occurrences: EnglishAlternateStrongAliasOccurrenceEvidence[];
  occurrenceCorpusDigest: string;
}

export interface EnglishGreekReconstructionCatalogEntry {
  sourceRecordDigest: string;
  occurrenceCount: number | null;
  witnessDigests: Record<string, string | null>;
  facts: Record<string, unknown>;
}

export interface EnglishGreekReconstructionCatalog {
  schemaVersion: typeof GREEK_RECONSTRUCTION_WITNESS_CATALOG_SCHEMA_VERSION;
  policy: {
    sourceRecordDigest: string;
    occurrenceCount: string;
    witnessDigests: string;
  };
  sourceDigests: Record<string, string>;
  entries: Record<string, EnglishGreekReconstructionCatalogEntry>;
  catalogDigest: string;
}

export interface EnglishGreekReconstructionEvidence {
  schemaVersion: "lexicon-v3-greek-reconstruction-audit@1";
  rawEntry: {
    language: LexiconLanguage;
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
  };
  input: GreekReconstructionProofInput;
  proof: GreekReconstructionProof;
  catalogDigest: string | null;
  blockers: string[];
  applied: boolean;
  reconstructionDigest: string;
}

export interface EnglishGreekReconstructionCatalogVerification {
  valid: boolean;
  issues: string[];
  computedDigest: string | null;
  catalog: EnglishGreekReconstructionCatalog | null;
}

export interface EnglishEvidenceAuditRecord {
  schemaVersion: typeof ENGLISH_EVIDENCE_SCHEMA_VERSION;
  key: string;
  stepEntryId: number;
  language: LexiconLanguage;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
  classicTransliteration?: string;
  pronunciation?: string;
  reconstruction: EnglishGreekReconstructionEvidence | null;
  resources: EnglishLexiconResource[];
  evidence: {
    brief: SourceEvidence;
    TFLSJ: SourceEvidence | null;
    exactOccurrence: EnglishExactOccurrenceEvidence;
    alternateStrongAlias: EnglishAlternateStrongAliasEvidence | null;
    semanticGlossAttestation: EnglishSemanticGlossAttestationEvidence | null;
    sourceAudit: LexiconV3SourceAuditResult;
    fieldRepairs: EnglishFieldRepairEvidence[];
  };
  decision: EnglishEvidenceDecision;
  sourceDigests: EnglishEvidenceSourceDigests;
  recordDigest: string;
}

export interface EnglishEvidenceAuditSummary {
  schemaVersion: typeof ENGLISH_EVIDENCE_SCHEMA_VERSION;
  generatedAt: string;
  inputEntries: number;
  outputEntries: number;
  statusCounts: Record<EnglishEvidenceDecision["status"], number>;
  canonicalSourceCounts: Record<string, number>;
  quarantinedSourceCounts: Record<string, number>;
  confirmedBriefConflicts: string[];
  confirmedTflsjConflicts: string[];
  sourceDigests: EnglishEvidenceSourceDigests;
}

export interface EnglishEvidenceContext {
  corpus: CorpusEvidenceIndex;
  exactStepStrongOccurrences: ReadonlyMap<string, number>;
  exactStepStrongReferences: ReadonlyMap<string, readonly string[]>;
  exactStepStrongGlossOccurrences: ReadonlyMap<
    string,
    readonly EnglishExactOccurrenceGlossEvidence[]
  >;
  alternateStrongAliases: ReadonlyMap<
    string,
    readonly EnglishAlternateStrongAliasOccurrenceEvidence[]
  >;
  greekReconstructionOccurrenceCounts: ReadonlyMap<string, number>;
  entriesByHeadword: ReadonlyMap<string, readonly EnglishLexiconEntry[]>;
  entriesByStrong: ReadonlyMap<string, readonly EnglishLexiconEntry[]>;
  sourceDigests: EnglishEvidenceSourceDigests;
  semanticGlossSourceLines: Readonly<Record<string, string>>;
  greekReconstructionCatalog?: EnglishGreekReconstructionCatalog;
  greekReconstructionCatalogIssues: readonly string[];
}

export type CorpusEvidenceIndex = ReadonlyMap<string, ReadonlySet<string>>;

export function englishExactOccurrenceGlossDigest(input: {
  source: "TAGNT" | "TAHOT";
  dStrong: string;
  gloss: string;
  locator: string;
}): string {
  return sha256(
    stableJson({
      source: input.source,
      dStrong: input.dStrong,
      gloss: input.gloss,
      locator: input.locator
    })
  );
}

export function englishExactOccurrenceCorpusDigest(input: {
  source: "TAGNT" | "TAHOT";
  stepStrong: string;
  occurrences: readonly EnglishExactOccurrenceGlossEvidence[];
}): string {
  return sha256(
    stableJson({
      source: input.source,
      stepStrong: input.stepStrong,
      occurrenceDigests: canonicalExactOccurrenceGlosses(input.occurrences).map(
        (occurrence) => occurrence.digest
      )
    })
  );
}

export function englishAlternateStrongAliasOccurrenceDigest(input: {
  source: "TAGNT";
  aliasStrong: string;
  primaryDStrong: string;
  reference: string;
  locator: string;
  gloss: string;
  morph: string;
}): string {
  return sha256(
    stableJson({
      source: input.source,
      proofKind: "alternate_strong_alias",
      aliasStrong: input.aliasStrong,
      primaryDStrong: input.primaryDStrong,
      reference: input.reference,
      locator: input.locator,
      gloss: input.gloss,
      morph: input.morph
    })
  );
}

export function englishAlternateStrongAliasCorpusDigest(input: {
  source: "TAGNT";
  proofKind: "alternate_strong_alias";
  relationKind: "form_of";
  aliasStrong: string;
  primaryDStrong: string;
  uStrong: string;
  count: number;
  references: readonly string[];
  sourceDigests: Readonly<Record<string, string>>;
  occurrences: readonly EnglishAlternateStrongAliasOccurrenceEvidence[];
}): string {
  return sha256(
    stableJson({
      source: input.source,
      proofKind: input.proofKind,
      relationKind: input.relationKind,
      aliasStrong: input.aliasStrong,
      primaryDStrong: input.primaryDStrong,
      uStrong: input.uStrong,
      count: input.count,
      references: [...input.references],
      sourceDigests: canonicalRecord(input.sourceDigests),
      occurrenceDigests: canonicalAlternateStrongAliasOccurrences(
        input.occurrences
      ).map((occurrence) => occurrence.digest)
    })
  );
}

/**
 * Maps the files actually loaded by the English audit to the stable source
 * identifiers used by the Greek reconstruction rules and witness catalog.
 * Missing optional files remain absent so the proof fails with a named source
 * blocker instead of inheriting a digest from policy code.
 */
export function buildGreekReconstructionGlobalSourceDigests(
  digests: EnglishEvidenceSourceDigests
): Record<string, string> {
  const values = new Map<string, string>();
  const add = (id: string, value: string | undefined): void => {
    if (typeof value === "string" && value.length > 0) values.set(id, value);
  };
  add("step.database", digests.database);
  add("TBESG", digests.TBESG);
  add("TBESH", digests.TBESH);
  add("TFLSJ", digests.TFLSJ);
  add("TAGNT.Act-Rev", digests.TAGNT["TAGNT Act-Rev.txt"]);
  add("TAGNT.Mat-Jhn", digests.TAGNT["TAGNT Mat-Jhn.txt"]);
  add("TIPNR.people", digests.greekReconstruction?.tipnrPeople);
  add("legacy.database", digests.greekReconstruction?.legacyDatabase);
  add("perseus.lsj", digests.greekReconstruction?.perseusSourceFile);
  add("perseus.artifact", digests.greekReconstruction?.perseusArtifact);
  add(
    "internal-adjudication.G20464.artifact",
    digests.greekReconstruction?.g20464AdjudicationArtifact
  );
  add(
    "internal-adjudication.G20464.artifact-file",
    digests.greekReconstruction?.g20464AdjudicationArtifactFile
  );
  add("kaikki.fr", digests.greekReconstruction?.kaikkiFrench);
  return Object.fromEntries(values);
}

export function digestEnglishGreekReconstructionCatalog(
  catalog: Omit<EnglishGreekReconstructionCatalog, "catalogDigest"> & {
    catalogDigest?: string;
  }
): string {
  const withoutDigest = Object.fromEntries(
    Object.entries(catalog).filter(([key]) => key !== "catalogDigest")
  );
  return sha256(stableJson(withoutDigest).normalize("NFC"));
}

/** Runtime trust check for the independent, checked-in witness catalog. */
export function verifyEnglishGreekReconstructionCatalog(
  value: unknown,
  actualSourceDigests?: EnglishEvidenceSourceDigests
): EnglishGreekReconstructionCatalogVerification {
  const issues = new Set<string>();
  const record = asRecord(value);
  if (!record) {
    return {
      valid: false,
      issues: ["greek-reconstruction-witness-catalog-malformed"],
      computedDigest: null,
      catalog: null
    };
  }

  if (
    record.schemaVersion !== GREEK_RECONSTRUCTION_WITNESS_CATALOG_SCHEMA_VERSION
  ) {
    issues.add("greek-reconstruction-witness-catalog-schema-mismatch");
  }
  const policy = asRecord(record.policy);
  if (
    !policy ||
    typeof policy.sourceRecordDigest !== "string" ||
    typeof policy.occurrenceCount !== "string" ||
    typeof policy.witnessDigests !== "string"
  ) {
    issues.add("greek-reconstruction-witness-catalog-policy-malformed");
  }
  const sourceDigests = asStringRecord(record.sourceDigests);
  if (!sourceDigests) {
    issues.add("greek-reconstruction-witness-catalog-sources-malformed");
  } else if (
    !exactDigestRecordMatches(
      sourceDigests,
      EXPECTED_GREEK_RECONSTRUCTION_CATALOG_SOURCES
    )
  ) {
    issues.add("greek-reconstruction-witness-catalog-sources-mismatch");
  }
  const entries = asRecord(record.entries);
  if (!entries) {
    issues.add("greek-reconstruction-witness-catalog-entries-malformed");
  }

  const computedDigest = sha256(
    stableJson(
      Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== "catalogDigest")
      )
    ).normalize("NFC")
  );
  if (record.catalogDigest !== computedDigest) {
    issues.add("greek-reconstruction-witness-catalog-digest-mismatch");
  }
  if (
    record.catalogDigest !== PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_DIGEST
  ) {
    issues.add("greek-reconstruction-witness-catalog-not-pinned");
  }

  if (entries) {
    const actualEntryKeys = Object.keys(entries).sort();
    const expectedEntryKeys = [...GREEK_RECONSTRUCTION_RULES.keys()].sort();
    if (stableJson(actualEntryKeys) !== stableJson(expectedEntryKeys)) {
      issues.add("greek-reconstruction-witness-catalog-entry-set-mismatch");
    }
    for (const [entryKey, rule] of GREEK_RECONSTRUCTION_RULES) {
      const catalogEntry = asRecord(entries[entryKey]);
      if (!catalogEntry) {
        issues.add(`${entryKey}:witness-catalog-entry-missing`);
        continue;
      }
      if (!isSha256(catalogEntry.sourceRecordDigest)) {
        issues.add(`${entryKey}:witness-catalog-source-record-invalid`);
      } else if (
        catalogEntry.sourceRecordDigest !== rule.expectedSourceRecordDigest
      ) {
        issues.add(`${entryKey}:witness-catalog-source-record-mismatch`);
      }
      const occurrenceCount = catalogEntry.occurrenceCount;
      if (
        occurrenceCount !== null &&
        (!Number.isSafeInteger(occurrenceCount) ||
          (occurrenceCount as number) < 0)
      ) {
        issues.add(`${entryKey}:witness-catalog-occurrence-count-invalid`);
      } else if (occurrenceCount !== rule.expectedOccurrenceCount) {
        issues.add(`${entryKey}:witness-catalog-occurrence-count-mismatch`);
      }
      const witnessDigests = asNullableStringRecord(
        catalogEntry.witnessDigests
      );
      const expectedWitnessDigests = Object.fromEntries(
        rule.witnesses.map((witness) => [witness.id, witness.expectedDigest])
      );
      if (!witnessDigests) {
        issues.add(`${entryKey}:witness-catalog-witnesses-malformed`);
      } else if (
        stableJson(canonicalRecord(witnessDigests)) !==
        stableJson(canonicalRecord(expectedWitnessDigests))
      ) {
        issues.add(`${entryKey}:witness-catalog-witnesses-mismatch`);
      }
      const facts = asRecord(catalogEntry.facts);
      const witnessLocators = asStringRecord(facts?.witnessLocators);
      if (
        !facts ||
        facts.ruleId !== rule.ruleId ||
        facts.classification !== rule.classification ||
        !witnessLocators ||
        stableJson(Object.keys(witnessLocators).sort()) !==
          stableJson(rule.witnesses.map((witness) => witness.id).sort())
      ) {
        issues.add(`${entryKey}:witness-catalog-facts-mismatch`);
      }
    }
  }

  if (actualSourceDigests) {
    const actual =
      buildGreekReconstructionGlobalSourceDigests(actualSourceDigests);
    for (const [id, expectedDigest] of Object.entries(
      EXPECTED_GREEK_RECONSTRUCTION_CATALOG_SOURCES
    )) {
      if (!(id in actual)) {
        issues.add(`greek-reconstruction-global-source-missing:${id}`);
      } else if (actual[id] !== expectedDigest) {
        issues.add(`greek-reconstruction-global-source-mismatch:${id}`);
      }
    }
    const auditCatalogDigest =
      actualSourceDigests.greekReconstruction?.witnessCatalog;
    if (!auditCatalogDigest) {
      issues.add("greek-reconstruction-witness-catalog-source-digest-missing");
    } else if (auditCatalogDigest !== record.catalogDigest) {
      issues.add("greek-reconstruction-witness-catalog-source-digest-mismatch");
    }
  }

  const catalog =
    policy &&
    sourceDigests &&
    entries &&
    typeof record.catalogDigest === "string"
      ? (value as EnglishGreekReconstructionCatalog)
      : null;
  return {
    valid: issues.size === 0,
    issues: [...issues].sort(),
    computedDigest,
    catalog
  };
}

/** Runtime validation for the schema-v9 exact occurrence payload. */
export function validateEnglishExactOccurrenceEvidence(
  record: EnglishEvidenceAuditRecord
): string[] {
  const issues = new Set<string>();
  const exact = record.evidence?.exactOccurrence as
    | Partial<EnglishExactOccurrenceEvidence>
    | undefined;
  if (!exact || typeof exact !== "object") {
    return ["english-exact-occurrence-evidence-missing"];
  }
  const expectedSource = record.language === "greek" ? "TAGNT" : "TAHOT";
  if (exact.source !== expectedSource) {
    issues.add("english-exact-occurrence-source-mismatch");
  }
  const expectedStepStrong = normalizeStrong(
    extractPrimaryDStrong(record.dStrong) ?? record.eStrong
  );
  if (exact.stepStrong !== expectedStepStrong) {
    issues.add("english-exact-occurrence-dstrong-mismatch");
  }
  if (!Number.isSafeInteger(exact.count) || (exact.count ?? -1) < 0) {
    issues.add("english-exact-occurrence-count-invalid");
  }
  if (!Array.isArray(exact.references)) {
    issues.add("english-exact-occurrence-references-invalid");
  } else if (
    stableJson(exact.references) !==
    stableJson([...new Set(exact.references)].sort())
  ) {
    issues.add("english-exact-occurrence-references-not-canonical");
  }
  if (!Array.isArray(exact.occurrences)) {
    issues.add("english-exact-occurrence-glosses-invalid");
    return [...issues].sort();
  }
  if (exact.count !== exact.occurrences.length) {
    issues.add("english-exact-occurrence-count-mismatch");
  }
  const locators = new Set<string>();
  for (const occurrence of exact.occurrences) {
    if (!occurrence || typeof occurrence !== "object") {
      issues.add("english-exact-occurrence-gloss-invalid");
      continue;
    }
    if (
      occurrence.dStrong !== exact.stepStrong ||
      typeof occurrence.dStrong !== "string"
    ) {
      issues.add("english-exact-occurrence-gloss-dstrong-mismatch");
    }
    if (typeof occurrence.gloss !== "string") {
      issues.add("english-exact-occurrence-gloss-text-invalid");
    }
    if (typeof occurrence.locator !== "string" || !occurrence.locator.trim()) {
      issues.add("english-exact-occurrence-gloss-locator-invalid");
    } else if (locators.has(occurrence.locator)) {
      issues.add("english-exact-occurrence-gloss-locator-duplicate");
    } else {
      locators.add(occurrence.locator);
    }
    if (
      typeof occurrence.dStrong === "string" &&
      typeof occurrence.gloss === "string" &&
      typeof occurrence.locator === "string" &&
      occurrence.digest !==
        englishExactOccurrenceGlossDigest({
          source: expectedSource,
          dStrong: occurrence.dStrong,
          gloss: occurrence.gloss,
          locator: occurrence.locator
        })
    ) {
      issues.add("english-exact-occurrence-gloss-digest-mismatch");
    }
  }
  if (
    stableJson(exact.occurrences) !==
    stableJson(canonicalExactOccurrenceGlosses(exact.occurrences))
  ) {
    issues.add("english-exact-occurrence-glosses-not-canonical");
  }
  if (
    typeof exact.source === "string" &&
    typeof exact.stepStrong === "string" &&
    exact.occurrenceCorpusDigest !==
      englishExactOccurrenceCorpusDigest({
        source: exact.source as "TAGNT" | "TAHOT",
        stepStrong: exact.stepStrong,
        occurrences: exact.occurrences
      })
  ) {
    issues.add("english-exact-occurrence-corpus-digest-mismatch");
  }
  return [...issues].sort();
}

/** Runtime validation for the schema-v9 Alternate Strong alias channel. */
export function validateEnglishAlternateStrongAliasEvidence(
  record: EnglishEvidenceAuditRecord
): string[] {
  const evidenceRecord = asRecord(record.evidence);
  if (
    !evidenceRecord ||
    !Object.prototype.hasOwnProperty.call(
      evidenceRecord,
      "alternateStrongAlias"
    )
  ) {
    return ["english-alternate-strong-alias-evidence-missing"];
  }
  const issues = validateAlternateStrongAliasPayload(
    {
      key: record.key,
      language: record.language,
      eStrong: record.eStrong,
      dStrong: record.dStrong,
      uStrong: record.uStrong,
      tagntSourceDigests: record.sourceDigests.TAGNT
    },
    evidenceRecord.alternateStrongAlias
  );
  if (record.key === "greek:G0567") {
    const exact = record.evidence.exactOccurrence;
    if (
      exact.stepStrong !== PINNED_G0567_FORM_ALIAS.aliasStrong ||
      exact.count !== 0 ||
      exact.references.length !== 0 ||
      exact.occurrences.length !== 0
    ) {
      issues.add("english-g0567-exact-occurrence-channel-not-empty");
    }
  }
  return [...issues].sort();
}

function validateAlternateStrongAliasPayload(
  identity: {
    key: string;
    language: LexiconLanguage;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    tagntSourceDigests: Readonly<Record<string, string>>;
  },
  value: unknown
): Set<string> {
  const issues = new Set<string>();
  if (value === null) {
    if (identity.key === "greek:G0567") {
      issues.add("english-g0567-alternate-strong-alias-required");
    }
    return issues;
  }
  const alias = asRecord(value);
  if (!alias) {
    issues.add("english-alternate-strong-alias-malformed");
    return issues;
  }
  if (identity.language !== "greek" || alias.source !== "TAGNT") {
    issues.add("english-alternate-strong-alias-source-mismatch");
  }
  if (alias.proofKind !== "alternate_strong_alias") {
    issues.add("english-alternate-strong-alias-proof-kind-mismatch");
  }
  if (alias.relationKind !== "form_of") {
    issues.add("english-alternate-strong-alias-relation-kind-mismatch");
  }
  const expectedAlias = normalizeStrong(
    extractPrimaryDStrong(identity.dStrong) ?? identity.eStrong
  );
  if (alias.aliasStrong !== expectedAlias) {
    issues.add("english-alternate-strong-alias-identity-mismatch");
  }
  const relationTargets = extractDeclaredRelatedStrongCodes(identity);
  if (relationTargets.length !== 1) {
    issues.add("english-alternate-strong-alias-declared-relation-mismatch");
  }
  const expectedPrimary = relationTargets[0];
  if (
    typeof alias.primaryDStrong !== "string" ||
    alias.primaryDStrong !== expectedPrimary
  ) {
    issues.add("english-alternate-strong-alias-primary-dstrong-mismatch");
  }
  const expectedUStrong = normalizeStrong(identity.uStrong);
  if (
    typeof alias.uStrong !== "string" ||
    alias.uStrong !== expectedUStrong ||
    alias.uStrong !== alias.primaryDStrong
  ) {
    issues.add("english-alternate-strong-alias-ustrong-mismatch");
  }
  if (!Number.isSafeInteger(alias.count) || (alias.count as number) < 1) {
    issues.add("english-alternate-strong-alias-count-invalid");
  }
  const references = Array.isArray(alias.references) ? alias.references : null;
  if (
    !references ||
    references.some((reference) => typeof reference !== "string")
  ) {
    issues.add("english-alternate-strong-alias-references-invalid");
  } else if (
    stableJson(references) !==
    stableJson([...new Set(references as string[])].sort())
  ) {
    issues.add("english-alternate-strong-alias-references-not-canonical");
  }
  const sourceDigests = asStringRecord(alias.sourceDigests);
  if (
    !sourceDigests ||
    !exactDigestRecordMatches(sourceDigests, identity.tagntSourceDigests)
  ) {
    issues.add("english-alternate-strong-alias-source-digests-mismatch");
  }
  const occurrences = Array.isArray(alias.occurrences)
    ? alias.occurrences
    : null;
  if (!occurrences) {
    issues.add("english-alternate-strong-alias-occurrences-invalid");
    return issues;
  }
  if (alias.count !== occurrences.length) {
    issues.add("english-alternate-strong-alias-count-mismatch");
  }
  const locators = new Set<string>();
  const typedOccurrences: EnglishAlternateStrongAliasOccurrenceEvidence[] = [];
  for (const rawOccurrence of occurrences) {
    const occurrence = asRecord(rawOccurrence);
    if (!occurrence) {
      issues.add("english-alternate-strong-alias-occurrence-malformed");
      continue;
    }
    const stringFields = [
      "aliasStrong",
      "primaryDStrong",
      "reference",
      "locator",
      "gloss",
      "morph",
      "digest"
    ] as const;
    if (stringFields.some((field) => typeof occurrence[field] !== "string")) {
      issues.add("english-alternate-strong-alias-occurrence-malformed");
      continue;
    }
    const typed =
      occurrence as unknown as EnglishAlternateStrongAliasOccurrenceEvidence;
    typedOccurrences.push(typed);
    if (typed.aliasStrong !== alias.aliasStrong) {
      issues.add("english-alternate-strong-alias-occurrence-alias-mismatch");
    }
    if (typed.primaryDStrong !== alias.primaryDStrong) {
      issues.add(
        "english-alternate-strong-alias-occurrence-primary-dstrong-mismatch"
      );
    }
    if (!typed.reference.trim()) {
      issues.add("english-alternate-strong-alias-occurrence-reference-invalid");
    }
    if (!typed.locator.trim()) {
      issues.add("english-alternate-strong-alias-occurrence-locator-invalid");
    } else if (locators.has(typed.locator)) {
      issues.add("english-alternate-strong-alias-occurrence-locator-duplicate");
    } else {
      locators.add(typed.locator);
    }
    if (!typed.morph.trim()) {
      issues.add("english-alternate-strong-alias-occurrence-morph-invalid");
    }
    if (
      typed.digest !==
      englishAlternateStrongAliasOccurrenceDigest({
        source: "TAGNT",
        aliasStrong: typed.aliasStrong,
        primaryDStrong: typed.primaryDStrong,
        reference: typed.reference,
        locator: typed.locator,
        gloss: typed.gloss,
        morph: typed.morph
      })
    ) {
      issues.add("english-alternate-strong-alias-occurrence-digest-mismatch");
    }
  }
  if (
    typedOccurrences.length === occurrences.length &&
    stableJson(typedOccurrences) !==
      stableJson(canonicalAlternateStrongAliasOccurrences(typedOccurrences))
  ) {
    issues.add("english-alternate-strong-alias-occurrences-not-canonical");
  }
  const occurrenceReferences = [
    ...new Set(typedOccurrences.map((occurrence) => occurrence.reference))
  ].sort();
  if (
    references &&
    stableJson(references) !== stableJson(occurrenceReferences)
  ) {
    issues.add("english-alternate-strong-alias-reference-set-mismatch");
  }
  if (
    typeof alias.source === "string" &&
    alias.proofKind === "alternate_strong_alias" &&
    alias.relationKind === "form_of" &&
    typeof alias.aliasStrong === "string" &&
    typeof alias.primaryDStrong === "string" &&
    typeof alias.uStrong === "string" &&
    typeof alias.count === "number" &&
    references &&
    sourceDigests &&
    typedOccurrences.length === occurrences.length &&
    alias.occurrenceCorpusDigest !==
      englishAlternateStrongAliasCorpusDigest({
        source: "TAGNT",
        proofKind: "alternate_strong_alias",
        relationKind: "form_of",
        aliasStrong: alias.aliasStrong,
        primaryDStrong: alias.primaryDStrong,
        uStrong: alias.uStrong,
        count: alias.count,
        references: references as string[],
        sourceDigests,
        occurrences: typedOccurrences
      })
  ) {
    issues.add("english-alternate-strong-alias-corpus-digest-mismatch");
  }

  if (identity.key === "greek:G0567") {
    if (
      alias.aliasStrong !== PINNED_G0567_FORM_ALIAS.aliasStrong ||
      alias.primaryDStrong !== PINNED_G0567_FORM_ALIAS.primaryDStrong ||
      alias.uStrong !== PINNED_G0567_FORM_ALIAS.uStrong ||
      alias.relationKind !== PINNED_G0567_FORM_ALIAS.relationKind
    ) {
      issues.add("english-g0567-alternate-strong-alias-target-mismatch");
    }
    if (alias.count !== PINNED_G0567_FORM_ALIAS.occurrenceCount) {
      issues.add("english-g0567-alternate-strong-alias-count-mismatch");
    }
    if (
      !references ||
      stableJson(references) !== stableJson(PINNED_G0567_FORM_ALIAS.references)
    ) {
      issues.add("english-g0567-alternate-strong-alias-references-mismatch");
    }
    const morphologyCounts = Object.fromEntries(
      [
        ...countStrings(typedOccurrences.map((occurrence) => occurrence.morph))
      ].sort(([left], [right]) => left.localeCompare(right))
    );
    if (
      stableJson(morphologyCounts) !==
      stableJson(PINNED_G0567_FORM_ALIAS.morphologyCounts)
    ) {
      issues.add("english-g0567-alternate-strong-alias-voice-mismatch");
    }
    if (
      alias.occurrenceCorpusDigest !==
      PINNED_G0567_FORM_ALIAS.occurrenceCorpusDigest
    ) {
      issues.add("english-g0567-alternate-strong-alias-corpus-mismatch");
    }
  }
  return issues;
}

/**
 * Replays the complete Greek reconstruction envelope from the serialized
 * audit record. This does not replace comparison with the source SQLite row;
 * the authoring builder performs that second check against `rawEntry`.
 */
export function validateEnglishGreekReconstructionEvidence(
  record: EnglishEvidenceAuditRecord
): string[] {
  const issues = new Set<string>();
  const rule = getGreekReconstructionRule(record.key);
  const reconstructionRecord = asRecord(record.reconstruction);
  if (!rule) {
    if (record.reconstruction !== null && record.reconstruction !== undefined) {
      issues.add("english-greek-reconstruction-unexpected");
    }
    return [...issues];
  }
  if (!reconstructionRecord) {
    return ["english-greek-reconstruction-missing"];
  }
  const reconstruction = record.reconstruction!;
  if (
    reconstruction.schemaVersion !== "lexicon-v3-greek-reconstruction-audit@1"
  ) {
    issues.add("english-greek-reconstruction-schema-mismatch");
  }

  const rawRecord = asRecord(reconstruction.rawEntry);
  const rawStringFields = [
    "eStrong",
    "dStrong",
    "uStrong",
    "original",
    "transliteration",
    "morph",
    "gloss",
    "meaning",
    "classicTransliteration",
    "pronunciation"
  ] as const;
  const rawIsWellFormed =
    rawRecord !== null &&
    (rawRecord.language === "greek" || rawRecord.language === "hebrew") &&
    rawStringFields.every((field) => typeof rawRecord[field] === "string");
  if (!rawIsWellFormed) {
    issues.add("english-greek-reconstruction-raw-entry-malformed");
  }

  const inputRecord = asRecord(reconstruction.input);
  const inputSourceDigests = asStringRecord(inputRecord?.sourceDigests);
  const inputWitnessDigests = asNullableStringRecord(
    inputRecord?.witnessDigests
  );
  const occurrenceCount = inputRecord?.occurrenceCount;
  const inputIsWellFormed =
    inputRecord !== null &&
    isSha256(inputRecord.sourceRecordDigest) &&
    inputSourceDigests !== null &&
    inputWitnessDigests !== null &&
    (occurrenceCount === undefined ||
      (Number.isSafeInteger(occurrenceCount) &&
        (occurrenceCount as number) >= 0));
  if (!inputIsWellFormed) {
    issues.add("english-greek-reconstruction-input-malformed");
  }
  const proofRecord = asRecord(reconstruction.proof);
  if (!proofRecord || typeof proofRecord.approved !== "boolean") {
    issues.add("english-greek-reconstruction-proof-malformed");
  }
  if (
    !Array.isArray(reconstruction.blockers) ||
    reconstruction.blockers.some((blocker) => typeof blocker !== "string")
  ) {
    issues.add("english-greek-reconstruction-blockers-malformed");
  } else if (
    stableJson(reconstruction.blockers) !==
    stableJson([...new Set(reconstruction.blockers)].sort())
  ) {
    issues.add("english-greek-reconstruction-blockers-not-canonical");
  }
  if (typeof reconstruction.applied !== "boolean") {
    issues.add("english-greek-reconstruction-applied-malformed");
  }
  if (
    reconstruction.catalogDigest !==
    PINNED_GREEK_RECONSTRUCTION_WITNESS_CATALOG_DIGEST
  ) {
    issues.add("english-greek-reconstruction-catalog-digest-mismatch");
  }
  if (rule.classification === "source-reconciled-form-alias") {
    for (const aliasIssue of validateEnglishAlternateStrongAliasEvidence(
      record
    )) {
      issues.add(`english-greek-reconstruction-alias-invalid:${aliasIssue}`);
    }
    const alias = record.evidence.alternateStrongAlias;
    if (
      !alias ||
      reconstruction.input.occurrenceCount !== alias.count ||
      reconstruction.input.witnessDigests[
        "TAGNT.G0567.alternate-alias-corpus"
      ] !== alias.occurrenceCorpusDigest
    ) {
      issues.add("english-greek-reconstruction-alias-proof-mismatch");
    }
  }
  for (const witness of rule.witnesses) {
    if (
      witness.kind !== "exact-absence-corpus" &&
      witness.kind !== "exact-occurrence-corpus"
    ) {
      continue;
    }
    const exactOccurrence = record.evidence.exactOccurrence;
    if (
      exactOccurrence.source !== "TAGNT" ||
      exactOccurrence.stepStrong !== rule.code ||
      exactOccurrence.occurrenceCorpusDigest !== witness.expectedDigest ||
      exactOccurrence.count !== rule.expectedOccurrenceCount ||
      reconstruction.input.occurrenceCount !== rule.expectedOccurrenceCount ||
      reconstruction.input.witnessDigests[witness.id] !==
        exactOccurrence.occurrenceCorpusDigest
    ) {
      issues.add("english-greek-reconstruction-exact-corpus-mismatch");
      if (witness.kind === "exact-absence-corpus") {
        issues.add(
          "english-greek-reconstruction-exact-absence-corpus-mismatch"
        );
      }
    }
    if (
      witness.kind === "exact-absence-corpus" &&
      (exactOccurrence.count !== 0 ||
        exactOccurrence.references.length !== 0 ||
        exactOccurrence.occurrences.length !== 0)
    ) {
      issues.add("english-greek-reconstruction-exact-absence-corpus-mismatch");
    }
  }

  if (rawIsWellFormed && inputIsWellFormed && proofRecord) {
    const rawEntry = reconstruction.rawEntry;
    if (
      buildLexiconEntryKey(rawEntry.language, rawEntry.dStrong) !== record.key
    ) {
      issues.add("english-greek-reconstruction-raw-entry-key-mismatch");
    }
    if (
      digestGreekReconstructionSourceRecord(rawEntry) !==
      reconstruction.input.sourceRecordDigest
    ) {
      issues.add("english-greek-reconstruction-source-record-digest-mismatch");
    }

    const globalSourceDigests = buildGreekReconstructionGlobalSourceDigests(
      record.sourceDigests
    );
    const expectedInputSources: Record<string, string> = {};
    for (const source of rule.sourceSnapshots) {
      const digest = globalSourceDigests[source.id];
      if (!digest) {
        issues.add(`english-greek-reconstruction-source-missing:${source.id}`);
      } else {
        expectedInputSources[source.id] = digest;
      }
    }
    if (
      stableJson(canonicalRecord(reconstruction.input.sourceDigests)) !==
      stableJson(canonicalRecord(expectedInputSources))
    ) {
      issues.add("english-greek-reconstruction-source-digests-mismatch");
    }

    const replayedProof = proveGreekReconstruction(
      record.key,
      reconstruction.input
    );
    if (stableJson(replayedProof) !== stableJson(reconstruction.proof)) {
      issues.add("english-greek-reconstruction-proof-replay-mismatch");
    }
    const reconstructedEntry = applyProvenGreekReconstruction(
      rawEntry,
      replayedProof
    );
    const publishedProjection = {
      language: record.language,
      eStrong: record.eStrong,
      dStrong: record.dStrong,
      uStrong: record.uStrong,
      original: record.original,
      transliteration: record.transliteration,
      morph: record.morph,
      gloss: record.gloss,
      meaning: record.meaning,
      classicTransliteration: record.classicTransliteration ?? "",
      pronunciation: record.pronunciation ?? ""
    };
    const rawProjection = {
      language: rawEntry.language,
      eStrong: rawEntry.eStrong,
      dStrong: rawEntry.dStrong,
      uStrong: rawEntry.uStrong,
      original: rawEntry.original,
      transliteration: rawEntry.transliteration,
      morph: rawEntry.morph,
      gloss: rawEntry.gloss,
      meaning: rawEntry.meaning,
      classicTransliteration: rawEntry.classicTransliteration,
      pronunciation: rawEntry.pronunciation
    };
    if (reconstruction.applied) {
      if (
        !replayedProof.approved ||
        !Array.isArray(reconstruction.blockers) ||
        reconstruction.blockers.length !== 0 ||
        !reconstructedEntry
      ) {
        issues.add("english-greek-reconstruction-applied-without-proof");
      } else if (
        stableJson(publishedProjection) !== stableJson(reconstructedEntry)
      ) {
        issues.add("english-greek-reconstruction-published-output-mismatch");
      }
      if (
        record.decision.status !== "repaired" ||
        !record.decision.reasonCodes.includes(
          "curated-auto-validated-greek-reconstruction"
        )
      ) {
        issues.add("english-greek-reconstruction-decision-mismatch");
      }
    } else {
      if (stableJson(publishedProjection) !== stableJson(rawProjection)) {
        issues.add("english-greek-reconstruction-unapplied-output-mismatch");
      }
      if (
        record.decision.reasonCodes.includes(
          "curated-auto-validated-greek-reconstruction"
        )
      ) {
        issues.add("english-greek-reconstruction-unapplied-decision-mismatch");
      }
    }
  }

  const reconstructionWithoutDigest = {
    schemaVersion: reconstruction.schemaVersion,
    rawEntry: reconstruction.rawEntry,
    input: reconstruction.input,
    proof: reconstruction.proof,
    catalogDigest: reconstruction.catalogDigest,
    blockers: reconstruction.blockers,
    applied: reconstruction.applied
  };
  if (
    reconstruction.reconstructionDigest !==
    sha256(stableJson(reconstructionWithoutDigest))
  ) {
    issues.add("english-greek-reconstruction-digest-mismatch");
  }
  return [...issues].sort();
}

const STEP_TO_OSIS_BOOK = new Map<string, string>([
  ["Gen", "Gen"],
  ["Exo", "Exod"],
  ["Lev", "Lev"],
  ["Num", "Num"],
  ["Deu", "Deut"],
  ["Jos", "Josh"],
  ["Jdg", "Judg"],
  ["Rut", "Ruth"],
  ["1Sa", "1Sam"],
  ["2Sa", "2Sam"],
  ["1Ki", "1Kgs"],
  ["2Ki", "2Kgs"],
  ["1Ch", "1Chr"],
  ["2Ch", "2Chr"],
  ["Ezr", "Ezra"],
  ["Neh", "Neh"],
  ["Est", "Esth"],
  ["Job", "Job"],
  ["Psa", "Ps"],
  ["Pro", "Prov"],
  ["Ecc", "Eccl"],
  ["Sng", "Song"],
  ["Isa", "Isa"],
  ["Jer", "Jer"],
  ["Lam", "Lam"],
  ["Eze", "Ezek"],
  ["Dan", "Dan"],
  ["Hos", "Hos"],
  ["Jol", "Joel"],
  ["Amo", "Amos"],
  ["Oba", "Obad"],
  ["Jon", "Jonah"],
  ["Mic", "Mic"],
  ["Nah", "Nah"],
  ["Hab", "Hab"],
  ["Zep", "Zeph"],
  ["Hag", "Hag"],
  ["Zec", "Zech"],
  ["Mal", "Mal"],
  ["Mat", "Matt"],
  ["Mrk", "Mark"],
  ["Luk", "Luke"],
  ["Jhn", "John"],
  ["Act", "Acts"],
  ["Rom", "Rom"],
  ["1Co", "1Cor"],
  ["2Co", "2Cor"],
  ["Gal", "Gal"],
  ["Eph", "Eph"],
  ["Php", "Phil"],
  ["Col", "Col"],
  ["1Th", "1Thess"],
  ["2Th", "2Thess"],
  ["1Ti", "1Tim"],
  ["2Ti", "2Tim"],
  ["Tit", "Titus"],
  ["Phm", "Phlm"],
  ["Heb", "Heb"],
  ["Jas", "Jas"],
  ["1Pe", "1Pet"],
  ["2Pe", "2Pet"],
  ["1Jn", "1John"],
  ["2Jn", "2John"],
  ["3Jn", "3John"],
  ["Jud", "Jude"],
  ["Rev", "Rev"]
]);

const TFLSJ_TO_OSIS_BOOK = new Map<string, string>([
  ["Matt", "Matt"],
  ["Mark", "Mark"],
  ["Luke", "Luke"],
  ["John", "John"],
  ["Act", "Acts"],
  ["Acts", "Acts"],
  ["Rom", "Rom"],
  ["1Cor", "1Cor"],
  ["2Cor", "2Cor"],
  ["Gal", "Gal"],
  ["Eph", "Eph"],
  ["Phil", "Phil"],
  ["Col", "Col"],
  ["1Thes", "1Thess"],
  ["1Thess", "1Thess"],
  ["2Thes", "2Thess"],
  ["2Thess", "2Thess"],
  ["1Tim", "1Tim"],
  ["2Tim", "2Tim"],
  ["Titus", "Titus"],
  ["Philem", "Phlm"],
  ["Heb", "Heb"],
  ["Jam", "Jas"],
  ["Jas", "Jas"],
  ["1Pet", "1Pet"],
  ["2Pet", "2Pet"],
  ["1John", "1John"],
  ["2John", "2John"],
  ["3John", "3John"],
  ["Jude", "Jude"],
  ["Rev", "Rev"]
]);

export function buildCorpusEvidenceIndex(
  tokens: readonly StepOriginalToken[],
  entries: readonly EnglishLexiconEntry[]
): CorpusEvidenceIndex {
  const mutable = new Map<string, Set<string>>();
  const eStrongByDStrong = new Map<string, Set<string>>();

  for (const entry of entries) {
    const dStrong = extractPrimaryDStrong(entry.dStrong);
    if (!dStrong) continue;
    getOrInsert(eStrongByDStrong, dStrong, () => new Set()).add(
      normalizeStrong(entry.eStrong)
    );
  }

  for (const token of tokens) {
    const refs = [token.ref, ...token.alternateRefs];
    for (const ref of refs) {
      const target = getOrInsert(mutable, ref, () => new Set());
      for (const [baseStrong, stepStrongValues] of token.strongByBase) {
        target.add(normalizeStrong(baseStrong));
        for (const rawStepStrong of stepStrongValues) {
          const stepStrong = normalizeStrong(rawStepStrong);
          target.add(stepStrong);
          for (const eStrong of eStrongByDStrong.get(stepStrong) ?? []) {
            target.add(eStrong);
          }
        }
      }
    }
  }

  return mutable;
}

export function buildEnglishEvidenceContext(input: {
  entries: readonly EnglishLexiconEntry[];
  tokens: readonly StepOriginalToken[];
  sourceDigests: EnglishEvidenceSourceDigests;
  semanticGlossSourceLines?: Readonly<Record<string, string>>;
  greekReconstructionCatalog?: EnglishGreekReconstructionCatalog;
}): EnglishEvidenceContext {
  const entriesByHeadword = new Map<string, EnglishLexiconEntry[]>();
  const entriesByStrong = new Map<string, EnglishLexiconEntry[]>();
  const exactStepStrongOccurrences = new Map<string, number>();
  const exactStepStrongReferences = new Map<string, Set<string>>();
  const exactStepStrongGlossOccurrences = new Map<
    string,
    EnglishExactOccurrenceGlossEvidence[]
  >();
  const alternateStrongAliases = new Map<
    string,
    EnglishAlternateStrongAliasOccurrenceEvidence[]
  >();
  const greekReconstructionOccurrenceCounts = new Map<string, number>();
  const nativeOccurrenceLocatorCounts = new Map<string, number>();

  for (const token of input.tokens) {
    const tokenStrongs = new Set<string>();
    const reconstructionTokenStrongs = new Set<string>();
    const alternateAliasPairs = new Map<
      string,
      { aliasStrong: string; primaryDStrong: string }
    >();
    for (const [rawBaseStrong, stepStrongValues] of token.strongByBase) {
      const aliasStrong = normalizeStrong(rawBaseStrong);
      reconstructionTokenStrongs.add(aliasStrong);
      for (const rawStepStrong of stepStrongValues) {
        const stepStrong = normalizeStrong(rawStepStrong);
        tokenStrongs.add(stepStrong);
        reconstructionTokenStrongs.add(stepStrong);
        if (
          token.source === "TAGNT" &&
          aliasStrong !== normalizeClassicalStrongCode(stepStrong)
        ) {
          alternateAliasPairs.set(`${aliasStrong}:${stepStrong}`, {
            aliasStrong,
            primaryDStrong: stepStrong
          });
        }
      }
    }
    for (const strong of reconstructionTokenStrongs) {
      if (!strong.startsWith("G")) continue;
      greekReconstructionOccurrenceCounts.set(
        strong,
        (greekReconstructionOccurrenceCounts.get(strong) ?? 0) + 1
      );
    }
    const nativeLocator = `${token.source}:${token.ref}#${String(
      token.tokenIndex
    ).padStart(2, "0")}`;
    const locatorOrdinal =
      (nativeOccurrenceLocatorCounts.get(nativeLocator) ?? 0) + 1;
    nativeOccurrenceLocatorCounts.set(nativeLocator, locatorOrdinal);
    const locator =
      locatorOrdinal === 1
        ? nativeLocator
        : `${nativeLocator}@${locatorOrdinal}`;
    for (const {
      aliasStrong,
      primaryDStrong
    } of alternateAliasPairs.values()) {
      const occurrenceWithoutDigest = {
        aliasStrong,
        primaryDStrong,
        reference: token.ref,
        locator,
        gloss: token.gloss,
        morph: token.morphology
      };
      const occurrence = {
        ...occurrenceWithoutDigest,
        digest: englishAlternateStrongAliasOccurrenceDigest({
          source: "TAGNT",
          ...occurrenceWithoutDigest
        })
      } satisfies EnglishAlternateStrongAliasOccurrenceEvidence;
      getOrInsert(alternateStrongAliases, aliasStrong, () => []).push(
        occurrence
      );
    }
    for (const stepStrong of tokenStrongs) {
      exactStepStrongOccurrences.set(
        stepStrong,
        (exactStepStrongOccurrences.get(stepStrong) ?? 0) + 1
      );
      const references = getOrInsert(
        exactStepStrongReferences,
        stepStrong,
        () => new Set<string>()
      );
      references.add(token.ref);
      for (const alternateRef of token.alternateRefs) {
        references.add(alternateRef);
      }
      const occurrence = {
        dStrong: stepStrong,
        gloss: token.gloss,
        locator,
        digest: englishExactOccurrenceGlossDigest({
          source: token.source,
          dStrong: stepStrong,
          gloss: token.gloss,
          locator
        })
      } satisfies EnglishExactOccurrenceGlossEvidence;
      getOrInsert(exactStepStrongGlossOccurrences, stepStrong, () => []).push(
        occurrence
      );
    }
  }

  for (const entry of input.entries) {
    for (const headword of splitOriginalHeadwords(entry.original)) {
      const normalized = normalizeLexiconHeadword(headword, entry.language);
      if (!normalized) continue;
      getOrInsert(entriesByHeadword, normalized, () => []).push(entry);
    }
    const strongKeys = new Set(
      [entry.eStrong, extractPrimaryDStrong(entry.dStrong)]
        .filter((value): value is string => Boolean(value))
        .map(normalizeStrong)
    );
    for (const strong of strongKeys) {
      getOrInsert(entriesByStrong, strong, () => []).push(entry);
    }
  }

  const catalogVerification = input.greekReconstructionCatalog
    ? verifyEnglishGreekReconstructionCatalog(
        input.greekReconstructionCatalog,
        input.sourceDigests
      )
    : null;

  return {
    corpus: buildCorpusEvidenceIndex(input.tokens, input.entries),
    exactStepStrongOccurrences,
    exactStepStrongReferences: new Map(
      [...exactStepStrongReferences].map(([strong, references]) => [
        strong,
        [...references].sort()
      ])
    ),
    exactStepStrongGlossOccurrences: new Map(
      [...exactStepStrongGlossOccurrences].map(([strong, occurrences]) => [
        strong,
        canonicalExactOccurrenceGlosses(occurrences)
      ])
    ),
    alternateStrongAliases: new Map(
      [...alternateStrongAliases].map(([strong, occurrences]) => [
        strong,
        canonicalAlternateStrongAliasOccurrences(occurrences)
      ])
    ),
    greekReconstructionOccurrenceCounts,
    entriesByHeadword,
    entriesByStrong,
    sourceDigests: input.sourceDigests,
    semanticGlossSourceLines: input.semanticGlossSourceLines ?? {},
    ...(catalogVerification?.catalog
      ? { greekReconstructionCatalog: catalogVerification.catalog }
      : {}),
    greekReconstructionCatalogIssues: catalogVerification
      ? catalogVerification.issues
      : ["greek-reconstruction-witness-catalog-missing"]
  };
}

export function auditEnglishEvidenceEntry(
  entry: EnglishLexiconEntry,
  resources: readonly EnglishLexiconResource[],
  context: EnglishEvidenceContext
): EnglishEvidenceAuditRecord {
  const curatedFieldRepairs = applyCuratedGreekFieldRepairs(entry, context);
  const exactRepairResult = applyExactEnglishFieldRepairs(entry, context);
  const fieldRepairs = [
    ...curatedFieldRepairs,
    ...(exactRepairResult?.repairs ?? [])
  ];
  const sourceAuditedEntry = exactRepairResult
    ? { ...entry, ...exactRepairResult.entry }
    : curatedFieldRepairs.length === 0
      ? entry
      : { ...entry, gloss: curatedFieldRepairs[0]!.repairedValue };
  const alternateStrongAlias = buildEnglishAlternateStrongAliasEvidence(
    entry,
    context
  );
  const reconstructionResult = auditGreekReconstruction(
    entry,
    context,
    alternateStrongAlias
  );
  const auditedEntry = reconstructionResult.entry ?? sourceAuditedEntry;
  const reconstruction = reconstructionResult.evidence;
  const key = buildLexiconEntryKey(
    sourceAuditedEntry.language,
    sourceAuditedEntry.dStrong
  );
  const briefSource =
    sourceAuditedEntry.language === "greek" ? "TBESG" : "TBESH";
  const brief = auditSourceEvidence({
    entry: sourceAuditedEntry,
    source: briefSource,
    content: sourceAuditedEntry.meaning,
    digest:
      briefSource === "TBESG"
        ? context.sourceDigests.TBESG
        : context.sourceDigests.TBESH,
    context,
    confirmedOwner:
      briefSource === "TBESG" &&
      context.sourceDigests.TBESG === CURATED_SOURCE_SNAPSHOT_DIGESTS.TBESG
        ? CONFIRMED_BRIEF_SOURCE_CONFLICTS.get(key)
        : undefined
  });
  const tflsjResource = resources.find(
    (resource) => resource.source === "TFLSJ"
  );
  const tflsj = tflsjResource
    ? auditSourceEvidence({
        entry: sourceAuditedEntry,
        source: "TFLSJ",
        content: tflsjResource.contentHtml,
        digest: context.sourceDigests.TFLSJ,
        context,
        confirmedOwner:
          context.sourceDigests.TFLSJ === CURATED_SOURCE_SNAPSHOT_DIGESTS.TFLSJ
            ? CONFIRMED_TFLSJ_SOURCE_CONFLICTS.get(key)
            : undefined
      })
    : null;

  const sourceAudit = auditLexiconV3Source(sourceAuditedEntry, resources);
  const exactStepStrong = normalizeStrong(
    extractPrimaryDStrong(sourceAuditedEntry.dStrong) ??
      sourceAuditedEntry.eStrong
  );
  const semanticGlossAttestation = buildSemanticGlossAttestation(
    sourceAuditedEntry,
    context
  );
  const decision = selectEnglishEvidenceDecision(
    sourceAuditedEntry,
    brief,
    tflsj,
    sourceAudit,
    context,
    fieldRepairs,
    reconstruction,
    semanticGlossAttestation
  );
  const exactOccurrenceSource = (
    sourceAuditedEntry.language === "greek" ? "TAGNT" : "TAHOT"
  ) as "TAGNT" | "TAHOT";
  const exactOccurrenceGlosses = canonicalExactOccurrenceGlosses(
    context.exactStepStrongGlossOccurrences.get(exactStepStrong) ?? []
  );
  const withoutDigest = {
    schemaVersion: ENGLISH_EVIDENCE_SCHEMA_VERSION,
    key,
    stepEntryId: auditedEntry.stepEntryId,
    language: auditedEntry.language,
    eStrong: auditedEntry.eStrong,
    dStrong: auditedEntry.dStrong,
    uStrong: auditedEntry.uStrong,
    original: auditedEntry.original,
    transliteration: auditedEntry.transliteration,
    morph: auditedEntry.morph,
    gloss: auditedEntry.gloss,
    meaning: auditedEntry.meaning,
    classicTransliteration: auditedEntry.classicTransliteration ?? "",
    pronunciation: auditedEntry.pronunciation ?? "",
    reconstruction,
    resources: [...resources],
    evidence: {
      brief,
      TFLSJ: tflsj,
      exactOccurrence: {
        source: exactOccurrenceSource,
        stepStrong: exactStepStrong,
        count: context.exactStepStrongOccurrences.get(exactStepStrong) ?? 0,
        references: [
          ...(context.exactStepStrongReferences.get(exactStepStrong) ?? [])
        ],
        occurrences: exactOccurrenceGlosses,
        occurrenceCorpusDigest: englishExactOccurrenceCorpusDigest({
          source: exactOccurrenceSource,
          stepStrong: exactStepStrong,
          occurrences: exactOccurrenceGlosses
        })
      },
      alternateStrongAlias,
      semanticGlossAttestation,
      sourceAudit,
      fieldRepairs
    },
    decision,
    sourceDigests: context.sourceDigests
  };

  return {
    ...withoutDigest,
    recordDigest: sha256(stableJson(withoutDigest))
  };
}

export function buildEnglishAlternateStrongAliasEvidence(
  entry: EnglishLexiconEntry,
  context: EnglishEvidenceContext
): EnglishAlternateStrongAliasEvidence | null {
  if (entry.language !== "greek") return null;
  const aliasStrong = normalizeStrong(
    extractPrimaryDStrong(entry.dStrong) ?? entry.eStrong
  );
  const relatedCodes = extractDeclaredRelatedStrongCodes(entry);
  if (relatedCodes.length !== 1) return null;
  const primaryDStrong = relatedCodes[0]!;
  const occurrences = canonicalAlternateStrongAliasOccurrences(
    (context.alternateStrongAliases.get(aliasStrong) ?? []).filter(
      (occurrence) => occurrence.primaryDStrong === primaryDStrong
    )
  );
  if (occurrences.length === 0) return null;
  const references = [
    ...new Set(occurrences.map((occurrence) => occurrence.reference))
  ].sort();
  const withoutDigest = {
    source: "TAGNT" as const,
    proofKind: "alternate_strong_alias" as const,
    relationKind: "form_of" as const,
    aliasStrong,
    primaryDStrong,
    uStrong: normalizeStrong(entry.uStrong),
    count: occurrences.length,
    references,
    sourceDigests: canonicalRecord(context.sourceDigests.TAGNT),
    occurrences
  };
  return {
    ...withoutDigest,
    occurrenceCorpusDigest:
      englishAlternateStrongAliasCorpusDigest(withoutDigest)
  };
}

function validateG0567FormAliasForSourceEntry(
  entry: EnglishLexiconEntry,
  alias: EnglishAlternateStrongAliasEvidence | null,
  tagntSourceDigests: Readonly<Record<string, string>>,
  exactOccurrenceCount: number
): string[] {
  const issues = validateAlternateStrongAliasPayload(
    {
      key: "greek:G0567",
      language: entry.language,
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      tagntSourceDigests
    },
    alias
  );
  if (exactOccurrenceCount !== 0) {
    issues.add("english-g0567-exact-occurrence-channel-not-empty");
  }
  return [...issues]
    .sort()
    .map((issue) => `greek:G0567:${issue.replace(/^english-/u, "")}`);
}

function auditGreekReconstruction(
  entry: EnglishLexiconEntry,
  context: EnglishEvidenceContext,
  alternateStrongAlias: EnglishAlternateStrongAliasEvidence | null
): {
  entry: EnglishLexiconEntry | null;
  evidence: EnglishGreekReconstructionEvidence | null;
} {
  const key = buildLexiconEntryKey(entry.language, entry.dStrong);
  const rule = getGreekReconstructionRule(key);
  if (!rule) return { entry: null, evidence: null };

  const blockers = new Set<string>(context.greekReconstructionCatalogIssues);
  const catalog = context.greekReconstructionCatalog;
  const catalogIsVerified =
    Boolean(catalog) && context.greekReconstructionCatalogIssues.length === 0;
  const catalogEntry = catalogIsVerified ? catalog?.entries[key] : undefined;
  if (catalogIsVerified && !catalogEntry) {
    blockers.add(`${key}:witness-catalog-entry-missing`);
  }

  const sourceRecordDigest = digestGreekReconstructionSourceRecord(entry);
  if (catalogEntry && catalogEntry.sourceRecordDigest !== sourceRecordDigest) {
    blockers.add(`${key}:witness-catalog-source-record-current-mismatch`);
  }

  const aliasReconstruction =
    rule.classification === "source-reconciled-form-alias";
  const exactCorpusReconstruction = rule.witnesses.some(
    (witness) =>
      witness.kind === "exact-absence-corpus" ||
      witness.kind === "exact-occurrence-corpus"
  );
  if (aliasReconstruction) {
    for (const blocker of validateG0567FormAliasForSourceEntry(
      entry,
      alternateStrongAlias,
      context.sourceDigests.TAGNT,
      context.exactStepStrongOccurrences.get(
        PINNED_G0567_FORM_ALIAS.aliasStrong
      ) ?? 0
    )) {
      blockers.add(blocker);
    }
  }
  const actualOccurrenceCount =
    rule.expectedOccurrenceCount === null
      ? undefined
      : aliasReconstruction
        ? (alternateStrongAlias?.count ?? 0)
        : exactCorpusReconstruction
          ? (context.exactStepStrongOccurrences.get(rule.code) ?? 0)
          : (context.greekReconstructionOccurrenceCounts.get(rule.code) ?? 0);
  if (
    catalogEntry &&
    catalogEntry.occurrenceCount !== (actualOccurrenceCount ?? null)
  ) {
    blockers.add(`${key}:witness-catalog-occurrence-count-current-mismatch`);
  }
  if (aliasReconstruction && catalogEntry) {
    const catalogAliasDigest =
      catalogEntry.witnessDigests["TAGNT.G0567.alternate-alias-corpus"];
    if (catalogAliasDigest !== alternateStrongAlias?.occurrenceCorpusDigest) {
      blockers.add(
        `${key}:witness-catalog-alternate-alias-corpus-current-mismatch`
      );
    }
  }

  const witnessDigests: Record<string, string | null> = catalogEntry
    ? { ...catalogEntry.witnessDigests }
    : {};
  const internalAdjudicationWitness = rule.witnesses.find(
    (witness) => witness.id === "InternalAdjudication.G20464.semantic-payload"
  );
  if (internalAdjudicationWitness) {
    delete witnessDigests[internalAdjudicationWitness.id];
    const actualPayloadDigest =
      context.sourceDigests.greekReconstruction?.g20464AdjudicationPayload;
    if (!actualPayloadDigest) {
      blockers.add(`${key}:internal-adjudication-payload-missing`);
    } else {
      witnessDigests[internalAdjudicationWitness.id] = actualPayloadDigest;
      if (actualPayloadDigest !== internalAdjudicationWitness.expectedDigest) {
        blockers.add(`${key}:internal-adjudication-payload-digest-mismatch`);
      }
      if (
        catalogEntry?.witnessDigests[internalAdjudicationWitness.id] !==
        actualPayloadDigest
      ) {
        blockers.add(
          `${key}:witness-catalog-internal-adjudication-current-mismatch`
        );
      }
    }
  }
  for (const witness of rule.witnesses) {
    if (
      witness.kind !== "exact-absence-corpus" &&
      witness.kind !== "exact-occurrence-corpus"
    ) {
      continue;
    }
    const exactStrong = normalizeStrong(rule.code);
    const occurrences = canonicalExactOccurrenceGlosses(
      context.exactStepStrongGlossOccurrences.get(exactStrong) ?? []
    );
    const exactCount = context.exactStepStrongOccurrences.get(exactStrong) ?? 0;
    const actualDigest = englishExactOccurrenceCorpusDigest({
      source: "TAGNT",
      stepStrong: exactStrong,
      occurrences
    });
    witnessDigests[witness.id] = actualDigest;
    if (
      witness.kind === "exact-absence-corpus" &&
      (exactCount !== 0 || occurrences.length !== 0)
    ) {
      blockers.add(`${key}:exact-absence-corpus-not-empty`);
    }
    if (actualDigest !== witness.expectedDigest) {
      blockers.add(`${key}:exact-occurrence-corpus-digest-mismatch`);
    }
    if (catalogEntry?.witnessDigests[witness.id] !== actualDigest) {
      blockers.add(
        `${key}:witness-catalog-exact-occurrence-corpus-current-mismatch`
      );
    }
  }

  const globalSourceDigests = buildGreekReconstructionGlobalSourceDigests(
    context.sourceDigests
  );
  const sourceDigests: Record<string, string> = {};
  for (const source of rule.sourceSnapshots) {
    const actualDigest = globalSourceDigests[source.id];
    if (!actualDigest) {
      blockers.add(`greek-reconstruction-global-source-missing:${source.id}`);
      continue;
    }
    sourceDigests[source.id] = actualDigest;
  }

  const input: GreekReconstructionProofInput = {
    sourceRecordDigest,
    sourceDigests,
    witnessDigests,
    ...(actualOccurrenceCount === undefined
      ? {}
      : { occurrenceCount: actualOccurrenceCount })
  };
  const proof = proveGreekReconstruction(key, input);
  for (const reason of proof.reasonCodes) {
    if (reason !== "greek-reconstruction-approved") blockers.add(reason);
  }

  let reconstructedEntry: EnglishLexiconEntry | null = null;
  if (blockers.size === 0 && proof.approved) {
    reconstructedEntry = applyProvenGreekReconstruction(entry, proof);
    if (!reconstructedEntry) {
      blockers.add("greek-reconstruction-application-rejected");
    }
  }
  const applied = reconstructedEntry !== null && blockers.size === 0;
  const rawEntry = {
    language: entry.language,
    eStrong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong,
    original: entry.original,
    transliteration: entry.transliteration,
    morph: entry.morph,
    gloss: entry.gloss,
    meaning: entry.meaning,
    classicTransliteration: entry.classicTransliteration ?? "",
    pronunciation: entry.pronunciation ?? ""
  };
  const withoutDigest = {
    schemaVersion: "lexicon-v3-greek-reconstruction-audit@1" as const,
    rawEntry,
    input,
    proof,
    catalogDigest: catalog?.catalogDigest ?? null,
    blockers: [...blockers].sort(),
    applied
  };
  return {
    entry: applied ? reconstructedEntry : null,
    evidence: {
      ...withoutDigest,
      reconstructionDigest: sha256(stableJson(withoutDigest))
    }
  };
}

export function summarizeEnglishEvidenceAudit(
  records: readonly EnglishEvidenceAuditRecord[],
  inputEntries: number,
  sourceDigests: EnglishEvidenceSourceDigests,
  generatedAt = new Date().toISOString()
): EnglishEvidenceAuditSummary {
  const statusCounts: EnglishEvidenceAuditSummary["statusCounts"] = {
    accepted: 0,
    repaired: 0,
    "source-conflict": 0,
    quarantined: 0
  };
  const canonicalSourceCounts: Record<string, number> = {};
  const quarantinedSourceCounts: Record<string, number> = {};

  for (const record of records) {
    statusCounts[record.decision.status] += 1;
    const canonical = record.decision.canonicalSource ?? "none";
    canonicalSourceCounts[canonical] =
      (canonicalSourceCounts[canonical] ?? 0) + 1;
    for (const source of record.decision.quarantinedSources) {
      quarantinedSourceCounts[source] =
        (quarantinedSourceCounts[source] ?? 0) + 1;
    }
  }

  return {
    schemaVersion: ENGLISH_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    inputEntries,
    outputEntries: records.length,
    statusCounts,
    canonicalSourceCounts,
    quarantinedSourceCounts,
    confirmedBriefConflicts: records
      .filter((record) =>
        record.decision.reasonCodes.includes("confirmed-brief-source-conflict")
      )
      .map((record) => record.key),
    confirmedTflsjConflicts: records
      .filter((record) =>
        record.decision.reasonCodes.includes("confirmed-tflsj-source-conflict")
      )
      .map((record) => record.key),
    sourceDigests
  };
}

export function renderEnglishEvidenceAuditReport(
  summary: EnglishEvidenceAuditSummary
): string {
  const rows = Object.entries(summary.statusCounts)
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join("\n");
  return `# Lexicon v3 English source audit

Generated: ${summary.generatedAt}

- Input entries: ${summary.inputEntries}
- Output entries: ${summary.outputEntries}
- Confirmed TBESG conflicts: ${summary.confirmedBriefConflicts.length}
- Confirmed TFLSJ conflicts: ${summary.confirmedTflsjConflicts.length}

| Status | Count |
| --- | ---: |
${rows}

## Confirmed TBESG conflicts

${summary.confirmedBriefConflicts.map((key) => `- ${key}`).join("\n") || "- None"}

## Confirmed TFLSJ conflicts

${summary.confirmedTflsjConflicts.map((key) => `- ${key}`).join("\n") || "- None"}

## Source digests

\`\`\`json
${JSON.stringify(summary.sourceDigests, null, 2)}
\`\`\`
`;
}

export function extractSourceReferences(
  content: string,
  source: "TBESG" | "TBESH" | "TFLSJ"
): string[] {
  const refs = new Set<string>();
  if (source === "TFLSJ") {
    for (const match of content.matchAll(
      /\bNT\.([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)/gu
    )) {
      const book = TFLSJ_TO_OSIS_BOOK.get(match[1] ?? "");
      if (book) refs.add(`${book}.${Number(match[2])}.${Number(match[3])}`);
    }
    return [...refs];
  }

  for (const match of htmlToText(content).matchAll(
    /\b([1-3]?[A-Za-z]{2,3})\.(\d+)[.:](\d+)/gu
  )) {
    const book = STEP_TO_OSIS_BOOK.get(match[1] ?? "");
    if (book) refs.add(`${book}.${Number(match[2])}.${Number(match[3])}`);
  }
  return [...refs];
}

export function normalizeLexiconHeadword(
  value: string,
  language: LexiconLanguage
): string {
  if (language === "greek") {
    return value
      .normalize("NFD")
      .toLocaleLowerCase("el")
      .replace(/ς/gu, "σ")
      .replace(/[\u0300-\u0312\u0315-\u036f]/gu, "")
      .replace(/[^\p{Script=Greek}\u0313\u0314]/gu, "");
  }
  return value
    .normalize("NFD")
    .replace(/[\u0591-\u05c7]/gu, "")
    .replace(/[^\p{Script=Hebrew}]/gu, "");
}

function auditSourceEvidence(input: {
  entry: EnglishLexiconEntry;
  source: "TBESG" | "TBESH" | "TFLSJ";
  content: string;
  digest: string;
  context: EnglishEvidenceContext;
  confirmedOwner?: string;
}): SourceEvidence {
  const headword = extractLexiconHeadword(input.content, input.entry.language);
  const headwordMatchesEntry = headword
    ? compareLexiconHeadword(input.entry.original, headword, {
        language: input.entry.language
      }).matches
    : null;
  const headwordOwners = headword
    ? (
        input.context.entriesByHeadword.get(
          normalizeLexiconHeadword(headword, input.entry.language)
        ) ?? []
      ).filter((owner) => owner.stepEntryId !== input.entry.stepEntryId)
    : [];
  const headwordOwnerKeys = headwordOwners.map((owner) =>
    buildLexiconEntryKey(owner.language, owner.dStrong)
  );
  const declaredRelatedStrongCodes = extractDeclaredRelatedStrongCodes(
    input.entry
  );
  const declaredRelatedStrongSet = new Set(declaredRelatedStrongCodes);
  const headwordMatchesDeclaredRelation = headwordOwners.some((owner) => {
    const ownerCodes = [
      extractPrimaryDStrong(owner.dStrong),
      owner.eStrong
    ].filter((value): value is string => Boolean(value));
    return ownerCodes.some((code) =>
      declaredRelatedStrongSet.has(normalizeStrong(code))
    );
  });
  const contentMentionsEntryOriginal = sourceContentMentionsEntryOriginal(
    input.content,
    input.entry
  );
  const citations = buildCitationEvidence(
    input.entry,
    extractSourceReferences(input.content, input.source),
    input.context
  );
  const issues: string[] = [];

  if (!headword) issues.push("missing-headword-evidence");
  if (headwordMatchesEntry === false) issues.push("headword-mismatch");
  if (citations.references.length > 0 && citations.targetHits.length === 0) {
    issues.push("no-cited-reference-target-hit");
  }
  const inferredOwner = inferCrossEntryConflictOwner(
    headwordMatchesEntry,
    headwordOwnerKeys,
    citations,
    headwordMatchesDeclaredRelation || contentMentionsEntryOriginal
  );
  if (inferredOwner) {
    issues.push("high-confidence-cross-entry-source-content");
    issues.push("citations-hit-headword-owner");
  }
  if (input.confirmedOwner) {
    issues.push("confirmed-cross-entry-source-content");
    const ownerHits = citations.otherStrongHits[input.confirmedOwner] ?? [];
    if (ownerHits.length > 0) issues.push("citations-hit-confirmed-owner");
  }
  if (declaredRelatedStrongCodes.length > 0) {
    issues.push("declared-step-subentry-relationship");
  }
  if (headwordMatchesDeclaredRelation) {
    issues.push("headword-matches-declared-related-entry");
  }
  if (contentMentionsEntryOriginal) {
    issues.push("content-mentions-entry-original");
  }

  return {
    source: input.source,
    digest: input.digest,
    headword,
    headwordMatchesEntry,
    headwordOwnerKeys: [...new Set(headwordOwnerKeys)].sort(),
    declaredRelatedStrongCodes,
    headwordMatchesDeclaredRelation,
    contentMentionsEntryOriginal,
    conflictOwner: input.confirmedOwner ?? inferredOwner,
    citations,
    issues,
    quarantined: Boolean(input.confirmedOwner ?? inferredOwner)
  };
}

function buildCitationEvidence(
  entry: EnglishLexiconEntry,
  references: string[],
  context: EnglishEvidenceContext
): CitationEvidence {
  const eStrong = normalizeStrong(entry.eStrong);
  const primaryDStrong = normalizeStrong(
    extractPrimaryDStrong(entry.dStrong) ?? ""
  );
  // A suffixed dStrong is a STEP sense/form identity, not merely an alias for
  // its classical Strong. A citation to a sibling sub-entry must not count as
  // evidence for this one.
  const targetCodes = new Set(
    primaryDStrong && primaryDStrong !== eStrong
      ? [primaryDStrong]
      : [eStrong, primaryDStrong].filter(Boolean)
  );
  const expectedPrefix = entry.language === "greek" ? "G" : "H";
  const resolvedReferences = references.filter((ref) =>
    [...(context.corpus.get(ref) ?? [])].some((code) =>
      code.startsWith(expectedPrefix)
    )
  );
  const targetHits = resolvedReferences.filter((ref) => {
    const codes = context.corpus.get(ref);
    return [...targetCodes].some((code) => code && codes?.has(code));
  });
  const otherStrongHits: Record<string, string[]> = {};

  for (const ref of resolvedReferences) {
    for (const code of context.corpus.get(ref) ?? []) {
      if (!code.startsWith(expectedPrefix)) continue;
      if (targetCodes.has(code)) continue;
      if (!context.entriesByStrong.has(code)) continue;
      (otherStrongHits[code] ??= []).push(ref);
    }
  }
  for (const [code, refs] of Object.entries(otherStrongHits)) {
    otherStrongHits[code] = [...new Set(refs)].sort();
  }

  return {
    references: [...new Set(references)].sort(),
    resolvedReferences: [...new Set(resolvedReferences)].sort(),
    targetHits: [...new Set(targetHits)].sort(),
    otherStrongHits
  };
}

function applyCuratedGreekFieldRepairs(
  entry: EnglishLexiconEntry,
  context: EnglishEvidenceContext
): EnglishFieldRepairEvidence[] {
  if (
    entry.language !== "greek" ||
    !matchesCuratedGreekSourceSnapshot(context.sourceDigests)
  ) {
    return [];
  }
  const key = buildLexiconEntryKey(entry.language, entry.dStrong);
  const rule = CURATED_GREEK_ENGLISH_REPAIR_RULES.get(key);
  if (rule?.action !== "extract_gloss_from_exact_brief_definition") return [];

  const sourceRecordDigest = digestEnglishSourceRecord(entry);
  const sourceMeaningDigest = sha256(entry.meaning);
  if (
    sourceRecordDigest !== rule.expectedSourceRecordDigest ||
    sourceMeaningDigest !== rule.expectedMeaningDigest ||
    entry.gloss !== "" ||
    !rule.repairedGloss
  ) {
    return [];
  }

  const matches = [...entry.meaning.matchAll(/<b>= πλάνης, a ([a-z]+)<\/b>/gu)];
  const extractedGloss = matches.length === 1 ? matches[0]?.[1] : undefined;
  if (extractedGloss !== rule.repairedGloss) return [];

  const ruleDigest = digestCuratedGreekEnglishRepairRule(rule);
  const withoutDigest = {
    field: "gloss" as const,
    sourceValue: entry.gloss,
    repairedValue: extractedGloss,
    method: "exact-tbesg-definition-extraction" as const,
    ruleId: rule.ruleId,
    ruleDigest,
    sourceRecordDigest,
    sourceMeaningDigest
  };
  return [
    {
      ...withoutDigest,
      repairDigest: sha256(stableJson(withoutDigest))
    }
  ];
}

function applyExactEnglishFieldRepairs(
  entry: EnglishLexiconEntry,
  context: EnglishEvidenceContext
): ReturnType<typeof applyEnglishExactRepairs> {
  const key = buildLexiconEntryKey(entry.language, entry.dStrong);
  if (!ENGLISH_EXACT_REPAIR_RULES.has(key)) return null;
  try {
    return applyEnglishExactRepairs(entry, {
      databaseDigest: context.sourceDigests.database,
      sourceDigests: {
        TBESG: context.sourceDigests.TBESG,
        TBESH: context.sourceDigests.TBESH,
        TIPNR: context.sourceDigests.greekReconstruction?.tipnrPeople
      }
    });
  } catch {
    // The decision layer below recognizes the pinned rule and quarantines the
    // row. A stale snapshot or near match can therefore never inherit repair
    // evidence, while a corpus audit still reports the exact blocked entry.
    return null;
  }
}

function buildSemanticGlossAttestation(
  entry: EnglishLexiconEntry,
  context: EnglishEvidenceContext
): EnglishSemanticGlossAttestationEvidence | null {
  const key = buildLexiconEntryKey(entry.language, entry.dStrong);
  if (!ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.has(key)) return null;
  try {
    return attestEnglishSemanticGloss(entry, {
      databaseDigest: context.sourceDigests.database,
      sourceDigests: {
        TBESG: context.sourceDigests.TBESG,
        TFLSJ: context.sourceDigests.TFLSJ
      },
      sourceLines: context.semanticGlossSourceLines
    });
  } catch {
    // A registered entry is quarantined by the decision layer below when any
    // pinned row, source line, fragment, or snapshot cannot be replayed.
    return null;
  }
}

export function validateEnglishSemanticGlossEvidence(
  record: EnglishEvidenceAuditRecord
): string[] {
  return validateEnglishSemanticGlossAttestationEnvelope({
    entry: {
      language: record.language,
      eStrong: record.eStrong,
      dStrong: record.dStrong,
      uStrong: record.uStrong,
      original: record.original,
      transliteration: record.transliteration,
      morph: record.morph,
      gloss: record.gloss,
      meaning: record.meaning
    },
    evidence: record.evidence.semanticGlossAttestation,
    context: {
      databaseDigest: record.sourceDigests.database,
      sourceDigests: {
        TBESG: record.sourceDigests.TBESG,
        TFLSJ: record.sourceDigests.TFLSJ
      },
      exactOccurrenceCount: record.evidence.exactOccurrence.count
    }
  });
}

function decideCuratedGreekEnglishRepair(input: {
  entry: EnglishLexiconEntry;
  brief: SourceEvidence;
  tflsj: SourceEvidence | null;
  sourceAudit: LexiconV3SourceAuditResult;
  fieldRepairs: readonly EnglishFieldRepairEvidence[];
  rule: CuratedGreekEnglishRepairRule;
}): EnglishEvidenceDecision | null {
  const { entry, brief, tflsj, sourceAudit, fieldRepairs, rule } = input;

  if (rule.action === "extract_gloss_from_exact_brief_definition") {
    const fieldRepair = fieldRepairs[0];
    if (
      fieldRepairs.length !== 1 ||
      !fieldRepair ||
      fieldRepair.field !== "gloss" ||
      fieldRepair.method !== "exact-tbesg-definition-extraction" ||
      fieldRepair.repairedValue !== rule.repairedGloss ||
      entry.gloss !== rule.repairedGloss ||
      fieldRepair.sourceRecordDigest !== rule.expectedSourceRecordDigest ||
      fieldRepair.sourceMeaningDigest !== rule.expectedMeaningDigest ||
      brief.headwordMatchesEntry !== true ||
      brief.quarantined ||
      sourceAudit.status !== "source_ok" ||
      !sourceAudit.glossSupport.meaningSupportsGloss ||
      tflsj !== null
    ) {
      return null;
    }
    const curatedRuleProof = buildCuratedGreekEnglishRuleProof(rule, {
      exactBriefHeadword: true,
      exactDefinitionExtraction: true,
      meaningSupportsRepairedGloss: true,
      supplementalResourceCount: 0
    });
    return {
      status: "accepted",
      canonicalSource: "TBESG",
      extendedSource: null,
      quarantinedSources: [],
      reasonCodes: [
        "brief-source-accepted",
        "exact-brief-definition-gloss-repair",
        "curated-auto-validated-exact-brief-gloss-repair"
      ],
      curatedRuleProof
    };
  }

  const sourceRecordDigest = digestEnglishSourceRecord(entry);
  const sourceMeaningDigest = sha256(entry.meaning);
  const expectedOwner = rule.expectedTflsjConflictOwner;
  if (
    fieldRepairs.length !== 0 ||
    sourceRecordDigest !== rule.expectedSourceRecordDigest ||
    sourceMeaningDigest !== rule.expectedMeaningDigest ||
    !expectedOwner ||
    brief.headword !== null ||
    brief.quarantined ||
    sourceAudit.status !== "source_ok" ||
    !sourceAudit.glossSupport.meaningSupportsGloss ||
    !tflsj?.quarantined ||
    tflsj.conflictOwner !== expectedOwner
  ) {
    return null;
  }
  const curatedRuleProof = buildCuratedGreekEnglishRuleProof(rule, {
    exactBriefRow: true,
    briefMeaningSupportsGloss: true,
    missingBriefHtmlHeadwordAccepted: true,
    quarantinedTflsjConflictOwner: expectedOwner
  });
  return {
    status: "accepted",
    canonicalSource: "TBESG",
    extendedSource: null,
    quarantinedSources: ["TFLSJ"],
    reasonCodes: [
      "brief-source-accepted",
      "tflsj-supplemental-quarantined-headword-mismatch",
      "curated-auto-validated-exact-brief-retention"
    ],
    curatedRuleProof
  };
}

function buildCuratedGreekEnglishRuleProof(
  rule: CuratedGreekEnglishRepairRule,
  facts: Record<string, string | number | boolean>
): CuratedGreekEnglishRuleProof {
  const withoutDigest = {
    ruleId: rule.ruleId,
    action: rule.action,
    ruleDigest: digestCuratedGreekEnglishRepairRule(rule),
    sourceRecordDigest: rule.expectedSourceRecordDigest,
    sourceMeaningDigest: rule.expectedMeaningDigest,
    facts
  };
  return {
    ...withoutDigest,
    proofDigest: sha256(stableJson(withoutDigest))
  };
}

function digestCuratedGreekEnglishRepairRule(
  rule: CuratedGreekEnglishRepairRule
): string {
  return sha256(stableJson(rule));
}

function digestEnglishSourceRecord(entry: EnglishLexiconEntry): string {
  return sha256(
    stableJson({
      language: entry.language,
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
}

function selectEnglishEvidenceDecision(
  entry: EnglishLexiconEntry,
  brief: SourceEvidence,
  tflsj: SourceEvidence | null,
  sourceAudit: LexiconV3SourceAuditResult,
  context: EnglishEvidenceContext,
  fieldRepairs: readonly EnglishFieldRepairEvidence[],
  reconstruction: EnglishGreekReconstructionEvidence | null,
  semanticGlossAttestation: EnglishSemanticGlossAttestationEvidence | null
): EnglishEvidenceDecision {
  const key = buildLexiconEntryKey(entry.language, entry.dStrong);
  const briefSource = entry.language === "greek" ? "TBESG" : "TBESH";
  const curatedSnapshotMatches = matchesCuratedGreekSourceSnapshot(
    context.sourceDigests
  );
  const briefConflict =
    curatedSnapshotMatches && CONFIRMED_BRIEF_SOURCE_CONFLICTS.has(key);
  const tflsjConflict =
    curatedSnapshotMatches && CONFIRMED_TFLSJ_SOURCE_CONFLICTS.has(key);
  const exactOccurrenceCount = exactOccurrenceCountFor(entry, context);
  const tflsjAudit = sourceAudit.resources.find(
    (resource) => resource.resource.source === "TFLSJ"
  );
  const uncorroboratedCanonicalMorphologicalVariant =
    entry.language === "greek" &&
    !brief.quarantined &&
    brief.headwordMatchesEntry === true &&
    sourceAudit.meaningHeadword.match === "morphological_variant" &&
    !sourceAudit.glossSupport.meaningSupportsGloss &&
    brief.citations.resolvedReferences.length > 0 &&
    brief.citations.targetHits.length === 0 &&
    hasCitedHeadwordOwner(brief) &&
    !brief.headwordMatchesDeclaredRelation &&
    !brief.contentMentionsEntryOriginal;
  // A secondary lemma-family notice can remain useful provenance, but a
  // morphological resemblance with no exact cited STEP hit is not safe input
  // for automatic French translation of this sub-entry.
  const uncorroboratedTflsjMorphologicalVariant =
    entry.language === "greek" &&
    tflsj !== null &&
    tflsjAudit?.headword.match === "morphological_variant" &&
    tflsj.citations.resolvedReferences.length > 0 &&
    tflsj.citations.targetHits.length === 0;

  if (
    reconstruction?.applied &&
    reconstruction.proof.approved &&
    reconstruction.blockers.length === 0
  ) {
    return {
      status: "repaired",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: [
        "greek-reconstruction-approved",
        "raw-step-notice-preserved-as-reconstruction-proof",
        "curated-auto-validated-greek-reconstruction"
      ]
    };
  }

  if (hasCuratedGreekRule(key) && !curatedSnapshotMatches) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: ["curated-greek-source-snapshot-changed"]
    };
  }

  const curatedRepairRule = CURATED_GREEK_ENGLISH_REPAIR_RULES.get(key);
  if (curatedRepairRule) {
    const result = decideCuratedGreekEnglishRepair({
      entry,
      brief,
      tflsj,
      sourceAudit,
      fieldRepairs,
      rule: curatedRepairRule
    });
    if (result) return result;
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: ["curated-greek-repair-evidence-missing"]
    };
  }

  const exactRepairRule = ENGLISH_EXACT_REPAIR_RULES.get(key);
  const semanticGlossRule = ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.get(key);
  if (exactRepairRule) {
    const exactRepairs = fieldRepairs.filter(
      (repair): repair is EnglishExactFieldRepairEvidence =>
        "schemaVersion" in repair
    );
    const semanticProofIssues = semanticGlossRule
      ? validateEnglishSemanticGlossAttestationEnvelope({
          entry,
          evidence: semanticGlossAttestation,
          context: {
            databaseDigest: context.sourceDigests.database,
            sourceDigests: {
              TBESG: context.sourceDigests.TBESG,
              TFLSJ: context.sourceDigests.TFLSJ
            },
            exactOccurrenceCount
          }
        })
      : [];
    const exactRepairProofIsExact =
      exactRepairs.length === exactRepairRule.changes.length &&
      exactRepairs.every((repair) => {
        const expected = exactRepairRule.changes.find(
          (change) => change.field === repair.field
        );
        return Boolean(
          expected &&
          repair.entryKey === key &&
          repair.ruleId === exactRepairRule.ruleId &&
          repair.sourceRecordDigest ===
            exactRepairRule.expectedSourceRecordDigest &&
          repair.sourceValue === expected.sourceValue &&
          repair.repairedValue === expected.repairedValue &&
          entry[repair.field] === expected.repairedValue
        );
      }) &&
      !brief.quarantined &&
      sourceAudit.status === "source_ok";
    const proofIsExact =
      exactRepairProofIsExact && semanticProofIssues.length === 0;
    if (proofIsExact) {
      return {
        status: "repaired",
        canonicalSource: briefSource,
        extendedSource: tflsj && !tflsj.quarantined ? "TFLSJ" : null,
        quarantinedSources: tflsj?.quarantined ? ["TFLSJ"] : [],
        reasonCodes: [
          "brief-source-accepted",
          "exact-source-field-repair",
          "curated-auto-validated-exact-source-field-repair",
          ...(semanticGlossRule
            ? [
                "semantic-gloss-attestation",
                "curated-auto-validated-semantic-gloss-attestation"
              ]
            : []),
          ...(tflsj?.quarantined
            ? ["tflsj-supplemental-quarantined-headword-mismatch"]
            : tflsj
              ? ["tflsj-supplemental"]
              : [])
        ]
      };
    }
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: [
        ...(!exactRepairProofIsExact
          ? ["exact-source-field-repair-evidence-missing"]
          : []),
        ...(semanticGlossRule && semanticProofIssues.length > 0
          ? ["semantic-gloss-attestation-evidence-missing"]
          : []),
        ...semanticProofIssues
      ]
    };
  }

  if (semanticGlossRule) {
    const proofIssues = validateEnglishSemanticGlossAttestationEnvelope({
      entry,
      evidence: semanticGlossAttestation,
      context: {
        databaseDigest: context.sourceDigests.database,
        sourceDigests: {
          TBESG: context.sourceDigests.TBESG,
          TFLSJ: context.sourceDigests.TFLSJ
        },
        exactOccurrenceCount
      }
    });
    const proofIsExact =
      proofIssues.length === 0 &&
      fieldRepairs.length === 0 &&
      !brief.quarantined &&
      sourceAudit.status === "source_ok" &&
      !sourceAudit.glossSupport.meaningSupportsGloss;
    if (proofIsExact) {
      return {
        status: "accepted",
        canonicalSource: briefSource,
        extendedSource: tflsj && !tflsj.quarantined ? "TFLSJ" : null,
        quarantinedSources: tflsj?.quarantined ? ["TFLSJ"] : [],
        reasonCodes: [
          "brief-source-accepted",
          "semantic-gloss-attestation",
          "curated-auto-validated-semantic-gloss-attestation",
          ...(tflsj?.quarantined
            ? ["tflsj-supplemental-quarantined-headword-mismatch"]
            : tflsj
              ? ["tflsj-supplemental"]
              : [])
        ]
      };
    }
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: [
        "semantic-gloss-attestation-evidence-missing",
        ...proofIssues
      ]
    };
  }

  if (
    isUnattestedGreekSupplementalSemanticGap(
      entry,
      sourceAudit,
      exactOccurrenceCount
    )
  ) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: ["supplemental-semantic-gloss-unattested"]
    };
  }

  const missingRequiredFields = [
    !entry.original.trim() ? "original" : null,
    !entry.gloss.trim() ? "gloss" : null,
    !entry.meaning.trim() ? "meaning" : null
  ].filter((field): field is string => field !== null);
  if (missingRequiredFields.length > 0) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: missingRequiredFields.map(
        (field) => `missing-required-source-field:${field}`
      )
    };
  }

  const requiredReview = CURATED_GREEK_REQUIRED_REVIEW_ENTRIES.get(key);
  if (requiredReview) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: requiredReview.retainBrief
        ? tflsj
          ? ["TFLSJ"]
          : []
        : quarantineSources(briefSource, tflsj),
      reasonCodes: [
        requiredReview.reason,
        ...(requiredReview.retainBrief ? ["brief-source-retained"] : [])
      ]
    };
  }

  if (CURATED_AUTO_TFLSJ_BUNDLE_REPAIRS.has(key)) {
    const proofIsExact =
      exactOccurrenceCount > 0 &&
      tflsj !== null &&
      !tflsj.quarantined &&
      tflsjAudit?.headword.match === "exact" &&
      tflsjAudit.headword.originals.length === 1;
    if (proofIsExact) {
      return {
        status: "repaired",
        canonicalSource: "TFLSJ",
        extendedSource: null,
        quarantinedSources: [briefSource],
        reasonCodes: [
          "source-bundle-trim-required",
          "coherent-tflsj-repair",
          "curated-auto-validated-tflsj-repair"
        ]
      };
    }
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: [
        "source-bundle-trim-required",
        "curated-auto-repair-evidence-missing"
      ]
    };
  }

  if (CURATED_BUNDLED_NOTICE_ENTRIES.has(key)) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: ["source-bundle-trim-required"]
    };
  }

  const isolatedReason = CURATED_ISOLATED_SOURCE_ISSUES.get(key);
  if (isolatedReason) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: [isolatedReason]
    };
  }

  // A short shared prefix is not enough to prove that a STEP notice belongs
  // to the same lexeme. When every resolved citation instead points away from
  // the exact entry, a sibling owns the leading headword, and neither the
  // declared relation nor the gloss explains the difference, fail closed.
  if (uncorroboratedCanonicalMorphologicalVariant) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: ["canonical-source-uncorroborated-morphological-variant"]
    };
  }

  if (CURATED_AUTO_TFLSJ_REPAIRS.has(key)) {
    const exactHeadword = tflsjAudit?.headword.match === "exact";
    const explicitFormRepair =
      key === "greek:G4571" &&
      tflsjAudit?.headword.match === "explicit_relation" &&
      tflsj?.headwordMatchesDeclaredRelation === true;
    const occurrenceProof = exactOccurrenceCount > 0 || explicitFormRepair;
    if (
      brief.quarantined &&
      tflsj &&
      !tflsj.quarantined &&
      occurrenceProof &&
      (exactHeadword || explicitFormRepair) &&
      sourceIsCoherent(tflsj)
    ) {
      return {
        status: "repaired",
        canonicalSource: "TFLSJ",
        extendedSource: null,
        quarantinedSources: [briefSource],
        reasonCodes: [
          briefConflict
            ? "confirmed-brief-source-conflict"
            : "inferred-brief-source-conflict",
          "coherent-tflsj-repair",
          "curated-auto-validated-tflsj-repair"
        ]
      };
    }
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: quarantineSources(briefSource, tflsj),
      reasonCodes: ["curated-auto-repair-evidence-missing"]
    };
  }

  if (CURATED_AUTO_BRIEF_RETENTIONS.has(key)) {
    const proofIsExact =
      exactOccurrenceCount > 0 &&
      brief.citations.targetHits.length > 0 &&
      !brief.quarantined &&
      tflsj?.quarantined === true;
    return {
      status: "source-conflict",
      canonicalSource: briefSource,
      extendedSource: null,
      quarantinedSources: tflsj ? ["TFLSJ"] : [],
      reasonCodes: [
        tflsjConflict
          ? "confirmed-tflsj-source-conflict"
          : "inferred-tflsj-source-conflict",
        "brief-source-retained",
        ...(proofIsExact
          ? ["curated-auto-validated-brief-retention"]
          : ["curated-auto-retention-evidence-missing"])
      ]
    };
  }

  if (CURATED_AUTO_TFLSJ_SUPPLEMENTAL_QUARANTINES.has(key)) {
    const proofIsExact =
      exactOccurrenceCount > 0 &&
      brief.citations.targetHits.length > 0 &&
      !brief.quarantined &&
      tflsj?.quarantined === true &&
      sourceAudit.status === "source_ok";
    if (!proofIsExact) {
      return {
        status: "quarantined",
        canonicalSource: null,
        extendedSource: null,
        quarantinedSources: quarantineSources(briefSource, tflsj),
        reasonCodes: [
          "tflsj-supplemental-headword-conflict",
          "curated-auto-supplemental-quarantine-evidence-missing"
        ]
      };
    }
    return {
      status: "accepted",
      canonicalSource: briefSource,
      extendedSource: null,
      quarantinedSources: ["TFLSJ"],
      reasonCodes: [
        "brief-source-accepted",
        "tflsj-supplemental-quarantined-headword-mismatch",
        "curated-auto-validated-supplemental-quarantine"
      ]
    };
  }

  if (brief.quarantined && !CURATED_SOURCE_VARIANT_ENTRIES.has(key)) {
    const repairHeadwordMatch = tflsjAudit?.headword.match;
    if (
      tflsj &&
      !tflsj.quarantined &&
      sourceIsCoherent(tflsj) &&
      (repairHeadwordMatch === "exact" ||
        repairHeadwordMatch === "explicit_relation")
    ) {
      return {
        status: "repaired",
        canonicalSource: "TFLSJ",
        extendedSource: null,
        quarantinedSources: [briefSource],
        reasonCodes: [
          briefConflict
            ? "confirmed-brief-source-conflict"
            : "inferred-brief-source-conflict",
          "coherent-tflsj-repair"
        ]
      };
    }
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: [briefSource],
      reasonCodes: [
        briefConflict
          ? "confirmed-brief-source-conflict"
          : "inferred-brief-source-conflict",
        "no-safe-repair-source"
      ]
    };
  }

  if (tflsj?.quarantined) {
    return {
      status: "source-conflict",
      canonicalSource: briefSource,
      extendedSource: null,
      quarantinedSources: ["TFLSJ"],
      reasonCodes: [
        tflsjConflict
          ? "confirmed-tflsj-source-conflict"
          : "inferred-tflsj-source-conflict",
        "brief-source-retained"
      ]
    };
  }

  if (CURATED_AUTO_SOURCE_VARIANTS.has(key)) {
    const proofIsExact =
      exactOccurrenceCount > 0 &&
      brief.citations.targetHits.length > 0 &&
      tflsj !== null &&
      !tflsj.quarantined &&
      tflsjAudit?.headword.match === "exact";
    if (!proofIsExact) {
      return {
        status: "quarantined",
        canonicalSource: null,
        extendedSource: null,
        quarantinedSources: quarantineSources(briefSource, tflsj),
        reasonCodes: ["curated-auto-variant-evidence-missing"]
      };
    }
    return {
      status: "accepted",
      canonicalSource: briefSource,
      extendedSource: "TFLSJ",
      quarantinedSources: [],
      reasonCodes: [
        "brief-source-accepted",
        "curated-source-variant",
        "tflsj-supplemental",
        "curated-auto-validated-source-variant"
      ]
    };
  }

  if (
    sourceAudit.status !== "source_ok" &&
    !CURATED_SOURCE_VARIANT_ENTRIES.has(key)
  ) {
    return {
      status: "quarantined",
      canonicalSource: null,
      extendedSource: null,
      quarantinedSources: [briefSource],
      reasonCodes: [`unresolved-source-audit:${sourceAudit.status}`]
    };
  }

  const quarantineMismatchedSupplement = sourceAudit.findings.some(
    (finding) => finding.code === "resource-headword-mismatch"
  );
  const quarantineTflsjSupplement =
    quarantineMismatchedSupplement || uncorroboratedTflsjMorphologicalVariant;
  return {
    status: "accepted",
    canonicalSource: briefSource,
    extendedSource: tflsj && !quarantineTflsjSupplement ? "TFLSJ" : null,
    quarantinedSources: tflsj && quarantineTflsjSupplement ? ["TFLSJ"] : [],
    reasonCodes: [
      "brief-source-accepted",
      ...(CURATED_SOURCE_VARIANT_ENTRIES.has(key)
        ? ["curated-source-variant"]
        : []),
      ...(tflsj && quarantineMismatchedSupplement
        ? ["tflsj-supplemental-quarantined-headword-mismatch"]
        : tflsj && uncorroboratedTflsjMorphologicalVariant
          ? [
              "tflsj-supplemental-quarantined-uncorroborated-morphological-variant"
            ]
          : tflsj
            ? ["tflsj-supplemental"]
            : [])
    ]
  };
}

function isUnattestedGreekSupplementalSemanticGap(
  entry: EnglishLexiconEntry,
  sourceAudit: LexiconV3SourceAuditResult,
  exactOccurrenceCount: number
): boolean {
  if (entry.language !== "greek" || exactOccurrenceCount !== 0) return false;
  const match = /^G(\d+)(?:[A-Z])?$/u.exec(entry.eStrong.trim());
  return (
    match !== null &&
    Number.parseInt(match[1]!, 10) >= 20_000 &&
    !sourceAudit.glossSupport.meaningSupportsGloss
  );
}

function hasCuratedGreekRule(key: string): boolean {
  return (
    CONFIRMED_BRIEF_SOURCE_CONFLICTS.has(key) ||
    CONFIRMED_TFLSJ_SOURCE_CONFLICTS.has(key) ||
    CURATED_SOURCE_VARIANT_ENTRIES.has(key) ||
    CURATED_BUNDLED_NOTICE_ENTRIES.has(key) ||
    CURATED_ISOLATED_SOURCE_ISSUES.has(key) ||
    CURATED_AUTO_TFLSJ_REPAIRS.has(key) ||
    CURATED_AUTO_BRIEF_RETENTIONS.has(key) ||
    CURATED_AUTO_TFLSJ_BUNDLE_REPAIRS.has(key) ||
    CURATED_AUTO_SOURCE_VARIANTS.has(key) ||
    CURATED_AUTO_TFLSJ_SUPPLEMENTAL_QUARANTINES.has(key) ||
    CURATED_GREEK_ENGLISH_REPAIR_RULES.has(key) ||
    CURATED_GREEK_REQUIRED_REVIEW_ENTRIES.has(key)
  );
}

function matchesCuratedGreekSourceSnapshot(
  digests: EnglishEvidenceSourceDigests
): boolean {
  return (
    digests.TBESG === CURATED_SOURCE_SNAPSHOT_DIGESTS.TBESG &&
    digests.TFLSJ === CURATED_SOURCE_SNAPSHOT_DIGESTS.TFLSJ &&
    exactDigestRecordMatches(
      digests.TAGNT,
      CURATED_SOURCE_SNAPSHOT_DIGESTS.TAGNT
    )
  );
}

function exactDigestRecordMatches(
  actual: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>
): boolean {
  const actualEntries = Object.entries(actual).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const expectedEntries = Object.entries(expected).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return stableJson(actualEntries) === stableJson(expectedEntries);
}

function exactOccurrenceCountFor(
  entry: EnglishLexiconEntry,
  context: EnglishEvidenceContext
): number {
  const stepStrong = normalizeStrong(
    extractPrimaryDStrong(entry.dStrong) ?? entry.eStrong
  );
  return context.exactStepStrongOccurrences.get(stepStrong) ?? 0;
}

function quarantineSources(
  briefSource: "TBESG" | "TBESH",
  tflsj: SourceEvidence | null
): Array<"TBESG" | "TBESH" | "TFLSJ"> {
  return tflsj ? [briefSource, "TFLSJ"] : [briefSource];
}

function inferCrossEntryConflictOwner(
  headwordMatchesEntry: boolean | null,
  headwordOwnerKeys: string[],
  citations: CitationEvidence,
  mismatchIsExplained: boolean
): string | null {
  if (headwordMatchesEntry !== false) return null;
  if (mismatchIsExplained) return null;
  if (citations.resolvedReferences.length === 0) return null;
  if (citations.targetHits.length > 0) return null;

  const threshold = Math.max(
    1,
    Math.ceil(citations.resolvedReferences.length * 0.6)
  );
  let best: { code: string; count: number } | null = null;
  for (const key of headwordOwnerKeys) {
    const code = key.split(":")[1] ?? "";
    const count = citations.otherStrongHits[code]?.length ?? 0;
    if (count < threshold) continue;
    if (
      !best ||
      count > best.count ||
      (count === best.count && code < best.code)
    ) {
      best = { code, count };
    }
  }
  return best?.code ?? null;
}

function sourceIsCoherent(source: SourceEvidence): boolean {
  if (
    source.headwordMatchesEntry === false &&
    !source.headwordMatchesDeclaredRelation &&
    !source.contentMentionsEntryOriginal
  ) {
    return false;
  }
  if (
    source.headwordMatchesDeclaredRelation ||
    source.contentMentionsEntryOriginal
  ) {
    return true;
  }
  if (source.citations.resolvedReferences.length === 0) return true;
  return source.citations.targetHits.length > 0;
}

function hasCitedHeadwordOwner(source: SourceEvidence): boolean {
  return source.headwordOwnerKeys.some((ownerKey) => {
    const ownerStrong = ownerKey.split(":")[1];
    return Boolean(
      ownerStrong && source.citations.otherStrongHits[ownerStrong]?.length
    );
  });
}

function extractDeclaredRelatedStrongCodes(
  entry: Pick<EnglishLexiconEntry, "dStrong" | "eStrong" | "uStrong">
): string[] {
  const relation = entry.dStrong.split("=").slice(1).join("=").trim();
  if (!/^a\s+.+\s+of$/iu.test(relation)) return [];

  const ownCodes = new Set(
    [extractPrimaryDStrong(entry.dStrong), entry.eStrong]
      .filter((value): value is string => Boolean(value))
      .map(normalizeStrong)
  );
  return [
    ...new Set(
      [...entry.uStrong.matchAll(/[GH]\d{1,5}[A-Z]?/giu)]
        .map((match) => normalizeStrong(match[0]))
        .filter((code) => !ownCodes.has(code))
    )
  ].sort();
}

function sourceContentMentionsEntryOriginal(
  content: string,
  entry: EnglishLexiconEntry
): boolean {
  const scriptPattern =
    entry.language === "greek"
      ? /\p{Script=Greek}[\p{Script=Greek}\p{M}]*/gu
      : /\p{Script=Hebrew}[\p{Script=Hebrew}\p{M}]*/gu;
  const text = htmlToText(content);
  const originalTokens = new Set(
    (entry.original.match(scriptPattern) ?? [])
      .map((token) => normalizeLexiconHeadword(token, entry.language))
      .filter((token) => token.length >= 2)
  );
  if (originalTokens.size === 0) return false;

  for (const match of text.matchAll(scriptPattern)) {
    const token = normalizeLexiconHeadword(match[0], entry.language);
    if (!originalTokens.has(token)) continue;
    const index = match.index ?? 0;
    const relationWindow = text.slice(Math.max(0, index - 96), index);
    if (hasStructuredFormRelationCue(relationWindow)) return true;
  }
  return false;
}

function hasStructuredFormRelationCue(value: string): boolean {
  return /(?:\balso\b|\binclud(?:e|es|ed|ing)\b|\bforms?\b|\bgen(?:itive)?\.?\b|\bacc(?:usative)?\.?\b|\bdat(?:ive)?\.?\b|\bnom(?:inative)?\.?\b|\bvoc(?:ative)?\.?\b|\bplural\b|\bsingular\b|\bcompar(?:ative)?\.?\b|\bsuperl(?:ative)?\.?\b|\baor(?:ist)?\.?\b|\bperf(?:ect)?\.?\b|\bpass(?:ive)?\.?\b|\bmid(?:dle)?\.?\b|\bvariant\b|\bspelling\b|\bcontracted\b|\bRec\.?\b|\bread(?:s|ing)?\b)[^.;:]{0,64}$/iu.test(
    value
  );
}

function splitOriginalHeadwords(value: string): string[] {
  return value
    .split(/[,;]/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeStrong(value: string): string {
  const match = value.match(/([GH])0*(\d{1,5})([A-Za-z]?)/iu);
  if (!match) return value;
  return `${match[1]?.toUpperCase()}${(match[2] ?? "").padStart(4, "0")}${match[3] ?? ""}`;
}

function normalizeClassicalStrongCode(value: string): string {
  const normalized = normalizeStrong(value);
  const match = normalized.match(/^([GH]\d{4,5})/u);
  return match?.[1] ?? normalized;
}

function htmlToText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function canonicalExactOccurrenceGlosses(
  occurrences: readonly EnglishExactOccurrenceGlossEvidence[]
): EnglishExactOccurrenceGlossEvidence[] {
  return [...occurrences].sort(
    (left, right) =>
      left.locator.localeCompare(right.locator) ||
      left.digest.localeCompare(right.digest)
  );
}

function canonicalAlternateStrongAliasOccurrences(
  occurrences: readonly EnglishAlternateStrongAliasOccurrenceEvidence[]
): EnglishAlternateStrongAliasOccurrenceEvidence[] {
  return [...occurrences].sort(
    (left, right) =>
      left.locator.localeCompare(right.locator) ||
      left.digest.localeCompare(right.digest)
  );
}

function countStrings(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function canonicalRecord<T>(
  value: Readonly<Record<string, T>>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringRecord(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  if (
    !record ||
    Object.values(record).some((item) => typeof item !== "string")
  ) {
    return null;
  }
  return record as Record<string, string>;
}

function asNullableStringRecord(
  value: unknown
): Record<string, string | null> | null {
  const record = asRecord(value);
  if (
    !record ||
    Object.values(record).some(
      (item) => item !== null && typeof item !== "string"
    )
  ) {
    return null;
  }
  return record as Record<string, string | null>;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getOrInsert<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = factory();
  map.set(key, created);
  return created;
}
