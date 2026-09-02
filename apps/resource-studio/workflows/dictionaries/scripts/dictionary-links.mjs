import {
  BIBLE_REFERENCE_PARSER_VERSION,
  createBibleReferenceParser
} from "../../../../../packages/bible-reference-parser/src/referenceParser.js";

export const DICTIONARY_LINK_NORMALIZATION_REVISION =
  "dictionary-links-bible-strong-uri-v2";
export const DICTIONARY_BCV_PARSER_VERSION = BIBLE_REFERENCE_PARSER_VERSION;
export const TRANSLATION_WORDS_WORK = "unfoldingword-translation-words";

const OSIS_BOOKS = [
  "Gen",
  "Exod",
  "Lev",
  "Num",
  "Deut",
  "Josh",
  "Judg",
  "Ruth",
  "1Sam",
  "2Sam",
  "1Kgs",
  "2Kgs",
  "1Chr",
  "2Chr",
  "Ezra",
  "Neh",
  "Esth",
  "Job",
  "Ps",
  "Prov",
  "Eccl",
  "Song",
  "Isa",
  "Jer",
  "Lam",
  "Ezek",
  "Dan",
  "Hos",
  "Joel",
  "Amos",
  "Obad",
  "Jonah",
  "Mic",
  "Nah",
  "Hab",
  "Zeph",
  "Hag",
  "Zech",
  "Mal",
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev",
  "Tob",
  "Jdt",
  "Wis",
  "Sir",
  "Bar",
  "1Macc",
  "2Macc"
];
const bookNumbers = new Map(OSIS_BOOKS.map((book, index) => [book, index + 1]));

const parsers = {
  en: createBibleReferenceParser("en"),
  fr: createBibleReferenceParser("fr")
};
const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/gu;
const ANCHOR_TOKEN_PATTERN = /^<\/?a(?:\s[^>]*)?>$/iu;
const REFERENCE_TAIL_PATTERN = /^[\s.,;:()[\]{}—–-]*$/u;
const TRANSLATION_WORDS_STRONG_PATTERN = /\b(H\d{4}|G\d{5})\b/gu;

const decodeEntity = (entity) => {
  const normalized = entity.toLocaleLowerCase();
  if (normalized === "&nbsp;") return " ";
  if (normalized === "&amp;") return "&";
  if (normalized === "&quot;") return '"';
  if (normalized === "&apos;" || normalized === "&#39;") return "'";
  if (normalized === "&lt;") return "<";
  if (normalized === "&gt;") return ">";
  const decimal = /^&#(\d+);$/u.exec(entity);
  if (decimal) return String.fromCodePoint(Number(decimal[1]));
  const hexadecimal = /^&#x([\da-f]+);$/iu.exec(entity);
  if (hexadecimal)
    return String.fromCodePoint(Number.parseInt(hexadecimal[1], 16));
  return entity;
};

const decodeHtmlText = (raw) =>
  String(raw).replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/giu, (entity) =>
    decodeEntity(entity)
  );

