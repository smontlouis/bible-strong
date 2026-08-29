import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readBibleJson } from "./bibleJson.js";
import { BOOK_IDS } from "./books.js";
import { readStrongCsv } from "./strongCsv.js";
import {
  detectVerseCorrespondence,
  validateVerseCorrespondenceManifest,
  VERSE_CORRESPONDENCE_DETECTOR_VERSION,
  VERSE_CORRESPONDENCE_MANIFEST_VERSION,
  type VerseCorrespondenceAlternative,
  type VerseCorrespondenceBlock,
  type VerseCorrespondenceManifest
} from "./verseCorrespondence.js";

interface CliOptions {
  bible: string;
  input: string;
  output: string;
  report: string;
  minimumBlockScore: number;
  ambiguityMargin: number;
}

const WITNESSES = [
  { name: "Sg1910", path: "data/strongs/Sg1910.csv" },
  { name: "Darby", path: "data/strongs/Darby.csv" },
  { name: "DarbyR", path: "data/strongs/DarbyR.csv" }
] as const;

export async function generateVerseCorrespondenceManifest(
  options: CliOptions
): Promise<{
  status: "accepted" | "blocked";
  reportPath: string;
  outputPath?: string;
  sha256?: string;
}> {
  const target = await readBibleJson(options.input);
  const witnessRows = await Promise.all(
    WITNESSES.map(async (witness) => ({
      ...witness,
      rows: await readStrongCsv(witness.path)
    }))
  );
  const targetBooks = new Set(target.map((verse) => verse.bookId));
  const books = BOOK_IDS.filter((bookId) => targetBooks.has(bookId));
  const accepted: Array<{
    bookId: string;
    score: number;
    margin: number;
    blocks: VerseCorrespondenceManifest["blocks"];
    resolution:
      | "detector-accepted"
      | "detector-best-structural-high"
      | "conservative-top2-intersection"
      | "detector-chapter-partitioned";
  }> = [];
  const blocked: Array<{
    bookId: string;
    status: "ambiguous" | "unresolved";
    score: number;
    margin: number;
    issues: string[];
    alternatives: unknown;
    scope?: string;
    conservativeIssue?: string;
  }> = [];

  for (const bookId of books) {
    console.error(`Detecting ${bookId}...`);
    const targetVerses = target
      .filter((verse) => verse.bookId === bookId)
      .map((verse) => ({ ref: formatRef(verse), text: verse.text }));
    const witnesses = witnessRows.map((witness) => ({
      name: witness.name,
      verses: witness.rows
        .filter((row) => row.bookId === bookId)
        .map((row) => ({
          ref: `${row.bookId}.${row.chapter}.${row.verse}`,
          text: row.text
        }))
    }));
    // Psalms have stable psalm boundaries but can accumulate many verse-number
    // differences inside them (especially numbered superscriptions). Detecting
    // each Psalm avoids a huge, artificial book-wide drift window. Do not apply
    // this to Job: FMAR moves material across the Job 40–41 boundary.
    const chapterPartitioned = bookId === "Ps";
    const scopeKeys: Array<number | undefined> = chapterPartitioned
      ? [...new Set(targetVerses.map((verse) => refChapter(verse.ref)))]
      : [undefined];
    const bookBlocks: VerseCorrespondenceBlock[] = [];
    const bookResolutions: Array<
      | "detector-accepted"
      | "detector-best-structural-high"
      | "conservative-top2-intersection"
    > = [];
    let weightedScore = 0;
    let totalWeight = 0;
    let minimumMargin = 1;
    let bookFailed = false;
    // Historical Martin compresses several Job boundaries and paraphrases
    // Job 40.24 more heavily than the three modern French witnesses. A
    // slightly stronger structural penalty recovers the narrow 1:1 shifts;
    // the lower gate admits the verified Job.40.19 -> Job.40.24 shift (0.243)
    // without changing the default threshold for any other book.
    const scopeMinimumBlockScore =
      bookId === "Job" ? Math.min(options.minimumBlockScore, 0.24) : options.minimumBlockScore;
    const structuralPenalty = bookId === "Job" ? 0.35 : 0.3;

    for (const scopeChapter of scopeKeys) {
      const scopedTargets =
        scopeChapter === undefined
          ? targetVerses
          : targetVerses.filter(
              (verse) => refChapter(verse.ref) === scopeChapter
            );
      const scopedWitnesses = witnesses.map((witness) => ({
        ...witness,
        verses:
          scopeChapter === undefined
            ? witness.verses
            : witness.verses.filter(
                (verse) => refChapter(verse.ref) === scopeChapter
              )
      }));
      const result = detectVerseCorrespondence(
        {
          bible: options.bible,
          canonicalVersification: "French Strong references / STEP OSIS",
          targetVerses: scopedTargets,
          canonicalWitnesses: scopedWitnesses
        },
        {
          minimumBlockScore: scopeMinimumBlockScore,
          ambiguityMargin: options.ambiguityMargin,
          structuralPenalty,
          // FMAR Job 39.30 concatenates the end of canonical Job 39 with the
          // opening dialogue of Job 40 (nine canonical verses in one target
          // verse). Keep the broader transition local to this known book.
          maxCanonicalSpan: bookId === "Job" ? 10 : 3,
          // STEP/French numbering can differ by more than four verse slots
          // across chapter boundaries (notably Nehemiah 3–4). Derive the
          // necessary window from shared coordinates so identity scopes keep
          // the smaller/faster search while shifted scopes cannot compensate
          // with false N:M blocks.
          maxIndexDrift: detectorMaxIndexDrift(
            scopedTargets.map((verse) => verse.ref),
            scopedWitnesses[0]!.verses.map((verse) => verse.ref)
          )
        }
      );
      const weight = Math.max(1, scopedTargets.length);
      weightedScore += result.score * weight;
      totalWeight += weight;
      minimumMargin = Math.min(minimumMargin, result.margin);
      if (result.status === "accepted") {
        bookBlocks.push(
          ...calibrateDetectedBookBlocks({
            bible: options.bible,
            bookId,
            blocks: result.manifest.blocks
          })
        );
        bookResolutions.push("detector-accepted");
        continue;
      }

      const blockedBook = {
        bookId,
        status: result.status,
        score: result.score,
        margin: result.margin,
        issues: result.issues,
        alternatives: result.alternatives.slice(0, 2) as unknown,
        scope:
          scopeChapter === undefined
            ? undefined
            : `${bookId}.${scopeChapter}`,
        conservativeIssue: undefined as string | undefined
      };
      try {
        const best = result.alternatives[0];
        const allStructuralBlocksAreHigh =
          best !== undefined &&
          best.blocks.every(
            (block) =>
              block.kind === "identity" ||
              block.kind === "omitted" ||
              block.kind === "added" ||
              (block.evidence?.score ?? 0) >= scopeMinimumBlockScore
          );
        const resolvedBlocks = allStructuralBlocksAreHigh
            ? best.blocks.map((block) =>
                block.kind === "identity"
                  ? block
                  : {
                      ...block,
                      reason: [block.reason, "detector-best-structural-high"]
                        .filter(Boolean)
                        .join("; ")
                    }
              )
            : conservativeTopPathIntersection({
                targetRefs: scopedTargets.map((verse) => verse.ref),
                canonicalRefs: scopedWitnesses[0]!.verses.map(
                  (verse) => verse.ref
                ),
                alternatives: result.alternatives,
                minimumBlockScore: scopeMinimumBlockScore
              });
        bookBlocks.push(
          ...calibrateDetectedBookBlocks({
            bible: options.bible,
            bookId,
            blocks: resolvedBlocks
          })
        );
        bookResolutions.push(
          allStructuralBlocksAreHigh
            ? "detector-best-structural-high"
            : "conservative-top2-intersection"
        );
      } catch (error) {
        blockedBook.conservativeIssue =
          error instanceof Error ? error.message : String(error);
        bookFailed = true;
      }
      blocked.push(blockedBook);
    }

    if (!bookFailed) {
      const resolution = chapterPartitioned
        ? "detector-chapter-partitioned"
        : (bookResolutions[0] ?? "detector-accepted");
      accepted.push({
        bookId,
        score: weightedScore / Math.max(1, totalWeight),
        margin: minimumMargin,
        blocks: bookBlocks,
        resolution
      });
    }
  }

  const report = {
    schemaVersion: 1,
    bible: options.bible,
    input: options.input,
    detector: VERSE_CORRESPONDENCE_DETECTOR_VERSION,
    settings: {
      minimumBlockScore: options.minimumBlockScore,
      ambiguityMargin: options.ambiguityMargin,
      bookOverrides: {
        Job: {
          minimumBlockScore: 0.24,
          structuralPenalty: 0.35,
          maxCanonicalSpan: 10,
          calibration: "fmar-job-boundaries-v1"
        },
        Ps: {
          partition: "chapter"
        }
      }
    },
    acceptedBooks: accepted.map(
      ({ bookId, score, margin, blocks, resolution }) => ({
        bookId,
        score,
        margin,
        resolution,
        blockCount: blocks.length,
        nonIdentityBlockCount: blocks.filter(
          (block) => block.kind !== "identity"
        ).length
      })
    ),
    blockedBooks: blocked
  };
  await mkdir(path.dirname(options.report), { recursive: true });
  await writeFile(
    options.report,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  if (accepted.length !== books.length) {
    return { status: "blocked", reportPath: options.report };
  }

  const manifest: VerseCorrespondenceManifest = {
    schemaVersion: VERSE_CORRESPONDENCE_MANIFEST_VERSION,
    bible: options.bible,
    canonicalVersification: "French Strong references / STEP OSIS",
    blocks: accepted.flatMap((book) => book.blocks),
    detection: {
      detector: VERSE_CORRESPONDENCE_DETECTOR_VERSION,
      witnesses: WITNESSES.map((witness) => witness.name),
      score:
        accepted.reduce((sum, book) => sum + book.score, 0) /
        Math.max(1, accepted.length),
      margin: Math.min(...accepted.map((book) => book.margin))
    }
  };
  const primaryCanonical = witnessRows[0].rows
    .filter((row) => targetBooks.has(row.bookId))
    .map((row) => `${row.bookId}.${row.chapter}.${row.verse}`);
  validateVerseCorrespondenceManifest(manifest, {
    targetRefs: target.map(formatRef),
    canonicalRefs: primaryCanonical
  });
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  const sha256 = createHash("sha256").update(content).digest("hex");
  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, content, "utf8");
  await writeFile(
    options.report,
    `${JSON.stringify(
      {
        ...report,
        status: "accepted",
        manifest: {
          path: options.output,
          sha256,
          blockCount: manifest.blocks.length,
          nonIdentityBlockCount: manifest.blocks.filter(
            (block) => block.kind !== "identity"
          ).length
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return {
    status: "accepted",
    reportPath: options.report,
    outputPath: options.output,
    sha256
  };
}

export function detectorMaxIndexDrift(
  targetRefs: readonly string[],
  canonicalRefs: readonly string[]
): number {
  const canonicalIndex = new Map(
    canonicalRefs.map((ref, index) => [ref, index])
  );
  // A trailing added/omitted run has no later shared coordinate from which to
  // infer its drift, so the scope-length delta must participate explicitly.
  let observed = Math.abs(targetRefs.length - canonicalRefs.length);
  for (const [targetIndex, ref] of targetRefs.entries()) {
    const referenceIndex = canonicalIndex.get(ref);
    if (referenceIndex === undefined) continue;
    observed = Math.max(observed, Math.abs(targetIndex - referenceIndex));
  }
  // Psalms can accumulate dozens of index positions when one versification
  // numbers superscriptions and the other folds or omits them. Keep a bounded
  // search window, but make it wide enough for that legitimate book-wide
  // drift (FMAR versus Sg1910 reaches 66 positions).
  return Math.min(96, Math.max(4, observed + 3));
}

function conservativeTopPathIntersection(options: {
  targetRefs: string[];
  canonicalRefs: string[];
  alternatives: VerseCorrespondenceAlternative[];
  minimumBlockScore: number;
}): VerseCorrespondenceBlock[] {
  const [best, runnerUp] = options.alternatives;
  if (!best || !runnerUp) {
    throw new Error("fewer-than-two-alignment-paths");
  }
  const runnerSignatures = new Set(runnerUp.blocks.map(blockSignature));
  const stable = best.blocks.filter(
    (block) =>
      block.kind !== "identity" &&
      (block.kind === "omitted" ||
        block.kind === "added" ||
        (block.evidence?.score ?? 0) >= options.minimumBlockScore) &&
      runnerSignatures.has(blockSignature(block))
  );
  const stableByCoordinate = new Map<string, VerseCorrespondenceBlock>();
  for (const block of stable) {
    stableByCoordinate.set(blockCoordinate(block), {
      ...block,
      reason: [block.reason, "conservative-top2-intersection"]
        .filter(Boolean)
        .join("; ")
    });
  }

  const blocks: VerseCorrespondenceBlock[] = [];
  const targetSet = new Set(options.targetRefs);
  const canonicalSet = new Set(options.canonicalRefs);
  let targetIndex = 0;
  let canonicalIndex = 0;
  while (
    targetIndex < options.targetRefs.length ||
    canonicalIndex < options.canonicalRefs.length
  ) {
    const targetRef = options.targetRefs[targetIndex];
    const canonicalRef = options.canonicalRefs[canonicalIndex];
    const stableBlock = stableByCoordinate.get(
      `${targetRef ?? ""}|${canonicalRef ?? ""}`
    );
    if (stableBlock) {
      blocks.push(stableBlock);
      targetIndex += stableBlock.targetRefs.length;
      canonicalIndex += stableBlock.canonicalRefs.length;
      continue;
    }
    if (targetRef && canonicalRef && targetRef === canonicalRef) {
      blocks.push({
        kind: "identity",
        targetRefs: [targetRef],
        canonicalRefs: [canonicalRef]
      });
      targetIndex += 1;
      canonicalIndex += 1;
      continue;
    }
    if (canonicalRef && !targetSet.has(canonicalRef)) {
      blocks.push({
        kind: "omitted",
        targetRefs: [],
        canonicalRefs: [canonicalRef],
        reason: "Canonical verse absent from the target reference set."
      });
      canonicalIndex += 1;
      continue;
    }
    if (targetRef && !canonicalSet.has(targetRef)) {
      blocks.push({
        kind: "added",
        targetRefs: [targetRef],
        canonicalRefs: [],
        reason: "Target verse absent from the canonical reference set."
      });
      targetIndex += 1;
      continue;
    }
    throw new Error(
      `unresolved-coordinate:${targetRef ?? "end"}:${canonicalRef ?? "end"}`
    );
  }
  return blocks;
}

function blockSignature(block: VerseCorrespondenceBlock): string {
  return `${block.kind}:${block.targetRefs.join(",")}=${block.canonicalRefs.join(",")}`;
}

function blockCoordinate(block: VerseCorrespondenceBlock): string {
  return `${block.targetRefs[0] ?? ""}|${block.canonicalRefs[0] ?? ""}`;
}

export function calibrateDetectedBookBlocks(options: {
  bible: string;
  bookId: string;
  blocks: VerseCorrespondenceBlock[];
}): VerseCorrespondenceBlock[] {
  if (options.bible !== "fmar" || options.bookId !== "Job") {
    return options.blocks;
  }
  let calibrated = replaceExactBlockSequence(
    options.blocks,
    [
      {
        kind: "chapter-boundary",
        targetRefs: ["Job.39.29", "Job.39.30"],
        canonicalRefs: [
          "Job.39.26",
          "Job.39.27",
          "Job.39.28",
          "Job.39.29",
          "Job.39.30",
          "Job.40.1",
          "Job.40.2",
          "Job.40.3",
          "Job.40.4",
          "Job.40.5"
        ]
      }
    ],
    [
      calibratedBlock("shift", ["Job.39.29"], ["Job.39.26"]),
      calibratedBlock(
        "chapter-boundary",
        ["Job.39.30"],
        [
          "Job.39.27",
          "Job.39.28",
          "Job.39.29",
          "Job.39.30",
          "Job.40.1",
          "Job.40.2",
          "Job.40.3",
          "Job.40.4",
          "Job.40.5"
        ]
      )
    ],
    "fmar-job-39-boundary"
  );
  calibrated = replaceExactBlockSequence(
    calibrated,
    [
      {
        kind: "split",
        targetRefs: ["Job.40.18", "Job.40.19"],
        canonicalRefs: ["Job.40.23"]
      },
      {
        kind: "merge",
        targetRefs: ["Job.40.20"],
        canonicalRefs: ["Job.40.24", "Job.40.25"]
      }
    ],
    [
      calibratedBlock("shift", ["Job.40.18"], ["Job.40.23"]),
      calibratedBlock("shift", ["Job.40.19"], ["Job.40.24"]),
      calibratedBlock("shift", ["Job.40.20"], ["Job.40.25"])
    ],
    "fmar-job-40-carriers"
  );
  return calibrated;
}

function replaceExactBlockSequence(
  blocks: VerseCorrespondenceBlock[],
  expected: VerseCorrespondenceBlock[],
  replacement: VerseCorrespondenceBlock[],
  label: string
): VerseCorrespondenceBlock[] {
  const expectedSignatures = expected.map(blockSignature);
  const start = blocks.findIndex((_, index) =>
    expectedSignatures.every(
      (signature, offset) =>
        blocks[index + offset] !== undefined &&
        blockSignature(blocks[index + offset]!) === signature
    )
  );
  if (start < 0) throw new Error(`missing-known-calibration-sequence:${label}`);
  return [
    ...blocks.slice(0, start),
    ...replacement,
    ...blocks.slice(start + expected.length)
  ];
}

function calibratedBlock(
  kind: VerseCorrespondenceBlock["kind"],
  targetRefs: string[],
  canonicalRefs: string[]
): VerseCorrespondenceBlock {
  return {
    kind,
    targetRefs,
    canonicalRefs,
    reason: "fmar-job-boundaries-v1-text-verified"
  };
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) {
      args.set(arg.slice(2), value);
      index += 1;
    }
  }
  const bible = args.get("bible") ?? "nvs78p";
  return {
    bible,
    input: args.get("input") ?? `data/bibles/bible-${bible}.json`,
    output:
      args.get("output") ??
      `outputs/verse-correspondence/${bible}/bible-${bible}-verse-correspondence.json`,
    report:
      args.get("report") ??
      `outputs/verse-correspondence/${bible}/detection-report.json`,
    minimumBlockScore: parseNumber(args.get("minimum-block-score"), 0.34),
    ambiguityMargin: parseNumber(args.get("ambiguity-margin"), 0.06)
  };
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error(`invalid-number:${value}`);
  return parsed;
}

function formatRef(verse: {
  bookId: string;
  chapter: number;
  verse: number;
}): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}

function refChapter(ref: string): number {
  const chapter = Number.parseInt(ref.split(".")[1] ?? "", 10);
  if (!Number.isSafeInteger(chapter) || chapter < 1) {
    throw new Error(`invalid-reference-chapter:${ref}`);
  }
  return chapter;
}

if (
  process.argv.some((arg) =>
    arg.replaceAll("\\", "/").endsWith("src/generateVerseCorrespondence.ts")
  )
) {
  generateVerseCorrespondenceManifest(parseArgs(process.argv))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.status === "blocked") process.exitCode = 2;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
