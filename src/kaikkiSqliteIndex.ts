import { createReadStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { createGunzip } from "node:zlib";

import { normalizeWord, tokenizeText } from "./tokenize.js";

export interface KaikkiLookupIndex {
  formToLemma: Map<string, string>;
  lemmaGlossTokens: Map<string, Set<string>>;
  englishGlossToFrench: Map<string, Set<string>>;
}

interface KaikkiEntry {
  word?: unknown;
  lang_code?: unknown;
  forms?: Array<{ form?: unknown }>;
  senses?: KaikkiSense[];
}

interface KaikkiSense {
  glosses?: unknown;
  form_of?: Array<{ word?: unknown }>;
}

const DEFAULT_KAIKKI_JSONL =
  "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl";

const ENGLISH_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "her",
  "him",
  "his",
  "let",
  "not",
  "one",
  "the",
  "their",
  "them",
  "they",
  "this",
  "that",
  "with",
  "you",
  "your"
]);

export function defaultKaikkiSqlitePath(
  jsonlPath = DEFAULT_KAIKKI_JSONL
): string {
  return jsonlPath.replace(/\.(?:jsonl|jsonl\.gz)$/u, ".sqlite");
}

export function readKaikkiSqliteIndex(options: {
  sqlitePath: string;
  targetWords: Set<string>;
  englishHints: Set<string>;
}): KaikkiLookupIndex {
  const index = emptyKaikkiIndex();
  const db = new DatabaseSync(options.sqlitePath);
  try {
    const targetWords = [...options.targetWords];
    for (const row of selectForms(db, targetWords)) {
      index.formToLemma.set(row.form, row.lemma);
    }

    const lemmaCandidates = new Set([
      ...targetWords,
      ...index.formToLemma.values()
    ]);
    for (const row of selectLemmaGlossTokens(db, [...lemmaCandidates])) {
      const tokens = index.lemmaGlossTokens.get(row.lemma) ?? new Set<string>();
      tokens.add(row.token);
      index.lemmaGlossTokens.set(row.lemma, tokens);
    }

    for (const word of targetWords) {
      if (!index.formToLemma.has(word) && index.lemmaGlossTokens.has(word)) {
        index.formToLemma.set(word, word);
      }
    }

    for (const row of selectEnglishGlossTerms(db, [...options.englishHints])) {
      const terms =
        index.englishGlossToFrench.get(row.token) ?? new Set<string>();
      terms.add(row.french);
      index.englishGlossToFrench.set(row.token, terms);
    }
  } finally {
    db.close();
  }
  return index;
}

