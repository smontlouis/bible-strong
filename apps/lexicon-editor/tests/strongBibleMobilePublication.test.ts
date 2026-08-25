import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  compileStrongBibleMobilePublication,
  verifyStrongBibleMobilePublication
} from "../src/strongBibleMobilePublication.js";

test("publishes canonical text and notes separately from its Strong index", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "strong-bible-mobile-publication-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const inputPath = path.join(directory, "bible.jsonl");
  const canonicalJsonPath = path.join(directory, "bible-test.json");
  const strongSqlitePath = path.join(directory, "bible-test-strong.sqlite");
  const records = [
    {
      ref: "Gen.1.1",
      version: "TEST",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text:
        '<p><w strong="H0430" lemma="Dieu" pos="N">Dieu</w> créa' +
        '<note n="a"><i>note canonique</i></note> ' +
        "<divineName>les cieux</divineName>.</p>"
    },
    {
      ref: "Gen.1.2",
      version: "TEST",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 2,
      text: '<l><w strong="H0776">La terre</w> était informe.</l>'
    }
  ];
  await writeFile(
    inputPath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );

  const summary = await compileStrongBibleMobilePublication({
    inputPath,
    canonicalJsonPath,
    strongSqlitePath,
    applicationVersionId: "LSG",
    datasetId: "TEST",
    expectedVersion: "TEST"
  });

  const publication = JSON.parse(await readFile(canonicalJsonPath, "utf8")) as {
    format: string;
    applicationVersionId: string;
    datasetId: string;
    textRevision: string;
    textSha256: string;
    verses: Record<
      string,
      Record<
        string,
        Record<
          string,
          {
            text: string;
            layout: unknown[];
            notes: Array<{
              offset: number;
              order: number;
              kind: string;
              markup: string;
            }>;
          }
        >
      >
    >;
  };

  assert.equal(publication.format, "bible-strong-canonical-bible");
  assert.equal(publication.applicationVersionId, "LSG");
  assert.equal(publication.datasetId, "TEST");
  assert.equal(publication.textRevision, summary.textRevision);
  assert.equal(publication.textSha256, summary.textSha256);
  assert.equal(summary.headingCount, 0);
  assert.equal(
    publication.verses["1"]!["1"]!["1"]!.text,
    "Dieu créa les cieux."
  );
  assert.ok(publication.verses["1"]!["1"]!["1"]!.layout.length > 0);
  assert.deepEqual(publication.verses["1"]!["1"]!["1"]!.notes, [
    {
      offset: 9,
      order: 5,
      kind: "note",
      markup: '<note n="a"><i>note canonique</i></note>'
    }
  ]);
  assert.equal(summary.noteCount, 1);

  const database = new DatabaseSync(strongSqlitePath, { readOnly: true });
  try {
    const verseColumns = (
      database.prepare("PRAGMA table_info(Verses)").all() as Array<{
        name: string;
      }>
    ).map(({ name }) => name);
    assert.deepEqual(verseColumns, ["id", "bookOrder", "chapter", "verse"]);

    const metadata = Object.fromEntries(
      (
        database.prepare("SELECT key, value FROM ResourceMetadata").all() as {
          key: string;
          value: string;
        }[]
      ).map(({ key, value }) => [key, value])
    );
    assert.equal(metadata.applicationVersionId, "LSG");
    assert.equal(metadata.datasetId, "TEST");
    assert.equal(metadata.textRevision, publication.textRevision);
    assert.equal(metadata.textSha256, publication.textSha256);
    assert.equal(metadata.noteCount, undefined);
    const tables = (
      database
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name"
        )
        .all() as Array<{ name: string }>
    ).map(({ name }) => name);
    assert.ok(!tables.includes("VerseNotes"));
  } finally {
    database.close();
  }

  const verification = await verifyStrongBibleMobilePublication({
    canonicalJsonPath,
    strongSqlitePath
  });
  assert.equal(verification.integrityCheck, "ok");
  assert.equal(verification.verseCount, 2);
  assert.equal(verification.occurrenceCount, 2);
  assert.equal(verification.unalignedOccurrenceCount, 0);
  assert.equal(verification.identityCount, 2);
  assert.equal(verification.noteCount, 1);
  assert.equal(verification.invalidRangeCount, 0);
  assert.equal(verification.invalidNoteRangeCount, 0);
});

test("mobile publication output is deterministic", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "strong-bible-mobile-deterministic-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "bible.jsonl");
  await writeFile(
    inputPath,
    `${JSON.stringify({
      ref: "Gen.1.1",
      version: "TEST",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<w strong="H0430">Dieu</w>'
    })}\n`,
    "utf8"
  );

  const first = await compileStrongBibleMobilePublication({
    inputPath,
    canonicalJsonPath: path.join(directory, "first.json"),
    strongSqlitePath: path.join(directory, "first.sqlite"),
    applicationVersionId: "LSG",
    datasetId: "TEST",
    expectedVersion: "TEST"
  });
  const second = await compileStrongBibleMobilePublication({
    inputPath,
    canonicalJsonPath: path.join(directory, "second.json"),
    strongSqlitePath: path.join(directory, "second.sqlite"),
    applicationVersionId: "LSG",
    datasetId: "TEST",
    expectedVersion: "TEST"
  });

  assert.equal(first.textSha256, second.textSha256);
  assert.equal(first.strongSha256, second.strongSha256);
  assert.deepEqual(
    await readFile(path.join(directory, "first.json")),
    await readFile(path.join(directory, "second.json"))
  );
});

test("publishes active presentation tags for markup spanning verse boundaries", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "strong-bible-mobile-cross-verse-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "bible.jsonl");
  await writeFile(
    inputPath,
    [
      {
        ref: "Gen.1.1",
        version: "TEST",
        book: 1,
        bookId: "Gen",
        chapter: 1,
        verse: 1,
        text: '<p><w strong="H0430">Dieu</w> créa'
      },
      {
        ref: "Gen.1.2",
        version: "TEST",
        book: 1,
        bookId: "Gen",
        chapter: 1,
        verse: 2,
        text: "les cieux.</p>"
      }
    ]
      .map((record) => JSON.stringify(record))
      .join("\n") + "\n",
    "utf8"
  );
  const canonicalJsonPath = path.join(directory, "bible-test.json");
  await compileStrongBibleMobilePublication({
    inputPath,
    canonicalJsonPath,
    strongSqlitePath: path.join(directory, "bible-test.sqlite"),
    applicationVersionId: "LSG",
    datasetId: "TEST",
    expectedVersion: "TEST"
  });

  const publication = JSON.parse(await readFile(canonicalJsonPath, "utf8")) as {
    verses: Record<
      string,
      Record<string, Record<string, { startTags: Array<{ tag: string }> }>>
    >;
  };
  assert.deepEqual(
    publication.verses["1"]!["1"]!["2"]!.startTags.map(({ tag }) => tag),
    ["p"]
  );
});
