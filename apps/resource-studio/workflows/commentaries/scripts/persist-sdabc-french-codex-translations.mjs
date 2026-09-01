#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "./firestore.mjs";
import { auditSdabcRunDirectory } from "./audit-sdabc-french-codex-translations.mjs";
import { writeSdabcCodexTranslationStore } from "./sdabc-translations.mjs";
import { validateSdabcRunDirectory } from "./validate-sdabc-french-codex-translations.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const loadLibraryEntries = async (libraryRoot) => {
  const index = await readJson(path.join(libraryRoot, "index.json"));
  const entries = new Map();
  for (const chapter of index.chapters) {
    const descriptor = chapter.resources.sdabc;
    if (!descriptor) continue;
    const serialized = await readFile(
      path.join(libraryRoot, descriptor.path),
      "utf8"
    );
    if (sha256(serialized) !== descriptor.sha256)
      throw new Error(`Hash de chunk invalide : ${descriptor.path}`);
    for (const entry of JSON.parse(serialized).entries)
      entries.set(entry.id, entry);
  }
  return entries;
};

const readJsonLines = async (filePath) =>
  (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

export const persistValidatedSdabcTranslations = async (options) => {
  const validation = await validateSdabcRunDirectory({
    planRoot: options.planRoot,
    runsRoot: options.runsRoot,
    outputPath: options.validatedOutput
  });
  const quality = await auditSdabcRunDirectory({
    planRoot: options.planRoot,
    runsRoot: options.runsRoot,
    reportPath: options.qualityReport
  });
  if (quality.blockingIssues) {
    throw new Error(
      `Audit linguistique SDABC en échec : ${quality.blockingIssues} segment(s)`
    );
  }
  const records = await readJsonLines(options.validatedOutput);
  const canonical = await loadLibraryEntries(options.libraryRoot);
  const codex = [];
  let mechanical = 0;
  for (const record of records) {
    const entry = canonical.get(record.id);
    if (!entry || entry.source.sha256 !== record.sourceSha256)
      throw new Error(
        `Source canonique SDABC introuvable ou modifiée : ${record.id}`
      );
    if (record.origin?.kind === "mechanical-copy") {
      mechanical += 1;
      continue;
    }
    const installedCodexTranslation =
      entry.translation?.provenance?.startsWith(
        "gpt-5.6-luna (high); lot sdabc-luna-high-"
      ) ?? false;
    if (entry.translation && !installedCodexTranslation)
      throw new Error(
        `Refus de publier sur une traduction historique : ${record.id}`
      );
    codex.push(record);
  }
  if (
    codex.length !== validation.translations ||
    mechanical !== validation.mechanical
  ) {
    throw new Error("Comptes de persistance SDABC incohérents");
  }
  const store = await writeSdabcCodexTranslationStore({
    root: options.publishedRoot,
    records: codex,
    manifestHash: validation.manifestHash,
    batchSize: options.batchSize
  });
  return { validation, quality, store, mechanical };
};

const run = async () => {
  const local = path.join(workflowRoot, ".local");
  const options = {
    planRoot: path.join(local, "sdabc-french-translation-plan"),
    runsRoot: path.join(local, "sdabc-french-translation-runs"),
    validatedOutput: path.join(
      local,
      "sdabc-french-translations.validated.jsonl"
    ),
    qualityReport: path.join(local, "sdabc-french-translation-quality.json"),
    libraryRoot: path.join(local, "library"),
    publishedRoot: path.join(workflowRoot, "data/translations/published"),
    batchSize: 500
  };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--plan")
      options.planRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--runs")
      options.runsRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--validated-output")
      options.validatedOutput = path.resolve(argv[++index]);
    else if (argv[index] === "--quality-report")
      options.qualityReport = path.resolve(argv[++index]);
    else if (argv[index] === "--library")
      options.libraryRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--published")
      options.publishedRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--batch-size")
      options.batchSize = Number(argv[++index]);
    else throw new Error(`Argument inconnu : ${argv[index]}`);
  }
  process.stdout.write(
    `${JSON.stringify(await persistValidatedSdabcTranslations(options), null, 2)}\n`
  );
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
