import { existsSync } from "node:fs";
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyBibleSourcePatch,
  bibleComChapterUrl,
  BIBLE_SOURCE_PATCHES_PATH,
  editionProviderFile,
  patchedSourceLocation,
  readBibleSourcePatches,
  sha256Hex,
  type BibleSourcePatchChapter,
  type BibleSourcePatches,
  type BibleSourcePatchSet,
  type EditionProvider,
  type PatchedChapterReport
} from "./bibleSourcePatches.js";
import {
  DEFAULT_R2_BUCKET,
  downloadR2Object,
  uploadR2Source
} from "./r2ArtifactSources.js";
import {
  fetchCached,
  ORDINARY_BIBLE_SOURCES_PATH,
  readOrdinaryBibleSources
} from "./wordsOfJesusSources.js";

const PROVIDER_CACHE_DIR = "outputs/bible-sources/provider-cache/bible.com";
const PATCHED_SOURCES_DIR = "outputs/bible-sources/patched";
const REQUEST_LOG = "requests.jsonl";
/** Requests to the provider this cache may ever hold, all runs together. */
const REQUEST_CAP = 2500;
/** At most one request per second, with a margin. */
const REQUEST_INTERVAL_MS = 1500;

interface RequestLogEntry {
  at: string;
  url: string;
  status: number;
  bytes: number;
  sha256: string;
}

const answerPath = (cacheDir: string, versionId: number, reference: string) =>
  path.join(
    cacheDir,
    String(versionId),
    `${reference.replaceAll(".", "-")}.json`
  );

