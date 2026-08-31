#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { formatSmithHeadword } from "./acquire-smith.mjs";
import {
  normalizeSmithHeadword,
  parseSmithImp
} from "./audit-smith-overlap.mjs";
import { writeDictionarySourceSqlite } from "./source-sqlite.mjs";

const execFileAsync = promisify(execFile);
const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const ARCHIVE_URL =
  "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/ISBE.zip";
const ARCHIVE_SHA256 =
  "4de747545d9c349ab724bc1708b01df5481e3b93e5e51077f859dd8a32023a32";

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const download = async (url, destination) => {
  const response = await fetch(url, {
    headers: { "user-agent": "BibleStrongResourceStudio/1.0" },
    signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok) throw new Error(`isbe-download-http-${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return bytes;
};

const confValue = (configuration, key) =>
  new RegExp(`^${key}=(.*)$`, "mu").exec(configuration)?.[1]?.trim() ?? "";

export const transformIsbeDefinition = ({ html, titles = new Map() }) => {
  let result = String(html)
    .replace(/^<entryFree\b[^>]*>|<\/entryFree>$/giu, "")
    .replace(
      /<ref\b[^>]*\bosisRef=(?:"Bible:([^"]+)"|'Bible:([^']+)')[^>]*>([\s\S]*?)<\/ref>/giu,
      (_match, doubleQuoted, singleQuoted, label) =>
        `<a class="verse" href="${doubleQuoted ?? singleQuoted ?? ""}">${label}</a>`
    )
    .replace(
      /<ref\b[^>]*\btarget=(?:"ISBE:([^"]+)"|'ISBE:([^']+)')[^>]*>([\s\S]*?)<\/ref>/giu,
      (_match, doubleQuoted, singleQuoted, label) => {
        const sourceTarget = doubleQuoted ?? singleQuoted ?? "";
        const target =
          titles.get(normalizeSmithHeadword(sourceTarget)) ??
          formatSmithHeadword(sourceTarget);
        return `<a class="word" href="${target.replace(/&/gu, "&amp;").replace(/"/gu, "&quot;")}">${label}</a>`;
      }
    )
    .replace(
      /<hi\b[^>]*\brend=(?:"underline"|'underline')[^>]*>/giu,
      "<strong>"
    )
    .replace(/<\/hi>/giu, "</strong>")
    .replace(/<lb\s*\/?\s*>/giu, "<br>")
    .replace(/<(\/?)p\b[^>]*>/giu, "<$1p>")
    .replace(/<\/?(?:entryFree|ref|hi)\b[^>]*>/giu, "")
    .replace(/<(?!\/?(?:a|p|strong|br)\b)[^>]*>/giu, "")
    .trim();
  return result;
};

export const buildIsbeEntries = (rawEntries) => {
  const titles = new Map(
    rawEntries.map((entry) => [
      normalizeSmithHeadword(entry.word),
      formatSmithHeadword(entry.word)
    ])
  );
  return rawEntries.map((entry, index) => ({
    id: index + 1,
    word: formatSmithHeadword(entry.word),
    normalizedWord: normalizeSmithHeadword(entry.word),
    definition: transformIsbeDefinition({ html: entry.definition, titles })
  }));
};

const parseArguments = (values) => {
  const options = {
    root: path.join(workflowRoot, ".local/isbe"),
    output: path.join(
      workspaceRoot,
      "apps/resource-studio/outputs/dictionary-sources/isbe"
    ),
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
  const archivePath = path.join(options.root, "ISBE.zip");
  const installedDirectory = path.join(options.root, "installed");
  await Promise.all([
    mkdir(options.root, { recursive: true }),
    mkdir(installedDirectory, { recursive: true })
  ]);
  const archive = (await exists(archivePath))
    ? await readFile(archivePath)
    : await download(ARCHIVE_URL, archivePath);
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== ARCHIVE_SHA256)
    throw new Error(`isbe-archive-digest-mismatch:${digest}`);
  await execFileAsync("unzip", ["-oq", archivePath, "-d", installedDirectory]);
  const configuration = await readFile(
    path.join(installedDirectory, "mods.d/isbe.conf"),
    "utf8"
  );
  if (confValue(configuration, "DistributionLicense") !== "Public Domain")
    throw new Error("isbe-license-not-public-domain");
  const { stdout } = await execFileAsync(options.mod2imp, ["ISBE"], {
    encoding: "utf8",
    env: { ...process.env, SWORD_PATH: installedDirectory },
    maxBuffer: 128 * 1024 * 1024
  });
  const rawEntries = parseSmithImp(stdout);
  if (rawEntries.length < 9_000) throw new Error("isbe-entry-count-too-low");
  const entries = buildIsbeEntries(rawEntries);
  const sqlitePath = await writeDictionarySourceSqlite({
    outputDir: options.output,
    fileName: "isbe.sqlite",
    entries
  });
  const manifest = {
    generatedAt: new Date().toISOString(),
    work: "isbe",
    source: {
      provider: "CrossWire",
      module: "ISBE",
      title: confValue(configuration, "Description"),
      moduleVersion: confValue(configuration, "Version"),
      moduleDate: confValue(configuration, "SwordVersionDate"),
      distributionLicense: confValue(configuration, "DistributionLicense"),
      archiveUrl: ARCHIVE_URL,
      archiveSha256: digest,
      sourceType: confValue(configuration, "SourceType"),
      sourceEncoding: confValue(configuration, "Encoding")
    },
    editorialPolicy:
      "TEI structure, source cross-references and Scripture references are converted without modernizing the 1915 text.",
    counts: { sourceRecords: rawEntries.length, entries: entries.length },
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
