#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  extractCorrespondenceVariants,
  normalizeCorrespondenceAlias
} from "./build-correspondences.mjs";

const execFileAsync = promisify(execFile);
const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const defaultConfigPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary.json"
);
const defaultNormalizedRoot = path.join(workflowRoot, ".local/normalized");

const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/gu;
const EXISTING_ANCHOR_PATTERN = /<a\b[^>]*>[\s\S]*?<\/a\s*>/giu;
const SKIPPED_TAG_PATTERN = /^(?:a|script|style|code|pre)$/u;
const VOID_TAG_PATTERN = /^(?:br|hr|img|input|meta|link)$/u;
const FRENCH_RISKY_HEADWORDS = new Set([
  "aller",
  "avoir",
  "devoir",
  "dire",
  "donner",
  "etre",
  "faire",
  "mettre",
  "pouvoir",
  "prendre",
  "savoir",
  "venir",
  "voir",
  "vouloir"
]);
const ENGLISH_RISKY_HEADWORDS = new Set([
  "ask",
  "be",
  "call",
  "come",
  "do",
  "feel",
  "find",
  "get",
  "give",
  "go",
  "have",
  "know",
  "leave",
  "look",
  "make",
  "say",
  "see",
  "seem",
  "take",
  "tell",
  "think",
  "try",
  "use",
  "want",
  "work"
]);
const EDITORIAL_CUE_PATTERN =
  /\b(?:See(?:\s+also)?|Voir(?:\s+aussi)?|Voyez(?:\s+aussi)?)\s+/giu;

const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

const queryJson = async (databasePath, query) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, query],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
  );
  return JSON.parse(stdout || "[]");
};

