import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyBibleSourceRepairs,
  hashVerseTexts,
  readBibleSourceRepairs,
  type BibleSourceRepairSet
} from "./bibleSourceRepairs.js";
import { hashVerseText } from "./wordsOfJesus.js";
import { loadBibleText } from "./wordsOfJesusSources.js";

const describe = (repair: BibleSourceRepairSet["repairs"][number]) => {
  switch (repair.op) {
    case "split":
      return `split ${repair.ref} at ${repair.at}, dropping ${JSON.stringify(repair.marker)}`;
    case "join":
      return `join ${repair.ref} with the next row, separated by ${JSON.stringify(repair.separator)}`;
    case "move":
      return `move ${repair.ref} to ${repair.to}`;
    case "shift":
      return `shift ${repair.chapter} verses ${repair.first}-${repair.last} by ${repair.by > 0 ? "+" : ""}${repair.by}`;
  }
};

/**
 * Prints every repair of the selected Bibles with the verses before and after,
 * read from the local source cache. The output holds Bible text: it is meant
 * for review on the operator's machine, never for the repository.
 */
async function report(root: string, versionIds: readonly string[]) {
  let repairCount = 0;
  for (const versionId of versionIds) {
    const text = await loadBibleText(versionId, { root });
    const changes = text.repairs?.changes ?? [];
    console.log(`# ${versionId}: ${changes.length} repairs`);
    for (const change of changes) {
      repairCount += 1;
      console.log(`\n${describe(change.repair)}`);
      console.log(`  evidence: ${change.repair.evidence}`);
      for (const verse of change.before)
        console.log(`  - ${verse.ref} ${JSON.stringify(verse.text)}`);
      for (const verse of change.after)
        console.log(`  + ${verse.ref} ${JSON.stringify(verse.text)}`);
    }
    console.log("");
  }
  console.log(`${repairCount} repairs applied`);
}

/**
 * Applies a draft repair file without its anchors and prints the hashes each
 * repair reads and writes, to complete the draft after reviewing `report`.
 */
async function draft(root: string, draftPath: string) {
  const drafts = JSON.parse(
    await readFile(path.resolve(root, draftPath), "utf8")
  ) as { bibles: Record<string, BibleSourceRepairSet> };
  for (const [versionId, repairs] of Object.entries(drafts.bibles)) {
    const text = await loadBibleText(versionId, { root });
    if (text.canonicalSource || text.repairs)
      throw new Error(`bible-source-repairs-draft-unsupported:${versionId}`);
    const applied = applyBibleSourceRepairs({
      versionId,
      sourceSha256: text.sourceSha256,
      bible: text.legacyBible,
      repairs,
      anchored: false
    });
    console.log(`# ${versionId} sourceSha256=${text.sourceSha256}`);
    for (const change of applied.changes) {
      const hashes = (verses: typeof change.before) =>
        verses.map((verse) => hashVerseText(verse.text));
      console.log(
        JSON.stringify({
          repair: describe(change.repair),
          before: hashes(change.before),
          beforeRange: hashVerseTexts(change.before.map((verse) => verse.text)),
          after: hashes(change.after)
        })
      );
    }
  }
}

export async function runBibleSourceRepairsCli(argv: readonly string[]) {
  const [command, ...rest] = argv;
  const root = process.cwd();
  const option = (name: string) => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : rest[index + 1];
  };
  const configured = Object.keys((await readBibleSourceRepairs(root)).bibles);
  const versionIds = option("--version")?.toUpperCase().split(",");
  switch (command) {
    case "report":
      return report(root, versionIds ?? configured);
    case "draft": {
      const draftPath = option("--file");
      if (!draftPath) throw new Error("bible-source-repairs-draft-required");
      return draft(root, draftPath);
    }
    default:
      console.log(
        "usage: bible-source-repairs <report [--version V[,V]] | draft --file draft.json>"
      );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBibleSourceRepairsCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
