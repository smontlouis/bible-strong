import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./firestore.mjs";

const jsonFiles = async (directory) => {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
};

const validateOrigin = (origin, file) => {
  if (
    origin?.kind !== "historical-import" ||
    typeof origin.snapshotSha256 !== "string" ||
    !origin.snapshotSha256
  ) {
    throw new Error(`Origine historique invalide : ${file}`);
  }
  if (
    "model" in origin ||
    "reasoningEffort" in origin ||
    "translator" in origin
  ) {
    throw new Error(
      `Métadonnée de modèle interdite pour un import historique : ${file}`
    );
  }
};

export const loadHistoricalTranslations = async (root, resourceId) => {
  const translations = new Map();
  const serializedFiles = [];
  for (const file of await jsonFiles(path.join(root, resourceId))) {
    const serialized = await readFile(file, "utf8");
    const document = JSON.parse(serialized);
    if (
      document.schemaVersion !== 1 ||
      document.resourceId !== resourceId ||
      typeof document.batchId !== "string" ||
      !Array.isArray(document.entries)
    ) {
      throw new Error(`Magasin historique invalide : ${file}`);
    }
    validateOrigin(document.origin, file);
    for (const entry of document.entries) {
      if (!entry.id || !entry.passage || !entry.sourceSha256) {
        throw new Error(`Identité historique incomplète : ${file}`);
      }
      if (!entry.translatedHtml?.trim()) {
        throw new Error(
          `Traduction historique vide : ${resourceId}/${entry.id}`
        );
      }
      if (sha256(entry.translatedHtml) !== entry.translationSha256) {
        throw new Error(
          `Hash de traduction historique invalide : ${resourceId}/${entry.id}`
        );
      }
      if (translations.has(entry.id)) {
        throw new Error(
          `Traduction historique dupliquée : ${resourceId}/${entry.id}`
        );
      }
      translations.set(entry.id, {
        ...entry,
        batchId: document.batchId,
        origin: document.origin
      });
    }
    serializedFiles.push(serialized);
  }
  return {
    translations,
    revision: serializedFiles.length ? sha256(serializedFiles.join("\n")) : null
  };
};

export const applyHistoricalTranslations = (
  resourceId,
  entries,
  translations
) => {
  let applied = 0;
  let unchanged = 0;
  const found = new Set();
  const result = entries.map((entry) => {
    const historical = translations.get(entry.id);
    if (!historical) return entry;
    found.add(entry.id);
    if (entry.source.sha256 !== historical.sourceSha256) {
      throw new Error(
        `La source canonique a changé pour ${resourceId}/${entry.id}`
      );
    }
    if (entry.translation) {
      if (entry.translation.sha256 !== historical.translationSha256) {
        throw new Error(
          `Refus d’écraser une traduction différente : ${resourceId}/${entry.id}`
        );
      }
      unchanged += 1;
      return entry;
    }
    applied += 1;
    return {
      ...entry,
      translation: {
        language: "fr",
        html: historical.translatedHtml,
        sha256: historical.translationSha256,
        provenance: `Import historique Firestore ${historical.origin.snapshotSha256}; entrée ${historical.historicalId}; lot ${historical.batchId}`,
        origin: {
          kind: "historical-import",
          snapshotSha256: historical.origin.snapshotSha256,
          historicalId: historical.historicalId
        },
        ...(historical.references?.length
          ? { references: historical.references }
          : {}),
        ...(historical.externalSources?.length
          ? { externalSources: historical.externalSources }
          : {})
      }
    };
  });
  const missing = [...translations.keys()].filter((id) => !found.has(id));
  if (missing.length) {
    throw new Error(
      `Traductions historiques absentes de la bibliothèque ${resourceId} : ${missing.join(", ")}`
    );
  }
  return { entries: result, applied, unchanged };
};

export const writeHistoricalTranslationStore = async ({
  root,
  resourceId,
  snapshotSha256,
  entries,
  batchSize = 500
}) => {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize doit être un entier positif");
  }
  const directory = path.join(root, resourceId);
  await mkdir(directory, { recursive: true });
  for (const file of await jsonFiles(directory)) await unlink(file);
  const sorted = [...entries].sort(
    (left, right) =>
      left.passage.localeCompare(right.passage, "en", { numeric: true }) ||
      left.id.localeCompare(right.id, "en", { numeric: true })
  );
  const filenames = [];
  for (let offset = 0; offset < sorted.length; offset += batchSize) {
    const sequence = offset / batchSize + 1;
    const batchId = `${resourceId}-historical-${String(sequence).padStart(4, "0")}`;
    const filename = `${batchId}.json`;
    const document = {
      schemaVersion: 1,
      resourceId,
      batchId,
      origin: {
        kind: "historical-import",
        source: "Firestore commentaries-FR local snapshot",
        snapshotSha256
      },
      entries: sorted.slice(offset, offset + batchSize)
    };
    await writeFile(
      path.join(directory, filename),
      `${JSON.stringify(document, null, 2)}\n`
    );
    filenames.push(filename);
  }
  return { directory, files: filenames.length, entries: sorted.length };
};
