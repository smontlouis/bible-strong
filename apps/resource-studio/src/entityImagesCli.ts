import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  centredSquare,
  entityImageCatalog,
  entityImageHash,
  entityImageKey,
  entityImageUrl,
  entityPlaceholderFile,
  entityPlaceholderShareFile,
  entityShareKey,
  entityShareUrl,
  ENTITY_IMAGE_BUCKET,
  ENTITY_IMAGE_CATALOG_KEY,
  ENTITY_IMAGE_HOST,
  ENTITY_IMAGE_QUALITY,
  ENTITY_IMAGE_WIDTHS,
  ENTITY_PLACEHOLDER_WIDTH,
  ENTITY_SHARE_WIDTH,
  missingPlaceholders,
  parseEntityImageSelection,
  type EntityCatalogData,
  type EntityImageCatalog,
  type EntityImageSelection
} from "./entityImages.js";
import {
  CATALOG_CACHE_CONTROL,
  pendingUploads,
  putImmutableCopies,
  unreachableAddresses,
  wranglerPut,
  type MediaUpload
} from "./mediaUpload.js";
import { readImageSize, sha256Hex } from "./timelineImages.js";

const execFileAsync = promisify(execFile);

const STUDIO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DEFAULT_OUTPUT = path.join(STUDIO_ROOT, "outputs", "entity-images");
const DEFAULT_PLACEHOLDER_TARGET = path.resolve(
  STUDIO_ROOT,
  "../expo/src/assets/images/entity-avatars"
);
const DEFAULT_PLACEHOLDER_SITE_TARGET = path.resolve(
  STUDIO_ROOT,
  "../site/public/atlas/clay"
);

const USAGE = `Prepares the portraits of biblical entities for the media host (ADR-0089).

A selection is a JSON object mapping each unique name, each <uniqueName>#<stage>, or
placeholder:<avatarKey>:<n>, to its original picture (a path relative to the selection file). It
is the whole set: an entity left out of it loses its portrait at the next upload. The data file
gives the titles, the stages with their chapters, the series and the roles (EntityCatalogData).

  yarn resources:entities:images build --selection <file> --data <file> [--output <dir>]
      Writes the ${ENTITY_IMAGE_WIDTHS.map((width) => `${width}`).join(", ")}-pixel WebP copies of every portrait and stage, cropped to a
      centred square, a ${ENTITY_SHARE_WIDTH}-pixel PNG of every portrait for share images, and the
      catalog to publish. Needs cwebp, dwebp (brew install webp) and pngquant.
  yarn resources:entities:images placeholders --selection <file> [--target <dir>] [--site-target <dir>]
      Writes the ${ENTITY_PLACEHOLDER_WIDTH}-pixel placeholders bundled in the application (default: apps/expo/src/assets/images/entity-avatars),
      and their ${ENTITY_PLACEHOLDER_WIDTH}-pixel WebP and ${ENTITY_SHARE_WIDTH}-pixel PNG copies on the public site (default: apps/site/public/atlas/clay).
  yarn resources:entities:images upload [--output <dir>] [--bucket <name>] [--dry-run]
      Puts the copies in the public media bucket (default: ${ENTITY_IMAGE_BUCKET}) through the operator's
      wrangler session, checks that each answers at ${ENTITY_IMAGE_HOST}, then puts the catalog.
      Never deletes anything. --dry-run only says what it would do.
  yarn resources:entities:images report [--output <dir>]
      Counts and weighs what was built.
`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

type BuiltPortrait = {
  uniqueName: string;
  stage?: string;
  hash: string;
  source: string;
};

const builtPath = (output: string) => path.join(output, "built.json");
const catalogPath = (output: string) => path.join(output, "catalog.json");
const copyPath = (output: string, hash: string, width: number) =>
  path.join(output, "portraits", hash, `w${width}.webp`);
const sharePath = (output: string, hash: string) =>
  path.join(output, "portraits", hash, `w${ENTITY_SHARE_WIDTH}.png`);

const readSelection = async (
  args: string[]
): Promise<{ selection: EntityImageSelection; folder: string }> => {
  const file = option(args, "--selection");
  if (!file)
    throw new Error("ENTITY_IMAGE_SELECTION_REQUIRED: --selection <file>");
  const selection = parseEntityImageSelection(
    JSON.parse(await readFile(file, "utf8"))
  );
  return { selection, folder: path.dirname(path.resolve(file)) };
};

