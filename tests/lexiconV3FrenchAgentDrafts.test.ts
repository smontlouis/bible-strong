import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFrenchInternalAuditorDraft,
  assertFrenchInternalProposerDraft,
  FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION,
  renderFrenchInternalProposerDraft
} from "../src/lexiconV3/frenchAgentDrafts.js";
import { buildFrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

const INPUT_HASH = "a".repeat(64);

test("validates exact segment coverage and renders a proposer draft locally", () => {
  const packet = fixturePacket();
  const draft = assertFrenchInternalProposerDraft(
    {
      schemaVersion: FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION,
      role: "proposerA",
      entryKey: packet.entryKey,
      inputHash: INPUT_HASH,
      glossFr: "parole",
      meaningSegmentsFr: [
        { id: "t0", text: "Un" },
        { id: "t1", text: "λόγος" },
        { id: "t2", text: "signifie une parole." }
      ],
      entityMentionsFr: [],
      notesFr: "",
      carrierTermsFr: ["parole"],
      confidence: 0.97
    },
    "proposerA",
    packet,
    INPUT_HASH
  );
  const rendered = renderFrenchInternalProposerDraft(draft, packet, "agent-a");
  assert.equal(
    rendered.proposal.meaningHtmlFr,
    "<p>Un <b>λόγος</b> signifie une parole.</p>"
  );
  assert.deepEqual(rendered.validation.issues, []);
});

test("rejects missing segments and stale view hashes", () => {
  const packet = fixturePacket();
  const base = {
    schemaVersion: FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION,
    role: "proposerB",
    entryKey: packet.entryKey,
    inputHash: INPUT_HASH,
    glossFr: "parole",
    meaningSegmentsFr: [
      { id: "t0", text: "Un" },
      { id: "t1", text: "λόγος" },
      { id: "t2", text: "signifie une parole." }
    ],
    entityMentionsFr: [],
    notesFr: "",
    carrierTermsFr: [],
    confidence: 0.95
  };
  assert.throws(
    () =>
      assertFrenchInternalProposerDraft(
        { ...base, meaningSegmentsFr: base.meaningSegmentsFr.slice(0, 2) },
        "proposerB",
        packet,
        INPUT_HASH
      ),
    /segment-coverage-mismatch/u
  );
  assert.throws(
    () =>
      assertFrenchInternalProposerDraft(
        { ...base, inputHash: "b".repeat(64) },
        "proposerB",
        packet,
        INPUT_HASH
      ),
    /input-hash-mismatch/u
  );
});

test("refuses a safe auditor verdict unless every check passes", () => {
  const checks = Object.fromEntries(
    [
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
      "siblingStepConsistency",
      "entityMentionsConform"
    ].map((key) => [key, "pass"])
  );
  assert.doesNotThrow(() =>
    assertFrenchInternalAuditorDraft(
      {
        schemaVersion: FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION,
        role: "auditor",
        entryKey: "greek:G3056",
        inputHash: INPUT_HASH,
        verdict: "safe",
        reasons: [],
        confidence: 0.97,
        checks
      },
      "greek:G3056",
      INPUT_HASH
    )
  );
  assert.throws(
    () =>
      assertFrenchInternalAuditorDraft(
        {
          schemaVersion: FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION,
          role: "auditor",
          entryKey: "greek:G3056",
          inputHash: INPUT_HASH,
          verdict: "safe",
          reasons: [],
          confidence: 0.97,
          checks: { ...checks, naturalFrench: "fail" }
        },
        "greek:G3056",
        INPUT_HASH
      ),
    /unsafe-french-auditor-safe-verdict/u
  );
});

function fixturePacket() {
  return buildFrenchPacket(
    {
      entryKey: "greek:G3056",
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: "greek:G3056",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>"
      }),
      identity: {
        stepEntryId: 3056,
        language: "greek",
        eStrong: "G3056",
        dStrong: "G3056",
        uStrong: "G3056",
        original: "λόγος",
        transliteration: "logos",
        morph: "N"
      },
      english: {
        contentHash: "e".repeat(64),
        status: "validated",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>",
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: [],
        references: [],
        originalTokens: ["λόγος"]
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}
