import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { LEXICAL_MORPHOLOGY_SUPPLEMENTS } from "../src/lexiconV3/morphologySupplements.js";

interface StepSource {
  language: "greek" | "hebrew";
  localName: string;
  url: string;
}

interface LexiconResourceSource {
  language: "greek" | "hebrew";
  localName: string;
  url: string;
  source: string;
  kind: string;
}

interface MorphologySource {
  language: "greek" | "hebrew";
  localName: string;
  url: string;
  source: string;
}

interface StepEntry {
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
}

interface LexiconResource {
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  source: string;
  kind: string;
  contentHtml: string;
}

interface MorphologyCode {
  code: string;
  normalizedCode: string;
  language: "greek" | "hebrew" | "aramaic" | "name" | "unknown";
  scope: "lexical_brief" | "tagged_full";
  example: string;
  meaning: string;
  description: string;
  source: string;
}

const SOURCES: StepSource[] = [
  {
    language: "greek",
    localName: "TBESG.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt"
  },
  {
    language: "hebrew",
    localName: "TBESH.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt"
  }
];

const LEXICON_RESOURCE_SOURCES: LexiconResourceSource[] = [
  {
    language: "greek",
    localName: "TFLSJ.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TFLSJ%20%200-5624%20-%20Translators%20Formatted%20full%20LSJ%20Bible%20lexicon%20-%20STEPBible.org%20CC%20BY.txt",
    source: "TFLSJ",
    kind: "classical_full"
  }
];

const MORPHOLOGY_SOURCES: MorphologySource[] = [
  {
    language: "greek",
    localName: "TEGMC.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Morphology%20codes/TEGMC%20-%20Translators%20Expansion%20of%20Greek%20Morphhology%20Codes%20-%20STEPBible.org%20CC%20BY.txt",
    source: "TEGMC"
  },
  {
    language: "hebrew",
    localName: "TEHMC.txt",
    url: "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Morphology%20codes/TEHMC%20-%20Translators%20Expansion%20of%20Hebrew%20Morphology%20Codes%20-%20STEPBible.org%20CC%20BY.txt",
    source: "TEHMC"
  }
];

