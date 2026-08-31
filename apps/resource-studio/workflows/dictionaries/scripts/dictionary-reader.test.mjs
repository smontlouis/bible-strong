import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import {
  createDictionaryReaderStore,
  escapeSqlLike,
  quoteSql
} from "./dictionary-reader.mjs";

describe("lecteur local des dictionnaires", () => {
  let directory;
  let store;

  before(async () => {
    directory = await mkdtemp(
      path.join(os.tmpdir(), "bible-strong-dictionary-reader-")
    );
    const databasePath = path.join(directory, "dictionary.sqlite");
    execFileSync("sqlite3", [
      databasePath,
      `CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, sanitized_word TEXT NOT NULL, word TEXT NOT NULL, definition TEXT NOT NULL);
       CREATE TABLE verses (id TEXT PRIMARY KEY, ref TEXT NOT NULL);
       INSERT INTO dictionnaire VALUES (1, 'alliance', 'Alliance', '<p>Une définition.</p>');
       INSERT INTO dictionnaire VALUES (2, 'l''amour', 'L''amour', '<p>Une autre définition.</p>');`
    ]);
    const configPath = path.join(directory, "dictionary.json");
    await writeFile(
      configPath,
      JSON.stringify({
        publications: [
          {
            work: "test-work",
            resourceId: "TEST_WORK",
            language: "fr",
            title: "Dictionnaire test",
            abbreviation: "Test",
            authors: ["Bible Strong"],
            description: "Jeu de test.",
            edition: "Test",
            source: "Local",
            sourceVersion: "1",
            sqlitePath: "./dictionary.sqlite",
            rights: {
              holder: "Test",
              termsReference: "Test",
              attribution: "Test"
            },
            deliveryCapabilities: { onlineAccess: true, offlineDownload: true }
          }
        ]
      })
    );
    store = await createDictionaryReaderStore(configPath);
  });

  after(async () => rm(directory, { recursive: true, force: true }));

  it("échappe les valeurs SQL et les motifs LIKE", () => {
    assert.equal(quoteSql("l'amour"), "'l''amour'");
    assert.equal(escapeSqlLike("100%_sûr"), "100\\%\\_sûr");
  });

  it("expose le catalogue et ses compteurs", async () => {
    const catalog = await store.catalog();
    assert.equal(catalog[0].counts.entries, 2);
    assert.equal(catalog[0].available, true);
  });

  it("recherche puis charge une définition complète", async () => {
    const page = await store.listEntries({
      work: "test-work",
      search: "l'amour"
    });
    assert.equal(page.total, 1);
    assert.equal(page.entries[0].word, "L'amour");
    const entry = await store.getEntry({
      work: "test-work",
      id: page.entries[0].id
    });
    assert.match(entry.definition, /autre définition/);
  });
});
