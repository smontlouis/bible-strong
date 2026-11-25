import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getBibleAudioUrl,
  parseBibleAudioCatalog,
  type BibleAudioRecording
} from "@bible-strong/resource-domain/bible-audio";

import {
  borrowNeighbourPictures,
  BOOK_CHAPTER_COUNTS,
  chooseChapterPlaces,
  chooseChapterScenes,
  parseTipnrPlaces,
  type TimelineScene
} from "./bibleAudioPlaces.js";
import {
  hostedTemplate,
  planHostedChapters,
  type HostedRecordingConfig
} from "./bibleAudioHosting.js";
import {
  CATALOG_CACHE_CONTROL,
  pendingUploads,
  putImmutableCopies,
  wranglerPut,
  type MediaUpload
} from "./mediaUpload.js";

/**
 * Publishes the catalog of the recordings of Bible versions on the public media host (ADR-0117).
 * The recordings stay on their publishers' hosts: only the catalog is put in the bucket.
 */

const BUCKET = "bible-strong-media-prod";
const CATALOG_KEY = "bible-audio/catalog-v2.json";
// Read by the applications older than 28.2.8, which cannot show a publisher's mention.
const FIRST_CATALOG_KEY = "bible-audio/catalog.json";
const CATALOG_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/resource-catalog/src/bibleAudioCatalog.json"
);
const STUDIO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const TIPNR_FILE = path.join(STUDIO_DIR, "data/external/stepbible/TIPNR.txt");
const PLACE_OVERRIDES_FILE = path.join(
  STUDIO_DIR,
  "config/bible-audio-place-overrides.json"
);
const SCENE_OVERRIDES_FILE = path.join(
  STUDIO_DIR,
  "config/bible-audio-scene-overrides.json"
);
const HOSTED_CONFIG_DIR = path.join(STUDIO_DIR, "config/bible-audio-hosted");
// Recordings kept for the applications older than 28.2.8 only, through FIRST_CATALOG_KEY.
const FIRST_CATALOG_ONLY_FILE = path.join(
  STUDIO_DIR,
  "config/bible-audio-first-catalog-only.json"
);
const MEDIA_ORIGIN = "https://media.bible-strong.app";
const PORTRAIT_CATALOG_URL =
  "https://media.bible-strong.app/entity-images/catalog.json";
const PAINTING_CATALOG_URL =
  "https://media.bible-strong.app/timeline-paintings/catalog.json";
const TIMELINE_EVENT_URL =
  "https://api.bible-strong.app/v1/timelines/fr/events/";
const CHAPTER_COUNT = BOOK_CHAPTER_COUNTS.reduce(
  (total, count) => total + count,
  0
);
const EVENT_REQUESTS_IN_FLIGHT = 4;
const PROBE_TIMEOUT_MS = 15_000;

const USAGE = `Usage:
  yarn resources:audio check
      Reads packages/resource-catalog/src/bibleAudioCatalog.json, refuses an entry the app would
      leave out, and asks each recording for its first chapter.
  yarn resources:audio covers
      Chooses the picture of each chapter's cover and writes it into the catalog file: a scene,
      the painted timeline event that tells most of the chapter (the Resource API's passages,
      config/bible-audio-scene-overrides.json); then a place, the painted place named most in it
      (STEPBible's TIPNR in data/external/stepbible/TIPNR.txt,
      config/bible-audio-place-overrides.json); then the picture of a chapter of the book at
      most three chapters away.
  yarn resources:audio host <recording> --from <folder> [--bucket <name>] [--dry-run]
      For a recording its publisher lets Bible Strong host: finds each chapter in the publisher's
      files under <folder> by config/bible-audio-hosted/<recording>.json, refuses a missing or
      doubled chapter, then puts the chapters and the publisher's logo in the bucket. A ledger in
      <folder> lets an interrupted upload resume. The publisher's download link stays out of the
      repository.
  yarn resources:audio publish [--bucket <name>] [--dry-run]
      Checks, then puts the file at ${CATALOG_KEY} in ${BUCKET} through the operator's wrangler
      session, and at ${FIRST_CATALOG_KEY} without the recordings that ask for a mention but with
      those of config/bible-audio-first-catalog-only.json, for the applications older than 28.2.8. The application reads it within a day.`;

/** The first chapter a recording covers, to ask its host for. */
const probeAddress = (recording: BibleAudioRecording) => {
  const book = recording.books?.[0] ?? 1;
  return getBibleAudioUrl(recording, book, 1);
};

// Some hosts refuse HEAD: a one-byte range asks for the file without downloading it.
const answers = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: controller.signal
    });
    if (head.ok) return `${head.status}`;
    const ranged = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      signal: controller.signal
    });
    await ranged.body?.cancel();
    return ranged.ok ? `${ranged.status}` : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
};

