import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  buildStepInterlinearPublication,
  verifyStepInterlinearPublication
} from "../src/stepInterlinearPublication.js";

test("publishes flat STEP text and two structurally identical interlinear databases", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "step-interlinear-publication-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const tahotPath = path.join(directory, "TAHOT fixture.txt");
  const tagntPath = path.join(directory, "TAGNT fixture.txt");
  const lexiconPath = path.join(directory, "lexicon.sqlite");
  const outputDir = path.join(directory, "release");
  await writeFile(
    tahotPath,
    `${tahotLine({
      ref: "Gen.1.1#01=L",
      surface: "בְּ/רֵאשִׁית",
      transliteration: "be./re.Shit",
      gloss: "in/ beginning",
      dStrong: "H9003/{H7225G}",
      morphology: "HR/Ncfsa"
    })}\n`,
    "utf8"
  );
  await writeFile(
    tagntPath,
    [
      tagntLine({
        ref: "Mat.1.1#01=NKO",
        surface: "Βίβλος (Biblos)",
        gloss: "[The] book",
        dStrongAndMorphology: "G0976=N-NSF",
        dictionary: "βίβλος=book",
        editions: "NA28+TR"
      }),
      tagntLine({
        ref: "Mat.1.1#02=K",
        surface: "παραλλαγή (parallagē)",
        gloss: "variant",
        dStrongAndMorphology: "G9999=N-NSF",
        dictionary: "παραλλαγή=variant",
        editions: "TR"
      }),
      tagntLine({
        ref: "Mat.1.1#03=NKO",
        surface: "κἀγώ (kagō)",
        gloss: "I also",
        dStrongAndMorphology: "G1473=P-1NS + G2532=CONJ",
        dictionary: "κἀγώ=and I",
        editions: "NA28+TR"
      })
    ].join("\n"),
    "utf8"
  );
  createLexiconFixture(lexiconPath);

  const summary = await buildStepInterlinearPublication({
    outputDir,
    sourcePaths: [tahotPath, tagntPath],
    lexiconPath
  });
  assert.equal(summary.verseCount, 2);
  assert.equal(summary.tokenCount, 4);
  assert.equal(summary.canonicalTokenCount, 3);
  assert.equal(summary.segmentCount, 6);
  assert.equal(summary.frenchFallbackGlossCount, 1);
  assert.equal(summary.integrityCheck, "ok");

  const bible = JSON.parse(await readFile(summary.textPath, "utf8")) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  assert.equal(bible["1"]!["1"]!["1"], "בְּרֵאשִׁית");
  assert.equal(bible["40"]!["1"]!["1"], "Βίβλος κἀγώ");

  const french = new DatabaseSync(summary.frenchPath, { readOnly: true });
  const english = new DatabaseSync(summary.englishPath, { readOnly: true });
  try {
    const frenchSegments = french
      .prepare(
        `SELECT surface, gloss, glossSource
           FROM TokenSegments
          WHERE tokenId='TAHOT.Gen.1.1.01.L'
          ORDER BY ordinal`
      )
      .all() as unknown as Array<{
      surface: string;
      gloss: string;
      glossSource: string;
    }>;
    assert.deepEqual(
      frenchSegments.map((row) => ({ ...row })),
      [
        {
          surface: "בְּ",
          gloss: "dans",
          glossSource: "lexicon-v3-fr"
        },
        {
          surface: "רֵאשִׁית",
          gloss: "commencement",
          glossSource: "lexicon-v3-fr"
        }
      ]
    );
    const englishGlosses = (
      english
        .prepare(
          `SELECT gloss FROM TokenSegments
            WHERE tokenId='TAHOT.Gen.1.1.01.L' ORDER BY ordinal`
        )
        .all() as unknown as Array<{ gloss: string }>
    ).map(({ gloss }) => gloss);
    assert.deepEqual(englishGlosses, ["in", "beginning"]);

    const strongCodes = french
      .prepare(
        `SELECT c.kind, c.code
           FROM SegmentStrongCodes sc
           JOIN StrongCodes c ON c.id=sc.codeId
          WHERE sc.tokenId='TAHOT.Gen.1.1.01.L'
            AND sc.segmentOrdinal=1
          ORDER BY sc.identityOrder`
      )
      .all() as unknown as Array<{ kind: number; code: string }>;
    assert.deepEqual(
      strongCodes.map((row) => ({ ...row })),
      [
        { kind: 0, code: "H7225" },
        { kind: 2, code: "H7225G" }
      ]
    );

    const trVariant = french
      .prepare(
        `SELECT isCanonical, readingOrdinal, startOffset, length
           FROM Tokens WHERE id='TAGNT.Matt.1.1.02.K'`
      )
      .get() as
      | {
          isCanonical: number;
          readingOrdinal: number | null;
          startOffset: number;
          length: number;
        }
      | undefined;
    assert.deepEqual(
      { ...trVariant },
      {
        isCanonical: 0,
        readingOrdinal: null,
        startOffset: -1,
        length: 0
      }
    );
    const composite = french
      .prepare(
        `SELECT s.ordinal, s.surface, s.morphology, s.gloss,
                group_concat(c.code, ',') AS codes
           FROM TokenSegments s
           JOIN SegmentStrongCodes sc
             ON sc.tokenId=s.tokenId AND sc.segmentOrdinal=s.ordinal
           JOIN StrongCodes c ON c.id=sc.codeId
          WHERE s.tokenId='TAGNT.Matt.1.1.03.NKO'
          GROUP BY s.ordinal
          ORDER BY s.ordinal`
      )
      .all() as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      composite.map((row) => ({ ...row })),
      [
        {
          ordinal: 0,
          surface: "κἀγώ",
          morphology: "P-1NS",
          gloss: "je",
          codes: "G1473"
        },
        {
          ordinal: 1,
          surface: "",
          morphology: "CONJ",
          gloss: "et",
          codes: "G2532"
        }
      ]
    );
  } finally {
    french.close();
    english.close();
  }

  const verification = await verifyStepInterlinearPublication({
    textPath: summary.textPath,
    frenchPath: summary.frenchPath,
    englishPath: summary.englishPath
  });
  assert.equal(verification.integrityCheck, "ok");
  assert.equal(verification.canonicalTokenCount, 3);
});

