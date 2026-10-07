import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { repairJoinedBibleText } from "../../src/strongJoinedTextRepair.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import { sha } from "../strong-concordance-night/contract.js";
import type { CanonicalBiblePublication } from "../../src/strongBibleMobilePublication.js";
const [rootArg, canonicalArg] = process.argv.slice(2),
  root = path.resolve(rootArg);
const origin = JSON.parse(
  await readFile(path.join(root, "baseline-origin.json"), "utf8")
);
const env = path.join(origin.experiment, "full/environment");
const original: CanonicalBiblePublication = JSON.parse(
  await readFile(canonicalArg, "utf8")
);
assert.equal(original.applicationVersionId, "NEG79");
const native = JSON.parse(
  await readFile(path.join(env, "data/bibles/bible-neg79.json"), "utf8")
);
for (const [b, cs] of Object.entries(original.verses))
  for (const [c, vs] of Object.entries(cs))
    for (const [v, entry] of Object.entries(vs))
      assert.equal(entry.text, native[b][c][v]);
const witnesses = [],
  witnessHashes: Record<string, string> = {};
for (const name of ["Sg1910", "Darby", "DarbyR"]) {
  const file = path.join(env, `data/strongs/${name}.csv`);
  witnessHashes[name] = sha(await readFile(file));
  for (const verse of await readStrongCsv(file))
    witnesses.push({
      name,
      ref: `${verse.bookId}.${verse.chapter}.${verse.verse}`,
      text: stripTags(withoutPublisherNotes(verse.text))
    });
}
const result = repairJoinedBibleText(original, witnesses);
const plain: Record<string, Record<string, Record<string, string>>> = {};
let unchanged = 0;
const changed = new Set(
  result.receipt.changes.map((c) => `${c.book}.${c.chapter}.${c.verse}`)
);
for (const [b, cs] of Object.entries(result.publication.verses))
  for (const [c, vs] of Object.entries(cs))
    for (const [v, entry] of Object.entries(vs)) {
      ((plain[b] ??= {})[c] ??= {})[v] = entry.text;
      if (!changed.has(`${b}.${c}.${v}`)) {
        assert.deepEqual(entry, original.verses[b][c][v]);
        unchanged++;
      }
    }
const output = path.join(root, "text-repair");
await mkdir(output, { recursive: true });
for (const [file, data] of Object.entries({
  "bible-neg79.json": plain,
  "bible-neg79-canonical.json": result.publication,
  "repair.json": {
    ...result.receipt,
    source: path.resolve(canonicalArg),
    sourceSha256: sha(await readFile(canonicalArg)),
    witnessHashes,
    unchangedVerses: unchanged,
    targetAnnotationsUsed: false
  }
}))
  await writeFile(
    path.join(output, file),
    JSON.stringify(data, null, 2) + "\n",
    { flag: "wx" }
  );
console.log(
  JSON.stringify({
    changed: result.receipt.changedVerses,
    spaces: result.receipt.insertedSpaces,
    unresolved: result.receipt.unresolved.length,
    unchanged,
    before: result.receipt.beforeRevision,
    after: result.receipt.afterRevision
  })
);
