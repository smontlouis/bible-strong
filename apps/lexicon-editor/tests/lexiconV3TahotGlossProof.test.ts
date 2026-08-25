import assert from "node:assert/strict";
import test from "node:test";

import {
  TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO,
  normalizeStrictDStrong,
  proveTahotOccurrenceGlossSupport,
  significantGlossTokens,
  type TahotGlossOccurrenceInput
} from "../src/lexiconV3/tahotGlossProof.js";

test("proves complete exact-token support at the explicit 80 percent boundary", () => {
  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H1G",
    gloss: "the father",
    occurrences: occurrences("H0001G", [
      "[was] a father",
      "father/ their",
      "like/ a father",
      "father",
      "ancestor"
    ])
  });

  assert.equal(TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO, 0.8);
  assert.equal(proof.proven, true);
  assert.deepEqual(proof.reasonCodes, ["tahot-gloss-token-support-proven"]);
  assert.deepEqual(proof.significantTokens, ["father"]);
  assert.equal(proof.facts.requiredSupportingOccurrenceCount, 4);
  assert.deepEqual(proof.facts.tokenSupport, [
    {
      token: "father",
      supportingOccurrenceCount: 4,
      supportRatio: 0.8,
      meetsThreshold: true
    }
  ]);
  assert.match(proof.digests.proof, /^[0-9a-f]{64}$/u);
});

test("requires every significant token to meet the threshold", () => {
  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H81",
    gloss: "aromatic powder",
    occurrences: occurrences("H0081", [
      "aromatic powder",
      "aromatic powder",
      "powder",
      "aromatic powder"
    ])
  });

  assert.equal(proof.proven, false);
  assert.equal(proof.facts.allSignificantTokensCovered, true);
  assert.equal(proof.facts.allSignificantTokensMeetThreshold, false);
  assert.deepEqual(
    proof.facts.tokenSupport.map(({ token, supportingOccurrenceCount }) => ({
      token,
      supportingOccurrenceCount
    })),
    [
      { token: "aromatic", supportingOccurrenceCount: 3 },
      { token: "powder", supportingOccurrenceCount: 4 }
    ]
  );
  assert.ok(
    proof.reasonCodes.includes("tahot-gloss-token-support-below-threshold")
  );
});

test("rejects incomplete token coverage without fuzzy stemming or substring matches", () => {
  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H1G",
    gloss: "father",
    occurrences: occurrences("H0001G", ["fathers", "forefather"])
  });

  assert.equal(proof.proven, false);
  assert.equal(proof.facts.allSignificantTokensCovered, false);
  assert.ok(
    proof.reasonCodes.includes("tahot-gloss-token-coverage-incomplete")
  );
});

test("keeps dStrong suffix and variant case significant", () => {
  assert.equal(normalizeStrictDStrong("H22H"), "H0022H");
  assert.equal(normalizeStrictDStrong("h0022H"), null);
  assert.equal(normalizeStrictDStrong("H22h"), "H0022h");

  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H22H",
    gloss: "Abiel",
    occurrences: occurrences("H0022h", ["Abiel"])
  });
  assert.equal(proof.proven, false);
  assert.ok(
    proof.reasonCodes.includes("tahot-gloss-occurrence-dstrong-mismatch")
  );
});

test("fails closed for mixed, malformed, empty, or duplicated occurrence evidence", () => {
  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H46",
    gloss: "mighty",
    occurrences: [
      { dStrong: "H0046", gloss: "mighty", locator: "1Sam.1.1#01" },
      { dStrong: "invalid", gloss: "mighty", locator: "1Sam.1.1#01" },
      { dStrong: "H0047", gloss: "", locator: "" }
    ]
  });

  assert.equal(proof.proven, false);
  assert.ok(
    proof.reasonCodes.includes("tahot-gloss-occurrence-dstrong-invalid")
  );
  assert.ok(
    proof.reasonCodes.includes("tahot-gloss-occurrence-dstrong-mismatch")
  );
  assert.ok(proof.reasonCodes.includes("tahot-gloss-occurrence-gloss-empty"));
  assert.ok(proof.reasonCodes.includes("tahot-gloss-occurrence-locator-empty"));
  assert.ok(
    proof.reasonCodes.includes("tahot-gloss-occurrence-duplicate-locator")
  );
});

test("fails closed when the candidate or occurrence corpus is empty", () => {
  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H46",
    gloss: "  ",
    occurrences: []
  });

  assert.equal(proof.proven, false);
  assert.ok(proof.reasonCodes.includes("tahot-gloss-candidate-empty"));
  assert.ok(
    proof.reasonCodes.includes(
      "tahot-gloss-candidate-without-significant-token"
    )
  );
  assert.ok(proof.reasonCodes.includes("tahot-gloss-occurrences-missing"));
});

test("rejects a gloss made exclusively of grammatical glue", () => {
  assert.deepEqual(significantGlossTokens("to the and of"), []);
  const proof = proveTahotOccurrenceGlossSupport({
    dStrong: "H1",
    gloss: "to the",
    occurrences: occurrences("H0001", ["to the"])
  });
  assert.equal(proof.proven, false);
  assert.ok(
    proof.reasonCodes.includes(
      "tahot-gloss-candidate-without-significant-token"
    )
  );
});

test("produces order-independent corpus and proof digests", () => {
  const evidence = occurrences("H0046", ["mighty", "a mighty one"]);
  const forward = proveTahotOccurrenceGlossSupport({
    dStrong: "H46",
    gloss: "mighty",
    occurrences: evidence
  });
  const reversed = proveTahotOccurrenceGlossSupport({
    dStrong: "H46",
    gloss: "mighty",
    occurrences: [...evidence].reverse()
  });

  assert.equal(forward.proven, true);
  assert.equal(
    forward.digests.occurrenceCorpus,
    reversed.digests.occurrenceCorpus
  );
  assert.equal(forward.digests.proof, reversed.digests.proof);
});

function occurrences(
  dStrong: string,
  glosses: readonly string[]
): TahotGlossOccurrenceInput[] {
  return glosses.map((gloss, index) => ({
    dStrong,
    gloss,
    locator: `Gen.1.${index + 1}#01`
  }));
}
