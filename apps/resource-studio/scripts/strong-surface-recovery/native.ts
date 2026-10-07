/** Execute the real generator from its snapshot, with only permitted input files. */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sha } from "../strong-concordance-night/contract.js";
import { save } from "./io.js";
import type {
  generateStrongLedger,
  StrongLedgerOptions
} from "../../src/strongLedger.js";
import type { reconstructionFromLedger } from "../../src/strongConcordanceGeneration.js";
const [rootArg, edition, scenario, variant, split = "test"] =
    process.argv.slice(2),
  root = path.resolve(rootArg);
assert(["baseline", "candidate"].includes(variant));
const freeze = JSON.parse(
  await readFile(path.join(root, "candidate-freeze.json"), "utf8")
);
for (const [file, h] of Object.entries(freeze.code))
  assert.equal(sha(await readFile(file)), h, `frozen-code-drift:${file}`);
assert.equal(
  sha(await readFile(path.join(root, "french-inflections.json"))),
  freeze.inflectionsSha256
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
const base = path.join(root, "environments", scenario),
  env = path.join(root, "prediction-environments", `${variant}-${scenario}`);
const code = path.join(
  root,
  variant === "baseline" ? "baseline-code" : "candidate-code"
);
const allow = JSON.parse(
  await readFile(path.join(base, "allowed-inputs.json"), "utf8")
);
assert(!allow.references.includes(edition), "target-leak");
const hashes: Record<string, string> = {};
for (const file of [...allow.files, "empty-dictionary.sqlite"]) {
  const source = path.join(base, file),
    dest = path.join(env, file),
    h = sha(await readFile(source));
  assert.equal(h, prepared.files[path.relative(root, source)]);
  await mkdir(path.dirname(dest), { recursive: true });
  if (!existsSync(dest))
    await copyFile(source, dest, constants.COPYFILE_FICLONE);
  assert.equal(sha(await readFile(dest)), h);
  hashes[file] = h;
}
for (const name of ["src", "scripts"])
  if (!existsSync(path.join(env, name)))
    await symlink(path.join(code, name), path.join(env, name));
const masked = `masked/${edition}-${split}.bible.json`,
  bytes = await readFile(path.join(root, masked));
assert.equal(sha(bytes), prepared.files[masked]);
const target = path.join(env, `${edition}-${split}.json`);
await copyFile(path.join(root, masked), target, constants.COPYFILE_FICLONE);
hashes[masked] = sha(bytes);
globalThis.fetch = async () => {
  throw new Error("network-forbidden");
};
process.chdir(env);
const engine = (await import(
  pathToFileURL(path.join(code, "src/strongLedger.ts")).href
)) as { generateStrongLedger: typeof generateStrongLedger };
const projection = (await import(
  pathToFileURL(path.join(code, "src/strongConcordanceGeneration.ts")).href
)) as { reconstructionFromLedger: typeof reconstructionFromLedger };
const options: StrongLedgerOptions = {
  bible: `blind-${edition.toLowerCase()}`,
  profileBible:
    edition === "SG21"
      ? "s21"
      : edition === "NEG"
        ? "neg79"
        : edition === "Sg1910"
          ? "nbs"
          : "fmar",
  biblePath: target,
  outputDir: path.join(root, "native-unused-artifacts"),
  dictionaryPath: path.join(env, "empty-dictionary.sqlite"),
  writeArtifacts: false,
  writeLexicalReport: false,
  applyCuratedOverrides: false,
  excludedReferenceNames: (["Sg1910", "Darby", "DarbyR"] as const).filter(
    (n) => !allow.references.includes(n)
  ),
  concordanceDisplay: ["SG21", "NEG"].includes(edition)
    ? "expressions"
    : "heads",
  concordanceContext: true,
  concordanceRecovery: true,
  concordancePredicates: true,
  concordanceSurfaceRecovery: variant === "candidate",
  surfaceInflectionsPath:
    variant === "candidate"
      ? path.join(root, "french-inflections.json")
      : undefined
};
const ledger = await engine.generateStrongLedger(options);
const predictions = ledger.verses.map(projection.reconstructionFromLedger);
const file = `predictions/${variant === "candidate" ? "integrated" : "baseline"}/${edition}-${scenario}/${split}.json`;
await save(path.join(root, file), predictions, true);
const h = sha(Buffer.from(JSON.stringify(predictions) + "\n"));
await save(path.join(root, file.replace(".json", "-receipt.json")), {
  edition,
  scenario,
  variant,
  split,
  code,
  options,
  inputFingerprint: ledger.inputFingerprint,
  inputs: hashes,
  predictionSha256: h,
  targetAnnotationsRead: false,
  modelCalls: 0
});
if (variant === "baseline") {
  prepared.files[file] = h;
  await save(path.join(root, "prepared-inputs.json"), prepared);
}
console.log(
  JSON.stringify({
    edition,
    scenario,
    variant,
    split,
    verses: predictions.length,
    sha256: h
  })
);
