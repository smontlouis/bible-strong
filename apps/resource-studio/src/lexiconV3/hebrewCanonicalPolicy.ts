import { createHash } from "node:crypto";

import {
  OPEN_SCRIPTURES_HEBREW_FILES,
  OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
  STEP_BIBLE_ENTITY_SOURCE_DIGESTS,
  type HebrewEnglishCandidate,
  type HebrewEnglishCandidateStatus,
  type HebrewEnglishSourceAttestation
} from "./hebrewEnglish.js";
import {
  HEBREW_GLOSS_RESIDUAL_AUDIT,
  HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS,
  HEBREW_GLOSS_RESIDUAL_SOURCE_ARTIFACT
} from "./hebrewGlossResidualAudit.js";
import {
  HEBREW_MEANING_RESIDUAL_AUDIT,
  HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS
} from "./hebrewMeaningResidualAudit.js";
import type { StepDirectAuditIdentityInput } from "./stepDirectProof.js";
import type { TbeshMeaningSections } from "./tbeshMeaning.js";
import type { TbeshPublicationLedgerCategory } from "./tbeshPublication.js";

export const HEBREW_CANONICAL_GLOSS_POLICY_ID =
  "hebrew-canonical-gloss-policy@1" as const;
export const HEBREW_CANONICAL_MEANING_POLICY_ID =
  "hebrew-canonical-meaning-policy@1" as const;
export const HEBREW_CANONICAL_REVIEWED_CORPUS_DIGEST =
  "abe674425fd0f65c69b8c3df043037c8707dca4ffde07a495e0139e8b79b6def" as const;

/**
 * Two independent semantic passes classified these exact STEP/OpenScriptures
 * gloss divergences as safe lexical-definition corrections. The source value
 * is still read from the authenticated candidate and pinned LexicalIndex
 * record; membership in this ledger alone can never publish a value.
 */
export const DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS = [
  "H0101",
  "H0182",
  "H0193A",
  "H0193B",
  "H0217B",
  "H0327",
  "H0331",
  "H0361",
  "H0489",
  "H0510",
  "H0535",
  "H0591",
  "H0651",
  "H0668",
  "H0698",
  "H0729",
  "H0829",
  "H0973A",
  "H0973B",
  "H1059",
  "H1073",
  "H1169",
  "H1208",
  "H1244",
  "H1264",
  "H1361",
  "H1639",
  "H1687",
  "H1729",
  "H1751",
  "H1848",
  "H2328",
  "H2352",
  "H2471",
  "H2489",
  "H2541",
  "H2556A",
  "H2560A",
  "H2785",
  "H2836B",
  "H2859B",
  "H2917",
  "H3022",
  "H3280",
  "H3415",
  "H3561",
  "H3698",
  "H3739B",
  "H3938",
  "H3963",
  "H4178",
  "H4211",
  "H4499",
  "H4517",
  "H4530",
  "H4541A",
  "H4545",
  "H4580",
  "H4615",
  "H4656",
  "H4694",
  "H4712",
  "H4729",
  "H4747",
  "H4749",
  "H4934",
  "H4942",
  "H4988",
  "H5132B",
  "H5354",
  "H5407",
  "H5427",
  "H5433B",
  "H5502",
  "H5533B",
  "H5596B",
  "H5666",
  "H5692",
  "H5708",
  "H5848B",
  "H5848C",
  "H5922",
  "H5953C",
  "H5959",
  "H5979",
  "H6006",
  "H6014B",
  "H6033",
  "H6120",
  "H6154B",
  "H6154M",
  "H6302",
  "H6320",
  "H6335B",
  "H6424",
  "H6569",
  "H6598",
  "H6615",
  "H6642",
  "H6656",
  "H6742",
  "H6767D",
  "H6774",
  "H6807B",
  "H6808",
  "H6836",
  "H6877",
  "H6928",
  "H6962",
  "H7087B",
  "H7100",
  "H7148",
  "H7165",
  "H7232",
  "H7329",
  "H7419",
  "H7551",
  "H7684",
  "H7690",
  "H7717",
  "H7823",
  "H7829",
  "H7872",
  "H7921C",
  "H7947",
  "H7948",
  "H7955",
  "H7997A",
  "H8231",
  "H8388A",
  "H8498",
  "H8594"
] as const;

export interface ExactTipnrGlossLedgerRecord {
  entityId: number;
  value: string;
}

export const EXACT_TIPNR_GLOSS_LEDGER = {
  H0671B: { entityId: 4139, value: "governors" },
  H1181: { entityId: 3245, value: "heights" },
  H1273: { entityId: 3241, value: "Barhumite" },
  H2072: { entityId: 2925, value: "Zabbud" },
  H2680: { entityId: 1908, value: "half the Manahathites" },
  H3669G: { entityId: 590, value: "Canaanite woman" },
  H3866G: { entityId: 1814, value: "Ludim" },
  H6062: { entityId: 243, value: "Anakim" },
  H7759: { entityId: 2729, value: "Shulammite" },
  H7767: { entityId: 2731, value: "Shunammite" }
} as const satisfies Record<string, ExactTipnrGlossLedgerRecord>;

/**
 * These cases require a third semantic arbitration. This includes the five
 * source-definition proposals that did not receive the same double audit.
 */
export const HEBREW_GLOSS_ARBITRATION_KEYS = [
  "H0122B",
  "H0432",
  "H0576A",
  "H0576B",
  "H0761I",
  "H0924",
  "H1276",
  "H1389J",
  "H1524B",
  "H1761",
  "H1772",
  "H2050",
  "H2215",
  "H2495",
  "H2654B",
  "H2791B",
  "H2933",
  "H3066G",
  "H3491",
  "H3651B",
  "H4154",
  "H4360",
  "H4441J",
  "H4473",
  "H4535",
  "H5289",
  "H5539",
  "H5822",
  "H5921B",
  "H6169",
  "H6289",
  "H6862D",
  "H7192",
  "H7258",
  "H7315",
  "H7846",
  "H7934",
  "H7944",
  "H8385A",
  "H8448",
  "H8497",
  "H8530",
  "H8618"
] as const;

const REVIEWED_LEXICAL_KEYS = new Set<string>(
  DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS
);
const SECOND_PASS_CORRECTION_KEYS = new Set(["H3963", "H6120"]);
const ARBITRATION_KEYS = new Set<string>(HEBREW_GLOSS_ARBITRATION_KEYS);
type HebrewGlossResidualAuditRecord =
  (typeof HEBREW_GLOSS_RESIDUAL_AUDIT.records)[number];
