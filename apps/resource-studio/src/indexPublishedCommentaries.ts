import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  buildCommentaryPublicationBundle,
  type CatalogResource
} from "./packageCommentaryResourcePublications.js";
import { readPublishedCommentaryCopy } from "./publishedCommentaryCopy.js";

async function main() {
  const { values } = parseArgs({
    options: { source: { type: "string" }, output: { type: "string" } }
  });
  if (!values.source || !values.output)
    throw new Error(
      "Usage: --source <verified-R2-copy-directory> --output <new-bundle-directory>"
    );
  const source = path.resolve(values.source);
  const output = path.resolve(values.output);
  if (existsSync(output))
    throw new Error("INDEXED_PUBLICATION_OUTPUT_ALREADY_EXISTS");
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
  );
  const snapshot = JSON.parse(
    await readFile(path.join(source, "catalog.json"), "utf8")
  ) as {
    resources: Record<
      string,
      {
        id: string;
        entry?: string;
        contentSha256: string;
        resourceRevision: string;
      }
    >;
  };
  const catalog = JSON.parse(
    await readFile(
      path.join(
        root,
        "apps/resource-studio/workflows/commentaries/data/catalog.json"
      ),
      "utf8"
    )
  ) as { resources: CatalogResource[] };
  const copies = Object.values(snapshot.resources).filter(
    (resource) =>
      resource.entry?.startsWith("commentary-") ||
      resource.entry === "commentaires-mhy.sqlite"
  );
  if (!copies.length) throw new Error("PUBLISHED_COMMENTARY_COPIES_REQUIRED");
  const staging = `${output}.tmp-${randomUUID()}`;
  await mkdir(staging, { recursive: true });
  const generatedAt = new Date().toISOString();
  const publications = [];
  try {
    for (const copy of copies) {
      const [, resourceId, language] = copy.id.split(":");
      if (
        !resourceId ||
        (language !== "fr" && language !== "en") ||
        !copy.entry ||
        path.basename(copy.entry) !== copy.entry
      )
        throw new Error("PUBLISHED_COMMENTARY_CATALOG_INVALID");
      const catalogResource = catalog.resources.find(
        (entry) => entry.id === (resourceId === "MHY" ? "mhy-fr" : resourceId)
      );
      if (!catalogResource?.languages.includes(language))
        throw new Error(`PUBLISHED_COMMENTARY_CATALOG_MISSING:${copy.id}`);
      const canonical = await readPublishedCommentaryCopy({
        sqlitePath: path.join(source, "sqlite", copy.entry),
        resourceId,
        language,
        revision: copy.resourceRevision,
        contentSha256: copy.contentSha256
      });
      const result = await buildCommentaryPublicationBundle(
        staging,
        catalogResource,
        language,
        canonical,
        generatedAt
      );
      publications.push({
        id: copy.id,
        sourceRevision: copy.resourceRevision,
        sourceSha256: copy.contentSha256,
        revision: canonical.revision,
        bundle: path.basename(result.bundlePath),
        archiveBytes: result.manifest.offlineArtifact.bytes,
        sqliteBytes: result.sqliteBytes
      });
      process.stdout.write(`${copy.id}: indexed from published SQLite\n`);
    }
    await writeFile(
      path.join(staging, "indexed-publications.json"),
      JSON.stringify(
        {
          generatedAt,
          source:
            "checksum-verified published R2 copies; no source reacquisition",
          publications
        },
        null,
        2
      ) + "\n"
    );
    await rename(staging, output);
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
