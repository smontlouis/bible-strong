#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  DICTIONARY_BCV_PARSER_VERSION,
  DICTIONARY_LINK_NORMALIZATION_REVISION,
  addDictionaryLinkStats,
  emptyDictionaryLinkStats,
  expandOsisToVerseKeys,
  normalizeDictionaryDefinition
} from "./dictionary-links.mjs";

const execFileAsync = promisify(execFile);

const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const queryJson = async (databasePath, query) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, query],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
  );
  return JSON.parse(stdout || "[]");
};

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
    child.stdin.end(sql);
  });

export const normalizeDictionarySqlite = async ({
  databasePath,
  work,
  language,
  reportPath
}) => {
  if (!databasePath) throw new Error("--database est requis");
  if (!work) throw new Error("--work est requis");
  if (language !== "fr" && language !== "en")
    throw new Error("--language doit valoir fr ou en");

  const integrity = await queryJson(databasePath, "PRAGMA integrity_check");
  if (integrity[0]?.integrity_check?.toLocaleLowerCase() !== "ok")
    throw new Error(`SQLite invalide avant normalisation : ${databasePath}`);

  const entries = await queryJson(
    databasePath,
    "SELECT id, word, definition FROM dictionnaire ORDER BY id"
  );
  const stats = emptyDictionaryLinkStats();
  const updates = [];
  const verseWords = new Map();

  for (const entry of entries) {
    const result = normalizeDictionaryDefinition({
      html: entry.definition,
      language,
      work
    });
    addDictionaryLinkStats(stats, result.stats);
    if (result.html !== entry.definition)
      updates.push({ id: entry.id, definition: result.html });

    for (const osis of new Set(result.references)) {
      const verseKeys = expandOsisToVerseKeys(osis);
      if (verseKeys.length === 0) {
        stats.broadReferencesNotIndexed += 1;
        continue;
      }
      for (const verseKey of verseKeys) {
        if (!verseWords.has(verseKey)) verseWords.set(verseKey, new Set());
        const words = verseWords.get(verseKey);
        const previousSize = words.size;
        words.add(entry.word);
        if (words.size !== previousSize) stats.indexedVerseLinks += 1;
      }
    }
  }

  const sql = ["PRAGMA foreign_keys=OFF;", "BEGIN IMMEDIATE;"];
  for (const update of updates) {
    sql.push(
      `UPDATE dictionnaire SET definition=${quoteSql(update.definition)} WHERE id=${Number(update.id)};`
    );
  }
  sql.push("DELETE FROM verses;");
  for (const [verseKey, words] of [...verseWords.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "en", { numeric: true })
  )) {
    sql.push(
      `INSERT INTO verses (id, ref) VALUES (${quoteSql(verseKey)}, ${quoteSql(JSON.stringify([...words]))});`
    );
  }
  sql.push("COMMIT;", "PRAGMA optimize;");
  await executeSql(databasePath, `${sql.join("\n")}\n`);

  const finalIntegrity = await queryJson(
    databasePath,
    "PRAGMA integrity_check"
  );
  if (finalIntegrity[0]?.integrity_check?.toLocaleLowerCase() !== "ok")
    throw new Error(`SQLite invalide après normalisation : ${databasePath}`);

  const report = {
    work,
    language,
    normalizationRevision: DICTIONARY_LINK_NORMALIZATION_REVISION,
    parserVersion: DICTIONARY_BCV_PARSER_VERSION,
    entries: entries.length,
    updatedDefinitions: updates.length,
    verseAnchors: verseWords.size,
    stats
  };
  if (reportPath)
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

const readArguments = (values) => {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) continue;
    result[key.slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = readArguments(process.argv.slice(2));
  const report = await normalizeDictionarySqlite({
    databasePath: args.database,
    work: args.work,
    language: args.language,
    reportPath: args.report
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
