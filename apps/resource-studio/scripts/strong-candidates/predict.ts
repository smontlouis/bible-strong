/** Separate offline prediction process. No evaluation labels are read here. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateStrongLedger } from "../../src/strongLedger.js";
import { reconstructionFromLedger } from "../../src/strongConcordanceGeneration.js";
import { readStrongDictionaryTranslationCandidates } from "../../src/strongDictionaryLexicon.js";

const [rootArg, edition, scenario] = process.argv.slice(2);
assert(
  rootArg &&
    ["neg79", "s21", "SG21", "NEG", "Sg1910", "Darby", "DarbyR"].includes(
      edition
    )
);
const root = path.resolve(rootArg);
const env = path.join(root, "environment");
const manifest = JSON.parse(
  await readFile(path.join(root, "input-manifest.json"), "utf8")
);
for (const [file, expected] of Object.entries(manifest.files))
  assert.equal(
    createHash("sha256")
      .update(await readFile(path.join(env, file)))
      .digest("hex"),
    expected,
    `input-drift:${file}`
  );
globalThis.fetch = async () => {
  throw new Error("remote-access-forbidden");
};
process.chdir(env);
assert.deepEqual(
  readStrongDictionaryTranslationCandidates("empty-dictionary.sqlite", {
    strict: true
  }),
  []
);
const benchmark = Boolean(scenario);
const excludedReferenceNames =
  !benchmark || scenario === "target-excluded"
    ? []
    : scenario === "control-darby"
      ? ["Darby", "DarbyR"]
      : ["Sg1910"];
const profileBible = ["SG21", "s21"].includes(edition)
  ? "s21"
  : ["NEG", "neg79"].includes(edition)
    ? "neg79"
    : edition === "Sg1910"
      ? "nbs"
      : "fmar";
const display = ["Sg1910", "Darby", "DarbyR"].includes(edition)
  ? "heads"
  : "expressions";
const bible = benchmark ? `integration-${edition.toLowerCase()}` : edition;
const outputDir = path.join(
  root,
  benchmark ? "integration" : "generated",
  benchmark ? `${edition}-${scenario}` : edition
);
await mkdir(outputDir, { recursive: true });
if (!benchmark)
  assert(
    !existsSync(path.join(outputDir, `bible-${edition}-strong.sqlite`)),
    "candidate-already-generated: use a new root"
  );
const ledger = await generateStrongLedger({
  bible,
  profileBible,
  outputDir,
  biblePath: path.join(
    env,
    benchmark
      ? `masked/${edition}-test.bible.json`
      : `data/bibles/bible-${edition}.json`
  ),
  verseCorrespondencePath: benchmark
    ? undefined
    : path.join(root, "correspondence", `${edition}.json`),
  dictionaryPath: path.join(env, "empty-dictionary.sqlite"),
  applyCuratedOverrides: false,
  excludedReferenceNames,
  concordanceDisplay: display,
  concordanceContext: manifest.concordanceContext === true,
  concordanceRecovery: manifest.concordanceRecovery === true,
  concordancePredicates: manifest.concordancePredicates === true,
  writeLexicalReport: false,
  writeArtifacts: !benchmark
});
if (benchmark)
  await writeFile(
    path.join(outputDir, "predictions.json"),
    JSON.stringify(ledger.verses.map(reconstructionFromLedger)) + "\n"
  );
await writeFile(
  path.join(outputDir, "generation.json"),
  JSON.stringify(
    {
      bible,
      verses: ledger.verses.length,
      inputFingerprint: ledger.inputFingerprint,
      references: ledger.references,
      dictionaryCandidates: 0,
      targetAnnotationsRead: false,
      remoteModels: false,
      resolutionSummary: ledger.resolutionSummary,
      display,
      unassignedCanonicalBlocks: ledger.unassignedCanonicalSource?.length ?? 0
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({
    bible,
    verses: ledger.verses.length,
    resolution: ledger.resolutionSummary
  })
);
