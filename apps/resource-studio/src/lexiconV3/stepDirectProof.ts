import { createHash } from "node:crypto";

export const STEP_DIRECT_MEANING_POLICY_ID =
  "hebrew-step-direct-meaning-proof@1" as const;
export const STEP_DIRECT_GLOSS_POLICY_ID =
  "hebrew-step-direct-gloss-proof@1" as const;

export const STEP_DIRECT_MEANING_ASSESSMENT_ALLOWLIST = [
  "hebrew-open-corroboration-missing",
  "hebrew-open-corroboration-review-needed",
  "tbesh-suffixed-scope-unproven"
] as const;

export const STEP_DIRECT_MEANING_COMPANION_ALLOWLIST = [
  "aug-index-mapping-missing",
  "hebrew-strong-meaning-missing",
  "step-open-source-relation-unverified",
  "step-subsense-specificity-review-required",
  "tipnr-exact-dstrong-missing",
  "tipnr-non-proper-entity-link-not-lexical-definition"
] as const;

export const STEP_DIRECT_GLOSS_FIELD_ALLOWLIST = [
  "hebrew-open-gloss-support-missing",
  "hebrew-strong-usage-only-gloss-review-required",
  "step-subsense-gloss-specificity-unverified",
  "tipnr-exact-dstrong-missing",
  "tipnr-gloss-non-proper-link-not-lexical-definition"
] as const;

export const STEP_DIRECT_GLOSS_CANDIDATE_ALLOWLIST = [
  "hebrew-strong-meaning-missing",
  "step-open-source-relation-unverified",
  "step-subsense-specificity-review-required",
  "tipnr-exact-dstrong-missing",
  "tipnr-non-proper-entity-link-not-lexical-definition"
] as const;

const NON_STRUCTURAL_RAW_PUBLICATION_REASONS = new Set([
  "tbesh-block-unvalidated-unsectioned-without-exact-companion",
  "tbesh-exact-companion-html-empty",
  "tbesh-exact-companion-method-not-allowed",
  "tbesh-exact-companion-missing",
  "tbesh-exact-companion-not-explicitly-proven",
  "tbesh-exact-companion-status-not-validated",
  "tbesh-exact-tipnr-tahot-intersection-missing"
]);

const MEANING_ASSESSMENT_ALLOWLIST = new Set<string>(
  STEP_DIRECT_MEANING_ASSESSMENT_ALLOWLIST
);
const MEANING_COMPANION_ALLOWLIST = new Set<string>(
  STEP_DIRECT_MEANING_COMPANION_ALLOWLIST
);
const GLOSS_FIELD_ALLOWLIST = new Set<string>(
  STEP_DIRECT_GLOSS_FIELD_ALLOWLIST
);
const GLOSS_CANDIDATE_ALLOWLIST = new Set<string>(
  STEP_DIRECT_GLOSS_CANDIDATE_ALLOWLIST
);

export interface StepDirectAuditIdentityInput {
  entryKey: string;
  stepEntryId: number;
  primaryDStrong: string;
  dStrong: string;
  uStrong: string;
  auditKey: string;
  auditStepEntryId: number;
  auditDStrong: string;
  auditUStrong: string;
  auditDecisionStatus: string;
  auditCanonicalSource: string | null;
  sourceAuditStatus: string;
  sourceAuditRequiresReview: boolean;
  sourceAuditEntryKey: string;
  sourceAuditPrimaryDStrong: string;
  sourceAuditDStrong: string;
  sourceAuditUStrong: string;
  sourceSelectionStrategy: string;
  sourceSelectionSource: string | null;
  sourceSelectionKind: string | null;
  sourceSelectionAutomatic: boolean;
  auditRecordDigest: string;
}

export interface StepDirectMeaningProofInput extends StepDirectAuditIdentityInput {
  rawHtml: string;
  rawText: string;
  auditMeaningHtml: string;
  hasSectionSeparator: boolean;
  exactOccurrenceStepStrong: string;
  exactOccurrenceCount: number;
  rawFamilyHtmlCount: number;
  rawFamilyTextCount: number;
  glossContentTerms: readonly string[];
  meaningSupportsGloss: boolean;
  assessmentIssueCodes: readonly string[];
  companionIssueCodes: readonly string[];
  publicationAction: string | null;
  publicationReasonCodes: readonly string[];
}