const RESIDUAL_GLOSS_RECORDS = new Map<string, HebrewGlossResidualAuditRecord>(
  HEBREW_GLOSS_RESIDUAL_AUDIT.records.map((record) => [record.key, record])
);
const {
  registryDigest: GLOSS_RESIDUAL_RECORDED_DIGEST,
  ...GLOSS_RESIDUAL_AUDIT_PAYLOAD
} = HEBREW_GLOSS_RESIDUAL_AUDIT;
export const HEBREW_GLOSS_RESIDUAL_HISTORICAL_DIGEST = sha256(
  JSON.stringify(GLOSS_RESIDUAL_AUDIT_PAYLOAD)
);
export const HEBREW_GLOSS_RESIDUAL_CANONICAL_DIGEST = sha256(
  canonicalJson(GLOSS_RESIDUAL_AUDIT_PAYLOAD)
);
const EXPECTED_GLOSS_RESIDUAL_CANONICAL_DIGEST =
  "49013208d2e47fe86a7d86ccfd233158d2a7609da206f94995103288302ec58d";

type HebrewMeaningResidualAuditRecord =
  (typeof HEBREW_MEANING_RESIDUAL_AUDIT.records)[number];
const RESIDUAL_MEANING_RECORDS = new Map<
  string,
  HebrewMeaningResidualAuditRecord
>(HEBREW_MEANING_RESIDUAL_AUDIT.records.map((record) => [record.key, record]));
const {
  registryDigest: MEANING_RESIDUAL_RECORDED_DIGEST,
  ...MEANING_RESIDUAL_AUDIT_PAYLOAD
} = HEBREW_MEANING_RESIDUAL_AUDIT;
export const HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST = sha256(
  canonicalJson(MEANING_RESIDUAL_AUDIT_PAYLOAD)
);
const EXPECTED_MEANING_RESIDUAL_CANONICAL_DIGEST =
  "f088e435398d2ee86b55d7a4fe65b5047596470125b6bfeebcec81fadd956c75";

export function isHebrewGlossResidualAuditKey(primaryDStrong: string): boolean {
  return RESIDUAL_GLOSS_RECORDS.has(primaryDStrong);
}

export function isHebrewMeaningResidualAuditKey(
  primaryDStrong: string
): boolean {
  return RESIDUAL_MEANING_RECORDS.has(primaryDStrong);
}

export type HebrewCanonicalGlossAction =
  | "keep_step"
  | "replace_lexical_definition"
  | "replace_tipnr_alias"
  | "residual_keep_step"
  | "residual_replace_source_value"
  | "residual_editorial_reconstruction"
  | "third_arbitration"
  | "blocked";

export interface HebrewCanonicalGlossProof {
  policy: {
    id: typeof HEBREW_CANONICAL_GLOSS_POLICY_ID;
    digest: string;
  };
  proven: boolean;
  /** True only when this proof authorizes the selected gloss for publication. */
  publicationApproved: boolean;
  action: HebrewCanonicalGlossAction;
  value: string;
  confidence: number;
  reasonCodes: string[];
  facts: Record<string, boolean>;
  source: {
    family:
      | "STEP-TBESH"
      | "OpenScriptures-LexicalIndex"
      | "STEPBible-TIPNR"
      | "Lexicon-V3-Hebrew-Adjudication";
    recordId: string;
    recordDigest: string;
    candidateRecordDigest: string;
  };
  reviewLedger: {
    pass1: string;
    pass2: string;
    finalAction: string;
    policyIds: [string, string, string];
    stepValueDigest: string;
    sourceValueDigest: string;
    reason: string;
    registryRecordDigest?: string;
  } | null;
  digests: {
    policy: string;
    ledger: string;
    content: string;
    proof: string;
  };
}

export interface ProveHebrewCanonicalGlossInput extends StepDirectAuditIdentityInput {
  stepGloss: string;
  auditGloss: string;
  selectedGloss: string;
  meaningSupportsGloss: boolean;
  candidate: HebrewEnglishCandidate;
  candidateCorpusDigest: string;
  tbeshSourceDigest: string;
  tahotSourceDigests: Readonly<Record<string, string>>;
  exactOccurrenceCount: number;
  exactOccurrenceCorpusDigest: string;
  tahotGlossProofProven: boolean;
  strictGlossProofProven: boolean;
  technicalMarkerProofProven: boolean;
}

