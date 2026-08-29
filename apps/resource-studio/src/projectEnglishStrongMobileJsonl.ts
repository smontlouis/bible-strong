import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type {
  StrongBibleJsonlHeading,
  StrongBibleJsonlVerse
} from "./strongBibleSqlite.js";
import { enrichEnglishStrongMarkup } from "./englishStrongLemmas.js";

interface EnglishStrongSourceCatalog {
  format: "bible-strong-sword-source-catalog";
  schemaVersion: 1;
  sources: EnglishStrongSource[];
}

export interface EnglishStrongSource {
  id: string;
  applicationVersionId: string;
  datasetId: string;
  moduleName: string;
}

interface RichSourceHeading {
  order: number;
  type: string;
  subType?: string;
  isPericope: boolean;
  text: string;
  sourceMarkup: string;
}

interface RichSourceVerse {
  format: "bible-strong-rich-source-jsonl";
  schemaVersion: 1;
  ref: string;
  version: string;
  applicationVersionId: string;
  datasetId: string;
  canon: "protestant-66" | "supplemental";
  book: number;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
  headings?: RichSourceHeading[];
}

export interface EnglishStrongJsonlProjectionSummary {
  id: string;
  applicationVersionId: string;
  datasetId: string;
  moduleName: string;
  outputPath: string;
  sha256: string;
  verseCount: number;
  headingCount: number;
  pericopeCount: number;
  redLetterSpanCount: number;
  noteCount: number;
  strongOccurrenceCount: number;
  lexemeAssignmentCount: number;
  lexemeCount: number;
}

const SOURCE_CATALOG = "src/englishStrongSwordSources.json";
const RICH_SOURCE_ROOT = "outputs/imports/english-sword/rich-source";
const OUTPUT_ROOT = "outputs/imports/english-sword/mobile-jsonl";

