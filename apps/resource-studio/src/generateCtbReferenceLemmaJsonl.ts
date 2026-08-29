import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CTB_REFERENCE_LEMMA_VERSION,
  enrichReferenceJsonlWithCtbLemmas
} from "./ctbReferenceLemmas.js";

const REFERENCES = [
  { id: "darby", siteVersion: "Darby", version: "DARBY" },
  { id: "darbyr", siteVersion: "DarbyR", version: "DARBYR" },
  { id: "sg1910", siteVersion: "Sg1910", version: "SG1910" }
] as const;

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const selected =
    options.references.length === 0
      ? REFERENCES
      : REFERENCES.filter(({ id }) => options.references.includes(id));
  if (selected.length === 0) {
    throw new Error(
      `No matching references. Available: ${REFERENCES.map(({ id }) => id).join(", ")}`
    );
  }
  await mkdir(options.outputDir, { recursive: true });
  await mkdir(options.cacheDir, { recursive: true });
  const artifacts = [];
  for (const [referenceIndex, reference] of selected.entries()) {
    const result = await enrichReferenceJsonlWithCtbLemmas({
      baseUrl: options.baseUrl,
      cachePath: path.join(options.cacheDir, `${reference.id}.jsonl`),
      concurrency: options.concurrency,
      fallbackCachePaths: selected
        .slice(0, referenceIndex)
        .map(({ id }) => path.join(options.cacheDir, `${id}.jsonl`)),
      inputPath: path.join(
        options.inputDir,
        `bible-${reference.id}-strong.jsonl`
      ),
      onlyBooks: options.onlyBooks,
      outputPath: path.join(
        options.outputDir,
        `bible-${reference.id}-strong.jsonl`
      ),
      siteVersion: reference.siteVersion
    });
    if (result.version !== reference.version) {
      throw new Error(
        `ctb-lemma-version-mismatch:${reference.id}:${result.version}:${reference.version}`
      );
    }
    artifacts.push({
      file: path.basename(result.outputPath),
      sha256: result.artifactSha256,
      sizeBytes: result.sizeBytes,
      sourceSha256: result.sourceSha256,
      cacheFile: path.relative(options.outputDir, result.cachePath),
      cacheSha256: result.cacheSha256,
      chapterCount: result.chapterCount,
      verseCount: result.verseCount,
      strongTagCount: result.strongTagCount,
      lexemeAssignmentCount: result.lexemeAssignmentCount,
      strongAlignmentMismatchCount: result.strongAlignmentMismatchCount,
      visibleImplicitCorrectionCount: result.visibleImplicitCorrectionCount,
      version: result.version
    });
    process.stdout.write(
      `Enriched ${reference.id}: ${result.lexemeAssignmentCount} lemmas ` +
        `on ${result.strongTagCount} Strong tags in ${result.verseCount} verses\n`
    );
  }
  await writeFile(
    path.join(options.outputDir, "manifest.json"),
    `${JSON.stringify(
      {
        format: "ctb-reference-lemma-jsonl",
        version: CTB_REFERENCE_LEMMA_VERSION,
        source: options.baseUrl,
        attributes: ["lemma", "pos"],
        scope:
          options.onlyBooks.length > 0 ? options.onlyBooks : "complete-bible",
        artifacts
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function parseCliOptions(argv: string[]): {
  baseUrl: string;
  cacheDir: string;
  concurrency: number;
  inputDir: string;
  onlyBooks: string[];
  outputDir: string;
  references: string[];
} {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith("--")) continue;
    const [key, inlineValue] = argument.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }
  return {
    baseUrl: args.get("base-url") ?? "https://concordance.bible",
    cacheDir: args.get("cache-dir") ?? "outputs/cache/ctb-reference-lemmas",
    concurrency: Number(args.get("concurrency") ?? 4),
    inputDir: args.get("input-dir") ?? "outputs/strong-references-jsonl",
    onlyBooks: splitCsv(args.get("only")),
    outputDir:
      args.get("output-dir") ?? "outputs/strong-references-jsonl-lemmas",
    references: splitCsv(args.get("references")).map((value) =>
      value.toLowerCase()
    )
  };
}

function splitCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

await main();
