import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  backdropsNamed,
  entityBackdropHash,
  entityBackdropKey,
  entityBackdropUrl,
  entityCardCatalog,
  ENTITY_BACKDROP_QUALITY,
  ENTITY_BACKDROP_WIDTH,
  ENTITY_CARD_CATALOG_KEY,
  type EntityCardCatalog,
  type SourceEntityCard
} from "./entityCards.js";
import {
  entityImageUrl,
  ENTITY_IMAGE_BUCKET,
  ENTITY_IMAGE_CATALOG_KEY,
  ENTITY_IMAGE_HOST,
  type EntityImageCatalog
} from "./entityImages.js";
import {
  CATALOG_CACHE_CONTROL,
  pendingUploads,
  putImmutableCopies,
  unreachableAddresses,
  wranglerPut,
  type MediaUpload
} from "./mediaUpload.js";
import { sha256Hex } from "./timelineImages.js";

const execFileAsync = promisify(execFile);

const STUDIO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const DEFAULT_OUTPUT = path.join(STUDIO_ROOT, "outputs", "entity-cards");
const PORTRAIT_CATALOG_URL = `${ENTITY_IMAGE_HOST}/${ENTITY_IMAGE_CATALOG_KEY}`;

const USAGE = `Publishes the character cards and their backdrops to the media host (ADR-0090).

The cards come from the portraits' working folder (portraits/cards/catalog.json, written by
build_catalog.py); the backdrops are its paintings, <key>.png in portraits/decors. A card names its
portrait by its identity: the portraits must be published first.

  yarn resources:entities:cards build --cards <file> --backdrops <folder> [--portraits <file>] [--output <dir>]
      Checks every card against the portraits' catalog (default: the one at ${ENTITY_IMAGE_HOST}),
      writes the ${ENTITY_BACKDROP_WIDTH}-pixel WebP copy of every backdrop a card names, and the catalog
      to publish. Writes nothing if a card lacks a reviewed sentence, a language, a portrait or a
      backdrop. Needs cwebp (brew install webp).
  yarn resources:entities:cards upload [--output <dir>] [--bucket <name>] [--dry-run]
      Checks again that every card's portrait answers at ${ENTITY_IMAGE_HOST}, puts the backdrops in the
      public media bucket (default: ${ENTITY_IMAGE_BUCKET}) through the operator's wrangler session,
      checks that each answers, then puts ${ENTITY_CARD_CATALOG_KEY}. Never deletes anything.
      --dry-run only says what it would do.
  yarn resources:entities:cards report [--output <dir>]
      Counts and weighs what was built.
`;

const option = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

type BuiltBackdrop = { key: string; hash: string; source: string };

const builtPath = (output: string) => path.join(output, "built.json");
const catalogPath = (output: string) => path.join(output, "catalog.json");
const copyPath = (output: string, hash: string) =>
  path.join(output, "backdrops", hash, `w${ENTITY_BACKDROP_WIDTH}.webp`);

const readPortraits = async (file?: string): Promise<EntityImageCatalog> => {
  if (file) return JSON.parse(await readFile(file, "utf8"));
  const answer = await fetch(PORTRAIT_CATALOG_URL);
  if (!answer.ok)
    throw new Error(
      `ENTITY_PORTRAITS_UNREACHABLE: ${answer.status} ${PORTRAIT_CATALOG_URL}`
    );
  return (await answer.json()) as EntityImageCatalog;
};

const buildCards = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const cardsFile = option(args, "--cards");
  if (!cardsFile) throw new Error("ENTITY_CARDS_REQUIRED: --cards <file>");
  const folder = option(args, "--backdrops");
  if (!folder)
    throw new Error("ENTITY_BACKDROPS_REQUIRED: --backdrops <folder>");
  const cards = JSON.parse(
    await readFile(cardsFile, "utf8")
  ) as SourceEntityCard[];
  const portraits = await readPortraits(option(args, "--portraits"));

  const built: BuiltBackdrop[] = [];
  let written = 0;
  for (const key of backdropsNamed(cards)) {
    const source = path.resolve(folder, `${key}.png`);
    if (!existsSync(source)) continue;
    const hash = entityBackdropHash(await readFile(source));
    const target = copyPath(output, hash);
    if (!existsSync(target) || (await stat(target)).size === 0) {
      await mkdir(path.dirname(target), { recursive: true });
      await execFileAsync("cwebp", [
        "-quiet",
        "-q",
        String(ENTITY_BACKDROP_QUALITY),
        "-resize",
        String(ENTITY_BACKDROP_WIDTH),
        "0",
        source,
        "-o",
        target
      ]);
      written += 1;
    }
    built.push({ key, hash, source });
  }

  const catalog = entityCardCatalog(
    cards,
    portraits,
    Object.fromEntries(built.map(({ key, hash }) => [key, hash]))
  );
  await mkdir(output, { recursive: true });
  await writeFile(builtPath(output), `${JSON.stringify(built, null, 2)}\n`);
  await writeFile(catalogPath(output), `${JSON.stringify(catalog)}\n`);
  const stages = catalog.cards.filter((card) => card.stage).length;
  console.log(
    `Built ${written} backdrop copies; the catalog names ${catalog.cards.length} cards (${stages} life stages) and ${built.length} backdrops.`
  );
};

