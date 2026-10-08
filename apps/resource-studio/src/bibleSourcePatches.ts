import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { hashVerseTexts } from "./bibleSourceRepairs.js";
import { DEFAULT_R2_BUCKET, r2Location } from "./r2ArtifactSources.js";
import { hashVerseText } from "./wordsOfJesus.js";

export const BIBLE_SOURCE_PATCHES_PATH =
  "config/ordinary-bible-source-patches.json";

type LegacyBible = Record<string, Record<string, Record<string, string>>>;

/**
 * How a source writes the paragraph breaks of its provider. The current
 * generator ends a paragraph with a line break; earlier ones followed every
 * break but the last of a chapter with a space, or kept no break at all.
 */
export type ProviderTextStyle = "provider" | "space-after-break" | "no-breaks";

/**
 * Another published edition of the same text, read for the chapters the
 * provider of the set lacks as well. Each publishes whole files, not chapters:
 * the answer of a chapter is the file its chapter is read from.
 */
export type EditionProvider =
  /** One OSIS file for the whole Bible, `<work>.xml` of the repository. */
  | { id: "gratis-bible"; work: string }
  /**
   * One page per book under `edition`. `labels` reads a verse number the page
   * misprints (`1O` for `10`); a label that is not a number fails otherwise.
   */
  | { id: "levigilant.com"; edition: string; labels?: Record<string, number> };

/** One chapter completed or replaced from the provider's answer. */
export interface BibleSourcePatchChapter {
  /** `<book>-<chapter>`, in Bible Strong numbers. */
  chapter: string;
  /**
   * Chapter reference at the provider (`EXO.38`, `SIR.1_1`); the OSIS chapter
   * (`Dan.2`) or the page and chapter (`jacques.html#5`) of another edition.
   */
  reference: string;
  /** The edition this chapter is read from, when it is not the set's provider. */
  provider?: EditionProvider;
  /** What the source lacks here and what the provider serves. No Bible text. */
  evidence: string;
  /** The provider answer the patch was reviewed against. */
  response: { url: string; fetchedAt: string; sha256: string };
  /** Verses whose text comes from the provider, with the hash of that text. */
  supplied: Record<string, string>;
  /**
   * Runs of source rows kept under the number the provider gives them.
   * `expect` hashes their texts, in order, as a JSON array.
   */
  renumbered: Array<{
    first: number;
    last: number;
    by: number;
    expect: string;
  }>;
  /** Source rows the provider's chapter replaces, with the hash of their text. */
  dropped: Record<string, string>;
  /** Number of source rows left exactly as they are. */
  kept: number;
}

export interface BibleSourcePatchSet {
  provider: {
    id: "bible.com";
    versionId: number;
    abbreviation: string;
  };
  /** The source entry the patch was reviewed against. */
  base: { sourceUrl: string; sha256: string };
  textStyle: ProviderTextStyle;
  chapters: BibleSourcePatchChapter[];
  /** The complete source the patch produces. `sha256` is also its R2 key. */
  patched: { fileName: string; sha256: string; bytes: number };
}

export interface BibleSourcePatches {
  schemaVersion: 1;
  bibles: Record<string, BibleSourcePatchSet>;
}

export async function readBibleSourcePatches(
  root: string
): Promise<BibleSourcePatches> {
  const patches = JSON.parse(
    await readFile(path.join(root, BIBLE_SOURCE_PATCHES_PATH), "utf8")
  ) as BibleSourcePatches;
  if (patches.schemaVersion !== 1 || !patches.bibles) {
    throw new Error("bible-source-patches-invalid");
  }
  return patches;
}

/** Where a patched source lives once uploaded: its SHA-256 is its key. */
export const patchedSourceLocation = (
  patch: Pick<BibleSourcePatchSet, "patched">,
  bucket = DEFAULT_R2_BUCKET
) =>
  r2Location(
    bucket,
    `sources/${patch.patched.sha256}/${patch.patched.fileName}`
  );

/**
 * A Bible with a patch is published from its patched source only. Fails when
 * the loaded source is another one: the configuration still names the earlier
 * source until the patched one is uploaded and adopted, and a build before
 * that must be given the local patched file explicitly.
 */
export const assertPatchedSourceLoaded = (
  versionId: string,
  sourceSha256: string,
  patch: BibleSourcePatchSet | undefined
) => {
  if (patch && patch.patched.sha256 !== sourceSha256) {
    throw new Error(
      `bible-source-patch-pending:${versionId}:expected=${patch.patched.sha256}:actual=${sourceSha256}`
    );
  }
};

