/** Target-blind generation. The evaluator is a separate process. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  symlink,
  lstat,
  readlink,
  unlink
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { generateStrongLedger } from "../../src/strongLedger.js";
import type { reconstructionFromLedger } from "../../src/strongConcordanceGeneration.js";
const sha = (x: string | Buffer) =>
  createHash("sha256").update(x).digest("hex");
const [rootArg, edition, scenario, variant] = process.argv.slice(2);
const requestedSplit = process.argv[6] ?? "test";
assert(["development", "test"].includes(requestedSplit));
assert(
  rootArg && ["SG21", "NEG", "Sg1910", "Darby", "DarbyR"].includes(edition)
);
assert(["baseline", "source", "candidate", "common"].includes(variant));
const root = path.resolve(rootArg),
  workspace = process.cwd();
if (["candidate", "common"].includes(variant) && requestedSplit === "test")
  assert(
    existsSync(path.join(root, "candidate-freeze.json")),
    "candidate-freeze-required-before-reserve"
  );
const code =
  variant === "baseline"
    ? path.join(root, "baseline-code")
    : variant === "source"
      ? path.join(root, "source-code")
      : existsSync(path.join(root, "candidate-code"))
        ? path.join(root, "candidate-code")
        : workspace;
const baseEnv = path.join(root, "environments", scenario),
  env = path.join(root, "prediction-environments", `${variant}-${scenario}`);
const allow = JSON.parse(
  await readFile(path.join(baseEnv, "allowed-inputs.json"), "utf8")
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
assert(!allow.references.includes(edition), "target-leak");
if (["Darby", "DarbyR"].includes(edition))
  assert.deepEqual(allow.references, ["Sg1910"]);
const hashes: Record<string, string> = {};
for (const f of [...allow.files, "empty-dictionary.sqlite"]) {
  const from = path.join(baseEnv, f),
    dest = path.join(env, f);
  await mkdir(path.dirname(dest), { recursive: true });
  const h = sha(await readFile(from));
  assert.equal(h, prepared.files[path.relative(root, from)]);
  if (!existsSync(dest)) await copyFile(from, dest);
  assert.equal(sha(await readFile(dest)), h);
  hashes[f] = h;
}
for (const name of ["src", "scripts"]) {
  const link = path.join(env, name),
    target = path.join(code, name);
  if (existsSync(link)) {
    assert((await lstat(link)).isSymbolicLink());
    if ((await readlink(link)) !== target) await unlink(link);
  }
  if (!existsSync(link)) await symlink(target, link);
}
const combined: Record<string, Record<string, Record<string, string>>> = {},
  scopes = new Map<string, Set<string>>();
for (const split of requestedSplit
  ? [requestedSplit]
  : ["development", "test"]) {
  const f = path.join(root, "masked", `${edition}-${split}.bible.json`),
    bytes = await readFile(f);
  assert.equal(sha(bytes), prepared.files[path.relative(root, f)]);
  hashes[path.relative(root, f)] = sha(bytes);
  const b = JSON.parse(bytes.toString());
  for (const [bk, chapters] of Object.entries(b))
    Object.assign((combined[bk] ??= {}), chapters);
  const refsFile = path.join(root, "masked", `${edition}-${split}.json`);
  const refsBytes = await readFile(refsFile);
  assert.equal(sha(refsBytes), prepared.files[path.relative(root, refsFile)]);
  const refs = JSON.parse(refsBytes.toString());
  scopes.set(split, new Set(refs.map((r: { ref: string }) => r.ref)));
}
const masked = path.join(env, `${edition}.json`);
await writeFile(masked, JSON.stringify(combined));
globalThis.fetch = async () => {
  throw new Error("remote-access-forbidden");
};
process.chdir(env);
const engine = (await import(
  pathToFileURL(path.join(code, "src/strongLedger.ts")).href
)) as { generateStrongLedger: typeof generateStrongLedger };
const projection = (await import(
  pathToFileURL(path.join(code, "src/strongConcordanceGeneration.ts")).href
)) as { reconstructionFromLedger: typeof reconstructionFromLedger };
const dir = path.join(
  root,
  "predictions",
  variant === "candidate" ? "integrated" : variant,
  `${edition}-${scenario}`
);
await mkdir(dir, { recursive: true });
const options: Parameters<typeof generateStrongLedger>[0] & {
  concordanceContext?: boolean;
  concordanceRecovery?: boolean;
  concordancePredicates?: boolean;
} = {
  bible: `blind-${edition.toLowerCase()}`,
  profileBible:
    edition === "SG21"
      ? "s21"
      : edition === "NEG"
        ? "neg79"
        : edition === "Sg1910"
          ? "nbs"
          : "fmar",
  biblePath: masked,
  outputDir: dir,
  dictionaryPath: path.join(env, "empty-dictionary.sqlite"),
  writeArtifacts: false,
  writeLexicalReport: false,
  applyCuratedOverrides: false,
  excludedReferenceNames: ["Sg1910", "Darby", "DarbyR"].filter(
    (n) => !allow.references.includes(n)
  ),
  concordanceDisplay:
    variant === "common" || ["SG21", "NEG"].includes(edition)
      ? "expressions"
      : "heads",
  concordanceContext: true,
  concordanceRecovery: true,
  concordancePredicates: ["candidate", "common"].includes(variant)
};
const ledger = await engine.generateStrongLedger(options);
const predictions = ledger.verses.map(projection.reconstructionFromLedger),
  resultHashes: Record<string, string> = {};
for (const [split, refs] of scopes) {
  const selected = predictions.filter((v) => refs.has(v.ref));
  assert.equal(selected.length, refs.size);
  const content = JSON.stringify(selected) + "\n";
  await writeFile(path.join(dir, `${split}.json`), content);
  resultHashes[split] = sha(content);
}
await writeFile(
  path.join(dir, "receipt.json"),
  JSON.stringify(
    {
      edition,
      scenario,
      variant,
      code,
      inputFingerprint: ledger.inputFingerprint,
      inputs: hashes,
      predictions: resultHashes,
      targetAnnotationsRead: false,
      remoteModels: false,
      options
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({ edition, scenario, variant, verses: ledger.verses.length })
);

if (variant === "baseline") {
  for (const [split, hash] of Object.entries(resultHashes))
    prepared.files[
      `predictions/baseline/${edition}-${scenario}/${split}.json`
    ] = hash;
  await writeFile(
    path.join(root, "prepared-inputs.json"),
    JSON.stringify(prepared, null, 2) + "\n"
  );
}
