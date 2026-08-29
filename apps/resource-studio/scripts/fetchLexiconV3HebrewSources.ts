import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertOpenScripturesSourceDigest,
  OPEN_SCRIPTURES_HEBREW_FILES,
  OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
  type OpenScripturesHebrewFileName
} from "../src/lexiconV3/hebrewEnglish.js";

const DEFAULT_OUTPUT_DIR = "data/external/openscriptures-hebrew-lexicon";
const RAW_BASE = `https://raw.githubusercontent.com/openscriptures/HebrewLexicon/${OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT}`;

interface FetchOptions {
  outputDir: string;
  includeBdb: boolean;
  timeoutMs: number;
}

export async function fetchLexiconV3HebrewSources(
  options: FetchOptions
): Promise<void> {
  const names = (
    Object.keys(OPEN_SCRIPTURES_HEBREW_FILES) as OpenScripturesHebrewFileName[]
  ).filter((name) => options.includeBdb || name !== "BrownDriverBriggs.xml");
  const downloaded = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`${RAW_BASE}/${name}`, {
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { "user-agent": "bible-lexicon-maker/lexicon-v3" }
      });
      if (!response.ok) {
        throw new Error(
          `open-scriptures-fetch-failed:${name}:${response.status}`
        );
      }
      const content = new Uint8Array(await response.arrayBuffer());
      // No unverified byte reaches the destination directory.
      assertOpenScripturesSourceDigest(name, content);
      return { name, content };
    })
  );

  mkdirSync(options.outputDir, { recursive: true });
  for (const source of downloaded) {
    const destination = join(options.outputDir, source.name);
    const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`;
    try {
      writeFileSync(temporary, source.content);
      assertOpenScripturesSourceDigest(source.name, readFileSync(temporary));
      renameSync(temporary, destination);
    } finally {
      rmSync(temporary, { force: true });
    }
  }

  const manifestPath = join(options.outputDir, "source-manifest.json");
  const manifestTemporary = `${manifestPath}.tmp-${process.pid}-${randomUUID()}`;
  const manifest = {
    schema: "lexicon-v3-hebrew-open-sources@1",
    repository: "https://github.com/openscriptures/HebrewLexicon",
    commit: OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT,
    license: "CC-BY-4.0; BDB and Strong dictionary text are public domain",
    files: Object.fromEntries(
      downloaded.map(({ name }) => [
        name,
        OPEN_SCRIPTURES_HEBREW_FILES[name].sha256
      ])
    )
  };
  try {
    writeFileSync(manifestTemporary, `${JSON.stringify(manifest, null, 2)}\n`);
    renameSync(manifestTemporary, manifestPath);
  } finally {
    rmSync(manifestTemporary, { force: true });
  }
}

export function parseLexiconV3HebrewFetchArgs(
  argv: readonly string[]
): FetchOptions {
  const allowed = new Set(["output-dir", "include-bdb", "timeout-ms"]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag?.startsWith("--")) throw new Error(`unexpected-argument:${flag}`);
    const key = flag.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`missing-value:${flag}`);
    }
    values.set(key, value);
    index += 1;
  }
  const timeoutValue = values.get("timeout-ms") ?? "120000";
  const timeoutMs = Number(timeoutValue);
  if (
    !/^[1-9]\d*$/u.test(timeoutValue) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1_000
  ) {
    throw new Error(`invalid-timeout-ms:${values.get("timeout-ms") ?? ""}`);
  }
  return {
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    includeBdb: parseBoolean(values.get("include-bdb") ?? "true"),
    timeoutMs
  };
}

function parseBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`invalid-boolean:${value}`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  const options = parseLexiconV3HebrewFetchArgs(process.argv.slice(2));
  await fetchLexiconV3HebrewSources(options);
  console.log(
    `Verified OpenScriptures Hebrew sources at ${OPEN_SCRIPTURES_HEBREW_LEXICON_COMMIT} in ${options.outputDir}`
  );
}