const executeSql = (databasePath, sql) =>
  new Promise((resolve, reject) => {
    const child = spawn("sqlite3", [databasePath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let errorOutput = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sqlite3-exit-${code}:${errorOutput.trim()}`));
    });
    child.stdin.end(sql);
  });

const readAttribute = (tag, name) => {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "iu"
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
};

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

const escapeAttribute = (value) =>
  String(value).replace(/&/gu, "&amp;").replace(/"/gu, "&quot;");

const escapePattern = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const letterCount = (value) =>
  [...String(value)].filter((character) => /[\p{L}\p{N}]/u.test(character))
    .length;

const normalizeSurface = (value) =>
  String(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[.;:,]+$/u, "");

const uniqueMap = (pairs) => {
  const values = new Map();
  const ambiguous = new Set();
  for (const [key, value] of pairs) {
    if (!key || ambiguous.has(key)) continue;
    const previous = values.get(key);
    if (previous && previous.id !== value.id) {
      const equivalent =
        normalizeCorrespondenceAlias(previous.word) ===
          normalizeCorrespondenceAlias(value.word) &&
        String(previous.definition ?? "") === String(value.definition ?? "");
      if (equivalent) {
        if (value.id < previous.id) values.set(key, value);
      } else {
        values.delete(key);
        ambiguous.add(key);
      }
    } else values.set(key, value);
  }
  return values;
};

const editDistance = (left, right) => {
  const previous = Array.from(
    { length: right.length + 1 },
    (_value, index) => index
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
};

const collapseEquivalentEntries = (entries) => {
  const byContent = new Map();
  for (const entry of entries) {
    const key = `${normalizeCorrespondenceAlias(entry.word)}\u0000${entry.definition ?? ""}`;
    const previous = byContent.get(key);
    if (!previous || entry.id < previous.id) byContent.set(key, entry);
  }
  return [...byContent.values()];
};

export const buildEntryResolver = (entries, work = "") => {
  const prepared = entries.map((entry) => ({
    ...entry,
    variants: extractCorrespondenceVariants(entry.word, work),
    aliases: extractCorrespondenceVariants(entry.word, work).map(
      normalizeCorrespondenceAlias
    )
  }));
  const canonicalExact = uniqueMap(
    prepared.map((entry) => [normalizeCorrespondenceAlias(entry.word), entry])
  );
  const surfaceExact = uniqueMap(
    prepared.flatMap((entry) =>
      entry.variants.map((variant) => [normalizeSurface(variant), entry])
    )
  );
  const aliasExact = uniqueMap(
    prepared.flatMap((entry) => entry.aliases.map((alias) => [alias, entry]))
  );
  const editorialBySurface = new Map();
  for (const entry of prepared) {
    const variants = new Set(entry.variants);
    for (const variant of entry.variants) {
      const base = variant.replace(/\s+\(\d+\)$/u, "").trim();
      if (base) variants.add(base);
    }
    for (const variant of variants) {
      const key = normalizeSurface(variant);
      if (!key) continue;
      const candidates = editorialBySurface.get(key) ?? [];
      if (!candidates.some((candidate) => candidate.id === entry.id))
        candidates.push(entry);
      editorialBySurface.set(key, candidates);
    }
  }
  const editorialSurfaces = [...editorialBySurface.keys()].sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  );
  const editorialPattern = editorialSurfaces.length
    ? new RegExp(
        `(${editorialSurfaces.map(escapePattern).join("|")})(?![\\p{L}\\p{N}])`,
        "iyu"
      )
    : null;
  const resolve = (value, { allowUniquePartial = false } = {}) => {
    const key = normalizeCorrespondenceAlias(value);
    const direct =
      surfaceExact.get(normalizeSurface(value)) ??
      canonicalExact.get(key) ??
      aliasExact.get(key);
    if (direct || !allowUniquePartial || key.length < 4) return direct ?? null;
    const partialMatches = collapseEquivalentEntries(
      prepared.filter((entry) =>
        entry.aliases.some(
          (alias) => alias.includes(key) || key.includes(alias)
        )
      )
    );
    if (partialMatches.length === 1) return partialMatches[0];
    const prefixed = collapseEquivalentEntries(
      prepared.filter((entry) =>
        entry.aliases.some((alias) => alias.startsWith(key))
      )
    );
    if (prefixed.length === 1) return prefixed[0];
    const tolerance = key.length >= 8 ? 2 : 1;
    const fuzzy = collapseEquivalentEntries(
      prepared.filter((entry) =>
        entry.aliases.some((alias) => {
          const firstToken = alias.split(" ")[0];
          return (
            editDistance(key, alias) <= tolerance ||
            editDistance(key, firstToken) <= tolerance
          );
        })
      )
    );
    return fuzzy.length === 1 ? fuzzy[0] : null;
  };
  const resolveEditorial = (surface, section = "") => {
    const candidates = collapseEquivalentEntries(
      editorialBySurface.get(normalizeSurface(surface)) ?? []
    );
    if (candidates.length === 1) return candidates[0];
    if (!section) return null;
    const marker = new RegExp(
      `(?:^|\\s)\\(${escapePattern(section)}\\)(?=\\s|$)`,
      "iu"
    );
    const sectionMatches = collapseEquivalentEntries(
      candidates.filter((entry) => marker.test(stripMarkup(entry.definition)))
    );
    return sectionMatches.length === 1 ? sectionMatches[0] : null;
  };
  return {
    entries: prepared,
    exact: canonicalExact,
    editorialPattern,
    resolve,
    resolveEditorial
  };
};

const canonicalWordLink = (inner, destination, origin, section = "") =>
  `<a class="word" href="${escapeAttribute(destination.word)}" data-entry-id="${destination.id}" data-link-origin="${origin}"${section ? ` data-entry-section="${escapeAttribute(section)}"` : ""}>${inner}</a>`;

const cleanExistingLinks = ({ html, entry, resolver, stats }) => {
  const retainedDestinationIds = new Set();
  const cleaned = String(html).replace(EXISTING_ANCHOR_PATTERN, (anchor) => {
    const opening = /^<a\b[^>]*>/iu.exec(anchor)?.[0] ?? "";
    const className = readAttribute(opening, "class");
    if (!/(?:^|\s)word(?:\s|$)/u.test(className)) return anchor;
    stats.sourceLinksInspected += 1;
    const inner = anchor.slice(opening.length).replace(/<\/a\s*>$/iu, "");
    const href = readAttribute(opening, "href");
    const label = stripMarkup(inner);
    const destination =
      resolver.resolve(href) ??
      resolver.resolve(label) ??
      resolver.resolve(href || label, { allowUniquePartial: true });
    if (!destination) {
      stats.unresolvedSourceLinksRemoved += 1;
      return inner;
    }
    if (destination.id === entry.id) {
      stats.selfLinksRemoved += 1;
      return inner;
    }
    retainedDestinationIds.add(destination.id);
    stats.sourceLinksRetained += 1;
    return canonicalWordLink(inner, destination, "source");
  });
  return { html: cleaned, retainedDestinationIds };
};

const candidatePattern = (candidates) => {
  if (!candidates.length) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(${candidates
      .map((candidate) => escapePattern(candidate.surface))
      .join("|")})(?![\\p{L}\\p{N}])`,
    "gu"
  );
};

const annotateText = ({
  raw,
  pattern,
  bySurface,
  usedDestinationIds,
  stats
}) => {
  if (!raw.trim() || !pattern) return raw;
  const decoded = decodeTextWithOffsets(raw);
  pattern.lastIndex = 0;
  let cursor = 0;
  let result = "";
  for (const match of decoded.text.matchAll(pattern)) {
    const destination = bySurface.get(match[1]);
    if (!destination || usedDestinationIds.has(destination.id)) continue;
    const start = decoded.starts[match.index];
    const end = decoded.ends[match.index + match[0].length - 1];
    if (start === undefined || end === undefined || start < cursor) continue;
    result += raw.slice(cursor, start);
    result += canonicalWordLink(
      raw.slice(start, end),
      destination,
      "generated"
    );
    cursor = end;
    usedDestinationIds.add(destination.id);
    stats.generatedLinks += 1;
  }
  return result + raw.slice(cursor);
};

export const buildCandidateMatcher = (candidates) => ({
  pattern: candidatePattern(candidates),
  bySurface: new Map(
    candidates.map((candidate) => [candidate.surface, candidate.destination])
  )
});

const editorialSectionAfter = (text, index) => {
  const match = /^\s*,\s*(\d+|[IVXLCDM]+)(?=\s*(?:[.;)]|$))/iu.exec(
    text.slice(index)
  );
  return match
    ? { section: match[1], end: index + match[0].length }
    : { section: "", end: index };
};

const annotateEditorialText = ({
  raw,
  entry,
  resolver,
  usedDestinationIds,
  stats
}) => {
  if (!raw.trim() || !resolver.editorialPattern) return raw;
  const decoded = decodeTextWithOffsets(raw);
  const links = [];
  EDITORIAL_CUE_PATTERN.lastIndex = 0;
  for (const cue of decoded.text.matchAll(EDITORIAL_CUE_PATTERN)) {
    let targetStart = cue.index + cue[0].length;
    while (targetStart < decoded.text.length) {
      resolver.editorialPattern.lastIndex = targetStart;
      const target = resolver.editorialPattern.exec(decoded.text);
      if (!target || target.index !== targetStart) break;
      const targetEnd = targetStart + target[0].length;
      const qualifier = editorialSectionAfter(decoded.text, targetEnd);
      const destination = resolver.resolveEditorial(
        target[1],
        qualifier.section
      );
      if (destination && destination.id !== entry.id) {
        links.push({
          start: targetStart,
          end: targetEnd,
          destination,
          section: qualifier.section
        });
        usedDestinationIds.add(destination.id);
      }
      let next = qualifier.end;
      while (/\s/u.test(decoded.text[next] ?? "")) next += 1;
      if (decoded.text[next] !== ";") break;
      next += 1;
      while (/\s/u.test(decoded.text[next] ?? "")) next += 1;
      targetStart = next;
    }
  }
  if (!links.length) return raw;
  let cursor = 0;
  let result = "";
  for (const link of links) {
    const start = decoded.starts[link.start];
    const end = decoded.ends[link.end - 1];
    if (start === undefined || end === undefined || start < cursor) continue;
    result += raw.slice(cursor, start);
    result += canonicalWordLink(
      raw.slice(start, end),
      link.destination,
      "cue",
      link.section
    );
    cursor = end;
    stats.editorialCueLinks += 1;
  }
  return result + raw.slice(cursor);
};

const transformResidualText = ({ html, transform }) => {
  let cursor = 0;
  let result = "";
  const skipped = [];
  for (const match of String(html).matchAll(HTML_TOKEN_PATTERN)) {
    const token = match[0];
    const text = html.slice(cursor, match.index);
    result += skipped.length ? text : transform(text);
    const opening = /^<([a-z][\w-]*)\b[^>]*>$/iu.exec(token);
    const closing = /^<\/([a-z][\w-]*)\s*>$/iu.exec(token);
    if (opening) {
      const tag = opening[1].toLocaleLowerCase();
      if (
        !VOID_TAG_PATTERN.test(tag) &&
        !/\/\s*>$/u.test(token) &&
        (skipped.length || SKIPPED_TAG_PATTERN.test(tag))
      )
        skipped.push(tag);
    } else if (closing && skipped.at(-1) === closing[1].toLocaleLowerCase()) {
      skipped.pop();
    }
    result += token;
    cursor = match.index + token.length;
  }
  const remaining = html.slice(cursor);
  return result + (skipped.length ? remaining : transform(remaining));
};

const annotateEditorialCues = ({
  html,
  entry,
  resolver,
  usedDestinationIds,
  stats
}) =>
  transformResidualText({
    html,
    transform: (raw) =>
      annotateEditorialText({
        raw,
        entry,
        resolver,
        usedDestinationIds,
        stats
      })
  });

const annotateResidualText = ({ html, matcher, usedDestinationIds, stats }) => {
  const { pattern, bySurface } = matcher;
  return transformResidualText({
    html,
    transform: (raw) =>
      annotateText({ raw, pattern, bySurface, usedDestinationIds, stats })
  });
};

export const buildAutomaticCandidates = ({
  work,
  language,
  resolver,
  correspondenceIndex,
  namedSubjects = []
}) => {
  const memberIds = new Set();
  const namedMemberIds = new Set();
  const namedAliases = new Set(
    namedSubjects.flatMap((subject) =>
      extractCorrespondenceVariants(subject).map(normalizeCorrespondenceAlias)
    )
  );
  for (const group of correspondenceIndex.groups ?? []) {
    const members = group.members.filter((member) => member.work === work);
    for (const member of members) memberIds.add(member.id);
    const isNamed = group.members.some(
      (member) =>
        member.work === "unfoldingword-translation-words" &&
        extractCorrespondenceVariants(member.word, member.work).some(
          (variant) => namedAliases.has(normalizeCorrespondenceAlias(variant))
        )
    );
    if (isNamed) for (const member of members) namedMemberIds.add(member.id);
  }
  const risky =
    language === "fr" ? FRENCH_RISKY_HEADWORDS : ENGLISH_RISKY_HEADWORDS;
  const pairs = [];
  for (const destination of resolver.entries) {
    if (!memberIds.has(destination.id)) continue;
    if (
      work === "easton-webster" &&
      /Webster(?:&#39;|')s 1828 Dictionary/iu.test(destination.definition ?? "")
    )
      continue;
    for (const surface of destination.variants) {
      const alias = normalizeCorrespondenceAlias(surface);
      const named = namedMemberIds.has(destination.id);
      if (
        !surface ||
        risky.has(alias) ||
        (!named && (letterCount(surface) < 4 || !/\p{Lu}/u.test(surface)))
      )
        continue;
      pairs.push([surface, destination]);
    }
  }
  const unique = uniqueMap(pairs);
  return [...unique.entries()]
    .map(([surface, destination]) => ({ surface, destination }))
    .sort(
      (left, right) =>
        right.surface.length - left.surface.length ||
        left.surface.localeCompare(right.surface, language)
    );
};

export const linkDictionaryDefinition = ({
  html,
  entry,
  resolver,
  candidates,
  matcher = buildCandidateMatcher(candidates)
}) => {
  const stats = {
    sourceLinksInspected: 0,
    sourceLinksRetained: 0,
    selfLinksRemoved: 0,
    unresolvedSourceLinksRemoved: 0,
    editorialCueLinks: 0,
    generatedLinks: 0
  };
  const cleaned = cleanExistingLinks({ html, entry, resolver, stats });
  cleaned.retainedDestinationIds.add(entry.id);
  const editoriallyLinked = annotateEditorialCues({
    html: cleaned.html,
    entry,
    resolver,
    usedDestinationIds: cleaned.retainedDestinationIds,
    stats
  });
  const linked = annotateResidualText({
    html: editoriallyLinked,
    matcher,
    usedDestinationIds: cleaned.retainedDestinationIds,
    stats
  });
  return { html: linked, stats };
};

const addStats = (target, source) => {
  for (const key of Object.keys(target)) target[key] += source[key] ?? 0;
};

export const enrichDictionaryEntryLinks = async ({
  configPath = defaultConfigPath,
  normalizedRoot = defaultNormalizedRoot,
  correspondenceIndex,
  outputPath = path.join(normalizedRoot, "entry-links.report.json")
} = {}) => {
  const resolvedConfigPath = path.resolve(configPath);
  const configDirectory = path.dirname(resolvedConfigPath);
  const config = JSON.parse(await readFile(resolvedConfigPath, "utf8"));
  const index =
    correspondenceIndex ??
    JSON.parse(
      await readFile(path.join(normalizedRoot, "correspondences.json"), "utf8")
    );
  const namedSubjects = (
    await Promise.all(
      config.publications
        .filter((publication) => publication.correspondenceSeedsPath)
        .map(async (publication) => {
          const seed = JSON.parse(
            await readFile(
              path.resolve(
                configDirectory,
                publication.correspondenceSeedsPath
              ),
              "utf8"
            )
          );
          return seed.namedSubjects ?? [];
        })
    )
  ).flat();
  const reports = [];
  for (const publication of config.publications) {
    const databasePath = path.join(
      normalizedRoot,
      `${publication.work}.sqlite`
    );
    const entries = await queryJson(
      databasePath,
      "SELECT id, word, definition FROM dictionnaire ORDER BY id"
    );
    const resolver = buildEntryResolver(entries, publication.work);
    const candidates = buildAutomaticCandidates({
      work: publication.work,
      language: publication.language,
      resolver,
      correspondenceIndex: index,
      namedSubjects
    });
    const matcher = buildCandidateMatcher(candidates);
    const stats = {
      entries: entries.length,
      eligibleDestinations: new Set(
        candidates.map((candidate) => candidate.destination.id)
      ).size,
      sourceLinksInspected: 0,
      sourceLinksRetained: 0,
      selfLinksRemoved: 0,
      unresolvedSourceLinksRemoved: 0,
      editorialCueLinks: 0,
      generatedLinks: 0,
      finalLinks: 0,
      updatedDefinitions: 0
    };
    const updates = [];
    for (const entry of entries) {
      const result = linkDictionaryDefinition({
        html: entry.definition,
        entry,
        resolver,
        candidates,
        matcher
      });
      addStats(stats, result.stats);
      if (result.html !== entry.definition) {
        stats.updatedDefinitions += 1;
        updates.push({ id: entry.id, definition: result.html });
      }
    }
    stats.finalLinks =
      stats.sourceLinksRetained +
      stats.editorialCueLinks +
      stats.generatedLinks;
    if (updates.length) {
      const sql = ["BEGIN IMMEDIATE;"];
      for (const update of updates)
        sql.push(
          `UPDATE dictionnaire SET definition=${quoteSql(update.definition)} WHERE id=${Number(update.id)};`
        );
      sql.push("COMMIT;", "PRAGMA optimize;");
      await executeSql(databasePath, `${sql.join("\n")}\n`);
    }
    reports.push({
      work: publication.work,
      language: publication.language,
      ...stats
    });
  }
  const report = {
    format: "bible-strong-dictionary-entry-links",
    schemaVersion: 1,
    dictionaries: reports,
    totals: reports.reduce(
      (totals, item) => {
        for (const key of [
          "sourceLinksInspected",
          "sourceLinksRetained",
          "selfLinksRemoved",
          "unresolvedSourceLinksRemoved",
          "editorialCueLinks",
          "generatedLinks",
          "finalLinks"
        ])
          totals[key] += item[key];
        return totals;
      },
      {
        sourceLinksInspected: 0,
        sourceLinksRetained: 0,
        selfLinksRemoved: 0,
        unresolvedSourceLinksRemoved: 0,
        editorialCueLinks: 0,
        generatedLinks: 0,
        finalLinks: 0
      }
    )
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await enrichDictionaryEntryLinks();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
