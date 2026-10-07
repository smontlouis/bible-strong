/** This process cannot read evaluator labels. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { sha, type Prediction } from "../strong-concordance-night/contract.js";
import { refinePredicateRelations } from "../../src/strongPredicateRelations.js";
const [rootArg, edition, scenario, split] = process.argv.slice(2),
  root = path.resolve(rootArg);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
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
const file = `predictions/baseline/${edition}-${scenario}/${split}.json`,
  bytes = await readFile(path.join(root, file));
assert.equal(sha(bytes), prepared.files[file], "baseline-drift");
const baseline: Prediction[] = JSON.parse(bytes.toString());
for (const variant of ["guard", "expressions", "all", "common"]) {
  const result = baseline.map((initial) =>
    refinePredicateRelations({
      initial,
      display:
        variant === "common" || ["SG21", "NEG"].includes(edition)
          ? "expressions"
          : "heads",
      preserveExistingDisplay: variant !== "common",
      policy: {
        expressions: variant !== "guard",
        nominalGuard: variant !== "expressions"
      }
    })
  );
  const directory = path.join(
    root,
    "predictions",
    variant,
    `${edition}-${scenario}`
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${split}.json`),
    JSON.stringify(result.map((x) => x.prediction)) + "\n"
  );
  await writeFile(
    path.join(directory, `${split}-changes.json`),
    JSON.stringify(
      result
        .filter((x) => x.changes.length)
        .map((x) => ({ ref: x.prediction.ref, changes: x.changes })),
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
      changes: result.reduce((n, x) => n + x.changes.length, 0)
    })
  );
}
