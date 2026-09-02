import {
  BIBLE_REFERENCE_PARSER_VERSION,
  createBibleReferenceParser
} from "../../../../../packages/bible-reference-parser/src/referenceParser.js";

export const COMMENTARY_LINK_NORMALIZATION_REVISION =
  "commentary-links-osis-v1";
export const COMMENTARY_BCV_PARSER_VERSION = BIBLE_REFERENCE_PARSER_VERSION;

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

const parsers = {
  en: createBibleReferenceParser("en"),
  fr: createBibleReferenceParser("fr")
};
const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/gu;
const ANCHOR_TOKEN_PATTERN = /^<\/?a(?:\s[^>]*)?>$/iu;
const REFERENCE_TAIL_PATTERN = /^[\s.,;:()[\]{}—–-]*$/u;
const JUNK_DOMAINS = new Set([
  "28-29.su",
  "biblehub.com",
  "ref.ly",
  "www.compassion.com"
]);
const rejectedBcvLabel = (label) => {
  const trimmed = label.trim();
  return (
    /^le\s+(?:chapitre|texte|verset)\b/iu.test(trimmed) ||
    /^(?:le|la|les)\s+\d+\s*$/iu.test(trimmed) ||
    /^est\b[^\p{L}\p{N}]*\d/u.test(trimmed)
  );
};

