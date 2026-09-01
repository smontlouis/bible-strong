#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { comparePassages } from "./commentary-scope.mjs";
import { sha256 } from "./firestore.mjs";

const prototypeRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const egwRoot = path.resolve(
  process.argv[2] ?? path.join(prototypeRoot, ".local/egw-export")
);
const libraryRoot = path.resolve(
  process.argv[3] ?? path.join(prototypeRoot, ".local/library")
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));
const verifyArtifact = async (root, manifest, key) => {
  const artifact = manifest.artifacts[key];
  const raw = await readFile(path.join(root, artifact.path), "utf8");
  if (sha256(raw) !== artifact.sha256) {
    throw new Error(`Hash invalide : ${artifact.path}`);
  }
  return JSON.parse(raw);
};
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");

const [index, manifest] = await Promise.all([
  readJson(path.join(libraryRoot, "index.json")),
  readJson(path.join(egwRoot, "manifest.json"))
]);
if (manifest.authorization?.status !== "confirmed-by-project-owner") {
  throw new Error("Autorisation EGW absente");
}

const [scriptureIndex, indexedParagraphs] = await Promise.all([
  verifyArtifact(egwRoot, manifest, "scriptureIndex"),
  verifyArtifact(egwRoot, manifest, "indexedParagraphs")
]);
if (scriptureIndex.length !== manifest.counts.scriptureIndexEntries) {
  throw new Error("Compte ECSI incohérent");
}
if (indexedParagraphs.length !== manifest.counts.indexedParagraphs) {
  throw new Error("Compte des paragraphes EGW incohérent");
}

const paragraphsById = new Map(
  indexedParagraphs.map((paragraph) => [paragraph.id, paragraph])
);
const resource = {
  id: "egw-writings",
  name: "EGW Writings",
  author: "Ellen G. White",
  sourceLanguage: "en",
  license: "CustomPermission"
};

