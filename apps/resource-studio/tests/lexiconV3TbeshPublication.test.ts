import assert from "node:assert/strict";
import test from "node:test";

import {
  decideTbeshPublication,
  type DecideTbeshPublicationInput,
  type TbeshExactCompanionProof
} from "../src/lexiconV3/tbeshPublication.js";
import { parseTbeshMeaning } from "../src/lexiconV3/tbeshMeaning.js";

const exactLexicalCompanion: TbeshExactCompanionProof = {
  status: "validated",
  method: "open-scriptures-augmented-exact",
  meaningHtml: "<p>Exact open lexical meaning</p>",
  exactCompanionProven: true
};

function decide(
  rawHtml: string,
  overrides: Partial<DecideTbeshPublicationInput> = {}
) {
  return decideTbeshPublication({
    sections: parseTbeshMeaning(rawHtml),
    properName: true,
    ledgerCategory: null,
    ...overrides
  });
}

test("publishes an audited lexical two-part meaning byte-for-byte", () => {
  const rawHtml = "<b>Specific</b> § <i>Legacy context</i>";
  const decision = decide(rawHtml, {
    properName: false,
    ledgerCategory: "verified_context"
  });

  assert.equal(decision.action, "raw_combined");
  assert.deepEqual(decision.content, { html: rawHtml, source: "tbesh_raw" });
  assert.equal(decision.rawProvenanceHtml, rawHtml);
  assert.deepEqual(decision.quarantinedParts, []);
  assert.deepEqual(decision.reasonCodes, ["tbesh-publish-both-sections"]);
});

test("publishes only the specific part and quarantines a foreign sibling tail", () => {
  const decision = decide("Specific § Foreign sibling", {
    properName: false,
    ledgerCategory: "foreign_sibling",
    stepSpecificScopeProven: true
  });

  assert.equal(decision.action, "step_specific_only");
  assert.deepEqual(decision.content, {
    html: "Specific",
    source: "tbesh_step_specific"
  });
  assert.deepEqual(decision.quarantinedParts, [
    {
      part: "legacy_general",
      html: "Foreign sibling",
      reasonCode: "tbesh-publish-foreign-sibling-specific-section"
    }
  ]);
});

test("replaces a source conflict only with an explicitly proven exact companion", () => {
  const rawHtml = "Conflicted § Context";
  const decision = decide(rawHtml, {
    properName: false,
    ledgerCategory: "source_conflict",
    companion: exactLexicalCompanion
  });

  assert.equal(decision.action, "exact_companion");
  assert.deepEqual(decision.content, {
    html: exactLexicalCompanion.meaningHtml,
    source: "hebrew_english_exact_companion"
  });
  assert.equal(decision.rawProvenanceHtml, rawHtml);
  assert.deepEqual(decision.quarantinedParts, [
    {
      part: "raw_combined",
      html: rawHtml,
      reasonCode: "tbesh-replace-source-conflict-with-exact-companion"
    }
  ]);
});

test("uses a proven exact companion when a two-part raw notice failed its gate", () => {
  const decision = decide("Questioned specific § Family context", {
    properName: false,
    ledgerCategory: "verified_context",
    rawAssessmentStatus: "review_needed",
    companion: exactLexicalCompanion
  });

  assert.equal(decision.action, "exact_companion");
  assert.deepEqual(decision.reasonCodes, [
    "tbesh-replace-unvalidated-raw-with-exact-companion"
  ]);
});

test("replaces an unvalidated unsectioned notice only with an exact companion", () => {
  const published = decide("Questioned unsectioned raw", {
    properName: false,
    rawAssessmentStatus: "review_needed",
    companion: {
      ...exactLexicalCompanion,
      method: "hebrew-strong-exact"
    }
  });
  assert.equal(published.action, "exact_companion");
  assert.deepEqual(published.reasonCodes, [
    "tbesh-replace-unvalidated-unsectioned-with-exact-companion"
  ]);

  const blocked = decide("Questioned unsectioned raw", {
    properName: false,
    rawAssessmentStatus: "review_needed"
  });
  assert.equal(blocked.action, "blocked");
  assert.ok(
    blocked.reasonCodes.includes(
      "tbesh-block-unvalidated-unsectioned-without-exact-companion"
    )
  );

  const raw = decide("Validated unsectioned raw", {
    properName: false,
    rawAssessmentStatus: "validated"
  });
  assert.equal(raw.action, "raw_combined");
  assert.deepEqual(raw.reasonCodes, ["tbesh-publish-unsectioned-raw"]);
});

