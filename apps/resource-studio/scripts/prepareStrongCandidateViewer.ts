import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { CANDIDATE_BIBLE_SOURCES } from "../src/jsonlBibleViewer.js";
import { compileStrongBibleJsonlToSqlite } from "../src/strongBibleSqlite.js";
import { buildCandidateReview } from "../src/strongCandidateReview.js";

// Prepare reader indexes only: the generation and its ledger stay intact.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runArgument = process.argv[2];
if (!runArgument) {
  throw new Error(
    "Usage: tsx scripts/prepareStrongCandidateViewer.ts <autonomous-run-dir> [bible,...]"
  );
}
const runDir = path.resolve(runArgument);
const run = JSON.parse(
  await readFile(path.join(runDir, "run.json"), "utf8")
) as {
  bibles: Record<
    string,
    { status: string; directory: string; summary?: { verses: number } }
  >;
};
const wanted = process.argv[3]?.split(",") ?? Object.keys(run.bibles);

async function fileSha256(file: string): Promise<string> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

async function firstVersion(file: string): Promise<string> {
  const lines = createInterface({ input: createReadStream(file) });
  for await (const line of lines) {
    lines.close();
    return (JSON.parse(line) as { version: string }).version;
  }
  throw new Error(`candidate-reader-empty:${file}`);
}

for (const bible of wanted) {
  const generated = run.bibles[bible];
  const source = CANDIDATE_BIBLE_SOURCES.find(
    (item) => item.id === `${bible.toUpperCase()}-CANDIDATE`
  );
  if (!source) throw new Error(`candidate-source-unknown:${bible}`);
  if (generated?.status !== "verified")
    throw new Error(`candidate-generation-not-verified:${bible}`);
  // The run records absolute paths; follow the run directory if it moved.
  const attempt = existsSync(generated.directory)
    ? generated.directory
    : path.join(runDir, bible, path.basename(generated.directory));
  const inputPath = path.join(attempt, `bible-${bible}-strong.jsonl`);
  const ledgerPath = path.join(attempt, `bible-${bible}-strong.sqlite`);
  const version = await firstVersion(inputPath);
  if (version !== source.sourceVersion)
    throw new Error(`candidate-reader-version:${bible}:${version}`);
  const readerSha256 = await fileSha256(inputPath);
  const ledgerSha256 = await fileSha256(ledgerPath);
  const readerPath = path.resolve(root, source.relativePath);
  await mkdir(path.dirname(readerPath), { recursive: true });
  await copyFile(inputPath, readerPath);
  const summary = await compileStrongBibleJsonlToSqlite({
    inputPath: readerPath,
    outputPath: path.resolve(root, source.sqliteRelativePath),
    datasetId: source.id,
    expectedVersion: source.sourceVersion
  });
  const expectedVerses = generated.summary?.verses ?? summary.verseCount;
  if (
    summary.sourceSha256 !== readerSha256 ||
    summary.verseCount !== expectedVerses
  ) {
    throw new Error(`candidate-reader-verification-mismatch:${bible}`);
  }
  const review = await buildCandidateReview({
    ledgerPath,
    outputPath: path.resolve(root, source.reviewRelativePath),
    bible,
    readerSha256,
    ledgerSha256,
    expectedVerses
  });
  await writeFile(
    path.resolve(root, source.manifestPath),
    `${JSON.stringify(
      {
        ...summary,
        generation: runDir,
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
  console.log(
    `${source.shortLabel}: ${summary.verseCount} versets, ${review.unresolved} liens non résolus`
  );
}
