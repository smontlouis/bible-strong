/**
 * Evaluator-side parser for one Concordance.bible chapter page.
 *
 * The page markup is not strictly nested: poetic lines close verse spans in a
 * later paragraph. Verse membership is therefore defined by the verse-number
 * markers in document order, and only the small elements whose content must
 * be excluded (headings, verse numbers, editor notes) are tracked explicitly.
 */

export interface SourcePosition {
  /** Word number in the BHS/NA verse used by Concordance (STEP `#NN`). */
  position: number;
  /** Canonical Strong (`H0559`, `G3588`) or null for an unnumbered word. */
  strong: string | null;
  raw: string;
}

export type ConcordanceItem =
  | { kind: "text"; text: string }
  | {
      kind: "word";
      surface: string;
      lemma: string | null;
      pos: string | null;
      locution: string | null;
      positions: SourcePosition[];
      /** `data-ns` numbers with the testament prefix, kept for audit. */
      numberStrongs: string[];
      untranslated: boolean;
    };

export interface ConcordanceVerse {
  verse: number;
  items: ConcordanceItem[];
  notes: string[];
}

export interface ConcordanceChapter {
  verses: ConcordanceVerse[];
  headings: string[];
  attribution: string | null;
  issues: string[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—"
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/giu,
    (match, body: string) => {
      if (body.startsWith("#x") || body.startsWith("#X"))
        return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
      if (body.startsWith("#"))
        return String.fromCodePoint(Number(body.slice(1)));
      return ENTITIES[body.toLowerCase()] ?? match;
    }
  );
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`, "u").exec(tag);
  return match ? decodeEntities(match[1]!) : null;
}

function classesOf(tag: string): string[] {
  return (attribute(tag, "class") ?? "").split(/\s+/u).filter(Boolean);
}

/** `h3820` → `H3820`; Aramaic `a` numbers live in Strong's Hebrew dictionary. */
export function canonicalStrong(prefix: string, digits: string): string | null {
  const number = Number(digits);
  if (!Number.isFinite(number) || number <= 0) return null;
  const letter = prefix.toLowerCase() === "g" ? "G" : "H";
  return `${letter}${String(number).padStart(4, "0")}`;
}

export function parseSourcePositions(value: string | null): SourcePosition[] {
  if (!value) return [];
  return value
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = /^(\d+)\/([a-z])(\d+)$/iu.exec(raw);
      if (!match) return { position: Number.NaN, strong: null, raw };
      return {
        position: Number(match[1]),
        strong: canonicalStrong(match[2]!, match[3]!),
        raw
      };
    });
}

function numberStrongs(value: string | null, testament: "OT" | "NT"): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/u)
    .filter((part) => /^\d+$/u.test(part))
    .flatMap((part) => {
      const strong = canonicalStrong(testament === "NT" ? "g" : "h", part);
      return strong ? [strong] : [];
    });
}

const TOKEN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/gu;

/** Elements whose text never belongs to the reading text of a verse. */
function excludedElement(tag: string, name: string): "heading" | "note" | null {
  const classes = classesOf(tag);
  if (classes.includes("titles")) return "heading";
  if (
    classes.some((value) =>
      ["note", "notes", "footnote", "fn", "note-text", "notetext"].includes(
        value
      )
    )
  )
    return "note";
  if (name === "aside") return "note";
  return null;
}

export function parseConcordanceChapter(
  html: string,
  testament: "OT" | "NT"
): ConcordanceChapter {
  const start = html.indexOf('<div class="chapter"');
  const issues: string[] = [];
  if (start < 0)
    return {
      verses: [],
      headings: [],
      attribution: null,
      issues: ["no-chapter-container"]
    };
  const attributionMatch =
    /<div class="alert alert-light[^"]*"[^>]*>([\s\S]*?)<\/div>/u.exec(
      html.slice(start)
    );
  const attribution = attributionMatch
    ? decodeEntities(attributionMatch[1]!.replace(/<[^>]*>/gu, " "))
        .replace(/\s+/gu, " ")
        .trim()
    : null;
  const verses: ConcordanceVerse[] = [];
  const headings: string[] = [];
  let current: ConcordanceVerse | null = null;
  let divDepth = 0;
  let inVerseNumber = false;
  let pendingVerseNumber: number | null = null;
  let excluded: {
    kind: "heading" | "note";
    name: string;
    depth: number;
    text: string;
    /** Popover content of an editor note (`data-bs-content`). */
    content: string | null;
  } | null = null;
  let untranslatedDepth = 0;
  let spanDepth = 0;
  let openWord: { tag: string; text: string } | null = null;

  for (const match of html.slice(start).matchAll(TOKEN)) {
    const token = match[0];
    if (token.startsWith("<!--")) continue;
    const tagMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/u.exec(token);
    if (!tagMatch) {
      const text = decodeEntities(token);
      if (excluded) excluded.text += text;
      else if (inVerseNumber) continue;
      else if (openWord) openWord.text += text;
      // The spaces around a ◎ marker are display padding, not reading text:
      // the marker can sit inside an elided word (« l’◎Egypte »).
      else if (untranslatedDepth > 0) continue;
      else if (current) current.items.push({ kind: "text", text });
      continue;
    }
    const closing = tagMatch[1] === "/";
    const name = tagMatch[2]!.toLowerCase();
    if (name === "div") {
      divDepth += closing ? -1 : 1;
      if (divDepth <= 0) break;
      continue;
    }
    if (excluded) {
      if (name === excluded.name && !closing && !token.endsWith("/>"))
        excluded.depth += 1;
      if (name === excluded.name && closing) {
        excluded.depth -= 1;
        if (excluded.depth === 0) {
          const text = (excluded.content ?? excluded.text)
            .replace(/\s+/gu, " ")
            .trim();
          if (excluded.kind === "heading") headings.push(text);
          else if (current) current.notes.push(text);
          else issues.push(`note-outside-verse:${text.slice(0, 40)}`);
          excluded = null;
        }
      }
      continue;
    }
    if (name === "sup" && !closing && classesOf(token).includes("numverse")) {
      const id = attribute(token, "id");
      const number = id ? Number(id.replace(/^v/u, "")) : Number.NaN;
      if (!Number.isInteger(number))
        issues.push(`unreadable-verse-number:${token}`);
      pendingVerseNumber = number;
      inVerseNumber = true;
      continue;
    }
    if (name === "sup" && closing && inVerseNumber) {
      inVerseNumber = false;
      if (pendingVerseNumber !== null && Number.isInteger(pendingVerseNumber)) {
        if (verses.some((verse) => verse.verse === pendingVerseNumber))
          issues.push(`duplicate-verse:${pendingVerseNumber}`);
        current = { verse: pendingVerseNumber, items: [], notes: [] };
        verses.push(current);
      }
      pendingVerseNumber = null;
      continue;
    }
    if (inVerseNumber) continue;
    if (!closing) {
      const kind = excludedElement(token, name);
      if (kind) {
        const content = attribute(token, "data-bs-content");
        excluded = {
          kind,
          name,
          depth: 1,
          text: "",
          content:
            content === null
              ? null
              : decodeEntities(content.replace(/<[^>]*>/gu, " "))
        };
        continue;
      }
    }
    if (name === "span") {
      if (!closing) {
        spanDepth += 1;
        if (classesOf(token).includes("strong-untranslated"))
          untranslatedDepth = spanDepth;
      } else {
        if (untranslatedDepth === spanDepth) untranslatedDepth = 0;
        spanDepth = Math.max(0, spanDepth - 1);
      }
      continue;
    }
    if (name === "w") {
      if (!closing) {
        openWord = { tag: token, text: "" };
      } else if (openWord) {
        const tag = openWord.tag;
        const lemmaAttribute = attribute(tag, "data-lm");
        const lemmaMatch = lemmaAttribute
          ? /^(.*)\[(.)\]$/u.exec(lemmaAttribute)
          : null;
        const item: ConcordanceItem = {
          kind: "word",
          surface: openWord.text,
          lemma: lemmaMatch ? lemmaMatch[1]! : lemmaAttribute,
          pos: lemmaMatch ? lemmaMatch[2]! : null,
          locution: attribute(tag, "data-loc"),
          positions: parseSourcePositions(attribute(tag, "data-pa")),
          numberStrongs: numberStrongs(attribute(tag, "data-ns"), testament),
          untranslated: untranslatedDepth > 0 || openWord.text.trim() === "◎"
        };
        if (current) current.items.push(item);
        else issues.push(`word-outside-verse:${openWord.text}`);
        openWord = null;
      }
      continue;
    }
    if (name === "br" || name === "p" || name === "blockquote") {
      if (current && !openWord) current.items.push({ kind: "text", text: " " });
    }
  }
  return { verses, headings, attribution, issues };
}

/**
 * Reading text of a verse: words and separators in order, without editor
 * notes, verse numbers, headings or the ◎ markers of untranslated words.
 */
export function verseReadingText(verse: ConcordanceVerse): {
  text: string;
  /** Character range of each item in `text` (-1 for omitted markers). */
  ranges: Array<{ start: number; end: number } | null>;
} {
  let text = "";
  const ranges: Array<{ start: number; end: number } | null> = [];
  const append = (value: string) => {
    const normalized = value.replace(/\s+/gu, " ");
    if (normalized === " " && (text.length === 0 || text.endsWith(" "))) return;
    text += text.endsWith(" ") ? normalized.replace(/^ /u, "") : normalized;
  };
  for (const item of verse.items) {
    if (item.kind === "text") {
      append(item.text);
      ranges.push(null);
      continue;
    }
    if (item.untranslated) {
      ranges.push({ start: text.length, end: text.length });
      continue;
    }
    const surface = item.surface.replace(/\s+/gu, " ").trim();
    const start = text.length;
    text += surface;
    ranges.push({ start, end: text.length });
  }
  const trimmedStart = text.length - text.trimStart().length;
  return {
    text: text.trim(),
    ranges: ranges.map((range) =>
      range
        ? {
            start: Math.max(0, range.start - trimmedStart),
            end: Math.max(0, range.end - trimmedStart)
          }
        : null
    )
  };
}