export function proveHebrewCanonicalGloss(
  input: ProveHebrewCanonicalGlossInput
): HebrewCanonicalGlossProof {
  const primary = input.primaryDStrong;
  const candidate = input.candidate;
  const assessment = candidate.fieldAssessments.gloss;
  const issueCodes = uniqueSorted(assessment.issueCodes);
  const arbitration = ARBITRATION_KEYS.has(primary);
  const residualAudit = RESIDUAL_GLOSS_RECORDS.get(primary);
  const lexicalLedger = REVIEWED_LEXICAL_KEYS.has(primary);
  const tipnrLedger =
    EXACT_TIPNR_GLOSS_LEDGER[primary as keyof typeof EXACT_TIPNR_GLOSS_LEDGER];
  const exactAudit = exactAuditIdentity(input);
  const stepGloss = input.stepGloss.trim();
  const classicalLexical = candidate.mapping.sourceIdentity.classicalLexical;
  const augmentedLexical = candidate.mapping.sourceIdentity.augmentedLexical;
  const lexicalIndexId =
    classicalLexical?.lexicalIndexId ?? augmentedLexical?.lexicalIndexId ?? "";
  const lexicalDefinition = extractExactLexicalDefinition(
    candidate.english.meaningHtml
  );
  const lexicalAttestation = lexicalIndexId
    ? findAttestation(candidate, "OpenScriptures-LexicalIndex", lexicalIndexId)
    : null;
  const tipnr = candidate.mapping.sourceIdentity.tipnr;
  const tipnrAttestation = tipnr?.entityId
    ? findAttestation(
        candidate,
        "STEPBible-TIPNR",
        `${primary}:entity:${tipnr.entityId}`
      )
    : null;
  const commonFacts = {
    auditDigestValid: isSha256(input.auditRecordDigest),
    auditAccepted: ["accepted", "repaired"].includes(input.auditDecisionStatus),
    canonicalTbeshSource: input.auditCanonicalSource === "TBESH",
    sourceAuditAccepted:
      input.sourceAuditStatus === "source_ok" &&
      input.sourceAuditRequiresReview === false,
    stepPrimarySelected:
      input.sourceSelectionStrategy === "step_primary" &&
      input.sourceSelectionSource === "STEP" &&
      input.sourceSelectionKind === "brief" &&
      input.sourceSelectionAutomatic === true,
    identityExact: exactAudit,
    candidateIdentityExact:
      candidate.entryKey === input.entryKey &&
      candidate.identity.stepEntryId === input.stepEntryId &&
      normalizeHebrewStrongIdentity(
        candidate.mapping.sourceIdentity.primaryDStrong
      ) === normalizeHebrewStrongIdentity(primary),
    stepGlossExact:
      Boolean(stepGloss) &&
      stepGloss === input.auditGloss.trim() &&
      stepGloss === input.selectedGloss.trim() &&
      stepGloss === candidate.english.gloss.trim(),
    candidateDigestValid: isSha256(candidate.recordDigest),
    reviewedCandidateCorpusExact:
      input.candidateCorpusDigest === HEBREW_CANONICAL_REVIEWED_CORPUS_DIGEST,
    reviewedTbeshSourceExact:
      input.tbeshSourceDigest === HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.tbesh,
    reviewedTahotSourcesExact:
      canonicalJson(input.tahotSourceDigests) ===
      canonicalJson(HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.tahot),
    noTechnicalOverride: input.technicalMarkerProofProven === false
  };

  let action: HebrewCanonicalGlossAction;
  let value = stepGloss;
  let sourceFamily: HebrewCanonicalGlossProof["source"]["family"] =
    "STEP-TBESH";
  let sourceRecordId = String(input.stepEntryId);
  let sourceRecordDigest =
    findAttestation(candidate, "STEP-gloss-anchor", String(input.stepEntryId))
      ?.contentDigest ?? "";
  let actionFacts: Record<string, boolean>;

  if (residualAudit) {
    action =
      residualAudit.decision.finalAction === "keep_step"
        ? "residual_keep_step"
        : residualAudit.decision.finalAction === "replace_source_value"
          ? "residual_replace_source_value"
          : "residual_editorial_reconstruction";
    value = residualAudit.decision.value;
    sourceFamily = "Lexicon-V3-Hebrew-Adjudication";
    sourceRecordId = `gloss-residual:${primary}`;
    sourceRecordDigest = sha256(canonicalJson(residualAudit));
    const exactAttestations = Object.entries(
      residualAudit.exactSourceAttestations as Readonly<Record<string, string>>
    );
    const candidateAttestations = new Map(
      candidate.provenance.map((attestation) => [
        `${attestation.source}:${attestation.recordId}`,
        attestation.contentDigest
      ])
    );
    actionFacts = {
      residualRegistryRecordedDigestExact:
        HEBREW_GLOSS_RESIDUAL_HISTORICAL_DIGEST ===
        GLOSS_RESIDUAL_RECORDED_DIGEST,
      residualRegistryCanonicalDigestExact:
        HEBREW_GLOSS_RESIDUAL_CANONICAL_DIGEST ===
        EXPECTED_GLOSS_RESIDUAL_CANONICAL_DIGEST,
      residualAuditPassesDistinct:
        new Set(Object.values(HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS)).size === 3,
      residualIdentityExact:
        residualAudit.identity.stepEntryId === input.stepEntryId &&
        residualAudit.identity.dStrong === input.dStrong &&
        residualAudit.identity.uStrong === input.uStrong,
      residualStepValueExact:
        residualAudit.input.stepGloss === stepGloss &&
        residualAudit.input.stepGlossDigest === sha256(stepGloss),
      residualCandidateRecordExact:
        residualAudit.input.candidateRecordDigest === candidate.recordDigest,
      residualStepAnchorExact:
        residualAudit.input.stepAnchorDigest ===
        candidateAttestations.get(`STEP-gloss-anchor:${input.stepEntryId}`),
      residualSourceAttestationsExact:
        exactAttestations.length > 0 &&
        exactAttestations.every(
          ([recordId, digest]) => candidateAttestations.get(recordId) === digest
        ),
      residualOccurrenceCorpusExact:
        residualAudit.occurrenceProof.count === input.exactOccurrenceCount &&
        residualAudit.occurrenceProof.occurrenceCorpusDigest ===
          input.exactOccurrenceCorpusDigest,
      residualDecisionValueExact:
        Boolean(value.trim()) &&
        residualAudit.decision.valueDigest === sha256(value),
      residualOpenScripturesRevisionExact:
        HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.openScripturesCommit ===
        OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
      residualOpenScripturesSourcesExact: Object.entries(
        HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.openScriptures
      ).every(
        ([fileName, digest]) =>
          OPEN_SCRIPTURES_HEBREW_FILES[
            fileName as keyof typeof OPEN_SCRIPTURES_HEBREW_FILES
          ]?.sha256 === digest
      ),
      residualTipnrSourceExact:
        HEBREW_GLOSS_RESIDUAL_AUDIT.sourcePins.tipnr ===
        STEP_BIBLE_ENTITY_SOURCE_DIGESTS["TIPNR.txt"]
    };
  } else if (arbitration) {
    action = "third_arbitration";
    actionFacts = { explicitlyRequiresThirdArbitration: true };
  } else if (lexicalLedger) {
    action = "replace_lexical_definition";
    value = lexicalDefinition;
    sourceFamily = "OpenScriptures-LexicalIndex";
    sourceRecordId = lexicalIndexId;
    sourceRecordDigest = lexicalAttestation?.contentDigest ?? "";
    actionFacts = {
      doubleAuditLedgerExact: true,
      mismatchIssueExact:
        issueCodes.length === 1 &&
        issueCodes[0] === "step-gloss-open-definition-mismatch",
      exactLexicalIdentity: classicalLexical
        ? classicalLexical.matchCount === 1 &&
          classicalLexical.originalFormExact &&
          classicalLexical.partOfSpeechExact &&
          candidate.mapping.lexicalIndexIds.length === 1 &&
          candidate.mapping.lexicalIndexIds[0] ===
            classicalLexical.lexicalIndexId
        : Boolean(
            augmentedLexical &&
            augmentedLexical.mappingUnique &&
            augmentedLexical.originalFormExact &&
            augmentedLexical.partOfSpeechExact &&
            candidate.mapping.augmentedStrong ===
              augmentedLexical.augmentedStrong &&
            candidate.mapping.augmentedLexicalIndexId ===
              augmentedLexical.lexicalIndexId &&
            candidate.mapping.lexicalIndexIds.length === 1 &&
            candidate.mapping.lexicalIndexIds[0] ===
              augmentedLexical.lexicalIndexId
          ),
      exactDefinitionPresent: Boolean(lexicalDefinition.trim()),
      exactLexicalAttestation: Boolean(
        lexicalAttestation && isSha256(lexicalAttestation.contentDigest)
      ),
      pinnedLexicalSource:
        OPEN_SCRIPTURES_HEBREW_FILES["LexicalIndex.xml"].sha256 ===
        "8f7a605c58899d2f44430149c143c00903976e1e91232476677972a69e5bc85f",
      noStepMeaningSupport: input.meaningSupportsGloss === false,
      noTahotGlossSupport: input.tahotGlossProofProven === false,
      noEarlierStrictProof: input.strictGlossProofProven === false
    };
  } else if (tipnrLedger) {
    action = "replace_tipnr_alias";
    value = tipnrLedger.value;
    sourceFamily = "STEPBible-TIPNR";
    sourceRecordId = `${primary}:entity:${tipnrLedger.entityId}`;
    sourceRecordDigest = tipnrAttestation?.contentDigest ?? "";
    actionFacts = {
      exactAliasLedger: true,
      mismatchIssueExact:
        issueCodes.length === 1 &&
        issueCodes[0] === "tipnr-gloss-alias-mismatch",
      exactTipnrIdentity: Boolean(
        tipnr && tipnr.entityUnique && tipnr.entityId === tipnrLedger.entityId
      ),
      exactTipnrAttestation: Boolean(
        tipnrAttestation && isSha256(tipnrAttestation.contentDigest)
      ),
      aliasHasContent: Boolean(value.trim()),
      noStepMeaningSupport: input.meaningSupportsGloss === false,
      noTahotGlossSupport: input.tahotGlossProofProven === false,
      noEarlierStrictProof: input.strictGlossProofProven === false
    };
  } else if (isRecognizedSourcePriorityReview(issueCodes)) {
    action = "keep_step";
    actionFacts = {
      sourcePriorityClassificationExact: true,
      noPositiveReplacementLedger: true,
      noThirdArbitrationLedger: true,
      stepValueHasContent: Boolean(stepGloss)
    };
  } else {
    action = "blocked";
    actionFacts = { unsupportedClassificationBlocked: true };
  }

  const facts = { ...commonFacts, ...actionFacts };
  const failedFacts = Object.entries(facts)
    .filter(([, proven]) => !proven)
    .map(([name]) => `hebrew-canonical-gloss-fact-failed:${name}`);
  const proven = failedFacts.length === 0;
  const publicationApproved =
    proven &&
    [
      "keep_step",
      "replace_lexical_definition",
      "replace_tipnr_alias",
      "residual_keep_step",
      "residual_replace_source_value",
      "residual_editorial_reconstruction"
    ].includes(action);
  const reasonCodes = proven
    ? [`hebrew-canonical-gloss:${action}`]
    : uniqueSorted(failedFacts);
  const ledgerDigest = GLOSS_LEDGER_DIGEST;
  const contentDigest = sha256(
    canonicalJson({
      action,
      value,
      sourceFamily,
      sourceRecordId,
      sourceRecordDigest,
      candidateRecordDigest: candidate.recordDigest,
      issueCodes
    })
  );
  const reviewLedger = residualAudit
    ? {
        pass1: HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS.sourceAudit,
        pass2: HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS.counterAudit,
        finalAction: residualAudit.decision.finalAction,
        policyIds: [
          HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS.sourceAudit,
          HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS.counterAudit,
          HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS.finalAdjudication
        ] as [string, string, string],
        stepValueDigest: residualAudit.input.stepGlossDigest,
        sourceValueDigest: residualAudit.decision.valueDigest,
        reason: residualAudit.decision.reason,
        registryRecordDigest: sourceRecordDigest
      }
    : action === "replace_lexical_definition"
      ? {
          pass1: SECOND_PASS_CORRECTION_KEYS.has(primary)
            ? ("keep_step" as const)
            : ("replace_lexical_definition" as const),
          pass2: "replace_lexical_definition" as const,
          finalAction: "replace_lexical_definition" as const,
          policyIds: [
            "hebrew-gloss-semantic-pass1@1",
            "hebrew-gloss-semantic-counteraudit@1",
            HEBREW_CANONICAL_GLOSS_POLICY_ID
          ] as [string, string, string],
          stepValueDigest: sha256(stepGloss),
          sourceValueDigest: sha256(value),
          reason: SECOND_PASS_CORRECTION_KEYS.has(primary)
            ? "Counter-audit corrected the first classification; final adjudication accepted the exact pinned definition."
            : "Both semantic passes accepted the exact pinned lexical definition."
        }
      : null;
  const payload = {
    policy: {
      id: HEBREW_CANONICAL_GLOSS_POLICY_ID,
      digest: GLOSS_POLICY_DIGEST
    },
    proven,
    publicationApproved,
    action,
    value,
    facts,
    reasonCodes,
    reviewLedger,
    ledgerDigest,
    contentDigest,
    auditRecordDigest: input.auditRecordDigest
  };
  return {
    policy: payload.policy,
    proven,
    publicationApproved,
    action,
    value,
    confidence:
      proven && action === "residual_editorial_reconstruction"
        ? 0.95
        : proven
          ? 0.98
          : 0.72,
    reasonCodes,
    facts,
    source: {
      family: sourceFamily,
      recordId: sourceRecordId,
      recordDigest: sourceRecordDigest,
      candidateRecordDigest: candidate.recordDigest
    },
    reviewLedger,
    digests: {
      policy: GLOSS_POLICY_DIGEST,
      ledger: ledgerDigest,
      content: contentDigest,
      proof: sha256(canonicalJson(payload))
    }
  };
}

