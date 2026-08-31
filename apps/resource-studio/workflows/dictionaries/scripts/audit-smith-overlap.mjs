#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, TextDecoder } from "node:util";

const execFileAsync = promisify(execFile);
const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const defaultRoot = path.join(workflowRoot, ".local/smith");
const SMITH_ARCHIVE_URL =
  "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Smith.zip";
const SMITH_ARCHIVE_SHA256 =
  "88a2c2d11f70b2484fa39d61a8e821849dca799d51e1593e8a2839f6313a8f9a";

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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

export const normalizeSmithHeadword = (value) =>
  decodeHtml(value)
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

const headwordStopwords = new Set(["the", "of", "and", "or"]);

const headwordSignatures = (value) => {
  const normalized = normalizeSmithHeadword(value);
  const signatures = new Set([normalized]);
  const alternatives = /\bor\b|=/iu.test(value)
    ? String(value).split(/\s*(?:,?\s+or\s+|=|,)\s*/iu)
    : [value];
  for (const alternative of alternatives) {
    const strict = normalizeSmithHeadword(alternative);
    if (strict) signatures.add(strict);
    const tokens = strict
      .split(" ")
      .filter((token) => token && !headwordStopwords.has(token));
    if (tokens.length >= 2) signatures.add(`tokens:${tokens.sort().join(" ")}`);
  }
  const fullTokens = normalized
    .split(" ")
    .filter((token) => token && !headwordStopwords.has(token));
  if (fullTokens.length >= 2)
    signatures.add(`tokens:${fullTokens.sort().join(" ")}`);
  return [...signatures].filter(Boolean);
};

