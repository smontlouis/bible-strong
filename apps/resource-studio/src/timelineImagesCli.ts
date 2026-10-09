import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  imageMediaType,
  readImageSize,
  resizedWidth,
  sha256Hex,
  timelineImageFiles,
  timelineImageKey,
  timelineImageSourceUrl,
  TIMELINE_IMAGE_BUCKET,
  TIMELINE_IMAGE_SOURCE_URL,
  TIMELINE_IMAGE_WIDTHS,
  type TimelineImageManifest,
  type TimelineImageRecord,
  type TimelineImageVariant
} from "./timelineImages.js";

const execFileAsync = promisify(execFile);

const STUDIO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const RESOURCE_SERVICE_DIR = path.resolve(
  STUDIO_ROOT,
  "../../packages/resource-service"
);
const DEFAULT_OUTPUT = path.join(STUDIO_ROOT, "outputs", "timeline-images");
const DEFAULT_EVENTS_URL =
  "https://api.bible-strong.app/v1/timelines/fr/events";
// One request at a time, with a pause: the publisher's server is small and is not ours.
const PAUSE_MS = 250;
const UPLOADS_IN_FLIGHT = 6;
// A copy never changes under its name: a new picture gets a new name.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const USAGE = `Copies the pictures of the timeline from its publisher and prepares them for our storage.

  yarn resources:timeline:images fetch [--output <dir>] [--events <url>] [--limit <n>]
      Downloads every picture the events name, one at a time, into <dir>/original.
      Skips what is already there. Stops at the first answer that is not a picture.
  yarn resources:timeline:images build [--output <dir>]
      Writes a WebP copy of every picture at each served width (${TIMELINE_IMAGE_WIDTHS.join(", ")}),
      never wider than its original. Needs cwebp and gif2webp (brew install webp).
  yarn resources:timeline:images upload [--output <dir>] [--bucket <name>] [--limit <n>]
      Puts the originals and their copies in the public media bucket (default: ${TIMELINE_IMAGE_BUCKET}),
      through the operator's wrangler session. Skips what its ledger shows uploaded unchanged.
  yarn resources:timeline:images report [--output <dir>]
      Counts and weighs what was fetched and built.
