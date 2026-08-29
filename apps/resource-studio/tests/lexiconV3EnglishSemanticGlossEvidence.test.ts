import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  validateEnglishSemanticGlossEvidence,
  type EnglishEvidenceSourceDigests,
  type EnglishLexiconEntry
} from "../src/lexiconV3/evidence.js";
import {
  buildEnglishSemanticGlossSourceLines,
  PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES
} from "../src/lexiconV3/englishSemanticGlossAttestations.js";
import { PINNED_ENGLISH_EXACT_REPAIR_SOURCES } from "../src/lexiconV3/englishExactRepairs.js";

const SOURCE_DB = resolve(
  "data/dictionaries/strong_lexicon.full.production.sqlite"
);
const SOURCE_DIGESTS: EnglishEvidenceSourceDigests = {
  database: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.database,
  TBESG: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TBESG,
  TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
  TFLSJ: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TFLSJ,
  TAGNT: {},
  TAHOT: {}
};
const SOURCE_LINES = buildEnglishSemanticGlossSourceLines({
  TBESG: readFileSync(resolve("data/external/stepbible/TBESG.txt"), "utf8"),
  TFLSJ: readFileSync(resolve("data/external/stepbible/TFLSJ.txt"), "utf8")
});

test("publishes an exact semantic-gloss attestation and replays it downstream", () => {
  const entry = readGreekEntry("G20011");
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [],
    sourceDigests: SOURCE_DIGESTS,
    semanticGlossSourceLines: SOURCE_LINES
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.decision.status, "accepted");
  assert.ok(
    record.decision.reasonCodes.includes(
      "curated-auto-validated-semantic-gloss-attestation"
    )
  );
  assert.equal(record.evidence.semanticGlossAttestation?.entryKey, record.key);
  assert.deepEqual(validateEnglishSemanticGlossEvidence(record), []);
});

test("fails the registered semantic gloss closed when exact source lines are absent", () => {
  const entry = readGreekEntry("G20011");
  const context = buildEnglishEvidenceContext({
    entries: [entry],
    tokens: [],
    sourceDigests: SOURCE_DIGESTS
  });
  const record = auditEnglishEvidenceEntry(entry, [], context);

  assert.equal(record.evidence.semanticGlossAttestation, null);
  assert.equal(record.decision.status, "quarantined");
  assert.ok(
    record.decision.reasonCodes.includes(
      "semantic-gloss-attestation-evidence-missing"
    )
  );
});

function readGreekEntry(code: string): EnglishLexiconEntry {
  const database = new DatabaseSync(SOURCE_DB, { readOnly: true });
  try {
    const row = database
      .prepare(
        `SELECT id AS stepEntryId, baseCode, language, eStrong, dStrong,
                uStrong, original, transliteration, morph, gloss, meaning
         FROM StepEntries
         WHERE language = 'greek' AND eStrong = ?`
      )
      .get(code) as unknown as EnglishLexiconEntry | undefined;
    assert.ok(row, code);
    return row;
  } finally {
    database.close();
  }
}
