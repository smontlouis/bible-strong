/** This process reads masked targets only. Run one edition/scenario per process. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { generateStrongLedger as Generate } from "../../src/strongLedger.js";
import { canonicalCarrier } from "../../src/strongCanonicalResolution.js";
import { sha, type Prediction, type Split } from "./contract.js";

const [rootArg, edition, scenario, splitArg, suffix = ""] =
  process.argv.slice(2);
assert(
  rootArg && edition && scenario && ["development", "test"].includes(splitArg)
);
const split = splitArg as Split;
const root = path.resolve(rootArg);
const env = path.join(root, "environments", scenario);
const originalCwd = process.cwd();
const masked = path.join(root, "masked", `${edition}-${split}.bible.json`);
const snapshot = path.join(root, "initial-code/apps/resource-studio");
const allowlist = JSON.parse(
  await readFile(path.join(env, "allowed-inputs.json"), "utf8")
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
for (const file of [...allowlist.files, "empty-dictionary.sqlite"]) {
  const target = path.join(env, file);
  assert.equal(
    sha(await readFile(target)),
    prepared.files[path.relative(root, target)],
    `input-drift:${file}`
  );
}
assert.equal(
  sha(await readFile(masked)),
  prepared.files[path.relative(root, masked)]
);
globalThis.fetch = async () => {
  throw new Error("network-forbidden-in-prediction");
};
process.chdir(env);
const initial = (await import(
  pathToFileURL(path.join(snapshot, "src/strongLedger.ts")).href
)) as { generateStrongLedger: typeof Generate };
const { readStrongDictionaryTranslationCandidates } = await import(
  pathToFileURL(path.join(snapshot, "src/strongDictionaryLexicon.ts")).href
);
assert.deepEqual(
  readStrongDictionaryTranslationCandidates("empty-dictionary.sqlite", {
    strict: true
  }),
  []
);
const outputDir = path.join(
  root,
  "baseline",
  `${edition}-${scenario}-${split}${suffix}`
);
await mkdir(path.dirname(outputDir), { recursive: true });
await mkdir(outputDir, { recursive: false });
const ledger = await initial.generateStrongLedger({
  bible: `night-${edition.toLowerCase()}`,
  profileBible:
    edition === "Sg1910"
      ? "nbs"
      : edition === "Darby" || edition === "DarbyR"
        ? "fmar"
        : edition === "SG21"
          ? "s21"
          : "neg79",
  dictionaryPath: path.join(env, "empty-dictionary.sqlite"),
  biblePath: masked,
  outputDir,
  writeArtifacts: false,
  writeLexicalReport: false,
  applyCuratedOverrides: false,
  excludedReferenceNames: ["Sg1910", "Darby", "DarbyR"].filter(
    (n) => !allowlist.references.includes(n)
  )
});
const predictions: Prediction[] = ledger.verses.map((v) => ({
  ref: v.ref,
  text: v.text,
  words: v.tokens.map((t) => t.text),
  placements: v.annotations
    .filter((a) => a.visibility === "reader")
    .flatMap((a) => {
      const carrier = canonicalCarrier(a);
      return carrier
        ? [
            {
              ...carrier,
              confidence: a.confidence,
              source: `${a.source}:${a.diagnostics.join("|")}`
            }
          ]
        : [];
    }),
  units: v.resolution?.decisions ?? [],
  issues: v.resolution?.issues ?? [],
  unownedAnnotationIds: v.resolution?.unownedAnnotationIds ?? []
}));
assert(predictions.every((v) => v.units.length > 0 || v.issues.length > 0));
const content = JSON.stringify(predictions) + "\n";
await writeFile(path.join(outputDir, "predictions.json"), content, {
  flag: "wx"
});
await writeFile(
  path.join(outputDir, "receipt.json"),
  JSON.stringify(
    {
      edition,
      scenario,
      split,
      baseCommit: "dec602f8db67f94476f7f50a4289de5c405640a1",
      inputFingerprint: ledger.inputFingerprint,
      maskedSha256: sha(await readFile(masked)),
      predictionsSha256: sha(content),
      references: allowlist.references,
      dictionaryCandidates: 0,
      resolutionSummary: ledger.resolutionSummary,
      profile: ledger.translationProfile,
      network: "disabled",
      timestamp: new Date().toISOString()
    },
    null,
    2
  ) + "\n",
  { flag: "wx" }
);
process.chdir(originalCwd);
console.log(
  JSON.stringify({
    edition,
    scenario,
    split,
    verses: predictions.length,
    sha256: sha(content),
    summary: ledger.resolutionSummary
  })
);