test("never publishes an unsectioned proper notice automatically", () => {
  const published = decide("Named entity notice", {
    rawAssessmentStatus: "validated",
    companion: exactLexicalCompanion
  });
  assert.equal(published.action, "exact_companion");
  assert.deepEqual(published.reasonCodes, [
    "tbesh-replace-proper-unsectioned-with-exact-companion"
  ]);

  const blocked = decide("Named entity notice", {
    rawAssessmentStatus: "validated"
  });
  assert.equal(blocked.action, "blocked");
  assert.ok(
    blocked.reasonCodes.includes(
      "tbesh-block-proper-unsectioned-without-exact-companion"
    )
  );
});

test("publishes only an exactly scoped proper STEP section", () => {
  const decision = decide("Exact person § Family context", {
    stepSpecificScopeProven: true
  });
  assert.equal(decision.action, "step_specific_only");
  assert.equal(decision.content?.html, "Exact person");
  assert.deepEqual(decision.reasonCodes, [
    "tbesh-publish-proper-exact-specific-section"
  ]);
  assert.equal(decision.quarantinedParts[0]?.html, "Family context");
});

test("restores a semantically proven canonical raw notice byte-for-byte", () => {
  const rawHtml = "Questioned <b>raw</b> § base Strong context";
  const decision = decide(rawHtml, {
    properName: false,
    ledgerCategory: "verified_context",
    rawAssessmentStatus: "review_needed",
    canonicalRawProof: "direct_semantic_support",
    companion: exactLexicalCompanion
  });

  assert.equal(decision.action, "raw_combined");
  assert.equal(decision.content?.html, rawHtml);
  assert.match(decision.content?.html ?? "", /§/u);
  assert.deepEqual(decision.reasonCodes, [
    "tbesh-publish-canonical-raw-direct-semantic-support"
  ]);
});

test("publishes only byte-exact source sections selected by sealed adjudication", () => {
  const step = decide("Exact person § Wrong sibling", {
    canonicalSelection: {
      action: "step_specific_only",
      html: "Exact person",
      proof: "sealed_semantic_adjudication"
    }
  });
  assert.equal(step.action, "step_specific_only");
  assert.equal(step.content?.source, "tbesh_step_specific");

  const legacy = decide("Wrong person § Exact lexical definition", {
    canonicalSelection: {
      action: "legacy_general_only",
      html: "Exact lexical definition",
      proof: "sealed_semantic_adjudication"
    }
  });
  assert.equal(legacy.action, "legacy_general_only");
  assert.equal(legacy.content?.source, "tbesh_legacy_general");

  const forged = decide("Exact person § Wrong sibling", {
    canonicalSelection: {
      action: "step_specific_only",
      html: "Changed person",
      proof: "sealed_semantic_adjudication"
    }
  });
  assert.equal(forged.action, "blocked");
  assert.deepEqual(forged.reasonCodes, [
    "tbesh-block-canonical-selection-source-mismatch"
  ]);
});

test("labels a sealed reconstruction as editorial content", () => {
  const html = "<p>Corrected and independently audited notice</p>";
  const decision = decide("Conflicted raw", {
    canonicalSelection: {
      action: "editorial_reconstruction",
      html,
      proof: "sealed_semantic_adjudication"
    }
  });

  assert.equal(decision.action, "editorial_reconstruction");
  assert.deepEqual(decision.content, {
    html,
    source: "lexicon_v3_hebrew_adjudication"
  });
  assert.equal(decision.quarantinedParts[0]?.html, "Conflicted raw");
});

test("never lets canonical raw support override a positive section conflict", () => {
  const decision = decide("Specific § conflicting tail", {
    properName: false,
    ledgerCategory: "source_conflict",
    canonicalRawProof: "direct_semantic_support",
    companion: exactLexicalCompanion
  });

  assert.equal(decision.action, "exact_companion");
  assert.deepEqual(decision.reasonCodes, [
    "tbesh-replace-source-conflict-with-exact-companion"
  ]);
});