export interface StepDirectGlossProofInput extends StepDirectAuditIdentityInput {
  stepGloss: string;
  auditGloss: string;
  selectedGloss: string;
  glossContentTerms: readonly string[];
  meaningSupportsGloss: boolean;
  fieldIssueCodes: readonly string[];
  candidateIssueCodes: readonly string[];
  preliminaryState: string;
  exactGlossProofProven: boolean;
  tahotGlossProofProven: boolean;
  technicalMarkerProofProven: boolean;
}

export interface StepDirectProofDigests {
  policy: string;
  auditRecord: string;
  content: string;
  issues: string;
  proof: string;
}

export interface StepDirectProof<Facts extends Record<string, boolean>> {
  proven: boolean;
  confidence: number;
  policy: {
    id:
      | typeof STEP_DIRECT_MEANING_POLICY_ID
      | typeof STEP_DIRECT_GLOSS_POLICY_ID;
    digest: string;
  };
  reasonCodes: string[];
  allowedIssueCodes: string[];
  blockedIssueCodes: string[];
  facts: Facts;
  digests: StepDirectProofDigests;
}

export type StepDirectMeaningProof = StepDirectProof<{
  auditDigestValid: boolean;
  auditDecisionAccepted: boolean;
  canonicalTbeshSource: boolean;
  sourceAuditAccepted: boolean;
  stepPrimarySelected: boolean;
  identityExact: boolean;
  rawHasContent: boolean;
  rawMatchesAudit: boolean;
  rawUnsectioned: boolean;
  exactOccurrence: boolean;
  rawHtmlUniqueInFamily: boolean;
  rawTextUniqueInFamily: boolean;
  glossTermsPresent: boolean;
  meaningSupportsGloss: boolean;
  assessmentIssuesAllowed: boolean;
  companionIssuesAllowed: boolean;
  suffixScopeConditionSatisfied: boolean;
  publicationAllowsDirectRaw: boolean;
}>;

export type StepDirectGlossProof = StepDirectProof<{
  auditDigestValid: boolean;
  auditDecisionAccepted: boolean;
  canonicalTbeshSource: boolean;
  sourceAuditAccepted: boolean;
  stepPrimarySelected: boolean;
  identityExact: boolean;
  glossHasContent: boolean;
  glossMatchesStepAndAudit: boolean;
  glossTermsPresent: boolean;
  meaningSupportsGloss: boolean;
  fieldIssuesAllowed: boolean;
  candidateIssuesAllowed: boolean;
  preliminaryStateCandidate: boolean;
  priorProofsNotSelected: boolean;
}>;

const MEANING_POLICY_DIGEST = sha256(
  canonicalJson({
    id: STEP_DIRECT_MEANING_POLICY_ID,
    assessmentAllowlist: STEP_DIRECT_MEANING_ASSESSMENT_ALLOWLIST,
    companionAllowlist: STEP_DIRECT_MEANING_COMPANION_ALLOWLIST,
    nonStructuralPublicationReasons: [
      ...NON_STRUCTURAL_RAW_PUBLICATION_REASONS
    ].sort(),
    rules: [
      "accepted-or-repaired-canonical-tbesh",
      "source-ok-no-review-step-primary",
      "case-sensitive-entry-audit-source-identity",
      "exact-tahot-occurrence",
      "unsectioned-raw",
      "exact-html-and-canonical-text-family-uniqueness",
      "step-meaning-supports-nonempty-gloss-terms",
      "explicit-issue-allowlists-unknown-blocks"
    ]
  })
);

const GLOSS_POLICY_DIGEST = sha256(
  canonicalJson({
    id: STEP_DIRECT_GLOSS_POLICY_ID,
    fieldAllowlist: STEP_DIRECT_GLOSS_FIELD_ALLOWLIST,
    candidateAllowlist: STEP_DIRECT_GLOSS_CANDIDATE_ALLOWLIST,
    rules: [
      "accepted-or-repaired-canonical-tbesh",
      "source-ok-no-review-step-primary",
      "case-sensitive-entry-audit-source-identity",
      "exact-step-audit-selected-gloss",
      "step-meaning-supports-nonempty-gloss-terms",
      "runs-after-exact-tahot-and-technical-proofs",
      "explicit-issue-allowlists-unknown-blocks"
    ]
  })
);