export const parseSmithImp = (value) => {
  const entries = [];
  let current;
  for (const line of String(value).split(/\r?\n/u)) {
    if (line.startsWith("$$$")) {
      if (current)
        entries.push({
          ...current,
          definition: current.lines.join("\n").trim()
        });
      current = { word: line.slice(3).trim(), lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current)
    entries.push({ ...current, definition: current.lines.join("\n").trim() });
  return entries.map(({ word, definition }) => ({ word, definition }));
};

const plainText = (html) =>
  decodeHtml(
    String(html)
      .replace(/<div class=['"]sserif['"][\s\S]*$/iu, "")
      .replace(/^<p><strong>[\s\S]*?<\/strong><\/p>/iu, "")
      .replace(/<[^>]*>/gu, " ")
  )
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();

const shingles = (html, width = 3) => {
  const words = plainText(html).split(/\s+/u).filter(Boolean);
  const values = new Set();
  for (let index = 0; index <= words.length - width; index += 1)
    values.add(words.slice(index, index + width).join(" "));
  return values;
};

const similarity = (leftHtml, rightHtml) => {
  const left = shingles(leftHtml);
  const right = shingles(rightHtml);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
};

const median = (values) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
};

export const computeSmithOverlap = ({ smithEntries, existingEntries }) => {
  const smithTitles = new Map();
  for (const entry of smithEntries) {
    const normalized = normalizeSmithHeadword(entry.word);
    if (!normalized) continue;
    if (!smithTitles.has(normalized)) smithTitles.set(normalized, []);
    smithTitles.get(normalized).push(entry);
  }
  const existingTitles = new Map();
  const existingSignatures = new Map();
  for (const entry of existingEntries) {
    existingTitles.set(normalizeSmithHeadword(entry.word), entry);
    for (const signature of headwordSignatures(entry.word)) {
      if (!existingSignatures.has(signature))
        existingSignatures.set(signature, []);
      existingSignatures.get(signature).push(entry);
    }
  }
  const exactMatches = [];
  const variantMatches = [];
  const uniqueToSmith = [];
  for (const [normalized, entries] of smithTitles) {
    const existing = existingTitles.get(normalized);
    if (!existing) {
      const candidates = new Map();
      for (const signature of headwordSignatures(entries[0].word)) {
        for (const candidate of existingSignatures.get(signature) ?? [])
          candidates.set(candidate.word, candidate);
      }
      if (candidates.size === 1) {
        const candidate = [...candidates.values()][0];
        variantMatches.push({
          word: entries[0].word,
          existingWord: candidate.word
        });
      } else
        uniqueToSmith.push({
          word: entries[0].word,
          characters: entries.reduce(
            (total, entry) => total + entry.definition.length,
            0
          )
        });
      continue;
    }
    const smithDefinition = entries.map((entry) => entry.definition).join("\n");
    exactMatches.push({
      word: entries[0].word,
      existingWord: existing.word,
      hasEaston: /Easton(?:&#39;|')s Bible Dictionary/iu.test(
        existing.definition
      ),
      hasWebster: /Webster(?:&#39;|')s 1828 Dictionary/iu.test(
        existing.definition
      ),
      contentSimilarity: similarity(smithDefinition, existing.definition)
    });
  }
  const similarities = exactMatches
    .filter((match) => match.hasEaston)
    .map((match) => match.contentSimilarity);
  return {
    smithRecords: smithEntries.length,
    smithUniqueHeadwords: smithTitles.size,
    existingRecords: existingEntries.length,
    exactHeadwordMatches: exactMatches.length,
    exactHeadwordCoverage: exactMatches.length / smithTitles.size,
    variantHeadwordMatches: variantMatches.length,
    totalHeadwordMatches: exactMatches.length + variantMatches.length,
    totalHeadwordCoverage:
      (exactMatches.length + variantMatches.length) / smithTitles.size,
    matchesWithEaston: exactMatches.filter((match) => match.hasEaston).length,
    matchesWithWebsterOnly: exactMatches.filter(
      (match) => match.hasWebster && !match.hasEaston
    ).length,
    uniqueToSmithCount: uniqueToSmith.length,
    uniqueToSmithAtLeast200Characters: uniqueToSmith.filter(
      (entry) => entry.characters >= 200
    ).length,
    uniqueToSmithAtLeast1000Characters: uniqueToSmith.filter(
      (entry) => entry.characters >= 1_000
    ).length,
    eastonContentSimilarity: {
      median: median(similarities),
      atLeast25Percent: similarities.filter((value) => value >= 0.25).length,
      atLeast50Percent: similarities.filter((value) => value >= 0.5).length,
      atLeast75Percent: similarities.filter((value) => value >= 0.75).length
    },
    uniqueToSmith: uniqueToSmith
      .map((entry) => entry.word)
      .sort((left, right) => left.localeCompare(right, "en")),
    longestUniqueToSmith: [...uniqueToSmith]
      .sort((left, right) => right.characters - left.characters)
      .slice(0, 30),
    variantMatches: variantMatches.sort((left, right) =>
      left.word.localeCompare(right.word, "en")
    ),
    strongestContentMatches: exactMatches
      .filter((match) => match.hasEaston)
      .sort((left, right) => right.contentSimilarity - left.contentSimilarity)
      .slice(0, 50)
  };
};

const querySqlite = async (databasePath, query) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, query],
    {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024
    }
  );
  return JSON.parse(stdout || "[]");
};

