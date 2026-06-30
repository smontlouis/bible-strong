import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  createStrongPhraseLexicon,
  type StrongPhraseCandidate,
  type StrongPhraseLexicon
} from "./phraseTranslationLexicon.js";

const SCHEMA_VERSION = 1;
export const DEFAULT_STRONG_PHRASE_LEXICON_SQLITE =
  "data/derived/strong-phrase-lexicon.sqlite";

interface PhraseRow {
  strong: string;
  phrase: string;
  offset: number;
  score: number;
  source: string;
}

interface MetadataRow {
  value: string;
}

export function strongPhraseLexiconSourceFingerprint(
  references: Array<{ path: string }>
): string {
  return JSON.stringify(
    references.map((reference) => {
      const stats = statSync(reference.path);
      return {
        path: reference.path,
        size: stats.size,
        mtimeMs: Math.round(stats.mtimeMs)
      };
    })
  );
}

export function readStrongPhraseLexiconSqlite(options: {
  sqlitePath?: string;
  sourceFingerprint: string;
}): StrongPhraseLexicon | undefined {
  const sqlitePath = options.sqlitePath ?? DEFAULT_STRONG_PHRASE_LEXICON_SQLITE;
  if (!existsSync(sqlitePath)) return undefined;

  const db = new DatabaseSync(sqlitePath);
  try {
    if (readMetadata(db, "schemaVersion") !== String(SCHEMA_VERSION)) {
      return undefined;
    }
    if (readMetadata(db, "sourceFingerprint") !== options.sourceFingerprint) {
      return undefined;
    }

    const rows = db
      .prepare(
        `select strong, phrase, offset, score, source
         from phrase_candidates
         order by strong, score desc, phrase_length desc, phrase`
      )
      .all() as unknown as PhraseRow[];
    const byStrong = new Map<string, StrongPhraseCandidate[]>();

    for (const row of rows) {
      const candidates = byStrong.get(row.strong) ?? [];
      candidates.push({
        strong: row.strong,
        phrase: row.phrase.split(" "),
        offset: row.offset,
        score: row.score,
        source: row.source,
        method: "learned-phrase"
      });
      byStrong.set(row.strong, candidates);
    }

    return createStrongPhraseLexicon(byStrong);
  } finally {
    db.close();
  }
}

export async function writeStrongPhraseLexiconSqlite(options: {
  sqlitePath?: string;
  sourceFingerprint: string;
  lexicon: StrongPhraseLexicon;
}): Promise<string> {
  const sqlitePath = options.sqlitePath ?? DEFAULT_STRONG_PHRASE_LEXICON_SQLITE;
  await mkdir(path.dirname(sqlitePath), { recursive: true });
  const db = new DatabaseSync(sqlitePath);

  try {
    db.exec(`
      pragma journal_mode = WAL;
      pragma synchronous = NORMAL;
      drop table if exists metadata;
      drop table if exists phrase_candidates;
      create table metadata (
        key text primary key,
        value text not null
      );
      create table phrase_candidates (
        strong text not null,
        phrase text not null,
        phrase_length integer not null,
        offset integer not null,
        score real not null,
        source text not null,
        primary key (strong, phrase, offset)
      );
      create index idx_strong_phrase_candidates_strong
        on phrase_candidates (strong, score desc, phrase_length desc);
    `);

    const insertMetadata = db.prepare(
      "insert into metadata (key, value) values (?, ?)"
    );
    const insertCandidate = db.prepare(
      `insert into phrase_candidates
        (strong, phrase, phrase_length, offset, score, source)
       values (?, ?, ?, ?, ?, ?)`
    );

    db.exec("BEGIN IMMEDIATE");
    insertMetadata.run("schemaVersion", String(SCHEMA_VERSION));
    insertMetadata.run("sourceFingerprint", options.sourceFingerprint);
    insertMetadata.run("generatedAt", new Date().toISOString());

    let count = 0;
    for (const [strong, candidates] of options.lexicon.byStrong) {
      for (const candidate of candidates) {
        insertCandidate.run(
          strong,
          candidate.phrase.join(" "),
          candidate.phrase.length,
          candidate.offset,
          candidate.score,
          candidate.source
        );
        count += 1;
      }
    }
    insertMetadata.run("candidateCount", String(count));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  return sqlitePath;
}

function readMetadata(db: DatabaseSync, key: string): string | undefined {
  const row = db
    .prepare("select value from metadata where key = ?")
    .get(key) as MetadataRow | undefined;
  return row?.value;
}
