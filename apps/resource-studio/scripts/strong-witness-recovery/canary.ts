import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { readStrongLedgerSqlite } from "../../src/strongLedgerStore.js";
import {
  concordanceWitness,
  reconstructionFromLedger
} from "../../src/strongConcordanceGeneration.js";
import {
  learnRecoveryLexicon,
  recoverWitnessCarriers
} from "../../src/strongWitnessRecovery.js";
const root = path.resolve(process.argv[2]);
const origin = JSON.parse(
  await readFile(path.join(root, "baseline-origin.json"), "utf8")
);
const old = origin.experiment as string;
const refs = await Promise.all(
  ["Sg1910", "Darby", "DarbyR"].map(async (name) => ({
    name,
    map: buildStrongVerseMap(
      await readStrongCsv(
        path.join(old, "full/environment/data/strongs", name + ".csv")
      )
    )
  }))
);
function* corpus() {
  for (const w of refs)
    for (const [ref, verse] of w.map)
      yield { ref, ...concordanceWitness(w.name, verse.row.text) };
}
const lexicon = learnRecoveryLexicon(corpus()),
  output = [];
for (const edition of ["s21", "neg79"])
  for (const ref of ["1John.1.2", "1John.1.3", "1John.1.8"]) {
    const verse = readStrongLedgerSqlite({
      sqlitePath: path.join(
        old,
        `full/generated/${edition}/bible-${edition}-strong.sqlite`
      ),
      onlyRef: ref
    }).verses[0];
    assert(verse);
    const initial = reconstructionFromLedger(verse),
      result = recoverWitnessCarriers({ initial, lexicon });
    output.push({
      edition,
      ref,
      changes: result.changes.map((change) => ({
        ...change,
        surface: initial.words[change.placement.startWordIndex!]
      }))
    });
    if (edition === "s21" && ref === "1John.1.2")
      assert(
        result.changes.some(
          (c) =>
            c.placement.strong === "G3140" &&
            initial.words[c.placement.startWordIndex!] === "témoins"
        )
      );
    if (ref === "1John.1.3")
      assert(result.changes.some((c) => c.placement.strong === "G5547"));
  }
await writeFile(
  path.join(root, "canary.json"),
  JSON.stringify(output, null, 2) + "\n"
);
console.log(
  JSON.stringify(
    output.map((row) => ({
      ...row,
      changes: row.changes.map((c) => ({
        rule: c.rule,
        strong: c.placement.strong,
        surface: c.surface
      }))
    })),
    null,
    2
  )
);
