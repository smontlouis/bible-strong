import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_PATH,
  PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
  verifyPinnedG20354PerseusArtifact
} from "../src/lexiconV3/perseusLsjG20354.js";

test("verifies the pinned independent LSJ witness for G20354", () => {
  const bytes = readFileSync(PINNED_G20354_PERSEUS_ARTIFACT_PATH);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST
  );
  const verification = verifyPinnedG20354PerseusArtifact(
    JSON.parse(bytes.toString("utf8"))
  );
  assert.equal(verification.valid, true);
  assert.deepEqual(verification.reasonCodes, [
    "g20354-perseus-artifact-verified"
  ]);
  assert.equal(
    verification.payloadDigest,
    PINNED_G20354_PERSEUS_PAYLOAD_DIGEST
  );
});

test("fails the G20354 LSJ witness closed on source or payload drift", () => {
  const original = JSON.parse(
    readFileSync(PINNED_G20354_PERSEUS_ARTIFACT_PATH, "utf8")
  ) as Record<string, unknown>;
  const payloadDrift = structuredClone(original) as Record<string, unknown> & {
    payload: { shortDef: string };
  };
  payloadDrift.payload.shortDef = "to sodomize";
  const payloadVerification = verifyPinnedG20354PerseusArtifact(payloadDrift);
  assert.equal(payloadVerification.valid, false);
  assert.ok(
    payloadVerification.reasonCodes.includes(
      "g20354-perseus-artifact-payload-malformed"
    )
  );

  const sourceDrift = structuredClone(original) as Record<string, unknown> & {
    source: { commit: string };
  };
  sourceDrift.source.commit = "0".repeat(40);
  const sourceVerification = verifyPinnedG20354PerseusArtifact(sourceDrift);
  assert.equal(sourceVerification.valid, false);
  assert.ok(
    sourceVerification.reasonCodes.includes(
      "g20354-perseus-artifact-source-mismatch"
    )
  );
});