const DEFAULT_OUTPUT = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_CACHE_DIR = "data/external/stepbible";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(args.output ?? DEFAULT_OUTPUT);
  const cacheDir = path.resolve(args.cacheDir ?? DEFAULT_CACHE_DIR);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  const entries: StepEntry[] = [];
  const lexiconResources: LexiconResource[] = [];
  const morphologyCodes: MorphologyCode[] = [];
  const sourceDigests: Record<string, string> = {};

  for (const source of SOURCES) {
    const sourcePath = path.join(cacheDir, source.localName);
    await downloadIfNeeded(source.url, sourcePath, args.refresh === "true");
    const content = await readFile(sourcePath, "utf8");
    sourceDigests[source.localName] = sha256(content);
    entries.push(...parseStepEntries(content, source));
  }

  for (const source of LEXICON_RESOURCE_SOURCES) {
    const sourcePath = path.join(cacheDir, source.localName);
    await downloadIfNeeded(source.url, sourcePath, args.refresh === "true");
    const content = await readFile(sourcePath, "utf8");
    sourceDigests[source.localName] = sha256(content);
    lexiconResources.push(...parseLexiconResources(content, source));
  }

  for (const source of MORPHOLOGY_SOURCES) {
    const sourcePath = path.join(cacheDir, source.localName);
    await downloadIfNeeded(source.url, sourcePath, args.refresh === "true");
    const content = await readFile(sourcePath, "utf8");
    sourceDigests[source.localName] = sha256(content);
    morphologyCodes.push(...parseMorphologyCodes(content, source));
  }

  // STEP's lexicon files contain a small number of documented morphology
  // values that are absent from the standalone brief-code lists.
  morphologyCodes.push(...LEXICAL_MORPHOLOGY_SUPPLEMENTS);

  const tempPath = `${outputPath}.tmp`;
  await rm(tempPath, { force: true });
  await rm(outputPath, { force: true });

  const sql = buildSql({
    entries,
    lexiconResources,
    morphologyCodes,
    sourceDigests,
    generatedAt: new Date().toISOString()
  });

  const result = spawnSync("sqlite3", [tempPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });

  if (result.status !== 0) {
    throw new Error(
      `sqlite3 failed with status ${result.status}\n${result.stderr}`
    );
  }

  await rename(tempPath, outputPath);

  const report = {
    output: outputPath,
    generatedAt: new Date().toISOString(),
    source: "STEPBible-Data",
    license: "CC BY 4.0",
    attribution: "STEP Bible (https://www.stepbible.org/)",
    rights:
      "This project holds permission to reuse, display, and translate the TBESH Meaning field; confirmed by the project owner on 2026-07-13.",
    sources: sourceDigests,
    counts: {
      stepEntries: entries.length,
      greekStepEntries: entries.filter((entry) => entry.language === "greek")
        .length,
      hebrewStepEntries: entries.filter((entry) => entry.language === "hebrew")
        .length,
      lexiconResources: lexiconResources.length,
      greekLexiconResources: lexiconResources.filter(
        (resource) => resource.language === "greek"
      ).length,
      morphologyCodes: morphologyCodes.length,
      lexicalBriefMorphologyCodes: morphologyCodes.filter(
        (code) => code.scope === "lexical_brief"
      ).length,
      taggedFullMorphologyCodes: morphologyCodes.filter(
        (code) => code.scope === "tagged_full"
      ).length
    }
  };

  await writeFile(
    `${outputPath}.report.json`,
    `${JSON.stringify(report, null, 2)}\n`
  );

  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${outputPath}.report.json`);
  console.log(JSON.stringify(report.counts, null, 2));
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[i + 1];

    if (inlineValue !== undefined) {
      parsed[toCamelCase(rawKey)] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[toCamelCase(rawKey)] = nextValue;
      i += 1;
    } else {
      parsed[toCamelCase(rawKey)] = "true";
    }
  }

  return parsed;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}

async function downloadIfNeeded(
  url: string,
  destination: string,
  refresh: boolean
): Promise<void> {
  if (!refresh && existsSync(destination)) {
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const content = await response.text();
  await writeFile(destination, content);
}

function parseStepEntries(content: string, source: StepSource): StepEntry[] {
  const entries: StepEntry[] = [];
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const prefix = source.language === "greek" ? "G" : "H";
  const dataLinePattern = new RegExp(`^${prefix}\\d{4,5}[A-Za-z]?\\t`);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!dataLinePattern.test(line)) {
      continue;
    }

    const fields = line.split("\t");
    if (fields.length < 8) {
      continue;
    }

    entries.push({
      language: source.language,
      eStrong: fields[0].trim(),
      dStrong: fields[1].trim(),
      uStrong: fields[2].trim(),
      original: cleanCell(fields[3]),
      transliteration: cleanCell(fields[4]),
      morph: cleanCell(fields[5]),
      gloss: cleanCell(fields[6]),
      meaning: cleanMeaning(fields.slice(7).join("\t"))
    });
  }

  return entries;
}

function parseLexiconResources(
  content: string,
  source: LexiconResourceSource
): LexiconResource[] {
  const resources: LexiconResource[] = [];
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const prefix = source.language === "greek" ? "G" : "H";
  const dataLinePattern = new RegExp(`^${prefix}\\d{4,5}[A-Za-z]?\\t`);

  for (const line of lines) {
    if (!dataLinePattern.test(line)) {
      continue;
    }

    const fields = line.split("\t");
    if (fields.length < 8) {
      continue;
    }

    const contentHtml = cleanLexiconHtml(fields.slice(7).join("\t"));

    resources.push({
      language: source.language,
      eStrong: fields[0].trim(),
      dStrong: fields[1].trim(),
      uStrong: fields[2].trim(),
      source: source.source,
      kind: source.kind,
      contentHtml
    });
  }

  return resources;
}

function parseMorphologyCodes(
  content: string,
  source: MorphologySource
): MorphologyCode[] {
  const codes: MorphologyCode[] = [];
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const fullSectionIndex = lines.findIndex((line) =>
    line.startsWith("FULL MORPHOLOGY CODES")
  );
  const briefLines =
    fullSectionIndex === -1 ? lines : lines.slice(0, fullSectionIndex);
  const fullLines =
    fullSectionIndex === -1 ? [] : lines.slice(fullSectionIndex + 1);

  codes.push(...parseBriefMorphologyCodes(briefLines, source));
  codes.push(...parseFullMorphologyCodes(fullLines, source));

  return codes;
}

function parseBriefMorphologyCodes(
  lines: string[],
  source: MorphologySource
): MorphologyCode[] {
  const codes: MorphologyCode[] = [];
  const headerIndex = lines.findIndex((line) =>
    line.startsWith("Code\tExample in English\tMeaning")
  );

  if (headerIndex === -1) {
    return codes;
  }

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith("=")) {
      continue;
    }

    const fields = line.split("\t");
    if (fields.length < 3) {
      continue;
    }

    const code = cleanCell(fields[0]);
    const example = cleanCell(fields[1]);
    const meaning = cleanCell(fields.slice(2).join(" "));

    if (!code || code.includes("...")) {
      continue;
    }

    codes.push({
      code,
      normalizedCode: normalizeMorphologyCode(code),
      language: morphologyLanguage(code, source),
      scope: "lexical_brief",
      example,
      meaning,
      description: meaning ? `Lexical category: ${meaning}.` : "",
      source: source.source
    });
  }

  return codes;
}

function parseFullMorphologyCodes(
  lines: string[],
  source: MorphologySource
): MorphologyCode[] {
  const codes: MorphologyCode[] = [];
  let index = 0;

  while (index < lines.length) {
    if (lines[index]?.trim() !== "$") {
      index += 1;
      continue;
    }

    const codeLine = lines[index + 1]?.trim() ?? "";
    const meaningLine = lines[index + 2]?.trim() ?? "";
    const descriptionLine = lines[index + 3]?.trim() ?? "";
    const exampleLine = lines[index + 4]?.trim() ?? "";
    const [rawCode, ...detailParts] = codeLine.split("\t");
    const code = cleanCell(rawCode ?? "");

    if (code && !code.startsWith('"')) {
      codes.push({
        code,
        normalizedCode: normalizeMorphologyCode(code),
        language: source.language,
        scope: "tagged_full",
        example: trimQuotes(cleanCell(exampleLine)),
        meaning: trimQuotes(cleanCell(meaningLine)),
        description: trimQuotes(
          cleanCell([detailParts.join(" "), descriptionLine].join(" "))
        ),
        source: source.source
      });
    }

    index += 5;
  }

  return codes;
}

function morphologyLanguage(
  code: string,
  source: MorphologySource
): MorphologyCode["language"] {
  if (code.startsWith("G:")) {
    return "greek";
  }
  if (code.startsWith("H:")) {
    return "hebrew";
  }
  if (code.startsWith("A:")) {
    return "aramaic";
  }
  if (code.startsWith("N:")) {
    return "name";
  }

  return source.language;
}

function trimQuotes(value: string): string {
  return value.replace(/^"+|"+$/g, "");
}

function normalizeMorphologyCode(code: string): string {
  return code
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s+/g, " ")
    .trim();
}

function codeNumber(strong: string): number | null {
  const match = strong.match(/^[GH](\d{4,5})[A-Za-z]?$/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function cleanCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanMeaning(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/<\s*BR\s*\/?\s*>/giu, "<br />")
    .replace(/<ref='[^']*'>(.*?)<\/ref>/giu, "$1")
    .replace(/<ref="[^"]*">(.*?)<\/ref>/giu, "$1")
    .replace(/\s+__([IVX0-9a-z])/giu, "<br />$1")
    .replace(/__([IVX0-9a-z])/giu, "$1")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function cleanLexiconHtml(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/<\s*BR\s*\/?\s*>/giu, "<br />")
    .replace(
      /<a\s+href="javascript:void\(0\)"\s+title="([^"]*)">(.*?)<\/a>/giu,
      (_, title: string, label: string) => {
        const cleanedTitle = htmlToText(title);
        const cleanedLabel = htmlToText(label);
        return cleanedTitle
          ? `${cleanedLabel} (${cleanedTitle})`
          : cleanedLabel;
      }
    )
    .replace(/\s+__([IVX0-9a-z])/giu, "<br />$1")
    .replace(/__([IVX0-9a-z])/giu, "$1")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function htmlToText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSql(input: {
  entries: StepEntry[];
  lexiconResources: LexiconResource[];
  morphologyCodes: MorphologyCode[];
  sourceDigests: Record<string, string>;
  generatedAt: string;
}): string {
  const statements: string[] = [
    "PRAGMA journal_mode = OFF;",
    "PRAGMA synchronous = OFF;",
    "PRAGMA foreign_keys = ON;",
    "BEGIN;",
    `CREATE TABLE StepEntries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL,
      baseCode INTEGER NOT NULL,
      eStrong TEXT NOT NULL,
      dStrong TEXT NOT NULL,
      uStrong TEXT NOT NULL,
      original TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      morph TEXT NOT NULL,
      gloss TEXT NOT NULL,
      meaning TEXT NOT NULL,
      UNIQUE(language, eStrong, dStrong, uStrong)
    );`,
    "CREATE INDEX idx_StepEntries_language_baseCode ON StepEntries(language, baseCode);",
    "CREATE INDEX idx_StepEntries_eStrong ON StepEntries(eStrong);",
    `CREATE TABLE LexiconResources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stepEntryId INTEGER NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      contentHtml TEXT NOT NULL,
      FOREIGN KEY (stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE,
      UNIQUE(stepEntryId, source, kind)
    );`,
    "CREATE INDEX idx_LexiconResources_stepEntryId ON LexiconResources(stepEntryId);",
    "CREATE INDEX idx_LexiconResources_source_kind ON LexiconResources(source, kind);",
    `CREATE TABLE MorphologyCodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      normalizedCode TEXT NOT NULL,
      language TEXT NOT NULL,
      scope TEXT NOT NULL,
      example TEXT NOT NULL,
      meaning TEXT NOT NULL,
      description TEXT NOT NULL,
      source TEXT NOT NULL,
      UNIQUE(source, scope, code)
    );`,
    "CREATE INDEX idx_MorphologyCodes_code ON MorphologyCodes(code);",
    "CREATE INDEX idx_MorphologyCodes_normalizedCode ON MorphologyCodes(normalizedCode);",
    "CREATE INDEX idx_MorphologyCodes_scope ON MorphologyCodes(scope);",
    "CREATE TABLE DictionaryMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    insertMeta("generatedAt", input.generatedAt),
    insertMeta("source", "STEPBible-Data"),
    insertMeta("license", "CC BY 4.0"),
    insertMeta("attribution", "STEP Bible (https://www.stepbible.org/)"),
    insertMeta(
      "rights",
      "This project holds permission to reuse, display, and translate the TBESH Meaning field; confirmed by the project owner on 2026-07-13."
    ),
    insertMeta("sourceDigests", JSON.stringify(input.sourceDigests))
  ];

  for (const entry of input.entries) {
    const baseCode = codeNumber(entry.eStrong);
    if (baseCode === null) {
      continue;
    }

    statements.push(
      `INSERT INTO StepEntries (language, baseCode, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning) VALUES (${[
        sqlString(entry.language),
        baseCode.toString(),
        sqlString(entry.eStrong),
        sqlString(entry.dStrong),
        sqlString(entry.uStrong),
        sqlString(entry.original),
        sqlString(entry.transliteration),
        sqlString(entry.morph),
        sqlString(entry.gloss),
        sqlString(entry.meaning)
      ].join(", ")});`
    );
  }

  for (const resource of input.lexiconResources) {
    statements.push(
      `INSERT INTO LexiconResources (stepEntryId, source, kind, contentHtml) VALUES ((SELECT id FROM StepEntries WHERE language = ${sqlString(
        resource.language
      )} AND eStrong = ${sqlString(resource.eStrong)} AND dStrong = ${sqlString(
        resource.dStrong
      )} AND uStrong = ${sqlString(resource.uStrong)}), ${[
        sqlString(resource.source),
        sqlString(resource.kind),
        sqlString(resource.contentHtml)
      ].join(", ")});`
    );
  }

  for (const code of input.morphologyCodes) {
    statements.push(
      `INSERT OR IGNORE INTO MorphologyCodes (code, normalizedCode, language, scope, example, meaning, description, source) VALUES (${[
        sqlString(code.code),
        sqlString(code.normalizedCode),
        sqlString(code.language),
        sqlString(code.scope),
        sqlString(code.example),
        sqlString(code.meaning),
        sqlString(code.description),
        sqlString(code.source)
      ].join(", ")});`
    );
  }

  statements.push("COMMIT;");
  statements.push("VACUUM;");

  return `${statements.join("\n")}\n`;
}

function insertMeta(key: string, value: string): string {
  return `INSERT INTO DictionaryMeta (key, value) VALUES (${sqlString(
    key
  )}, ${sqlString(value)});`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
