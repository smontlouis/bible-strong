import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type {
  HebrewEnglishArtifactSummary,
  HebrewEnglishCandidate
} from "../src/lexiconV3/hebrewEnglish.js";
import {
  HEBREW_IDENTITY_CORRECTIONS,
  HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST,
  HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT,
  isHebrewIdentityCorrectionKey,
  proveHebrewIdentityCorrection,
  type ProveHebrewIdentityCorrectionInput
} from "../src/lexiconV3/hebrewIdentityCorrections.js";

test("Hebrew identity registry seals ten corrections and thirteen changed fields", () => {
  assert.equal(HEBREW_IDENTITY_CORRECTIONS.length, 10);
  assert.equal(
    HEBREW_IDENTITY_CORRECTIONS.reduce(
      (count, correction) => count + correction.changedFields.length,
      0
    ),
    13
  );
  assert.equal(
    sha256(stableJson(HEBREW_IDENTITY_CORRECTIONS)),
    HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
  );
  for (const correction of HEBREW_IDENTITY_CORRECTIONS) {
    assert.equal(correction.before.eStrong, correction.after.eStrong);
    assert.equal(correction.before.dStrong, correction.after.dStrong);
    assert.equal(correction.before.uStrong, correction.after.uStrong);
    assert.equal(correction.before.morph, correction.after.morph);
  }
  assert.equal(isHebrewIdentityCorrectionKey("H7156H"), false);
});

test("H2679 publishes the sealed corrected form only with every live proof", () => {
  const input = buildInput("H2679");
  const proof = proveHebrewIdentityCorrection(input);
  assert.ok(proof);
  assert.equal(proof.proven, true);
  assert.deepEqual(proof.issueCodes, []);
  assert.equal(proof.selectedIdentity?.original, "חֲצִי הַמְּנֻחוֹת");
  assert.equal(
    proof.selectedIdentity?.transliteration,
    "cha.tsi ham.me.nu.chot"
  );
});

test("identity or source drift fails closed and publishes no correction", () => {
  const input = buildInput("H4192");
  const identityDrift = proveHebrewIdentityCorrection({
    ...input,
    sourceIdentity: { ...input.sourceIdentity, transliteration: "la.ben" }
  });
  assert.ok(identityDrift);
  assert.equal(identityDrift.proven, false);
  assert.equal(identityDrift.selectedIdentity, null);
  assert.ok(
    identityDrift.issueCodes.includes(
      "hebrew-identity-correction-sourceIdentityExact-invalid"
    )
  );

  const sourceDrift = proveHebrewIdentityCorrection({
    ...input,
    tbeshSourceDigest: "0".repeat(64)
  });
  assert.ok(sourceDrift);
  assert.equal(sourceDrift.proven, false);
  assert.equal(sourceDrift.selectedIdentity, null);
  assert.ok(
    sourceDrift.issueCodes.includes(
      "hebrew-identity-correction-sourcePinsValid-invalid"
    )
  );
});

function buildInput(key: string): ProveHebrewIdentityCorrectionInput {
  const correction = HEBREW_IDENTITY_CORRECTIONS.find(
    (candidate) => candidate.key === key
  );
  assert.ok(correction);
  const pins = HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT.sourcePins;
  return {
    key,
    stepEntryId: correction.stepEntryId,
    sourceIdentity: { ...correction.before },
    auditIdentity: { ...correction.before },
    candidate: {
      identity: {
        stepEntryId: correction.stepEntryId,
        language: "hebrew",
        baseCode: Number.parseInt(correction.key.slice(1), 10),
        ...correction.before
      },
      provenance: [
        {
          source: "STEP-gloss-anchor",
          recordId: String(correction.stepEntryId),
          contentDigest: correction.stepAnchorDigest,
          matchKind: "exact",
          matchedText: correction.before.original
        }
      ]
    } as unknown as HebrewEnglishCandidate,
    databaseDigest: pins.fullDatabase,
    tbeshSourceDigest: pins.tbesh,
    tahotSourceDigests: { ...pins.tahot },
    hebrewEnglishSummary: {
      openScripturesRevision: pins.openScripturesRevision,
      sourceDigests: { ...pins.openScriptures }
    } as unknown as HebrewEnglishArtifactSummary
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortJson(child)])
    );
  }
  return value;
}
