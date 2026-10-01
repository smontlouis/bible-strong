import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { keySha256, parseR2Location } from "../src/r2ArtifactSources.js";
import {
  insertsOnlySpaces,
  rebaseStrongSidecarOffsets
} from "../src/rebaseStrongSidecarOffsets.js";
import type { CanonicalBiblePublication } from "../src/strongBibleMobilePublication.js";

const PREVIOUS = "the LordthyGod.";
const NEXT = "the Lord thy God.";

const canonicalOf = (text: string, textSha256: string) =>
  ({
    textRevision: `test-${textSha256.slice(0, 20)}`,
    textSha256,
    verses: {
      "40": {
        "4": {
          "7": { text, startTags: [], layout: [], notes: [], headings: [] }
        }
      }
    }
  }) as unknown as CanonicalBiblePublication;

const createSidecar = (
  filePath: string,
  textSha256: string,
  spans: Array<
    [
      ordinal: number,
      start: number,
      length: number,
      open: number,
      close: number
    ]
  >
) => {
  const database = new DatabaseSync(filePath);
  database.exec(`
    CREATE TABLE ResourceMetadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE Verses(id INTEGER PRIMARY KEY, bookOrder INTEGER, chapter INTEGER, verse INTEGER);
    CREATE TABLE WordSpans(verseId INTEGER, ordinal INTEGER, startOffset INTEGER, length INTEGER,
      isAligned INTEGER, openOrder INTEGER, closeOrder INTEGER, lexemeId INTEGER,
      PRIMARY KEY(verseId, ordinal));
    INSERT INTO Verses VALUES (1, 40, 4, 7);
  `);
  const metadata = database.prepare(
    "INSERT INTO ResourceMetadata VALUES (?, ?)"
  );
  metadata.run("textSha256", textSha256);
  metadata.run("textRevision", `test-${textSha256.slice(0, 20)}`);
  metadata.run("sourceSha256", "b".repeat(64));
  metadata.run("strongRevision", "c".repeat(64));
  const insert = database.prepare(
    "INSERT INTO WordSpans VALUES (1, ?, ?, ?, 1, ?, ?, 7)"
  );
  for (const span of spans) insert.run(...span);
  database.close();
};

describe("Strong sidecar offset rebase", () => {
  it("recognises texts that only gained spaces", () => {
    assert.equal(insertsOnlySpaces(PREVIOUS, NEXT), true);
    assert.equal(insertsOnlySpaces(PREVIOUS, "the Lord thy gods."), false);
  });

  it("moves offsets and orders from the oracle and keeps the released lexical data", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "rebase-sidecar-"));
    try {
      const previousSha = "1".repeat(64);
      const nextSha = "2".repeat(64);
      const released = path.join(directory, "released.sqlite");
      const oracle = path.join(directory, "oracle.sqlite");
      createSidecar(released, previousSha, [
        [0, 4, 4, 1, 2],
        [1, 8, 3, 3, 4],
        [2, 11, 3, 5, 6]
      ]);
      createSidecar(oracle, nextSha, [
        [0, 4, 4, 1, 2],
        [1, 9, 3, 4, 5],
        [2, 13, 3, 7, 8]
      ]);

      const result = rebaseStrongSidecarOffsets({
        sqlitePath: released,
        oracleSqlitePath: oracle,
        previousCanonical: canonicalOf(PREVIOUS, previousSha),
        canonical: canonicalOf(NEXT, nextSha)
      });

      assert.equal(result.rebasedSpanCount, 2);
      const database = new DatabaseSync(released, { readOnly: true });
      assert.deepEqual(
        database
          .prepare(
            "SELECT startOffset, openOrder, closeOrder, lexemeId FROM WordSpans ORDER BY ordinal"
          )
          .all()
          .map((row) => ({ ...row })),
        [
          { startOffset: 4, openOrder: 1, closeOrder: 2, lexemeId: 7 },
          { startOffset: 9, openOrder: 4, closeOrder: 5, lexemeId: 7 },
          { startOffset: 13, openOrder: 7, closeOrder: 8, lexemeId: 7 }
        ]
      );
      const metadata = Object.fromEntries(
        (
          database
            .prepare("SELECT key, value FROM ResourceMetadata")
            .all() as Array<{
            key: string;
            value: string;
          }>
        ).map((row) => [row.key, row.value])
      );
      database.close();
      assert.equal(metadata.textSha256, nextSha);
      assert.equal(
        metadata.textRebasedFromTextRevision,
        `test-${previousSha.slice(0, 20)}`
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses an oracle whose span lands on another word", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "rebase-sidecar-"));
    try {
      const released = path.join(directory, "released.sqlite");
      const oracle = path.join(directory, "oracle.sqlite");
      createSidecar(released, "1".repeat(64), [[0, 4, 4, 1, 2]]);
      createSidecar(oracle, "2".repeat(64), [[0, 9, 4, 1, 2]]);
      assert.throws(
        () =>
          rebaseStrongSidecarOffsets({
            sqlitePath: released,
            oracleSqlitePath: oracle,
            previousCanonical: canonicalOf(PREVIOUS, "1".repeat(64)),
            canonical: canonicalOf(NEXT, "2".repeat(64))
          }),
        /strong-sidecar-rebase-word-changed:40-4-7-0/u
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("only trusts content-addressed R2 keys", () => {
    const location = parseR2Location(
      `r2://bucket/revisions/${"a".repeat(64)}/bibles/bible-nbs.json.zip`
    );
    assert.equal(location.bucket, "bucket");
    assert.equal(keySha256(location.key), "a".repeat(64));
    assert.equal(keySha256("bibles/bible-nbs.json.zip"), undefined);
  });
});
