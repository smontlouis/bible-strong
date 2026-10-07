import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSONL_BIBLE_SOURCES } from "../src/jsonlBibleViewer.js";
import { compileStrongBibleJsonlToSqlite } from "../src/strongBibleSqlite.js";
import { buildCandidateReview } from "../src/strongCandidateReview.js";

// Prepare reader indexes only: the immutable experiment and its ledger stay intact.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestArgument = process.argv[2];
if (!manifestArgument) {
  throw new Error(
    "Usage: tsx scripts/prepareStrongCandidateViewer.ts <delivery-manifest.json>"
  );
}
const deliveryPath = path.resolve(manifestArgument);
const delivery = JSON.parse(await readFile(deliveryPath, "utf8")) as {
  editions: Record<
    "s21" | "neg79",
    {
      reader: string;
      readerSha256: string;
      ledger?: string;
      ledgerSha256?: string;
      counts: { verses: number };
    }
  >;
};

for (const edition of ["s21", "neg79"] as const) {
  const id = `${edition.toUpperCase()}-CANDIDATE`;
  const source = JSONL_BIBLE_SOURCES.find((item) => item.id === id)!;
  const input = delivery.editions[edition];
  const inputPath = path.resolve(path.dirname(deliveryPath), input.reader);
  const actualHash = createHash("sha256")
    .update(await readFile(inputPath))
    .digest("hex");
  if (actualHash !== input.readerSha256) {
    throw new Error(`candidate-reader-checksum-mismatch:${edition}`);
  }
  const readerPath = path.resolve(root, source.relativePath);
  await mkdir(path.dirname(readerPath), { recursive: true });
  await copyFile(inputPath, readerPath);
  const summary = await compileStrongBibleJsonlToSqlite({
    inputPath: readerPath,
    outputPath: path.resolve(root, source.sqliteRelativePath),
    datasetId: source.id,
    expectedVersion: source.sourceVersion
  });
  if (
    summary.sourceSha256 !== input.readerSha256 ||
    summary.verseCount !== input.counts.verses
  ) {
    throw new Error(`candidate-reader-verification-mismatch:${edition}`);
  }
  let review;
  if (input.ledger && input.ledgerSha256 && "reviewRelativePath" in source) {
    const ledgerPath = path.resolve(path.dirname(deliveryPath), input.ledger);
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(ledgerPath))
      digest.update(chunk);
    if (digest.digest("hex") !== input.ledgerSha256)
      throw new Error(`candidate-ledger-checksum-mismatch:${edition}`);
    review = await buildCandidateReview({
      ledgerPath,
      outputPath: path.resolve(root, source.reviewRelativePath),
      bible: edition,
      readerSha256: input.readerSha256,
      ledgerSha256: input.ledgerSha256,
      expectedVerses: input.counts.verses
    });
  }
  await writeFile(
    path.resolve(root, source.manifestPath),
    `${JSON.stringify(
      {
        ...summary,
        deliveryManifest: deliveryPath,
        review,
        sha256: summary.sourceSha256,
        metrics: {
          taggedTokenCount: summary.occurrenceCount,
          enrichedTagCount: summary.identityCount - summary.occurrenceCount
        }
      },
      null,
      2
    )}\n`
  );
  console.log(`${source.shortLabel}: ${summary.verseCount} versets vérifiés`);
}
