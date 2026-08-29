import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import {
  buildNaveResourcePublication,
  validateNaveResourcePublication
} from "../src/packageNaveResourcePublication.js";

const execFileAsync = promisify(execFile);

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function makeSourceSqlite(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await execFileAsync("sqlite3", [
    filePath,
    `CREATE TABLE TOPICS (name_lower TEXT UNIQUE, letter TEXT, name TEXT, description TEXT);
     CREATE TABLE VERSES (id TEXT UNIQUE, ref TEXT);
     INSERT INTO TOPICS VALUES ('amour', 'a', 'Amour', '<p>Aimer Dieu.</p>');
     INSERT INTO TOPICS VALUES ('bapteme', 'b', 'Baptême', '<p>Le baptême.</p>');
     INSERT INTO VERSES VALUES ('43-3-16', '["amour"]');
     INSERT INTO VERSES VALUES ('40-3', '["bapteme"]');`
  ]);
}

const metadata = {
  sourceVersion: "nave-fr-test-source",
  rights: {
    holder: "Public domain",
    termsReference: "Nave's Topical Bible",
    attribution: "Orville J. Nave; French editorial source",
    online: true,
    offline: true
  },
  deliveryCapabilities: { onlineAccess: true, offlineDownload: true }
} as const;

test("publishes a reproducible NAVE_FR canonical and matching SQLite archive", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-publication-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source", "nave-fr.sqlite");
  await makeSourceSqlite(sourcePath);

  const first = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication-a"),
    generatedAt: "2026-08-16T00:00:00.000Z"
  });
  const second = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication-b"),
    generatedAt: "2026-08-16T00:00:00.000Z"
  });

  assert.match(first.manifest.revision, /^nave-fr-[a-f0-9]{20}$/);
  assert.equal(first.manifest.revision, second.manifest.revision);
  assert.equal(
    first.manifest.offlineArtifact.contentSha256,
    second.manifest.offlineArtifact.contentSha256
  );
  assert.deepEqual(first.manifest.counts, {
    topics: 2,
    verseAnchors: 2,
    topicReferences: 2
  });
  assert.deepEqual(first.manifest.alphabeticalBrowse, {
    initials: ["a", "b"],
    topicCountByInitial: { a: 1, b: 1 }
  });

  const canonical = JSON.parse(await readFile(first.canonicalPath, "utf8"));
  assert.equal(canonical.resourceId, "NAVE_FR");
  assert.deepEqual(canonical.verseAnchors, [
    { verseKey: "40-3", topicNormalizedNames: ["bapteme"] },
    { verseKey: "43-3-16", topicNormalizedNames: ["amour"] }
  ]);
  await assert.doesNotReject(validateNaveResourcePublication(first.outputDir));
});

test("rejects dangling topic references from the source SQLite", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-invalid-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "nave-fr.sqlite");
  await makeSourceSqlite(sourcePath);
  await execFileAsync("sqlite3", [
    sourcePath,
    `UPDATE VERSES SET ref = '["missing"]' WHERE id = '43-3-16'`
  ]);

  await assert.rejects(
    buildNaveResourcePublication({
      ...metadata,
      sqlitePath: sourcePath,
      outputDir: path.join(root, "publication")
    }),
    /nave-publication-topic-reference-invalid:43-3-16:missing/
  );
});

test("derives the revision only from ordered topics and anchors", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-semantic-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const firstSource = path.join(root, "first.sqlite");
  const secondSource = path.join(root, "second.sqlite");
  await makeSourceSqlite(firstSource);
  await makeSourceSqlite(secondSource);
  await execFileAsync("sqlite3", [secondSource, "PRAGMA user_version = 42"]);

  const first = await buildNaveResourcePublication({
    ...metadata,
    sourceVersion: "source-a",
    sqlitePath: firstSource,
    outputDir: path.join(root, "publication-a")
  });
  const second = await buildNaveResourcePublication({
    ...metadata,
    sourceVersion: "source-b",
    sqlitePath: secondSource,
    outputDir: path.join(root, "publication-b")
  });

  assert.equal(first.manifest.revision, second.manifest.revision);
  assert.notEqual(
    first.manifest.provenance.sourceSha256,
    second.manifest.provenance.sourceSha256
  );
});

test("rejects a self-consistent but non-content-derived revision", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-revision-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.sqlite");
  await makeSourceSqlite(sourcePath);
  const result = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication")
  });
  const canonical = JSON.parse(await readFile(result.canonicalPath, "utf8"));
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  canonical.revision = "nave-fr-00000000000000000000";
  manifest.revision = canonical.revision;
  const serialized = `${JSON.stringify(canonical)}\n`;
  await writeFile(result.canonicalPath, serialized, "utf8");
  manifest.canonical.sha256 = sha256(serialized);
  manifest.canonical.bytes = Buffer.byteLength(serialized);
  await writeFile(
    result.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  await assert.rejects(
    validateNaveResourcePublication(result.outputDir),
    /nave-publication-declaration-mismatch/
  );
});

test("rejects incomplete rights metadata at the bundle boundary", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-rights-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.sqlite");
  await makeSourceSqlite(sourcePath);
  const result = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication")
  });
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  delete manifest.rights.online;
  await writeFile(
    result.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  await assert.rejects(
    validateNaveResourcePublication(result.outputDir),
    /resource-publication-manifest-invalid/
  );
});

test("rejects whitespace-only publication metadata", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-whitespace-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.sqlite");
  await makeSourceSqlite(sourcePath);
  const result = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication")
  });
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  manifest.rights.holder = "   ";
  await writeFile(
    result.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  await assert.rejects(
    validateNaveResourcePublication(result.outputDir),
    /resource-publication-manifest-invalid/
  );
});

test("rejects symlinked bundle artifacts", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-symlink-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.sqlite");
  await makeSourceSqlite(sourcePath);
  const result = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication")
  });
  const externalCanonical = path.join(root, "external-canonical.json");
  await writeFile(externalCanonical, await readFile(result.canonicalPath));
  await rm(result.canonicalPath);
  await symlink(externalCanonical, result.canonicalPath);

  await assert.rejects(
    validateNaveResourcePublication(result.outputDir),
    /resource-publication-canonical-integrity-mismatch/
  );
});

test("rejects an Offline archive with an additional entry", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "nave-resource-zip-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "source.sqlite");
  await makeSourceSqlite(sourcePath);
  const result = await buildNaveResourcePublication({
    ...metadata,
    sqlitePath: sourcePath,
    outputDir: path.join(root, "publication")
  });
  const extraPath = path.join(root, "extra.txt");
  await writeFile(extraPath, "unexpected", "utf8");
  await execFileAsync("zip", ["-q", result.offlineArtifactPath, extraPath]);
  const archive = await readFile(result.offlineArtifactPath);
  const archiveStat = await stat(result.offlineArtifactPath);
  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  manifest.offlineArtifact.sha256 = sha256(archive);
  manifest.offlineArtifact.bytes = archiveStat.size;
  await writeFile(
    result.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  await assert.rejects(
    validateNaveResourcePublication(result.outputDir),
    /nave-publication-offline-entries-invalid/
  );
});
