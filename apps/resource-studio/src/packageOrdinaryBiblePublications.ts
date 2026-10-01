import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import {
  applyLegacyPericope,
  buildCanonicalBibleFromLegacy
} from "./legacyBiblePublication.js";
import {
  createDeterministicZip,
  type MobileResourceCatalogEntry
} from "./packageMobileResourceCatalog.js";
import {
  buildBibleResourcePublication,
  type BibleResourcePublicationManifest
} from "./packageResourcePublication.js";
import { verifyCanonicalBiblePublication } from "./strongBibleMobilePublication.js";
import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";
import { applyWordsOfJesus } from "./wordsOfJesus.js";
import {
  loadBiblePericope,
  loadBibleText,
  readOrdinaryBibleSources,
  readWordsOfJesusDataset,
  wordsOfJesusDatasetPath
} from "./wordsOfJesusSources.js";

type BibleProvenanceSource = NonNullable<
  BibleResourcePublicationManifest["provenance"]["sources"]
>[number];
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
    publicOnline: boolean;
  }>;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

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
  sourceOverridesPath?: string;
  versionIds?: readonly string[];
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
  if (config.bibles.length !== 47) {
    throw new Error("ordinary-bible-publications-config-invalid");
  }
  const requestedVersionIds = options.versionIds?.map((id) => id.toUpperCase());
  const selectedBibles = requestedVersionIds
    ? config.bibles.filter((bible) => requestedVersionIds.includes(bible.id))
    : config.bibles;
  if (
    selectedBibles.length === 0 ||
    (requestedVersionIds &&
      (new Set(requestedVersionIds).size !== requestedVersionIds.length ||
        selectedBibles.length !== requestedVersionIds.length))
  ) {
    throw new Error("ordinary-bible-publications-version-invalid");
  }
  const sourceOverrides = options.sourceOverridesPath
    ? (JSON.parse(
        await readFile(path.resolve(root, options.sourceOverridesPath), "utf8")
      ) as Record<string, Record<string, string>>)
    : {};
  const textOverrides: Record<string, string> = {};
  for (const [resourceId, roles] of Object.entries(sourceOverrides)) {
    for (const [role, overridePath] of Object.entries(roles ?? {})) {
      if (!resourceId.startsWith("bible:") || role !== "canonical") {
        throw new Error(
          `ordinary-bible-publications-source-override-unsupported:${resourceId}:${role}`
        );
      }
      textOverrides[resourceId.slice("bible:".length)] = path.resolve(
        root,
        overridePath
      );
    }
  }
  const sourceOptions = { root, textOverrides };
  const configuredSources = (await readOrdinaryBibleSources(root)).bibles;
  const stagingDir = `${outputDir}.tmp-${process.pid}-${randomUUID()}`;
  const canonicalDir = `${stagingDir}-canonical`;

  try {
    await mkdir(canonicalDir, { recursive: true });
    const publications = [];

    for (const metadata of selectedBibles) {
      const resourceId = `bible:${metadata.id}`;
      const configured = configuredSources[metadata.id];
      if (!configured)
        throw new Error(`ordinary-bible-publication-missing:${resourceId}`);
      let canonical: CanonicalBiblePublication;
      let offlineArtifact:
        { path: string; catalogEntry: MobileResourceCatalogEntry } | undefined;
      const provenanceSources: BibleProvenanceSource[] = [];
      try {
        const [text, pericope, wordsOfJesus] = await Promise.all([
          loadBibleText(metadata.id, sourceOptions),
          loadBiblePericope(metadata.id, sourceOptions),
          readWordsOfJesusDataset(root, metadata.id)
        ]);
        provenanceSources.push({
          role: "canonical",
          sourceUrl: configured.text.sourceUrl,
          sha256: text.sourceSha256
        });
        // Pericopes complete legacy text, and canonical sources without headings.
        const appliesPericope =
          pericope !== undefined &&
          (!text.canonicalSource || text.publication.headingCount === 0);
        if (pericope && appliesPericope) {
          provenanceSources.push({
            role: "pericope",
            sourceUrl: pericope.location,
            sha256: pericope.sha256
          });
        }
        canonical = text.canonicalSource
          ? appliesPericope
            ? applyLegacyPericope(text.publication, pericope!.pericope)
            : text.publication
          : buildCanonicalBibleFromLegacy({
              versionId: metadata.id,
              sourceVersion: configured.text.sourceUrl,
              sourceSha256: text.sourceSha256,
              bible: text.legacyBible,
              ...(pericope ? { pericope: pericope.pericope } : {})
            });
        if (wordsOfJesus) {
          canonical = applyWordsOfJesus(canonical, wordsOfJesus).publication;
          const datasetPath = wordsOfJesusDatasetPath(root, metadata.id);
          provenanceSources.push({
            role: "redWords",
            sourceUrl: path.relative(root, datasetPath),
            sha256: sha256(await readFile(datasetPath, "utf8"))
          });
        }
        // A Bible that gains no presentation keeps its delivered archive byte
        // for byte: readers are not offered an empty update, and archives
        // other resources depend on (the BHG text of interlinear indexes) stay
        // identical. Such Bibles never had side files.
        if (!wordsOfJesus && !appliesPericope) {
          const archivePath = path.join(
            canonicalDir,
            `bible-${metadata.id.toLowerCase()}.json.zip`
          );
          if (text.sourceFilePath.endsWith(".zip")) {
            await copyFile(text.sourceFilePath, archivePath);
          } else {
            await createDeterministicZip({
              inputs: [
                { inputPath: text.sourceFilePath, entryName: text.sourceEntry }
              ],
              archivePath,
              stagingRoot: path.join(
                canonicalDir,
                `.zip-${metadata.id.toLowerCase()}`
              )
            });
          }
          offlineArtifact = {
            path: archivePath,
            catalogEntry: {
              entry: text.sourceEntry,
              entries: {
                canonical: {
                  entry: text.sourceEntry,
                  sha256: text.sourceSha256,
                  bytes: text.sourceEntryBytes
                }
              }
            } as MobileResourceCatalogEntry
          };
        }
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
      // Without an existing artifact, the bundle zips the canonical JSON alone:
      // headings and words of Jesus travel inside it, never as side files.
      const result = await buildBibleResourcePublication({
        canonicalPath,
        outputDir: path.join(stagingDir, metadata.id.toLowerCase()),
        generatedAt: options.generatedAt,
        provenanceSources,
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
        ...(offlineArtifact ? { offlineArtifact } : {})
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
    await rm(canonicalDir, { recursive: true, force: true });
  }
}

const parseArgs = (args: readonly string[]) => {
  const values = new Map<string, string>();
  const allowed = new Set([
    "--generated-at",
    "--output",
    "--source-overrides",
    "--version"
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !allowed.has(key))
      throw new Error(
        `ordinary-bible-publications-cli-option-unknown:${key ?? ""}`
      );
    if (!value || value.startsWith("--"))
      throw new Error("ordinary-bible-publications-cli-invalid");
    if (values.has(key))
      throw new Error(
        `ordinary-bible-publications-cli-option-duplicate:${key}`
      );
    values.set(key, value);
  }
  return values;
};

export const parseOrdinaryBiblePublicationArgs = (
  raw: readonly string[]
): {
  generatedAt: string;
  outputDir?: string;
  sourceOverridesPath?: string;
  versionIds?: string[];
} => {
  const args = parseArgs(raw);
  const generatedAt = args.get("--generated-at");
  if (!generatedAt)
    throw new Error("ordinary-bible-publications-generated-at-required");
  return {
    generatedAt,
    ...(args.get("--output") ? { outputDir: args.get("--output") } : {}),
    ...(args.get("--source-overrides")
      ? { sourceOverridesPath: args.get("--source-overrides") }
      : {}),
    ...(args.get("--version")
      ? { versionIds: [args.get("--version")!.toUpperCase()] }
      : {})
  };
};

const isMain = process.argv.some((argument) =>
  argument.includes("packageOrdinaryBiblePublications")
);

if (isMain) {
  const firstOption = process.argv.findIndex((argument) =>
    argument.startsWith("--")
  );
  const options = parseOrdinaryBiblePublicationArgs(
    firstOption === -1 ? [] : process.argv.slice(firstOption)
  );
  buildOrdinaryBiblePublications(options)
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