export interface HebrewCanonicalMeaningConflictRecord {
  disposition: "publish_raw" | "publish_exact_companion";
  conflictKind:
    | "none"
    | "wrong_lexeme_or_pos"
    | "wrong_sibling"
    | "wrong_entity_scope";
  rawHtmlDigest: string;
  tbeshSourceDigest: string;
  reason: string;
}

export const HEBREW_MEANING_ADJUDICATION_LEDGER = {
  H0099: {
    disposition: "publish_exact_companion",
    conflictKind: "wrong_lexeme_or_pos",
    rawHtmlDigest:
      "6e6226209d7ecea33cee0edb7d6985d375b88a565846f025cee62130e6bd63ac",
    tbeshSourceDigest:
      "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    reason:
      "The adjective gloss/original is sad or grieved; the raw stagnant-pond notice belongs to a different lexeme."
  },
  H1958: {
    disposition: "publish_raw",
    conflictKind: "none",
    rawHtmlDigest:
      "e826c46c8a7dfb5b925bbc77206ad7b78501597e1f95f81cec2aac940373bc87",
    tbeshSourceDigest:
      "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    reason:
      "The raw lamentation/wailing notice is the exact lexical sense behind the STEP gloss woe."
  },
  H2337: {
    disposition: "publish_exact_companion",
    conflictKind: "wrong_sibling",
    rawHtmlDigest:
      "640ef57334466d7b0d8240b1daf1ee00cc28caf93f592be44c7f69eee986d6b4",
    tbeshSourceDigest:
      "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    reason:
      "The raw rock/crevice notice conflicts with the exact spelling relation to H2336 thicket/brier."
  },
  H4709G: {
    disposition: "publish_exact_companion",
    conflictKind: "wrong_entity_scope",
    rawHtmlDigest:
      "9096f92ec8f24ddb64cf843d57e6928b839eb6e4584d56f95b95f932ff593101",
    tbeshSourceDigest:
      "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    reason:
      "The Gilead-only raw location conflicts with the exact H4709G TAHOT/TIPNR occurrence set."
  }
} as const satisfies Record<string, HebrewCanonicalMeaningConflictRecord>;

