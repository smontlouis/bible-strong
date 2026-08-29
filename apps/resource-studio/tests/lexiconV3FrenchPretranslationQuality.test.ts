import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { runFrenchPretranslationAudit } from "../scripts/auditLexiconV3FrenchPretranslation.js";
import {
  auditFrenchPretranslationPacket,
  assertFrenchPacketTranslatable,
  buildFrenchPretranslationFamilyIndex
} from "../src/lexiconV3/frenchPretranslationQuality.js";
import {
  buildFrenchPacket,
  type FrenchPacketInput,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  validateFrenchProposal
} from "../src/lexiconV3/frenchValidation.js";
import { lintLexiconGloss } from "../src/lexiconV3/lexiconGlossQuality.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("blocks the incomplete G0567 exact sub-STEP source without rewriting it", () => {
  const packet = makePacket({
    entryKey: "greek:G0567",
    identity: {
      stepEntryId: 585,
      language: "greek",
      eStrong: "G0567",
      dStrong: "G0567 = a Form of",
      uStrong: "G0568",
      original: "ἀπέχομαι",
      transliteration: "apechomai",
      morph: "G:V"
    },
    english: {
      contentHash: "english-g0567",
      status: "validated",
      gloss: "to refrain/",
      meaning: "refrain, receive/be far, keep away from",
      meaningHtml: "refrain, receive/be far, keep away from",
      sources: ["step-tbesg"],
      issues: []
    }
  });
  const family = buildFrenchPretranslationFamilyIndex([
    makeStepFamilyPacket(
      "greek:G0566",
      584,
      "G0566",
      "G0566 = a Form of",
      "ἀπέχει",
      "to receive/avoid"
    ),
    packet,
    makeStepFamilyPacket(
      "greek:G0568",
      586,
      "G0568",
      "G0568 =",
      "ἀπέχω",
      "to have in full"
    )
  ]).get("G0568");
  const sourceBefore = JSON.stringify(packet);

  const audit = auditFrenchPretranslationPacket(packet, {
    familyMembers: family
  });

  assert.equal(audit.gateStatus, "source_issue");
  assert.equal(audit.translationAllowed, false);
  assert.equal(audit.exactStepIdentity.isSubStep, true);
  assert.ok(
    audit.issues.some((issue) => issue.code === "english-gloss-trailing-slash")
  );
  assert.deepEqual(
    audit.sourceRepairContext?.familyMembers.map((member) => member.entryKey),
    ["greek:G0566", "greek:G0567", "greek:G0568"]
  );
  assert.equal(
    audit.sourceRepairContext?.currentOccurrenceAttestation,
    "not-attested-in-packet"
  );
  assert.equal(audit.sourceRepairContext?.contentPreserved, true);
  assert.ok(
    audit.issues.some(
      (issue) => issue.code === "step-subentry-english-gloss-incomplete"
    )
  );
  assert.equal(JSON.stringify(packet), sourceBefore);
  assert.throws(
    () => assertFrenchPacketTranslatable(packet),
    /french-pretranslation-source-issue:greek:G0567/u
  );
});

test("does not classify an autonomous five-digit LXX Strong as a sub-STEP", () => {
  const packet = makePacket({
    entryKey: "greek:G21425",
    identity: {
      stepEntryId: 21425,
      language: "greek",
      eStrong: "G21425",
      dStrong: "G21425 =",
      uStrong: "G21425",
      original: "Αδασαι",
      transliteration: "",
      morph: "G:N-PRI"
    },
    english: {
      contentHash: "english-g21425",
      status: "validated",
      gloss: "Adasai",
      meaning: "A name occurring in the Septuagint.",
      meaningHtml: "<p>A name occurring in the Septuagint.</p>",
      sources: ["step-tbesg"],
      issues: []
    }
  });

  const audit = auditFrenchPretranslationPacket(packet);

  assert.equal(audit.exactStepIdentity.isSubStep, false);
});

