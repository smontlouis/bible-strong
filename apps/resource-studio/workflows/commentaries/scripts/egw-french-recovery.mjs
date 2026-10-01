import { createHash } from "node:crypto";

export const hash = (value) => createHash("sha256").update(value).digest("hex");

const entities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  copy: "©",
  reg: "®"
};

export const decodeText = (value) =>
  String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, name) => {
    if (!name.startsWith("#")) return entities[name] ?? entity;
    const code =
      name[1].toLowerCase() === "x"
        ? Number.parseInt(name.slice(2), 16)
        : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : entity;
  });

// Ignore markup, typographic quotation marks and whitespace only. Words, numbers,
// accents, punctuation and order must remain identical; no fuzzy correspondence.
export const correspondenceText = (html) =>
  decodeText(
    html
      .replace(/<\/?(?:p|div|br|h[1-6])\b[^>]*>/giu, " ")
      .replace(/<[^>]*>/gu, "")
  )
    .normalize("NFKC")
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/\s+/gu, " ")
    .trim();

const attribute = (tag, name) =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "iu")
    .exec(tag)
    ?.slice(1)
    .find((value) => value !== undefined) ?? "";

export const extractLegacyBody = (html) => {
  let depth = 0;
  let start = null;
  let body = null;
  for (const token of html.matchAll(/<\/?span\b[^>]*>/giu)) {
    if (start === null) {
      if (
        !/^<\//u.test(token[0]) &&
        attribute(token[0], "class").split(/\s+/u).includes("egw_content")
      ) {
        if (body !== null) throw new Error("egw-legacy-multiple-bodies");
        start = token.index + token[0].length;
        depth = 1;
      }
    } else if (/^<\//u.test(token[0])) {
      depth -= 1;
      if (depth === 0) {
        body = html.slice(start, token.index);
        start = null;
      }
    } else if (!/\/\s*>$/u.test(token[0])) depth += 1;
  }
  if (body === null || start !== null || !correspondenceText(body)) {
    throw new Error("egw-legacy-body-invalid");
  }
  return body;
};

export const extractPublishedDocument = (html) => {
  const match =
    /^<h3>([\s\S]*?)<\/h3><h4>([\s\S]*?)<\/h4><p><strong>([\s\S]*?)<\/strong><\/p>([\s\S]*?)(<p><a class="external-source"[^>]*>[\s\S]*?<\/a><\/p>)$/u.exec(
      html
    );
  if (!match || !correspondenceText(match[4]))
    throw new Error("egw-published-document-invalid");
  return {
    bookTitle: decodeText(match[1]),
    sectionTitle: decodeText(match[2]),
    reference: decodeText(match[3]),
    body: match[4]
  };
};

const french = new Set(
  "ainsi avec avoir cette comme dans des dieu elle est mais nous par pas pour que qui seigneur son sur une vous les le la du et il au aux ses leur cet ces ils était c'est".split(
    " "
  )
);
const english = new Set(
  "and are as be but by for from god has his in is lord not of that the their this to was with".split(
    " "
  )
);

export const translationIssues = (sourceBody, translatedBody) => {
  const source = correspondenceText(sourceBody);
  const target = correspondenceText(translatedBody);
  const words = target.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  const f = words.filter((word) => french.has(word)).length;
  const e = words.filter((word) => english.has(word)).length;
  const issues = [];
  if (target === source) issues.push("identical-to-source");
  if (words.length > 15 && e > f * 1.35) issues.push("probably-english");
  if (
    source.length > 150 &&
    (target.length < source.length * 0.5 || target.length > source.length * 2.2)
  )
    issues.push("length-outlier");
  if (
    /<\s*(?:script|iframe|object|embed|style|svg)\b|\son\w+\s*=|javascript:/iu.test(
      translatedBody
    )
  )
    issues.push("unsafe-html");
  const destinations = (html) =>
    [...html.matchAll(/<a\b[^>]*>/giu)].map((match) =>
      decodeText(attribute(match[0], "href"))
    );
  if (
    JSON.stringify(destinations(sourceBody)) !==
    JSON.stringify(destinations(translatedBody))
  )
    issues.push("source-links-changed");
  return issues;
};

export const reconcileParagraph = ({ document, historical, variants }) => {
  let published;
  try {
    published = extractPublishedDocument(document.content);
  } catch {
    return { status: "review", reason: "published-structure", id: document.id };
  }
  const sourceSha256 = hash(document.content);
  const base = { id: document.id, sourceSha256, ...published };
  if (!historical)
    return { ...base, status: "missing", reason: "absent-from-legacy" };
  let sourceBody;
  try {
    sourceBody = extractLegacyBody(historical.content_html);
  } catch {
    return { ...base, status: "review", reason: "legacy-structure" };
  }
  if (correspondenceText(published.body) !== correspondenceText(sourceBody)) {
    return {
      ...base,
      status: "review",
      reason: "source-changed",
      historicalBody: sourceBody
    };
  }
  const candidates = [];
  const rejected = [];
  for (const variant of variants) {
    try {
      const body = extractLegacyBody(variant.content_html);
      const issues = translationIssues(sourceBody, body);
      if (issues.length)
        rejected.push({ frenchSha256: variant.french_sha256, issues });
      else
        candidates.push({
          body,
          frenchSha256: variant.french_sha256,
          occurrences: variant.occurrences
        });
    } catch {
      rejected.push({
        frenchSha256: variant.french_sha256,
        issues: ["legacy-structure"]
      });
    }
  }
  if (!candidates.length)
    return {
      ...base,
      status: variants.length ? "review" : "missing",
      reason: variants.length ? "translation-quality" : "not-translated",
      rejected
    };
  // Frequency makes the choice reproducible, but does not claim editorial approval.
  // Ties between different texts remain explicit review tasks.
  const groups = new Map();
  for (const candidate of candidates) {
    const fingerprint = correspondenceText(candidate.body);
    const current = groups.get(fingerprint);
    if (current) {
      current.occurrences += candidate.occurrences;
      current.variants.push(candidate.frenchSha256);
    } else
      groups.set(fingerprint, {
        ...candidate,
        variants: [candidate.frenchSha256]
      });
  }
  const ranked = [...groups.values()].sort(
    (a, b) =>
      b.occurrences - a.occurrences ||
      a.frenchSha256.localeCompare(b.frenchSha256)
  );
  const selected = ranked[0];
  if (ranked[1]?.occurrences === selected.occurrences) {
    return {
      ...base,
      status: "review",
      reason: "tied-variants",
      candidates: ranked,
      rejected
    };
  }
  return {
    ...base,
    status: "recovered",
    translatedBody: selected.body,
    historicalSourceSha256: historical.source_sha256,
    selectedFrenchSha256: selected.frenchSha256,
    selection:
      ranked.length === 1
        ? "only-distinct-eligible-text"
        : "most-used-eligible-historical-text",
    candidateCount: candidates.length,
    distinctTextCount: ranked.length,
    selectedOccurrences: selected.occurrences,
    rejected
  };
};
