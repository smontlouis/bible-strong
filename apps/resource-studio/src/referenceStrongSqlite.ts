import { createHash } from "node:crypto";
import { readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";
import { readStrongCsv } from "./strongCsv.js";

export const REFERENCE_STRONG_SQLITE_SCHEMA_VERSION = 1;

export interface ReferenceStrongSqliteOptions {
  inputPath: string;
  outputPath: string;
  version: string;
}

export interface ReferenceStrongSqliteResult {
  artifactSha256: string;
  outputPath: string;
  sizeBytes: number;
  sourceSha256: string;
  strongTagCount: number;
  verseCount: number;
  version: string;
}

interface IntegrityRow {
  integrity_check: string;
}

export async function writeReferenceStrongSqlite(
  options: ReferenceStrongSqliteOptions
): Promise<ReferenceStrongSqliteResult> {
  const rows = await readStrongCsv(options.inputPath);
  const sourceSha256 = await sha256File(options.inputPath);
  const temporaryPath = `${options.outputPath}.tmp`;

  await rm(temporaryPath, { force: true });
  const db = new DatabaseSync(temporaryPath);

  let strongTagCount = 0;
  let databaseComplete = false;
  try {
    db.exec(`
      pragma journal_mode = DELETE;
      pragma synchronous = OFF;
      pragma page_size = 4096;
      pragma user_version = ${REFERENCE_STRONG_SQLITE_SCHEMA_VERSION};

      create table verses (
        id integer primary key,
        version text not null,
        book integer not null,
        chapter integer not null,
        verse integer not null,
        text text not null
      );

      create unique index idx_verses_lookup
        on verses (version, book, chapter, verse);

      create table versions_meta (
        version text primary key,
        installed_at integer not null,
        verse_count integer not null default 0
      ) without rowid;

      create table artifact_meta (
        key text primary key,
        value text not null
      ) without rowid;
    `);

    const insertVerse = db.prepare(
      `insert into verses (version, book, chapter, verse, text)
       values (?, ?, ?, ?, ?)`
    );

    db.exec("begin immediate");
    for (const row of rows) {
      const book =
        BOOK_IDS.indexOf(row.bookId as (typeof BOOK_IDS)[number]) + 1;
      if (book === 0) {
        throw new Error(
          `Unknown book id in ${options.inputPath}: ${row.bookId}`
        );
      }

      strongTagCount += countStrongTags(row.text);
      insertVerse.run(options.version, book, row.chapter, row.verse, row.text);
    }

    db.prepare(
      `insert into versions_meta (version, installed_at, verse_count)
       values (?, 0, ?)`
    ).run(options.version, rows.length);

    const insertMetadata = db.prepare(
      "insert into artifact_meta (key, value) values (?, ?)"
    );
    for (const [key, value] of Object.entries({
      artifactSchemaVersion: String(REFERENCE_STRONG_SQLITE_SCHEMA_VERSION),
      contentKind: "strong-bible",
      sourcePath: path.basename(options.inputPath),
      sourceSha256,
      strongTagFormat: '<w strong="H0000">...</w>',
      version: options.version
    })) {
      insertMetadata.run(key, value);
    }
    db.exec("commit");

    db.exec("vacuum");
    const integrity = db.prepare("pragma integrity_check").get() as
      | IntegrityRow
      | undefined;
    if (integrity?.integrity_check !== "ok") {
      throw new Error(
        `SQLite integrity check failed for ${options.version}: ${integrity?.integrity_check ?? "missing result"}`
      );
    }
    databaseComplete = true;
  } catch (error) {
    if (db.isTransaction) db.exec("rollback");
    throw error;
  } finally {
    db.close();
    if (!databaseComplete) await rm(temporaryPath, { force: true });
  }

  await rename(temporaryPath, options.outputPath);
  const [artifactSha256, outputStat] = await Promise.all([
    sha256File(options.outputPath),
    stat(options.outputPath)
  ]);

  return {
    artifactSha256,
    outputPath: options.outputPath,
    sizeBytes: outputStat.size,
    sourceSha256,
    strongTagCount,
    verseCount: rows.length,
    version: options.version
  };
}

function countStrongTags(text: string): number {
  return text.match(/<w\b[^>]*\bstrong=(['"])[\s\S]*?\1[^>]*>/giu)?.length ?? 0;
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}