test("accepts a real STEP interjection while routing ordinary punctuation to review", () => {
  const interjection = auditFrenchPretranslationPacket(
    makePacket({
      entryKey: "greek:G0001H",
      identity: {
        ...baseInput.identity,
        dStrong: "G0001H =",
        eStrong: "G0001",
        uStrong: "G0001H",
        morph: "G:INJ"
      },
      english: {
        ...baseInput.english,
        gloss: "ah!"
      }
    })
  );
  const ordinary = auditFrenchPretranslationPacket(
    makePacket({
      english: {
        ...baseInput.english,
        gloss: "scroll."
      }
    })
  );

  assert.equal(interjection.gateStatus, "ready");
  assert.equal(ordinary.gateStatus, "review_needed");
  assert.ok(
    ordinary.issues.some(
      (issue) => issue.code === "english-gloss-terminal-punctuation"
    )
  );
});

test("lints obvious English and French headword fragments deterministically", () => {
  assert.deepEqual(
    lintLexiconGloss({ language: "en", gloss: "a form of" }).map(
      (issue) => issue.status
    ),
    ["source_issue"]
  );
  assert.ok(
    lintLexiconGloss({ language: "fr", gloss: "une variante de" }).some(
      (issue) => issue.code === "french-gloss-obvious-fragment"
    )
  );
  assert.deepEqual(
    lintLexiconGloss({
      language: "fr",
      gloss: "ah !",
      morph: "G:INJ",
      counterpartGloss: "ah!"
    }),
    []
  );
  assert.deepEqual(
    lintLexiconGloss({
      language: "en",
      gloss: "woe!",
      morph: "H:Intj"
    }),
    []
  );
  assert.deepEqual(
    lintLexiconGloss({
      language: "en",
      gloss: "where?",
      morph: "H:Intg"
    }),
    []
  );
  assert.deepEqual(lintLexiconGloss({ language: "en", gloss: "or" }), []);
  assert.deepEqual(lintLexiconGloss({ language: "en", gloss: "aršan-" }), []);
  assert.deepEqual(lintLexiconGloss({ language: "fr", gloss: "&amp;" }), []);
});

test("forces review for any non-empty translator note and blocks a trailing French slash", () => {
  const withNote = validateFrenchProposal(
    makeProposal({ notesFr: "Choix à vérifier dans ce sous-sens." }),
    validationContext
  );
  const incomplete = validateFrenchProposal(
    makeProposal({ glossFr: "s'abstenir/" }),
    validationContext
  );
  const interjection = validateFrenchProposal(
    makeProposal({
      glossFr: "ah !",
      meaningFr: "Interjection de plainte.",
      meaningHtmlFr: "<p>Interjection de plainte.</p>"
    }),
    {
      ...validationContext,
      englishGloss: "ah!",
      morph: "G:INJ"
    }
  );

  assert.equal(withNote.canPublishDisplay, true);
  assert.equal(withNote.requiresHumanReview, true);
  assert.ok(
    withNote.issues.some((issue) => issue.code === "translator-notes-present")
  );
  assert.equal(incomplete.canPublishDisplay, false);
  assert.ok(
    incomplete.issues.some((issue) => issue.code === "gloss-trailing-slash")
  );
  assert.equal(
    interjection.issues.some(
      (issue) => issue.code === "gloss-terminal-punctuation"
    ),
    false
  );
});