/** Writes a square WebP of `width` pixels, never wider than the original's square. */
const writeSquareWebp = async (
  source: string,
  target: string,
  width: number,
  lossless = false
) => {
  const bytes = await readFile(source);
  const size = readImageSize(bytes);
  if (!size) throw new Error(`ENTITY_IMAGE_NOT_A_PICTURE: ${source}`);
  const square = centredSquare(size.width, size.height);
  await mkdir(path.dirname(target), { recursive: true });
  await execFileAsync("cwebp", [
    "-quiet",
    ...(lossless ? ["-lossless"] : ["-q", String(ENTITY_IMAGE_QUALITY)]),
    "-crop",
    String(square.x),
    String(square.y),
    String(square.side),
    String(square.side),
    "-resize",
    String(Math.min(square.side, width)),
    "0",
    source,
    "-o",
    target
  ]);
};

/**
 * The same square as a PNG, through a lossless WebP: cwebp crops and resizes, dwebp writes PNG,
 * pngquant reduces it to a palette, which weighs 60 % less with no visible change. A picture
 * pngquant cannot keep at that quality stays whole.
 */
const writeSquarePng = async (
  source: string,
  target: string,
  width: number
) => {
  const step = `${target}.webp`;
  const whole = `${target}.whole.png`;
  await writeSquareWebp(source, step, width, true);
  try {
    await execFileAsync("dwebp", ["-quiet", step, "-o", whole]);
    try {
      await execFileAsync("pngquant", [
        "--quality",
        "80-95",
        "--speed",
        "1",
        "--strip",
        "--force",
        "--output",
        target,
        whole
      ]);
    } catch (cause) {
      // 98 and 99: the palette would fall under the quality asked for.
      const code = (cause as { code?: number }).code;
      if (code !== 98 && code !== 99) throw cause;
      await rename(whole, target);
    }
  } finally {
    await rm(step, { force: true });
    await rm(whole, { force: true });
  }
};

const buildImages = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const { selection, folder } = await readSelection(args);
  const dataFile = option(args, "--data");
  if (!dataFile) throw new Error("ENTITY_IMAGE_DATA_REQUIRED: --data <file>");
  const data = JSON.parse(
    await readFile(dataFile, "utf8")
  ) as EntityCatalogData;
  const built: BuiltPortrait[] = [];
  let written = 0;
  for (const { uniqueName, stage, source } of selection.portraits) {
    const original = path.resolve(folder, source);
    const hash = entityImageHash(await readFile(original));
    for (const width of ENTITY_IMAGE_WIDTHS) {
      const target = copyPath(output, hash, width);
      if (existsSync(target) && (await stat(target)).size > 0) continue;
      await writeSquareWebp(original, target, width);
      written += 1;
    }
    const share = sharePath(output, hash);
    if (!stage && !(existsSync(share) && (await stat(share)).size > 0)) {
      await writeSquarePng(original, share, ENTITY_SHARE_WIDTH);
      written += 1;
    }
    built.push({
      uniqueName,
      ...(stage ? { stage } : {}),
      hash,
      source: original
    });
  }
  const name = (portrait: BuiltPortrait) =>
    portrait.stage
      ? `${portrait.uniqueName}#${portrait.stage}`
      : portrait.uniqueName;
  built.sort((a, b) => (name(a) < name(b) ? -1 : 1));
  const catalog = entityImageCatalog(built, data);
  await mkdir(output, { recursive: true });
  await writeFile(builtPath(output), `${JSON.stringify(built, null, 2)}\n`);
  await writeFile(catalogPath(output), `${JSON.stringify(catalog)}\n`);
  const stages = built.filter((portrait) => portrait.stage).length;
  console.log(
    `Built ${written} copies; the catalog names ${built.length - stages} portraits and ${stages} stages.`
  );
};

const writePlaceholders = async (args: string[]) => {
  const target = option(args, "--target") ?? DEFAULT_PLACEHOLDER_TARGET;
  const siteTarget =
    option(args, "--site-target") ?? DEFAULT_PLACEHOLDER_SITE_TARGET;
  const { selection, folder } = await readSelection(args);
  const missing = missingPlaceholders(selection.placeholders);
  if (missing.length > 0)
    throw new Error(`ENTITY_PLACEHOLDERS_MISSING: ${missing.join(", ")}`);
  for (const placeholder of selection.placeholders) {
    const source = path.resolve(folder, placeholder.source);
    const file = entityPlaceholderFile(placeholder.key, placeholder.index);
    await writeSquareWebp(
      source,
      path.join(target, file),
      ENTITY_PLACEHOLDER_WIDTH
    );
    await writeSquareWebp(
      source,
      path.join(siteTarget, file),
      ENTITY_PLACEHOLDER_WIDTH
    );
    await writeSquarePng(
      source,
      path.join(
        siteTarget,
        entityPlaceholderShareFile(placeholder.key, placeholder.index)
      ),
      ENTITY_SHARE_WIDTH
    );
  }
  console.log(
    `Wrote ${selection.placeholders.length} placeholders to ${target} and ${siteTarget}.`
  );
};

