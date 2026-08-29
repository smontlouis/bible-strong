import assert from "node:assert/strict";
import test from "node:test";

import {
  proveStepDirectGloss,
  proveStepDirectMeaning,
  STEP_DIRECT_GLOSS_CANDIDATE_ALLOWLIST,
  STEP_DIRECT_GLOSS_FIELD_ALLOWLIST,
  STEP_DIRECT_MEANING_ASSESSMENT_ALLOWLIST,
  STEP_DIRECT_MEANING_COMPANION_ALLOWLIST,
  type StepDirectGlossProofInput,
  type StepDirectMeaningProofInput
} from "../src/lexiconV3/stepDirectProof.js";

test("proves a direct STEP meaning only with the complete strict fact set", () => {
  const proof = proveStepDirectMeaning(meaningInput());
  assert.equal(proof.proven, true);
  assert.equal(proof.confidence, 0.95);
  assert.deepEqual(proof.reasonCodes, []);
  assert.deepEqual(proof.blockedIssueCodes, []);
  assert.equal(proof.digests.auditRecord, "a".repeat(64));
  for (const digest of Object.values(proof.digests)) {
    assert.match(digest, /^[a-f0-9]{64}$/u);
  }
});

test("accepts only the enumerated absence-only meaning issues", () => {
  const proof = proveStepDirectMeaning(
    meaningInput({
      assessmentIssueCodes: [...STEP_DIRECT_MEANING_ASSESSMENT_ALLOWLIST],
      companionIssueCodes: [...STEP_DIRECT_MEANING_COMPANION_ALLOWLIST]
    })
  );
  assert.equal(proof.proven, true);
  assert.deepEqual(
    proof.allowedIssueCodes,
    [
      ...STEP_DIRECT_MEANING_ASSESSMENT_ALLOWLIST,
      ...STEP_DIRECT_MEANING_COMPANION_ALLOWLIST
    ].sort()
  );

  const unknown = proveStepDirectMeaning(
    meaningInput({ assessmentIssueCodes: ["future-unreviewed-code"] })
  );
  assert.equal(unknown.proven, false);
  assert.deepEqual(unknown.blockedIssueCodes, ["future-unreviewed-code"]);

  const conflict = proveStepDirectMeaning(
    meaningInput({
      companionIssueCodes: ["step-open-source-relation-conflict"]
    })
  );
  assert.equal(conflict.proven, false);
  assert.deepEqual(conflict.blockedIssueCodes, [
    "step-open-source-relation-conflict"
  ]);
});

test("allows only the non-structural unsectioned publication block", () => {
  const missingCompanion = proveStepDirectMeaning(
    meaningInput({
      publicationReasonCodes: [
        "tbesh-block-unvalidated-unsectioned-without-exact-companion",
        "tbesh-exact-companion-not-explicitly-proven"
      ]
    })
  );
  assert.equal(missingCompanion.proven, true);

  const structural = proveStepDirectMeaning(
    meaningInput({
      hasSectionSeparator: true,
      publicationReasonCodes: ["tbesh-block-multiple-section-separators"]
    })
  );
  assert.equal(structural.proven, false);
  assert.equal(structural.facts.rawUnsectioned, false);
  assert.equal(structural.facts.publicationAllowsDirectRaw, false);
});

test("keeps suffixed direct meanings behind occurrence and uniqueness", () => {
  const exact = proveStepDirectMeaning(
    meaningInput({
      assessmentIssueCodes: ["tbesh-suffixed-scope-unproven"]
    })
  );
  assert.equal(exact.proven, true);

  for (const overrides of [
    { exactOccurrenceCount: 0 },
    { exactOccurrenceStepStrong: "H0001g" },
    { rawFamilyHtmlCount: 2 },
    { rawFamilyTextCount: 2 },
    { hasSectionSeparator: true }
  ]) {
    const rejected = proveStepDirectMeaning(
      meaningInput({
        assessmentIssueCodes: ["tbesh-suffixed-scope-unproven"],
        ...overrides
      })
    );
    assert.equal(rejected.proven, false, JSON.stringify(overrides));
    assert.equal(rejected.facts.suffixScopeConditionSatisfied, false);
  }
});

