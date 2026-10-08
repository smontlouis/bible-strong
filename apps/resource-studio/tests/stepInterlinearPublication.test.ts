import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  buildStepInterlinearPublication,
  isStepTokenReferenceField,
  parseStepTokenReference,
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

test("reads a STEP token reference with the other numbering of its word", () => {
  const coordinates = (input: string) => {
    const reference = parseStepTokenReference(input);
    return (
      reference && {
        mainRef: reference.mainRef,
        alternateRefs: reference.alternateRefs,
        rawTokenIndex: reference.rawTokenIndex,
        tokenType: reference.tokenType
      }
    );
  };

  assert.deepEqual(coordinates("Gen.1.1#01=L"), {
    mainRef: "Gen.1.1",
    alternateRefs: [],
    rawTokenIndex: "01",
    tokenType: "L"
  });
  // Round brackets: the Hebrew numbering in TAHOT, Nestle-Aland in TAGNT.
  assert.deepEqual(coordinates("Gen.31.55(32.1)#01=L"), {
    mainRef: "Gen.31.55",
    alternateRefs: ["Gen.32.1"],
    rawTokenIndex: "01",
    tokenType: "L"
  });
  assert.deepEqual(coordinates("Act.13.39(13.38)#02=NKO"), {
    mainRef: "Acts.13.39",
    alternateRefs: ["Acts.13.38"],
    rawTokenIndex: "02",
    tokenType: "NKO"
  });
  // Square brackets: the KJV numbers the word differently.
  assert.deepEqual(coordinates("Php.1.16[1.17]#11=NKO"), {
    mainRef: "Phil.1.16",
    alternateRefs: ["Phil.1.17"],
    rawTokenIndex: "11",
    tokenType: "NKO"
  });
  assert.deepEqual(coordinates("Rev.12.18[13.1]#07=N(K)O"), {
    mainRef: "Rev.12.18",
    alternateRefs: ["Rev.13.1"],
    rawTokenIndex: "07",
    tokenType: "N(K)O"
  });
  // Curly brackets: another edition places the word elsewhere.
  assert.deepEqual(coordinates("Rom.16.25{14.24}#01=NKO"), {
    mainRef: "Rom.16.25",
    alternateRefs: ["Rom.14.24"],
    rawTokenIndex: "01",
    tokenType: "NKO"
  });
  assert.deepEqual(coordinates("\uFEFFGen.4.8#0501=X"), {
    mainRef: "Gen.4.8",
    alternateRefs: [],
    rawTokenIndex: "0501",
    tokenType: "X"
  });

  for (const unsupported of [
    "Mat.1.1<1.2>#01=NKO",
    "Mat.1.1[1.2)#01=NKO",
    "Mat.1.1[1.2][1.3]#01=NKO",
    "Mat.1.1a#01=NKO",
    "Mat.1.1#01",
    "Mat.1.1#=NKO",
    " Mat.1.1#01=NKO",
    "Xyz.1.1#01=NKO"
  ]) {
    assert.equal(parseStepTokenReference(unsupported), undefined, unsupported);
    assert.equal(isStepTokenReferenceField(unsupported), true, unsupported);
  }
});

test("tells STEP token lines from the other lines of a source file", () => {
  for (const field of [
    "",
    "TAGNT Mat-Jhn - Translators Amalgamated Greek NT",
    "Reference:",
    "Word & Type",
    "Eng (Heb) Ref & Type",
    "Ref: Eng (+Heb)#Heb.words",
    "# Mat.17.15 [KJV 17.14b-15]",
    "# 2Co.1.7{1.6}",
    "#_Mat.1.1",
    "#_Translation",
    "#_Word=Grammar"
  ]) {
    assert.equal(isStepTokenReferenceField(field), false, field);
  }
  for (const field of [
    "Mat.1.1#01=NKO",
    "Php.1.16[1.17]#01=NKO",
    "2Co.1.7{1.6}#01=NKO",
    "Psa.51.0(51.2)#01=L"
  ]) {
    assert.equal(isStepTokenReferenceField(field), true, field);
  }
});

