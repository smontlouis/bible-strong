import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { buildCanonicalBibleFromLegacy } from "./legacyBiblePublication.js";
import { downloadR2Object, isR2Location } from "./r2ArtifactSources.js";
import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";
import {
  parseWordsOfJesusDataset,
  type LegacyRedWords,
  type WordsOfJesusDataset
} from "./wordsOfJesus.js";

const execFileAsync = promisify(execFile);
const LEGACY_ASSET_BASE_URL = "https://assets.bible-strong.app/bibles/";

export const WORDS_OF_JESUS_DATA_DIR = "workflows/words-of-jesus/data";
export const WORDS_OF_JESUS_OUTPUT_DIR = "outputs/words-of-jesus";
export const ORDINARY_BIBLE_SOURCES_PATH = "config/ordinary-bible-sources.json";
const SOURCE_CACHE_DIR = "outputs/bible-sources/cache";

export interface WordsOfJesusSourceOptions {
  root: string;
  /** Local replacements for a Bible's canonical text, by application version. */
  textOverrides?: Record<string, string>;
  fetcher?: typeof fetch;
}

export interface LoadedBibleText {
  versionId: string;
  sourceLocation: string;
  sourceSha256: string;
  /** True when the source already is a canonical publication (Strong pipeline). */
  canonicalSource: boolean;
  publication: CanonicalBiblePublication;
  /** The historical `{book: {chapter: {verse: text}}}` value, for legacy sources. */
  legacyBible?: unknown;
  /** Local copy of the source file (a ZIP archive or a JSON file). */
  sourceFilePath: string;
  sourceEntry: string;
  sourceEntryBytes: number;
}

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export const legacyAssetSlug = (versionId: string) =>
  versionId.toLowerCase().replaceAll("_", "-");

const cachePath = (root: string, location: string) =>
  path.join(
    root,
    SOURCE_CACHE_DIR,
    `${sha256(location)}${path.extname(new URL(location).pathname) || ".bin"}`
  );

/** Downloads a remote file once into the workflow cache; `undefined` on 404. */
export async function fetchCached(
  root: string,
  location: string,
  fetcher: typeof fetch = fetch
): Promise<string | undefined> {
  const isR2 = isR2Location(location);
  if (!isR2 && !/^https?:\/\//u.test(location))
    return path.resolve(root, location);
  const target = cachePath(root, location);
  if (existsSync(target)) return target;
  if (isR2) {
    await downloadR2Object(location, target);
    return target;
  }
  const response = await fetcher(location);
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(
      `bible-source-download-failed:${response.status}:${location}`
    );
  }
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, Buffer.from(await response.arrayBuffer()));
  await rename(temporary, target);
  return target;
}

const readSourceEntry = async (filePath: string, entry: string) => {
  if (!filePath.endsWith(".zip")) return readFile(filePath, "utf8");
  const result = await execFileAsync("unzip", ["-p", filePath, entry], {
    maxBuffer: 256 * 1024 * 1024
  });
  return result.stdout;
};

export interface OrdinaryBibleSource {
  sourceUrl: string;
  entry: string;
}

/**
 * Authoring inputs of a Bible publication: its verse text and, optionally,
 * historical pericopes. Delivered artifacts are described separately by the
 * mobile resource inventory.
 */
export interface OrdinaryBibleSources {
  schemaVersion: 1;
  bibles: Record<
    string,
    { text: OrdinaryBibleSource; pericope?: OrdinaryBibleSource }
  >;
}

export async function readOrdinaryBibleSources(
  root: string
): Promise<OrdinaryBibleSources> {
  const sources = JSON.parse(
    await readFile(path.join(root, ORDINARY_BIBLE_SOURCES_PATH), "utf8")
  ) as OrdinaryBibleSources;
  if (sources.schemaVersion !== 1 || !sources.bibles) {
    throw new Error("ordinary-bible-sources-invalid");
  }
  return sources;
}

const bibleSources = async (versionId: string, root: string) => {
  const sources = (await readOrdinaryBibleSources(root)).bibles[versionId];
  if (!sources) throw new Error(`bible-source-unknown:${versionId}`);
  return sources;
};

/**
 * Loads the exact verse text a Bible publication is built from: its authoring
 * text source, or a local override. Legacy JSON is normalized to the canonical
 * verse shape without headings or red letters.
 */