function tahotLine(input: {
  ref: string;
  surface: string;
  transliteration: string;
  gloss: string;
  dStrong: string;
  morphology: string;
}): string {
  return [
    input.ref,
    input.surface,
    input.transliteration,
    input.gloss,
    input.dStrong,
    input.morphology,
    "",
    "",
    "",
    "",
    "",
    ""
  ].join("\t");
}

function tagntLine(input: {
  ref: string;
  surface: string;
  gloss: string;
  dStrongAndMorphology: string;
  dictionary: string;
  editions: string;
}): string {
  return [
    input.ref,
    input.surface,
    input.gloss,
    input.dStrongAndMorphology,
    input.dictionary,
    input.editions,
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ].join("\t");
}

function createLexiconFixture(filePath: string): void {
  const database = new DatabaseSync(filePath);
  try {
    database.exec(`
      CREATE TABLE StepEntries (
        id INTEGER PRIMARY KEY,
        eStrong TEXT NOT NULL,
        dStrong TEXT NOT NULL,
        uStrong TEXT NOT NULL,
        original TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        gloss TEXT NOT NULL
      );
      CREATE TABLE StepEntryIdentities (
        stepEntryId INTEGER PRIMARY KEY,
        stepCode TEXT NOT NULL UNIQUE
      );
      CREATE TABLE LexiconTranslations (
        stepEntryId INTEGER NOT NULL,
        language TEXT NOT NULL,
        gloss TEXT NOT NULL
      );
    `);
    const insertEntry = database.prepare(
      `INSERT INTO StepEntries(
         id, eStrong, dStrong, uStrong, original, transliteration, gloss
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertIdentity = database.prepare(
      "INSERT INTO StepEntryIdentities(stepEntryId, stepCode) VALUES (?, ?)"
    );
    const insertTranslation = database.prepare(
      `INSERT INTO LexiconTranslations(stepEntryId, language, gloss)
       VALUES (?, 'fr', ?)`
    );
    const entries = [
      [1, "H9003", "H9003", "H9003", "/ב", "be", "in/on/with", "dans/sur/avec"],
      [
        2,
        "H7225",
        "H7225G",
        "H7225G",
        "רֵאשִׁית",
        "re.shit",
        "first: beginning",
        "premier : commencement"
      ],
      [3, "G0976", "G0976", "G0976", "βίβλος", "biblos", "book", "livre"],
      [4, "G1473", "G1473", "G1473", "ἐγώ", "egō", "I/me", "je/moi"],
      [5, "G2532", "G2532", "G2532", "καί", "kai", "and", "et"]
    ] as const;
    for (const [
      id,
      eStrong,
      dStrong,
      uStrong,
      original,
      transliteration,
      glossEn,
      glossFr
    ] of entries) {
      insertEntry.run(
        id,
        eStrong,
        dStrong,
        uStrong,
        original,
        transliteration,
        glossEn
      );
      insertIdentity.run(id, dStrong);
      insertTranslation.run(id, glossFr);
    }
  } finally {
    database.close();
  }
}
