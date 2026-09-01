const RANGE_RESOURCES = new Set([
  "mhcc",
  "jfb",
  "mhy-fr",
  "bible-annotee",
  "kd",
  "fourfold-gospel",
  "luther"
]);

const HOMILY_RESOURCES = new Set(["fre-aug", "fre-chry"]);
const SECTION_RESOURCES = new Set([
  "calvin",
  "catena-aurea",
  "king-comments",
  "lightfoot",
  "luther",
  "mhc"
]);

export const parsePassage = (passage) => {
  const match = String(passage ?? "").match(/^(\d+)-(\d+)-(\d+)$/);
  if (!match) return null;
  return {
    book: Number(match[1]),
    chapter: Number(match[2]),
    verse: Number(match[3])
  };
};

export const comparePassages = (left, right) => {
  const a = parsePassage(left);
  const b = parsePassage(right);
  if (!a || !b)
    return String(left).localeCompare(String(right), "en", { numeric: true });
  return a.book - b.book || a.chapter - b.chapter || a.verse - b.verse;
};

export const normalizeReferenceQuery = (value) =>
  String(value)
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const matchPassageReference = (passages, query, formatPassage) => {
  const normalizedQuery = normalizeReferenceQuery(query);
  const candidates = passages.map((passage) => [
    passage,
    normalizeReferenceQuery(formatPassage(passage))
  ]);
  return (
    candidates.find(([, label]) => label === normalizedQuery)?.[0] ??
    candidates.find(([, label]) => label.includes(normalizedQuery))?.[0] ??
    null
  );
};

