import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sha } from "../strong-concordance-night/contract.js";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { concordanceWitness } from "../../src/strongConcordanceGeneration.js";
import {
  learnCarrierLexicon,
  refineConcordanceContext,
  type ContextPolicy
} from "../../src/strongConcordanceContext.js";
import type { ReconstructionVerse } from "../../src/strongConcordanceRefinement.js";
const [rootArg, edition, scenario, split, variant] = process.argv.slice(2);
assert(rootArg && ["development", "test"].includes(split));
const root = path.resolve(rootArg),
  env = path.join(root, "environments", scenario);
if (split === "test")
  assert(
    (await import("node:fs")).existsSync(
      path.join(root, "candidate-freeze.json")
    ),
    "freeze-required-before-reserve"
  );
globalThis.fetch = async () => {
  throw new Error("network-forbidden");
};
const allow = JSON.parse(
  await readFile(path.join(env, "allowed-inputs.json"), "utf8")
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
for (const file of allow.files) {
  const f = path.join(env, file);
  assert.equal(sha(await readFile(f)), prepared.files[path.relative(root, f)]);
}
if (split === "test") {
  const freeze = JSON.parse(
    await readFile(path.join(root, "candidate-freeze.json"), "utf8")
  );
  for (const [file, hash] of Object.entries(freeze.code))
    assert.equal(sha(await readFile(file)), hash, `frozen-code-drift:${file}`);
}
const refs = await Promise.all(
  (allow.references as string[]).map(async (name) => ({
    name,
    map: buildStrongVerseMap(
      await readStrongCsv(path.join(env, `data/strongs/${name}.csv`))
    )
  }))
);
function* corpus() {
  for (const w of refs)
    for (const [ref, v] of w.map)
      yield { ref, ...concordanceWitness(w.name, v.row.text) };
}
const lexicon = learnCarrierLexicon(corpus());
const sourceDir = path.join(
  root,
  "predictions/source",
  `${edition}-${scenario}`
);
const sourceBytes = await readFile(path.join(sourceDir, `${split}.json`));
const sourceReceipt = JSON.parse(
  await readFile(path.join(sourceDir, "receipt.json"), "utf8")
);
assert.equal(sha(sourceBytes), sourceReceipt.predictions[split]);
const source: ReconstructionVerse[] = JSON.parse(sourceBytes.toString());
const policy: ContextPolicy = {
  lightVerbs: ["light", "all", "common"].includes(variant),
  localContext: ["local", "all", "common"].includes(variant),
  measuredGroups: ["groups", "all", "common"].includes(variant)
};
const results = source.map((initial) =>
  refineConcordanceContext({
    initial,
    policy,
    display:
      variant === "common" || ["SG21", "NEG"].includes(edition)
        ? "expressions"
        : "heads",
    lexicon,
    witnesses: refs.flatMap((w) => {
      const v = w.map.get(initial.ref);
      return v ? [concordanceWitness(w.name, v.row.text)] : [];
    })
  })
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
    results.map((r) => ({ ref: r.prediction.ref, changes: r.changes }))
  ) + "\n"
);
console.log(
  JSON.stringify({
    edition,
    scenario,
    split,
    variant,
    changes: results.reduce((n, r) => n + r.changes.length, 0)
  })
);
