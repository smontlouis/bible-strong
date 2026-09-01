import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
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

export const isSdabcMechanicalMarker = (entry) =>
  (entry.layer ?? entry.editorialKind) === "egw-supplement" &&
  String(entry.source?.html ?? "")
    .replace(/<[^>]*>/gu, "")
    .replace(/\s+/gu, "") === "*****";

export const applySdabcMechanicalCopies = (entries) => {
  let applied = 0;
  let unchanged = 0;
  const result = entries.map((entry) => {
    if (!isSdabcMechanicalMarker(entry)) return entry;
    const translatedHtml = entry.source.html;
    const translationSha256 = sha256(translatedHtml);
    if (entry.translation) {
      if (entry.translation.sha256 !== translationSha256) {
        throw new Error(
          `Refus d’écraser un marqueur traduit différemment : ${entry.id}`
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
        html: translatedHtml,
        sha256: translationSha256,
        provenance: "Copie mécanique du marqueur non linguistique SDABC",
        origin: { kind: "mechanical-copy", reason: "non-linguistic-marker" }
      }
    };
  });
  return { entries: result, applied, unchanged };
};

export const writeSdabcCodexTranslationStore = async ({
  root,
  records,
  manifestHash,
  batchSize = 500
}) => {
  if (!Number.isInteger(batchSize) || batchSize < 1)
    throw new Error("batchSize doit être un entier positif");
  if (!/^[a-f0-9]{64}$/u.test(manifestHash))
    throw new Error("Hash de manifeste SDABC invalide");
  const seen = new Set();
  const entries = records
    .map((record) => {
      if (record.origin?.kind === "mechanical-copy")
        throw new Error(
          `Copie mécanique interdite dans le magasin Codex : ${record.id}`
        );
      if (
        !record.id ||
        !record.passage ||
        !/^[a-f0-9]{64}$/u.test(record.sourceSha256 ?? "")
      ) {
        throw new Error(
          `Identité de traduction SDABC invalide : ${record.id ?? "inconnue"}`
        );
      }
      if (seen.has(record.id))
        throw new Error(`Traduction SDABC dupliquée : ${record.id}`);
      seen.add(record.id);
      if (
        !record.translation?.html?.trim() ||
        sha256(record.translation.html) !== record.translation.sha256
      ) {
        throw new Error(`Hash de traduction SDABC invalide : ${record.id}`);
      }
      return {
        id: record.id,
        passage: record.passage,
        sourceSha256: record.sourceSha256,
        sourceContentHash: record.sourceContentHash,
        inputHash: record.inputHash,
        translatedHtml: record.translation.html,
        translationSha256: record.translation.sha256,
        ...(record.origin ? { origin: record.origin } : {}),
        ...(record.translation.references?.length
          ? { references: record.translation.references }
          : {}),
        ...(record.translation.externalSources?.length
          ? { externalSources: record.translation.externalSources }
          : {})
      };
    })
    .sort(
      (left, right) =>
        left.passage.localeCompare(right.passage, "en", { numeric: true }) ||
        left.id.localeCompare(right.id, "en", { numeric: true })
    );

  const directory = path.join(root, "sdabc");
  await mkdir(directory, { recursive: true });
  for (const file of await jsonFiles(directory)) await unlink(file);
  let files = 0;
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    files += 1;
    const batchId = `sdabc-luna-high-${String(files).padStart(4, "0")}`;
    const document = {
      schemaVersion: 1,
      resourceId: "sdabc",
      batchId,
      translator: {
        provider: "OpenAI",
        model: "gpt-5.6-luna",
        reasoningEffort: "high"
      },
      sourceManifestHash: manifestHash,
      entries: entries.slice(offset, offset + batchSize)
    };
    await writeFile(
      path.join(directory, `${batchId}.json`),
      `${JSON.stringify(document, null, 2)}\n`
    );
  }
  return { directory, files, entries: entries.length };
};
