#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DICTIONARY_BCV_PARSER_VERSION,
  DICTIONARY_LINK_NORMALIZATION_REVISION
} from "./dictionary-links.mjs";
import { normalizeDictionarySqlite } from "./normalize-sqlite.mjs";
import { buildDictionaryCorrespondences } from "./build-correspondences.mjs";
import { enrichDictionaryEntryLinks } from "./dictionary-entry-links.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(workflowRoot, "../../../..");
const configPath = path.join(
  workspaceRoot,
  "apps/resource-studio/config/resource-publications/dictionary.json"
);
const outputRoot = path.join(workflowRoot, ".local/normalized");

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
process.stdout.write(
  `correspondances: ${correspondences.stats.groups} groupes, ${correspondences.stats.bilingualGroups} bilingues\n`
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

await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(
    {
      normalizationRevision: DICTIONARY_LINK_NORMALIZATION_REVISION,
      parserVersion: DICTIONARY_BCV_PARSER_VERSION,
      correspondences: correspondences.stats,
      entryLinks: entryLinks.totals,
      dictionaries: reports
    },
    null,
    2
  )}\n`,
  "utf8"
);
