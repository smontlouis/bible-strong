import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readStrongLedgerSqlite } from "../../src/strongLedgerStore.js";
import { reconstructionFromLedger } from "../../src/strongConcordanceGeneration.js";
import { refinePredicateRelations } from "../../src/strongPredicateRelations.js";
const root = path.resolve(process.argv[2]);
const old = JSON.parse(
  await readFile(path.join(root, "baseline-origin.json"), "utf8")
).experiment;
const results = [];
for (const ref of ["1Kgs.8.21", "Rev.15.4", "1John.1.2"]) {
  const verse = readStrongLedgerSqlite({
    sqlitePath: path.join(old, "full/generated/s21/bible-s21-strong.sqlite"),
    onlyRef: ref
  }).verses[0];
  assert(verse);
  const result = refinePredicateRelations({
    initial: reconstructionFromLedger(verse),
    display: "expressions"
  });
  results.push({ ref, ...result });
  if (ref === "1Kgs.8.21")
    assert(!result.prediction.placements.some((p) => p.strong === "H3772"));
  if (ref === "Rev.15.4")
    assert.equal(
      result.prediction.placements.find((p) => p.strong === "G1392")?.kind,
      "phrase"
    );
  if (ref === "1John.1.2")
    assert.equal(
      result.prediction.placements.find((p) => p.strong === "G3140")?.kind,
      "word"
    );
}
await writeFile(
  path.join(root, "canary.json"),
  JSON.stringify(results, null, 2) + "\n"
);
console.log(
  results.map((x) => ({ ref: x.ref, rules: x.changes.map((c) => c.rule) }))
);
