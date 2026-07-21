import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyEnglishExactRepairs,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import {
  assertNoForeignFullMeaningSuffixes,
  findForeignFullMeaningSuffixes
} from "../src/lexiconV3/englishMeaningContamination.js";
import { buildLexiconEntryKey } from "../src/lexiconV3/identity.js";

const DATABASE = "data/dictionaries/strong_lexicon.full.production.sqlite";

test("detects every raw foreign full-notice suffix and reaches zero after exact repairs", () => {
  const database = new DatabaseSync(DATABASE, { readOnly: true });
  try {
    const rows = database
      .prepare(
        `select language, eStrong, dStrong, uStrong, original,
                transliteration, morph, gloss, meaning
         from StepEntries order by id`
      )
      .all() as unknown as EnglishExactRepairEntry[];
    const entries = rows.map((row) => ({
      key: buildLexiconEntryKey(row.language, row.dStrong),
      language: row.language,
      meaning: row.meaning
    }));
    const rawFindings = findForeignFullMeaningSuffixes(entries);
    const canaries = [
      ["greek:G1605", "greek:G1167", 671],
      ["greek:G1933", "greek:G1932", 316],
      ["greek:G2532", "greek:G1437", 2348],
      ["greek:G3043", "greek:G3037", 184],
      ["greek:G3385", "greek:G1487G", 350],
      ["greek:G4461", "greek:G4462", 362],
      ["greek:G4632", "greek:G2932", 704]
    ] as const;
    for (const [ownerKey, foreignKey, suffixOffset] of canaries) {
      assert.ok(
        rawFindings.some(
          (finding) =>
            finding.ownerKey === ownerKey &&
            finding.foreignKey === foreignKey &&
            finding.suffixOffset === suffixOffset
        ),
        `${ownerKey}->${foreignKey}`
      );
    }
    assert.throws(
      () => assertNoForeignFullMeaningSuffixes(entries),
      (error) => {
        assert.ok(error instanceof Error);
        for (const [ownerKey, foreignKey, suffixOffset] of canaries) {
          assert.ok(
            error.message.includes(
              `${ownerKey}->${foreignKey}@${String(suffixOffset)}`
            )
          );
        }
        return true;
      }
    );

    const repairContext = {
      databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
      sourceDigests: {
        TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
        TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
        TIPNR: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TIPNR
      }
    } as const;
    const repairedEntries = rows.map((row) => {
      const repair = applyEnglishExactRepairs(row, repairContext);
      return {
        key: buildLexiconEntryKey(row.language, row.dStrong),
        language: row.language,
        meaning: repair?.entry.meaning ?? row.meaning
      };
    });
    assertNoForeignFullMeaningSuffixes(repairedEntries);
  } finally {
    database.close();
  }
});

test("does not confuse an internal bold section with another complete notice", () => {
  const entries = [
    {
      key: "greek:GTEST1",
      language: "greek",
      meaning: `${"prefix ".repeat(25)}<b>second sense</b>${" detail".repeat(50)}`
    },
    {
      key: "greek:GTEST2",
      language: "greek",
      meaning: `<b>different notice</b>${" detail".repeat(50)}`
    }
  ];
  assert.deepEqual(findForeignFullMeaningSuffixes(entries), []);
});
