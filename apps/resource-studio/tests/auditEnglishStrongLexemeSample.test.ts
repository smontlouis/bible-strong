import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  selectIdentitySample,
  type IdentityCandidate
} from "../src/auditEnglishStrongLexemeSample.js";

function candidates(): IdentityCandidate[] {
  const values: IdentityCandidate[] = [];
  for (let index = 1; index <= 180; index += 1) {
    const code = `${index <= 90 ? "H" : "G"}${String(index).padStart(4, "0")}`;
    const kind = (index % 3) as 0 | 1 | 2;
    values.push({
      key: `${kind}:${code.replace(/^([GH])0+(?=\d)/u, "$1")}`,
      kind,
      code: code.replace(/^([GH])0+(?=\d)/u, "$1"),
      occurrencesByBible: { KJV: index + 10, ASV: index + 20 },
      correctionCount: index % 17
    });
  }
  values.push(
    ...[
      [2, "H430G"],
      [0, "H3068"],
      [0, "H1732"],
      [0, "H4872"],
      [0, "G5547"]
    ].map(([kind, code], index) => ({
      key: `${kind}:${code}`,
      kind: kind as 0 | 1 | 2,
      code: String(code),
      occurrencesByBible: { KJV: 100 + index, ASV: 90 + index },
      correctionCount: 20 + index
    }))
  );
  return values;
}

describe("selectIdentitySample", () => {
  test("returns a stable, unique 100-identity stratified sample", () => {
    const first = selectIdentitySample(candidates(), 100, "fixed-seed");
    const second = selectIdentitySample(
      candidates().reverse(),
      100,
      "fixed-seed"
    );

    assert.equal(first.length, 100);
    assert.equal(new Set(first.map(({ key }) => key)).size, 100);
    assert.deepEqual(second, first);
    assert.equal(
      first.filter(({ selectionStratum }) => selectionStratum === "canary")
        .length,
      5
    );
    assert.equal(
      first.some(({ code }) => code === "H430G"),
      true
    );
  });
});
