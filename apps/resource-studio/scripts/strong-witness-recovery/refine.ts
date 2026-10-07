import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sha, type Prediction } from "../strong-concordance-night/contract.js";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { concordanceWitness } from "../../src/strongConcordanceGeneration.js";
import {
  learnRecoveryLexicon,
  recoverWitnessCarriers
} from "../../src/strongWitnessRecovery.js";
const [rootArg, edition, scenario, split] = process.argv.slice(2),
  root = path.resolve(rootArg);
const env = path.join(root, "environments", scenario);
const allow = JSON.parse(
  await readFile(path.join(env, "allowed-inputs.json"), "utf8")
);
assert(!allow.references.includes(edition), "target-leak");
if (["Darby", "DarbyR"].includes(edition))
  assert.deepEqual(allow.references, ["Sg1910"]);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
for (const file of allow.files)
  assert.equal(
    sha(await readFile(path.join(env, file))),
    prepared.files[path.relative(root, path.join(env, file))]
  );
if (split === "test") {
  const freeze = JSON.parse(
    await readFile(path.join(root, "candidate-freeze.json"), "utf8")
  );
  for (const [file, hash] of Object.entries(freeze.code))
    assert.equal(sha(await readFile(file)), hash, `frozen-code-drift:${file}`);
}
globalThis.fetch = async () => {
  throw new Error("network-forbidden");
};
const refs = await Promise.all(
  (allow.references as string[]).map(async (name) => ({
    name,
    map: buildStrongVerseMap(
      await readStrongCsv(path.join(env, `data/strongs/${name}.csv`))
    )
  }))
);
function* corpus() {
  for (const witness of refs)
    for (const [ref, verse] of witness.map)
      yield { ref, ...concordanceWitness(witness.name, verse.row.text) };
}
const lexicon = learnRecoveryLexicon(corpus());
const input = `predictions/baseline/${edition}-${scenario}/${split}.json`,
  bytes = await readFile(path.join(root, input));
assert.equal(sha(bytes), prepared.files[input], "baseline-drift");
const initial: Prediction[] = JSON.parse(bytes.toString());
for (const variant of ["lexicon", "neighbors", "compounds", "all"]) {
  const policy = {
    lexical: variant !== "compounds",
    neighbors: variant !== "lexicon",
    compounds: ["compounds", "all"].includes(variant)
  };
  const results = initial.map((prediction) =>
    recoverWitnessCarriers({ initial: prediction, lexicon, policy })
  );
  const dir = path.join(root, "predictions", variant, `${edition}-${scenario}`);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${split}.json`),
    JSON.stringify(results.map((r) => r.prediction)) + "\n"
  );
  await writeFile(
    path.join(dir, `${split}-changes.json`),
    JSON.stringify(
      results
        .filter((r) => r.changes.length)
        .map((r) => ({ ref: r.prediction.ref, changes: r.changes })),
      null,
      2
    ) + "\n"
  );
  console.log(
    JSON.stringify({
      edition,
      scenario,
      split,
      variant,
      changes: results.reduce((sum, r) => sum + r.changes.length, 0)
    })
  );
}