export interface HebrewCanonicalMeaningProof {
  policy: {
    id: typeof HEBREW_CANONICAL_MEANING_POLICY_ID;
    digest: string;
  };
  proven: boolean;
  disposition:
    | "publish_raw"
    | "publish_exact_companion"
    | "publish_step_specific"
    | "publish_legacy_general"
    | "publish_editorial_reconstruction"
    | "block_publication";
  basis:
    | "direct_semantic_support"
    | "sealed_semantic_adjudication"
    | "positive_conflict_ledger"
    | "conservative_exact_companion"
    | "validated_source_audit"
    | "exact_step_specific_scope"
    | "sealed_residual_adjudication"
    | "fail_closed";
  canonicalRawProof:
    | "direct_semantic_support"
    | "sealed_semantic_adjudication"
    | null;
  conflictKind: HebrewCanonicalMeaningConflictRecord["conflictKind"] | null;
  selection: {
    html: string;
    source:
      | "tbesh_raw"
      | "tbesh_step_specific"
      | "tbesh_legacy_general"
      | "hebrew_english_exact_companion"
      | "lexicon_v3_hebrew_adjudication";
    recordDigest: string;
  } | null;
  facts: Record<string, boolean>;
  reasonCodes: string[];
  structure: {
    rawPreserved: boolean;
    hasSectionSeparator: boolean;
    sectionSeparatorCount: number;
    stepSpecificScope: "step_specific";
    baseStrongContextScope: "base_strong_context";
    rawHtmlDigest: string;
    stepSpecificDigest: string | null;
    baseStrongContextDigest: string | null;
  };
  digests: {
    policy: string;
    ledger: string;
    content: string;
    proof: string;
  };
}

export interface ProveHebrewCanonicalMeaningInput extends StepDirectAuditIdentityInput {
  rawHtml: string;
  tbeshSourceDigest: string;
  auditMeaningHtml: string;
  selectedMeaningHtml: string;
  meaningSupportsGloss: boolean;
  sections: TbeshMeaningSections;
  properName: boolean;
  entityScopeProven: boolean;
  ledgerCategory: TbeshPublicationLedgerCategory;
  companionProven: boolean;
  rawAssessmentStatus: HebrewEnglishCandidateStatus;
  stepSpecificScopeProven: boolean;
  fallbackPublicationAction: string;
  fallbackPublicationReasonCodes: string[];
  candidate?: HebrewEnglishCandidate;
  candidateCorpusDigest?: string;
  tahotSourceDigests?: Readonly<Record<string, string>>;
  exactOccurrenceCount?: number;
  exactOccurrenceCorpusDigest?: string;
}