test("fails a direct meaning closed when any required fact changes", () => {
  const mutations: Array<{
    name: string;
    overrides: Partial<StepDirectMeaningProofInput>;
    fact: keyof ReturnType<typeof proveStepDirectMeaning>["facts"];
  }> = [
    {
      name: "audit digest",
      overrides: { auditRecordDigest: "bad" },
      fact: "auditDigestValid"
    },
    {
      name: "audit decision",
      overrides: { auditDecisionStatus: "quarantined" },
      fact: "auditDecisionAccepted"
    },
    {
      name: "canonical source",
      overrides: { auditCanonicalSource: null },
      fact: "canonicalTbeshSource"
    },
    {
      name: "source status",
      overrides: { sourceAuditStatus: "source_issue" },
      fact: "sourceAuditAccepted"
    },
    {
      name: "source review",
      overrides: { sourceAuditRequiresReview: true },
      fact: "sourceAuditAccepted"
    },
    {
      name: "source selection",
      overrides: { sourceSelectionAutomatic: false },
      fact: "stepPrimarySelected"
    },
    {
      name: "entry identity case",
      overrides: { sourceAuditPrimaryDStrong: "H0001g" },
      fact: "identityExact"
    },
    {
      name: "step entry id",
      overrides: { auditStepEntryId: 999 },
      fact: "identityExact"
    },
    {
      name: "empty raw",
      overrides: { rawHtml: "", rawText: "" },
      fact: "rawHasContent"
    },
    {
      name: "audit raw mismatch",
      overrides: { auditMeaningHtml: "different" },
      fact: "rawMatchesAudit"
    },
    {
      name: "html shared",
      overrides: { rawFamilyHtmlCount: 2 },
      fact: "rawHtmlUniqueInFamily"
    },
    {
      name: "text shared",
      overrides: { rawFamilyTextCount: 2 },
      fact: "rawTextUniqueInFamily"
    },
    {
      name: "gloss terms",
      overrides: { glossContentTerms: [] },
      fact: "glossTermsPresent"
    },
    {
      name: "gloss support",
      overrides: { meaningSupportsGloss: false },
      fact: "meaningSupportsGloss"
    }
  ];
  for (const mutation of mutations) {
    const proof = proveStepDirectMeaning(meaningInput(mutation.overrides));
    assert.equal(proof.proven, false, mutation.name);
    assert.equal(proof.facts[mutation.fact], false, mutation.name);
  }
});

test("produces deterministic meaning proof digests", () => {
  const left = proveStepDirectMeaning(
    meaningInput({
      assessmentIssueCodes: [
        "tbesh-suffixed-scope-unproven",
        "hebrew-open-corroboration-review-needed"
      ]
    })
  );
  const right = proveStepDirectMeaning(
    meaningInput({
      assessmentIssueCodes: [
        "hebrew-open-corroboration-review-needed",
        "tbesh-suffixed-scope-unproven",
        "tbesh-suffixed-scope-unproven"
      ]
    })
  );
  assert.equal(left.digests.proof, right.digests.proof);
  assert.equal(left.digests.issues, right.digests.issues);
});

test("proves a STEP-direct gloss after earlier gates decline it", () => {
  const proof = proveStepDirectGloss(glossInput());
  assert.equal(proof.proven, true);
  assert.equal(proof.confidence, 0.95);
  assert.deepEqual(proof.reasonCodes, []);
  for (const digest of Object.values(proof.digests)) {
    assert.match(digest, /^[a-f0-9]{64}$/u);
  }
});

test("accepts only the enumerated absence-only gloss issues", () => {
  const proof = proveStepDirectGloss(
    glossInput({
      fieldIssueCodes: [...STEP_DIRECT_GLOSS_FIELD_ALLOWLIST],
      candidateIssueCodes: [...STEP_DIRECT_GLOSS_CANDIDATE_ALLOWLIST]
    })
  );
  assert.equal(proof.proven, true);

  for (const overrides of [
    { fieldIssueCodes: ["step-gloss-open-definition-mismatch"] },
    { fieldIssueCodes: ["tipnr-gloss-alias-mismatch"] },
    { candidateIssueCodes: ["step-open-source-relation-conflict"] },
    { candidateIssueCodes: ["step-gloss-open-source-mismatch"] },
    { fieldIssueCodes: ["future-gloss-code"] }
  ]) {
    const rejected = proveStepDirectGloss(glossInput(overrides));
    assert.equal(rejected.proven, false, JSON.stringify(overrides));
    assert.ok(rejected.blockedIssueCodes.length > 0);
  }
});

