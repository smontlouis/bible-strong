import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildHebrewEnglishArtifact,
  OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
  verifyPinnedOpenScripturesSourceFile,
  writeHebrewEnglishArtifact
} from "../src/lexiconV3/hebrewEnglish.js";

const DEFAULT_LEXICON_DB =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_ENTITIES_DB = "data/entities/bible_entities.production.sqlite";
const DEFAULT_SOURCES = "data/external/openscriptures-hebrew-lexicon";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/hebrew-english.candidates.jsonl";
const DEFAULT_SUMMARY =
  "outputs/lexicon-v3/hebrew-english.candidates.summary.json";

interface CliOptions {
  lexiconDbPath: string;
  entitiesDbPath: string;
  hebrewStrongPath: string;
  augIndexPath?: string;
  lexicalIndexPath?: string;
  brownDriverBriggsPath?: string;
  outputPath: string;
  summaryPath: string;
}

export function buildLexiconV3HebrewEnglish(options: CliOptions): void {
  verifyPinnedOpenScripturesSourceFile(
    "HebrewStrong.xml",
    options.hebrewStrongPath
  );
  if (options.augIndexPath) {
    verifyPinnedOpenScripturesSourceFile("AugIndex.xml", options.augIndexPath);
  }
  if (options.lexicalIndexPath) {
    verifyPinnedOpenScripturesSourceFile(
      "LexicalIndex.xml",
      options.lexicalIndexPath
    );
  }
  if (options.brownDriverBriggsPath) {
    verifyPinnedOpenScripturesSourceFile(
      "BrownDriverBriggs.xml",
      options.brownDriverBriggsPath
    );
  }
  const artifact = buildHebrewEnglishArtifact({
    lexiconDbPath: options.lexiconDbPath,
    entitiesDbPath: options.entitiesDbPath,
    hebrewStrongPath: options.hebrewStrongPath,
    augIndexPath: options.augIndexPath,
    lexicalIndexPath: options.lexicalIndexPath,
    brownDriverBriggsPath: options.brownDriverBriggsPath,
    openScripturesRevision: OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT
  });
  writeHebrewEnglishArtifact(artifact, options.outputPath, options.summaryPath);
  console.log(
    JSON.stringify(
      {
        output: options.outputPath,
        summary: options.summaryPath,
        coverage: artifact.summary.coverage,
        recordsDigest: artifact.summary.recordsDigest
      },
      null,
      2
    )
  );
}

export function parseLexiconV3HebrewEnglishArgs(
  argv: readonly string[]
): CliOptions {
  const allowed = new Set([
    "lexicon-db",
    "entities-db",
    "hebrew-strong",
    "sources-dir",
    "lexical-index",
    "aug-index",
    "bdb",
    "output",
    "summary-json"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag?.startsWith("--")) throw new Error(`unexpected-argument:${flag}`);
    const key = flag.slice(2);
    if (key === "verify-pinned" || key === "revision") {
      throw new Error("hebrew-source-pinning-cannot-be-disabled");
    }
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing-value:${flag}`);
    }
    values.set(key, value);
    index += 1;
  }
  const sources = resolve(values.get("sources-dir") ?? DEFAULT_SOURCES);
  const lexicalIndexPath = optionalSource(
    values.get("lexical-index"),
    resolve(sources, "LexicalIndex.xml")
  );
  const augIndexPath = optionalSource(
    values.get("aug-index"),
    resolve(sources, "AugIndex.xml")
  );
  const brownDriverBriggsPath = optionalSource(
    values.get("bdb"),
    resolve(sources, "BrownDriverBriggs.xml")
  );
  return {
    lexiconDbPath: resolve(values.get("lexicon-db") ?? DEFAULT_LEXICON_DB),
    entitiesDbPath: resolve(values.get("entities-db") ?? DEFAULT_ENTITIES_DB),
    hebrewStrongPath: resolve(
      values.get("hebrew-strong") ?? resolve(sources, "HebrewStrong.xml")
    ),
    augIndexPath,
    lexicalIndexPath,
    brownDriverBriggsPath,
    outputPath: resolve(values.get("output") ?? DEFAULT_OUTPUT),
    summaryPath: resolve(values.get("summary-json") ?? DEFAULT_SUMMARY)
  };
}

function optionalSource(
  value: string | undefined,
  fallback: string
): string | undefined {
  if (value === "none") return undefined;
  if (value) return resolve(value);
  return existsSync(fallback) ? fallback : undefined;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  buildLexiconV3HebrewEnglish(
    parseLexiconV3HebrewEnglishArgs(process.argv.slice(2))
  );
}
