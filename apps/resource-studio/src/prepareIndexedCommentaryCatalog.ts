import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareCatalogContractReplacements,
  type CatalogResource
} from "./packageCommentaryResourcePublications.js";
import { commitResourcePublicationTransaction } from "./resourcePublicationCommit.js";

async function main() {
  const input = process.argv[2];
  if (!input)
    throw new Error(
      "Usage: prepareIndexedCommentaryCatalog.ts <validated-indexed-bundle-root>"
    );
  const output = path.resolve(input);
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const plan = JSON.parse(
    await readFile(path.join(output, "indexed-publications.json"), "utf8")
  ) as {
    publications: {
      id: string;
      revision: string;
      bundle: string;
      sqliteBytes: number;
    }[];
  };
  const validation = JSON.parse(
    await readFile(path.join(output, "validation-report.json"), "utf8")
  ) as { bundles: { id: string; revision: string; validated: boolean }[] };
  const catalog = JSON.parse(
    await readFile(
      path.join(
        root,
        "apps/resource-studio/workflows/commentaries/data/catalog.json"
      ),
      "utf8"
    )
  ) as { resources: CatalogResource[] };
  const publications = [];
  for (const item of plan.publications) {
    if (
      !validation.bundles.some(
        (value) =>
          value.id === item.id &&
          value.revision === item.revision &&
          value.validated
      ) ||
      !Number.isSafeInteger(item.sqliteBytes) ||
      item.sqliteBytes <= 0 ||
      path.basename(item.bundle) !== item.bundle
    )
      throw new Error(`INDEXED_PUBLICATION_VALIDATION_REQUIRED:${item.id}`);
    const manifest = JSON.parse(
      await readFile(path.join(output, item.bundle, "manifest.json"), "utf8")
    ) as Parameters<
      typeof prepareCatalogContractReplacements
    >[1][number]["manifest"];
    if (
      manifest.revision !== item.revision ||
      `database:${manifest.identity.resourceId}:${manifest.identity.language}` !==
        item.id
    )
      throw new Error("INDEXED_PUBLICATION_MANIFEST_MISMATCH");
    const catalogResource = catalog.resources.find(
      (entry) =>
        entry.id ===
        (manifest.identity.resourceId === "MHY"
          ? "mhy-fr"
          : manifest.identity.resourceId)
    );
    if (!catalogResource)
      throw new Error("INDEXED_PUBLICATION_CATALOG_ENTRY_REQUIRED");
    publications.push({
      catalogResource,
      language: manifest.identity.language,
      manifest,
      sqliteBytes: item.sqliteBytes
    });
  }
  const staging = `${output}.catalog-${randomUUID()}`;
  try {
    const replacements = await prepareCatalogContractReplacements(
      catalog.resources.filter((item) => item.languages.length),
      publications,
      staging
    );
    await commitResourcePublicationTransaction({ replacements });
    process.stdout.write(
      `${publications.length} local catalogue entries prepared. No upload or deployment performed.\n`
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