export function proveHebrewCanonicalMeaning(
  input: ProveHebrewCanonicalMeaningInput
): HebrewCanonicalMeaningProof {
  const primary = input.primaryDStrong;
  const rawDigest = sha256(input.rawHtml);
  const residual = RESIDUAL_MEANING_RECORDS.get(primary);
  const residualSelectedHtml = residual
    ? residual.decision.finalAction === "keep_raw"
      ? input.rawHtml
      : residual.decision.finalAction === "publish_step_specific"
        ? input.sections.stepSpecificHtml
        : residual.decision.finalAction === "publish_legacy_general"
          ? input.sections.legacyGeneralHtml
          : residual.decision.finalAction === "replace_exact_companion"
            ? (input.candidate?.english.meaningHtml ?? "")
            : "reconstructionHtml" in residual.decision
              ? residual.decision.reconstructionHtml
              : ""
    : "";
  const residualSelectionSource = residual
    ? residual.decision.finalAction === "keep_raw"
      ? ("tbesh_raw" as const)
      : residual.decision.finalAction === "publish_step_specific"
        ? ("tbesh_step_specific" as const)
        : residual.decision.finalAction === "publish_legacy_general"
          ? ("tbesh_legacy_general" as const)
          : residual.decision.finalAction === "replace_exact_companion"
            ? ("hebrew_english_exact_companion" as const)
            : ("lexicon_v3_hebrew_adjudication" as const)
    : null;
  const residualRecordDigest = residual ? sha256(canonicalJson(residual)) : "";
  const adjudication =
    HEBREW_MEANING_ADJUDICATION_LEDGER[
      primary as keyof typeof HEBREW_MEANING_ADJUDICATION_LEDGER
    ];
  const sectionConflict = ["foreign_sibling", "source_conflict"].includes(
    input.ledgerCategory ?? ""
  );
  const adjudicationExact = Boolean(
    adjudication &&
    adjudication.rawHtmlDigest === rawDigest &&
    adjudication.tbeshSourceDigest === input.tbeshSourceDigest
  );
  const adjudicationDrift = Boolean(adjudication && !adjudicationExact);
  const positiveConflict = Boolean(
    sectionConflict ||
    (adjudicationExact &&
      adjudication?.disposition === "publish_exact_companion")
  );
  const directScopeProven =
    !input.properName &&
    (!input.sections.hasSectionSeparator ||
      ["verified_context", "empty_tail"].includes(input.ledgerCategory ?? ""));
  const directSemanticSupport =
    input.meaningSupportsGloss === true &&
    directScopeProven &&
    !positiveConflict &&
    !adjudicationDrift;
  const adjudicatedRaw = Boolean(
    adjudicationExact &&
    adjudication?.disposition === "publish_raw" &&
    !positiveConflict
  );
  const commonFacts = {
    auditDigestValid: isSha256(input.auditRecordDigest),
    auditAccepted: ["accepted", "repaired"].includes(input.auditDecisionStatus),
    canonicalTbeshSource: input.auditCanonicalSource === "TBESH",
    sourceAuditAccepted:
      input.sourceAuditStatus === "source_ok" &&
      input.sourceAuditRequiresReview === false,
    stepPrimarySelected:
      input.sourceSelectionStrategy === "step_primary" &&
      input.sourceSelectionSource === "STEP" &&
      input.sourceSelectionKind === "brief" &&
      input.sourceSelectionAutomatic === true,
    identityExact: exactAuditIdentity(input),
    rawHasContent: Boolean(input.rawHtml.trim()),
    rawMatchesAudit:
      input.rawHtml === input.auditMeaningHtml &&
      input.rawHtml === input.selectedMeaningHtml,
    sectionParseExact:
      input.sections.rawHtml === input.rawHtml &&
      input.sections.sectionSeparatorCount ===
        (input.sections.hasSectionSeparator ? 1 : 0)
  };
  const residualCandidateAttestations = new Map(
    (input.candidate?.provenance ?? []).map((attestation) => [
      `${attestation.source}:${attestation.recordId}`,
      attestation.contentDigest
    ])
  );
  const residualExactAttestations = residual
    ? Object.entries(
        residual.exactSourceAttestations as Readonly<Record<string, string>>
      )
    : [];
  const residualCounterAuditId = residual
    ? residual.counterAudit === "raw"
      ? HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS.rawCounterAudit
      : HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS.nonrawCounterAudit
    : "";
  const residualFacts: Record<string, boolean> = residual
    ? {
        residualRegistryRecordedDigestExact:
          MEANING_RESIDUAL_RECORDED_DIGEST ===
          EXPECTED_MEANING_RESIDUAL_CANONICAL_DIGEST,
        residualRegistryCanonicalDigestExact:
          HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST ===
          EXPECTED_MEANING_RESIDUAL_CANONICAL_DIGEST,
        residualRegistryCoverageExact:
          HEBREW_MEANING_RESIDUAL_AUDIT.reviewedCount === 208 &&
          RESIDUAL_MEANING_RECORDS.size === 208,
        residualAuditPassesDistinct:
          new Set([
            HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS.sourceAudit,
            residualCounterAuditId,
            HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS.finalAdjudication
          ]).size === 3,
        residualIdentityExact:
          residual.identity.stepEntryId === input.stepEntryId &&
          residual.identity.dStrong === input.dStrong &&
          residual.identity.uStrong === input.uStrong &&
          residual.identity.eStrong === input.candidate?.identity.eStrong,
        residualCandidateIdentityExact:
          input.candidate?.entryKey === input.entryKey &&
          input.candidate.identity.stepEntryId === input.stepEntryId,
        residualRawHtmlExact:
          residual.input.rawHtmlDigest === rawDigest &&
          input.rawHtml === input.auditMeaningHtml,
        // The historical audit-record digest remains sealed provenance, but
        // it covered the complete cross-language audit envelope (including
        // unrelated Greek catalog metadata). Current publication is instead
        // rebound below to every Hebrew semantic input: exact identity, raw
        // HTML, source audit, candidate, source attestations and occurrences.
        // This prevents an unrelated Greek registry change from invalidating
        // an already sealed Hebrew adjudication without weakening its facts.
        residualAuditRecordsWellFormed:
          isSha256(residual.input.auditRecordDigest) &&
          isSha256(input.auditRecordDigest),
        residualCandidateRecordExact:
          residual.input.candidateRecordDigest ===
          input.candidate?.recordDigest,
        residualStepAnchorExact:
          residual.input.stepAnchorDigest ===
          residualCandidateAttestations.get(
            `STEP-gloss-anchor:${input.stepEntryId}`
          ),
        residualSourceAttestationsExact:
          residualExactAttestations.length > 0 &&
          residualExactAttestations.every(
            ([recordId, digest]) =>
              residualCandidateAttestations.get(recordId) === digest
          ),
        residualOccurrenceCorpusExact:
          residual.occurrenceProof.count === input.exactOccurrenceCount &&
          residual.occurrenceProof.occurrenceCorpusDigest ===
            input.exactOccurrenceCorpusDigest,
        residualSelectedContentExact:
          Boolean(residualSelectedHtml.trim()) &&
          residual.decision.selectedHtmlDigest === sha256(residualSelectedHtml),
        residualCandidateCorpusExact:
          input.candidateCorpusDigest ===
          HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.candidateCorpus,
        residualTbeshSourceExact:
          input.tbeshSourceDigest ===
          HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.tbesh,
        residualTahotSourcesExact:
          canonicalJson(input.tahotSourceDigests ?? {}) ===
          canonicalJson(HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.tahot),
        residualOpenScripturesRevisionExact:
          HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.openScripturesCommit ===
          OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
        residualOpenScripturesSourcesExact: Object.entries(
          HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.openScriptures
        ).every(
          ([fileName, digest]) =>
            OPEN_SCRIPTURES_HEBREW_FILES[
              fileName as keyof typeof OPEN_SCRIPTURES_HEBREW_FILES
            ]?.sha256 === digest
        ),
        residualTipnrSourceExact:
          HEBREW_MEANING_RESIDUAL_AUDIT.sourcePins.tipnr ===
          STEP_BIBLE_ENTITY_SOURCE_DIGESTS["TIPNR.txt"]
      }
    : {};
  const residualExact =
    Boolean(residual) &&
    Object.values({ ...commonFacts, ...residualFacts }).every(Boolean);

  let disposition: HebrewCanonicalMeaningProof["disposition"];
  let basis: HebrewCanonicalMeaningProof["basis"];
  let canonicalRawProof: HebrewCanonicalMeaningProof["canonicalRawProof"] =
    null;
  let selection: HebrewCanonicalMeaningProof["selection"] = null;
  let actionFacts: Record<string, boolean>;
  if (residual && !residualExact) {
    disposition = "block_publication";
    basis = "fail_closed";
    actionFacts = {
      ...residualFacts,
      residualAdjudicationDriftDetected: true,
      failClosedWithoutPublishing: true
    };
  } else if (residual) {
    disposition =
      residual.decision.finalAction === "keep_raw"
        ? "publish_raw"
        : residual.decision.finalAction === "publish_step_specific"
          ? "publish_step_specific"
          : residual.decision.finalAction === "publish_legacy_general"
            ? "publish_legacy_general"
            : residual.decision.finalAction === "replace_exact_companion"
              ? "publish_exact_companion"
              : "publish_editorial_reconstruction";
    basis = "sealed_residual_adjudication";
    canonicalRawProof =
      disposition === "publish_raw" ? "sealed_semantic_adjudication" : null;
    selection = {
      html: residualSelectedHtml,
      source: residualSelectionSource!,
      recordDigest: residualRecordDigest
    };
    actionFacts = {
      ...residualFacts,
      residualAdjudicationExact: true,
      residualSelectedActionExact: true
    };
  } else if (adjudicationDrift) {
    disposition = "block_publication";
    basis = "fail_closed";
    actionFacts = {
      adjudicationDriftDetected: true,
      failClosedWithoutPublishing: true
    };
  } else if (directSemanticSupport) {
    disposition = "publish_raw";
    basis = "direct_semantic_support";
    canonicalRawProof = "direct_semantic_support";
    actionFacts = {
      directSemanticSupport: true,
      directScopeProven,
      noPositiveConflict: true
    };
  } else if (adjudicatedRaw) {
    disposition = "publish_raw";
    basis = "sealed_semantic_adjudication";
    canonicalRawProof = "sealed_semantic_adjudication";
    actionFacts = {
      adjudicationRecordExact: adjudicationExact,
      noPositiveConflict: true
    };
  } else if (positiveConflict) {
    disposition =
      input.fallbackPublicationAction === "step_specific_only"
        ? "publish_step_specific"
        : input.fallbackPublicationAction === "exact_companion" &&
            input.companionProven
          ? "publish_exact_companion"
          : "block_publication";
    basis = "positive_conflict_ledger";
    actionFacts = {
      positiveConflictProven: true,
      conflictRepairPublished: disposition !== "block_publication",
      conflictFailClosed:
        disposition === "block_publication" ||
        input.fallbackPublicationAction !== "blocked"
    };
  } else if (
    input.fallbackPublicationAction === "step_specific_only" &&
    input.stepSpecificScopeProven &&
    hasText(input.sections.stepSpecificHtml)
  ) {
    disposition = "publish_step_specific";
    basis = "exact_step_specific_scope";
    actionFacts = {
      selectorChoseStepSpecific: true,
      exactStepSpecificScope: true,
      stepSpecificHasContent: true,
      combinedRawNotPublished: true
    };
  } else if (
    input.fallbackPublicationAction === "exact_companion" &&
    input.companionProven
  ) {
    disposition = "publish_exact_companion";
    basis = "conservative_exact_companion";
    actionFacts = {
      rawSemanticOrScopeProofMissing:
        input.meaningSupportsGloss === false || !directScopeProven,
      exactCompanionProven: true,
      noFalseConflictClaim: true
    };
  } else if (
    input.fallbackPublicationAction === "raw_combined" &&
    input.rawAssessmentStatus === "validated" &&
    !input.properName
  ) {
    disposition = "publish_raw";
    basis = "validated_source_audit";
    actionFacts = {
      selectorRetainsValidatedRaw: true,
      rawAssessmentValidated: true,
      nonProperLexeme: true,
      noPositiveConflict: true
    };
  } else {
    disposition = "block_publication";
    basis = "fail_closed";
    actionFacts = {
      failClosedWithoutPublishing: true,
      selectorBlockedOrPublicationProofUnavailable:
        input.fallbackPublicationAction === "blocked" ||
        !input.companionProven ||
        input.properName ||
        input.rawAssessmentStatus !== "validated"
    };
  }
  const facts = { ...commonFacts, ...actionFacts };
  const failedFacts =
    disposition === "block_publication"
      ? []
      : Object.entries(facts)
          .filter(([, value]) => !value)
          .map(([name]) => `hebrew-canonical-meaning-fact-failed:${name}`);
  const proven = failedFacts.length === 0;
  const observedBlockingFacts =
    disposition === "block_publication"
      ? Object.entries(facts)
          .filter(([, value]) => !value)
          .map(([name]) => `hebrew-canonical-meaning-blocked:${name}`)
      : [];
  const reasonCodes = proven
    ? uniqueSorted([
        `hebrew-canonical-meaning:${basis}`,
        ...observedBlockingFacts,
        ...input.fallbackPublicationReasonCodes.map(
          (code) => `hebrew-canonical-meaning-selector:${code}`
        )
      ])
    : uniqueSorted(failedFacts);
  const structure = {
    rawPreserved: disposition === "publish_raw",
    hasSectionSeparator: input.sections.hasSectionSeparator,
    sectionSeparatorCount: input.sections.sectionSeparatorCount,
    stepSpecificScope: "step_specific" as const,
    baseStrongContextScope: "base_strong_context" as const,
    rawHtmlDigest: rawDigest,
    stepSpecificDigest: hasText(input.sections.stepSpecificHtml)
      ? sha256(input.sections.stepSpecificHtml)
      : null,
    baseStrongContextDigest: hasText(input.sections.legacyGeneralHtml)
      ? sha256(input.sections.legacyGeneralHtml)
      : null
  };
  const contentDigest = sha256(
    canonicalJson({
      disposition,
      basis,
      selection: selection
        ? {
            source: selection.source,
            htmlDigest: sha256(selection.html),
            recordDigest: selection.recordDigest
          }
        : null,
      conflictKind:
        adjudication?.conflictKind ??
        (sectionConflict ? "wrong_sibling" : null),
      structure
    })
  );
  const payload = {
    policy: {
      id: HEBREW_CANONICAL_MEANING_POLICY_ID,
      digest: MEANING_POLICY_DIGEST
    },
    disposition,
    basis,
    canonicalRawProof,
    selection,
    facts,
    reasonCodes,
    contentDigest,
    ledgerDigest: MEANING_LEDGER_DIGEST,
    auditRecordDigest: input.auditRecordDigest
  };
  return {
    policy: payload.policy,
    proven,
    disposition,
    basis,
    canonicalRawProof,
    selection,
    conflictKind:
      adjudication?.conflictKind ?? (sectionConflict ? "wrong_sibling" : null),
    facts,
    reasonCodes,
    structure,
    digests: {
      policy: MEANING_POLICY_DIGEST,
      ledger: MEANING_LEDGER_DIGEST,
      content: contentDigest,
      proof: sha256(canonicalJson({ ...payload, proven, structure }))
    }
  };
}

