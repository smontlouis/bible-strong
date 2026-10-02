import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseStrongOccurrences } from "../../src/strongCsv.js";
import type { ConcordanceVerse } from "../strong-concordance-rebuild/concordanceHtml.js";
import { parseChapterForGold } from "../strong-concordance-rebuild/gold.js";
import { extendLocutions } from "./locutions.js";
import { annotatePositions } from "./positions.js";

const USAGE = `Usage (from apps/resource-studio):
  tsx scripts/concordance-witnesses/build.ts --exports <exports dir> --output-dir <new dir> [--pages <acquire-witness root>] [--witnesses Sg1910,Darby,DarbyR]`;

const HEADER = "book_id\tnum_chapter\tnum_verse\ttext";
const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const strip = (markup: string) => markup.replace(/<[^>]+>/gu, "");

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const sameMultiset = (left: string[], right: string[]) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

async function buildWitness(
  exportsDir: string,
  outputDir: string,
  name: string,
  pagesDir?: string
) {
  // Parsed chapter pages, read once per chapter when `--pages` is given.
  const chapters = new Map<string, Map<number, ConcordanceVerse> | null>();
  const pageVerse = async (book: string, chapter: string, verse: string) => {
    if (!pagesDir) return undefined;
    const key = `${book}.${chapter}`;
    if (!chapters.has(key)) {
      const file = path.join(pagesDir, "raw", name, `${key}.html`);
      chapters.set(
        key,
        existsSync(file)
          ? new Map(
              parseChapterForGold(await readFile(file, "utf8"), key).verses.map(
                (entry) => [entry.verse, entry]
              )
            )
          : null
      );
    }
    return chapters.get(key)?.get(Number(verse));
  };
  const csvPath = path.join(exportsDir, `${name}-csv`, `${name}.csv`);
  const osisPath = path.join(exportsDir, `${name}-osis`, `${name}.osis.xml`);
  const csv = await readFile(csvPath, "utf8");
  const osis = await readFile(osisPath, "utf8");
  const bodies = new Map<string, string>();
  for (const match of osis.matchAll(
    /<verse sID="([^"]+)"[^>]*\/>([\s\S]*?)<verse eID="\1"\/>/gu
  ))
    bodies.set(match[1]!, match[2]!);
  // The exports use CRLF line ends; the rebuilt file keeps them.
  const lines = csv.split("\r\n");
  if (lines[0] !== HEADER) throw new Error(`unexpected-header:${csvPath}`);
  const output = [HEADER];
  const report = {
    verses: 0,
    withoutOsis: [] as string[],
    mismatched: [] as Array<{ ref: string; reason: string }>,
    extendedLocutions: 0,
    headOnlyGroups: 0,
    withoutPage: 0,
    positionedWords: 0,
    unpositionedWords: 0
  };
  for (const line of lines.slice(1)) {
    if (line.length === 0) continue;
    const [book, chapter, verse, ...rest] = line.split("\t");
    const text = rest.join("\t");
    const ref = `${book}.${chapter}.${verse}`;
    report.verses += 1;
    const body = bodies.get(ref);
    const result =
      body === undefined
        ? { text, extended: 0, headOnly: 0, mismatch: undefined }
        : extendLocutions(text, body);
    if (body === undefined) report.withoutOsis.push(ref);
    if (result.mismatch)
      report.mismatched.push({ ref, reason: result.mismatch });
    const page = await pageVerse(book!, chapter!, verse!);
    if (pagesDir && !page) report.withoutPage += 1;
    if (page) {
      const positioned = annotatePositions(result.text, page);
      result.text = positioned.text;
      report.positionedWords += positioned.annotated;
      report.unpositionedWords += positioned.unmatched;
    }
    // Locutions and positions only move closing tags and add attributes:
    // the text and the Strong inventory are kept.
    if (
      strip(result.text) !== strip(text) ||
      !sameMultiset(
        parseStrongOccurrences(result.text),
        parseStrongOccurrences(text)
      ) ||
      (result.text.match(/<w\b/gu) ?? []).length !==
        (text.match(/<w\b/gu) ?? []).length
    )
      throw new Error(`locution-extension-changed-the-verse:${name}:${ref}`);
    report.extendedLocutions += result.extended;
    report.headOnlyGroups += result.headOnly;
    output.push(`${book}\t${chapter}\t${verse}\t${result.text}`);
  }
  const content = `${output.join("\r\n")}\r\n`;
  const target = path.join(outputDir, `${name}.csv`);
  await writeFile(target, content, { flag: "wx" });
  return {
    name,
    source: {
      csv: csvPath,
      csvSha256: sha256(csv),
      osis: osisPath,
      osisSha256: sha256(osis)
    },
    output: { path: target, sha256: sha256(content) },
    verses: report.verses,
    extendedLocutions: report.extendedLocutions,
    headOnlyGroups: report.headOnlyGroups,
    ...(pagesDir
      ? {
          pages: pagesDir,
          withoutPage: report.withoutPage,
          positionedWords: report.positionedWords,
          unpositionedWords: report.unpositionedWords
        }
      : {}),
    withoutOsis: report.withoutOsis,
    mismatched: report.mismatched
  };
}

async function main(args: string[]) {
  const exportsDir = flag(args, "--exports");
  const outputDir = flag(args, "--output-dir");
  if (!exportsDir || !outputDir) throw new Error(USAGE);
  if (existsSync(outputDir))
    throw new Error(`concordance-witnesses-output-exists:${outputDir}`);
  await mkdir(outputDir, { recursive: true });
  const witnesses = (flag(args, "--witnesses") ?? "Sg1910,Darby,DarbyR").split(
    ","
  );
  const results = [];
  const pagesDir = flag(args, "--pages");
  for (const name of witnesses)
    results.push(await buildWitness(exportsDir, outputDir, name, pagesDir));
  await writeFile(
    path.join(outputDir, "report.json"),
    `${JSON.stringify({ tool: "concordance-witnesses", exportsDir, witnesses: results }, null, 2)}\n`,
    { flag: "wx" }
  );
  for (const result of results)
    console.log(
      JSON.stringify({
        witness: result.name,
        verses: result.verses,
        extendedLocutions: result.extendedLocutions,
        headOnlyGroups: result.headOnlyGroups,
        ...(result.pages
          ? {
              withoutPage: result.withoutPage,
              positionedWords: result.positionedWords,
              unpositionedWords: result.unpositionedWords
            }
          : {}),
        withoutOsis: result.withoutOsis.length,
        mismatched: result.mismatched.length
      })
    );
}

await main(process.argv.slice(2));
