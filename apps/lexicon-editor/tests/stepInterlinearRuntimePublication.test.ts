import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import { buildStepInterlinearPublication } from "../src/stepInterlinearPublication.js";
import {
  buildStepInterlinearRuntimePublication,
  STEP_INTERLINEAR_RUNTIME_SCHEMA_VERSION,
  verifyStepInterlinearRuntimePublication
} from "../src/stepInterlinearRuntimePublication.js";

test("projects the STEP ledger into compact morphology-aware runtime databases", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "step-interlinear-runtime-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const tahotPath = path.join(directory, "TAHOT fixture.txt");
  const tagntPath = path.join(directory, "TAGNT fixture.txt");
  const lexiconPath = path.join(directory, "lexicon.sqlite");
  const ledgerDir = path.join(directory, "ledger");
  const outputDir = path.join(directory, "runtime");
  await writeFile(
    tahotPath,
    [
      "Gen.1.1#01=L",
      "בָּרָא",
      "ba.Ra'",
      "he created",
      "H1254A",
      "HVqp3ms",
      "",
      "",
      "",
      "",
      "",
      ""
    ].join("\t"),
    "utf8"
  );
  await writeFile(
    tagntPath,
    [
      "Mat.1.1#01=NKO",
      "ἐποίησεν (epoiēsen)",
      "he did",
      "G4160G=V-AAI-3S",
      "ποιέω=do",
      "NA28+TR",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ].join("\t"),
    "utf8"
  );
  createLexiconFixture(lexiconPath);
  await buildStepInterlinearPublication({
    outputDir: ledgerDir,
    sourcePaths: [tahotPath, tagntPath],
    lexiconPath
  });

  const referencePaths = Object.fromEntries(
    await Promise.all(
      [
        ["Sg1910", "créa", "fit"],
        ["Darby", "créa", "fit"],
        ["DarbyR", "créa", "accomplit"]
      ].map(async ([name, hebrew, greek]) => {
        const filePath = path.join(directory, `${name}.csv`);
        await writeFile(
          filePath,
          [
            "book_id\tnum_chapter\tnum_verse\ttext",
            `Gen\t1\t1\t<w strong="H1254">${hebrew}</w>`,
            `Matt\t1\t1\t<w strong="G4160">${greek}</w>`
          ].join("\n"),
          "utf8"
        );
        return [name, filePath];
      })
    )
  );
  const summary = await buildStepInterlinearRuntimePublication({
    ledgerDir,
    outputDir,
    lexiconPath,
    referencePaths
  });
  assert.equal(summary.verseCount, 2);
  assert.equal(summary.tokenCount, 2);
  assert.equal(summary.segmentCount, 2);
  assert.equal(summary.identityCount, 8);
  assert.equal(summary.strongVerseCount, 8);
  assert.equal(summary.frenchContextualGlossCount, 2);
  assert.equal(summary.frenchLexicalFallbackCount, 0);
  assert.equal(summary.integrityCheck, "ok");
  const catalog = JSON.parse(await readFile(summary.catalogPath, "utf8")) as {
    schemaVersion: number;
    counts: { strongVerseEntries: number };
    rights: { license: string; attribution: string };
    archives: Array<{
      file: string;
      entry: string;
      archiveSha256: string;
      contentSha256: string;
    }>;
  };
  assert.equal(catalog.schemaVersion, STEP_INTERLINEAR_RUNTIME_SCHEMA_VERSION);
  assert.equal(catalog.counts.strongVerseEntries, 8);
  assert.equal(catalog.rights.license, "CC BY 4.0");
  assert.match(catalog.rights.attribution, /STEPBible/u);
  assert.deepEqual(
    catalog.archives.map(({ file, entry }) => ({ file, entry })),
    [
      { file: "bible-step.json.zip", entry: "bible-step.json" },
      {
        file: "bible-step-interlinear-fr.sqlite.zip",
        entry: "bible-step-interlinear-fr.sqlite"
      },
      {
        file: "bible-step-interlinear-en.sqlite.zip",
        entry: "bible-step-interlinear-en.sqlite"
      }
    ]
  );
  assert.ok(catalog.archives.every(({ archiveSha256 }) => archiveSha256));
  assert.ok(catalog.archives.every(({ contentSha256 }) => contentSha256));

  const french = new DatabaseSync(summary.frenchPath, { readOnly: true });
  try {
    const rows = french
      .prepare(
        `SELECT v.ref, t.startOffset AS tokenStartOffset,
                t.length AS tokenLength, s.startOffset AS segmentStartOffset,
                s.length AS segmentLength, m.code AS morphology, g.text AS gloss,
                g.source, strong.code AS strong,
                estrong.code AS estrong, dstrong.code AS dstrong,
                ustrong.code AS ustrong
           FROM Segments s
           JOIN Tokens t ON t.id=s.tokenId
           JOIN Verses v ON v.id=t.verseId
           JOIN Morphologies m ON m.id=s.morphologyId
           JOIN Glosses g ON g.id=s.glossId
           LEFT JOIN StrongCodes strong ON strong.id=s.strongCodeId
           LEFT JOIN StrongCodes estrong ON estrong.id=s.eStrongCodeId
           LEFT JOIN StrongCodes dstrong ON dstrong.id=s.dStrongCodeId
           LEFT JOIN StrongCodes ustrong ON ustrong.id=s.uStrongCodeId
          ORDER BY v.bookOrder`
      )
      .all() as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [
        {
          ref: "Gen.1.1",
          tokenStartOffset: 0,
          tokenLength: 6,
          segmentStartOffset: 0,
          segmentLength: 6,
          morphology: "HVqp3ms",
          gloss: "créa",
          source: "reference-context-consensus",
          strong: "H1254",
          estrong: "H1254e",
          dstrong: "H1254A",
          ustrong: "U0001"
        },
        {
          ref: "Matt.1.1",
          tokenStartOffset: 0,
          tokenLength: 8,
          segmentStartOffset: 0,
          segmentLength: 8,
          morphology: "V-AAI-3S",
          gloss: "fit",
          source: "reference-context-consensus",
          strong: "G4160",
          estrong: "G4160e",
          dstrong: "G4160G",
          ustrong: "U0001"
        }
      ]
    );
    const legacyJoinTable = french
      .prepare(
        `SELECT count(*) AS count
           FROM sqlite_schema
          WHERE type='table' AND name='SegmentStrongCodes'`
      )
      .get() as { count: number };
    assert.equal(legacyJoinTable.count, 0);
    const indexes = french
      .prepare(
        `SELECT name
           FROM sqlite_schema
          WHERE type='index' AND name LIKE 'idx_runtime_%'
          ORDER BY name`
      )
      .all() as unknown as Array<{ name: string }>;
    assert.deepEqual(
      indexes.map(({ name }) => name),
      [
        "idx_runtime_segments_token_ordinal",
        "idx_runtime_strong_codes_code",
        "idx_runtime_tokens_verse_ordinal",
        "idx_runtime_verses_location"
      ]
    );
    const strongVerseIndexes = french
      .prepare("PRAGMA index_list('StrongVerseIndex')")
      .all() as unknown as Array<{
      name: string;
      origin: string;
      unique: number;
    }>;
    assert.deepEqual(
      strongVerseIndexes.map(({ origin, unique }) => ({ origin, unique })),
      [{ origin: "pk", unique: 1 }]
    );
    const strongVerseIndexColumns = french
      .prepare(`PRAGMA index_info('${strongVerseIndexes[0]!.name}')`)
      .all() as unknown as Array<{ name: string }>;
    assert.deepEqual(
      strongVerseIndexColumns.map(({ name }) => name),
      ["codeId", "verseId"]
    );
    const codeIndexColumns = french
      .prepare("PRAGMA index_info('idx_runtime_strong_codes_code')")
      .all() as unknown as Array<{ name: string }>;
    assert.deepEqual(
      codeIndexColumns.map(({ name }) => name),
      ["code"]
    );

    const inverseParity = french
      .prepare(
        `WITH expected(codeId, verseId, kindMask) AS (
           SELECT codeId, verseId, sum(kindBit)
             FROM (
               SELECT s.strongCodeId AS codeId, t.verseId, 1 AS kindBit
                 FROM Segments s JOIN Tokens t ON t.id=s.tokenId
                WHERE s.strongCodeId IS NOT NULL
               UNION
               SELECT s.eStrongCodeId, t.verseId, 2
                 FROM Segments s JOIN Tokens t ON t.id=s.tokenId
                WHERE s.eStrongCodeId IS NOT NULL
               UNION
               SELECT s.dStrongCodeId, t.verseId, 4
                 FROM Segments s JOIN Tokens t ON t.id=s.tokenId
                WHERE s.dStrongCodeId IS NOT NULL
               UNION
               SELECT s.uStrongCodeId, t.verseId, 8
                 FROM Segments s JOIN Tokens t ON t.id=s.tokenId
                WHERE s.uStrongCodeId IS NOT NULL
             )
            GROUP BY codeId, verseId
         )
         SELECT count(*) AS count FROM (
           SELECT * FROM expected
           EXCEPT
           SELECT * FROM StrongVerseIndex
         )`
      )
      .get() as { count: number };
    assert.equal(inverseParity.count, 0);

    const unifiedCodeId = (
      french
        .prepare("SELECT id FROM StrongCodes WHERE code=?")
        .get("U0001") as { id: number }
    ).id;
    const indexedFamilies = french
      .prepare(
        `SELECT c.code, i.kindMask
           FROM StrongVerseIndex i
           JOIN StrongCodes c ON c.id=i.codeId
          WHERE i.verseId=(SELECT id FROM Verses WHERE ref='Gen.1.1')
          ORDER BY i.kindMask`
      )
      .all() as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      indexedFamilies.map((row) => ({ ...row })),
      [
        { code: "H1254", kindMask: 1 },
        { code: "H1254e", kindMask: 2 },
        { code: "H1254A", kindMask: 4 },
        { code: "U0001", kindMask: 8 }
      ]
    );
    const duplicateIndexRows = french
      .prepare(
        `SELECT count(*) AS count FROM (
           SELECT codeId, verseId
             FROM StrongVerseIndex
            GROUP BY codeId, verseId
           HAVING count(*) > 1
         )`
      )
      .get() as { count: number };
    assert.equal(duplicateIndexRows.count, 0);
    const countsByBook = french
      .prepare(
        `SELECT v.bookOrder, v.bookId, count(*) AS verseCount
           FROM StrongVerseIndex i
           JOIN Verses v ON v.id=i.verseId
          WHERE i.codeId=?
          GROUP BY v.bookOrder, v.bookId
          ORDER BY v.bookOrder`
      )
      .all(unifiedCodeId) as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      countsByBook.map((row) => ({ ...row })),
      [
        { bookOrder: 1, bookId: "Gen", verseCount: 1 },
        { bookOrder: 40, bookId: "Matt", verseCount: 1 }
      ]
    );
    const page = (afterVerseId: number): Array<Record<string, unknown>> =>
      french
        .prepare(
          `SELECT v.id AS verseId, v.bookOrder, v.bookId, v.chapter, v.verse
             FROM StrongVerseIndex i
             JOIN Verses v ON v.id=i.verseId
            WHERE i.codeId=? AND i.verseId>?
            ORDER BY i.verseId
            LIMIT 1`
        )
        .all(unifiedCodeId, afterVerseId) as unknown as Array<
        Record<string, unknown>
      >;
    assert.deepEqual(
      page(0).map((row) => ({ ...row })),
      [
        {
          verseId: 1,
          bookOrder: 1,
          bookId: "Gen",
          chapter: 1,
          verse: 1
        }
      ]
    );
    assert.deepEqual(
      page(1).map((row) => ({ ...row })),
      [
        {
          verseId: 2,
          bookOrder: 40,
          bookId: "Matt",
          chapter: 1,
          verse: 1
        }
      ]
    );
    assert.deepEqual(page(2), []);
    assert.equal(
      (
        french
          .prepare(
            `SELECT count(*) AS count
               FROM StrongVerseIndex
              WHERE codeId=?`
          )
          .get(unifiedCodeId) as { count: number }
      ).count,
      2
    );
    assert.equal(
      (
        french
          .prepare("SELECT count(*) AS count FROM StrongCodes WHERE code=?")
          .get("ABSENT") as { count: number }
      ).count,
      0
    );
    const plan = french
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT v.bookOrder, v.bookId, v.chapter, v.verse
           FROM StrongVerseIndex i
           JOIN Verses v ON v.id=i.verseId
          WHERE i.codeId=?
          ORDER BY i.verseId
          LIMIT 60`
      )
      .all(unifiedCodeId) as unknown as Array<{ detail: string }>;
    assert.ok(plan.some(({ detail }) => /USING PRIMARY KEY/iu.test(detail)));
    assert.ok(plan.every(({ detail }) => !/\bSegments\b/iu.test(detail)));
    const attribution = french
      .prepare(
        `SELECT value
           FROM ResourceMetadata
          WHERE key='attribution'`
      )
      .get() as { value: string };
    assert.match(attribution.value, /STEPBible/u);
    assert.match(attribution.value, /CC BY 4\.0/u);
    const textRevision = french
      .prepare(
        `SELECT value
           FROM ResourceMetadata
          WHERE key='textRevision'`
      )
      .get() as { value: string };
    assert.equal(textRevision.value, `bhg-${summary.textSha256.slice(0, 20)}`);
  } finally {
    french.close();
  }

  const verification = await verifyStepInterlinearRuntimePublication({
    textPath: summary.textPath,
    frenchPath: summary.frenchPath,
    englishPath: summary.englishPath
  });
  assert.equal(verification.integrityCheck, "ok");
  assert.equal(verification.identityCount, 8);
  assert.equal(verification.strongVerseCount, 8);
});

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
      CREATE TABLE MorphologyCodes (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL,
        normalizedCode TEXT NOT NULL
      );
      INSERT INTO StepEntries VALUES
        (1, 'H1254e', 'H1254A', 'U0001', 'בָּרָא', 'ba.Ra''', 'create'),
        (2, 'G4160e', 'G4160G', 'U0001', 'ποιέω', 'poieō', 'do');
      INSERT INTO StepEntryIdentities VALUES
        (1, 'H1254A'),
        (2, 'G4160G');
      INSERT INTO LexiconTranslations VALUES
        (1, 'fr', 'créer'),
        (2, 'fr', 'faire');
      INSERT INTO MorphologyCodes VALUES
        (1, 'HVqp3ms', 'HVqp3ms'),
        (2, 'V-AAI-3S', 'V-AAI-3S');
    `);
  } finally {
    database.close();
  }
}
