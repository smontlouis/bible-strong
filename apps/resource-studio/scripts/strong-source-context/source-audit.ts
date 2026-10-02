import assert from "node:assert/strict";
import { writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readCanonicalSourceRows } from "../../src/strongCanonicalResolution.js";
import { readUnparsedSourceRows } from "../../src/strongSourceCoverage.js";
const root = path.resolve(process.argv[2]);
const dir = "data/external/stepbible/amalgamated";
const files = (await readdir(dir))
  .filter((f) => /^(TAHOT|TAGNT).*\.txt$/u.test(f))
  .sort()
  .map((f) => dir + "/" + f);
const old = (await import(
  pathToFileURL(
    path.join(
      root,
      "initial-code/apps/resource-studio/src/strongCanonicalResolution.ts"
    )
  ).href
)) as { readCanonicalSourceRows: typeof readCanonicalSourceRows };
const before = await old.readCanonicalSourceRows(files),
  after = await readCanonicalSourceRows(files),
  byLine = new Map([...after.values()].map((r) => [`${r.file}:${r.line}`, r]));
let changedIdentity = 0;
for (const r of before.values()) {
  const next = byLine.get(`${r.file}:${r.line}`);
  assert(next);
  assert.equal(next.surface, r.surface);
  assert.deepEqual(next.primary, r.primary);
  changedIdentity += next.id === r.id ? 0 : 1;
}
const oldLines = new Set(
  [...before.values()].map((r) => `${r.file}:${r.line}`)
);
const added = [...after.values()].filter(
  (r) => !oldLines.has(`${r.file}:${r.line}`)
);
const unsupported = await readUnparsedSourceRows(files);
assert.equal(unsupported.length, 0);
assert.equal(added.length, 350);
assert.equal(changedIdentity, 0);
const result = {
  before: before.size,
  after: after.size,
  added: added.length,
  survivingIdentityChanges: changedIdentity,
  unparsedRows: unsupported.length,
  addedReferences: [...new Set(added.map((r) => r.reference))],
  addedRows: added.map((r) => ({
    id: r.id,
    file: r.file,
    line: r.line,
    reference: r.reference,
    variants: r.referenceVariants,
    primary: r.primary
  }))
};
await writeFile(
  path.join(root, "source-coverage-audit.json"),
  JSON.stringify(result, null, 2) + "\n"
);
console.log({
  before: before.size,
  after: after.size,
  added: added.length,
  changedIdentity,
  unparsed: unsupported.length
});