const decodeEntity = (entity) => {
  const normalized = entity.toLowerCase();
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
  decodeTextWithOffsets(String(html).replace(/<[^>]*>/gu, " "))
    .text.replace(/\s+/gu, " ")
    .trim();

const readAttribute = (tag, name) => {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "iu"
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
};

const passageContext = (passage) => {
  const [book, chapter, verse] = String(passage ?? "")
    .split("-")
    .map(Number);
  const osisBook = OSIS_BOOKS[book - 1];
  if (!osisBook || !Number.isInteger(chapter) || chapter < 1) return "";
  return `${osisBook}.${chapter}${verse > 0 ? `.${verse}` : ""}`;
};

const validOsis = (osis) =>
  /^(?:[1-4]?[A-Za-z]+\.\d+(?:\.\d+)?)(?:-(?:[1-4]?[A-Za-z]+\.)?\d+(?:\.\d+)?)?(?:,(?:[1-4]?[A-Za-z]+\.\d+(?:\.\d+)?)(?:-(?:[1-4]?[A-Za-z]+\.)?\d+(?:\.\d+)?)?)*$/u.test(
    osis
  );

const candidatesFor = (text, preferredLanguage, context = "") => {
  const languages = preferredLanguage === "fr" ? ["fr", "en"] : ["en", "fr"];
  const candidates = [];
  for (const [priority, language] of languages.entries()) {
    const parsed = context
      ? parsers[language].parseWithContext(text, context).osis_and_indices()
      : parsers[language].parse(text).osis_and_indices();
    for (const candidate of parsed) {
      const [start, end] = candidate.indices;
      if (
        !validOsis(candidate.osis) ||
        start === undefined ||
        end === undefined ||
        end <= start
      )
        continue;
      if (rejectedBcvLabel(text.slice(start, end))) continue;
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

const exactOsis = (text, language, context = "") => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  for (const candidate of candidatesFor(trimmed, language, context)) {
    if (
      /^\s*$/u.test(trimmed.slice(0, candidate.start)) &&
      REFERENCE_TAIL_PATTERN.test(trimmed.slice(candidate.end))
    ) {
      return candidate.osis;
    }
  }
  return "";
};

const parseHrefWithBcv = (href) => {
  const decoded = decodeURIComponent(href).replace(/^\//u, "");
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

const providerOsis = (resourceId, href) => {
  const normalizedHref = String(href).replace(/&amp;/giu, "&");
  if (
    (resourceId === "acbc" || resourceId === "barnes") &&
    /^\/[1-4]?[A-Za-z]+_\d+\.\d+$/u.test(normalizedHref)
  ) {
    return parseHrefWithBcv(normalizedHref.replace("_", "."));
  }
  if (
    resourceId === "aquifer-fr" &&
    /^https:\/\/ref\.ly\//iu.test(normalizedHref)
  ) {
    return parseHrefWithBcv(new URL(normalizedHref).pathname);
  }
  if (
    resourceId === "mhy-fr" &&
    /^[1-4]?[A-Za-z]{2,4}\d+[.:]\d+/u.test(normalizedHref)
  ) {
    return parseHrefWithBcv(normalizedHref);
  }
  if (resourceId === "calvin" && normalizedHref.startsWith("?scrBook=")) {
    const parameters = new URLSearchParams(
      normalizedHref.slice(1).split("#")[0]
    );
    const book = parameters.get("scrBook");
    const chapter = parameters.get("scrCh");
    const verse = parameters.get("scrV");
    return book && chapter
      ? parseHrefWithBcv(`${book}.${chapter}${verse ? `.${verse}` : ""}`)
      : "";
  }
  return "";
};

const externalSource = (href, label) => {
  if (!/^https?:\/\//iu.test(href) || !label) return null;
  try {
    const url = new URL(href);
    if (JUNK_DOMAINS.has(url.hostname.toLowerCase())) return null;
    return { label, url: url.href, policy: "metadata-only" };
  } catch {
    return null;
  }
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
    const href = readAttribute(frame.tag, "href").trim();
    const label = stripMarkup(frame.html);
    state.stats.anchorsRemoved += 1;
    let osis = providerOsis(state.resourceId, href);
    let source = "provider-href";
    if (!osis && href && label) {
      osis = exactOsis(label, state.language);
      source = "anchor-label";
    }
    if (osis) {
      stack.at(-1).html += state.registerReference(
        frame.html,
        label,
        osis,
        source,
        "exact"
      );
      state.stats.providerReferences += source === "provider-href" ? 1 : 0;
      continue;
    }
    const retained = externalSource(href, label);
    if (retained) {
      state.externalSources.push(retained);
      state.stats.externalSources += 1;
    } else if (href) {
      state.stats.discardedLinks += 1;
    }
    stack.at(-1).html += frame.html;
  }
  stack.at(-1).html += html.slice(cursor);
  while (stack.length > 1) {
    const frame = stack.pop();
    stack.at(-1).html += frame.html;
  }
  return stack[0].html;
};

const transformSemanticReferences = (html, state) =>
  html
    .replace(
      /<span\b[^>]*class=["']ref["'][^>]*>([\s\S]*?)<\/span>/giu,
      (match, inner) => {
        const label = stripMarkup(inner);
        const declaredOsis = readAttribute(match, "data-osis").replace(
          /^Bible:/iu,
          ""
        );
        const osis =
          (declaredOsis && parseHrefWithBcv(declaredOsis)) ||
          exactOsis(label, state.language) ||
          exactOsis(label, state.language, state.context);
        if (!osis) return match;
        state.stats.semanticReferences += 1;
        return state.registerReference(
          inner,
          label,
          osis,
          declaredOsis ? "osis-attribute" : "source-marker",
          "exact"
        );
      }
    )
    .replace(/<scripRef\b[^>]*>([\s\S]*?)<\/scripRef>/giu, (match, inner) => {
      const label = stripMarkup(inner);
      const osis =
        exactOsis(label, state.language) ||
        exactOsis(label, state.language, state.context);
      if (!osis) return inner;
      state.stats.semanticReferences += 1;
      return state.registerReference(
        inner,
        label,
        osis,
        "source-marker",
        "exact"
      );
    });

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
    const label = decoded.text.slice(candidate.start, candidate.end);
    if (rejectedBcvLabel(label)) {
      result += inner;
      cursor = end;
      continue;
    }
    result += state.registerReference(
      inner,
      label,
      candidate.osis,
      "bcv-text",
      "high"
    );
    state.stats.bcvReferences += 1;
    cursor = end;
  }
  return result + raw.slice(cursor);
};

const annotateResidualText = (html, state) => {
  let cursor = 0;
  let result = "";
  let skippedDepth = 0;
  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const token = match[0];
    const text = html.slice(cursor, match.index);
    result += skippedDepth ? text : annotateText(text, state);
    const opensSkipped =
      /^<(?:script|style|code|pre)\b/iu.test(token) ||
      (/^<span\b/iu.test(token) &&
        /\bclass=["'](?:bible-ref|source-ref)["']/iu.test(token));
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

export const normalizeCommentaryContent = ({
  html,
  resourceId,
  language,
  passage,
  references = null,
  externalSources = null
}) => {
  if (!html)
    return {
      html: html ?? "",
      references: [],
      externalSources: [],
      stats: emptyStats()
    };
  if (Array.isArray(references) && /\bdata-reference-id=/u.test(html)) {
    const rejectedIds = new Set(
      references
        .filter(
          (reference) =>
            reference.source === "bcv-text" && rejectedBcvLabel(reference.label)
        )
        .map((reference) => reference.id)
    );
    const retainedReferences = references.filter(
      (reference) => !rejectedIds.has(reference.id)
    );
    let retainedHtml = html;
    for (const id of rejectedIds) {
      retainedHtml = retainedHtml.replace(
        new RegExp(
          `<span\\s+class="bible-ref"\\s+data-reference-id="${id}">([\\s\\S]*?)<\\/span>`,
          "gu"
        ),
        "$1"
      );
    }
    const curatedExternalSources = (externalSources ?? [])
      .map((source) => externalSource(source.url, source.label))
      .filter(Boolean);
    const stats = {
      ...emptyStats(),
      references: retainedReferences.length,
      externalSources: curatedExternalSources.length
    };
    stats.providerReferences = retainedReferences.filter(
      (reference) => reference.source === "provider-href"
    ).length;
    stats.semanticReferences = retainedReferences.filter(
      (reference) =>
        reference.source === "osis-attribute" ||
        reference.source === "source-marker"
    ).length;
    stats.bcvReferences = retainedReferences.filter(
      (reference) => reference.source === "bcv-text"
    ).length;
    let nextReferenceNumber =
      Math.max(
        0,
        ...retainedReferences.map(
          (reference) => Number(reference.id.slice(1)) || 0
        )
      ) + 1;
    const state = {
      resourceId,
      language: language === "fr" ? "fr" : "en",
      context: passageContext(passage),
      references: retainedReferences,
      externalSources: curatedExternalSources,
      stats,
      registerReference: (inner, label, osis, source, confidence) => {
        const id = `r${nextReferenceNumber}`;
        nextReferenceNumber += 1;
        retainedReferences.push({
          id,
          kind: "bible",
          osis,
          label,
          source,
          confidence
        });
        stats.references += 1;
        return `<span class="bible-ref" data-reference-id="${id}">${inner}</span>`;
      }
    };
    const normalizedHtml = rejectedIds.size
      ? annotateResidualText(retainedHtml, state)
      : retainedHtml;
    return {
      html: normalizedHtml.replace(/<a\b[^>]*$/giu, ""),
      references: retainedReferences,
      externalSources: curatedExternalSources,
      stats
    };
  }
  const normalizedReferences = [];
  const normalizedExternalSources = (externalSources ?? [])
    .map((source) => externalSource(source.url, source.label))
    .filter(Boolean);
  const stats = emptyStats();
  const state = {
    resourceId,
    language: language === "fr" ? "fr" : "en",
    context: passageContext(passage),
    references: normalizedReferences,
    externalSources: normalizedExternalSources,
    stats,
    registerReference: (inner, label, osis, source, confidence) => {
      const id = `r${normalizedReferences.length + 1}`;
      normalizedReferences.push({
        id,
        kind: "bible",
        osis,
        label,
        source,
        confidence
      });
      stats.references += 1;
      return `<span class="bible-ref" data-reference-id="${id}">${inner}</span>`;
    }
  };
  let normalizedHtml = transformAnchors(String(html), state);
  normalizedHtml = transformSemanticReferences(normalizedHtml, state);
  normalizedHtml = annotateResidualText(normalizedHtml, state);
  normalizedHtml = normalizedHtml.replace(/<a\b[^>]*$/giu, "");
  const deduplicatedSources = [
    ...new Map(
      normalizedExternalSources.map((source) => [
        `${source.url}\u0000${source.label}`,
        source
      ])
    ).values()
  ];
  stats.externalSources = deduplicatedSources.length;
  return {
    html: normalizedHtml,
    references: normalizedReferences,
    externalSources: deduplicatedSources,
    stats
  };
};

export const normalizeEntryLinks = (entry) => {
  const stats = emptyStats();
  const normalizeContent = (content) => {
    if (!content?.html) return content;
    const normalized = normalizeCommentaryContent({
      html: content.html,
      resourceId: entry.resource.id,
      language: content.language,
      passage: entry.passage,
      references: content.references,
      externalSources: content.externalSources
    });
    addStats(stats, normalized.stats);
    const result = {
      ...content,
      html: normalized.html
    };
    delete result.references;
    delete result.externalSources;
    if (normalized.references.length) result.references = normalized.references;
    if (normalized.externalSources.length)
      result.externalSources = normalized.externalSources;
    return result;
  };
  const normalized = {
    ...entry,
    source: normalizeContent(entry.source),
    translation: normalizeContent(entry.translation)
  };
  if (entry.translationVariants) {
    normalized.translationVariants = entry.translationVariants.map(
      (variant) => ({
        ...variant,
        translation: normalizeContent(variant.translation)
      })
    );
  }
  return { entry: normalized, stats };
};

export const emptyStats = () => ({
  references: 0,
  providerReferences: 0,
  semanticReferences: 0,
  bcvReferences: 0,
  anchorsRemoved: 0,
  discardedLinks: 0,
  externalSources: 0
});

export const addStats = (target, source) => {
  for (const key of Object.keys(target)) target[key] += source[key] ?? 0;
  return target;
};

export const isValidCommentaryReference = (reference) =>
  reference?.kind === "bible" &&
  /^r\d+$/u.test(reference.id) &&
  validOsis(reference.osis) &&
  typeof reference.label === "string" &&
  [
    "provider-href",
    "anchor-label",
    "osis-attribute",
    "source-marker",
    "bcv-text"
  ].includes(reference.source) &&
  ["exact", "high"].includes(reference.confidence);
