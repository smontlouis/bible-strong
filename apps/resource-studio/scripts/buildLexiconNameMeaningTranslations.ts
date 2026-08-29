import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { parseStepCompiledNameMeanings } from "../src/lexiconNameMeanings.js";

const DEFAULT_GREEK = "data/external/stepbible/lexicon_greek.txt";
const DEFAULT_HEBREW = "data/external/stepbible/lexicon_hebrew.txt";
const DEFAULT_OUTPUT = "config/lexicon-name-meaning-translations.fr.jsonl";
const DEEPL_FREE_BASE = "https://api-free.deepl.com/v2";
const DEEPL_PRO_BASE = "https://api.deepl.com/v2";

interface TranslationRecord {
  sourceTextSha256: string;
  sourceText: string;
  language: "fr";
  valueHtml: string;
  engine: "deepl";
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const greekPath = resolve(args.greek ?? DEFAULT_GREEK);
  const hebrewPath = resolve(args.hebrew ?? DEFAULT_HEBREW);
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("missing-DEEPL_API_KEY");

  const meanings = parseStepCompiledNameMeanings({
    greek: readFileSync(greekPath, "utf8"),
    hebrew: readFileSync(hebrewPath, "utf8")
  });
  const unique = new Map(
    meanings.map((meaning) => [meaning.sourceTextSha256, meaning.sourceText])
  );
  const existing = readExisting(outputPath);
  const missing = [...unique]
    .filter(
      ([hash, sourceText]) => existing.get(hash)?.sourceText !== sourceText
    )
    .sort((left, right) => left[0].localeCompare(right[0], "en"));

  const apiBase = apiKey.endsWith(":fx") ? DEEPL_FREE_BASE : DEEPL_PRO_BASE;
  for (let index = 0; index < missing.length; index += 40) {
    const batch = missing.slice(index, index + 40);
    const translations = await translateWithDeepL(
      apiBase,
      apiKey,
      batch.map(([, sourceText]) => sourceText)
    );
    if (translations.length !== batch.length) {
      throw new Error(
        `deepl-result-count-mismatch:${translations.length}:${batch.length}`
      );
    }
    batch.forEach(([sourceTextSha256, sourceText], offset) => {
      existing.set(sourceTextSha256, {
        sourceTextSha256,
        sourceText,
        language: "fr",
        valueHtml: translations[offset]!.text.trim(),
        engine: "deepl"
      });
    });
    process.stdout.write(
      `translated ${Math.min(index + batch.length, missing.length)}/${missing.length}\n`
    );
  }

  const records = [...existing.values()]
    .filter(
      (record) => unique.get(record.sourceTextSha256) === record.sourceText
    )
    .sort((left, right) =>
      left.sourceTextSha256.localeCompare(right.sourceTextSha256, "en")
    );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        entries: meanings.length,
        uniqueSourceTexts: unique.size,
        translatedNow: missing.length,
        outputPath
      },
      null,
      2
    )}\n`
  );
}

async function translateWithDeepL(
  apiBase: string,
  apiKey: string,
  texts: string[]
): Promise<Array<{ text: string }>> {
  const response = await fetch(`${apiBase}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: texts,
      source_lang: "EN",
      target_lang: "FR",
      tag_handling: "html",
      split_sentences: "nonewlines",
      preserve_formatting: true,
      model_type: "quality_optimized"
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`deepl-http-${response.status}:${body.slice(0, 300)}`);
  }
  return ((await response.json()) as { translations: Array<{ text: string }> })
    .translations;
}

function readExisting(filePath: string): Map<string, TranslationRecord> {
  if (!existsSync(filePath)) return new Map();
  return new Map(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as TranslationRecord)
      .map((record) => [record.sourceTextSha256, record])
  );
}

function loadDotEnv(filePath = ".env"): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line.trim());
    if (!match || process.env[match[1]!]) continue;
    process.env[match[1]!] = match[2]!.replace(/^['"]|['"]$/gu, "");
  }
}

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = "true";
    }
  }
  return result;
}

await main();
