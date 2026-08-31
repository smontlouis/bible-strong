import { spawn } from "node:child_process";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

export const writeDictionarySourceSqlite = async ({
  outputDir,
  fileName,
  entries
}) => {
  await mkdir(outputDir, { recursive: true });
  const databasePath = path.join(outputDir, fileName);
  const temporaryPath = `${databasePath}.${process.pid}.tmp`;
  await new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [temporaryPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && stdout.trim().endsWith("ok")) resolve();
      else
        reject(
          new Error(
            `dictionary-source-sqlite-failed:${code}:${stderr || stdout}`
          )
        );
    });
    const inserts = entries.map(
      (entry) =>
        `INSERT INTO dictionnaire VALUES (${entry.id}, ${quoteSql(entry.normalizedWord)}, ${quoteSql(entry.word)}, ${quoteSql(entry.definition)});`
    );
    child.stdin.end(
      `${[
        "PRAGMA journal_mode=OFF;",
        "PRAGMA synchronous=OFF;",
        "BEGIN IMMEDIATE;",
        "CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, sanitized_word TEXT NOT NULL, word TEXT NOT NULL, definition TEXT NOT NULL);",
        "CREATE INDEX dictionnaire_browse ON dictionnaire(sanitized_word, id);",
        "CREATE TABLE verses (id TEXT PRIMARY KEY, ref TEXT NOT NULL);",
        ...inserts,
        "COMMIT;",
        "PRAGMA integrity_check;"
      ].join("\n")}\n`
    );
  });
  await rename(temporaryPath, databasePath);
  return databasePath;
};