const decodeTextWithOffsets = (raw) => {
  let text = "";
  const starts = [];
  const ends = [];
  for (let index = 0; index < raw.length;) {
    const entity =
      raw[index] === "&"
        ? /^&(?:#\d+|#x[\da-f]+|[a-z]+);/iu.exec(raw.slice(index))
        : null;
    const source = entity?.[0] ?? raw[index];
    const decoded = entity ? decodeEntity(source) : source;
    for (let unit = 0; unit < decoded.length; unit += 1) {
      text += decoded[unit];
      starts.push(index);
      ends.push(index + source.length);
    }
    index += source.length;
  }
  return { text, starts, ends };
};

const stripMarkup = (html) =>
  decodeHtmlText(String(html).replace(/<[^>]*>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();

const readAttribute = (tag, name) => {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "iu"
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
};

const escapeAttribute = (value) =>
  String(value).replace(/&/gu, "&amp;").replace(/"/gu, "&quot;");

const rejectedBcvLabel = (label) => {
  const trimmed = label.trim();
  return (
    /^le\s+(?:chapitre|texte|verset)\b/iu.test(trimmed) ||
    /^(?:le|la|les)\s+\d+\s*$/iu.test(trimmed) ||
    /^est\b[^\p{L}\p{N}]*\d/iu.test(trimmed)
  );
};

const validOsis = (osis) =>
  /^(?:[1-4]?[A-Za-z]+\.\d+(?:\.\d+)?)(?:-(?:[1-4]?[A-Za-z]+\.)?\d+(?:\.\d+)?)?(?:,(?:[1-4]?[A-Za-z]+\.\d+(?:\.\d+)?)(?:-(?:[1-4]?[A-Za-z]+\.)?\d+(?:\.\d+)?)?)*$/u.test(
    osis
  );

const parseCompleteReference = (value) => {
  let decoded;
  try {
    decoded = decodeURIComponent(decodeHtmlText(String(value)));
  } catch {
    decoded = decodeHtmlText(String(value));
  }
  decoded = decoded
    .replace(/^bible:\/\//iu, "")
    .replace(/^\//u, "")
    .trim();
  if (!decoded) return "";
  for (const language of ["en", "fr"]) {
    const parsed = parsers[language].parse(decoded);
    const matches = parsed.osis_and_indices();
    let cursor = 0;
    let complete = matches.length > 0;
    for (const match of matches) {
      const [start, end] = match.indices;
      if (!/^[\s,;]*$/u.test(decoded.slice(cursor, start))) complete = false;
      cursor = end;
    }
    if (!/^[\s,;]*$/u.test(decoded.slice(cursor))) complete = false;
    const osis = parsed.osis();
    if (complete && validOsis(osis)) return osis;
  }
  return "";
};

const candidatesFor = (text, preferredLanguage) => {
  const languages = preferredLanguage === "fr" ? ["fr", "en"] : ["en", "fr"];
  const candidates = [];
  for (const [priority, language] of languages.entries()) {
    for (const candidate of parsers[language].parse(text).osis_and_indices()) {
      const [start, end] = candidate.indices;
      if (
        !validOsis(candidate.osis) ||
        start === undefined ||
        end === undefined ||
        end <= start
      )
        continue;
      const label = text.slice(start, end);
      if (!/\d/u.test(label) || rejectedBcvLabel(label)) continue;
      candidates.push({ osis: candidate.osis, start, end, priority });
    }
  }
  candidates.sort(
    (left, right) =>
      left.start - right.start ||
      right.end - right.start - (left.end - left.start) ||
      left.priority - right.priority
  );
  const selected = [];
  for (const candidate of candidates) {
    if (
      !selected.some(
        (current) =>
          candidate.start < current.end && current.start < candidate.end
      )
    )
      selected.push(candidate);
  }
  return selected.sort((left, right) => left.start - right.start);
};

const exactOsis = (text, language) => {
  const trimmed = text.trim();
  if (!trimmed || rejectedBcvLabel(trimmed)) return "";
  for (const candidate of candidatesFor(trimmed, language)) {
    if (
      /^\s*$/u.test(trimmed.slice(0, candidate.start)) &&
      REFERENCE_TAIL_PATTERN.test(trimmed.slice(candidate.end))
    ) {
      return candidate.osis;
    }
  }
  return "";
};

const bibleLink = (inner, osis) => {
  const escaped = escapeAttribute(osis);
  return `<a class="verse bible-ref" href="bible://${escaped}" data-osis="${escaped}">${inner}</a>`;
};

export const normalizeTranslationWordsStrong = (value) => {
  const match = /^([HG])(\d+)$/u.exec(String(value).trim().toLocaleUpperCase());
  if (!match) return null;
  const [, prefix, digits] = match;
  if (prefix === "H" && digits.length === 4) return `H${digits}`;
  if (
    prefix === "G" &&
    digits.length === 5 &&
    (digits.endsWith("0") || digits.endsWith("5"))
  )
    return `G${digits.slice(0, 4)}`;
  return null;
};

const strongLink = (inner, sourceCode, canonicalCode) => {
  const prefix = canonicalCode[0];
  const number = canonicalCode.slice(1);
  return `<a class="strong-ref" href="strong://${canonicalCode}" data-strong-number="${number}" data-strong-book="${prefix === "H" ? 1 : 40}" data-strong-source="${escapeAttribute(sourceCode)}">${inner}</a>`;
};

export const isCheckedStrongUri = (href, sourceCode = "") => {
  const match = /^strong:\/\/([HG]\d{4})$/u.exec(String(href));
  if (!match) return false;
  return sourceCode
    ? normalizeTranslationWordsStrong(sourceCode) === match[1]
    : true;
};

const transformAnchors = (html, state) => {
  const stack = [{ html: "" }];
  let cursor = 0;
  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const token = match[0];
    stack.at(-1).html += html.slice(cursor, match.index);
    cursor = match.index + token.length;
    if (!ANCHOR_TOKEN_PATTERN.test(token)) {
      stack.at(-1).html += token;
      continue;
    }
    if (/^<a(?:\s|>)/iu.test(token) && !/\/\s*>$/u.test(token)) {
      stack.push({ html: "", tag: token });
      continue;
    }
    if (!/^<\/a\s*>$/iu.test(token) || stack.length === 1) continue;
    const frame = stack.pop();
    const href = decodeHtmlText(readAttribute(frame.tag, "href")).trim();
    const className = readAttribute(frame.tag, "class");
    const label = stripMarkup(frame.html);
    const isWordLink = /(?:^|\s)word(?:\s|$)/u.test(className);
    const isBibleLink = /(?:^|\s)(?:verse|bible-ref)(?:\s|$)/u.test(className);
    const isStrongLink = /(?:^|\s)strong-ref(?:\s|$)/u.test(className);
    const strongSource =
      readAttribute(frame.tag, "data-strong-source") || label;
    if (
      state.work === TRANSLATION_WORDS_WORK &&
      isStrongLink &&
      isCheckedStrongUri(href, strongSource)
    ) {
      const canonicalCode = href.slice("strong://".length);
      state.stats.strongLinks += 1;
      state.stats.normalizedStrongLinks += 1;
      stack.at(-1).html += strongLink(frame.html, strongSource, canonicalCode);
      continue;
    }
    if (
      isWordLink &&
      !isBibleLink &&
      !href.startsWith("bible://") &&
      href &&
      !/^[a-z][a-z\d+.-]*:\/\//iu.test(href)
    ) {
      state.stats.wordLinksRetained += 1;
      stack.at(-1).html +=
        `<a class="word" href="${escapeAttribute(href)}">${frame.html}</a>`;
      continue;
    }
    let osis = href.startsWith("bible://") ? parseCompleteReference(href) : "";
    if (!osis && isBibleLink) {
      osis = parseCompleteReference(href) || exactOsis(label, state.language);
    }
    if (!osis && label) osis = exactOsis(label, state.language);
    if (osis) {
      state.references.push(osis);
      state.stats.bibleLinks += 1;
      if (href.startsWith("bible://")) state.stats.normalizedBibleLinks += 1;
      else state.stats.existingLinksConverted += 1;
      stack.at(-1).html += bibleLink(frame.html, osis);
      continue;
    }
    if (isWordLink && href && !/^[a-z][a-z\d+.-]*:\/\//iu.test(href)) {
      state.stats.wordLinksRetained += 1;
      stack.at(-1).html +=
        `<a class="word" href="${escapeAttribute(href)}">${frame.html}</a>`;
      continue;
    }
    if (href.startsWith("bible://")) state.stats.invalidBibleLinksRemoved += 1;
    else if (href) state.stats.discardedLinks += 1;
    stack.at(-1).html += frame.html;
  }
  stack.at(-1).html += html.slice(cursor);
  while (stack.length > 1) stack.at(-2).html += stack.pop().html;
  return stack[0].html;
};

const annotateText = (raw, state) => {
  if (!raw.trim()) return raw;
  const decoded = decodeTextWithOffsets(raw);
  const candidates = candidatesFor(decoded.text, state.language);
  if (!candidates.length) return raw;
  let cursor = 0;
  let result = "";
  for (const candidate of candidates) {
    const start = decoded.starts[candidate.start];
    const end = decoded.ends[candidate.end - 1];
    if (start === undefined || end === undefined || start < cursor) continue;
    result += raw.slice(cursor, start);
    const inner = raw.slice(start, end);
    result += bibleLink(inner, candidate.osis);
    state.references.push(candidate.osis);
    state.stats.bibleLinks += 1;
    state.stats.textLinksParsed += 1;
    cursor = end;
  }
  return result + raw.slice(cursor);
};

const annotateStrongText = (raw, state) => {
  if (!raw.trim() || state.work !== TRANSLATION_WORDS_WORK) return raw;
  return raw.replace(TRANSLATION_WORDS_STRONG_PATTERN, (sourceCode) => {
    const canonicalCode = normalizeTranslationWordsStrong(sourceCode);
    if (!canonicalCode) return sourceCode;
    state.stats.strongLinks += 1;
    state.stats.strongTextLinksParsed += 1;
    return strongLink(sourceCode, sourceCode, canonicalCode);
  });
};

const annotateStrongResidualText = (html, state) => {
  let cursor = 0;
  let result = "";
  let skippedDepth = 0;
  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const token = match[0];
    const text = html.slice(cursor, match.index);
    result += skippedDepth ? text : annotateStrongText(text, state);
    const opensSkipped = /^<(?:a|script|style|code|pre)\b/iu.test(token);
    const opensElement =
      /^<[a-z][^>]*>$/iu.test(token) &&
      !/^<(?:br|hr|img|input|meta|link)\b/iu.test(token) &&
      !/\/\s*>$/u.test(token);
    const closesElement = /^<\/[a-z][^>]*>$/iu.test(token);
    if (skippedDepth && opensElement) skippedDepth += 1;
    else if (opensSkipped) skippedDepth = 1;
    result += token;
    if (closesElement && skippedDepth) skippedDepth -= 1;
    cursor = match.index + token.length;
  }
  const remaining = html.slice(cursor);
  return (
    result + (skippedDepth ? remaining : annotateStrongText(remaining, state))
  );
};

const annotateResidualText = (html, state) => {
  let cursor = 0;
  let result = "";
  let skippedDepth = 0;
  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const token = match[0];
    const text = html.slice(cursor, match.index);
    result += skippedDepth ? text : annotateText(text, state);
    const opensSkipped = /^<(?:a|script|style|code|pre)\b/iu.test(token);
    const opensElement =
      /^<[a-z][^>]*>$/iu.test(token) &&
      !/^<(?:br|hr|img|input|meta|link)\b/iu.test(token) &&
      !/\/\s*>$/u.test(token);
    const closesElement = /^<\/[a-z][^>]*>$/iu.test(token);
    if (skippedDepth && opensElement) skippedDepth += 1;
    else if (opensSkipped) skippedDepth = 1;
    result += token;
    if (closesElement && skippedDepth) skippedDepth -= 1;
    cursor = match.index + token.length;
  }
  const remaining = html.slice(cursor);
  return result + (skippedDepth ? remaining : annotateText(remaining, state));
};

export const emptyDictionaryLinkStats = () => ({
  entries: 0,
  changedEntries: 0,
  bibleLinks: 0,
  strongLinks: 0,
  normalizedBibleLinks: 0,
  normalizedStrongLinks: 0,
  existingLinksConverted: 0,
  textLinksParsed: 0,
  strongTextLinksParsed: 0,
  wordLinksRetained: 0,
  invalidBibleLinksRemoved: 0,
  discardedLinks: 0,
  indexedVerseLinks: 0,
  broadReferencesNotIndexed: 0
});

export const addDictionaryLinkStats = (target, source) => {
  for (const key of Object.keys(target)) target[key] += source[key] ?? 0;
  return target;
};

export const normalizeDictionaryDefinition = ({
  html,
  language,
  work = ""
}) => {
  const stats = emptyDictionaryLinkStats();
  stats.entries = 1;
  const references = [];
  const state = {
    language: language === "en" ? "en" : "fr",
    work,
    references,
    stats
  };
  const anchored = transformAnchors(String(html ?? ""), state);
  const strongLinked = annotateStrongResidualText(anchored, state);
  const normalizedHtml = annotateResidualText(strongLinked, state).replace(
    /<a\b[^>]*$/giu,
    ""
  );
  stats.changedEntries = normalizedHtml === String(html ?? "") ? 0 : 1;
  return { html: normalizedHtml, references, stats };
};

export const expandOsisToVerseKeys = (osis, maximum = 500) => {
  const keys = [];
  const append = (book, chapter, verse) => {
    const bookNumber = bookNumbers.get(book);
    if (!bookNumber || keys.length >= maximum) return false;
    keys.push(`${bookNumber}-${chapter}-${verse}`);
    return true;
  };
  const entities = parsers.en
    .parse(osis)
    .parsed_entities()
    .flatMap((entity) => entity.entities ?? []);
  for (const entity of entities) {
    const { start, end } = entity;
    if (!start?.b || !start.c || !end?.b || !end.c || start.b !== end.b)
      return [];
    for (let chapter = start.c; chapter <= end.c; chapter += 1) {
      const chapterVerses = parsers.en.lastVerse(start.b, chapter);
      if (!chapterVerses) return [];
      const firstVerse = chapter === start.c && start.v ? start.v : 1;
      const lastVerse = chapter === end.c && end.v ? end.v : chapterVerses;
      for (let verse = firstVerse; verse <= lastVerse; verse += 1) {
        if (!append(start.b, chapter, verse)) return [];
      }
    }
  }
  return [...new Set(keys)];
};

export const isCheckedBibleUri = (href) => {
  if (!String(href).startsWith("bible://")) return false;
  const osis = parseCompleteReference(href);
  return Boolean(osis && `bible://${osis}` === href);
};
