import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  compileStrongBibleJsonlToSqlite,
  parseStrongBibleMarkup,
  queryStrongBibleConcordance,
  readStrongBibleSqliteChapter,
  STRONG_BIBLE_SQLITE_SCHEMA_VERSION
} from "../src/strongBibleSqlite.js";
import { DatabaseSync } from "node:sqlite";

test("normalizes visible text while preserving Strong ranges, layout and notes", () => {
  const parsed = parseStrongBibleMarkup(
    '<p><w strong="H0430" dstrong="H0430G" lemma="Dieu" pos="N">Dieu</w> créa' +
      "<note>Une <ref>Gen.2.1</ref> note</note> " +
      "<divineName>l’Éternel</divineName></p>"
  );

  assert.equal(parsed.canonicalText, "Dieu créa l’Éternel");
  assert.deepEqual(
    parsed.occurrences.map((occurrence) => ({
      surface: occurrence.surface,
      start: occurrence.startOffset,
      end: occurrence.endOffset,
      identities: occurrence.identities.map(
        (identity) => `${identity.kind}:${identity.code}`
      ),
      lexeme: occurrence.lexeme
    })),
    [
      {
        surface: "Dieu",
        start: 0,
        end: 4,
        identities: ["strong:H0430", "dstrong:H0430G"],
        lexeme: { lemma: "Dieu", partOfSpeech: "N" }
      }
    ]
  );
  assert.equal(parsed.notes.length, 1);
  assert.equal(parsed.layout.length, 2);
  assert.equal(parsed.runs.length, 2);
});

test("compiles a JSONL Bible into a queryable concordance SQLite", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "strong-bible-sqlite-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "bible.jsonl");
  const outputPath = path.join(directory, "bible.sqlite");
  const secondOutputPath = path.join(directory, "bible-copy.sqlite");
  const records = [
    {
      ref: "Gen.1.1",
      version: "TEST",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<p><w strong="H0430" dstrong="H0430G" lemma="Dieu" pos="N">Dieu</w> créa.</p>'
    },
    {
      ref: "Gen.1.2",
      version: "TEST",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 2,
      text:
        'L’Esprit du <w strong="H0430" dstrong="H0430G" lemma="dieu" pos="n">dieu</w>' +
        "<note>note exclue</note>."
    }
  ];
  await writeFile(
    inputPath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );

  const summary = await compileStrongBibleJsonlToSqlite({
    inputPath,
    outputPath,
    datasetId: "TST",
    expectedVersion: "TEST"
  });
  assert.equal(summary.verseCount, 2);
  assert.equal(summary.occurrenceCount, 2);
  assert.equal(summary.identityCount, 4);
  assert.equal(summary.noteCount, 1);
  assert.equal(summary.integrityCheck, "ok");
  assert.equal(summary.lexemeAssignmentCount, 2);
  assert.equal(summary.lexemeCount, 2);
  assert.equal(summary.schemaVersion, 3);
  assert.equal(STRONG_BIBLE_SQLITE_SCHEMA_VERSION, 3);

  const secondSummary = await compileStrongBibleJsonlToSqlite({
    inputPath,
    outputPath: secondOutputPath,
    datasetId: "TST",
    expectedVersion: "TEST"
  });
  assert.equal(secondSummary.outputSha256, summary.outputSha256);

  const chapter = readStrongBibleSqliteChapter({
    sqlitePath: outputPath,
    bookId: "Gen",
    chapter: 1
  });
  assert.equal(chapter.length, 2);
  assert.equal(chapter[0]!.text, records[0]!.text);
  assert.match(
    chapter[0]!.text,
    /<w strong="H0430" dstrong="H0430G" lemma="Dieu" pos="N">Dieu<\/w>/u
  );
  assert.match(chapter[1]!.text, /<note>note exclue<\/note>/u);

  const concordance = queryStrongBibleConcordance({
    sqlitePath: outputPath,
    kind: "dstrong",
    code: "H0430G"
  });
  assert.equal(concordance.total, 2);
  assert.deepEqual(
    concordance.items.map(({ ref, surface }) => ({ ref, surface })),
    [
      { ref: "Gen.1.1", surface: "Dieu" },
      { ref: "Gen.1.2", surface: "dieu" }
    ]
  );
  const filteredConcordance = queryStrongBibleConcordance({
    sqlitePath: outputPath,
    kind: "dstrong",
    code: "H0430G",
    lemma: "dieu"
  });
  assert.equal(filteredConcordance.total, 1);
  assert.deepEqual(
    filteredConcordance.items.map(({ ref, surface }) => ({ ref, surface })),
    [{ ref: "Gen.1.2", surface: "dieu" }]
  );

  const database = new DatabaseSync(outputPath, { readOnly: true });
  const tableNames = (
    database
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);
  database.close();
  assert.ok(tableNames.includes("WordSpans"));
  assert.ok(tableNames.includes("StrongCodes"));
  assert.ok(tableNames.includes("WordStrongCodes"));
  assert.ok(tableNames.includes("FrenchLexemes"));
  assert.ok(!tableNames.includes("WordOccurrences"));
  assert.ok(!tableNames.includes("OccurrenceIdentities"));

  assert.ok((await readFile(outputPath)).byteLength > 0);
});
