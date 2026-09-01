import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { buildAllDictionaryResourcePublications } from "../src/packageDictionaryResourcePublications.js";

const execFileAsync = promisify(execFile);

test("packages prepared entry links and exact passage anchors", async (t) => {
  const root = await mkdtemp(
    path.join(tmpdir(), "dictionary-resource-publication-")
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.sqlite");
  await execFileAsync("sqlite3", [
    sourcePath,
    `CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, sanitized_word TEXT NOT NULL, word TEXT NOT NULL, definition TEXT NOT NULL);
     CREATE TABLE verses (id TEXT PRIMARY KEY, ref TEXT NOT NULL);
     INSERT INTO dictionnaire VALUES (1, 'amour', 'Amour', '<p>Voir Alliance. Jean 3.16.</p>');
     INSERT INTO dictionnaire VALUES (2, 'alliance', 'Alliance', '<p>Définition.</p>');`
  ]);

  const metadata = {
    work: "test-dictionary",
    resourceId: "TEST_DICTIONARY",
    language: "fr" as const,
    title: "Dictionnaire test",
    abbreviation: "Test",
    authors: ["Auteur"],
    description: "Description",
    edition: "Édition test",
    source: "Fixture",
    sourceVersion: "fixture-v1",
    rights: {
      holder: "Test",
      termsReference: "Test",
      attribution: "Test",
      online: true,
      offline: true
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    sqlitePath: sourcePath
  };
  const lsgPath = path.join(root, "lsg.json");
  const kjvPath = path.join(root, "kjv.json");
  await Promise.all([
    writeFile(lsgPath, '{"verses":{}}\n', "utf8"),
    writeFile(kjvPath, '{"verses":{}}\n', "utf8")
  ]);
  const [manifest] = await buildAllDictionaryResourcePublications({
    outputDir: path.join(root, "publication"),
    publications: [metadata],
    referenceBibles: { fr: lsgPath, en: kjvPath },
    generatedAt: "2026-08-31T00:00:00.000Z"
  });
  assert.ok(manifest);
  assert.equal(manifest.counts.passageEntryReferences, 1);
  const directoryManifest = JSON.parse(
    await readFile(
      path.join(root, "publication/directory/manifest.json"),
      "utf8"
    )
  ) as {
    publicationRevision: string;
    rights: { online: boolean; offline: boolean };
    deliveryCapabilities: { onlineAccess: boolean; offlineDownload: boolean };
  };
  assert.match(
    directoryManifest.publicationRevision,
    /^dictionary-directory-[a-f0-9]{20}$/u
  );
  assert.deepEqual(directoryManifest.rights, {
    holder: "Selon les ressources dictionnaires participantes",
    termsReference: "Voir les droits de chaque dictionnaire participant.",
    attribution: "Index de découverte des dictionnaires Bible Strong",
    online: true,
    offline: true
  });
  assert.deepEqual(directoryManifest.deliveryCapabilities, {
    onlineAccess: true,
    offlineDownload: true
  });
  const canonical = JSON.parse(
    await readFile(
      path.join(
        root,
        "publication/test-dictionary/fr/canonical/dictionary-test-dictionary-fr.json"
      ),
      "utf8"
    )
  );
  assert.deepEqual(canonical.passageAnchors, [
    {
      verseKey: "43-3-16",
      entries: [{ entryId: 1, evidenceKind: "source-citation" }]
    }
  ]);

  const extractedRoot = path.join(root, "extracted");
  await mkdir(extractedRoot);
  const archivePath = path.join(
    root,
    "publication/test-dictionary/fr/offline/dictionary-test-dictionary-fr.sqlite.zip"
  );
  await execFileAsync("unzip", ["-q", archivePath, "-d", extractedRoot]);
  const databasePath = path.join(extractedRoot, "dictionnaire.sqlite");
  const { stdout } = await execFileAsync("sqlite3", [
    "-json",
    databasePath,
    `SELECT
       (SELECT COUNT(*) FROM dictionary_passage_anchors WHERE entry_id = 1 AND verse_key = '43-3-16') AS anchors,
       (SELECT COUNT(*) FROM dictionnaire WHERE definition LIKE '%data-entry-id="2"%' AND definition LIKE '%data-link-origin="cue"%') AS cues`
  ]);
  assert.deepEqual(JSON.parse(stdout), [{ anchors: 1, cues: 1 }]);
});