const check = async () => {
  const raw: unknown = JSON.parse(await readFile(CATALOG_FILE, "utf8"));
  const catalog = parseBibleAudioCatalog(raw);
  if (!catalog)
    throw new Error("BIBLE_AUDIO_CATALOG_INVALID: not a catalog of version 1.");
  const written = (raw as { recordings: unknown[] }).recordings.length;
  if (catalog.recordings.length !== written) {
    const kept = new Set(catalog.recordings.map((recording) => recording.id));
    const dropped = (raw as { recordings: { id?: unknown }[] }).recordings
      .map((entry) => String(entry.id))
      .filter((id) => !kept.has(id));
    throw new Error(
      `BIBLE_AUDIO_CATALOG_INVALID: the app would leave out ${dropped.join(", ")}.`
    );
  }

  const silent: string[] = [];
  for (const recording of catalog.recordings) {
    const url = probeAddress(recording);
    const status = url ? await answers(url) : undefined;
    console.log(
      `${status ?? "---"} ${recording.version} ${recording.id} ${url ?? ""}`
    );
    if (!status) silent.push(recording.id);
  }
  if (silent.length) {
    throw new Error(
      `BIBLE_AUDIO_UNREACHABLE: no answer for ${silent.join(", ")}.`
    );
  }
  return catalog;
};

const readJson = async <T>(url: string): Promise<T> => {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`UNREACHABLE: ${answer.status} ${url}`);
  return (await answer.json()) as T;
};

/** The painted timeline events with the passages they tell, from the Resource API. */
const loadTimelineScenes = async (): Promise<TimelineScene[]> => {
  const { events } = await readJson<{ events?: Record<string, unknown> }>(
    PAINTING_CATALOG_URL
  );
  const slugs = Object.keys(events ?? {}).filter(
    (slug) => !slug.startsWith("period:")
  );
  const scenes: TimelineScene[] = [];
  const queue = [...slugs];
  await Promise.all(
    Array.from({ length: EVENT_REQUESTS_IN_FLIGHT }, async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        const payload = await readJson<{
          event?: { scriptures?: string[] };
          scriptures?: string[];
        }>(`${TIMELINE_EVENT_URL}${encodeURIComponent(slug)}`);
        scenes.push({
          slug,
          scriptures: (payload.event ?? payload).scriptures ?? []
        });
      }
    })
  );
  return scenes;
};

/** Writes the scene and place of each chapter into the catalog file, its recordings untouched. */
const buildCovers = async () => {
  const sceneOverrides = JSON.parse(
    await readFile(SCENE_OVERRIDES_FILE, "utf8")
  ) as Record<string, string | null>;
  const scenes = chooseChapterScenes(
    await loadTimelineScenes(),
    sceneOverrides
  );

  const tipnr = parseTipnrPlaces(await readFile(TIPNR_FILE, "utf8"));
  const portraits = await readJson<{ entities?: Record<string, unknown> }>(
    PORTRAIT_CATALOG_URL
  );
  const painted = new Set(
    Object.keys(portraits.entities ?? {}).filter((name) => tipnr.has(name))
  );
  const placeOverrides = JSON.parse(
    await readFile(PLACE_OVERRIDES_FILE, "utf8")
  ) as Record<string, string | null>;
  const places = chooseChapterPlaces(tipnr, painted, placeOverrides);

  const filled = borrowNeighbourPictures(scenes, places);
  const catalog = JSON.parse(await readFile(CATALOG_FILE, "utf8")) as Record<
    string,
    unknown
  >;
  await writeFile(
    CATALOG_FILE,
    `${JSON.stringify({ ...catalog, scenes: filled.scenes, places: filled.places }, null, 2)}\n`
  );
  const covered = new Set([
    ...Object.keys(filled.scenes),
    ...Object.keys(filled.places)
  ]).size;
  const percent = (count: number) =>
    `${Math.round((count / CHAPTER_COUNT) * 100)} %`;
  console.log(
    [
      `Scenes for ${Object.keys(scenes).length} chapters, places for ${Object.keys(places).length}, ${filled.borrowed} borrowed from a neighbour.`,
      `A picture for ${covered} of ${CHAPTER_COUNT} chapters (${percent(covered)}).`
    ].join("\n")
  );
};

const listFiles = async (folder: string): Promise<string[]> =>
  (await readdir(folder, { recursive: true }))
    .filter((name) => name.toLowerCase().endsWith(".mp3"))
    .map((name) => path.join(folder, name))
    .sort();

const sha256 = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");

