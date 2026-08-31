#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  TRANSLATION_WORDS_WORK,
  isCheckedBibleUri,
  isCheckedStrongUri
} from "./dictionary-links.mjs";

const execFileAsync = promisify(execFile);
const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const normalizedRoot = path.join(workflowRoot, ".local/normalized");
const manifest = JSON.parse(
  await readFile(path.join(normalizedRoot, "manifest.json"), "utf8")
);

const query = async (databasePath, sql) => {
  const { stdout } = await execFileAsync(
    "sqlite3",
    ["-json", databasePath, sql],
    {
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024
    }
  );
  return JSON.parse(stdout || "[]");
};

const attribute = (tag, name) => {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "iu"
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
};

const audits = [];
const entriesByIdentity = new Map();
for (const dictionary of manifest.dictionaries) {
  const databasePath = path.join(normalizedRoot, `${dictionary.work}.sqlite`);
  await access(databasePath);
  const integrity = await query(databasePath, "PRAGMA integrity_check");
  if (integrity[0]?.integrity_check?.toLocaleLowerCase() !== "ok")
    throw new Error(`${dictionary.work}: contrôle d'intégrité SQLite en échec`);

  const definitions = await query(
    databasePath,
    "SELECT id, word, definition FROM dictionnaire ORDER BY id"
  );
  let bibleLinks = 0;
  let strongLinks = 0;
  let wordLinks = 0;
  let generatedWordLinks = 0;
  let editorialCueLinks = 0;
  const entriesById = new Map(
    definitions.map((entry) => [Number(entry.id), entry.word])
  );
  const errors = [];
  for (const entry of definitions) {
    entriesByIdentity.set(`${dictionary.work}:${entry.id}`, entry.word);
    for (const match of entry.definition.matchAll(/<a\b[^>]*>/giu)) {
      const tag = match[0];
      const href = attribute(tag, "href");
      const className = attribute(tag, "class");
      if (href.startsWith("bible://")) {
        bibleLinks += 1;
        const osis = attribute(tag, "data-osis");
        if (
          !isCheckedBibleUri(href) ||
          !/(?:^|\s)verse(?:\s|$)/u.test(className) ||
          !/(?:^|\s)bible-ref(?:\s|$)/u.test(className) ||
          osis !== href.slice("bible://".length)
        )
          errors.push(`entrée ${entry.id}: lien biblique non canonique`);
      } else if (href.startsWith("strong://")) {
        strongLinks += 1;
        const sourceCode = attribute(tag, "data-strong-source");
        const canonicalCode = href.slice("strong://".length);
        const expectedBook = canonicalCode.startsWith("H") ? "1" : "40";
        if (
          dictionary.work !== TRANSLATION_WORDS_WORK ||
          !/(?:^|\s)strong-ref(?:\s|$)/u.test(className) ||
          !isCheckedStrongUri(href, sourceCode) ||
          attribute(tag, "data-strong-number") !== canonicalCode.slice(1) ||
          attribute(tag, "data-strong-book") !== expectedBook
        )
          errors.push(`entrée ${entry.id}: lien Strong non canonique`);
      } else if (/(?:^|\s)word(?:\s|$)/u.test(className)) {
        wordLinks += 1;
        const destinationId = Number(attribute(tag, "data-entry-id"));
        const origin = attribute(tag, "data-link-origin");
        if (origin === "generated") generatedWordLinks += 1;
        if (origin === "cue") editorialCueLinks += 1;
        if (
          !href ||
          /^[a-z][a-z\d+.-]*:\/\//iu.test(href) ||
          !Number.isInteger(destinationId) ||
          entriesById.get(destinationId) !== href ||
          destinationId === Number(entry.id) ||
          (origin !== "source" && origin !== "generated" && origin !== "cue")
        )
          errors.push(`entrée ${entry.id}: lien de mot invalide`);
      } else {
        errors.push(`entrée ${entry.id}: ancre HTML non classée`);
      }
    }
  }
  if (bibleLinks !== dictionary.stats.bibleLinks)
    errors.push(
      `compteur bible:// ${bibleLinks} différent du rapport ${dictionary.stats.bibleLinks}`
    );
  if (strongLinks !== (dictionary.stats.strongLinks ?? 0))
    errors.push(
      `compteur strong:// ${strongLinks} différent du rapport ${dictionary.stats.strongLinks ?? 0}`
    );
  if (wordLinks !== dictionary.entryLinks?.finalLinks)
    errors.push(
      `compteur de renvois ${wordLinks} différent du rapport ${dictionary.entryLinks?.finalLinks}`
    );
  if (generatedWordLinks !== dictionary.entryLinks?.generatedLinks)
    errors.push(
      `compteur de renvois générés ${generatedWordLinks} différent du rapport ${dictionary.entryLinks?.generatedLinks}`
    );
  if (editorialCueLinks !== dictionary.entryLinks?.editorialCueLinks)
    errors.push(
      `compteur de renvois See/Voir ${editorialCueLinks} différent du rapport ${dictionary.entryLinks?.editorialCueLinks}`
    );
  if (errors.length)
    throw new Error(`${dictionary.work}: ${errors.slice(0, 10).join("; ")}`);
  audits.push({
    work: dictionary.work,
    entries: definitions.length,
    bibleLinks,
    strongLinks,
    wordLinks,
    generatedWordLinks,
    editorialCueLinks,
    selfLinksRemoved: dictionary.entryLinks.selfLinksRemoved,
    verseAnchors: dictionary.verseAnchors,
    status: "ok"
  });
}

const correspondenceIndex = JSON.parse(
  await readFile(path.join(normalizedRoot, "correspondences.json"), "utf8")
);
if (
  correspondenceIndex.format !== "bible-strong-dictionary-correspondences" ||
  correspondenceIndex.schemaVersion !== 1 ||
  !Array.isArray(correspondenceIndex.groups)
)
  throw new Error("Index de correspondances invalide");
const groupIds = new Set();
const linkedEntries = new Set();
for (const group of correspondenceIndex.groups) {
  if (groupIds.has(group.id)) throw new Error(`Groupe dupliqué : ${group.id}`);
  groupIds.add(group.id);
  if (new Set(group.members.map((member) => member.work)).size < 2)
    throw new Error(`Groupe sans pluralité de sources : ${group.id}`);
  for (const member of group.members) {
    const identity = `${member.work}:${member.id}`;
    if (linkedEntries.has(identity))
      throw new Error(`Entrée présente dans plusieurs groupes : ${identity}`);
    linkedEntries.add(identity);
    if (entriesByIdentity.get(identity) !== member.word)
      throw new Error(
        `Membre de correspondance absent ou divergent : ${identity}`
      );
  }
}
const nebuchadnezzar = correspondenceIndex.groups.find((group) =>
  group.aliases.includes("nebucadnetsar")
);
if (
  !nebuchadnezzar ||
  !nebuchadnezzar.aliases.includes("nebuchadnezzar") ||
  new Set(nebuchadnezzar.members.map((member) => member.language)).size !== 2
)
  throw new Error("Correspondance bilingue Nébucadnetsar absente");

process.stdout.write(
  `${JSON.stringify(
    {
      dictionaries: audits,
      correspondences: {
        ...correspondenceIndex.stats,
        nebuchadnezzarMembers: nebuchadnezzar.members.length,
        status: "ok"
      }
    },
    null,
    2
  )}\n`
);
