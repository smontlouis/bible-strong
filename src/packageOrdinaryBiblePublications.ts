import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { buildCanonicalBibleFromLegacy } from "./legacyBiblePublication.js";
import {
  buildMobileResourceCatalog,
  type MobileResourceCatalog,
  type MobileResourceInventoryEntry
} from "./packageMobileResourceCatalog.js";
import { buildBibleResourcePublication } from "./packageResourcePublication.js";
import { verifyCanonicalBiblePublication } from "./strongBibleMobilePublication.js";
import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";

const execFileAsync = promisify(execFile);
const PROTESTANT_BOOKS = Array.from({ length: 66 }, (_, index) => index + 1);
const CATHOLIC_BOOKS = [
  ...Array.from({ length: 16 }, (_, index) => index + 1),
  67,
  68,
  17,
  72,
  73,
  ...Array.from({ length: 5 }, (_, index) => index + 18),
  69,
  70,
  23,
  24,
  25,
  71,
  ...Array.from({ length: 14 }, (_, index) => index + 26),
  ...Array.from({ length: 27 }, (_, index) => index + 40)
];
const CLEMENTINE_BOOKS = [
  ...Array.from({ length: 16 }, (_, index) => index + 1),
  67,
  68,
  17,
  ...Array.from({ length: 5 }, (_, index) => index + 18),
  69,
  70,
  23,
  24,
  25,
  71,
  ...Array.from({ length: 14 }, (_, index) => index + 26),
  72,
  73,
  ...Array.from({ length: 27 }, (_, index) => index + 40)
];
const THEOTEX_BOOKS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 74, 15, 16, 17, 68, 67, 72, 73,
  75, 76, 19, 20, 21, 22, 18, 69, 70, 77, 28, 30, 33, 29, 31, 32, 34, 35, 36,
  37, 38, 39, 23, 24, 71, 25, 26, 27
];