export function proveStepDirectMeaning(
  input: StepDirectMeaningProofInput
): StepDirectMeaningProof {
  const assessmentIssues = uniqueSorted(input.assessmentIssueCodes);
  const companionIssues = uniqueSorted(input.companionIssueCodes);
  const blockedAssessment = assessmentIssues.filter(
    (code) => !MEANING_ASSESSMENT_ALLOWLIST.has(code)
  );
  const blockedCompanion = companionIssues.filter(
    (code) => !MEANING_COMPANION_ALLOWLIST.has(code)
  );
  const publicationReasons = uniqueSorted(input.publicationReasonCodes);
  const publicationAllowsDirectRaw =
    input.publicationAction === "raw_combined" ||
    (input.publicationAction === "blocked" &&
      publicationReasons.includes(
        "tbesh-block-unvalidated-unsectioned-without-exact-companion"
      ) &&
      publicationReasons.every((code) =>
        NON_STRUCTURAL_RAW_PUBLICATION_REASONS.has(code)
      ));
  const exactOccurrence =
    input.exactOccurrenceStepStrong === input.primaryDStrong &&
    Number.isSafeInteger(input.exactOccurrenceCount) &&
    input.exactOccurrenceCount > 0;
  const rawHtmlUniqueInFamily = input.rawFamilyHtmlCount === 1;
  const rawTextUniqueInFamily = input.rawFamilyTextCount === 1;
  const rawUnsectioned = !input.hasSectionSeparator;
  const suffixScopeConditionSatisfied =
    !assessmentIssues.includes("tbesh-suffixed-scope-unproven") ||
    (exactOccurrence &&
      rawHtmlUniqueInFamily &&
      rawTextUniqueInFamily &&
      rawUnsectioned);
  const facts: StepDirectMeaningProof["facts"] = {
    auditDigestValid: isSha256(input.auditRecordDigest),
    auditDecisionAccepted: ["accepted", "repaired"].includes(
      input.auditDecisionStatus
    ),
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
    rawHasContent: Boolean(input.rawHtml.trim() && input.rawText.trim()),
    rawMatchesAudit: input.rawHtml === input.auditMeaningHtml,
    rawUnsectioned,
    exactOccurrence,
    rawHtmlUniqueInFamily,
    rawTextUniqueInFamily,
    glossTermsPresent: normalizedTerms(input.glossContentTerms).length > 0,
    meaningSupportsGloss: input.meaningSupportsGloss === true,
    assessmentIssuesAllowed: blockedAssessment.length === 0,
    companionIssuesAllowed: blockedCompanion.length === 0,
    suffixScopeConditionSatisfied,
    publicationAllowsDirectRaw
  };
  return finishProof({
    policyId: STEP_DIRECT_MEANING_POLICY_ID,
    policyDigest: MEANING_POLICY_DIGEST,
    auditRecordDigest: input.auditRecordDigest,
    contentDigest: sha256(
      canonicalJson({
        rawHtml: sha256(input.rawHtml),
        rawText: sha256(input.rawText)
      })
    ),
    issuesDigest: sha256(
      canonicalJson({
        assessmentIssues,
        companionIssues,
        publicationReasons
      })
    ),
    facts,
    allowedIssueCodes: [
      ...assessmentIssues.filter((code) =>
        MEANING_ASSESSMENT_ALLOWLIST.has(code)
      ),
      ...companionIssues.filter((code) => MEANING_COMPANION_ALLOWLIST.has(code))
    ],
    blockedIssueCodes: [...blockedAssessment, ...blockedCompanion],
    confidence: 0.95
  });
}

