import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { normalizeDictionarySqlite } from "./normalize-sqlite.mjs";

const query = (databasePath, sql) =>
  JSON.parse(
    execFileSync("sqlite3", ["-json", databasePath, sql], {
      encoding: "utf8"
    }) || "[]"
  );

describe("normalisation d'un SQLite dictionnaire", () => {
  let directory;
  let databasePath;
  let report;

  before(async () => {
    directory = await mkdtemp(
      path.join(os.tmpdir(), "dictionary-normalization-")
    );
    databasePath = path.join(directory, "dictionary.sqlite");
    execFileSync("sqlite3", [
      databasePath,
      `CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, sanitized_word TEXT NOT NULL, word TEXT NOT NULL, definition TEXT NOT NULL);
       CREATE TABLE verses (id TEXT PRIMARY KEY, ref TEXT NOT NULL);
       INSERT INTO dictionnaire VALUES (1, 'amour', 'Amour', '<p>Voir Jean 3.16-17.</p>');
       INSERT INTO dictionnaire VALUES (2, 'alliance', 'Alliance', '<p><a class="verse" href="Genèse 1.1">Genèse 1.1</a></p>');
       INSERT INTO verses VALUES ('1-1-2', '["ancien faux positif"]');`
    ]);
    report = await normalizeDictionarySqlite({
      databasePath,
      work: "test",
      language: "fr"
    });
  });

  after(async () => rm(directory, { recursive: true, force: true }));

  it("réécrit les définitions avec des liens bible:// validés", () => {
    const rows = query(
      databasePath,
      "SELECT definition FROM dictionnaire ORDER BY id"
    );
    assert.match(
      rows[0].definition,
      /href="bible:\/\/John\.3\.16-John\.3\.17"/u
    );
    assert.match(rows[1].definition, /href="bible:\/\/Gen\.1\.1"/u);
    assert.equal(report.stats.bibleLinks, 2);
  });

  it("remplace l'ancien index lexical par les citations contrôlées", () => {
    const rows = query(databasePath, "SELECT id, ref FROM verses ORDER BY id");
    assert.deepEqual(rows, [
      { id: "1-1-1", ref: '["Alliance"]' },
      { id: "43-3-16", ref: '["Amour"]' },
      { id: "43-3-17", ref: '["Amour"]' }
    ]);
    assert.equal(report.verseAnchors, 3);
    assert.equal(report.stats.indexedVerseLinks, 3);
  });

  it("indexe chaque citation vers l'identité exacte de son article", () => {
    const rows = query(
      databasePath,
      `SELECT verse_key, entry_id, evidence_kind, ordinal
       FROM dictionary_passage_anchors
       ORDER BY verse_key, ordinal`
    );
    assert.deepEqual(rows, [
      {
        verse_key: "1-1-1",
        entry_id: 2,
        evidence_kind: "source-citation",
        ordinal: 0
      },
      {
        verse_key: "43-3-16",
        entry_id: 1,
        evidence_kind: "source-citation",
        ordinal: 0
      },
      {
        verse_key: "43-3-17",
        entry_id: 1,
        evidence_kind: "source-citation",
        ordinal: 0
      }
    ]);
    assert.equal(report.passageAnchors, 3);
  });
});
