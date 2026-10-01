import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createDeterministicZip } from "./packageMobileResourceCatalog.js";
import { downloadR2Object, isR2Location } from "./r2ArtifactSources.js";
import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";

const execFileAsync = promisify(execFile);
const BASE_BUILDER_VERSION = "strong-bible-mobile-publication@2";
const SANITIZED_REVERSE_BUILDER_VERSION =
  "reverse-interlinear-mobile-sanitized@9";

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

/**
 * True when `next` is `previous` with spaces inserted and nothing else, as
 * when a projection restores separators the source had lost around notes.
 */
export function insertsOnlySpaces(previous: string, next: string): boolean {
  let index = 0;
  for (const character of next) {
    if (index < previous.length && character === previous[index]) index += 1;
    else if (character !== " ") return false;
  }
  return index === previous.length;
}

type SpanRow = {
  bookOrder: number;
  chapter: number;
  verse: number;
  ordinal: number;
  startOffset: number;
  length: number;
  openOrder: number;
  closeOrder: number;
};

const SPAN_QUERY = `SELECT v.bookOrder, v.chapter, v.verse, w.ordinal, w.startOffset, w.length,
  w.openOrder, w.closeOrder FROM WordSpans w JOIN Verses v ON v.id = w.verseId`;

const readMetadata = (database: DatabaseSync) =>
  Object.fromEntries(
    (
      database
        .prepare("SELECT key, value FROM ResourceMetadata")
        .all() as Array<{
        key: string;
        value: string;
      }>
    ).map((row) => [row.key, row.value])
  );

/**
 * Carries a released Strong sidecar (lexical refinement and reverse
 * interlinear included) to a corrected text that only gained spaces. Word
 * offsets and event orders come from an oracle sidecar compiled from the
 * corrected projection; every span must keep its length and its word, and
 * nothing else in the released sidecar changes besides its text identity.
 */
