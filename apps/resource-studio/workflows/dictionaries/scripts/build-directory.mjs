#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const defaultConfigPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary.json"
);
const defaultNormalizedRoot = path.join(workflowRoot, ".local/normalized");

const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const executeSql = (databasePath, sql) =>
  new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [databasePath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let errorOutput = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sqlite3-exit-${code}:${errorOutput.trim()}`));
    });
    child.stdin.end(`${sql}\n`);
  });

const queryJson = (databasePath, sql) =>
  new Promise((resolve, reject) => {
    const child = spawn("sqlite3", ["-json", databasePath, sql], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let errorOutput = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`sqlite3-exit-${code}:${errorOutput.trim()}`));
      try {
        resolve(JSON.parse(output || "[]"));
      } catch (cause) {
        reject(new Error("dictionary-directory-query-invalid", { cause }));
      }
    });
  });

const schemaSql = `
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TABLE dictionary_works (
  work_key INTEGER PRIMARY KEY,
  work TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL CHECK (language IN ('fr', 'en')),
  title TEXT NOT NULL,
  abbreviation TEXT NOT NULL
);
CREATE TABLE dictionary_entries (
  work_key INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('fr', 'en')),
  word TEXT NOT NULL,
  normalized_word TEXT NOT NULL,
  PRIMARY KEY (work_key, entry_id),
  FOREIGN KEY (work_key) REFERENCES dictionary_works(work_key) ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE dictionary_correspondences (
  correspondence_key INTEGER PRIMARY KEY,
  correspondence_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);
CREATE TABLE dictionary_correspondence_aliases (
  correspondence_key INTEGER NOT NULL,
  alias TEXT NOT NULL,
  PRIMARY KEY (correspondence_key, alias),
  FOREIGN KEY (correspondence_key) REFERENCES dictionary_correspondences(correspondence_key) ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE dictionary_correspondence_members (
  correspondence_key INTEGER NOT NULL,
  work_key INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (correspondence_key, work_key, entry_id),
  FOREIGN KEY (correspondence_key) REFERENCES dictionary_correspondences(correspondence_key) ON DELETE CASCADE,
  FOREIGN KEY (work_key, entry_id) REFERENCES dictionary_entries(work_key, entry_id) ON DELETE CASCADE
) WITHOUT ROWID;
CREATE TABLE dictionary_anchor_evidence (
  evidence_key INTEGER PRIMARY KEY,
  evidence_kind TEXT NOT NULL UNIQUE
);
INSERT INTO dictionary_anchor_evidence VALUES (1, 'source-citation');
INSERT INTO dictionary_anchor_evidence VALUES (2, 'verse-name');
INSERT INTO dictionary_anchor_evidence VALUES (3, 'verse-phrase');
CREATE TABLE dictionary_passage_anchors (
  verse_key TEXT NOT NULL,
  work_key INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  evidence_key INTEGER NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (verse_key, work_key, entry_id, evidence_key),
  FOREIGN KEY (work_key, entry_id) REFERENCES dictionary_entries(work_key, entry_id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_key) REFERENCES dictionary_anchor_evidence(evidence_key)
) WITHOUT ROWID;
COMMIT;`;

const insertCorrespondences = async (
  databasePath,
  correspondenceIndex,
  workKeys,
  batchSize = 250
) => {
  for (
    let offset = 0;
    offset < correspondenceIndex.groups.length;
    offset += batchSize
  ) {
    const groups = correspondenceIndex.groups.slice(offset, offset + batchSize);
    const sql = ["PRAGMA foreign_keys=ON;", "BEGIN IMMEDIATE;"];
    for (const [groupOffset, group] of groups.entries()) {
      const correspondenceKey = offset + groupOffset + 1;
      sql.push(
        `INSERT INTO dictionary_correspondences VALUES (${correspondenceKey}, ${quoteSql(group.id)}, ${quoteSql(group.label)});`
      );
      for (const alias of new Set(group.aliases ?? [])) {
        sql.push(
          `INSERT INTO dictionary_correspondence_aliases VALUES (${correspondenceKey}, ${quoteSql(alias)});`
        );
      }
      group.members.forEach((member, ordinal) => {
        const workKey = workKeys.get(member.work);
        if (!workKey)
          throw new Error(`dictionary-directory-work-unknown:${member.work}`);
        sql.push(
          `INSERT INTO dictionary_correspondence_members VALUES (${correspondenceKey}, ${workKey}, ${Number(member.id)}, ${ordinal});`
        );
      });
    }
    sql.push("COMMIT;");
    await executeSql(databasePath, sql.join("\n"));
  }
};

export const buildDictionaryDirectory = async ({
  configPath = defaultConfigPath,
  normalizedRoot = defaultNormalizedRoot,
  correspondencePath = path.join(normalizedRoot, "correspondences.json"),
  outputPath = path.join(normalizedRoot, "dictionary-directory.sqlite")
} = {}) => {
  const resolvedConfigPath = path.resolve(configPath);
  const resolvedNormalizedRoot = path.resolve(normalizedRoot);
  const resolvedOutputPath = path.resolve(outputPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  const correspondenceIndex = JSON.parse(
    await readFile(path.resolve(correspondencePath), "utf8")
  );
  if (
    correspondenceIndex.format !== "bible-strong-dictionary-correspondences" ||
    correspondenceIndex.schemaVersion !== 1 ||
    !Array.isArray(correspondenceIndex.groups)
  )
    throw new Error("dictionary-directory-correspondences-invalid");

  await rm(resolvedOutputPath, { force: true });
  await executeSql(resolvedOutputPath, schemaSql);
  try {
    const workKeys = new Map(
      config.publications.map((publication, index) => [
        publication.work,
        index + 1
      ])
    );
    for (const publication of config.publications) {
      const workKey = workKeys.get(publication.work);
      const sourcePath = path.join(
        resolvedNormalizedRoot,
        `${publication.work}.sqlite`
      );
      await executeSql(
        resolvedOutputPath,
        `PRAGMA foreign_keys=ON;
         ATTACH DATABASE ${quoteSql(sourcePath)} AS source_dictionary;
         BEGIN IMMEDIATE;
         INSERT INTO dictionary_works VALUES (
           ${workKey},
           ${quoteSql(publication.work)},
           ${quoteSql(publication.resourceId)},
           ${quoteSql(publication.language)},
           ${quoteSql(publication.title)},
           ${quoteSql(publication.abbreviation)}
         );
         INSERT INTO dictionary_entries (work_key, entry_id, language, word, normalized_word)
           SELECT ${workKey}, id, ${quoteSql(publication.language)}, word, sanitized_word
           FROM source_dictionary.dictionnaire ORDER BY id;
         INSERT INTO dictionary_passage_anchors (verse_key, work_key, entry_id, evidence_key, ordinal)
           SELECT anchor.verse_key, ${workKey}, anchor.entry_id, evidence.evidence_key, anchor.ordinal
           FROM source_dictionary.dictionary_passage_anchors anchor
           JOIN dictionary_anchor_evidence evidence ON evidence.evidence_kind = anchor.evidence_kind
           ORDER BY verse_key, ordinal;
         COMMIT;
         DETACH DATABASE source_dictionary;`
      );
    }
    await insertCorrespondences(
      resolvedOutputPath,
      correspondenceIndex,
      workKeys
    );
    await executeSql(
      resolvedOutputPath,
      `PRAGMA foreign_keys=ON;
       BEGIN IMMEDIATE;
       CREATE INDEX dictionary_entries_browse ON dictionary_entries (language, normalized_word, work_key, entry_id);
       CREATE INDEX dictionary_entries_search ON dictionary_entries (normalized_word, language);
       CREATE INDEX dictionary_correspondence_members_entry ON dictionary_correspondence_members (work_key, entry_id);
       COMMIT;
       PRAGMA optimize;
       VACUUM;`
    );
    const counts = (
      await queryJson(
        resolvedOutputPath,
        `SELECT
           (SELECT COUNT(*) FROM dictionary_works) AS works,
           (SELECT COUNT(*) FROM dictionary_entries) AS entries,
           (SELECT COUNT(*) FROM dictionary_correspondences) AS correspondences,
           (SELECT COUNT(*) FROM dictionary_passage_anchors) AS passageAnchors`
      )
    )[0];
    const integrity = await queryJson(
      resolvedOutputPath,
      "PRAGMA integrity_check"
    );
    if (integrity[0]?.integrity_check?.toLocaleLowerCase() !== "ok")
      throw new Error("dictionary-directory-integrity-invalid");
    const revision = `dictionary-directory-${createHash("sha256")
      .update(JSON.stringify(counts))
      .update(await readFile(resolvedOutputPath))
      .digest("hex")
      .slice(0, 20)}`;
    await executeSql(
      resolvedOutputPath,
      `CREATE TABLE RESOURCE_METADATA (
         resource_id TEXT NOT NULL,
         revision TEXT NOT NULL,
         schema_version INTEGER NOT NULL,
         works_count INTEGER NOT NULL,
         entries_count INTEGER NOT NULL,
         correspondences_count INTEGER NOT NULL,
         passage_anchors_count INTEGER NOT NULL
       );
       INSERT INTO RESOURCE_METADATA VALUES (
         'dictionary-directory', ${quoteSql(revision)}, 1,
         ${Number(counts.works)}, ${Number(counts.entries)},
         ${Number(counts.correspondences)}, ${Number(counts.passageAnchors)}
       );`
    );
    return { outputPath: resolvedOutputPath, revision, counts };
  } catch (error) {
    await rm(resolvedOutputPath, { force: true });
    throw error;
  }
};

const readArguments = (values) => {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("dictionary-directory-cli-arguments-invalid");
    result[key.slice(2)] = value;
  }
  return result;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = readArguments(process.argv.slice(2));
  const result = await buildDictionaryDirectory({
    configPath: args.config,
    normalizedRoot: args["normalized-root"],
    correspondencePath: args.correspondences,
    outputPath: args.output
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