test("fails a direct gloss closed when any required fact changes", () => {
  const mutations: Array<{
    name: string;
    overrides: Partial<StepDirectGlossProofInput>;
    fact: keyof ReturnType<typeof proveStepDirectGloss>["facts"];
  }> = [
    {
      name: "digest",
      overrides: { auditRecordDigest: "bad" },
      fact: "auditDigestValid"
    },
    {
      name: "decision",
      overrides: { auditDecisionStatus: "source-conflict" },
      fact: "auditDecisionAccepted"
    },
    {
      name: "source",
      overrides: { auditCanonicalSource: "TFLSJ" },
      fact: "canonicalTbeshSource"
    },
    {
      name: "source audit",
      overrides: { sourceAuditRequiresReview: true },
      fact: "sourceAuditAccepted"
    },
    {
      name: "selection",
      overrides: { sourceSelectionStrategy: "manual_review" },
      fact: "stepPrimarySelected"
    },
    {
      name: "identity",
      overrides: { auditDStrong: "H0001g =" },
      fact: "identityExact"
    },
    {
      name: "empty gloss",
      overrides: { selectedGloss: "" },
      fact: "glossHasContent"
    },
    {
      name: "gloss mismatch",
      overrides: { auditGloss: "other" },
      fact: "glossMatchesStepAndAudit"
    },
    {
      name: "terms",
      overrides: { glossContentTerms: [] },
      fact: "glossTermsPresent"
    },
    {
      name: "meaning support",
      overrides: { meaningSupportsGloss: false },
      fact: "meaningSupportsGloss"
    },
    {
      name: "state",
      overrides: { preliminaryState: "blocked_source_issue" },
      fact: "preliminaryStateCandidate"
    },
    {
      name: "exact selected",
      overrides: { exactGlossProofProven: true },
      fact: "priorProofsNotSelected"
    },
    {
      name: "tahot selected",
      overrides: { tahotGlossProofProven: true },
      fact: "priorProofsNotSelected"
    },
    {
      name: "technical selected",
      overrides: { technicalMarkerProofProven: true },
      fact: "priorProofsNotSelected"
    }
  ];
  for (const mutation of mutations) {
    const proof = proveStepDirectGloss(glossInput(mutation.overrides));
    assert.equal(proof.proven, false, mutation.name);
    assert.equal(proof.facts[mutation.fact], false, mutation.name);
  }
});

function meaningInput(
  overrides: Partial<StepDirectMeaningProofInput> = {}
): StepDirectMeaningProofInput {
  return {
    ...auditIdentity(),
    rawHtml: "<b>אָב</b>, father of an individual",
    rawText: "אָב, father of an individual",
    auditMeaningHtml: "<b>אָב</b>, father of an individual",
    hasSectionSeparator: false,
    exactOccurrenceStepStrong: "H0001G",
    exactOccurrenceCount: 3,
    rawFamilyHtmlCount: 1,
    rawFamilyTextCount: 1,
    glossContentTerms: ["father"],
    meaningSupportsGloss: true,
    assessmentIssueCodes: ["hebrew-open-corroboration-review-needed"],
    companionIssueCodes: ["step-open-source-relation-unverified"],
    publicationAction: "blocked",
    publicationReasonCodes: [
      "tbesh-block-unvalidated-unsectioned-without-exact-companion",
      "tbesh-exact-companion-not-explicitly-proven"
    ],
    ...overrides
  };
}

function glossInput(
  overrides: Partial<StepDirectGlossProofInput> = {}
): StepDirectGlossProofInput {
  return {
    ...auditIdentity(),
    stepGloss: "father",
    auditGloss: "father",
    selectedGloss: "father",
    glossContentTerms: ["father"],
    meaningSupportsGloss: true,
    fieldIssueCodes: ["hebrew-open-gloss-support-missing"],
    candidateIssueCodes: ["step-open-source-relation-unverified"],
    preliminaryState: "candidate",
    exactGlossProofProven: false,
    tahotGlossProofProven: false,
    technicalMarkerProofProven: false,
    ...overrides
  };
}

function auditIdentity(): Omit<
  StepDirectMeaningProofInput,
  | "rawHtml"
  | "rawText"
  | "auditMeaningHtml"
  | "hasSectionSeparator"
  | "exactOccurrenceStepStrong"
  | "exactOccurrenceCount"
  | "rawFamilyHtmlCount"
  | "rawFamilyTextCount"
  | "glossContentTerms"
  | "meaningSupportsGloss"
  | "assessmentIssueCodes"
  | "companionIssueCodes"
  | "publicationAction"
  | "publicationReasonCodes"
> {
  return {
    entryKey: "hebrew:H0001G",
    stepEntryId: 11036,
    primaryDStrong: "H0001G",
    dStrong: "H0001G =",
    uStrong: "H0001G",
    auditKey: "hebrew:H0001G",
    auditStepEntryId: 11036,
    auditDStrong: "H0001G =",
    auditUStrong: "H0001G",
    auditDecisionStatus: "accepted",
    auditCanonicalSource: "TBESH",
    sourceAuditStatus: "source_ok",
    sourceAuditRequiresReview: false,
    sourceAuditEntryKey: "hebrew:H0001G",
    sourceAuditPrimaryDStrong: "H0001G",
    sourceAuditDStrong: "H0001G =",
    sourceAuditUStrong: "H0001G",
    sourceSelectionStrategy: "step_primary",
    sourceSelectionSource: "STEP",
    sourceSelectionKind: "brief",
    sourceSelectionAutomatic: true,
    auditRecordDigest: "a".repeat(64)
  };
}