export async function projectEnglishStrongMobileJsonl(
  options: {
    root?: string;
    catalogPath?: string;
    richSourceRoot?: string;
    outputRoot?: string;
    only?: ReadonlySet<string>;
  } = {}
): Promise<EnglishStrongJsonlProjectionSummary[]> {
  const root = path.resolve(options.root ?? process.cwd());
  const catalog = JSON.parse(
    await readFile(
      path.resolve(root, options.catalogPath ?? SOURCE_CATALOG),
      "utf8"
    )
  ) as EnglishStrongSourceCatalog;
  if (
    catalog.format !== "bible-strong-sword-source-catalog" ||
    catalog.schemaVersion !== 1
  ) {
    throw new Error("english-strong-invalid-source-catalog");
  }
  const sources = options.only
    ? catalog.sources.filter(({ id }) => options.only!.has(id))
    : catalog.sources;
  if (options.only && sources.length !== options.only.size) {
    throw new Error("english-strong-unknown-source-selection");
  }
  const outputRoot = path.resolve(root, options.outputRoot ?? OUTPUT_ROOT);
  await mkdir(outputRoot, { recursive: true });
  const summaries: EnglishStrongJsonlProjectionSummary[] = [];
  for (const source of sources) {
    const inputPath = path.resolve(
      root,
      options.richSourceRoot ?? RICH_SOURCE_ROOT,
      source.id,
      `bible-${source.id}-source-rich.jsonl`
    );
    if (!existsSync(inputPath)) {
      throw new Error(`english-strong-rich-source-missing:${inputPath}`);
    }
    const outputPath = path.join(outputRoot, `bible-${source.id}-strong.jsonl`);
    summaries.push(await projectSource(source, inputPath, outputPath));
  }
  await writeFile(
    path.join(outputRoot, "catalog.json"),
    `${JSON.stringify(
      {
        format: "bible-strong-english-mobile-jsonl",
        schemaVersion: 1,
        bibles: summaries
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return summaries;
}

async function projectSource(
  source: EnglishStrongSource,
  inputPath: string,
  outputPath: string
): Promise<EnglishStrongJsonlProjectionSummary> {
  const temporary = `${outputPath}.tmp-${process.pid}`;
  await rm(temporary, { force: true });
  const outputHash = createHash("sha256");
  let verseCount = 0;
  let headingCount = 0;
  let pericopeCount = 0;
  let redLetterSpanCount = 0;
  let noteCount = 0;
  let strongOccurrenceCount = 0;
  let lexemeAssignmentCount = 0;
  const lexemes = new Set<string>();
  let previousOrder = -1;
  const input = createReadStream(inputPath);
  const lines = createInterface({ input, crlfDelay: Infinity });
  const output = createWriteStream(temporary, { encoding: "utf8" });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const sourceVerse = JSON.parse(line) as RichSourceVerse;
      if (sourceVerse.canon !== "protestant-66") continue;
      validateRichSourceVerse(sourceVerse, source);
      const canonicalOrder =
        sourceVerse.book * 1_000_000 +
        sourceVerse.chapter * 1_000 +
        sourceVerse.verse;
      if (canonicalOrder <= previousOrder) {
        throw new Error(
          `english-strong-noncanonical-source:${source.id}:${sourceVerse.ref}`
        );
      }
      previousOrder = canonicalOrder;
      const projection = projectSwordOsisMarkup(sourceVerse.text, {
        lowercaseSuffixAsEStrong:
          source.id === "nasb1995" || source.id === "nasb2020"
      });
      const lemmaProjection = enrichEnglishStrongMarkup(projection.text);
      const headings = (sourceVerse.headings ?? []).map(projectHeading);
      const verse: StrongBibleJsonlVerse = {
        ref: sourceVerse.ref,
        version: source.moduleName,
        book: sourceVerse.book,
        bookId: sourceVerse.bookId,
        chapter: sourceVerse.chapter,
        verse: sourceVerse.verse,
        text: lemmaProjection.text,
        ...(headings.length > 0 ? { headings } : {})
      };
      const serialized = `${JSON.stringify(verse)}\n`;
      if (!output.write(serialized)) {
        await new Promise<void>((resolve) => output.once("drain", resolve));
      }
      outputHash.update(serialized);
      verseCount += 1;
      headingCount += headings.length;
      pericopeCount += headings.filter(
        ({ kind }) => kind === "pericope"
      ).length;
      redLetterSpanCount += projection.redLetterSpanCount;
      noteCount += projection.noteCount;
      strongOccurrenceCount += projection.strongOccurrenceCount;
      lexemeAssignmentCount += lemmaProjection.lexemeAssignmentCount;
      for (const lexeme of lemmaProjection.lexemes) lexemes.add(lexeme);
    }
    await new Promise<void>((resolve, reject) => {
      output.end(resolve);
      output.once("error", reject);
    });
    await rm(outputPath, { force: true });
    await rename(temporary, outputPath);
  } catch (error) {
    output.destroy();
    await rm(temporary, { force: true });
    throw error;
  }
  return {
    id: source.id,
    applicationVersionId: source.applicationVersionId,
    datasetId: source.datasetId,
    moduleName: source.moduleName,
    outputPath,
    sha256: outputHash.digest("hex"),
    verseCount,
    headingCount,
    pericopeCount,
    redLetterSpanCount,
    noteCount,
    strongOccurrenceCount,
    lexemeAssignmentCount,
    lexemeCount: lexemes.size
  };
}

function validateRichSourceVerse(
  verse: RichSourceVerse,
  source: EnglishStrongSource
): void {
  if (
    verse.format !== "bible-strong-rich-source-jsonl" ||
    verse.schemaVersion !== 1 ||
    verse.version !== source.moduleName ||
    verse.applicationVersionId !== source.applicationVersionId ||
    verse.datasetId !== source.datasetId ||
    !Number.isSafeInteger(verse.book) ||
    verse.book < 1 ||
    verse.book > 66 ||
    !Number.isSafeInteger(verse.chapter) ||
    !Number.isSafeInteger(verse.verse) ||
    typeof verse.text !== "string"
  ) {
    throw new Error(`english-strong-invalid-rich-source:${source.id}`);
  }
}

function projectHeading(heading: RichSourceHeading): StrongBibleJsonlHeading {
  const normalizedType = heading.type.toLocaleLowerCase();
  return {
    offset: 0,
    order: heading.order,
    kind: heading.isPericope
      ? "pericope"
      : normalizedType === "parallel"
        ? "parallel"
        : "heading",
    type: heading.type,
    text: heading.text,
    markup: sanitizeEditorialMarkup(heading.sourceMarkup),
    ...(heading.subType ? { attributes: { subType: heading.subType } } : {})
  };
}

function sanitizeEditorialMarkup(markup: string): string {
  return (markup.match(/<[^>]*>|[^<]+/gu) ?? [])
    .map((token) => {
      if (!token.startsWith("<")) return token;
      const tag = parseTag(token);
      if (!tag)
        throw new Error(`english-strong-invalid-editorial-tag:${token}`);
      if (tag.name === "w") return "";
      if (tag.type === "close") return `</${tag.rawName}>`;
      const attributes = { ...tag.attributes };
      for (const key of [
        "strong",
        "estrong",
        "dstrong",
        "ustrong",
        "lemma",
        "morph",
        "src"
      ]) {
        delete attributes[key];
      }
      return `<${tag.rawName}${serializeAttributes(attributes)}${
        tag.type === "self" ? "/" : ""
      }>`;
    })
    .join("");
}

export function projectSwordOsisMarkup(
  source: string,
  options: { lowercaseSuffixAsEStrong?: boolean } = {}
): {
  text: string;
  redLetterSpanCount: number;
  noteCount: number;
  strongOccurrenceCount: number;
} {
  let text = "";
  let noteDepth = 0;
  let titleDepth = 0;
  let redLetterSpanCount = 0;
  let noteCount = 0;
  let strongOccurrenceCount = 0;
  const wordStack: boolean[] = [];
  const quoteStack: Array<"red" | "q"> = [];

  for (const token of source.match(/<[^>]*>|[^<]+/gu) ?? []) {
    if (!token.startsWith("<")) {
      if (titleDepth === 0) text += token;
      continue;
    }
    const tag = parseTag(token);
    if (!tag) throw new Error(`english-strong-invalid-osis-tag:${token}`);

    if (noteDepth > 0) {
      if (tag.name === "note") {
        text += token;
        if (tag.type === "open") noteDepth += 1;
        if (tag.type === "close") noteDepth -= 1;
      } else {
        text += projectNoteTag(tag);
      }
      continue;
    }
    if (titleDepth > 0) {
      if (tag.name === "title") {
        if (tag.type === "open") titleDepth += 1;
        if (tag.type === "close") titleDepth -= 1;
      }
      continue;
    }
    if (tag.name === "note") {
      noteCount += 1;
      text += token;
      if (tag.type === "open") noteDepth = 1;
      continue;
    }
    if (tag.name === "title") {
      if (tag.type === "open") titleDepth = 1;
      continue;
    }
    if (tag.name === "w") {
      if (tag.type === "close") {
        if (wordStack.pop()) text += "</w>";
        continue;
      }
      const sourceCodes = [
        ...new Set(
          (tag.attributes.lemma ?? "")
            .split(/\s+/u)
            .map((value) => value.match(/^strong:([GH]\d+[A-Za-z]*)$/iu)?.[1])
            .filter((value): value is string => Boolean(value))
            .map((value) => canonicalStrongIdentity(value))
        )
      ];
      const eStrongCodes = options.lowercaseSuffixAsEStrong
        ? sourceCodes.filter((value) => /^[GH]\d+[a-z]+$/u.test(value))
        : [];
      const strongCodes = [
        ...new Set(
          sourceCodes.map((value) =>
            eStrongCodes.includes(value)
              ? value.replace(/[a-z]+$/u, "")
              : value
          )
        )
      ];
      const emitted = strongCodes.length > 0;
      if (emitted) {
        strongOccurrenceCount += 1;
        text += `<w strong="${strongCodes.join(" ")}"${
          eStrongCodes.length > 0
            ? ` estrong="${eStrongCodes.join(" ")}"`
            : ""
        }>`;
        if (tag.type === "self") text += "</w>";
      }
      if (tag.type === "open") wordStack.push(emitted);
      continue;
    }
    if (tag.name === "chapter") continue;
    if (tag.name === "q") {
      if (tag.type === "self") continue;
      if (tag.type === "close") {
        text += `</${quoteStack.pop() ?? "q"}>`;
        continue;
      }
      const outputTag =
        tag.attributes.who?.toLocaleLowerCase() === "jesus" ? "red" : "q";
      if (outputTag === "red") redLetterSpanCount += 1;
      quoteStack.push(outputTag);
      text += `<${outputTag}${serializeAttributes(tag.attributes)}>`;
      continue;
    }
    if (tag.name === "milestone") {
      const classification = classifyMilestone(tag.attributes);
      if (classification === "paragraph") text += "<p></p>";
      else if (classification === "poetry") text += "<l></l>";
      else
        text += `<span data-osis-tag="milestone"${serializeAttributes(
          tag.attributes
        )}/>`;
      continue;
    }
    if (tag.name === "div") {
      const type = tag.attributes.type?.toLocaleLowerCase() ?? "";
      const subType = tag.attributes.subtype?.toLocaleLowerCase() ?? "";
      if (subType === "x-preverse") continue;
      if (type === "x-p") {
        if (tag.attributes.eid) text += "</p>";
        else if (tag.attributes.sid) text += "<p>";
        continue;
      }
      if (tag.attributes.eid) text += "</span>";
      else if (tag.attributes.sid)
        text += `<span data-osis-tag="div"${serializeAttributes(
          tag.attributes
        )}>`;
      continue;
    }
    const mapped = mapTag(tag.name);
    if (!mapped) {
      throw new Error(`english-strong-unsupported-osis-tag:${tag.rawName}`);
    }
    if (tag.type === "close") {
      text += `</${mapped}>`;
      continue;
    }
    const attributes =
      mapped === tag.rawName
        ? tag.attributes
        : { ...tag.attributes, "data-osis-tag": tag.rawName };
    text += `<${mapped}${serializeAttributes(attributes)}${
      tag.type === "self" ? "/" : ""
    }>`;
  }
  if (noteDepth !== 0 || titleDepth !== 0 || wordStack.length !== 0) {
    throw new Error("english-strong-unclosed-osis-markup");
  }
  return {
    text: trimVisibleBoundaryWhitespace(text),
    redLetterSpanCount,
    noteCount,
    strongOccurrenceCount
  };
}

function canonicalStrongIdentity(value: string): string {
  const match = value.match(/^([GH])0*(\d+)([A-Za-z]*)$/iu);
  if (!match) return value;
  return `${match[1]!.toUpperCase()}${Number(match[2])}${match[3] ?? ""}`;
}

function projectNoteTag(tag: ReturnType<typeof parseTag> & {}): string {
  if (tag.name === "w") return "";
  const noteMappings: Record<string, string> = {
    reference: "ref",
    ref: "ref",
    rdg: "i",
    catchword: "i",
    hi: "i",
    transchange: "i",
    foreign: "i",
    inscription: "i",
    abbr: "i",
    seg: "i",
    sbi: "i",
    i: "i",
    divinename: "divineName",
    "small-caps": "small-caps",
    sup: "sup"
  };
  const mapped = noteMappings[tag.name];
  if (!mapped) {
    throw new Error(`english-strong-unsupported-note-tag:${tag.rawName}`);
  }
  if (tag.type === "close") return `</${mapped}>`;
  const attributes = { ...tag.attributes };
  if (mapped === "ref" && attributes.osisref && !attributes.id) {
    attributes.id = attributes.osisref;
  }
  delete attributes.osisref;
  attributes["data-osis-tag"] = tag.rawName;
  return `<${mapped}${serializeAttributes(attributes)}${
    tag.type === "self" ? "/" : ""
  }>`;
}

function trimVisibleBoundaryWhitespace(markup: string): string {
  const tokens = markup.match(/<[^>]*>|[^<]+/gu) ?? [];
  const excludedAt = new Array<boolean>(tokens.length).fill(false);
  let excludedDepth = 0;
  for (const [index, token] of tokens.entries()) {
    if (!token.startsWith("<")) {
      excludedAt[index] = excludedDepth > 0;
      continue;
    }
    const tag = parseTag(token);
    if (!tag || (tag.name !== "note" && tag.name !== "ref")) continue;
    if (tag.type === "open") excludedDepth += 1;
    if (tag.type === "close") excludedDepth = Math.max(0, excludedDepth - 1);
  }
  const visibleTextIndices = tokens.flatMap((token, index) =>
    !token.startsWith("<") &&
    !excludedAt[index] &&
    /\S/u.test(decodeTextEntities(token))
      ? [index]
      : []
  );
  const first = visibleTextIndices[0];
  const last = visibleTextIndices.at(-1);
  if (first === undefined || last === undefined) {
    for (const [index, token] of tokens.entries()) {
      if (!token.startsWith("<") && !excludedAt[index]) tokens[index] = "";
    }
    return tokens.join("");
  }
  for (const [index, token] of tokens.entries()) {
    if (token.startsWith("<") || excludedAt[index]) continue;
    if (index < first || index > last) tokens[index] = "";
  }
  tokens[first] = tokens[first]!.replace(/^\s+/u, "");
  tokens[last] = tokens[last]!.replace(/\s+$/u, "");
  return tokens.join("");
}

function classifyMilestone(
  attributes: Record<string, string>
): "paragraph" | "poetry" | "other" {
  const value = `${attributes.type ?? ""} ${attributes.subtype ?? ""}`
    .toLocaleLowerCase()
    .replaceAll("_", "-");
  if (/\bx-(?:p|pm|extra-p)\b/u.test(value)) return "paragraph";
  if (value.includes("x-poetry")) return "poetry";
  return "other";
}

function mapTag(name: string): string | undefined {
  const mappings: Record<string, string> = {
    p: "p",
    l: "l",
    lg: "lg",
    list: "list",
    item: "item",
    transchange: "i",
    hi: "i",
    divinename: "divineName",
    "small-caps": "small-caps",
    sup: "sup",
    foreign: "span",
    inscription: "span",
    abbr: "span",
    seg: "span",
    sbi: "span",
    reference: "ref",
    rdg: "i",
    catchword: "i",
    lb: "span"
  };
  return mappings[name];
}

function parseTag(source: string): {
  name: string;
  rawName: string;
  type: "open" | "close" | "self";
  attributes: Record<string, string>;
} | null {
  const match = source.match(
    /^<\s*(\/)?\s*([A-Za-z][\w:-]*)([\s\S]*?)(\/)?\s*>$/u
  );
  if (!match) return null;
  const closing = Boolean(match[1]);
  return {
    name: match[2]!.toLocaleLowerCase(),
    rawName: match[2]!,
    type: closing ? "close" : match[4] ? "self" : "open",
    attributes: closing ? {} : parseAttributes(match[3] ?? "")
  };
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/gu;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]!.toLocaleLowerCase()] = decodeEntities(match[3] ?? "");
  }
  return attributes;
}

function serializeAttributes(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function decodeTextEntities(value: string): string {
  return decodeEntities(value).replaceAll("&nbsp;", "\u00a0");
}

function parseCli(argv: string[]): {
  only?: ReadonlySet<string>;
  outputRoot?: string;
} {
  let only: ReadonlySet<string> | undefined;
  let outputRoot: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--only") {
      only = new Set(
        (argv[++index] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      );
    } else if (argument === "--output-dir") {
      outputRoot = argv[++index];
    } else {
      throw new Error(`unknown-argument:${argument}`);
    }
  }
  return { only, outputRoot };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const result = await projectEnglishStrongMobileJsonl({
    root,
    ...parseCli(process.argv.slice(2))
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  await main();
}