export function proveStepDirectGloss(
  input: StepDirectGlossProofInput
): StepDirectGlossProof {
  const fieldIssues = uniqueSorted(input.fieldIssueCodes);
  const candidateIssues = uniqueSorted(input.candidateIssueCodes);
  const blockedField = fieldIssues.filter(
    (code) => !GLOSS_FIELD_ALLOWLIST.has(code)
  );
  const blockedCandidate = candidateIssues.filter(
    (code) => !GLOSS_CANDIDATE_ALLOWLIST.has(code)
  );
  const selectedGloss = input.selectedGloss.trim();
  const facts: StepDirectGlossProof["facts"] = {
    auditDigestValid: isSha256(input.auditRecordDigest),
    auditDecisionAccepted: ["accepted", "repaired"].includes(
      input.auditDecisionStatus
    ),
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
    glossHasContent: selectedGloss.length > 0,
    glossMatchesStepAndAudit:
      selectedGloss === input.stepGloss.trim() &&
      selectedGloss === input.auditGloss.trim(),
    glossTermsPresent: normalizedTerms(input.glossContentTerms).length > 0,
    meaningSupportsGloss: input.meaningSupportsGloss === true,
    fieldIssuesAllowed: blockedField.length === 0,
    candidateIssuesAllowed: blockedCandidate.length === 0,
    preliminaryStateCandidate: input.preliminaryState === "candidate",
    priorProofsNotSelected:
      input.exactGlossProofProven === false &&
      input.tahotGlossProofProven === false &&
      input.technicalMarkerProofProven === false
  };
  return finishProof({
    policyId: STEP_DIRECT_GLOSS_POLICY_ID,
    policyDigest: GLOSS_POLICY_DIGEST,
    auditRecordDigest: input.auditRecordDigest,
    contentDigest: sha256(input.selectedGloss),
    issuesDigest: sha256(canonicalJson({ fieldIssues, candidateIssues })),
    facts,
    allowedIssueCodes: [
      ...fieldIssues.filter((code) => GLOSS_FIELD_ALLOWLIST.has(code)),
      ...candidateIssues.filter((code) => GLOSS_CANDIDATE_ALLOWLIST.has(code))
    ],
    blockedIssueCodes: [...blockedField, ...blockedCandidate],
    confidence: 0.95
  });
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

function finishProof<Facts extends Record<string, boolean>>(input: {
  policyId:
    | typeof STEP_DIRECT_MEANING_POLICY_ID
    | typeof STEP_DIRECT_GLOSS_POLICY_ID;
  policyDigest: string;
  auditRecordDigest: string;
  contentDigest: string;
  issuesDigest: string;
  facts: Facts;
  allowedIssueCodes: string[];
  blockedIssueCodes: string[];
  confidence: number;
}): StepDirectProof<Facts> {
  const failedFacts = Object.entries(input.facts)
    .filter(([, value]) => !value)
    .map(([name]) => `step-direct-fact-failed:${name}`);
  const blockedIssueCodes = uniqueSorted(input.blockedIssueCodes);
  const reasonCodes = uniqueSorted([
    ...failedFacts,
    ...blockedIssueCodes.map((code) => `step-direct-issue-blocked:${code}`)
  ]);
  const proven = reasonCodes.length === 0;
  const payload = {
    policy: { id: input.policyId, digest: input.policyDigest },
    auditRecordDigest: input.auditRecordDigest,
    contentDigest: input.contentDigest,
    issuesDigest: input.issuesDigest,
    facts: input.facts,
    allowedIssueCodes: uniqueSorted(input.allowedIssueCodes),
    blockedIssueCodes,
    reasonCodes,
    proven,
    confidence: proven ? input.confidence : 0.72
  };
  return {
    proven,
    confidence: payload.confidence,
    policy: payload.policy,
    reasonCodes,
    allowedIssueCodes: payload.allowedIssueCodes,
    blockedIssueCodes,
    facts: input.facts,
    digests: {
      policy: input.policyDigest,
      auditRecord: input.auditRecordDigest,
      content: input.contentDigest,
      issues: input.issuesDigest,
      proof: sha256(canonicalJson(payload))
    }
  };
}

function normalizedTerms(values: readonly string[]): string[] {
  return uniqueSorted(values.map((value) => value.trim()).filter(Boolean));
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