function exactAuditIdentity(input: StepDirectAuditIdentityInput): boolean {
  return (
    input.entryKey === `hebrew:${input.primaryDStrong}` &&
    input.auditKey === input.entryKey &&
    input.auditStepEntryId === input.stepEntryId &&
    input.auditDStrong === input.dStrong &&
    input.auditUStrong === input.uStrong &&
    input.sourceAuditEntryKey === input.entryKey &&
    input.sourceAuditPrimaryDStrong === input.primaryDStrong &&
    input.sourceAuditDStrong === input.dStrong &&
    input.sourceAuditUStrong === input.uStrong
  );
}

function extractExactLexicalDefinition(html: string): string {
  const match =
    /<strong>Exact lexical definition:<\/strong>\s*([^<]+)<\/p>/iu.exec(html);
  return decodeHtml(match?.[1] ?? "").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ");
}

function findAttestation(
  candidate: HebrewEnglishCandidate,
  source: HebrewEnglishSourceAttestation["source"],
  recordId: string
): HebrewEnglishSourceAttestation | null {
  return (
    candidate.provenance.find(
      (attestation) =>
        attestation.source === source && attestation.recordId === recordId
    ) ?? null
  );
}

function isRecognizedSourcePriorityReview(issueCodes: readonly string[]) {
  const allowed = new Set([
    "hebrew-open-gloss-support-missing",
    "hebrew-strong-usage-only-gloss-review-required",
    "step-gloss-open-definition-mismatch",
    "step-subsense-gloss-specificity-unverified",
    "tipnr-exact-dstrong-missing",
    "tipnr-gloss-alias-mismatch",
    "tipnr-gloss-non-proper-link-not-lexical-definition"
  ]);
  return issueCodes.length > 0 && issueCodes.every((code) => allowed.has(code));
}