const download = async (url, destination) => {
  const response = await globalThis.fetch(url, {
    headers: {
      "user-agent": "BibleStrongResourceStudio/1.0 (+https://bible-strong.app)"
    },
    signal: globalThis.AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`smith-download-http-${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return bytes;
};

const confValue = (configuration, key) =>
  new RegExp(`^${key}=(.*)$`, "mu").exec(configuration)?.[1]?.trim() ?? "";

export const acquireSmithEntries = async ({ root, mod2imp }) => {
  const sourceDirectory = path.join(root, "source");
  const installedDirectory = path.join(root, "installed");
  const archivePath = path.join(sourceDirectory, "Smith.zip");
  await Promise.all([
    mkdir(sourceDirectory, { recursive: true }),
    mkdir(installedDirectory, { recursive: true })
  ]);
  const archive = (await exists(archivePath))
    ? await readFile(archivePath)
    : await download(SMITH_ARCHIVE_URL, archivePath);
  const archiveSha256 = sha256(archive);
  if (archiveSha256 !== SMITH_ARCHIVE_SHA256)
    throw new Error(`smith-archive-digest-mismatch:${archiveSha256}`);
  await execFileAsync("unzip", ["-oq", archivePath, "-d", installedDirectory]);
  const configurationPath = path.join(installedDirectory, "mods.d/smith.conf");
  const configuration = await readFile(configurationPath, "utf8");
  if (confValue(configuration, "DistributionLicense") !== "Public Domain")
    throw new Error("smith-license-not-public-domain");
  const { stdout } = await execFileAsync(mod2imp, ["Smith"], {
    encoding: "buffer",
    env: { ...process.env, SWORD_PATH: installedDirectory },
    maxBuffer: 64 * 1024 * 1024
  });
  const imp = new TextDecoder("windows-1252").decode(stdout);
  const entries = parseSmithImp(imp);
  if (entries.length < 4_000) throw new Error("smith-entry-count-too-low");
  await writeFile(
    path.join(root, "smith.entries.json"),
    `${JSON.stringify(entries)}\n`
  );
  return {
    entries,
    source: {
      provider: "CrossWire",
      module: "Smith",
      title: confValue(configuration, "Description"),
      moduleVersion: confValue(configuration, "Version"),
      moduleDate: confValue(configuration, "SwordVersionDate"),
      distributionLicense: confValue(configuration, "DistributionLicense"),
      archiveUrl: SMITH_ARCHIVE_URL,
      archiveSha256,
      sourceEncoding: "Windows-1252"
    }
  };
};

const parseArguments = (values) => {
  const options = {
    root: defaultRoot,
    database: path.join(defaultRoot, "../normalized/easton-webster.sqlite"),
    mod2imp: path.join(
      workspaceRoot,
      "apps/resource-studio/workflows/commentaries/.local/tools/sword-1.9.0/utilities/.libs/mod2imp"
    ),
    report: path.join(defaultRoot, "overlap-report.json")
  };
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Valeur absente : ${key}`);
    if (key === "--root") options.root = path.resolve(value);
    else if (key === "--database") options.database = path.resolve(value);
    else if (key === "--mod2imp") options.mod2imp = path.resolve(value);
    else if (key === "--report") options.report = path.resolve(value);
    else throw new Error(`Argument inconnu : ${key}`);
  }
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  await mkdir(path.dirname(options.report), { recursive: true });
  const acquired = await acquireSmithEntries(options);
  const smithEntries = acquired.entries;
  const existingEntries = await querySqlite(
    options.database,
    "SELECT word, definition FROM dictionnaire ORDER BY id"
  );
  const overlap = computeSmithOverlap({ smithEntries, existingEntries });
  const post1884Entries = smithEntries
    .filter((entry) =>
      /American Standard Version|Revised Standard Version|\b1946\b/iu.test(
        entry.definition
      )
    )
    .map((entry) => entry.word);
  const report = {
    generatedAt: new Date().toISOString(),
    source: acquired.source,
    transcriptionAudit: {
      post1884Entries,
      passesPure1884Claim: post1884Entries.length === 0
    },
    overlap
  };
  await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`);
  const overlapSummary = { ...overlap };
  delete overlapSummary.uniqueToSmith;
  delete overlapSummary.variantMatches;
  delete overlapSummary.strongestContentMatches;
  delete overlapSummary.longestUniqueToSmith;
  process.stdout.write(
    `${JSON.stringify(
      {
        source: report.source,
        transcriptionAudit: report.transcriptionAudit,
        overlap: overlapSummary,
        exhaustiveReport: options.report
      },
      null,
      2
    )}\n`
  );
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
