import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { buildDictionaryDirectory } from "./build-directory.mjs";

const query = (databasePath, sql) =>
  JSON.parse(
    execFileSync("sqlite3", ["-json", databasePath, sql], {
      encoding: "utf8"
    }) || "[]"
  );

describe("répertoire global des dictionnaires", () => {
  let directory;
  let outputPath;
  let result;

  before(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "dictionary-directory-"));
    for (const [work, word, verseKey] of [
      ["westphal", "Nébucadnetsar", "27-1-1"],
      ["isbe", "Nebuchadnezzar", "27-1-1"]
    ]) {
      const databasePath = path.join(directory, `${work}.sqlite`);
      execFileSync("sqlite3", [
        databasePath,
        `CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, sanitized_word TEXT NOT NULL, word TEXT NOT NULL, definition TEXT NOT NULL);
         CREATE TABLE dictionary_passage_anchors (verse_key TEXT NOT NULL, entry_id INTEGER NOT NULL, evidence_kind TEXT NOT NULL, ordinal INTEGER NOT NULL);
         INSERT INTO dictionnaire VALUES (1, lower('${word}'), '${word}', '<p>définition non copiée</p>');
         INSERT INTO dictionary_passage_anchors VALUES ('${verseKey}', 1, 'source-citation', 0);`
      ]);
    }
    const configPath = path.join(directory, "dictionary.json");
    await writeFile(
      configPath,
      JSON.stringify({
        publications: [
          {
            work: "westphal",
            resourceId: "WESTPHAL",
            language: "fr",
            title: "Westphal",
            abbreviation: "Westphal"
          },
          {
            work: "isbe",
            resourceId: "ISBE",
            language: "en",
            title: "ISBE",
            abbreviation: "ISBE"
          }
        ]
      })
    );
    const correspondencePath = path.join(directory, "correspondences.json");
    await writeFile(
      correspondencePath,
      JSON.stringify({
        format: "bible-strong-dictionary-correspondences",
        schemaVersion: 1,
        groups: [
          {
            id: "nebuchadnezzar",
            label: "Nebuchadnezzar",
            aliases: ["nebucadnetsar", "nebuchadnezzar"],
            members: [
              { work: "westphal", id: 1 },
              { work: "isbe", id: 1 }
            ]
          }
        ]
      })
    );
    outputPath = path.join(directory, "directory.sqlite");
    result = await buildDictionaryDirectory({
      configPath,
      normalizedRoot: directory,
      correspondencePath,
      outputPath
    });
  });

  after(async () => rm(directory, { recursive: true, force: true }));

  it("projette une seule surface sans recopier les définitions", () => {
    assert.deepEqual(result.counts, {
      works: 2,
      entries: 2,
      correspondences: 1,
      passageAnchors: 2
    });
    const columns = query(outputPath, "PRAGMA table_info(dictionary_entries)");
    assert.equal(columns.some((column) => column.name === "definition"), false);
    assert.deepEqual(
      query(
        outputPath,
        `SELECT w.work, e.entry_id, e.word
         FROM dictionary_entries e
         JOIN dictionary_works w USING (work_key)
         ORDER BY e.language DESC`
      ),
      [
        { work: "westphal", entry_id: 1, word: "Nébucadnetsar" },
        { work: "isbe", entry_id: 1, word: "Nebuchadnezzar" }
      ]
    );
  });

  it("conserve les correspondances et les ancres exactes", () => {
    assert.deepEqual(
      query(
        outputPath,
        `SELECT c.correspondence_id, w.work, m.entry_id
         FROM dictionary_correspondence_members m
         JOIN dictionary_correspondences c USING (correspondence_key)
         JOIN dictionary_works w USING (work_key)
         ORDER BY m.ordinal`
      ),
      [
        { correspondence_id: "nebuchadnezzar", work: "westphal", entry_id: 1 },
        { correspondence_id: "nebuchadnezzar", work: "isbe", entry_id: 1 }
      ]
    );
    assert.deepEqual(
      query(
        outputPath,
        `SELECT a.verse_key, w.work, a.entry_id, e.evidence_kind
         FROM dictionary_passage_anchors a
         JOIN dictionary_works w USING (work_key)
         JOIN dictionary_anchor_evidence e USING (evidence_key)
         ORDER BY w.work`
      ),
      [
        {
          verse_key: "27-1-1",
          work: "isbe",
          entry_id: 1,
          evidence_kind: "source-citation"
        },
        {
          verse_key: "27-1-1",
          work: "westphal",
          entry_id: 1,
          evidence_kind: "source-citation"
        }
      ]
    );
  });
});
