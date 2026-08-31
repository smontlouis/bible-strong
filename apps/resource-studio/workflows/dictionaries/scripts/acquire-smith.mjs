#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  acquireSmithEntries,
  normalizeSmithHeadword
} from "./audit-smith-overlap.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const defaultRoot = path.join(workflowRoot, ".local/smith");
const defaultOutput = path.join(
  workspaceRoot,
  "apps/resource-studio/outputs/dictionary-sources/smith"
);

const HEADWORD_REPAIRS = new Map([["HIGH PLACES6813 PRIEST", "High Priest"]]);
const SMALL_WORDS = new Set(["a", "an", "and", "in", "of", "or", "the", "to"]);
const SWORD_BOOKS = new Map(
  Object.entries({
    ge: "Gen",
    genesis: "Gen",
    ex: "Exod",
    le: "Lev",
    nu: "Num",
    de: "Deut",
    deuteronomy: "Deut",
    jos: "Josh",
    jud: "Judg",
    ru: "Ruth",
    "1sa": "1Sam",
    "2sa": "2Sam",
    "2sam": "2Sam",
    "1ki": "1Kgs",
    "2ki": "2Kgs",
    "1ch": "1Chr",
    "2ch": "2Chr",
    ezr: "Ezra",
    ne: "Neh",
    es: "Esth",
    job: "Job",
    ps: "Ps",
    pr: "Prov",
    ec: "Eccl",
    so: "Song",
    isa: "Isa",
    jer: "Jer",
    la: "Lam",
    eze: "Ezek",
    da: "Dan",
    ho: "Hos",
    joe: "Joel",
    am: "Amos",
    ob: "Obad",
    jon: "Jonah",
    mic: "Mic",
    na: "Nah",
    hab: "Hab",
    zep: "Zeph",
    hag: "Hag",
    zec: "Zech",
    mal: "Mal",
    mt: "Matt",
    mr: "Mark",
    lu: "Luke",
    joh: "John",
    ac: "Acts",
    ro: "Rom",
    "1co": "1Cor",
    "2co": "2Cor",
    ga: "Gal",
    eph: "Eph",
    col: "Col",
    "1th": "1Thess",
    "2th": "2Thess",
    "1ti": "1Tim",
    "2ti": "2Tim",
    tit: "Titus",
    phm: "Phil",
    heb: "Heb",
    jas: "Jas",
    "1pe": "1Pet",
    "2pe": "2Pet",
    "1jo": "1John",
    "2jo": "2John",
    "3jo": "3John",
    jude: "Jude",
    re: "Rev"
  })
);

const decodeHtml = (value) =>
  String(value)
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );

