import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseStepReference } from "../src/stepReference.js";
import {
  readStepOriginalData,
  selectStepOriginalTokensForRefs
} from "../src/stepOriginals.js";
import { readCanonicalSourceRows } from "../src/strongCanonicalResolution.js";

test("square and curly coordinates are preserved but cannot hijack the French projection", () => {
  const a = parseStepReference("Rom.16.25{14.24}#01=NKO")!;
  assert.equal(a.key, "Rom.16.25");
  assert.deepEqual(a.alternateKeys, []);
  assert.deepEqual(a.variants, [{ ref: "Rom.14.24", notation: "curly" }]);
  const b = parseStepReference("2Co.13.13[13.14]#03=NKO")!;
  assert.deepEqual(b.alternateKeys, []);
  assert.equal(b.key, "2Cor.13.13");
  assert.deepEqual(b.variants, [{ ref: "2Cor.13.14", notation: "square" }]);
});
test("round projection remains explicit with other conventions present", () => {
  const p = parseStepReference("Act.13.38(13.39)[13.37]{13.36}#04=N(k)O")!;
  assert.deepEqual(p.alternateKeys, ["Acts.13.39"]);
  assert.equal(p.variants.length, 3);
  assert.equal(p.type, "N(k)O");
  for (const ref of [
    "Rom.1.1[1.2}#01=NKO",
    "Rom.1.1[1.2-3]#01=NKO",
    "Rom.1.1(1.2)(1.3)#01=NKO"
  ])
    assert.equal(parseStepReference(ref), undefined);
});
test("new notations keep unique physical identities and source-evidence ownership", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "step-reference-")),
    file = path.join(dir, "TAGNT.txt");
  const row = (ref: string, code: string, word: string) =>
    `${ref}\t${word}\t${word}\t${code}=N-NSM\tform=gloss\tNA28\t\t\t\t\t\t${code}`;
  try {
    await writeFile(
      file,
      [
        row("Rom.16.25{14.24}#01=NKO", "G0001", "alpha"),
        row("2Co.13.13[13.14]#01=NKO", "G0002", "beta"),
        row("Act.13.38(13.39)#01=NKO", "G0003", "gamma")
      ].join("\n")
    );
    const data = await readStepOriginalData([file]);
    const rows = await readCanonicalSourceRows([file]);
    assert.equal(rows.size, 3);
    for (const ref of ["Rom.16.25", "2Cor.13.13", "Acts.13.39"]) {
      const s = selectStepOriginalTokensForRefs(data.verseMap, [ref], {
        preferAlternateRef: true
      });
      assert.equal(s.tokens.length, 1);
      assert(rows.has(s.tokens[0].stepSourceIdentity));
    }
    for (const ref of ["Rom.14.24", "2Cor.13.14", "Acts.13.38"])
      assert.equal(
        selectStepOriginalTokensForRefs(data.verseMap, [ref], {
          preferAlternateRef: true
        }).tokens.length,
        0
      );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