test("publishes words filed under another numbering in their own verse", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "step-interlinear-publication-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const tagntPath = path.join(directory, "TAGNT fixture.txt");
  const lexiconPath = path.join(directory, "lexicon.sqlite");
  const word = (ref: string, editions = "NA28+TR") =>
    tagntLine({
      ref,
      surface: "Βίβλος (Biblos)",
      gloss: "book",
      dStrongAndMorphology: "G0976=N-NSF",
      dictionary: "βίβλος=book",
      editions
    });
  const also = (ref: string) =>
    tagntLine({
      ref,
      surface: "κἀγώ (kagō)",
      gloss: "I also",
      dStrongAndMorphology: "G1473=P-1NS + G2532=CONJ",
      dictionary: "κἀγώ=and I",
      editions: "NA28+TR"
    });
  await writeFile(
    tagntPath,
    [
      "TAGNT fixture - Translators Amalgamated Greek NT",
      "Reference:\tVersification as used by NRSV.",
      "",
      "# Luk.1.73 [KJV 1.73-74a]\tΒίβλος\tκἀγώ",
      "#_Translation\tbook\tI also",
      "Word & Type\tGreek\tEnglish translation",
      word("Luk.1.73#01=NKO"),
      also("Luk.1.73[1.74]#02=NKO"),
      "# Luk.6.18 [KJV 6.17b-18]\tκἀγώ\tΒίβλος",
      also("Luk.6.18[6.17]#01=NKO"),
      word("Luk.6.18#02=NKO"),
      "# Rom.16.25\tΒίβλος\tΒίβλος",
      word("Rom.16.25{14.24}#01=NKO"),
      word("Rom.16.25{14.24}#02=K", "TR"),
      "# Php.1.16 [KJV 1.17]\tκἀγώ",
      also("Php.1.16[1.17]#01=NKO"),
      "# Php.1.17 [KJV 1.16]\tΒίβλος",
      word("Php.1.17[1.16]#01=NKO")
    ].join("\n"),
    "utf8"
  );
  createLexiconFixture(lexiconPath);

  const summary = await buildStepInterlinearPublication({
    outputDir: path.join(directory, "release"),
    sourcePaths: [tagntPath],
    lexiconPath
  });
  assert.equal(summary.verseCount, 5);
  assert.equal(summary.tokenCount, 8);
  assert.equal(summary.canonicalTokenCount, 7);

  const bible = JSON.parse(await readFile(summary.textPath, "utf8")) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  // A verse completed after or before its own words, in source order.
  assert.equal(bible["42"]!["1"]!["73"], "Βίβλος κἀγώ");
  assert.equal(bible["42"]!["6"]!["18"], "κἀγώ Βίβλος");
  // Verses only ever filed under another numbering exist under their own.
  assert.equal(bible["45"]!["16"]!["25"], "Βίβλος");
  assert.equal(bible["45"]!["14"], undefined);
  assert.equal(bible["50"]!["1"]!["16"], "κἀγώ");
  assert.equal(bible["50"]!["1"]!["17"], "Βίβλος");

  const english = new DatabaseSync(summary.englishPath, { readOnly: true });
  try {
    const tokens = english
      .prepare(
        `SELECT t.id, v.ref, t.sourceRef, t.alternateRefs, t.isCanonical,
                t.readingOrdinal, t.startOffset
           FROM Tokens t JOIN Verses v ON v.id=t.verseId
          ORDER BY v.id, t.sourceOrdinal`
      )
      .all() as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      tokens.map((row) => ({ ...row })),
      [
        {
          id: "TAGNT.Luke.1.73.01.NKO",
          ref: "Luke.1.73",
          sourceRef: "Luke.1.73",
          alternateRefs: "[]",
          isCanonical: 1,
          readingOrdinal: 0,
          startOffset: 0
        },
        {
          id: "TAGNT.Luke.1.73.02.NKO@Luke.1.74",
          ref: "Luke.1.73",
          sourceRef: "Luke.1.73",
          alternateRefs: '["Luke.1.74"]',
          isCanonical: 1,
          readingOrdinal: 1,
          startOffset: 7
        },
        {
          id: "TAGNT.Luke.6.18.01.NKO@Luke.6.17",
          ref: "Luke.6.18",
          sourceRef: "Luke.6.18",
          alternateRefs: '["Luke.6.17"]',
          isCanonical: 1,
          readingOrdinal: 0,
          startOffset: 0
        },
        {
          id: "TAGNT.Luke.6.18.02.NKO",
          ref: "Luke.6.18",
          sourceRef: "Luke.6.18",
          alternateRefs: "[]",
          isCanonical: 1,
          readingOrdinal: 1,
          startOffset: 5
        },
        {
          id: "TAGNT.Rom.16.25.01.NKO@Rom.14.24",
          ref: "Rom.16.25",
          sourceRef: "Rom.16.25",
          alternateRefs: '["Rom.14.24"]',
          isCanonical: 1,
          readingOrdinal: 0,
          startOffset: 0
        },
        {
          id: "TAGNT.Rom.16.25.02.K@Rom.14.24",
          ref: "Rom.16.25",
          sourceRef: "Rom.16.25",
          alternateRefs: '["Rom.14.24"]',
          isCanonical: 0,
          readingOrdinal: null,
          startOffset: -1
        },
        {
          id: "TAGNT.Phil.1.16.01.NKO@Phil.1.17",
          ref: "Phil.1.16",
          sourceRef: "Phil.1.16",
          alternateRefs: '["Phil.1.17"]',
          isCanonical: 1,
          readingOrdinal: 0,
          startOffset: 0
        },
        {
          id: "TAGNT.Phil.1.17.01.NKO@Phil.1.16",
          ref: "Phil.1.17",
          sourceRef: "Phil.1.17",
          alternateRefs: '["Phil.1.16"]',
          isCanonical: 1,
          readingOrdinal: 0,
          startOffset: 0
        }
      ]
    );
    const segmentCodes = english
      .prepare(
        `SELECT s.ordinal, s.morphology, group_concat(c.code, ',') AS codes
           FROM TokenSegments s
           JOIN SegmentStrongCodes sc
             ON sc.tokenId=s.tokenId AND sc.segmentOrdinal=s.ordinal
           JOIN StrongCodes c ON c.id=sc.codeId
          WHERE s.tokenId='TAGNT.Phil.1.16.01.NKO@Phil.1.17'
          GROUP BY s.ordinal
          ORDER BY s.ordinal`
      )
      .all() as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      segmentCodes.map((row) => ({ ...row })),
      [
        { ordinal: 0, morphology: "P-1NS", codes: "G1473" },
        { ordinal: 1, morphology: "CONJ", codes: "G2532" }
      ]
    );
  } finally {
    english.close();
  }
});