`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const manifestPath = (output: string) => path.join(output, "manifest.json");

const readManifest = async (output: string): Promise<TimelineImageManifest> =>
  existsSync(manifestPath(output))
    ? (JSON.parse(
        await readFile(manifestPath(output), "utf8")
      ) as TimelineImageManifest)
    : { source: TIMELINE_IMAGE_SOURCE_URL, images: [], missing: [] };

const writeManifest = async (
  output: string,
  manifest: TimelineImageManifest
) => {
  const sorted: TimelineImageManifest = {
    source: manifest.source,
    images: [...manifest.images].sort((a, b) => a.file.localeCompare(b.file)),
    missing: [...manifest.missing].sort()
  };
  await writeFile(
    manifestPath(output),
    `${JSON.stringify(sorted, null, 2)}\n`
  );
};

const recordOf = (file: string, bytes: Uint8Array): TimelineImageRecord => {
  const size = readImageSize(bytes);
  if (!size) throw new Error(`TIMELINE_IMAGE_NOT_A_PICTURE: ${file}`);
  return { file, bytes: bytes.length, sha256: sha256Hex(bytes), ...size };
};

const fetchImages = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const eventsUrl = option(args, "--events") ?? DEFAULT_EVENTS_URL;
  const limit = Number(option(args, "--limit") ?? Number.POSITIVE_INFINITY);
  const originals = path.join(output, "original");
  await mkdir(originals, { recursive: true });

  const response = await fetch(eventsUrl);
  if (!response.ok)
    throw new Error(`TIMELINE_EVENTS_UNAVAILABLE: ${response.status}`);
  const payload = (await response.json()) as
    | { events?: unknown[] }
    | unknown[];
  const events = (Array.isArray(payload) ? payload : (payload.events ?? [])) as {
    images?: { file?: unknown }[];
  }[];
  const files = timelineImageFiles(events).slice(0, limit);

  const manifest = await readManifest(output);
  const known = new Map(manifest.images.map((image) => [image.file, image]));
  const missing = new Set(manifest.missing);
  let downloaded = 0;

  for (const [index, file] of files.entries()) {
    const target = path.join(originals, file);
    if (existsSync(target) && (await stat(target)).size > 0) {
      if (!known.has(file))
        known.set(file, recordOf(file, await readFile(target)));
      continue;
    }
    if (missing.has(file)) continue;

    const answer = await fetch(timelineImageSourceUrl(file));
    if (answer.status === 404) {
      missing.add(file);
      console.log(`missing  ${file}`);
    } else if (!answer.ok) {
      // A refusal, a limit or a failure of the publisher: nothing to work around.
      await writeManifest(output, {
        ...manifest,
        images: [...known.values()],
        missing: [...missing]
      });
      throw new Error(
        `TIMELINE_IMAGE_SOURCE_REFUSED: ${answer.status} for ${file}, after ${downloaded} downloads`
      );
    } else {
      const bytes = new Uint8Array(await answer.arrayBuffer());
      // Throws when the publisher answers a page with a success status.
      known.set(file, recordOf(file, bytes));
      await writeFile(target, bytes);
      downloaded += 1;
    }
    if ((index + 1) % 50 === 0) {
      console.log(`${index + 1}/${files.length}`);
      await writeManifest(output, {
        ...manifest,
        images: [...known.values()],
        missing: [...missing]
      });
    }
    await wait(PAUSE_MS);
  }

  await writeManifest(output, {
    ...manifest,
    images: [...known.values()],
    missing: [...missing]
  });
  console.log(
    `Fetched ${downloaded} pictures; ${known.size} of ${files.length} are here, ${missing.size} are missing at the publisher.`
  );
};

const buildImages = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const manifest = await readManifest(output);
  let built = 0;
  for (const image of manifest.images) {
    const source = path.join(output, "original", image.file);
    for (const width of TIMELINE_IMAGE_WIDTHS) {
      const folder = path.join(output, `w${width}`);
      const target = path.join(folder, `${image.file}.webp`);
      if (existsSync(target) && (await stat(target)).size > 0) continue;
      await mkdir(folder, { recursive: true });
      if (image.kind === "gif") {
        // gif2webp keeps the frames and cannot resize; the two GIFs of the timeline are small.
        await execFileAsync("gif2webp", ["-quiet", source, "-o", target]);
      } else {
        const resize =
          image.width > width
            ? ["-resize", String(resizedWidth(image.width, width)), "0"]
            : [];
        await execFileAsync("cwebp", [
          "-quiet",
          "-q",
          "80",
          ...resize,
          source,
          "-o",
          target
        ]);
      }
      built += 1;
    }
  }
  console.log(`Built ${built} copies.`);
};

const report = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const manifest = await readManifest(output);
  const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;
  console.log(
    `original  ${manifest.images.length} pictures, ${megabytes(manifest.images.reduce((sum, image) => sum + image.bytes, 0))}`
  );
  for (const width of TIMELINE_IMAGE_WIDTHS) {
    let count = 0;
    let bytes = 0;
    for (const image of manifest.images) {
      const file = path.join(output, `w${width}`, `${image.file}.webp`);
      if (!existsSync(file)) continue;
      count += 1;
      bytes += (await stat(file)).size;
    }
    console.log(`w${width}`.padEnd(10) + `${count} copies, ${megabytes(bytes)}`);
  }
  console.log(`missing   ${manifest.missing.length} at the publisher`);
};

type Upload = { key: string; file: string; mediaType: string; sha256: string };

const uploadImages = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const bucket = option(args, "--bucket") ?? TIMELINE_IMAGE_BUCKET;
  const limit = Number(option(args, "--limit") ?? Number.POSITIVE_INFINITY);
  const manifest = await readManifest(output);
  const ledgerPath = path.join(output, `uploaded.${bucket}.json`);
  const ledger: Record<string, string> = existsSync(ledgerPath)
    ? JSON.parse(await readFile(ledgerPath, "utf8"))
    : {};

  const uploads: Upload[] = [];
  for (const image of manifest.images) {
    const variants: TimelineImageVariant[] = [
      "original",
      ...TIMELINE_IMAGE_WIDTHS.map((width) => `w${width}` as const)
    ];
    for (const variant of variants) {
      const original = variant === "original";
      const file = path.join(
        output,
        variant,
        original ? image.file : `${image.file}.webp`
      );
      if (!existsSync(file))
        throw new Error(`TIMELINE_IMAGE_COPY_MISSING: ${variant}/${image.file}`);
      const sha256 = original
        ? image.sha256
        : sha256Hex(await readFile(file));
      const key = timelineImageKey(variant, image.file);
      if (ledger[key] === sha256) continue;
      uploads.push({
        key,
        file,
        sha256,
        mediaType: original ? imageMediaType(image.kind) : "image/webp"
      });
    }
  }

  const queue = uploads.slice(0, limit);
  let done = 0;
  const worker = async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await execFileAsync(
        "yarn",
        [
          "wrangler",
          "r2",
          "object",
          "put",
          `${bucket}/${next.key}`,
          "--file",
          next.file,
          "--content-type",
          next.mediaType,
          "--cache-control",
          CACHE_CONTROL,
          "--remote"
        ],
        { cwd: RESOURCE_SERVICE_DIR, maxBuffer: 16 * 1024 * 1024 }
      );
      ledger[next.key] = next.sha256;
      done += 1;
      if (done % 50 === 0) {
        console.log(`${done} uploaded, ${queue.length} to go`);
        await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: UPLOADS_IN_FLIGHT }, worker));
  } finally {
    await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  console.log(
    `Uploaded ${done} files to ${bucket}; ${uploads.length - done} left, ${Object.keys(ledger).length} there in all.`
  );
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "fetch") return fetchImages(args);
  if (command === "build") return buildImages(args);
  if (command === "upload") return uploadImages(args);
  if (command === "report") return report(args);
  console.log(USAGE);
};

await main();