type PublicationConfig = {
  schemaVersion: 1;
  rightsReviewedAt: string;
  bibles: Array<{
    id: string;
    language: string;
    attribution: string;
    publicOnline: true;
  }>;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const readZipEntry = async (archivePath: string, entry: string) => {
  const result = await execFileAsync("unzip", ["-p", archivePath, entry], {
    maxBuffer: 128 * 1024 * 1024
  });
  return result.stdout;
};

export const getOrdinaryBibleCanon = (versionId: string) => {
  if (["BFC", "FRC97", "NFC", "PDV2017"].includes(versionId)) {
    return {
      id: "catholic-73",
      orderedBooks: CATHOLIC_BOOKS,
      versification: "bible-strong-default"
    };
  }
  if (versionId === "BCC1923") {
    return {
      id: "catholic-73",
      orderedBooks: CATHOLIC_BOOKS,
      versification: "bible-strong-catholic-extended-esther-daniel"
    };
  }
  if (versionId === "LXX") {
    return {
      id: "theotex-septuagint",
      orderedBooks: THEOTEX_BOOKS,
      versification: "theotex-septuagint"
    };
  }
  if (versionId === "VUL") {
    return {
      id: "clementine-vulgate",
      orderedBooks: CLEMENTINE_BOOKS,
      versification: "clementine-vulgate"
    };
  }
  if (versionId === "LAU") {
    return {
      id: "protestant-66",
      orderedBooks: PROTESTANT_BOOKS,
      versification: "bible-strong-french-4-chapter-joel"
    };
  }
  return {
    id: "protestant-66",
    orderedBooks: PROTESTANT_BOOKS,
    versification: "bible-strong-default"
  };
};

export async function buildOrdinaryBiblePublications(options: {
  root?: string;
  outputDir?: string;
  generatedAt: string;
}) {
  const root = path.resolve(options.root ?? process.cwd());
  const outputDir = path.resolve(
    root,
    options.outputDir ?? "outputs/releases/ordinary-bible-publications-current"
  );
  if (existsSync(outputDir))
    throw new Error(
      `ordinary-bible-publications-output-already-exists:${outputDir}`
    );
  const config = JSON.parse(
    await readFile(
      path.join(root, "config/ordinary-bible-publications.json"),
      "utf8"
    )
  ) as PublicationConfig;
  const inventory = JSON.parse(
    await readFile(
      path.join(root, "config/mobile-resource-inventory.json"),
      "utf8"
    )
  ) as MobileResourceInventoryEntry[];
  const ids = config.bibles.map((bible) => `bible:${bible.id}`);
  const ordinaryInventory = inventory.filter((resource) =>
    ids.includes(resource.id)
  );
  if (
    ordinaryInventory.length !== config.bibles.length ||
    new Set(ids).size !== 47
  ) {
    throw new Error("ordinary-bible-publications-catalog-mismatch");
  }
  const requiredBundleRoles = Object.fromEntries(
    ordinaryInventory.flatMap((resource) => {
      const roles = resource.sources
        .map((source) => source.role)
        .filter((role) => role !== "canonical")
        .sort();
      return roles.length > 0 ? [[resource.id, roles]] : [];
    })
  );
  const stagingDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const mobileDir = `${stagingDir}-mobile`;
  const canonicalDir = `${stagingDir}-canonical`;

  try {
    const mobileResult = await buildMobileResourceCatalog({
      root,
      outputDir: mobileDir,
      inventory: ordinaryInventory,
      requiredIds: ids,
      requiredBundleRoles,
      generatedAt: options.generatedAt
    });
    const mobileCatalog = JSON.parse(
      await readFile(mobileResult.catalogPath, "utf8")
    ) as MobileResourceCatalog;
    await mkdir(canonicalDir, { recursive: true });
    const publications = [];

    for (const metadata of config.bibles) {
      const resourceId = `bible:${metadata.id}`;
      const artifact = mobileCatalog.resources[resourceId];
      const inventoryEntry = ordinaryInventory.find(
        (resource) => resource.id === resourceId
      );
      const canonicalEntry = artifact?.entries.canonical;
      if (!artifact || !inventoryEntry || !canonicalEntry)
        throw new Error(`ordinary-bible-publication-missing:${resourceId}`);
      const archivePath = path.join(mobileDir, artifact.file);
      const legacyBible = await readZipEntry(archivePath, canonicalEntry.entry);
      const bibleValue: unknown = JSON.parse(legacyBible);
      const pericopeEntry = artifact.entries.pericope;
      const redWordsEntry = artifact.entries.redWords;
      const pericope = pericopeEntry
        ? JSON.parse(await readZipEntry(archivePath, pericopeEntry.entry))
        : undefined;
      const redWords = redWordsEntry
        ? JSON.parse(await readZipEntry(archivePath, redWordsEntry.entry))
        : undefined;
      let canonical: CanonicalBiblePublication;
      try {
        canonical =
          (bibleValue as Partial<CanonicalBiblePublication>).format ===
          "bible-strong-canonical-bible"
            ? (bibleValue as CanonicalBiblePublication)
            : buildCanonicalBibleFromLegacy({
                versionId: metadata.id,
                sourceVersion: inventoryEntry.sources.find(
                  (source) => source.role === "canonical"
                )!.sourceUrl,
                sourceSha256: sha256(legacyBible),
                bible: bibleValue,
                ...(pericope ? { pericope } : {}),
                ...(redWords ? { redWords } : {})
              });
      } catch (cause) {
        throw new Error(
          `ordinary-bible-canonical-build-failed:${metadata.id}:${cause instanceof Error ? cause.message : String(cause)}`,
          { cause }
        );
      }
      try {
        verifyCanonicalBiblePublication(canonical);
      } catch (cause) {
        throw new Error(
          `ordinary-bible-canonical-verify-failed:${metadata.id}:${cause instanceof Error ? cause.message : String(cause)}`,
          { cause }
        );
      }
      const canonicalPath = path.join(
        canonicalDir,
        `${metadata.id.toLowerCase()}.json`
      );
      await writeFile(canonicalPath, `${JSON.stringify(canonical)}\n`);
      const canon = getOrdinaryBibleCanon(metadata.id);
      const result = await buildBibleResourcePublication({
        canonicalPath,
        outputDir: path.join(stagingDir, metadata.id.toLowerCase()),
        generatedAt: options.generatedAt,
        provenanceSources: inventoryEntry.sources.map((source) => {
          const entry = artifact.entries[source.role];
          if (!entry) {
            throw new Error(
              `ordinary-bible-publication-provenance-entry-missing:${resourceId}:${source.role}`
            );
          }
          return {
            role: source.role,
            sourceUrl: source.sourceUrl,
            sha256: entry.sha256
          };
        }),
        identity: { versionId: metadata.id, language: metadata.language },
        rights: {
          holder: metadata.attribution,
          termsReference: `config/ordinary-bible-publications.json#${metadata.id}`,
          attribution: metadata.attribution,
          reviewedAt: config.rightsReviewedAt,
          online: metadata.publicOnline === true,
          offline: true
        },
        deliveryCapabilities: {
          onlineAccess: metadata.publicOnline === true,
          offlineDownload: true,
          localDevelopmentAccess: true
        },
        canon: { id: canon.id, orderedBooks: canon.orderedBooks },
        versification: canon.versification,
        offlineArtifact: { path: archivePath, catalogEntry: artifact }
      }).catch((cause: unknown) => {
        throw new Error(
          `ordinary-bible-publication-build-failed:${metadata.id}:${cause instanceof Error ? cause.message : String(cause)}`,
          { cause }
        );
      });
      publications.push({
        id: metadata.id,
        revision: result.manifest.revision,
        publicationRevision: result.manifest.publicationRevision,
        textRevision: result.manifest.revision,
        onlineAccess: result.manifest.deliveryCapabilities.onlineAccess
      });
    }

    await writeFile(
      path.join(stagingDir, "ordinary-bibles.json"),
      `${JSON.stringify({ format: "bible-strong-ordinary-bible-publications", schemaVersion: 1, generatedAt: options.generatedAt, resourceCount: publications.length, publications }, null, 2)}\n`
    );
    await rm(canonicalDir, { recursive: true, force: true });
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(stagingDir, outputDir);
    return { outputDir, resourceCount: publications.length, publications };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(mobileDir, { recursive: true, force: true });
    await rm(canonicalDir, { recursive: true, force: true });
  }
}

const parseArgs = (args: string[]) => {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("ordinary-bible-publications-cli-invalid");
    values.set(key, value);
  }
  return values;
};

const isMain = process.argv.some((argument) =>
  argument.includes("packageOrdinaryBiblePublications")
);

if (isMain) {
  const firstOption = process.argv.findIndex((argument) =>
    argument.startsWith("--")
  );
  const args = parseArgs(
    firstOption === -1 ? [] : process.argv.slice(firstOption)
  );
  const generatedAt = args.get("--generated-at");
  if (!generatedAt)
    throw new Error("ordinary-bible-publications-generated-at-required");
  buildOrdinaryBiblePublications({
    generatedAt,
    ...(args.get("--output") ? { outputDir: args.get("--output") } : {})
  })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