export function rebaseStrongSidecarOffsets(options: {
  sqlitePath: string;
  oracleSqlitePath: string;
  previousCanonical: CanonicalBiblePublication;
  canonical: CanonicalBiblePublication;
}): { rebasedSpanCount: number; previousTextRevision: string } {
  const verseText = (
    publication: CanonicalBiblePublication,
    row: Pick<SpanRow, "bookOrder" | "chapter" | "verse">
  ) => publication.verses[row.bookOrder]?.[row.chapter]?.[row.verse]?.text;

  for (const [book, chapters] of Object.entries(
    options.previousCanonical.verses
  )) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const [verse, value] of Object.entries(verses)) {
        const next = options.canonical.verses[book]?.[chapter]?.[verse]?.text;
        if (next === undefined || !insertsOnlySpaces(value.text, next)) {
          throw new Error(
            `strong-sidecar-rebase-text-not-space-only:${book}-${chapter}-${verse}`
          );
        }
      }
    }
  }

  const oracle = new DatabaseSync(options.oracleSqlitePath, { readOnly: true });
  const oracleSpans = new Map(
    (oracle.prepare(SPAN_QUERY).all() as SpanRow[]).map((row) => [
      `${row.bookOrder}-${row.chapter}-${row.verse}-${row.ordinal}`,
      row
    ])
  );
  const oracleMetadata = readMetadata(oracle);
  oracle.close();
  if (oracleMetadata.textSha256 !== options.canonical.textSha256) {
    throw new Error("strong-sidecar-rebase-oracle-text-mismatch");
  }

  const database = new DatabaseSync(options.sqlitePath);
  let inTransaction = false;
  try {
    const metadata = readMetadata(database);
    if (metadata.textSha256 !== options.previousCanonical.textSha256) {
      throw new Error("strong-sidecar-rebase-source-mismatch");
    }
    const spans = database.prepare(SPAN_QUERY).all() as SpanRow[];
    if (spans.length !== oracleSpans.size) {
      throw new Error(
        `strong-sidecar-rebase-span-count-mismatch:${spans.length}:${oracleSpans.size}`
      );
    }
    const update = database.prepare(
      `UPDATE WordSpans SET startOffset = ?, openOrder = ?, closeOrder = ?
       WHERE ordinal = ? AND verseId = (SELECT id FROM Verses WHERE bookOrder = ? AND chapter = ? AND verse = ?)`
    );
    database.exec("BEGIN");
    inTransaction = true;
    let rebasedSpanCount = 0;
    for (const span of spans) {
      const ref = `${span.bookOrder}-${span.chapter}-${span.verse}-${span.ordinal}`;
      const target = oracleSpans.get(ref);
      if (!target || target.length !== span.length) {
        throw new Error(`strong-sidecar-rebase-span-mismatch:${ref}`);
      }
      const previousWord = verseText(options.previousCanonical, span)?.slice(
        span.startOffset,
        span.startOffset + span.length
      );
      const nextWord = verseText(options.canonical, span)?.slice(
        target.startOffset,
        target.startOffset + target.length
      );
      if (previousWord === undefined || previousWord !== nextWord) {
        throw new Error(`strong-sidecar-rebase-word-changed:${ref}`);
      }
      if (
        target.startOffset === span.startOffset &&
        target.openOrder === span.openOrder &&
        target.closeOrder === span.closeOrder
      ) {
        continue;
      }
      update.run(
        target.startOffset,
        target.openOrder,
        target.closeOrder,
        span.ordinal,
        span.bookOrder,
        span.chapter,
        span.verse
      );
      rebasedSpanCount += 1;
    }

    const textSha256 = options.canonical.textSha256;
    const sourceSha256 = oracleMetadata.sourceSha256 ?? metadata.sourceSha256!;
    const baseStrongRevision = sha256(
      `${BASE_BUILDER_VERSION}\0${sourceSha256}\0${textSha256}`
    );
    const reverseBuilder = metadata.reverseInterlinearBuilderVersion;
    const strongRevision = !reverseBuilder
      ? baseStrongRevision
      : reverseBuilder === SANITIZED_REVERSE_BUILDER_VERSION
        ? sha256(`${metadata.strongRevision}\0${textSha256}`)
        : sha256(
            `${baseStrongRevision}\0${reverseBuilder}\0${metadata.reverseInterlinearStepRevision}\0${JSON.parse(metadata.reverseInterlinearCompatibleRuntimeSha256s ?? "[]").join(",")}\0${metadata.reverseInterlinearMetrics}`
          );
    const upsert = database.prepare(
      "INSERT INTO ResourceMetadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    const updates: Record<string, string> = {
      sourceSha256,
      textRevision: options.canonical.textRevision,
      textSha256,
      strongRevision,
      textRebasedFromTextRevision: metadata.textRevision!
    };
    if (metadata.baseStrongRevision)
      updates.baseStrongRevision = baseStrongRevision;
    for (const [key, value] of Object.entries(updates)) upsert.run(key, value);
    database.exec("COMMIT");
    inTransaction = false;
    return { rebasedSpanCount, previousTextRevision: metadata.textRevision! };
  } catch (error) {
    if (inTransaction) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

const fetchToFile = async (location: string, destination: string) => {
  if (isR2Location(location)) return downloadR2Object(location, destination);
  if (!/^https?:\/\//u.test(location))
    return copyFile(path.resolve(location), destination);
  const response = await fetch(location);
  if (!response.ok)
    throw new Error(`strong-sidecar-rebase-download-failed:${location}`);
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
};

const readCanonical = async (
  location: string,
  entry: string,
  workDir: string
) => {
  const filePath = path.join(
    workDir,
    `previous${path.extname(location.split("?")[0]!)}`
  );
  await fetchToFile(location, filePath);
  const raw = filePath.endsWith(".zip")
    ? (
        await execFileAsync("unzip", ["-p", filePath, entry], {
          maxBuffer: 256 * 1024 * 1024
        })
      ).stdout
    : await readFile(filePath, "utf8");
  return JSON.parse(raw) as CanonicalBiblePublication;
};

/**
 * CLI: `--sidecar <zip> --entry <sqlite entry> --previous-canonical <zip|json>
 * --canonical-entry <json entry> --canonical <json> --oracle <sqlite>
 * --output <zip>`. Sources may be local paths, https or r2:// locations.
 */
async function main(argv: readonly string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2)
    args.set(argv[index]!, argv[index + 1]!);
  const required = (key: string) => {
    const value = args.get(key);
    if (!value)
      throw new Error(`strong-sidecar-rebase-argument-missing:${key}`);
    return value;
  };
  const output = path.resolve(required("--output"));
  if (existsSync(output))
    throw new Error(`strong-sidecar-rebase-output-exists:${output}`);
  const workDir = await mkdtemp(path.join(tmpdir(), "strong-sidecar-rebase-"));
  try {
    const entry = required("--entry");
    const sidecarLocation = required("--sidecar");
    const sidecarArchive = path.join(workDir, "sidecar.zip");
    await fetchToFile(sidecarLocation, sidecarArchive);
    await execFileAsync("unzip", ["-qq", sidecarArchive, entry, "-d", workDir]);
    const sqlitePath = path.join(workDir, entry);
    const previousCanonical = await readCanonical(
      required("--previous-canonical"),
      required("--canonical-entry"),
      workDir
    );
    const canonical = JSON.parse(
      await readFile(path.resolve(required("--canonical")), "utf8")
    ) as CanonicalBiblePublication;
    const result = rebaseStrongSidecarOffsets({
      sqlitePath,
      oracleSqlitePath: path.resolve(required("--oracle")),
      previousCanonical,
      canonical
    });
    const integrity = await execFileAsync("sqlite3", [
      sqlitePath,
      "PRAGMA integrity_check"
    ]);
    if (integrity.stdout.trim() !== "ok")
      throw new Error("strong-sidecar-rebase-integrity-failed");
    await mkdir(path.dirname(output), { recursive: true });
    await createDeterministicZip({
      inputs: [{ inputPath: sqlitePath, entryName: entry }],
      archivePath: output,
      stagingRoot: path.join(workDir, "zip")
    });
    console.log(
      JSON.stringify(
        {
          output,
          sha256: sha256(await readFile(output)),
          previousTextRevision: result.previousTextRevision,
          textRevision: canonical.textRevision,
          rebasedSpanCount: result.rebasedSpanCount
        },
        null,
        2
      )
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
