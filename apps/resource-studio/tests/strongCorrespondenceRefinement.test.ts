import assert from "node:assert/strict";
import test from "node:test";
import { refineExactCorrespondence } from "../src/strongCorrespondenceRefinement.js";
import type { VerseCorrespondenceBlock } from "../src/verseCorrespondence.js";
const blocks: VerseCorrespondenceBlock[] = [
  {
    kind: "split",
    targetRefs: ["Gen.32.26", "Gen.32.27"],
    canonicalRefs: ["Gen.32.27"]
  },
  {
    kind: "merge",
    targetRefs: ["Gen.32.28"],
    canonicalRefs: ["Gen.32.28", "Gen.32.29"]
  }
];
const exact = new Map(
  [26, 27, 28].map((v) => [
    `Gen.32.${v}`,
    { canonicalRef: `Gen.32.${v + 1}`, witnesses: ["Sg1910"] }
  ])
);
test("recovers a complete monotone verse shift from misleading split/merge blocks", () => {
  const result = refineExactCorrespondence(blocks, exact);
  assert.equal(result.repairs.length, 1);
  assert.deepEqual(
    result.blocks.map((b) => b.kind),
    ["shift", "shift", "shift"]
  );
  assert.deepEqual(
    result.blocks.flatMap((b) => b.targetRefs),
    blocks.flatMap((b) => b.targetRefs)
  );
  assert.deepEqual(
    result.blocks.flatMap((b) => b.canonicalRefs),
    blocks.flatMap((b) => b.canonicalRefs)
  );
  assert.equal(
    refineExactCorrespondence(result.blocks, exact).repairs.length,
    0
  );
});
test("does not infer an unmatched neighbor or duplicate a canonical verse", () => {
  for (const bad of [
    new Map([...exact].slice(0, 2)),
    new Map([...exact, ["Gen.32.28", exact.get("Gen.32.27")!]])
  ])
    assert.deepEqual(refineExactCorrespondence(blocks, bad).blocks, blocks);
});
test("refuses a transposition even with individually exact text matches", () => {
  const swapped = new Map(exact);
  swapped.set("Gen.32.26", exact.get("Gen.32.27")!);
  swapped.set("Gen.32.27", exact.get("Gen.32.26")!);
  assert.deepEqual(refineExactCorrespondence(blocks, swapped).blocks, blocks);
});
test("quarantines the connected group when a text conflict has no complete bijection", () => {
  const incomplete = new Map(exact);
  incomplete.delete("Gen.32.26");
  const result = refineExactCorrespondence(
    blocks,
    incomplete,
    new Set(["Gen.32.27"])
  );
  assert.equal(result.repairs.length, 0);
  assert(
    result.blocks.every((b) =>
      b.reason?.includes("unresolved-exact-text-witness-correspondence")
    )
  );
  assert.deepEqual(
    result.blocks.flatMap((b) => b.canonicalRefs),
    blocks.flatMap((b) => b.canonicalRefs)
  );
});
