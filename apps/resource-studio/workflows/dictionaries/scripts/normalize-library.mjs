#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DICTIONARY_BCV_PARSER_VERSION,
  DICTIONARY_LINK_NORMALIZATION_REVISION
} from "./dictionary-links.mjs";
import { normalizeDictionarySqlite } from "./normalize-sqlite.mjs";
import {
  buildDictionaryCorrespondences,
  installDictionaryCorrespondenceMemberships
} from "./build-correspondences.mjs";
import { enrichDictionaryEntryLinks } from "./dictionary-entry-links.mjs";
import { buildDictionaryDirectory } from "./build-directory.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const defaultConfigPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary.json"
);
const defaultOutputRoot = path.join(workflowRoot, ".local/normalized");

const readArguments = (values) => {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("dictionary-normalization-cli-arguments-invalid");
    result[key.slice(2)] = value;
  }
  return result;
};

const args = readArguments(process.argv.slice(2));
const configPath = path.resolve(args.config ?? defaultConfigPath);
const outputRoot = path.resolve(args["output-root"] ?? defaultOutputRoot);

const config = JSON.parse(await readFile(configPath, "utf8"));
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const reports = [];
for (const publication of config.publications) {
  const sourcePath = path.resolve(
    path.dirname(configPath),
    publication.sqlitePath
  );
  const databasePath = path.join(outputRoot, `${publication.work}.sqlite`);
  const reportPath = path.join(outputRoot, `${publication.work}.report.json`);
  await cp(sourcePath, databasePath);
  const report = await normalizeDictionarySqlite({
    databasePath,
    reportPath,
    work: publication.work,
    language: publication.language
  });
  reports.push(report);
  process.stdout.write(
    `${publication.work}: ${report.stats.bibleLinks} liens Bible, ${report.stats.strongLinks} liens Strong, ${report.verseAnchors} versets indexés\n`
  );
}

const correspondences = await buildDictionaryCorrespondences({
  configPath,
  normalizedRoot: outputRoot
});
const correspondenceMemberships =
  await installDictionaryCorrespondenceMemberships({
    configPath,
    normalizedRoot: outputRoot,
    correspondenceIndex: correspondences
  });
process.stdout.write(
  `correspondances: ${correspondences.stats.groups} groupes, ${correspondences.stats.bilingualGroups} bilingues, ${correspondenceMemberships.memberships} membres projetés\n`
);

const entryLinks = await enrichDictionaryEntryLinks({
  configPath,
  normalizedRoot: outputRoot,
  correspondenceIndex: correspondences
});
for (const report of reports) {
  report.entryLinks = entryLinks.dictionaries.find(
    (item) => item.work === report.work
  );
  await writeFile(
    path.join(outputRoot, `${report.work}.report.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
}
process.stdout.write(
  `renvois d’entrées: ${entryLinks.totals.finalLinks} liens (${entryLinks.totals.editorialCueLinks} See/Voir, ${entryLinks.totals.generatedLinks} générés, ${entryLinks.totals.selfLinksRemoved} auto-liens retirés)\n`
);

const directory = await buildDictionaryDirectory({
  configPath,
  normalizedRoot: outputRoot
});
process.stdout.write(
  `répertoire: ${directory.counts.entries} entrées, ${directory.counts.passageAnchors} ancres exactes (${directory.revision})\n`
);

await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(
    {
      normalizationRevision: DICTIONARY_LINK_NORMALIZATION_REVISION,
      parserVersion: DICTIONARY_BCV_PARSER_VERSION,
      correspondences: correspondences.stats,
      entryLinks: entryLinks.totals,
      directory: {
        revision: directory.revision,
        ...directory.counts
      },
      dictionaries: reports
    },
    null,
    2
  )}\n`,
  "utf8"
);