const host = async (args: string[]) => {
  const [recordingId] = args;
  const fromFlag = args.indexOf("--from");
  const folder = fromFlag >= 0 ? args[fromFlag + 1] : undefined;
  const bucketFlag = args.indexOf("--bucket");
  const bucket = bucketFlag >= 0 ? args[bucketFlag + 1] : BUCKET;
  if (!recordingId || !folder || !bucket) throw new Error(USAGE);

  const config = JSON.parse(
    await readFile(path.join(HOSTED_CONFIG_DIR, `${recordingId}.json`), "utf8")
  ) as HostedRecordingConfig;
  const catalog = parseBibleAudioCatalog(
    JSON.parse(await readFile(CATALOG_FILE, "utf8"))
  );
  const recording = catalog?.recordings.find(
    (entry) => entry.id === recordingId
  );
  const template = hostedTemplate(MEDIA_ORIGIN, config.prefix);
  const sameBooks =
    JSON.stringify([...(recording?.books ?? [])].sort((a, b) => a - b)) ===
    JSON.stringify([...(config.covers ?? [])].sort((a, b) => a - b));
  if (
    !recording ||
    !sameBooks ||
    recording.sources.some((source) => source.url !== template)
  )
    throw new Error(
      `BIBLE_AUDIO_HOSTED_CATALOG: the catalog must name ${recordingId} with the address ${template} and the books of covers.`
    );

  const files = await listFiles(folder);
  const hashes = new Map<string, string>();
  for (const file of files) hashes.set(file, await sha256(file));
  const { chapters, unknown } = planHostedChapters(
    config,
    files,
    (a, b) => hashes.get(a) === hashes.get(b)
  );
  for (const file of unknown) console.log(`Not in the plan: ${file}`);

  const uploads: MediaUpload[] = chapters.map((chapter) => ({
    key: chapter.key,
    file: chapter.file,
    sha256: hashes.get(chapter.file)!,
    url: `${MEDIA_ORIGIN}/${chapter.key}`
  }));
  const logos: MediaUpload[] = config.logo
    ? [
        {
          key: config.logo.key,
          file: path.join(HOSTED_CONFIG_DIR, config.logo.file),
          sha256: await sha256(path.join(HOSTED_CONFIG_DIR, config.logo.file)),
          url: `${MEDIA_ORIGIN}/${config.logo.key}`
        }
      ]
    : [];
  const ledgerPath = path.join(folder, `uploaded.${bucket}.json`);
  const pending = await pendingUploads(uploads, ledgerPath);
  const pendingLogos = await pendingUploads(logos, ledgerPath);
  console.log(
    `${chapters.length} chapters found, ${pending.length} to put, ${pendingLogos.length} logo to put, in ${bucket}.`
  );
  if (args.includes("--dry-run")) return;
  await putImmutableCopies(bucket, pendingLogos, ledgerPath, "image/png");
  await putImmutableCopies(bucket, pending, ledgerPath, "audio/mpeg");
  console.log(`Put ${pending.length} chapters under ${config.prefix}.`);
};

const publish = async (args: string[]) => {
  const bucketFlag = args.indexOf("--bucket");
  const bucket = bucketFlag >= 0 ? args[bucketFlag + 1] : BUCKET;
  if (!bucket) throw new Error("--bucket needs a name.");
  const catalog = await check();
  if (args.includes("--dry-run")) {
    console.log(
      `Would put ${CATALOG_KEY} in ${bucket}, naming ${catalog.recordings.length} recordings, and ${FIRST_CATALOG_KEY} without those asking for a mention.`
    );
    return;
  }
  await wranglerPut(
    bucket,
    CATALOG_KEY,
    CATALOG_FILE,
    "application/json",
    CATALOG_CACHE_CONTROL
  );
  console.log(
    `Put ${CATALOG_KEY} in ${bucket}, naming ${catalog.recordings.length} recordings.`
  );
  const raw = JSON.parse(await readFile(CATALOG_FILE, "utf8")) as {
    recordings: { attribution?: unknown }[];
  };
  const firstOnly = JSON.parse(
    await readFile(FIRST_CATALOG_ONLY_FILE, "utf8")
  ) as { recordings: { attribution?: unknown }[] };
  const first = {
    ...raw,
    recordings: [
      ...firstOnly.recordings,
      ...raw.recordings.filter((entry) => entry.attribution === undefined)
    ]
  };
  if (
    parseBibleAudioCatalog(first)?.recordings.length !== first.recordings.length
  )
    throw new Error(
      "BIBLE_AUDIO_CATALOG_INVALID: the catalog of the older applications would leave out an entry."
    );
  const firstFile = path.join(
    STUDIO_DIR,
    "output/bible-audio-first-catalog.json"
  );
  await mkdir(path.dirname(firstFile), { recursive: true });
  await writeFile(firstFile, `${JSON.stringify(first, null, 2)}\n`);
  await wranglerPut(
    bucket,
    FIRST_CATALOG_KEY,
    firstFile,
    "application/json",
    CATALOG_CACHE_CONTROL
  );
  console.log(
    `Put ${FIRST_CATALOG_KEY} in ${bucket}, naming ${first.recordings.length} recordings.`
  );
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "check") {
    await check();
    return;
  }
  if (command === "covers") return buildCovers();
  if (command === "host") return host(args);
  if (command === "publish") return publish(args);
  console.log(USAGE);
};

await main();
