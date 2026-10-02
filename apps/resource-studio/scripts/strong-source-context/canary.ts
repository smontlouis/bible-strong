import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { readStrongLedgerSqlite } from "../../src/strongLedgerStore.js";
import {
  concordanceWitness,
  reconstructionFromLedger
} from "../../src/strongConcordanceGeneration.js";
import {
  learnCarrierLexicon,
  refineConcordanceContext
} from "../../src/strongConcordanceContext.js";
const root = path.resolve(process.argv[2]),
  old = path.resolve("outputs/strong-candidates-2026-10-02/refined");
const refs = await Promise.all(
  ["Sg1910", "Darby", "DarbyR"].map(async (name) => ({
    name,
    map: buildStrongVerseMap(
      await readStrongCsv(
        path.join(old, "environment/data/strongs", name + ".csv")
      )
    )
  }))
);
function* corpus() {
  for (const w of refs)
    for (const [ref, v] of w.map)
      yield { ref, ...concordanceWitness(w.name, v.row.text) };
}
const lexicon = learnCarrierLexicon(corpus());
const output = [];
for (const [edition, ref] of [
  ["s21", "Deut.5.19"],
  ["neg79", "Jer.52.6"],
  ["neg79", "Rev.22.12"]
] as const) {
  const v = readStrongLedgerSqlite({
    sqlitePath: path.join(
      old,
      "generated",
      edition,
      `bible-${edition}-strong.sqlite`
    ),
    onlyRef: ref
  }).verses[0];
  assert(v);
  const initial = reconstructionFromLedger(v),
    witnesses = refs.flatMap((w) => {
      const r = w.map.get(ref);
      return r ? [concordanceWitness(w.name, r.row.text)] : [];
    });
  const result = refineConcordanceContext({
    initial,
    witnesses,
    lexicon,
    display: "expressions"
  });
  output.push({ edition, ref, text: v.text, ...result });
}
assert.equal(
  output[0].prediction.placements.find((p) => p.strong === "H1589")
    ?.startWordIndex,
  5
);
assert(!output[1].prediction.placements.some((p) => p.strong === "H2320"));
assert(!output[2].prediction.placements.some((p) => p.strong === "G1510"));
await writeFile(
  path.join(root, "focused-context-canary.json"),
  JSON.stringify(output, null, 2) + "\n"
);
console.log(
  output.map((r) => ({
    edition: r.edition,
    ref: r.ref,
    changes: r.changes.map((c) => c.rule)
  }))
);