test("blocks a source conflict when the exact proof flag is absent", () => {
  const decision = decide("Conflicted § Context", {
    properName: false,
    ledgerCategory: "source_conflict",
    companion: { ...exactLexicalCompanion, exactCompanionProven: false }
  });

  assert.equal(decision.action, "blocked");
  assert.equal(decision.content, null);
  assert.deepEqual(decision.reasonCodes, [
    "tbesh-block-source-conflict-without-exact-companion",
    "tbesh-exact-companion-not-explicitly-proven"
  ]);
});

test("requires a TIPNR/TAHOT intersection for an exact TIPNR companion", () => {
  const companion: TbeshExactCompanionProof = {
    status: "validated",
    method: "tipnr-exact-dstrong",
    meaningHtml: "Exact person",
    exactCompanionProven: true
  };
  const blockedDecision = decide("§ Legacy person", { companion });
  assert.deepEqual(blockedDecision.reasonCodes, [
    "tbesh-block-proper-legacy-without-exact-companion",
    "tbesh-exact-tipnr-tahot-intersection-missing"
  ]);

  const publishedDecision = decide("§ Legacy person", {
    companion: {
      ...companion,
      exactTipnrTahotReferenceIntersection: true
    }
  });
  assert.equal(publishedDecision.action, "exact_companion");
  assert.deepEqual(publishedDecision.reasonCodes, [
    "tbesh-replace-proper-legacy-with-exact-companion"
  ]);
});

test("keeps audited legacy-only lexical context", () => {
  const rawHtml = "§ <p>Verified lexical context</p>";
  const decision = decide(rawHtml, {
    properName: false,
    ledgerCategory: "verified_context"
  });

  assert.equal(decision.action, "raw_combined");
  assert.deepEqual(decision.content, { html: rawHtml, source: "tbesh_raw" });
  assert.deepEqual(decision.reasonCodes, [
    "tbesh-publish-verified-legacy-context"
  ]);
});

test("publishes a specific-only meaning without its separator", () => {
  const decision = decide("<p>Specific</p> § <br>", {
    properName: false,
    ledgerCategory: "empty_tail",
    stepSpecificScopeProven: true
  });

  assert.equal(decision.action, "step_specific_only");
  assert.deepEqual(decision.content, {
    html: "<p>Specific</p>",
    source: "tbesh_step_specific"
  });
  assert.deepEqual(decision.quarantinedParts, []);
});

test("does not publish a specific section from the ledger label alone", () => {
  const decision = decide("Specific § Foreign sibling", {
    properName: false,
    ledgerCategory: "foreign_sibling"
  });

  assert.equal(decision.action, "blocked");
  assert.ok(
    decision.reasonCodes.includes(
      "tbesh-block-foreign-sibling-without-publishable-content"
    )
  );
});

test("fails closed for empty, malformed, unreviewed, and unsupported companion inputs", () => {
  assert.equal(decide("<br> § &nbsp;").action, "blocked");
  assert.deepEqual(decide("Specific § Legacy § Extra").reasonCodes, [
    "tbesh-block-multiple-section-separators"
  ]);
  assert.deepEqual(
    decide("Specific § Legacy", {
      properName: false,
      ledgerCategory: "unreviewed"
    }).reasonCodes,
    ["tbesh-block-unreviewed-lexical-section"]
  );
  assert.deepEqual(
    decide("§ Legacy proper name", {
      companion: {
        status: "validated",
        method: "hebrew-strong-substep-anchor",
        meaningHtml: "Fallback",
        exactCompanionProven: true
      }
    }).reasonCodes,
    [
      "tbesh-block-proper-legacy-without-exact-companion",
      "tbesh-exact-companion-method-not-allowed"
    ]
  );
});

test("detects forged parsed sections and preserves their raw source in quarantine", () => {
  const sections = parseTbeshMeaning("Specific § Legacy");
  const decision = decideTbeshPublication({
    sections: { ...sections, stepSpecificHtml: "Changed" },
    properName: true,
    ledgerCategory: null
  });

  assert.equal(decision.action, "blocked");
  assert.equal(decision.rawProvenanceHtml, sections.rawHtml);
  assert.deepEqual(decision.reasonCodes, ["tbesh-block-inconsistent-sections"]);
  assert.equal(decision.quarantinedParts[0]?.html, sections.rawHtml);
});
