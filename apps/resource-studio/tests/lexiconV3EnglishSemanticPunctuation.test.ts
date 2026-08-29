import assert from "node:assert/strict";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  attestEnglishSemanticTerminalPunctuation,
  ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST,
  ENGLISH_SEMANTIC_PUNCTUATION_RULES,
  EXPECTED_ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST,
  validateEnglishSemanticPunctuationEvidence
} from "../src/lexiconV3/englishSemanticPunctuation.js";
import {
  applyEnglishExactRepairs,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import { lintLexiconGloss } from "../src/lexiconV3/lexiconGlossQuality.js";

const SOURCE_DATABASE = resolve(
  "data/dictionaries/strong_lexicon.full.production.sqlite"
);
const RECONSTRUCTED_G8216: EnglishExactRepairEntry = {
  language: "greek",
  eStrong: "G8216",
  dStrong: "G8216 =",
  uStrong: "G8216",
  original: "μᾶ",
  transliteration: "ma",
  morph: "",
  gloss: "mother!",
  meaning:
    "<b>μᾶ</b>, a shortened Doric vocative of <b>μάτηρ</b> (“mother”), used in direct address; e.g. <b>μᾶ γᾶ</b>, “Mother Earth,” for <b>μῆτερ γῆ</b>."
};

test("pins all exact semantic punctuation attestations by registry digest", () => {
  assert.equal(ENGLISH_SEMANTIC_PUNCTUATION_RULES.size, 19);
  assert.equal(
    ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST,
    EXPECTED_ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST
  );
});

test("replays semantic punctuation against all exact source rows", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const readEntry = database.prepare(`
      SELECT language, eStrong, dStrong, uStrong, original, transliteration,
             morph, gloss, meaning
      FROM StepEntries
      WHERE language = ? AND dStrong LIKE ?
    `);
    for (const rule of ENGLISH_SEMANTIC_PUNCTUATION_RULES.values()) {
      const entry =
        rule.entryKey === "greek:G8216"
          ? RECONSTRUCTED_G8216
          : (readEntry.get(
              rule.entryKey.startsWith("greek:") ? "greek" : "hebrew",
              `${rule.entryKey.split(":")[1]} %`
            ) as unknown as EnglishExactRepairEntry | undefined);
      assert.ok(entry, rule.entryKey);
      const evidence = attestEnglishSemanticTerminalPunctuation(entry);
      assert.ok(evidence, rule.entryKey);
      assert.equal(evidence.punctuation, rule.punctuation, rule.entryKey);
      assert.deepEqual(
        validateEnglishSemanticPunctuationEvidence({ entry, evidence }),
        [],
        rule.entryKey
      );
      assert.deepEqual(
        lintLexiconGloss({
          language: "en",
          gloss: entry.gloss,
          morph: entry.morph,
          semanticTerminalPunctuation: evidence.punctuation
        }).filter(
          (issue) => issue.code === "english-gloss-terminal-punctuation"
        ),
        [],
        rule.entryKey
      );
    }
  } finally {
    database.close();
  }
});

test("replays G20727 punctuation through its complete exact morph repair", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const sourceEntry = database
      .prepare(
        `SELECT language, eStrong, dStrong, uStrong, original,
                transliteration, morph, gloss, meaning
         FROM StepEntries
         WHERE language = 'greek' AND dStrong LIKE 'G20727 %'`
      )
      .get() as unknown as EnglishExactRepairEntry;
    const replay = applyEnglishExactRepairs(sourceEntry, {
      databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
      sourceDigests: {
        TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
        TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH
      }
    });
    assert.ok(replay);
    assert.equal(replay.entry.morph, "G:PRT-N + G:PRT-N");

    const evidence = attestEnglishSemanticTerminalPunctuation(replay.entry);
    assert.ok(evidence);
    assert.equal(evidence.punctuation, "?");
    assert.equal(
      evidence.sourceRecordDigest,
      "28b716dffe623e43c665f0247938c4e04337f5751e70e157ca93c3b6f63d0c1a"
    );
    assert.deepEqual(
      validateEnglishSemanticPunctuationEvidence({
        entry: replay.entry,
        evidence
      }),
      []
    );
    assert.equal(
      attestEnglishSemanticTerminalPunctuation({
        ...replay.entry,
        morph: "G:PRT-N"
      }),
      null
    );
  } finally {
    database.close();
  }
});

test("does not suppress punctuation review after content or punctuation drift", () => {
  const exact = attestEnglishSemanticTerminalPunctuation(RECONSTRUCTED_G8216);
  assert.ok(exact);
  assert.equal(
    attestEnglishSemanticTerminalPunctuation({
      ...RECONSTRUCTED_G8216,
      meaning: RECONSTRUCTED_G8216.meaning.replace("direct address", "address")
    }),
    null
  );
  assert.deepEqual(
    validateEnglishSemanticPunctuationEvidence({
      entry: RECONSTRUCTED_G8216,
      evidence: { ...exact, punctuation: "?" }
    }),
    ["english-semantic-punctuation-evidence-replay-mismatch"]
  );
  assert.ok(
    lintLexiconGloss({
      language: "en",
      gloss: "mother!",
      semanticTerminalPunctuation: "?"
    }).some((issue) => issue.code === "english-gloss-terminal-punctuation")
  );
});
