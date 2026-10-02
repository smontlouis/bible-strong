import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { repairS21Jeremiah } from "../../src/strongCanonicalTextRepair.js";
import type { CanonicalBiblePublication } from "../../src/strongBibleMobilePublication.js";
const [source, output] = process.argv.slice(2);
assert(source && output);
const original: CanonicalBiblePublication = JSON.parse(
  await readFile(source, "utf8")
);
const result = repairS21Jeremiah(original),
  plain: Record<string, Record<string, Record<string, string>>> = {};
let unchanged = 0;
for (const [b, cs] of Object.entries(result.publication.verses))
  for (const [c, vs] of Object.entries(cs))
    for (const [v, entry] of Object.entries(vs)) {
      ((plain[b] ??= {})[c] ??= {})[v] = entry.text;
      if (b !== "24" || c !== "23" || !["18", "19"].includes(v)) {
        assert.deepEqual(entry, original.verses[b][c][v]);
        unchanged++;
      }
    }
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "bible-s21.json"),
  JSON.stringify(plain) + "\n",
  { flag: "wx" }
);
await writeFile(
  path.join(output, "bible-s21-canonical.json"),
  JSON.stringify(result.publication) + "\n",
  { flag: "wx" }
);
await writeFile(
  path.join(output, "repair.json"),
  JSON.stringify(
    {
      ...result.receipt,
      source,
      unchangedVerses: unchanged,
      newVerseCount: result.publication.verseCount,
      sourceNotModified: true
    },
    null,
    2
  ) + "\n",
  { flag: "wx" }
);
console.log(JSON.stringify(result.receipt));
