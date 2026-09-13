import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { writeCommentaryReadingIndex } from "./commentaryReadingIndex.js";

async function hashFile(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/** Measures a disposable copy. Never adds tables to an installed/published artifact. */
export async function measureCommentaryReadingIndex(input: string) {
  const sourceSha256 = await hashFile(input);
  const sourceBytes = (await stat(input)).size;
  const directory = await mkdtemp(
    path.join(tmpdir(), "commentary-reading-measure-")
  );
  let database: DatabaseSync | undefined;
  try {
    const copied = path.join(directory, "measurement.sqlite");
    await copyFile(input, copied);
    database = new DatabaseSync(copied);
    const metadata = database
      .prepare(
        "SELECT resource_id, language, revision FROM RESOURCE_METADATA LIMIT 1"
      )
      .get();
    if (
      !metadata ||
      typeof metadata.resource_id !== "string" ||
      (metadata.language !== "en" && metadata.language !== "fr") ||
      typeof metadata.revision !== "string"
    ) {
      throw new Error("COMMENTARY_METADATA_REQUIRED");
    }
    const identity: { resourceId: string; language: "en" | "fr" } = {
      resourceId: metadata.resource_id,
      language: metadata.language
    };
    // The input may already contain an index. Rebuild in the disposable copy for
    // a consistent before/after comparison against the current algorithm.
    database.exec("DROP TABLE IF EXISTS COMMENTARY_READING_SECTIONS; VACUUM");
    const baselineBytes = (await stat(copied)).size;
    const started = performance.now();
    writeCommentaryReadingIndex(database, identity);
    const generationMs = performance.now() - started;
    database.exec("VACUUM");
    const indexedBytes = (await stat(copied)).size;
    const chapters = database
      .prepare(
        "SELECT DISTINCT book, chapter FROM COMMENTARY_READING_SECTIONS ORDER BY book, chapter"
      )
      .all();
    const select = database.prepare(
      "SELECT id, range_start_verse, range_end_verse, excerpt FROM COMMENTARY_READING_SECTIONS WHERE book=? AND chapter=? ORDER BY range_start_verse, range_end_verse, id"
    );
    const payloads = chapters.map((chapter) => {
      const start = performance.now();
      const rows = select.all(chapter.book!, chapter.chapter!);
      const lookupMs = performance.now() - start;
      const sections = rows.map((row) => ({
        id: row.id,
        rangeStartVerse: row.range_start_verse,
        rangeEndVerse: row.range_end_verse,
        excerpt: row.excerpt
      }));
      const json = JSON.stringify({
        book: chapter.book,
        chapter: chapter.chapter,
        indexes: [
          {
            resource: {
              kind: "commentary",
              ...identity,
              revision: metadata.revision
            },
            sections
          }
        ],
        unavailable: []
      });
      return {
        book: chapter.book,
        chapter: chapter.chapter,
        sections: rows.length,
        bytes: Buffer.byteLength(json),
        gzipBytes: gzipSync(json).length,
        lookupMs
      };
    });
    const sorted = [...payloads].sort((a, b) => a.bytes - b.bytes);
    const percentile = (fraction: number) =>
      sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
    return {
      resource: { ...identity, revision: metadata.revision },
      sourceSha256,
      sourceBytes,
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        note: "Desktop SQLite lookup timings; not device or network latency."
      },
      generationMs,
      baselineBytes,
      indexedBytes,
      addedBytes: indexedBytes - baselineBytes,
      chapters: payloads.length,
      sections: payloads.reduce((sum, chapter) => sum + chapter.sections, 0),
      totalIndexBytes: payloads.reduce(
        (sum, chapter) => sum + chapter.bytes,
        0
      ),
      median: percentile(0.5),
      p95: percentile(0.95),
      worst: sorted.slice(-10).reverse(),
      queryPlan: database
        .prepare(
          "EXPLAIN QUERY PLAN SELECT id, range_start_verse, range_end_verse, excerpt FROM COMMENTARY_READING_SECTIONS WHERE book=1 AND chapter=1"
        )
        .all()
    };
  } finally {
    database?.close();
    await rm(directory, { recursive: true, force: true });
    if ((await hashFile(input)) !== sourceSha256)
      throw new Error("SOURCE_CHANGED_DURING_MEASUREMENT");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      "Usage: measureCommentaryReadingIndex.ts <source.sqlite> <report.json>"
    );
  if (path.resolve(input) === path.resolve(output))
    throw new Error("REPORT_MUST_NOT_OVERWRITE_SOURCE");
  const report = await measureCommentaryReadingIndex(path.resolve(input));
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Reading index measurement saved to ${output}\n`);
}