export async function loadBibleText(
  versionId: string,
  options: WordsOfJesusSourceOptions
): Promise<LoadedBibleText> {
  const { text } = await bibleSources(versionId, options.root);
  const location = options.textOverrides?.[versionId] ?? text.sourceUrl;
  const filePath = await fetchCached(options.root, location, options.fetcher);
  if (!filePath) throw new Error(`bible-source-missing:${location}`);
  const raw = await readSourceEntry(filePath, text.entry);
  const value = JSON.parse(raw) as Partial<CanonicalBiblePublication>;
  const sourceSha256 = sha256(raw);
  const sourceFile = {
    sourceFilePath: filePath,
    sourceEntry: text.entry,
    sourceEntryBytes: Buffer.byteLength(raw)
  };
  if (value.format === "bible-strong-canonical-bible") {
    return {
      versionId,
      sourceLocation: location,
      sourceSha256,
      canonicalSource: true,
      publication: value as CanonicalBiblePublication,
      ...sourceFile
    };
  }
  return {
    versionId,
    sourceLocation: location,
    sourceSha256,
    canonicalSource: false,
    ...sourceFile,
    legacyBible: value,
    publication: buildCanonicalBibleFromLegacy({
      versionId,
      sourceVersion: location,
      sourceSha256,
      bible: value
    })
  };
}

/** Historical pericopes of a Bible, when its sources declare them. */
export async function loadBiblePericope(
  versionId: string,
  options: WordsOfJesusSourceOptions
): Promise<
  { location: string; sha256: string; pericope: unknown } | undefined
> {
  const { pericope } = await bibleSources(versionId, options.root);
  if (!pericope) return undefined;
  const filePath = await fetchCached(
    options.root,
    pericope.sourceUrl,
    options.fetcher
  );
  if (!filePath) throw new Error(`bible-source-missing:${pericope.sourceUrl}`);
  const raw = await readSourceEntry(filePath, pericope.entry);
  return {
    location: pericope.sourceUrl,
    sha256: sha256(raw),
    pericope: JSON.parse(raw)
  };
}

/** Historical word-index red-word file of a Bible, when one was published. */
export async function loadLegacyRedWords(
  versionId: string,
  options: WordsOfJesusSourceOptions
): Promise<{ location: string; redWords: LegacyRedWords } | undefined> {
  const location = `${LEGACY_ASSET_BASE_URL}red-words-${legacyAssetSlug(versionId)}.json`;
  const filePath = await fetchCached(options.root, location, options.fetcher);
  if (!filePath) return undefined;
  return {
    location,
    redWords: JSON.parse(await readFile(filePath, "utf8")) as LegacyRedWords
  };
}

/**
 * Historical legacy JSON of a Bible now published from a canonical source.
 * Its red-word file was authored against this earlier wording.
 */
export async function loadLegacyAuthoredText(
  versionId: string,
  options: WordsOfJesusSourceOptions
): Promise<CanonicalBiblePublication | undefined> {
  const location = `${LEGACY_ASSET_BASE_URL}bible-${legacyAssetSlug(versionId)}.json`;
  const filePath = await fetchCached(options.root, location, options.fetcher);
  if (!filePath) return undefined;
  const raw = await readFile(filePath, "utf8");
  return buildCanonicalBibleFromLegacy({
    versionId,
    sourceVersion: location,
    sourceSha256: sha256(raw),
    bible: JSON.parse(raw) as unknown
  });
}

export const wordsOfJesusDatasetPath = (root: string, versionId: string) =>
  path.join(
    root,
    WORDS_OF_JESUS_DATA_DIR,
    `${legacyAssetSlug(versionId)}.jsonl`
  );

export async function readWordsOfJesusDataset(
  root: string,
  versionId: string
): Promise<WordsOfJesusDataset | undefined> {
  const datasetPath = wordsOfJesusDatasetPath(root, versionId);
  if (!existsSync(datasetPath)) return undefined;
  const dataset = parseWordsOfJesusDataset(await readFile(datasetPath, "utf8"));
  if (dataset.versionId !== versionId) {
    throw new Error(`words-of-jesus-dataset-version-mismatch:${datasetPath}`);
  }
  return dataset;
}