/**
 * Location a publication records for its text source. A patched source read
 * from a local file is recorded under the content-addressed key it is
 * uploaded to, never under the local path or the earlier source's URL.
 */
export const publishedTextSourceUrl = (options: {
  configuredUrl: string;
  sourceSha256: string;
  patch: BibleSourcePatchSet | undefined;
}) =>
  options.patch && options.patch.patched.sha256 === options.sourceSha256
    ? patchedSourceLocation(options.patch)
    : options.configuredUrl;

export const bibleComChapterUrl = (versionId: number, reference: string) =>
  `https://events.bible.com/api/bible/chapter/3.1?id=${versionId}&reference=${encodeURIComponent(reference)}&format=html`;

const EDITION_PATH = /^[\w-]+(?:\/[\w-]+)*$/u;
const LEVIGILANT_REFERENCE = /^([\w-]+\.html)#([1-9]\d*)$/u;

/**
 * The file a chapter of another edition is read from, and where it is kept
 * under the provider cache. Several chapters may name the same file.
 */
export function editionProviderFile(
  provider: EditionProvider,
  reference: string
): { url: string; cachePath: string } {
  if (provider.id === "gratis-bible") {
    if (!EDITION_PATH.test(provider.work))
      throw new Error(`bible-provider-edition-invalid:${provider.work}`);
    return {
      url: `https://raw.githubusercontent.com/gratis-bible/bible/master/${provider.work}.xml`,
      cachePath: `gratis-bible/${provider.work}.xml`
    };
  }
  if (provider.id === "levigilant.com") {
    const page = LEVIGILANT_REFERENCE.exec(reference)?.[1];
    if (!EDITION_PATH.test(provider.edition) || !page)
      throw new Error(
        `bible-provider-edition-invalid:${provider.edition}:${reference}`
      );
    return {
      url: `https://levigilant.com/${provider.edition}/${page}`,
      cachePath: `levigilant.com/${provider.edition}/${page}`
    };
  }
  throw new Error(`bible-provider-unknown:${(provider as { id: string }).id}`);
}

// --- Provider chapter markup -------------------------------------------------

interface HtmlElement {
  tag: string;
  classes: string[];
  attributes: Record<string, string>;
  parent: HtmlElement | undefined;
  children: Array<HtmlElement | string>;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0"
};

const decodeEntities = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/giu, (entity, body) => {
    const name = String(body);
    if (name.startsWith("#")) {
      const code =
        name[1] === "x" || name[1] === "X"
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10);
      return String.fromCodePoint(code);
    }
    const decoded = NAMED_ENTITIES[name];
    if (decoded === undefined)
      throw new Error(`bible-provider-markup-entity-unsupported:${entity}`);
    return decoded;
  });

