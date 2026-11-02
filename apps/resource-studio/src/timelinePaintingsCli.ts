import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  CATALOG_CACHE_CONTROL,
  pendingUploads,
  putImmutableCopies,
  unreachableAddresses,
  wranglerPut,
  type MediaUpload
} from "./mediaUpload.js";
import { sha256Hex } from "./timelineImages.js";
import {
  missingPeriods,
  parseTimelinePaintingSelection,
  timelinePaintingCatalog,
  timelinePaintingHash,
  timelinePaintingKey,
  timelinePaintingShareKey,
  timelinePaintingShareUrl,
  timelinePaintingUrl,
  TIMELINE_PAINTING_BUCKET,
  TIMELINE_PAINTING_CATALOG_KEY,
  TIMELINE_PAINTING_HOST,
  TIMELINE_PAINTING_JPEG_QUALITY,
  TIMELINE_PAINTING_QUALITY,
  TIMELINE_PAINTING_SHARE_WIDTH,
  TIMELINE_PAINTING_WIDTHS,
  TIMELINE_PERIOD_WIDTH,
  type TimelinePaintingSelection
} from "./timelinePaintings.js";

const execFileAsync = promisify(execFile);

const STUDIO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DEFAULT_OUTPUT = path.join(STUDIO_ROOT, "outputs", "timeline-paintings");
const DEFAULT_PERIOD_TARGET = path.resolve(
  STUDIO_ROOT,
  "../expo/src/assets/timeline/periods"
);
const DEFAULT_PERIOD_SITE_TARGET = path.resolve(
  STUDIO_ROOT,
  "../site/public/images/timeline"
);

const USAGE = `Prepares the paintings of the timeline for the media host (ADR-0096).

A selection is a JSON object mapping each event slug, or period:<n>, to its original (a path
relative to the selection file) and the files of the publication to keep beside it:
  { "isaac": { "source": "out/isaac.png", "documents": ["Isaac's Tomb.jpg"] },
    "period:1": { "source": "out/timeline-period-1.png" } }
It is the whole set: an event left out of it keeps the publication's pictures at the next upload.

  yarn resources:timeline:paintings build --selection <file> [--output <dir>]
      Writes the ${TIMELINE_PAINTING_WIDTHS.join(", ")}-pixel WebP copies of every event, a ${TIMELINE_PAINTING_SHARE_WIDTH}-pixel JPEG
      for its share image, and the catalog to publish. Needs cwebp (brew install webp) and magick.
  yarn resources:timeline:paintings periods --selection <file> [--target <dir>] [--site-target <dir>]
      Writes the ${TIMELINE_PERIOD_WIDTH}-pixel JPEG periods bundled in the application (default:
      apps/expo/src/assets/timeline/periods) and served by the public site (default:
      apps/site/public/images/timeline). Needs magick.
  yarn resources:timeline:paintings upload [--output <dir>] [--bucket <name>] [--dry-run]
      Puts the copies in the public media bucket (default: ${TIMELINE_PAINTING_BUCKET}) through the
      operator's wrangler session, checks that each answers at ${TIMELINE_PAINTING_HOST}, then puts
      the catalog. Never deletes anything. --dry-run only says what it would do.
  yarn resources:timeline:paintings report [--output <dir>]
      Counts and weighs what was built.
`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

type BuiltPainting = {
  slug: string;
  hash: string;
  documents: string[];
  source: string;
};

const builtPath = (output: string) => path.join(output, "built.json");
const catalogPath = (output: string) => path.join(output, "catalog.json");
const copyPath = (output: string, hash: string, width: number) =>
  path.join(output, "paintings", hash, `w${width}.webp`);
const sharePath = (output: string, hash: string) =>
  path.join(output, "paintings", hash, `w${TIMELINE_PAINTING_SHARE_WIDTH}.jpg`);

const readSelection = async (
  args: string[]
): Promise<{ selection: TimelinePaintingSelection; folder: string }> => {
  const file = option(args, "--selection");
  if (!file)
    throw new Error("TIMELINE_PAINTING_SELECTION_REQUIRED: --selection <file>");
  const selection = parseTimelinePaintingSelection(
    JSON.parse(await readFile(file, "utf8"))
  );
  return { selection, folder: path.dirname(path.resolve(file)) };
};

const writeWebp = async (source: string, target: string, width: number) => {
  await mkdir(path.dirname(target), { recursive: true });
  await execFileAsync("cwebp", [
    "-quiet",
    "-q",
    String(TIMELINE_PAINTING_QUALITY),
    "-resize",
    String(width),
    "0",
    source,
    "-o",
    target
  ]);
};

const writeJpeg = async (source: string, target: string, width: number) => {
  await mkdir(path.dirname(target), { recursive: true });
  await execFileAsync("magick", [
    source,
    "-resize",
    `${width}x`,
    "-strip",
    "-interlace",
    "JPEG",
    "-quality",
    String(TIMELINE_PAINTING_JPEG_QUALITY),
    target
  ]);
};

const isWritten = async (file: string) =>
  existsSync(file) && (await stat(file)).size > 0;

const buildPaintings = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const { selection, folder } = await readSelection(args);
  const built: BuiltPainting[] = [];
  let written = 0;
  for (const { slug, source, documents } of selection.events) {
    const original = path.resolve(folder, source);
    const hash = timelinePaintingHash(await readFile(original));
    for (const width of TIMELINE_PAINTING_WIDTHS) {
      const target = copyPath(output, hash, width);
      if (await isWritten(target)) continue;
      await writeWebp(original, target, width);
      written += 1;
    }
    const share = sharePath(output, hash);
    if (!(await isWritten(share))) {
      await writeJpeg(original, share, TIMELINE_PAINTING_SHARE_WIDTH);
      written += 1;
    }
    built.push({ slug, hash, documents, source: original });
  }
  built.sort((a, b) => (a.slug < b.slug ? -1 : 1));
  await mkdir(output, { recursive: true });
  await writeFile(builtPath(output), `${JSON.stringify(built, null, 2)}\n`);
  await writeFile(
    catalogPath(output),
    `${JSON.stringify(timelinePaintingCatalog(built))}\n`
  );
  console.log(
    `Built ${written} copies; the catalog names ${built.length} events.`
  );
};