const readBuilt = async (output: string) => {
  if (!existsSync(builtPath(output)))
    throw new Error(`ENTITY_CARDS_NOT_BUILT: run build first (${output})`);
  return {
    built: JSON.parse(
      await readFile(builtPath(output), "utf8")
    ) as BuiltBackdrop[],
    catalog: JSON.parse(
      await readFile(catalogPath(output), "utf8")
    ) as EntityCardCatalog
  };
};

const report = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const { built, catalog } = await readBuilt(output);
  let bytes = 0;
  for (const backdrop of built)
    bytes += (await stat(copyPath(output, backdrop.hash))).size;
  const families = new Map<string, number>();
  for (const card of catalog.cards)
    families.set(card.family, (families.get(card.family) ?? 0) + 1);
  console.log(
    `${catalog.cards.length} cards: ${[...families].map(([family, count]) => `${count} ${family}`).join(", ")}`
  );
  console.log(
    `${built.length} backdrops, ${(bytes / 1_048_576).toFixed(1)} MB, ${(bytes / built.length / 1024).toFixed(1)} KB each`
  );
  console.log(`catalog ${(await stat(catalogPath(output))).size} bytes`);
};

/** The w768 address of every card's portrait in the live portraits' catalog, or what is missing. */
const portraitAddresses = (
  catalog: EntityCardCatalog,
  portraits: EntityImageCatalog
) => {
  const urls: string[] = [];
  const missing: string[] = [];
  for (const card of catalog.cards) {
    const entity = portraits.entities[card.entity];
    const hash = card.stage
      ? entity?.stages?.find((stage) => stage.key === card.stage)?.hash
      : entity?.hash;
    if (hash) urls.push(entityImageUrl(card.entity, hash, 768));
    else missing.push(card.id);
  }
  return { urls, missing };
};

const uploadCards = async (args: string[]) => {
  const output = option(args, "--output") ?? DEFAULT_OUTPUT;
  const bucket = option(args, "--bucket") ?? ENTITY_IMAGE_BUCKET;
  const dryRun = args.includes("--dry-run");
  const { built, catalog } = await readBuilt(output);
  const ledgerPath = path.join(output, `uploaded.${bucket}.json`);

  // The portraits may have changed since the build: every card must still find its own.
  const portraits = portraitAddresses(catalog, await readPortraits());
  if (portraits.missing.length > 0)
    throw new Error(
      `ENTITY_CARDS_WITHOUT_PORTRAIT: nothing was uploaded.\n${portraits.missing.slice(0, 20).join("\n")}`
    );

  const copies: MediaUpload[] = [];
  for (const backdrop of built) {
    const file = copyPath(output, backdrop.hash);
    if (!existsSync(file))
      throw new Error(`ENTITY_BACKDROP_COPY_MISSING: ${backdrop.key}`);
    copies.push({
      key: entityBackdropKey(backdrop.key, backdrop.hash),
      file,
      sha256: sha256Hex(await readFile(file)),
      url: entityBackdropUrl(backdrop.key, backdrop.hash)
    });
  }
  const uploads = await pendingUploads(copies, ledgerPath);

  if (dryRun) {
    for (const upload of uploads.slice(0, 10)) console.log(`put ${upload.key}`);
    if (uploads.length > 10) console.log(`… ${uploads.length - 10} more`);
    console.log(
      `Would upload ${uploads.length} of ${copies.length} backdrops to ${bucket}, check ${copies.length + portraits.urls.length} addresses, then put ${ENTITY_CARD_CATALOG_KEY} naming ${catalog.cards.length} cards.`
    );
    return;
  }

  const done = await putImmutableCopies(
    bucket,
    uploads,
    ledgerPath,
    "image/webp"
  );
  console.log(`Uploaded ${done} backdrops to ${bucket}.`);

  // The catalog must never name a picture its address does not serve.
  const unreachable = await unreachableAddresses([
    ...copies.map((copy) => copy.url),
    ...portraits.urls
  ]);
  if (unreachable.length > 0) {
    throw new Error(
      `ENTITY_CARDS_UNREACHABLE: the catalog was not uploaded.\n${unreachable.slice(0, 20).join("\n")}`
    );
  }

  await wranglerPut(
    bucket,
    ENTITY_CARD_CATALOG_KEY,
    catalogPath(output),
    "application/json",
    CATALOG_CACHE_CONTROL
  );
  console.log(
    `Checked ${copies.length + portraits.urls.length} addresses and put the catalog naming ${catalog.cards.length} cards.`
  );
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === "build") return buildCards(args);
  if (command === "upload") return uploadCards(args);
  if (command === "report") return report(args);
  console.log(USAGE);
};

await main();