const visibleText = (html) =>
  String(html ?? "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

const commentaryHtml = (entry) =>
  entry.translation?.html || entry.source?.html || "";

const validSameChapterRange = (
  entry,
  start,
  end,
  { anchorMustStart = true } = {}
) => {
  const anchor = parsePassage(entry.passage);
  if (!anchor || end <= start || end > 176) return null;
  if (
    anchorMustStart
      ? start !== anchor.verse
      : anchor.verse < start || anchor.verse > end
  )
    return null;
  return {
    start: `${anchor.book}-${anchor.chapter}-${start}`,
    end: `${anchor.book}-${anchor.chapter}-${end}`
  };
};

export const parseDeclaredRange = (entry) => {
  if (!RANGE_RESOURCES.has(entry.resource?.id)) return null;
  const anchor = parsePassage(entry.passage);
  if (!anchor || anchor.verse === 0) return null;
  const text = visibleText(commentaryHtml(entry)).slice(0, 260);
  let match = null;

  if (entry.resource.id === "mhcc") {
    match = text.match(/^Verses?\s+(\d+)\s*[-–—]\s*(\d+)\b/i);
  } else if (entry.resource.id === "jfb" || entry.resource.id === "kd") {
    const leadingRange = text.match(/^(\d+)\s*[-–—]\s*(\d+)\s*\./);
    if (leadingRange)
      return validSameChapterRange(
        entry,
        Number(leadingRange[1]),
        Number(leadingRange[2])
      );
    match = text.match(
      /(?:^|\b)[1-3]?[A-Za-z]+\.?\s+(\d+)\s*:\s*(\d+)\s*[-–—]\s*(\d+)\b/
    );
    if (match && Number(match[1]) === anchor.chapter)
      return validSameChapterRange(entry, Number(match[2]), Number(match[3]), {
        anchorMustStart: false
      });
    return null;
  } else if (entry.resource.id === "mhy-fr") {
    match = text.match(/\((\d+)\s*(?:[-–—,]|à)\s*(\d+)\)/i);
  } else if (entry.resource.id === "bible-annotee") {
    match = text.match(/^(\d+)\s*(?:[-–—]|à)\s*(\d+)\s*[.:]/i);
  } else if (entry.resource.id === "luther") {
    match = text.match(/^V\.?\s*(\d+)\s*[-–—]\s*(\d+)\b/i);
  } else if (entry.resource.id === "fourfold-gospel") {
    match = text.match(
      /^#[1-3]?[A-Za-z]+\s+(\d+)\s*:\s*(\d+)\s*[-–—]\s*(\d+)\|/i
    );
    if (match && Number(match[1]) === anchor.chapter)
      return validSameChapterRange(entry, Number(match[2]), Number(match[3]));
    return null;
  }

  return match
    ? validSameChapterRange(entry, Number(match[1]), Number(match[2]))
    : null;
};

const scope = (kind, start, end, source, confidence) => ({
  kind,
  start,
  ...(end && end !== start ? { end } : {}),
  source,
  confidence
});

export const normalizeEntryScope = (entry) => {
  const normalized = {
    ...entry,
    schemaVersion: 2,
    anchor: entry.anchor ?? entry.passage
  };
  const anchor = parsePassage(entry.passage);
  if (!anchor) return normalized;

  if (
    entry.scope?.kind &&
    entry.scope.start &&
    entry.scope.source !== "source-anchor"
  ) {
    normalized.scope = { ...entry.scope };
    return normalized;
  }

  let structuredEnd = entry.passageEnd;
  if (!structuredEnd && Number(entry.passageEndVerse) > anchor.verse) {
    structuredEnd = `${anchor.book}-${anchor.chapter}-${Number(entry.passageEndVerse)}`;
    normalized.passageEnd = structuredEnd;
  }
  if (structuredEnd && comparePassages(structuredEnd, entry.passage) > 0) {
    normalized.scope = scope(
      "range",
      entry.passage,
      structuredEnd,
      "structured-source",
      "exact"
    );
    return normalized;
  }

  if (
    entry.editorialKind === "book-introduction" ||
    (anchor.chapter === 0 && anchor.verse === 0)
  ) {
    normalized.scope = scope(
      "book",
      entry.passage,
      null,
      "editorial-kind",
      "exact"
    );
    return normalized;
  }
  if (entry.editorialKind === "chapter-introduction" || anchor.verse === 0) {
    normalized.scope = scope(
      "chapter",
      entry.passage,
      null,
      "editorial-kind",
      "exact"
    );
    return normalized;
  }
  if (entry.resource?.id === "treasury-david") {
    normalized.scope = scope(
      "chapter",
      entry.passage,
      null,
      "resource-profile",
      "exact"
    );
    return normalized;
  }

  const parsedRange = parseDeclaredRange(entry);
  if (parsedRange) {
    normalized.passageEnd = parsedRange.end;
    normalized.scope = scope(
      "section",
      parsedRange.start,
      parsedRange.end,
      "parsed-heading",
      "high"
    );
    return normalized;
  }

  if (HOMILY_RESOURCES.has(entry.resource?.id)) {
    normalized.scope = scope(
      "homily",
      entry.passage,
      null,
      "resource-profile",
      "editorial"
    );
    return normalized;
  }
  if (SECTION_RESOURCES.has(entry.resource?.id)) {
    normalized.scope = scope(
      "section",
      entry.passage,
      null,
      "resource-profile",
      "editorial"
    );
    return normalized;
  }

  normalized.scope = scope(
    "verse",
    entry.passage,
    null,
    "source-anchor",
    "exact"
  );
  return normalized;
};

const translationKey = (translation) => translation?.sha256 ?? null;

const contiguousRuns = (entries) => {
  const sorted = [...entries].sort(
    (left, right) =>
      comparePassages(left.passage, right.passage) ||
      left.id.localeCompare(right.id)
  );
  const runs = [];
  let run = [];
  for (const entry of sorted) {
    const current = parsePassage(entry.passage);
    const previous = parsePassage(run.at(-1)?.passage);
    const adjacent =
      previous &&
      current &&
      previous.book === current.book &&
      previous.chapter === current.chapter &&
      current.verse === previous.verse + 1;
    if (run.length && !adjacent) {
      runs.push(run);
      run = [];
    }
    run.push(entry);
  }
  if (run.length) runs.push(run);
  return runs;
};

export const normalizeRepeatedSourceEntries = (entries) => {
  const candidates = new Map();
  const untouched = [];
  for (const entry of entries) {
    if (entry.sourceAnchors?.length || !entry.source?.sha256) {
      const preserved = entry.sourceAnchors?.length
        ? {
            ...entry,
            sourceAnchors: entry.sourceAnchors.map((anchor) => ({
              ...anchor,
              provenance: anchor.provenance ?? entry.source?.provenance ?? null
            }))
          }
        : entry;
      untouched.push(normalizeEntryScope(preserved));
      continue;
    }
    const key = entry.source.sha256;
    const group = candidates.get(key) ?? [];
    group.push(entry);
    candidates.set(key, group);
  }

  const normalized = [...untouched];
  for (const group of candidates.values()) {
    for (const run of contiguousRuns(group)) {
      if (run.length < 2) {
        normalized.push(normalizeEntryScope(run[0]));
        continue;
      }
      const first = run[0];
      const last = run.at(-1);
      const canonical = normalizeEntryScope({
        ...first,
        passageEnd: last.passage,
        sourceAnchors: run.map((entry) => ({
          id: entry.id,
          passage: entry.passage,
          provenance: entry.source.provenance ?? null
        })),
        translationVariants: run.slice(1).map((entry) => ({
          id: entry.id,
          passage: entry.passage,
          translation: entry.translation ?? null
        }))
      });
      canonical.scope = scope(
        "range",
        first.passage,
        last.passage,
        "deduplicated-repetition",
        "exact"
      );
      canonical.deduplication = {
        method: "adjacent-source-sha256",
        sourceSha256: first.source.sha256,
        sourceAnchorCount: run.length,
        distinctTranslationCount: new Set(
          run.map((entry) => translationKey(entry.translation))
        ).size
      };
      normalized.push(canonical);
    }
  }
  return normalized.sort(
    (left, right) =>
      comparePassages(left.passage, right.passage) ||
      left.id.localeCompare(right.id)
  );
};

// Kept for translation-workflow compatibility. Canonical publication must not
// call this alias selectively: exact repeated source units are resource-agnostic.
export const normalizeBarnesEntries = normalizeRepeatedSourceEntries;

export const expandBarnesEntries = (entries) =>
  entries.flatMap((entry) => {
    if (entry.resource?.id !== "barnes" || !entry.sourceAnchors?.length)
      return [{ ...entry }];
    const variants = new Map(
      (entry.translationVariants ?? []).map((variant) => [
        variant.id,
        variant.translation
      ])
    );
    return entry.sourceAnchors.map((anchor, index) => ({
      ...entry,
      schemaVersion: 1,
      id: anchor.id,
      passage: anchor.passage,
      translation:
        index === 0 ? entry.translation : (variants.get(anchor.id) ?? null),
      passageEnd: undefined,
      scope: undefined,
      sourceAnchors: undefined,
      translationVariants: undefined,
      deduplication: undefined
    }));
  });

export const entryCoversPassage = (entry, passage) => {
  const current = parsePassage(passage);
  const start = parsePassage(entry.scope?.start ?? entry.passage);
  const end = parsePassage(
    entry.scope?.end ?? entry.passageEnd ?? entry.passage
  );
  if (!current || !start || !end) return entry.passage === passage;
  if (entry.scope?.kind === "chapter") {
    return (
      entry.passage === passage ||
      (current.book === start.book &&
        current.chapter === start.chapter &&
        current.verse > 0)
    );
  }
  if (!["range", "section"].includes(entry.scope?.kind) || !entry.scope?.end)
    return entry.passage === passage;
  return (
    comparePassages(passage, `${start.book}-${start.chapter}-${start.verse}`) >=
      0 &&
    comparePassages(passage, `${end.book}-${end.chapter}-${end.verse}`) <= 0
  );
};