const rebaseParagraphReferences = (paragraph, state) => {
  const idMap = new Map();
  const references = (paragraph.source.references ?? []).map((reference) => {
    const id = `r${state.nextReference}`;
    state.nextReference += 1;
    idMap.set(reference.id, id);
    return { ...reference, id };
  });
  const html = String(paragraph.source.html).replace(
    /data-reference-id=(['"])([^'"]+)\1/giu,
    (match, quote, id) => {
      const replacement = idMap.get(id);
      return replacement
        ? `data-reference-id=${quote}${replacement}${quote}`
        : match;
    }
  );
  return { html, references };
};

const buildEntry = (entry) => {
  const paragraphRecords = new Map();
  for (const citation of entry.citations) {
    for (const paragraphId of
      citation.associatedParagraphIds ?? [citation.paragraphId]) {
      const paragraph = paragraphsById.get(paragraphId);
      if (!paragraph) throw new Error(`Paragraphe EGW absent : ${paragraphId}`);
      const current = paragraphRecords.get(paragraphId);
      paragraphRecords.set(paragraphId, {
        paragraph,
        citationLabel: current?.citationLabel ?? citation.label,
        association:
          current?.association?.kind === "chapter"
            ? current.association
            : (citation.association ?? null)
      });
    }
  }

  const groups = new Map();
  for (const record of paragraphRecords.values()) {
    const { paragraph } = record;
    const key = `${paragraph.book.id}:${paragraph.section.title}`;
    const group = groups.get(key) ?? {
      book: paragraph.book,
      section: paragraph.section,
      records: [],
      chapterAssociation: null
    };
    group.records.push(record);
    if (record.association?.kind === "chapter") {
      group.chapterAssociation = record.association;
    }
    groups.set(key, group);
  }

  const state = { nextReference: 1 };
  const references = [];
  const externalSources = [];
  const sections = [];
  for (const group of groups.values()) {
    sections.push(`<h3>${escapeHtml(group.book.title)}</h3>`);
    sections.push(`<h4>${escapeHtml(group.section.title)}</h4>`);
    if (group.chapterAssociation) {
      sections.push(
        "<p><em>The Complete Scripture Index associates this whole chapter with the Bible passage.</em></p>"
      );
    }
    for (const record of group.records) {
      const normalized = rebaseParagraphReferences(record.paragraph, state);
      references.push(...normalized.references);
      sections.push(
        `<p><strong>${escapeHtml(record.paragraph.sourceReference ?? record.citationLabel ?? record.paragraph.id)}</strong></p>${normalized.html}`
      );
    }
    if (/^https?:\/\//iu.test(group.section.contextUrl ?? "")) {
      externalSources.push({
        label: "View in context",
        url: group.section.contextUrl,
        policy: "metadata-only"
      });
    }
  }

  const html = sections.join("");
  const [, book, chapter, verse] = entry.passage.match(/^(\d+)-(\d+)-(\d+)$/u) ?? [];
  const endVerse = Number(entry.passageEndVerse ?? verse);
  const passageEnd = endVerse > Number(verse) ? `${book}-${chapter}-${endVerse}` : null;
  return {
    schemaVersion: 2,
    id: `egw-writings:${entry.id}`,
    passage: entry.passage,
    anchor: entry.passage,
    ...(passageEnd ? { passageEnd } : {}),
    scope: {
      kind: passageEnd ? "range" : "verse",
      start: entry.passage,
      ...(passageEnd ? { end: passageEnd } : {}),
      source: "egw-complete-scripture-index",
      confidence: "exact"
    },
    resource,
    layer: "egw-indexed-writings",
    editorialKind: "egw-indexed-writings",
    referenceLabel: entry.referenceLabel,
    indexParagraphId: entry.indexParagraphId,
    citations: entry.citations,
    source: {
      language: "en",
      html,
      sha256: sha256(html),
      provenance: `EGW Complete Scripture Index · ${entry.indexParagraphId}`,
      url: entry.sourceUrl,
      ...(references.length ? { references } : {}),
      ...(externalSources.length ? { externalSources } : {})
    },
    translation: null
  };
};

const entries = scriptureIndex.map(buildEntry);
const chapters = new Map(
  index.chapters.map((chapter) => {
    const resources = { ...chapter.resources };
    delete resources[resource.id];
    return [
      `${chapter.book}-${chapter.chapter}`,
      { ...chapter, resources, passages: new Set(chapter.passages) }
    ];
  })
);
const bookNames = new Map(
  index.chapters.map((chapter) => [chapter.book, chapter.bookName])
);
const groups = new Map();
for (const entry of entries) {
  const key = entry.passage.split("-").slice(0, 2).join("-");
  const group = groups.get(key) ?? [];
  group.push(entry);
  groups.set(key, group);
}

for (const [key, chapterEntries] of groups) {
  chapterEntries.sort(
    (left, right) =>
      comparePassages(left.passage, right.passage) ||
      left.id.localeCompare(right.id, "en", { numeric: true })
  );
  const [book, chapter] = key.split("-").map(Number);
  const relativePath = `chunks/${book}/${chapter}/${resource.id}.json`;
  const payload = JSON.stringify({
    schemaVersion: 2,
    resourceId: resource.id,
    entries: chapterEntries
  });
  await mkdir(path.dirname(path.join(libraryRoot, relativePath)), {
    recursive: true
  });
  await writeFile(path.join(libraryRoot, relativePath), payload);
  const record = chapters.get(key) ?? {
    book,
    bookName: bookNames.get(book) ?? `Livre ${book}`,
    chapter,
    passages: new Set(),
    resources: {}
  };
  for (const entry of chapterEntries) record.passages.add(entry.passage);
  record.resources[resource.id] = {
    path: relativePath,
    count: chapterEntries.length,
    sha256: sha256(payload)
  };
  chapters.set(key, record);
}

index.resources[resource.id] = {
  entryCount: entries.length,
  translatedCount: 0,
  missingCount: entries.length,
  chapterCount: groups.size,
  sourceAnchorCount: entries.length,
  translatedAnchorCount: 0,
  indexedParagraphCount: indexedParagraphs.length,
  citationCount: manifest.counts.citations,
  chapterAssociationMarkerCount: manifest.counts.chapterAssociationMarkers
};
index.sourceRevision.egwWritings = manifest.artifacts.indexedParagraphs.sha256;
index.generatedAt = new Date().toISOString();
const linkStats = entries.reduce(
  (stats, entry) => {
    const references = entry.source.references ?? [];
    stats.references += references.length;
    stats.providerReferences += references.filter(
      (reference) => reference.source === "provider-href"
    ).length;
    stats.semanticReferences += references.filter((reference) =>
      ["osis-attribute", "source-marker"].includes(reference.source)
    ).length;
    stats.bcvReferences += references.filter(
      (reference) => reference.source === "bcv-text"
    ).length;
    stats.externalSources += entry.source.externalSources?.length ?? 0;
    return stats;
  },
  {
    references: 0,
    providerReferences: 0,
    semanticReferences: 0,
    bcvReferences: 0,
    anchorsRemoved: 0,
    discardedLinks: 0,
    externalSources: 0
  }
);
const previousLinkStats = index.linkNormalization?.byResource?.[resource.id];
if (index.linkNormalization?.totals) {
  for (const key of Object.keys(linkStats)) {
    index.linkNormalization.totals[key] =
      (index.linkNormalization.totals[key] ?? 0) -
      (previousLinkStats?.[key] ?? 0) +
      linkStats[key];
  }
  index.linkNormalization.byResource[resource.id] = linkStats;
}
index.chapters = [...chapters.values()]
  .filter((chapter) => Object.keys(chapter.resources).length)
  .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  .map((chapter) => ({
    ...chapter,
    passages: [...chapter.passages].sort(comparePassages)
  }));
await writeFile(
  path.join(libraryRoot, "index.json"),
  `${JSON.stringify(index, null, 2)}\n`
);
process.stdout.write(
  `${JSON.stringify(
    {
      resource: resource.id,
      entries: entries.length,
      chapters: groups.size,
      indexedParagraphs: indexedParagraphs.length,
      citations: manifest.counts.citations,
      links: linkStats
    },
    null,
    2
  )}\n`
);