export async function buildKaikkiSqliteIndex(options: {
  jsonlPath: string;
  sqlitePath: string;
}): Promise<{ sqlitePath: string; entries: number; forms: number }> {
  await mkdir(path.dirname(options.sqlitePath), { recursive: true });
  const db = new DatabaseSync(options.sqlitePath);
  let entries = 0;
  let forms = 0;

  try {
    db.exec(`
      pragma journal_mode = WAL;
      pragma synchronous = NORMAL;
      drop table if exists metadata;
      drop table if exists forms;
      drop table if exists lemma_gloss_tokens;
      drop table if exists english_gloss_to_french;
      create table metadata (
        key text primary key,
        value text not null
      );
      create table forms (
        form text primary key,
        lemma text not null
      );
      create table lemma_gloss_tokens (
        lemma text not null,
        token text not null,
        primary key (lemma, token)
      );
      create table english_gloss_to_french (
        token text not null,
        french text not null,
        primary key (token, french)
      );
      create index idx_kaikki_forms_lemma on forms (lemma);
      create index idx_kaikki_gloss_token on lemma_gloss_tokens (token);
      create index idx_kaikki_english_token on english_gloss_to_french (token);
    `);
    const insertMeta = db.prepare(
      "insert into metadata (key, value) values (?, ?)"
    );
    const insertForm = db.prepare(
      "insert or ignore into forms (form, lemma) values (?, ?)"
    );
    const insertGloss = db.prepare(
      "insert or ignore into lemma_gloss_tokens (lemma, token) values (?, ?)"
    );
    const insertEnglish = db.prepare(
      "insert or ignore into english_gloss_to_french (token, french) values (?, ?)"
    );

    db.exec("BEGIN IMMEDIATE");
    for await (const line of readLines(options.jsonlPath)) {
      const entry = safeJsonParse(line);
      if (
        !entry ||
        entry.lang_code !== "fr" ||
        typeof entry.word !== "string"
      ) {
        continue;
      }
      const normalizedWord = normalizeWord(entry.word);
      const glossTokens = entryGlossTokens(entry);
      if (!normalizedWord) continue;

      entries += 1;
      for (const token of glossTokens) {
        insertGloss.run(normalizedWord, token);
        insertEnglish.run(token, normalizedWord);
      }

      const formLemma = formOfLemma(entry);
      if (formLemma) {
        insertForm.run(normalizedWord, formLemma);
        forms += 1;
        for (const token of glossTokens) {
          insertGloss.run(formLemma, token);
        }
      }

      for (const form of entry.forms ?? []) {
        if (typeof form?.form !== "string") continue;
        const normalizedForm = normalizeWord(form.form);
        if (!normalizedForm || normalizedForm === normalizedWord) continue;
        insertForm.run(normalizedForm, normalizedWord);
        forms += 1;
      }
    }
    insertMeta.run("source", options.jsonlPath);
    insertMeta.run("generatedAt", new Date().toISOString());
    insertMeta.run("entries", String(entries));
    insertMeta.run("forms", String(forms));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  return { sqlitePath: options.sqlitePath, entries, forms };
}

export function hasKaikkiSqliteIndex(sqlitePath: string): boolean {
  return existsSync(sqlitePath);
}

function selectForms(
  db: DatabaseSync,
  forms: string[]
): Array<{ form: string; lemma: string }> {
  return selectChunked(db, "form, lemma", "forms", "form", forms) as Array<{
    form: string;
    lemma: string;
  }>;
}

function selectLemmaGlossTokens(
  db: DatabaseSync,
  lemmas: string[]
): Array<{ lemma: string; token: string }> {
  return selectChunked(
    db,
    "lemma, token",
    "lemma_gloss_tokens",
    "lemma",
    lemmas
  ) as Array<{ lemma: string; token: string }>;
}

function selectEnglishGlossTerms(
  db: DatabaseSync,
  tokens: string[]
): Array<{ token: string; french: string }> {
  return selectChunked(
    db,
    "token, french",
    "english_gloss_to_french",
    "token",
    tokens
  ) as Array<{ token: string; french: string }>;
}

function selectChunked(
  db: DatabaseSync,
  columns: string,
  table: string,
  keyColumn: string,
  values: string[]
): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  const unique = [...new Set(values.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 500) {
    const chunk = unique.slice(index, index + 500);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "?").join(", ");
    const batch = db
      .prepare(
        `select ${columns} from ${table} where ${keyColumn} in (${placeholders})`
      )
      .all(...chunk) as unknown as Array<Record<string, string>>;
    for (const row of batch) {
      rows.push(row);
    }
  }
  return rows;
}

async function* readLines(filePath: string): AsyncIterable<string> {
  const input = filePath.endsWith(".gz")
    ? createReadStream(filePath).pipe(createGunzip())
    : createReadStream(filePath);
  const lines = readline.createInterface({ input });
  for await (const line of lines) {
    yield line;
  }
}

function safeJsonParse(line: string): KaikkiEntry | undefined {
  try {
    return JSON.parse(line) as KaikkiEntry;
  } catch {
    return undefined;
  }
}

function entryGlossTokens(entry: KaikkiEntry): string[] {
  const tokens = (entry.senses ?? [])
    .flatMap((sense) => (Array.isArray(sense.glosses) ? sense.glosses : []))
    .filter((gloss): gloss is string => typeof gloss === "string")
    .flatMap((gloss) => englishTokens(gloss));
  return [...new Set<string>(tokens)];
}

function formOfLemma(entry: KaikkiEntry): string | undefined {
  for (const sense of entry.senses ?? []) {
    const lemma = sense.form_of?.[0]?.word;
    if (typeof lemma === "string") return normalizeWord(lemma);
  }
  return undefined;
}

function englishTokens(text: string): string[] {
  return tokenizeText(text)
    .filter((segment) => segment.kind === "word")
    .map((segment) => englishStem(segment.normalized))
    .filter((token) => token.length >= 3 && !ENGLISH_STOP_WORDS.has(token));
}

function englishStem(word: string): string {
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
  return word;
}

function emptyKaikkiIndex(): KaikkiLookupIndex {
  return {
    formToLemma: new Map(),
    lemmaGlossTokens: new Map(),
    englishGlossToFrench: new Map()
  };
}

function parseArgs(argv: string[]): {
  jsonlPath: string;
  sqlitePath: string;
} {
  const jsonlPath = readOption(argv, "--input") ?? DEFAULT_KAIKKI_JSONL;
  return {
    jsonlPath,
    sqlitePath:
      readOption(argv, "--output") ?? defaultKaikkiSqlitePath(jsonlPath)
  };
}

function readOption(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) return argv[index + 1];
    if (arg?.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const result = await buildKaikkiSqliteIndex(options);
  console.log(
    JSON.stringify(
      {
        sqlite: result.sqlitePath,
        entries: result.entries,
        forms: result.forms
      },
      null,
      2
    )
  );
}

if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("src/kaikkiSqliteIndex.ts")
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
