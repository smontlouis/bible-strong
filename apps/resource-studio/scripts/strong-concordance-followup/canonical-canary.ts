/** Bounded integration check on already-consulted development verses only. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { generateStrongLedger } from "../../src/strongLedger.js";
import { sha } from "../strong-concordance-night/contract.js";

const workspace = process.cwd();
const root = path.resolve(
  process.argv[2] ?? "outputs/strong-concordance-reading-groups"
);
const refs = new Set(["Exod.20.4", "Luke.22.9", "Luke.22.64"]);
const input: Array<{ ref: string; text: string }> = JSON.parse(
  await readFile(path.join(root, "masked/SG21-development.json"), "utf8")
);
const selected = input.filter((r) => refs.has(r.ref));
assert.equal(selected.length, 3);
const bible: Record<string, Record<string, Record<string, string>>> = {};
for (const v of selected) {
  const [b, c, n] = v.ref.split(".");
  ((bible[BOOK_IDS.indexOf(b as never) + 1] ??= {})[c] ??= {})[n] = v.text;
}
const directory = path.join(root, "canonical-current");
await mkdir(directory, { recursive: true });
for (const [name, target] of [
  ["src", path.join(workspace, "src")],
  ["scripts", path.join(workspace, "scripts")],
  ["data", path.join(root, "environments/target-excluded/data")]
]) {
  if (!existsSync(path.join(directory, name)))
    await symlink(target, path.join(directory, name));
}
const inputFile = path.join(directory, "masked.json");
await writeFile(inputFile, JSON.stringify(bible) + "\n");
globalThis.fetch = async () => {
  throw new Error("network-forbidden-in-canary");
};
process.chdir(directory);
const ledger = await generateStrongLedger({
  bible: "followup-canary",
  profileBible: "s21",
  biblePath: inputFile,
  dictionaryPath: path.join(
    root,
    "environments/target-excluded/empty-dictionary.sqlite"
  ),
  outputDir: path.join(directory, "ledger"),
  writeArtifacts: false,
  writeLexicalReport: false,
  applyCuratedOverrides: false
});
process.chdir(workspace);
const checks = [
  { ref: "Exod.20.4", strong: "H4325", state: "visible", unresolved: false },
  { ref: "Luke.22.9", strong: "G2090", state: "visible", unresolved: false },
  { ref: "Luke.22.64", strong: "G5180", state: "unresolved", unresolved: true }
].map((check) => {
  const verse = ledger.verses.find((v) => v.ref === check.ref)!;
  assert.equal(verse.text, selected.find((v) => v.ref === check.ref)!.text);
  const unit = verse.resolution!.decisions.find((u) =>
    u.strong.includes(check.strong)
  )!;
  assert(unit);
  assert.equal(unit.state, check.state);
  assert.equal(unit.source.readingUnresolved, check.unresolved);
  return {
    ...check,
    sourceUnitId: unit.sourceUnitId,
    assessment: unit.source.readingAssessment
  };
});
await writeFile(
  path.join(directory, "verification.json"),
  JSON.stringify(
    {
      inputSha256: sha(await readFile(inputFile)),
      inputFingerprint: ledger.inputFingerprint,
      policy: ledger.resolutionPolicy,
      verses: ledger.verses.length,
      checks,
      resolutionSummary: ledger.resolutionSummary
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({
    verses: ledger.verses.length,
    checks,
    summary: ledger.resolutionSummary
  })
);
