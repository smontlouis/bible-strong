import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getBibleAudioUrl,
  parseBibleAudioCatalog,
  type BibleAudioRecording
} from "@bible-strong/resource-domain/bible-audio";

import { CATALOG_CACHE_CONTROL, wranglerPut } from "./mediaUpload.js";

/**
 * Publishes the catalog of the recordings of Bible versions on the public media host (ADR-0117).
 * The recordings stay on their publishers' hosts: only the catalog is put in the bucket.
 */

const BUCKET = "bible-strong-media-prod";
const CATALOG_KEY = "bible-audio/catalog.json";
const CATALOG_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../packages/resource-catalog/src/bibleAudioCatalog.json"
);
const PROBE_TIMEOUT_MS = 15_000;

const USAGE = `Usage:
  yarn resources:audio check
      Reads packages/resource-catalog/src/bibleAudioCatalog.json, refuses an entry the app would
      leave out, and asks each recording for its first chapter.
  yarn resources:audio publish [--bucket <name>] [--dry-run]
      Checks, then puts the file at ${CATALOG_KEY} in ${BUCKET} through the operator's wrangler
      session. The application reads it within a day.`;

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

const publish = async (args: string[]) => {
  const bucketFlag = args.indexOf("--bucket");
  const bucket = bucketFlag >= 0 ? args[bucketFlag + 1] : BUCKET;
  if (!bucket) throw new Error("--bucket needs a name.");
  const catalog = await check();
  if (args.includes("--dry-run")) {
    console.log(
      `Would put ${CATALOG_KEY} in ${bucket}, naming ${catalog.recordings.length} recordings.`
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
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "check") {
    await check();
    return;
  }
  if (command === "publish") return publish(args);
  console.log(USAGE);
};

await main();
