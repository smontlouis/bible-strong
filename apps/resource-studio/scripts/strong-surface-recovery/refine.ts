/** Prediction process: only masked baseline and permitted witnesses are read. */
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { raw, save } from "./io.js";
import { sha, type Prediction } from "../strong-concordance-night/contract.js";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { concordanceWitness } from "../../src/strongConcordanceGeneration.js";
import { learnRecoveryLexicon } from "../../src/strongWitnessRecovery.js";
import { recoverAttestedSurfaceCarriers } from "../../src/strongSurfaceRecovery.js";
import {
  learnInflectionLexicon,
  learnWitnessInventory,
  type FrenchInflectionIndex
} from "../../src/strongInflectionEvidence.js";
const [rootArg, edition, scenario, split] = process.argv.slice(2),
  root = path.resolve(rootArg);
const env = path.join(root, "environments", scenario);
const allow = JSON.parse(
  await readFile(path.join(env, "allowed-inputs.json"), "utf8")
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
assert(!allow.references.includes(edition), "target-leak");
if (["Darby", "DarbyR"].includes(edition))
  assert.deepEqual(allow.references, ["Sg1910"]);
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
const witnessInventory = learnWitnessInventory(corpus());
const morphologyBytes = await readFile(
  path.join(root, "french-inflections.json")
);
const morphologyReceipt = JSON.parse(
  await readFile(path.join(root, "french-inflections-receipt.json"), "utf8")
);
assert.equal(sha(morphologyBytes), morphologyReceipt.outputSha256);
const morphologyIndex: FrenchInflectionIndex = JSON.parse(
  morphologyBytes.toString()
);
const inflections = {
  index: morphologyIndex,
  lexicon: learnInflectionLexicon(lexicon, morphologyIndex)
};
const input = `predictions/baseline/${edition}-${scenario}/${split}.json`,
  bytes = await raw(path.join(root, input));
assert.equal(sha(bytes), prepared.files[input], "baseline-drift");
const baseline: Prediction[] = JSON.parse(bytes.toString());
const requested = process.argv[6]?.split(",");
for (const variant of [
  "clitics",
  "repeated",
  "all",
  "single-family",
  "inflections",
  "combined",
  "single-family-extended",
  "consensus",
  "consensus-heads"
]) {
  if (requested && !requested.includes(variant)) continue;
  const policy = {
    clitics: !["repeated", "inflections"].includes(variant),
    repeated: !["clitics", "inflections"].includes(variant),
    inflections: [
      "inflections",
      "combined",
      "single-family-extended",
      "consensus",
      "consensus-heads"
    ].includes(variant),
    inflectionConsensus: variant.startsWith("consensus"),
    clauseBoundaries: variant.startsWith("consensus"),
    requireVerseSupport: variant.startsWith("consensus"),
    minimumFamilies: variant.startsWith("single-family")
      ? (1 as const)
      : (2 as const)
  };
  const result = baseline.map((initial) =>
    recoverAttestedSurfaceCarriers({
      initial,
      lexicon,
      inflections,
      witnessInventory,
      display:
        variant !== "consensus-heads" && ["SG21", "NEG"].includes(edition)
          ? "expressions"
          : "heads",
      policy
    })
  );
  const directory = path.join(
    root,
    "predictions",
    variant,
    `${edition}-${scenario}`
  );
  await save(
    path.join(directory, `${split}.json`),
    result.map((x) => x.prediction),
    true
  );
  await save(
    path.join(directory, `${split}-changes.json`),
    result
      .filter((x) => x.changes.length)
      .map((x) => ({
        ref: x.prediction.ref,
        text: x.prediction.text,
        changes: x.changes
      }))
  );
  await save(path.join(directory, `${split}-receipt.json`), {
    policy,
    baselineSha256: sha(bytes),
    morphologySha256: sha(morphologyBytes),
    references: allow.references,
    minimumDistinctRefs: 2,
    targetAnnotationsRead: false,
    modelCalls: 0
  });
  console.log(
    JSON.stringify({
      edition,
      scenario,
      split,
      variant,
      changes: result.reduce((n, x) => n + x.changes.length, 0)
    })
  );
}