test("writes a complete fail-closed corpus report before translation", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "lexicon-v3-fr-pretranslation-")
  );
  const input = path.join(directory, "packets.jsonl");
  const output = path.join(directory, "audit.jsonl");
  const summaryJson = path.join(directory, "summary.json");
  const report = path.join(directory, "report.md");
  const ready = makePacket();
  const blocked = makePacket({
    entryKey: "greek:G0567",
    identity: {
      ...baseInput.identity,
      stepEntryId: 585,
      eStrong: "G0567",
      dStrong: "G0567 = a Form of",
      uStrong: "G0568"
    },
    english: {
      ...baseInput.english,
      contentHash: "english-g0567",
      gloss: "to refrain/"
    }
  });
  await writeFile(
    input,
    `${JSON.stringify(ready)}\n${JSON.stringify(blocked)}\n`
  );

  const summary = await runFrenchPretranslationAudit({
    input,
    output,
    summaryJson,
    report,
    failOn: "source_issue",
    generatedAt: "2026-07-13T00:00:00.000Z"
  });

  assert.equal(summary.gatePassed, false);
  assert.deepEqual(summary.counts, {
    entries: 2,
    ready: 1,
    review_needed: 0,
    source_issue: 1,
    translationAllowed: 1,
    autoPublicationAllowed: 1
  });
  assert.equal((await readFile(output, "utf8")).trim().split("\n").length, 2);
  assert.match(await readFile(report, "utf8"), /Gate: \*\*FAIL\*\*/u);
  assert.match(await readFile(summaryJson, "utf8"), /"source_issue": 1/u);
});

const baseInput: FrenchPacketInput = {
  entryKey: "greek:G2777",
  englishRelease: frenchPacketFixtureEnglishRelease({
    entryKey: "greek:G2777",
    gloss: "scroll",
    meaning: "A roll of parchment.",
    meaningHtml: "<p>A roll of parchment.</p>"
  }),
  identity: {
    stepEntryId: 2777,
    language: "greek",
    eStrong: "G2777",
    dStrong: "G2777 =",
    uStrong: "G2777",
    original: "κεφαλίς",
    transliteration: "kephalis",
    morph: "G:N"
  },
  english: {
    contentHash: "english-hash",
    status: "validated",
    gloss: "scroll",
    meaning: "A roll of parchment.",
    meaningHtml: "<p>A roll of parchment.</p>",
    sources: ["step-tbesg"],
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
    originalTokens: []
  }
};

function makePacket(
  overrides: Partial<FrenchPacketInput> = {}
): LexiconV3FrenchPacket {
  const merged = {
    ...baseInput,
    ...overrides,
    english: {
      ...baseInput.english,
      ...overrides.english
    }
  };
  return buildFrenchPacket(
    {
      ...merged,
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: merged.entryKey,
        gloss: merged.english.gloss,
        meaning: merged.english.meaning,
        meaningHtml: merged.english.meaningHtml
      })
    },
    "2026-07-13T00:00:00.000Z"
  );
}

function makeStepFamilyPacket(
  entryKey: string,
  stepEntryId: number,
  eStrong: string,
  dStrong: string,
  original: string,
  gloss: string
): LexiconV3FrenchPacket {
  return makePacket({
    entryKey,
    identity: {
      ...baseInput.identity,
      stepEntryId,
      eStrong,
      dStrong,
      uStrong: "G0568",
      original
    },
    english: {
      ...baseInput.english,
      contentHash: `english-${entryKey}`,
      gloss
    }
  });
}

const validationContext: FrenchValidationContext = {
  entryKey: "greek:G2777",
  englishHash: "english-hash",
  englishStatus: "validated",
  englishGloss: "scroll",
  englishMeaning: "A roll of parchment.",
  original: "κεφαλίς",
  morph: "G:N",
  concordanceForms: []
};

function makeProposal(
  overrides: Partial<FrenchLexiconProposal> = {}
): FrenchLexiconProposal {
  return {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: "greek:G2777",
    derivedFromEnglishHash: "english-hash",
    model: "internal-agent/test",
    glossFr: "rouleau",
    meaningSegmentsFr: [],
    entityMentionsFr: [],
    meaningFr: "Un rouleau de parchemin.",
    meaningHtmlFr: "<p>Un rouleau de parchemin.</p>",
    notesFr: "",
    carrierTermsFr: ["rouleau"],
    confidence: 0.95,
    ...overrides
  };
}
