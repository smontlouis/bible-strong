import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { writeReferenceStrongSqlite } from "../src/referenceStrongSqlite.js";

test("writes an app-compatible lightweight Strong Bible SQLite artifact", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "reference-strong-sqlite-")
  );
  const inputPath = path.join(directory, "Sample.csv");
  const outputPath = path.join(directory, "sample.sqlite");
  const source = [
    "book_id\tnum_chapter\tnum_verse\ttext",
    'Gen\t1\t1\tAu <w strong="H7225">commencement</w>.',
    'Matt\t1\t1\t<w strong="G0976">Livre</w> <w strong="G1078"></w>.'
  ].join("\n");

  await writeFile(inputPath, `${source}\n`, "utf8");

  try {
    const result = await writeReferenceStrongSqlite({
      inputPath,
      outputPath,
      version: "SAMPLE"
    });

    assert.equal(result.verseCount, 2);
    assert.equal(result.strongTagCount, 3);
    assert.equal(result.artifactSha256.length, 64);
    assert.equal(result.sizeBytes, (await readFile(outputPath)).length);
    assert.equal(
      (await readFile(outputPath)).subarray(0, 16).toString(),
      "SQLite format 3\u0000"
    );

    const db = new DatabaseSync(outputPath, { readOnly: true });
    try {
      assert.deepEqual(
        db
          .prepare(
            "select version, book, chapter, verse, text from verses order by book, chapter, verse"
          )
          .all()
          .map((row) => ({ ...row })),
        [
          {
            version: "SAMPLE",
            book: 1,
            chapter: 1,
            verse: 1,
            text: 'Au <w strong="H7225">commencement</w>.'
          },
          {
            version: "SAMPLE",
            book: 40,
            chapter: 1,
            verse: 1,
            text: '<w strong="G0976">Livre</w> <w strong="G1078"></w>.'
          }
        ]
      );
      assert.deepEqual(
        { ...db.prepare("select * from versions_meta").get() },
        { version: "SAMPLE", installed_at: 0, verse_count: 2 }
      );
      assert.equal(
        (
          db.prepare("pragma integrity_check").get() as {
            integrity_check: string;
          }
        ).integrity_check,
        "ok"
      );
      assert.equal(
        (
          db
            .prepare(
              "select value from artifact_meta where key = 'contentKind'"
            )
            .get() as { value: string }
        ).value,
        "strong-bible"
      );
      assert.equal(
        (
          db
            .prepare(
              "select count(*) as count from sqlite_master where type = 'table' and name = 'verses_fts'"
            )
            .get() as { count: number }
        ).count,
        0
      );
    } finally {
      db.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