const readRequestLog = async (cacheDir: string): Promise<RequestLogEntry[]> => {
  const logPath = path.join(cacheDir, REQUEST_LOG);
  if (!existsSync(logPath)) return [];
  return (await readFile(logPath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RequestLogEntry);
};

/**
 * Requests one URL once: a plain GET, paced across runs by the request log of
 * its cache and counted against the cap. Any answer that is not what was asked
 * for (another status, an error body) stops the run; it is kept beside the
 * cache for the operator to read and is never retried or worked around.
 */
async function requestOnce(options: {
  cacheDir: string;
  url: string;
  target: string;
  refusedName: string;
  accept: string;
  isAnswer: (body: string) => boolean;
  fetcher?: typeof fetch;
}): Promise<string> {
  const { cacheDir, url, target } = options;
  const log = await readRequestLog(cacheDir);
  if (log.length >= REQUEST_CAP)
    throw new Error(`bible-provider-request-cap-reached:${log.length}`);
  const last = log.at(-1);
  const wait = last
    ? REQUEST_INTERVAL_MS - (Date.now() - Date.parse(last.at))
    : 0;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await (options.fetcher ?? fetch)(url, {
    headers: {
      accept: options.accept,
      "user-agent": "BibleStrongResourceGenerator/1.0"
    },
    redirect: "manual"
  });
  const body = await response.text();
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  await appendFile(
    path.join(cacheDir, REQUEST_LOG),
    `${JSON.stringify({
      at: new Date().toISOString(),
      url,
      status: response.status,
      bytes: Buffer.byteLength(body),
      sha256: sha256Hex(body),
      contentType: response.headers.get("content-type")
    })}\n`
  );
  if (response.status !== 200 || !options.isAnswer(body)) {
    const refused = path.join(
      cacheDir,
      "refused",
      `${options.refusedName}.${response.status}`
    );
    await mkdir(path.dirname(refused), { recursive: true });
    await writeFile(refused, body);
    throw new Error(
      `bible-provider-refused:${response.status}:${url}:see ${refused}`
    );
  }
  await writeFile(target, body);
  return body;
}

/**
 * Reads one provider answer from the cache, or requests it once from the
 * public chapter endpoint.
 */
async function providerAnswer(options: {
  cacheDir: string;
  versionId: number;
  reference: string;
  fetchMissing: boolean;
  fetcher?: typeof fetch;
}): Promise<string> {
  const { cacheDir, versionId, reference } = options;
  const target = answerPath(cacheDir, versionId, reference);
  if (existsSync(target)) return readFile(target, "utf8");
  if (!options.fetchMissing)
    throw new Error(`bible-provider-answer-missing:${versionId}:${reference}`);
  return requestOnce({
    cacheDir,
    url: bibleComChapterUrl(versionId, reference),
    target,
    refusedName: `${versionId}-${reference.replaceAll(".", "-")}`,
    accept: "application/json",
    isAnswer: (body) => {
      try {
        const chapter = JSON.parse(body) as {
          content?: unknown;
          errors?: unknown;
        };
        return !chapter.errors && typeof chapter.content === "string";
      } catch {
        return false;
      }
    },
    ...(options.fetcher ? { fetcher: options.fetcher } : {})
  });
}

/** Where the file of another edition is kept, and the cache of its host. */
const editionCache = (
  cacheDir: string,
  provider: EditionProvider,
  reference: string
) => {
  // The caches of all providers sit side by side, each with its request log.
  const root = path.dirname(cacheDir);
  const file = editionProviderFile(provider, reference);
  return {
    url: file.url,
    target: path.join(root, file.cachePath),
    cacheDir: path.join(root, provider.id)
  };
};

/**
 * Reads the file of another edition from the cache, or requests it once. A
 * file is read whole and serves every chapter that names it.
 */
async function editionAnswer(options: {
  cacheDir: string;
  provider: EditionProvider;
  reference: string;
  fetchMissing: boolean;
  fetcher?: typeof fetch;
}): Promise<string> {
  const { provider, reference } = options;
  const cache = editionCache(options.cacheDir, provider, reference);
  if (existsSync(cache.target)) return readFile(cache.target, "utf8");
  if (!options.fetchMissing)
    throw new Error(
      `bible-provider-answer-missing:${provider.id}:${reference}`
    );
  return requestOnce({
    cacheDir: cache.cacheDir,
    url: cache.url,
    target: cache.target,
    refusedName: path.basename(cache.target),
    accept: "*/*",
    isAnswer: (body) =>
      body.includes(
        provider.id === "gratis-bible" ? "<osisText" : '<a name="1">'
      ),
    ...(options.fetcher ? { fetcher: options.fetcher } : {})
  });
}

/** The answer one chapter of a patch is read from, wherever it comes from. */
const chapterAnswer = (
  patch: BibleSourcePatchSet,
  chapter: BibleSourcePatchChapter,
  options: CliOptions,
  fetchMissing: boolean
) =>
  chapter.provider
    ? editionAnswer({
        cacheDir: options.cacheDir,
        provider: chapter.provider,
        reference: chapter.reference,
        fetchMissing
      })
    : providerAnswer({
        cacheDir: options.cacheDir,
        versionId: patch.provider.versionId,
        reference: chapter.reference,
        fetchMissing
      });

/** Where the answer of one chapter is cached, its URL and its request log. */
const chapterAnswerFile = (
  patch: BibleSourcePatchSet,
  chapter: BibleSourcePatchChapter,
  options: CliOptions
) =>
  chapter.provider
    ? editionCache(options.cacheDir, chapter.provider, chapter.reference)
    : {
        url: bibleComChapterUrl(patch.provider.versionId, chapter.reference),
        target: answerPath(
          options.cacheDir,
          patch.provider.versionId,
          chapter.reference
        ),
        cacheDir: options.cacheDir
      };

const readBaseSource = async (root: string, patch: BibleSourcePatchSet) => {
  if (patch.base.sourceUrl.endsWith(".zip"))
    throw new Error(
      `bible-source-patch-base-archive-unsupported:${patch.base.sourceUrl}`
    );
  const filePath = await fetchCached(root, patch.base.sourceUrl);
  if (!filePath)
    throw new Error(`bible-source-missing:${patch.base.sourceUrl}`);
  return readFile(filePath, "utf8");
};

interface CliOptions {
  root: string;
  cacheDir: string;
  outputDir: string;
  versionIds: string[] | undefined;
}

const selected = (patches: BibleSourcePatches, options: CliOptions) => {
  const versionIds = options.versionIds ?? Object.keys(patches.bibles);
  return versionIds.map((versionId) => {
    const patch = patches.bibles[versionId];
    if (!patch) throw new Error(`bible-source-patch-unknown:${versionId}`);
    return [versionId, patch] as const;
  });
};

async function patchOf(
  versionId: string,
  patch: BibleSourcePatchSet,
  options: CliOptions,
  mode: { anchored: boolean; fetchMissing: boolean }
) {
  const responses: Record<string, string> = {};
  for (const chapter of patch.chapters) {
    responses[chapter.reference] = await chapterAnswer(
      patch,
      chapter,
      options,
      mode.fetchMissing
    );
  }
  return {
    responses,
    ...applyBibleSourcePatch({
      versionId,
      baseRaw: await readBaseSource(options.root, patch),
      patch,
      responses,
      anchored: mode.anchored
    })
  };
}

const describeChapter = (versionId: string, chapter: PatchedChapterReport) => {
  const list = (verses: Record<string, string>) =>
    Object.keys(verses).join(",") || "none";
  const runs = chapter.renumbered
    .map(
      (run) => `${run.first}-${run.last} by ${run.by > 0 ? "+" : ""}${run.by}`
    )
    .join(", ");
  return (
    `${versionId} ${chapter.chapter} (${chapter.reference}): ` +
    `${chapter.before} rows before, ${chapter.after} after; ` +
    `${chapter.matched} rows read as the provider's; ` +
    `supplied ${list(chapter.supplied)}; ` +
    `renumbered ${runs || "none"}; dropped ${list(chapter.dropped)}`
  );
};

/** Requests the provider answers the selected patches still lack. */
async function fetchAnswers(patches: BibleSourcePatches, options: CliOptions) {
  const caches = new Set([options.cacheDir]);
  for (const [versionId, patch] of selected(patches, options)) {
    for (const chapter of patch.chapters) {
      const file = chapterAnswerFile(patch, chapter, options);
      const cached = existsSync(file.target);
      await chapterAnswer(patch, chapter, options, true);
      caches.add(file.cacheDir);
      console.log(
        `${versionId} ${chapter.reference}: ${cached ? "cached" : "fetched"}`
      );
    }
  }
  for (const cacheDir of caches)
    console.log(
      `${path.basename(cacheDir)}: ${(await readRequestLog(cacheDir)).length} requests so far, cap ${REQUEST_CAP}`
    );
}

/**
 * Completes a draft (provider, base, style, chapters with their evidence) with
 * what the alignment produces: the answers read, the verses supplied,
 * renumbered and dropped, and the patched source. The result is the reviewed
 * record to store; it holds hashes and numbers, no Bible text.
 */
async function draft(root: string, draftPath: string, options: CliOptions) {
  const drafts = JSON.parse(
    await readFile(path.resolve(root, draftPath), "utf8")
  ) as BibleSourcePatches;
  const completed: BibleSourcePatches = { schemaVersion: 1, bibles: {} };
  for (const [versionId, patch] of Object.entries(drafts.bibles)) {
    const result = await patchOf(versionId, patch, options, {
      anchored: false,
      fetchMissing: false
    });
    const chapters = [];
    for (const [index, chapter] of patch.chapters.entries()) {
      const file = chapterAnswerFile(patch, chapter, options);
      const { url } = file;
      const fetchedAt =
        (await readRequestLog(file.cacheDir))
          .filter((entry) => entry.url === url && entry.status === 200)
          .at(-1)?.at ?? (await stat(file.target)).mtime.toISOString();
      const { supplied, renumbered, dropped, kept } = result.chapters[index]!;
      chapters.push({
        chapter: chapter.chapter,
        reference: chapter.reference,
        ...(chapter.provider ? { provider: chapter.provider } : {}),
        evidence: chapter.evidence,
        response: {
          url,
          fetchedAt,
          sha256: sha256Hex(result.responses[chapter.reference]!)
        },
        supplied,
        renumbered,
        dropped,
        kept
      });
    }
    completed.bibles[versionId] = {
      provider: patch.provider,
      base: patch.base,
      textStyle: patch.textStyle,
      chapters,
      patched: {
        fileName: patch.patched.fileName,
        sha256: sha256Hex(result.serialized),
        bytes: Buffer.byteLength(result.serialized)
      }
    };
    for (const chapter of result.chapters)
      console.error(describeChapter(versionId, chapter));
  }
  console.log(JSON.stringify(completed, null, 2));
}

/**
 * Prints what each patch does, by reference, count and hash. With `--text` it
 * also prints the supplied verses, for review on the operator's machine: that
 * output holds Bible text and never belongs in the repository.
 */
async function report(
  patches: BibleSourcePatches,
  options: CliOptions,
  withText: boolean
) {
  for (const [versionId, patch] of selected(patches, options)) {
    const result = await patchOf(versionId, patch, options, {
      anchored: true,
      fetchMissing: false
    });
    console.log(
      `# ${versionId}: bible.com ${patch.provider.versionId} (${patch.provider.abbreviation}), ` +
        `${patch.base.sha256} -> ${patch.patched.sha256}`
    );
    for (const [index, chapter] of result.chapters.entries()) {
      console.log(describeChapter(versionId, chapter));
      const edition = patch.chapters[index]!.provider;
      if (edition)
        console.log(
          `  read from ${editionProviderFile(edition, chapter.reference).url}`
        );
      for (const [verse, hash] of Object.entries(chapter.supplied)) {
        const text = chapter.verses[verse]!;
        console.log(
          `  + ${chapter.chapter}-${verse} ${hash} ${text.length} characters` +
            (withText ? ` ${JSON.stringify(text)}` : "")
        );
      }
      for (const [verse, hash] of Object.entries(chapter.dropped))
        console.log(`  - ${chapter.chapter}-${verse} ${hash}`);
    }
  }
}

const patchedSourcePath = (options: CliOptions, patch: BibleSourcePatchSet) =>
  path.join(options.outputDir, patch.patched.sha256, patch.patched.fileName);

/**
 * Writes the patched source of each selected Bible under its SHA-256, and the
 * override files that make local commands read it before it is uploaded.
 */
async function build(patches: BibleSourcePatches, options: CliOptions) {
  for (const [versionId, patch] of selected(patches, options)) {
    const result = await patchOf(versionId, patch, options, {
      anchored: true,
      fetchMissing: false
    });
    const target = patchedSourcePath(options, patch);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, result.serialized);
    console.log(
      `${versionId}: ${path.relative(options.root, target)} ` +
        `${patch.patched.bytes} bytes sha256=${patch.patched.sha256}`
    );
  }
  // Every patch whose file exists locally, not only the ones just built.
  const sourceOverrides: Record<string, { canonical: string }> = {};
  const textOverrides: Record<string, string> = {};
  for (const [versionId, patch] of Object.entries(patches.bibles)) {
    const target = patchedSourcePath(options, patch);
    if (!existsSync(target)) continue;
    const relative = path.relative(options.root, target);
    sourceOverrides[`bible:${versionId}`] = { canonical: relative };
    textOverrides[versionId] = relative;
  }
  await writeFile(
    path.join(options.outputDir, "source-overrides.json"),
    `${JSON.stringify(sourceOverrides, null, 2)}\n`
  );
  await writeFile(
    path.join(options.outputDir, "text-overrides.json"),
    `${JSON.stringify(textOverrides, null, 2)}\n`
  );
}