function normalizeHebrewStrongIdentity(value: string): string | null {
  const match = /^H0*(\d{1,5})([A-Za-z](?:_[A-Za-z])?)?$/u.exec(value.trim());
  if (!match) return null;
  return `H${Number(match[1])}${(match[2] ?? "").toUpperCase()}`;
}

const GLOSS_LEDGER_DIGEST = sha256(
  canonicalJson({
    doubleAuditedLexical: DOUBLE_AUDITED_LEXICAL_GLOSS_KEYS,
    exactTipnr: EXACT_TIPNR_GLOSS_LEDGER,
    thirdArbitration: HEBREW_GLOSS_ARBITRATION_KEYS,
    residualAudit: HEBREW_GLOSS_RESIDUAL_AUDIT,
    residualAuditPassIds: HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS,
    residualAuditSourceArtifact: HEBREW_GLOSS_RESIDUAL_SOURCE_ARTIFACT,
    residualAuditCanonicalDigest: HEBREW_GLOSS_RESIDUAL_CANONICAL_DIGEST,
    reviewedCandidateCorpusDigest: HEBREW_CANONICAL_REVIEWED_CORPUS_DIGEST,
    lexicalSourceDigest: OPEN_SCRIPTURES_HEBREW_FILES["LexicalIndex.xml"].sha256
  })
);
const GLOSS_POLICY_DIGEST = sha256(
  canonicalJson({
    id: HEBREW_CANONICAL_GLOSS_POLICY_ID,
    ledgerDigest: GLOSS_LEDGER_DIGEST,
    rules: [
      "exact-step-audit-candidate-identity",
      "source-priority-is-not-unconditional-step-priority",
      "double-audited-definition-replacement-requires-exact-original-pos-index",
      "tipnr-replacement-requires-exact-entity-and-contextual-alias",
      "meaning-or-occurrence-support-preserves-step-subsense",
      "residual-publication-requires-two-audits-final-adjudication-exact-record-and-source-digests",
      "third-arbitration-and-unknown-cases-fail-closed"
    ]
  })
);
const MEANING_LEDGER_DIGEST = sha256(
  canonicalJson({
    adjudication: HEBREW_MEANING_ADJUDICATION_LEDGER,
    residualAudit: HEBREW_MEANING_RESIDUAL_AUDIT,
    residualAuditPassIds: HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS,
    residualAuditCanonicalDigest: HEBREW_MEANING_RESIDUAL_CANONICAL_DIGEST
  })
);
const MEANING_POLICY_DIGEST = sha256(
  canonicalJson({
    id: HEBREW_CANONICAL_MEANING_POLICY_ID,
    ledgerDigest: MEANING_LEDGER_DIGEST,
    rules: [
      "complete-tbesh-raw-restored-only-with-direct-semantic-support-or-sealed-adjudication",
      "positive-conflict-ledger-precedes-token-support",
      "direct-support-requires-unsectioned-lexeme-or-resealed-safe-section-ledger",
      "proper-raw-requires-raw-specific-sealed-adjudication",
      "residual-publication-requires-complete-audit-bounded-counteraudit-final-adjudication-and-exact-pinned-inputs",
      "source-sections-and-companions-must-be-selected-byte-exactly",
      "editorial-reconstruction-is-explicitly-labeled-and-never-attributed-to-step",
      "ledger-digest-drift-precedes-direct-support-and-fails-closed",
      "unsupported-raw-keeps-proven-exact-companion-without-false-conflict-label",
      "section-symbol-and-both-scopes-preserved-and-digested",
      "unknown-or-digest-drift-fails-closed"
    ]
  })
);

function hasText(value: string): boolean {
  return Boolean(
    value
      .replace(/<[^>]*>/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}
