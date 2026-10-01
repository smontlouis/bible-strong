import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCanonicalBibleFromLegacy } from "../../src/legacyBiblePublication.js";
import {
  applyWordsOfJesus,
  hashVerseText,
  parseVerseRef,
  parseWordsOfJesusDataset,
  serializeWordsOfJesusDataset,
  type WordsOfJesusDataset
} from "../../src/wordsOfJesus.js";
import {
  LINE_BREAK,
  findLostLineBreaks,
  mapSpanAcrossLineBreaks,
  restoreLineBreaks,
  type LostLineBreak,
  type UnrepairedJoin
} from "./lineBreaks.js";

const USAGE = `Usage (from apps/resource-studio):
  tsx scripts/neg79-line-breaks/run.ts --output-dir <new dir> [--source data/bibles/bible-neg79.json] [--words-of-jesus workflows/words-of-jesus/data/neg79.jsonl]`;

type LegacyBible = Record<string, Record<string, Record<string, string>>>;

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const contextOf = (text: string, offset: number) =>
  `…${text.slice(Math.max(0, offset - 30), offset)}⏎${text.slice(offset, offset + 30)}…`.replaceAll(
    "\n",
    "⏎"
  );

async function main(args: string[]) {
  const outputDir = flag(args, "--output-dir");
  if (!outputDir) throw new Error(USAGE);
  if (existsSync(outputDir))
    throw new Error(`neg79-line-breaks-output-exists:${outputDir}`);
  const sourcePath = flag(args, "--source") ?? "data/bibles/bible-neg79.json";
  const datasetPath =
    flag(args, "--words-of-jesus") ??
    "workflows/words-of-jesus/data/neg79.jsonl";
  const raw = await readFile(sourcePath, "utf8");
  const source = JSON.parse(raw) as LegacyBible;
  // The repaired file must differ from the source only by the separators.
  if (JSON.stringify(source) !== raw)
    throw new Error("neg79-line-breaks-source-not-compact-json");

  const repaired = structuredClone(source);
  const breaksByRef = new Map<string, LostLineBreak[]>();
  const unrepaired: Array<UnrepairedJoin & { ref: string }> = [];
  const review: string[] = [];
  const byRule: Record<string, number> = {};
  const byBook: Record<string, number> = {};
  let verseCount = 0;
  for (const [book, chapters] of Object.entries(source))
    for (const [chapter, verses] of Object.entries(chapters))
      for (const [verse, text] of Object.entries(verses)) {
        verseCount += 1;
        const ref = `${book}-${chapter}-${verse}`;
        const found = findLostLineBreaks(text);
        unrepaired.push(...found.unrepaired.map((join) => ({ ref, ...join })));
        for (const join of found.unrepaired)
          review.push(
            `- ${ref} (non réparé, ${join.reason}) ${contextOf(text, join.offset)}`
          );
        if (found.breaks.length === 0) continue;
        breaksByRef.set(ref, found.breaks);
        repaired[book]![chapter]![verse] = restoreLineBreaks(
          text,
          found.breaks
        );
        for (const entry of found.breaks) {
          byRule[entry.rule] = (byRule[entry.rule] ?? 0) + 1;
          byBook[book] = (byBook[book] ?? 0) + 1;
          review.push(
            `- ${ref} (${entry.rule}) ${contextOf(text, entry.offset)}`
          );
        }
      }

  // Removing every inserted separator gives the source back, verse by verse.
  for (const [ref, breaks] of breaksByRef) {
    const { book, chapter, verse } = parseVerseRef(ref);
    let text = repaired[book]![chapter]![verse]!;
    for (const [index, { offset }] of breaks.entries()) {
      const at = offset + index * LINE_BREAK.length;
      if (text.slice(at, at + LINE_BREAK.length) !== LINE_BREAK)
        throw new Error(`neg79-line-breaks-separator-missing:${ref}`);
    }
    for (const [index, { offset }] of [...breaks.entries()].reverse()) {
      const at = offset + index * LINE_BREAK.length;
      text = text.slice(0, at) + text.slice(at + LINE_BREAK.length);
    }
    if (text !== source[book]![chapter]![verse])
      throw new Error(`neg79-line-breaks-round-trip:${ref}`);
  }

  // Words of Jesus are anchored on the verse text: move the spans of every
  // decision whose verse changed and hash the restored text.
  const datasetSource = await readFile(datasetPath, "utf8");
  const dataset = parseWordsOfJesusDataset(datasetSource);
  let reanchored = 0;
  let reanchoredWithSpans = 0;
  const reanchoredDataset: WordsOfJesusDataset = {
    ...dataset,
    verses: dataset.verses.map((decision) => {
      const breaks = breaksByRef.get(decision.ref);
      if (!breaks) return decision;
      const { book, chapter, verse } = parseVerseRef(decision.ref);
      const before = source[book]![chapter]![verse]!;
      const after = repaired[book]![chapter]![verse]!;
      if (hashVerseText(before) !== decision.verseSha256)
        throw new Error(
          `neg79-line-breaks-dataset-not-on-source:${decision.ref}`
        );
      const spans = decision.spans.map((span) =>
        mapSpanAcrossLineBreaks(span, breaks)
      );
      spans.forEach(([start, end], index) => {
        const [oldStart, oldEnd] = decision.spans[index]!;
        if (
          after.slice(start, end).replaceAll(LINE_BREAK, "") !==
          before.slice(oldStart, oldEnd)
        )
          throw new Error(
            `neg79-line-breaks-span-text-changed:${decision.ref}`
          );
      });
      reanchored += 1;
      if (spans.length > 0) reanchoredWithSpans += 1;
      return { ...decision, verseSha256: hashVerseText(after), spans };
    })
  };
  const canonical = (bible: LegacyBible, location: string) =>
    buildCanonicalBibleFromLegacy({
      versionId: dataset.versionId,
      sourceVersion: location,
      sourceSha256: sha256(JSON.stringify(bible)),
      bible
    });
  const applyBefore = applyWordsOfJesus(canonical(source, sourcePath), dataset);
  const repairedJson = JSON.stringify(repaired);
  const repairedPath = path.join(outputDir, path.basename(sourcePath));
  const applyAfter = applyWordsOfJesus(
    canonical(repaired, repairedPath),
    reanchoredDataset
  );
  if (
    applyBefore.verseCount !== applyAfter.verseCount ||
    applyBefore.spanCount !== applyAfter.spanCount
  )
    throw new Error("neg79-line-breaks-words-of-jesus-count-changed");

  await mkdir(outputDir, { recursive: true });
  await writeFile(repairedPath, repairedJson, { flag: "wx" });
  const datasetOutput = path.join(outputDir, path.basename(datasetPath));
  const reanchoredSource = serializeWordsOfJesusDataset(reanchoredDataset);
  await writeFile(datasetOutput, reanchoredSource, { flag: "wx" });
  await writeFile(
    path.join(outputDir, "source-overrides.json"),
    `${JSON.stringify({ [`bible:${dataset.versionId}`]: { canonical: repairedPath } }, null, 2)}\n`,
    { flag: "wx" }
  );
  await writeFile(
    path.join(outputDir, "words-of-jesus-text-overrides.json"),
    `${JSON.stringify({ [dataset.versionId]: repairedPath }, null, 2)}\n`,
    { flag: "wx" }
  );
  const breakCount = Object.values(byRule).reduce((sum, n) => sum + n, 0);
  const report = {
    tool: "neg79-line-breaks",
    separator: LINE_BREAK,
    source: { path: sourcePath, sha256: sha256(raw), verses: verseCount },
    output: { path: repairedPath, sha256: sha256(repairedJson) },
    repairedVerses: breaksByRef.size,
    lineBreaks: { total: breakCount, byRule, byBook },
    unrepaired: {
      total: unrepaired.length,
      byReason: unrepaired.reduce<Record<string, number>>((counts, join) => {
        counts[join.reason] = (counts[join.reason] ?? 0) + 1;
        return counts;
      }, {}),
      joins: unrepaired
    },
    wordsOfJesus: {
      dataset: datasetPath,
      sha256Before: sha256(datasetSource),
      sha256After: sha256(reanchoredSource),
      output: datasetOutput,
      decisions: dataset.verses.length,
      reanchored,
      reanchoredWithSpans,
      applied: {
        verses: applyAfter.verseCount,
        spans: applyAfter.spanCount
      }
    },
    validation: {
      compactJsonRoundTrip: true,
      separatorRemovalGivesSource: true,
      wordsOfJesusTextPreserved: true
    }
  };
  await writeFile(
    path.join(outputDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    { flag: "wx" }
  );
  await writeFile(
    path.join(outputDir, "review.md"),
    `# Sauts de ligne rétablis dans NEG79 (relecture locale)\n\n⏎ marque la position du séparateur inséré.\n\n${review.join("\n")}\n`,
    { flag: "wx" }
  );
  console.log(
    JSON.stringify({
      outputDir,
      repairedVerses: report.repairedVerses,
      lineBreaks: report.lineBreaks.total,
      byRule,
      unrepaired: report.unrepaired.byReason,
      wordsOfJesus: { reanchored, reanchoredWithSpans }
    })
  );
}

await main(process.argv.slice(2));