const localPatchedSource = async (
  versionId: string,
  patch: BibleSourcePatchSet,
  options: CliOptions
) => {
  const filePath = patchedSourcePath(options, patch);
  if (
    !existsSync(filePath) ||
    sha256Hex(await readFile(filePath)) !== patch.patched.sha256
  )
    throw new Error(`bible-source-patch-file-missing:${versionId}:${filePath}`);
  return filePath;
};

/** Uploads each patched source under its content-addressed `sources/` key. */
async function upload(
  patches: BibleSourcePatches,
  options: CliOptions,
  bucket: string
) {
  for (const [versionId, patch] of selected(patches, options)) {
    const location = await uploadR2Source({
      bucket,
      filePath: await localPatchedSource(versionId, patch, options),
      fileName: patch.patched.fileName,
      contentType: "application/json"
    });
    if (location !== patchedSourceLocation(patch, bucket))
      throw new Error(`bible-source-patch-upload-mismatch:${versionId}`);
    console.log(`${versionId}: ${location}`);
  }
}

/**
 * Points the source configuration at the uploaded patched sources, after
 * reading each one back from R2 and proving its SHA-256. Until then the
 * configuration names the earlier source and builds need the local override.
 */
export async function adoptPatchedSources(options: {
  root: string;
  patches: BibleSourcePatches;
  versionIds?: readonly string[];
  bucket: string;
  download?: typeof downloadR2Object;
}) {
  const sources = await readOrdinaryBibleSources(options.root);
  const adopted: string[] = [];
  const workDir = await mkdtemp(path.join(tmpdir(), "bible-source-adopt-"));
  try {
    for (const versionId of options.versionIds ??
      Object.keys(options.patches.bibles)) {
      const patch = options.patches.bibles[versionId];
      const configured = sources.bibles[versionId];
      if (!patch || !configured)
        throw new Error(`bible-source-patch-unknown:${versionId}`);
      const location = patchedSourceLocation(patch, options.bucket);
      if (configured.text.sourceUrl === location) continue;
      await (options.download ?? downloadR2Object)(
        location,
        path.join(workDir, patch.patched.fileName)
      );
      configured.text = {
        sourceUrl: location,
        entry: patch.patched.fileName
      };
      adopted.push(versionId);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
  if (adopted.length > 0)
    await writeFile(
      path.join(options.root, ORDINARY_BIBLE_SOURCES_PATH),
      `${JSON.stringify(sources, null, 2)}\n`
    );
  return adopted;
}

export async function runBibleSourcePatchesCli(argv: readonly string[]) {
  const [command, ...rest] = argv;
  const root = process.cwd();
  const option = (name: string) => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : rest[index + 1];
  };
  const options: CliOptions = {
    root,
    cacheDir: path.resolve(root, option("--cache-dir") ?? PROVIDER_CACHE_DIR),
    outputDir: path.resolve(
      root,
      option("--output-dir") ?? PATCHED_SOURCES_DIR
    ),
    versionIds: option("--version")?.toUpperCase().split(",")
  };
  const bucket = process.env.RESOURCE_R2_BUCKET?.trim() || DEFAULT_R2_BUCKET;
  if (command === "draft") {
    const draftPath = option("--file");
    if (!draftPath) throw new Error("bible-source-patches-draft-required");
    return draft(root, draftPath, options);
  }
  const patches = await readBibleSourcePatches(root);
  switch (command) {
    case "fetch":
      return fetchAnswers(patches, options);
    case "report":
      return report(patches, options, rest.includes("--text"));
    case "build":
      return build(patches, options);
    case "upload":
      return upload(patches, options, bucket);
    case "adopt": {
      const adopted = await adoptPatchedSources({
        root,
        patches,
        bucket,
        ...(options.versionIds ? { versionIds: options.versionIds } : {})
      });
      console.log(
        `${adopted.length} Bibles now read their patched source from R2: ${adopted.join(" ")}`
      );
      return;
    }
    default:
      console.log(
        `usage: bible-source-patches <fetch | draft --file draft.json | report [--text] | build | upload | adopt> ` +
          `[--version V[,V]] [--cache-dir dir] [--output-dir dir]\n` +
          `reviewed patches: ${BIBLE_SOURCE_PATCHES_PATH}`
      );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBibleSourcePatchesCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