const writePeriods = async (args: string[]) => {
  const target = option(args, "--target") ?? DEFAULT_PERIOD_TARGET;
  const siteTarget =
    option(args, "--site-target") ?? DEFAULT_PERIOD_SITE_TARGET;
  const { selection, folder } = await readSelection(args);
  const missing = missingPeriods(selection.periods);
  if (missing.length > 0)
    throw new Error(`TIMELINE_PERIODS_MISSING: ${missing.join(", ")}`);
  for (const { number, source } of selection.periods) {
    const original = path.resolve(folder, source);
    for (const folderOut of [target, siteTarget]) {
      await writeJpeg(
        original,
        path.join(folderOut, `period-${number}.jpg`),
        TIMELINE_PERIOD_WIDTH
      );
    }
  }
  console.log(
    `Wrote ${selection.periods.length} periods to ${target} and ${siteTarget}.`
  );
};

const readBuilt = async (output: string): Promise<BuiltPainting[]> => {
  if (!existsSync(builtPath(output)))
    throw new Error(
      `TIMELINE_PAINTINGS_NOT_BUILT: run build first (${output})`
    );
  return JSON.parse(
    await readFile(builtPath(output), "utf8")
  ) as BuiltPainting[];
};

const report = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const built = await readBuilt(output);
  const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;
  console.log(`${built.length} paintings`);
  const line = (name: string, bytes: number) =>
    console.log(
      name.padEnd(10) +
        `${megabytes(bytes)}, ${(bytes / built.length / 1024).toFixed(1)} KB each`
    );
  for (const width of TIMELINE_PAINTING_WIDTHS) {
    let bytes = 0;
    for (const painting of built)
      bytes += (await stat(copyPath(output, painting.hash, width))).size;
    line(`w${width}`, bytes);
  }
  let shares = 0;
  for (const painting of built)
    shares += (await stat(sharePath(output, painting.hash))).size;
  line("share", shares);
  console.log(`catalog ${(await stat(catalogPath(output))).size} bytes`);
};

const uploadPaintings = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const bucket = option(args, "--bucket") ?? TIMELINE_PAINTING_BUCKET;
  const dryRun = args.includes("--dry-run");
  const built = await readBuilt(output);
  const ledgerPath = path.join(output, `uploaded.${bucket}.json`);

  const copies: MediaUpload[] = [];
  const shares: MediaUpload[] = [];
  for (const { slug, hash } of built) {
    for (const width of TIMELINE_PAINTING_WIDTHS) {
      const file = copyPath(output, hash, width);
      if (!existsSync(file))
        throw new Error(`TIMELINE_PAINTING_COPY_MISSING: ${slug} w${width}`);
      copies.push({
        key: timelinePaintingKey(slug, hash, width),
        file,
        sha256: sha256Hex(await readFile(file)),
        url: timelinePaintingUrl(slug, hash, width)
      });
    }
    const file = sharePath(output, hash);
    if (!existsSync(file))
      throw new Error(`TIMELINE_PAINTING_SHARE_COPY_MISSING: ${slug}`);
    shares.push({
      key: timelinePaintingShareKey(slug, hash),
      file,
      sha256: sha256Hex(await readFile(file)),
      url: timelinePaintingShareUrl(slug, hash)
    });
  }
  const uploads = await pendingUploads(copies, ledgerPath);
  const shareUploads = await pendingUploads(shares, ledgerPath);

  if (dryRun) {
    for (const upload of uploads.slice(0, 10)) console.log(`put ${upload.key}`);
    if (uploads.length > 10) console.log(`… ${uploads.length - 10} more`);
    console.log(
      `Would upload ${uploads.length} of ${copies.length} copies and ${shareUploads.length} of ${shares.length} JPEG copies to ${bucket}, check ${copies.length + shares.length} addresses, then put ${TIMELINE_PAINTING_CATALOG_KEY} naming ${built.length} events.`
    );
    return;
  }

  const done = await putImmutableCopies(
    bucket,
    uploads,
    ledgerPath,
    "image/webp"
  );
  const sharesDone = await putImmutableCopies(
    bucket,
    shareUploads,
    ledgerPath,
    "image/jpeg"
  );
  console.log(
    `Uploaded ${done} copies and ${sharesDone} JPEG copies to ${bucket}.`
  );

  // The catalog must never name a picture its address does not serve.
  const unreachable = await unreachableAddresses(
    [...copies, ...shares].map((copy) => copy.url)
  );
  if (unreachable.length > 0) {
    throw new Error(
      `TIMELINE_PAINTINGS_UNREACHABLE: the catalog was not uploaded.\n${unreachable.slice(0, 20).join("\n")}`
    );
  }

  await wranglerPut(
    bucket,
    TIMELINE_PAINTING_CATALOG_KEY,
    catalogPath(output),
    "application/json",
    CATALOG_CACHE_CONTROL
  );
  console.log(
    `Checked ${copies.length + shares.length} addresses and put the catalog naming ${built.length} events.`
  );
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "build") return buildPaintings(args);
  if (command === "periods") return writePeriods(args);
  if (command === "upload") return uploadPaintings(args);
  if (command === "report") return report(args);
  console.log(USAGE);
};

await main();