const escapeAttribute = (value) =>
  String(value).replace(/&/gu, "&amp;").replace(/"/gu, "&quot;");

const stripTags = (value) =>
  decodeHtml(String(value).replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();

export const canonicalizeSmithPassage = (passage) => {
  const match = /^\s*([\da-z]+)[.,]?\s+([\s\S]+?)\s*$/iu.exec(String(passage));
  if (!match) return String(passage).trim();
  const book = SWORD_BOOKS.get(match[1].toLocaleLowerCase("en")) ?? match[1];
  return `${book} ${match[2]}`;
};

export const formatSmithHeadword = (sourceWord) => {
  const repaired = HEADWORD_REPAIRS.get(sourceWord);
  if (repaired) return repaired;
  const words = String(sourceWord)
    .toLocaleLowerCase("en")
    .split(/(\s+|-)/u);
  let lexicalIndex = 0;
  return words
    .map((word) => {
      if (/^(?:\s+|-)$/u.test(word)) return word;
      const isSmall = lexicalIndex > 0 && SMALL_WORDS.has(word);
      lexicalIndex += 1;
      if (/^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/iu.test(word))
        return word.toLocaleUpperCase("en");
      return isSmall
        ? word
        : word.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("en"));
    })
    .join("");
};

const titleByNormalizedWord = (rawEntries) => {
  const result = new Map();
  for (const entry of rawEntries) {
    const display = formatSmithHeadword(entry.word);
    result.set(normalizeSmithHeadword(entry.word), display);
    result.set(normalizeSmithHeadword(display), display);
  }
  return result;
};

export const transformSmithDefinition = ({ html, titles = new Map() }) => {
  let result = String(html).replace(/\u0000/gu, "");
  result = result.replace(
    /<scripRef\b[^>]*\bpassage\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/scripRef>/giu,
    (_match, doubleQuoted, singleQuoted, label) =>
      `<a class="verse" href="${escapeAttribute(canonicalizeSmithPassage(doubleQuoted ?? singleQuoted ?? ""))}">${label}</a>`
  );
  result = result.replace(
    /<term\b[^>]*>([\s\S]*?)<\/term>/giu,
    (_match, label) => {
      const plainLabel = stripTags(label);
      const target =
        titles.get(normalizeSmithHeadword(plainLabel)) ??
        formatSmithHeadword(plainLabel);
      return `<a class="word" href="${escapeAttribute(target)}">${label}</a>`;
    }
  );
  result = result
    .replace(/<(\/?)i\b[^>]*>/giu, "<$1i>")
    .replace(/<(\/?)ol\b[^>]*>/giu, "<$1ol>")
    .replace(/<(\/?)li\b[^>]*>/giu, "<$1li>")
    .replace(/<\/?(?:scripRef|term)\b[^>]*>/giu, "")
    .replace(/<(?!\/?(?:a|i|ol|li)\b)[^>]*>/giu, "");
  return result.trim();
};

export const buildSmithEntries = (rawEntries) => {
  const titles = titleByNormalizedWord(rawEntries);
  const grouped = new Map();
  for (const entry of rawEntries) {
    const word = formatSmithHeadword(entry.word);
    const normalizedWord = normalizeSmithHeadword(word);
    if (!normalizedWord) continue;
    if (!grouped.has(normalizedWord))
      grouped.set(normalizedWord, { word, definitions: [] });
    grouped
      .get(normalizedWord)
      .definitions.push(
        transformSmithDefinition({ html: entry.definition, titles })
      );
  }
  return [...grouped.values()]
    .sort((left, right) => left.word.localeCompare(right.word, "en"))
    .map((entry, index) => ({
      id: index + 1,
      word: entry.word,
      normalizedWord: normalizeSmithHeadword(entry.word),
      definition: entry.definitions
        .map((definition, definitionIndex) =>
          definitionIndex === 0
            ? definition
            : `<p><strong>Additional entry</strong></p>${definition}`
        )
        .join("\n")
    }));
};

const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const buildSqlite = (databasePath, entries) =>
  new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [databasePath], {
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
          new Error(`smith-sqlite-build-failed:${code}:${stderr || stdout}`)
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

const parseArguments = (values) => {
  const options = {
    root: defaultRoot,
    output: defaultOutput,
    mod2imp: path.join(
      workspaceRoot,
      "apps/resource-studio/workflows/commentaries/.local/tools/sword-1.9.0/utilities/.libs/mod2imp"
    )
  };
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Valeur absente : ${key}`);
    if (key === "--root") options.root = path.resolve(value);
    else if (key === "--output-dir") options.output = path.resolve(value);
    else if (key === "--mod2imp") options.mod2imp = path.resolve(value);
    else throw new Error(`Argument inconnu : ${key}`);
  }
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const acquired = await acquireSmithEntries(options);
  const entries = buildSmithEntries(acquired.entries);
  await mkdir(options.output, { recursive: true });
  const sqlitePath = path.join(options.output, "smith.sqlite");
  const temporarySqlitePath = path.join(
    options.output,
    `smith.sqlite.${process.pid}.tmp`
  );
  await buildSqlite(temporarySqlitePath, entries);
  await rename(temporarySqlitePath, sqlitePath);
  const repairedHeadwords = acquired.entries
    .filter((entry) => HEADWORD_REPAIRS.has(entry.word))
    .map((entry) => ({
      source: entry.word,
      replacement: HEADWORD_REPAIRS.get(entry.word),
      reason:
        "The definition is the High Priest article; the source heading contains a stray numeric fragment."
    }));
  const manifest = {
    generatedAt: new Date().toISOString(),
    work: "smith",
    source: acquired.source,
    editorialPolicy: {
      claim:
        "CrossWire digital transcription based on the 1884 Peloubet revision, with later digital enrichments preserved.",
      post1884Entries: ["BIBLE"],
      repairedHeadwords,
      duplicatePolicy:
        "Records sharing the same normalized headword are retained in one article, in source order."
    },
    counts: {
      sourceRecords: acquired.entries.length,
      entries: entries.length,
      mergedDuplicateRecords: acquired.entries.length - entries.length
    },
    sqlitePath
  };
  await writeFile(
    path.join(options.output, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