const readBuilt = async (output: string) => {
  if (!existsSync(builtPath(output)))
    throw new Error(`ENTITY_IMAGES_NOT_BUILT: run build first (${output})`);
  return {
    built: JSON.parse(
      await readFile(builtPath(output), "utf8")
    ) as BuiltPortrait[],
    catalog: JSON.parse(
      await readFile(catalogPath(output), "utf8")
    ) as EntityImageCatalog
  };
};

const report = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const { built } = await readBuilt(output);
  const megabytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;
  console.log(`${built.length} portraits`);
  for (const width of ENTITY_IMAGE_WIDTHS) {
    let bytes = 0;
    for (const portrait of built)
      bytes += (await stat(copyPath(output, portrait.hash, width))).size;
    console.log(
      `w${width}`.padEnd(8) +
        `${megabytes(bytes)}, ${(bytes / built.length / 1024).toFixed(1)} KB each`
    );
  }
  console.log(`catalog ${(await stat(catalogPath(output))).size} bytes`);
};

const uploadImages = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const bucket = option(args, "--bucket") ?? ENTITY_IMAGE_BUCKET;
  const dryRun = args.includes("--dry-run");
  const { built } = await readBuilt(output);
  const ledgerPath = path.join(output, `uploaded.${bucket}.json`);

  const copies: MediaUpload[] = [];
  for (const portrait of built) {
    for (const width of ENTITY_IMAGE_WIDTHS) {
      const file = copyPath(output, portrait.hash, width);
      if (!existsSync(file))
        throw new Error(
          `ENTITY_IMAGE_COPY_MISSING: ${portrait.uniqueName} w${width}`
        );
      copies.push({
        key: entityImageKey(portrait.uniqueName, portrait.hash, width),
        file,
        sha256: sha256Hex(await readFile(file)),
        url: entityImageUrl(portrait.uniqueName, portrait.hash, width)
      });
    }
  }
  const shares: MediaUpload[] = [];
  for (const portrait of built) {
    if (portrait.stage) continue;
    const file = sharePath(output, portrait.hash);
    if (!existsSync(file))
      throw new Error(
        `ENTITY_IMAGE_SHARE_COPY_MISSING: ${portrait.uniqueName}`
      );
    shares.push({
      key: entityShareKey(portrait.uniqueName, portrait.hash),
      file,
      sha256: sha256Hex(await readFile(file)),
      url: entityShareUrl(portrait.uniqueName, portrait.hash)
    });
  }
  const uploads = await pendingUploads(copies, ledgerPath);
  const shareUploads = await pendingUploads(shares, ledgerPath);

  if (dryRun) {
    for (const upload of uploads.slice(0, 10)) console.log(`put ${upload.key}`);
    if (uploads.length > 10) console.log(`… ${uploads.length - 10} more`);
    console.log(
      `Would upload ${uploads.length} of ${copies.length} copies and ${shareUploads.length} of ${shares.length} PNG copies to ${bucket}, check ${copies.length + shares.length} addresses, then put ${ENTITY_IMAGE_CATALOG_KEY} naming ${built.length} pictures.`
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
    "image/png"
  );
  console.log(
    `Uploaded ${done} copies and ${sharesDone} PNG copies to ${bucket}.`
  );

  // The catalog must never name a picture its address does not serve.
  const unreachable = await unreachableAddresses(
    [...copies, ...shares].map((copy) => copy.url)
  );
  if (unreachable.length > 0) {
    throw new Error(
      `ENTITY_IMAGES_UNREACHABLE: the catalog was not uploaded.\n${unreachable.slice(0, 20).join("\n")}`
    );
  }

  await wranglerPut(
    bucket,
    ENTITY_IMAGE_CATALOG_KEY,
    catalogPath(output),
    "application/json",
    CATALOG_CACHE_CONTROL
  );
  console.log(
    `Checked ${copies.length + shares.length} addresses and put the catalog naming ${built.length} pictures.`
  );
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "build") return buildImages(args);
  if (command === "placeholders") return writePlaceholders(args);
  if (command === "upload") return uploadImages(args);
  if (command === "report") return report(args);
  console.log(USAGE);
};

await main();