test("fails on a token line whose reference it cannot place", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "step-interlinear-publication-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const lexiconPath = path.join(directory, "lexicon.sqlite");
  createLexiconFixture(lexiconPath);
  const line = (ref: string) =>
    tagntLine({
      ref,
      surface: "Βίβλος (Biblos)",
      gloss: "book",
      dStrongAndMorphology: "G0976=N-NSF",
      dictionary: "βίβλος=book",
      editions: "NA28+TR"
    });
  const cases = [
    ["Mat.1.2<1.3>#01=NKO", "unknown-brackets"],
    ["Mat.1.2a#01=NKO", "verse-suffix"],
    [" Mat.1.2#01=NKO", "leading-space"],
    ["Xyz.1.2#01=NKO", "unknown-book"]
  ] as const;
  for (const [reference, name] of cases) {
    const tagntPath = path.join(directory, `TAGNT ${name}.txt`);
    await writeFile(
      tagntPath,
      ["# Mat.1.1", line("Mat.1.1#01=NKO"), line(reference)].join("\n"),
      "utf8"
    );
    const outputDir = path.join(directory, `release-${name}`);
    await assert.rejects(
      buildStepInterlinearPublication({
        outputDir,
        sourcePaths: [tagntPath],
        lexiconPath
      }),
      {
        message: `step-interlinear-token-reference-unsupported:TAGNT ${name}.txt:3:${reference}`
      }
    );
    assert.equal(existsSync(outputDir), false);
  }
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
