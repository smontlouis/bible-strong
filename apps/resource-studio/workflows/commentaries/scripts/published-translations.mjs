import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./firestore.mjs";

export const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const listJsonFiles = async (directory) => {
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

export const loadPublishedTranslations = async (root, resourceId) => {
  const files = await listJsonFiles(path.join(root, resourceId));
  const translations = new Map();
  const translationsBySourceSha256 = new Map();
  const serializedFiles = [];

  for (const file of files) {
    const serialized = await readFile(file, "utf8");
    const document = JSON.parse(serialized);
    if (
      document.schemaVersion !== 1 ||
      document.resourceId !== resourceId ||
      "status" in document
    ) {
      throw new Error(`Métadonnées de traduction invalides : ${file}`);
    }
    for (const entry of document.entries) {
      if (!entry.translatedHtml?.trim())
        throw new Error(`Traduction vide : ${resourceId}/${entry.id}`);
      if ("status" in entry)
        throw new Error(
          `Statut de traduction inattendu : ${resourceId}/${entry.id}`
        );
      if (translations.has(entry.id))
        throw new Error(`Traduction dupliquée : ${resourceId}/${entry.id}`);
      const translation = {
        ...entry,
        translator: document.translator,
        batchId: document.batchId
      };
      const existingForSource = translationsBySourceSha256.get(
        entry.sourceSha256
      );
      if (
        existingForSource &&
        existingForSource.translatedHtml !== entry.translatedHtml
      ) {
        throw new Error(
          `Traductions divergentes pour la même source : ${resourceId}/${entry.sourceSha256}`
        );
      }
      translations.set(entry.id, translation);
      translationsBySourceSha256.set(
        entry.sourceSha256,
        existingForSource ?? translation
      );
    }
    serializedFiles.push(serialized);
  }

  return {
    translations,
    translationsBySourceSha256,
    revision: serializedFiles.length ? sha256(serializedFiles.join("\n")) : null
  };
};

export const applyPublishedTranslations = (
  resourceId,
  entries,
  translations
) => {
  const translationsBySourceSha256 = new Map(
    [...translations.values()].map((translation) => [
      translation.sourceSha256,
      translation
    ])
  );
  return entries.map((entry) => {
    const published =
      translations.get(entry.id) ??
      (!entry.translation
        ? translationsBySourceSha256.get(entry.source.sha256)
        : null);
    if (!published) return entry;
    if (entry.source.sha256 !== published.sourceSha256) {
      throw new Error(`La source a changé pour ${resourceId}/${entry.id}`);
    }
    if (entry.translation)
      throw new Error(
        `Refus d’écraser une traduction existante : ${resourceId}/${entry.id}`
      );
    return {
      ...entry,
      translation: {
        language: "fr",
        html: published.translatedHtml,
        sha256: sha256(published.translatedHtml),
        provenance: `${published.translator.model} (${published.translator.reasoningEffort}); lot ${published.batchId}${
          published.origin?.kind === "identical-source-reuse"
            ? `; source identique à ${published.origin.sourceId}`
            : ""
        }`,
        ...(published.references?.length
          ? { references: published.references }
          : {}),
        ...(published.externalSources?.length
          ? { externalSources: published.externalSources }
          : {})
      }
    };
  });
};
