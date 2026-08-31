#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isCheckedBibleUri } from "./dictionary-links.mjs";

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
for (const dictionary of manifest.dictionaries) {
  const databasePath = path.join(normalizedRoot, `${dictionary.work}.sqlite`);
  await access(databasePath);
  const integrity = await query(databasePath, "PRAGMA integrity_check");
  if (integrity[0]?.integrity_check?.toLocaleLowerCase() !== "ok")
    throw new Error(`${dictionary.work}: contrôle d'intégrité SQLite en échec`);

  const definitions = await query(
    databasePath,
    "SELECT id, definition FROM dictionnaire ORDER BY id"
  );
  let bibleLinks = 0;
  let wordLinks = 0;
  const errors = [];
  for (const entry of definitions) {
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
      } else if (/(?:^|\s)word(?:\s|$)/u.test(className)) {
        wordLinks += 1;
        if (!href || /^[a-z][a-z\d+.-]*:\/\//iu.test(href))
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
  if (errors.length)
    throw new Error(`${dictionary.work}: ${errors.slice(0, 10).join("; ")}`);
  audits.push({
    work: dictionary.work,
    entries: definitions.length,
    bibleLinks,
    wordLinks,
    verseAnchors: dictionary.verseAnchors,
    status: "ok"
  });
}

process.stdout.write(`${JSON.stringify({ dictionaries: audits }, null, 2)}\n`);
