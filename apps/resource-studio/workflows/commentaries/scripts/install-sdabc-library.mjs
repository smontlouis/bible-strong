#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "./wave-sources.mjs";
import {
  applyHistoricalTranslations,
  loadHistoricalTranslations
} from "./historical-translations.mjs";
import { normalizeLibraryScopes } from "./normalize-library-scopes.mjs";
import {
  applyPublishedTranslations,
  loadPublishedTranslations
} from "./published-translations.mjs";
import { applySdabcMechanicalCopies } from "./sdabc-translations.mjs";

const prototypeRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sdabcRoot = path.resolve(
  process.argv[2] ?? path.join(prototypeRoot, ".local/sdabc-export")
);
const egwRoot = path.resolve(
  process.argv[3] ?? path.join(prototypeRoot, ".local/egw-export")
);
const libraryRoot = path.resolve(
  process.argv[4] ?? path.join(prototypeRoot, ".local/library")
);
const historicalTranslationRoot = path.resolve(
  process.argv[5] ?? path.join(prototypeRoot, "data/translations/historical")
);
const publishedTranslationRoot = path.resolve(
  process.argv[6] ?? path.join(prototypeRoot, "data/translations/published")
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));
const verifyArtifact = async (root, manifest, key) => {
  const artifact = manifest.artifacts[key];
  const raw = await readFile(path.join(root, artifact.path), "utf8");
  if (sha256(raw) !== artifact.sha256)
    throw new Error(`Hash invalide : ${artifact.path}`);
  return JSON.parse(raw);
};

const [index, sdabcManifest, egwManifest] = await Promise.all([
  readJson(path.join(libraryRoot, "index.json")),
  readJson(path.join(sdabcRoot, "manifest.json")),
  readJson(path.join(egwRoot, "manifest.json"))
]);
if (sdabcManifest.authorization?.status !== "confirmed-by-project-owner")
  throw new Error("Autorisation SDABC absente");
if (egwManifest.authorization?.status !== "confirmed-by-project-owner")
  throw new Error("Autorisation EGW absente");

const [general, curated, scriptureIndex] = await Promise.all([
  verifyArtifact(sdabcRoot, sdabcManifest, "commentary"),
  verifyArtifact(egwRoot, egwManifest, "commentary"),
  verifyArtifact(egwRoot, egwManifest, "scriptureIndex")
]);
if (general.length !== sdabcManifest.counts.entries)
  throw new Error("Compte SDABC incohérent");
if (curated.length !== egwManifest.counts.commentaryEntries)
  throw new Error("Compte EGW 1–7BC incohérent");
if (scriptureIndex.length !== egwManifest.counts.scriptureIndexEntries)
  throw new Error("Compte ECSI incohérent");

const resource = {
  id: "sdabc",
  name: "Seventh-day Adventist Bible Commentary",
  author: "Francis D. Nichol (dir.) et contributeurs",
  sourceLanguage: "en",
  license: "CustomPermission"
};
const baseEntries = [
  ...general.map((entry) => ({
    ...entry,
    resource,
    layer: "general-commentary"
  })),
  ...curated.map((entry) => ({
    ...entry,
    resource,
    layer: "egw-supplement",
    editorialKind: "egw-supplement",
    volumeCode: entry.resource.id.replace("egw-", "").toUpperCase()
  })),
  ...scriptureIndex.map((entry) => ({
    ...entry,
    resource,
    layer: "egw-scripture-index",
    source: {
      language: "en",
      html: "",
      sha256: null,
      provenance: `EGW Complete Scripture Index · ${entry.indexParagraphId}`,
      url: entry.sourceUrl
    },
    translation: null,
    editorialKind: "scripture-index"
  }))
];
const historicalTranslations = await loadHistoricalTranslations(
  historicalTranslationRoot,
  "sdabc"
);
const historicalApplication = applyHistoricalTranslations(
  "sdabc",
  baseEntries,
  historicalTranslations.translations
);
const mechanicalApplication = applySdabcMechanicalCopies(
  historicalApplication.entries
);
const publishedTranslations = await loadPublishedTranslations(
  publishedTranslationRoot,
  "sdabc"
);
const entries = applyPublishedTranslations(
  "sdabc",
  mechanicalApplication.entries,
  publishedTranslations.translations
);

const oldResourceIds = ["egw-sda-bc", "egw-ecsi", "sdabc"];
const chapters = new Map(
  index.chapters.map((chapter) => {
    const resources = { ...chapter.resources };
    for (const id of oldResourceIds) delete resources[id];
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

const layerOrder = {
  "general-commentary": 0,
  "book-introduction": 0,
  "egw-supplement": 1,
  "egw-scripture-index": 2
};
for (const [key, chapterEntries] of groups) {
  chapterEntries.sort(
    (left, right) =>
      left.passage.localeCompare(right.passage, "en", { numeric: true }) ||
      (layerOrder[left.layer ?? left.editorialKind] ?? 9) -
        (layerOrder[right.layer ?? right.editorialKind] ?? 9) ||
      left.id.localeCompare(right.id, "en", { numeric: true })
  );
  const [book, chapter] = key.split("-").map(Number);
  const relativePath = `chunks/${book}/${chapter}/sdabc.json`;
  const payload = JSON.stringify({
    schemaVersion: 1,
    resourceId: "sdabc",
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
  record.resources.sdabc = {
    path: relativePath,
    count: chapterEntries.length,
    sha256: sha256(payload)
  };
  chapters.set(key, record);
}

delete index.resources["egw-sda-bc"];
delete index.resources["egw-ecsi"];
index.resources.sdabc = {
  entryCount: entries.length,
  translatedCount: entries.filter((entry) => entry.translation).length,
  missingCount: entries.filter((entry) => !entry.translation).length,
  chapterCount: groups.size,
  layers: {
    generalCommentary: general.length,
    egwSupplement: curated.length,
    egwScriptureIndex: scriptureIndex.length
  }
};
index.generatedAt = new Date().toISOString();
index.sourceRevision.sdabc = sdabcManifest.artifacts.commentary.sha256;
index.sourceRevision.egw = egwManifest.artifacts.merged.sha256;
if (historicalTranslations.revision) {
  index.sourceRevision.sdabcHistoricalTranslations =
    historicalTranslations.revision;
}
if (publishedTranslations.revision) {
  index.sourceRevision.sdabcPublishedTranslations =
    publishedTranslations.revision;
}
index.chapters = [...chapters.values()]
  .filter((chapter) => Object.keys(chapter.resources).length)
  .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  .map((chapter) => ({
    ...chapter,
    passages: [...chapter.passages].sort((left, right) =>
      left.localeCompare(right, "en", { numeric: true })
    )
  }));
await writeFile(
  path.join(libraryRoot, "index.json"),
  JSON.stringify(index, null, 2) + "\n"
);
const normalization = await normalizeLibraryScopes(libraryRoot);
process.stdout.write(
  JSON.stringify(
    {
      resource: "sdabc",
      entries: entries.length,
      chapters: groups.size,
      layers: index.resources.sdabc.layers,
      historicalTranslations: {
        revision: historicalTranslations.revision,
        stored: historicalTranslations.translations.size,
        applied: historicalApplication.applied,
        unchanged: historicalApplication.unchanged
      },
      mechanicalTranslations: {
        applied: mechanicalApplication.applied,
        unchanged: mechanicalApplication.unchanged
      },
      publishedTranslations: {
        revision: publishedTranslations.revision,
        stored: publishedTranslations.translations.size
      },
      normalization
    },
    null,
    2
  ) + "\n"
);
