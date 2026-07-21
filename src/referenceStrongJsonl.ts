import { createHash } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";

import { BOOK_IDS } from "./books.js";
import { readStrongCsv } from "./strongCsv.js";

export const REFERENCE_STRONG_JSONL_SCHEMA_VERSION = 1;

export interface ReferenceStrongJsonlRecord {
  ref: string;
  version: string;
  book: number;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface ReferenceStrongJsonlResult {
  artifactSha256: string;
  outputPath: string;
  sizeBytes: number;
  sourceSha256: string;
  strongTagCount: number;
  verseCount: number;
  version: string;
}

export async function writeReferenceStrongJsonl(options: {
  inputPath: string;
  outputPath: string;
  version: string;
}): Promise<ReferenceStrongJsonlResult> {
  const rows = await readStrongCsv(options.inputPath);
  const temporaryPath = `${options.outputPath}.tmp`;
  const records: ReferenceStrongJsonlRecord[] = [];
  let strongTagCount = 0;

  for (const row of rows) {
    const book = BOOK_IDS.indexOf(row.bookId as (typeof BOOK_IDS)[number]) + 1;
    if (book === 0) {
      throw new Error(`Unknown book id in ${options.inputPath}: ${row.bookId}`);
    }
    strongTagCount += countStrongTags(row.text);
    records.push({
      ref: `${row.bookId}.${row.chapter}.${row.verse}`,
      version: options.version,
      book,
      bookId: row.bookId,
      chapter: row.chapter,
      verse: row.verse,
      text: row.text
    });
  }

  await rm(temporaryPath, { force: true });
  try {
    await writeFile(
      temporaryPath,
      `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
      "utf8"
    );
    await verifyRoundTrip(temporaryPath, records);
    await rename(temporaryPath, options.outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  const [artifactSha256, sourceSha256, outputStat] = await Promise.all([
    sha256File(options.outputPath),
    sha256File(options.inputPath),
    stat(options.outputPath)
  ]);
  return {
    artifactSha256,
    outputPath: options.outputPath,
    sizeBytes: outputStat.size,
    sourceSha256,
    strongTagCount,
    verseCount: records.length,
    version: options.version
  };
}

async function verifyRoundTrip(
  outputPath: string,
  expected: ReferenceStrongJsonlRecord[]
): Promise<void> {
  const lines = (await readFile(outputPath, "utf8")).trimEnd().split("\n");
  if (lines.length !== expected.length) {
    throw new Error(
      `JSONL verse count mismatch: expected ${expected.length}, got ${lines.length}`
    );
  }
  for (let index = 0; index < lines.length; index += 1) {
    const actual = JSON.parse(
      lines[index] ?? "null"
    ) as ReferenceStrongJsonlRecord;
    const wanted = expected[index];
    if (!wanted || JSON.stringify(actual) !== JSON.stringify(wanted)) {
      throw new Error(`JSONL round-trip mismatch at line ${index + 1}`);
    }
  }
}

function countStrongTags(text: string): number {
  return text.match(/<w\b[^>]*\bstrong=(['"])[\s\S]*?\1[^>]*>/giu)?.length ?? 0;
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}