const HTML_TOKEN =
  /<\/([a-z][\w-]*)\s*>|<([a-z][\w-]*)((?:\s+[^\s=<>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/giy;
const HTML_ATTRIBUTE = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/gu;
const VOID_TAGS = new Set(["br", "hr", "img", "wbr"]);

/**
 * Reads the well-formed markup the provider serves into a small tree. Anything
 * it does not understand fails: text is never guessed from broken markup.
 */
const parseHtml = (html: string): HtmlElement => {
  const root: HtmlElement = {
    tag: "#root",
    classes: [],
    attributes: {},
    parent: undefined,
    children: []
  };
  let current = root;
  HTML_TOKEN.lastIndex = 0;
  let position = 0;
  while (position < html.length) {
    HTML_TOKEN.lastIndex = position;
    const token = HTML_TOKEN.exec(html);
    if (!token) throw new Error(`bible-provider-markup-invalid:${position}`);
    position = HTML_TOKEN.lastIndex;
    const [, closed, opened, rawAttributes, selfClosing, text] = token;
    if (text !== undefined) {
      current.children.push(decodeEntities(text));
    } else if (closed !== undefined) {
      if (current.tag !== closed.toLowerCase() || !current.parent)
        throw new Error(`bible-provider-markup-unbalanced:${closed}`);
      current = current.parent;
    } else {
      const attributes: Record<string, string> = {};
      for (const attribute of (rawAttributes ?? "").matchAll(HTML_ATTRIBUTE)) {
        attributes[attribute[1]!.toLowerCase()] = decodeEntities(
          attribute[2] ?? attribute[3] ?? ""
        );
      }
      const element: HtmlElement = {
        tag: opened!.toLowerCase(),
        classes: (attributes.class ?? "").split(/\s+/u).filter(Boolean),
        attributes,
        parent: current,
        children: []
      };
      current.children.push(element);
      if (!selfClosing && !VOID_TAGS.has(element.tag)) current = element;
    }
  }
  if (current !== root)
    throw new Error(`bible-provider-markup-unbalanced:${current.tag}`);
  return root;
};

const hasClass = (element: HtmlElement, name: string) =>
  element.classes.includes(name);

/** Descendant elements in document order, optionally not entering notes. */
const descendants = (
  element: HtmlElement,
  options: { skipNotes?: boolean } = {}
): HtmlElement[] =>
  element.children.flatMap((child) =>
    typeof child === "string" || (options.skipNotes && hasClass(child, "note"))
      ? []
      : [child, ...descendants(child, options)]
  );

const textOf = (element: HtmlElement, skipNotes: boolean): string =>
  element.children
    .map((child) =>
      typeof child === "string"
        ? child
        : skipNotes && hasClass(child, "note")
          ? ""
          : textOf(child, skipNotes)
    )
    .join("");

const closest = (
  element: HtmlElement,
  matches: (candidate: HtmlElement) => boolean
) => {
  let candidate: HtmlElement | undefined = element;
  while (candidate && candidate.tag !== "#root") {
    if (matches(candidate)) return candidate;
    candidate = candidate.parent;
  }
  return undefined;
};

const isLastVerseOfParagraph = (element: HtmlElement) => {
  const chapter = closest(element, (candidate) =>
    hasClass(candidate, "chapter")
  );
  let paragraph: HtmlElement | undefined;
  if (chapter) {
    paragraph = element.parent;
    while (paragraph && paragraph.parent !== chapter) {
      const parent: HtmlElement | undefined = paragraph.parent;
      if (!parent || parent.tag === "#root") break;
      paragraph = parent;
    }
  } else {
    paragraph = closest(element, (candidate) => candidate.tag === "div");
  }
  if (!paragraph || paragraph.tag === "#root") return false;
  const verses = descendants(paragraph).filter(
    (candidate) =>
      hasClass(candidate, "verse") &&
      !closest(candidate, (ancestor) => hasClass(ancestor, "note"))
  );
  return verses.at(-1) === element;
};

/**
 * Verse rows of one chapter as the provider serves it, in the shape of the
 * legacy sources: notes are left out, inline whitespace is collapsed, a verse
 * ends with a line break where its paragraph ends, and a block of verses
 * translated as one sits under its first verse number. This is the reading of
 * the generator the current sources were built with; both must agree.
 */
export function parseProviderChapterHtml(html: string): Record<string, string> {
  const verses: Record<string, string> = {};
  for (const element of descendants(parseHtml(html))) {
    if (!hasClass(element, "verse")) continue;
    const firstReference = (element.attributes["data-usfm"] ?? "").split(
      "+",
      1
    )[0]!;
    const verse = Number.parseInt(firstReference.split(".").at(-1) ?? "", 10);
    if (!Number.isInteger(verse) || verse < 1) continue;
    const text = descendants(element, { skipNotes: true })
      .filter((candidate) => hasClass(candidate, "content"))
      .map((candidate) => textOf(candidate, true))
      .join("")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const existing = verses[verse];
    const separator = existing?.endsWith("\n") ? "" : " ";
    let row = existing ? `${existing}${separator}${text}` : text;
    if (isLastVerseOfParagraph(element) && !row.endsWith("\n")) row += "\n";
    verses[verse] = row;
  }
  return verses;
}

const collapseVerseText = (text: string) =>
  text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Verse rows of one chapter of an OSIS file that holds one `<verse>` element
 * per verse and nothing but text inside it, as the gratis-bible files do.
 * `reference` is the OSIS chapter (`Dan.2`). Markup inside a verse, a verse
 * read twice or a chapter without verses fails.
 */
export function parseOsisChapter(
  xml: string,
  reference: string
): Record<string, string> {
  if (
    !/^[1-3]?[A-Za-z]+\.[1-9]\d*$/u.test(reference) ||
    !xml.includes("<osisText")
  )
    throw new Error(`bible-provider-osis-invalid:${reference}`);
  const verses: Record<string, string> = {};
  const pattern = new RegExp(
    `<verse\\s+osisID=(['"])${reference.replace(".", "\\.")}\\.([1-9]\\d*)\\1\\s*(?:/>|>([^]*?)</verse>)`,
    "gu"
  );
  for (const [, , verse, body] of xml.matchAll(pattern)) {
    if (body?.includes("<"))
      throw new Error(
        `bible-provider-osis-markup-unsupported:${reference}.${verse}`
      );
    if (verses[verse!] !== undefined)
      throw new Error(`bible-provider-verse-duplicate:${reference}.${verse}`);
    const text = collapseVerseText(decodeEntities(body ?? ""));
    if (text) verses[verse!] = text;
  }
  return verses;
}

/**
 * Verse rows of one chapter of a levigilant.com book page: the paragraphs
 * between the anchor of the chapter and the next one, the first being the
 * chapter title and every other one a verse behind its number. Italics and
 * colours are dropped. A paragraph that does not begin with a verse number
 * fails, unless `labels` records how that misprinted number reads; a recorded
 * label the chapter does not print fails too.
 */
export function parseLevigilantChapter(
  html: string,
  chapter: number,
  labels: Record<string, number> = {}
): Record<string, string> {
  const fail = (code: string, detail: string | number): never => {
    throw new Error(`bible-provider-page-${code}:${chapter}:${detail}`);
  };
  const anchor = `<a name="${chapter}">`;
  const start = html.indexOf(anchor);
  if (start === -1 || html.indexOf(anchor, start + 1) !== -1)
    fail("chapter-missing", chapter);
  const rest = html.slice(start + anchor.length);
  const end = /<a name="|<\/div>/u.exec(rest);
  if (!end) fail("chapter-unbounded", chapter);
  const paragraphs = [
    ...rest.slice(0, end!.index).matchAll(/<p\b[^>]*>([^]*?)<\/p>/gu)
  ]
    .map(([, body]) =>
      collapseVerseText(decodeEntities(body!.replace(/<[^>]*>/gu, "")))
    )
    .filter(Boolean);
  const title = paragraphs.shift();
  if (!title || !new RegExp(`\\D ${chapter}$`, "u").test(title))
    fail("title-missing", chapter);
  const verses: Record<string, string> = {};
  const read = new Set<string>();
  let previous = 0;
  for (const paragraph of paragraphs) {
    const [, label, text] = /^(\S+) (.+)$/u.exec(paragraph) ?? [];
    if (!label || !text) fail("verse-unreadable", previous + 1);
    const verse = /^[1-9]\d*$/u.test(label!) ? Number(label) : labels[label!];
    if (verse === undefined) fail("verse-label-unsupported", label!);
    if (!/^[1-9]\d*$/u.test(label!)) read.add(label!);
    if (!Number.isSafeInteger(verse) || verse! <= previous)
      fail("verse-order", label!);
    verses[verse!] = text!;
    previous = verse!;
  }
  const unread = Object.keys(labels).find((label) => !read.has(label));
  if (unread !== undefined) fail("verse-label-unread", unread);
  return verses;
}

/** Writes the provider's rows of one chapter the way the source writes them. */
export function styleProviderChapter(
  verses: Record<string, string>,
  style: ProviderTextStyle
): Record<string, string> {
  if (style === "provider") return { ...verses };
  const numbers = Object.keys(verses).map(Number);
  const last = String(Math.max(...numbers));
  return Object.fromEntries(
    Object.entries(verses).map(([verse, text]) => {
      if (style === "no-breaks")
        return [verse, text.replace(/\n$/u, "").replaceAll("\n", " ")];
      const spaced = text.replaceAll("\n", "\n ");
      return [
        verse,
        verse === last && spaced.endsWith("\n ") ? spaced.slice(0, -1) : spaced
      ];
    })
  );
}

/**
 * Text as compared between a source row and the provider: whitespace and
 * typographic variants of quotes, dashes and spaces do not make two rows
 * different, any other character does.
 */
export const normalizeVerseForComparison = (text: string) =>
  text
    .normalize("NFC")
    .replace(/[\u2018\u2019\u02bc\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u00ab\u00bb]/gu, '"')
    .replace(/[\u2010-\u2015]/gu, "-")
    .replace(/\u2026/gu, "...")
    .replace(/\s+/gu, " ")
    .trim();

export interface AlignedChapter {
  verses: Record<string, string>;
  supplied: Record<string, string>;
  renumbered: BibleSourcePatchChapter["renumbered"];
  dropped: Record<string, string>;
  kept: number;
}

/**
 * Completes one chapter of a source from the provider's chapter, whose rows
 * are already written in the style of the source. The chapter takes the
 * provider's verse numbers. A source row that reads as the provider's verse is
 * kept byte for byte, under that number; a verse no remaining source row
 * matches is supplied by the provider; a source row no provider verse matches
 * is dropped. Rows are matched in order, so a row never moves past another.
 */
export function alignChapterWithProvider(options: {
  base: Record<string, string> | undefined;
  provider: Record<string, string>;
}): AlignedChapter {
  const baseKeys = Object.keys(options.base ?? {});
  if (baseKeys.some((key) => !/^\d+$/u.test(key)))
    throw new Error("bible-source-patch-base-key-unsupported");
  const baseRows = baseKeys
    .map((key) => ({
      verse: Number(key),
      text: options.base![key]!,
      normalized: normalizeVerseForComparison(options.base![key]!)
    }))
    .sort((left, right) => left.verse - right.verse);
  const verses: Record<string, string> = {};
  const supplied: Record<string, string> = {};
  const dropped: Record<string, string> = {};
  const moved: Array<{ from: number; to: number; text: string }> = [];
  let kept = 0;
  let cursor = 0;
  const drop = (row: (typeof baseRows)[number]) => {
    dropped[row.verse] = hashVerseText(row.text);
  };
  const providerNumbers = Object.keys(options.provider)
    .map(Number)
    .sort((left, right) => left - right);
  for (const verse of providerNumbers) {
    const text = options.provider[verse]!;
    const normalized = normalizeVerseForComparison(text);
    let match = cursor;
    while (
      match < baseRows.length &&
      baseRows[match]!.normalized !== normalized
    )
      match += 1;
    if (match === baseRows.length) {
      verses[verse] = text;
      supplied[verse] = hashVerseText(text);
      continue;
    }
    for (const row of baseRows.slice(cursor, match)) drop(row);
    const row = baseRows[match]!;
    verses[verse] = row.text;
    if (row.verse === verse) kept += 1;
    else moved.push({ from: row.verse, to: verse, text: row.text });
    cursor = match + 1;
  }
  for (const row of baseRows.slice(cursor)) drop(row);
  const renumbered: AlignedChapter["renumbered"] = [];
  let run: typeof moved = [];
  const closeRun = () => {
    if (run.length === 0) return;
    renumbered.push({
      first: run[0]!.from,
      last: run.at(-1)!.from,
      by: run[0]!.to - run[0]!.from,
      expect: hashVerseTexts(run.map((row) => row.text))
    });
    run = [];
  };
  for (const row of moved) {
    const previous = run.at(-1);
    if (
      previous &&
      (row.from !== previous.from + 1 ||
        row.to - row.from !== previous.to - previous.from)
    )
      closeRun();
    run.push(row);
  }
  closeRun();
  return { verses, supplied, renumbered, dropped, kept };
}

const escapeNonAscii = (json: string) =>
  json.replace(
    // Each UTF-16 unit is escaped on its own, as the sources do.
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
  );

/**
 * Serializer that writes a legacy Bible the way its earlier source was
 * written, so the patched file differs from it in the patched chapters only:
 * compact JSON, with non-ASCII characters either literal or escaped. Book,
 * chapter and verse numbers are integer keys, which JavaScript always lists in
 * ascending order. Fails for a source it cannot reproduce byte for byte.
 */
export const legacyBibleSerializerOf = (raw: string) => {
  const parsed = JSON.parse(raw) as unknown;
  const serializers = [
    (bible: unknown) => JSON.stringify(bible),
    (bible: unknown) => escapeNonAscii(JSON.stringify(bible))
  ];
  const serializer = serializers.find((candidate) => candidate(parsed) === raw);
  if (!serializer)
    throw new Error("bible-source-patch-base-serialization-unsupported");
  return serializer;
};

export const sha256Hex = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export interface PatchedChapterReport extends AlignedChapter {
  chapter: string;
  reference: string;
  /** Row counts of the chapter before and after. */
  before: number;
  after: number;
  /** Source rows the provider's chapter also has, however they are numbered. */
  matched: number;
}

/**
 * Rows of one chapter in the answer of the set's provider, or `undefined` when
 * the answer is not that chapter of that version.
 */
const readProviderChapter = (
  versionId: number,
  reference: string,
  response: string
): Record<string, string> | undefined => {
  const answer = JSON.parse(response) as {
    content?: string;
    reference?: { usfm?: string[]; version_id?: number };
  };
  if (
    typeof answer.content !== "string" ||
    answer.reference?.version_id !== versionId ||
    !answer.reference.usfm?.includes(reference)
  )
    return undefined;
  return parseProviderChapterHtml(answer.content);
};

/** Rows of one chapter in the file of another edition. */
const readEditionChapter = (
  provider: EditionProvider,
  reference: string,
  response: string
): Record<string, string> => {
  // Validates the provider and the reference before anything is read.
  editionProviderFile(provider, reference);
  if (provider.id === "gratis-bible")
    return parseOsisChapter(response, reference);
  return parseLevigilantChapter(
    response,
    Number(LEVIGILANT_REFERENCE.exec(reference)![2]),
    provider.labels
  );
};

const sameJson = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Builds the patched source of one Bible from its earlier source and the
 * provider answers. Chapters the patch does not name keep their bytes. Fails when the earlier source or an answer is not the
 * reviewed one, or when a chapter no longer aligns as it was recorded.
 * `anchored: false` skips the recorded results, to draft a patch and read the
 * hashes it produces.
 */
export function applyBibleSourcePatch(options: {
  versionId: string;
  /** The earlier source entry, exactly as stored. */
  baseRaw: string;
  patch: BibleSourcePatchSet;
  /**
   * Raw provider answers by chapter reference: the JSON body of a chapter, or
   * the file of another edition the chapter is read from.
   */
  responses: Record<string, string>;
  anchored?: boolean;
}): { bible: unknown; serialized: string; chapters: PatchedChapterReport[] } {
  const { versionId, patch } = options;
  const anchored = options.anchored !== false;
  const fail = (code: string, detail: string): never => {
    throw new Error(`bible-source-patch-${code}:${versionId}:${detail}`);
  };
  const baseSha256 = sha256Hex(options.baseRaw);
  if (patch.base.sha256 !== baseSha256) fail("base-mismatch", baseSha256);
  const serialize = legacyBibleSerializerOf(options.baseRaw);
  const bible = JSON.parse(options.baseRaw) as LegacyBible;
  const chapters: PatchedChapterReport[] = [];
  const seen = new Set<string>();
  for (const entry of patch.chapters) {
    const chapterRef = /^([1-9]\d*)-([1-9]\d*)$/u.exec(entry.chapter);
    if (!chapterRef || seen.has(entry.chapter) || !entry.evidence)
      fail("chapter-invalid", entry.chapter);
    seen.add(entry.chapter);
    const [, book, chapter] = chapterRef as unknown as [string, string, string];
    const response = options.responses[entry.reference];
    if (response === undefined) fail("response-missing", entry.reference);
    if (anchored && sha256Hex(response!) !== entry.response.sha256)
      fail("response-mismatch", entry.reference);
    const rows = entry.provider
      ? readEditionChapter(entry.provider, entry.reference, response!)
      : readProviderChapter(
          patch.provider.versionId,
          entry.reference,
          response!
        );
    if (!rows) fail("response-invalid", entry.reference);
    const provider = styleProviderChapter(rows!, patch.textStyle);
    if (Object.keys(provider).length === 0)
      fail("response-empty", entry.reference);
    const base = bible[book]?.[chapter];
    const aligned = alignChapterWithProvider({ base, provider });
    if (
      anchored &&
      !(
        sameJson(aligned.supplied, entry.supplied) &&
        sameJson(aligned.renumbered, entry.renumbered) &&
        sameJson(aligned.dropped, entry.dropped) &&
        aligned.kept === entry.kept
      )
    )
      fail("chapter-drift", entry.chapter);
    (bible[book] ??= {})[chapter] = aligned.verses;
    const before = Object.keys(base ?? {}).length;
    chapters.push({
      chapter: entry.chapter,
      reference: entry.reference,
      before,
      after: Object.keys(aligned.verses).length,
      matched: before - Object.keys(aligned.dropped).length,
      ...aligned
    });
  }
  const serialized = serialize(bible);
  if (anchored && sha256Hex(serialized) !== patch.patched.sha256)
    fail("patched-mismatch", sha256Hex(serialized));
  return { bible, serialized, chapters };
}
