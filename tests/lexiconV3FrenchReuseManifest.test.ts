import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";

import { parseFrenchReuseManifestArgs } from "../scripts/buildLexiconV3FrenchReuseManifest.js";
import {
  assertFrenchReuseManifest,
  buildFrenchReuseManifest,
  canonicalFrenchReuseJson,
  classifyFrenchReuseMeaning,
  FRENCH_REUSE_HISTORICAL_EN_1_BASELINE,
  FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
  FRENCH_REUSE_POLICY_VERSION,
  FRENCH_REUSE_RECORD_SCHEMA_VERSION,
  type FrenchReuseManifestBuild,
  type FrenchReusePublicationActionProof,
  type FrenchReuseRecord,
  type FrenchReuseSourceAssertionProof
} from "../src/lexiconV3/frenchReuseManifest.js";

const AUTHORING_DATABASE = "outputs/lexicon-v3/staging/reviewed-english.sqlite";
const LEGACY_FULL_DATABASE =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const FIXED_GENERATED_AT = "2026-07-13T00:00:00.000Z";

test("refuses the historical authoring snapshot until its core-en release is promoted", async () => {
  assert.equal(
    FRENCH_REUSE_HISTORICAL_EN_1_BASELINE.releaseKey,
    "lexicon-v3-en-2026-07-13.1"
  );
  await assert.rejects(
    buildFrenchReuseManifest({
      authoringDatabase: AUTHORING_DATABASE,
      legacyFullDatabase: LEGACY_FULL_DATABASE,
      releaseKey: FRENCH_REUSE_HISTORICAL_EN_1_BASELINE.releaseKey,
      generatedAt: FIXED_GENERATED_AT
    }),
    /french-reuse-release-missing:lexicon-v3-en-2026-07-13\.1/u
  );
});

test("classifies byte-identical meanings before considering a publication action", () => {
  const html = "<p>Identical.</p>";
  const result = classifyFrenchReuseMeaning({
    stepEntryId: 42,
    currentHtml: html,
    previousHtml: html,
    publicationProofs: [
      {
        action: "step_specific_only",
        rawHtmlDigest: sha256(html),
        stepSpecificDigest: sha256(html)
      }
    ],
    assertions: []
  });

  assert.equal(result.cohort, "unchanged");
  assert.deepEqual(result.proof, {
    kind: "byte_identity",
    currentHtmlDigest: sha256(html),
    previousHtmlDigest: sha256(html)
  });
});

test("accepts an exactly proven STEP-specific prefix for both separator encodings", () => {
  for (const separator of ["§", "&sect;"] as const) {
    const proof = makeStepSpecificProof(separator);
    const result = classifyFrenchReuseMeaning(proof.input);

    assert.equal(result.cohort, "step_specific_only");
    assert.equal(result.publicationAction, "step_specific_only");
    assert.deepEqual(result.proof, {
      kind: "tbesh_step_specific",
      publicationAction: "step_specific_only",
      separatorCount: 1,
      rawHtmlDigest: sha256(proof.previousHtml),
      extractedSpecificHash: sha256(proof.currentHtml),
      rawAssertionHash: "a".repeat(64),
      specificAssertionHash: "b".repeat(64)
    });
  }
});

test("routes an unproven changed meaning to the other-changed cohort", () => {
  const result = classifyFrenchReuseMeaning({
    stepEntryId: 42,
    currentHtml: "<p>Current.</p>",
    previousHtml: "<p>Previous.</p>",
    publicationProofs: [],
    assertions: []
  });

  assert.equal(result.cohort, "other_changed");
  assert.equal(result.proof.kind, "changed_selection");
  assert.equal(result.publicationAction, null);
});

test("fails closed when a STEP-specific proof is incomplete or inconsistent", () => {
  const proof = makeStepSpecificProof("§");

  assert.throws(
    () =>
      classifyFrenchReuseMeaning({
        ...proof.input,
        currentHtml: "<p>Different prefix.</p>"
      }),
    /french-reuse-step-specific-content-mismatch/
  );
  assert.throws(
    () =>
      classifyFrenchReuseMeaning({
        ...proof.input,
        assertions: proof.input.assertions.slice(0, 1)
      }),
    /french-reuse-step-specific-support-count:0/
  );
  assert.throws(
    () =>
      classifyFrenchReuseMeaning({
        ...proof.input,
        previousHtml: `${proof.previousHtml} § <p>Third section.</p>`
      }),
    /french-reuse-step-specific-source-structure-invalid/
  );
  assert.throws(
    () =>
      classifyFrenchReuseMeaning({
        ...proof.input,
        publicationProofs: [
          ...proof.input.publicationProofs,
          {
            action: "legacy_general_only",
            rawHtmlDigest: null,
            stepSpecificDigest: null
          }
        ]
      }),
    /french-reuse-publication-action-ambiguous/
  );
});

test("detects record and parent tampering", () => {
  const original = syntheticReuseBuild();

  const digestTamper = structuredClone(original);
  digestTamper.records[0]!.priorFrench.glossHash = "0".repeat(64);
  assert.throws(
    () => assertFrenchReuseManifest(digestTamper, null),
    /french-reuse-record-digest-invalid/
  );

  const parentTamper = structuredClone(original);
  const record = parentTamper.records[0]!;
  record.parents.gloss.valueTextHash = "invalid";
  record.recordDigest = digestRecord(record);
  assert.throws(
    () => assertFrenchReuseManifest(parentTamper, null),
    /french-reuse-parent-invalid/
  );
});

test("canonical JSON is independent of object key insertion order", () => {
  assert.equal(
    canonicalFrenchReuseJson({ z: 1, nested: { b: 2, a: 1 }, a: 2 }),
    canonicalFrenchReuseJson({ a: 2, nested: { a: 1, b: 2 }, z: 1 })
  );
});

test("parses explicit CLI paths and rejects missing option values", () => {
  const options = parseFrenchReuseManifestArgs([
    "--authoring=tmp/authoring.sqlite",
    "--legacy-full",
    "tmp/legacy.sqlite",
    "--release-key",
    "release-test",
    "--records",
    "tmp/records.jsonl",
    "--summary=tmp/summary.json",
    "--generated-at",
    FIXED_GENERATED_AT
  ]);

  assert.deepEqual(options, {
    authoringDatabase: resolve("tmp/authoring.sqlite"),
    legacyFullDatabase: resolve("tmp/legacy.sqlite"),
    releaseKey: "release-test",
    recordsOutput: resolve("tmp/records.jsonl"),
    summaryOutput: resolve("tmp/summary.json"),
    generatedAt: FIXED_GENERATED_AT
  });
  assert.throws(
    () => parseFrenchReuseManifestArgs(["--records"]),
    /french-reuse-missing-argument-value:records/
  );
  assert.throws(
    () => parseFrenchReuseManifestArgs(["--current-baseline", "true"]),
    /french-reuse-unknown-option:current-baseline/
  );
});

function makeStepSpecificProof(separator: "§" | "&sect;"): {
  currentHtml: string;
  previousHtml: string;
  input: Parameters<typeof classifyFrenchReuseMeaning>[0];
} {
  const stepEntryId = 42;
  const currentHtml = "<p>STEP-specific meaning.</p>";
  const previousHtml = `${currentHtml}<br>${separator}<br><p>Legacy family meaning.</p>`;
  const publicationProofs: FrenchReusePublicationActionProof[] = [
    {
      action: "step_specific_only",
      rawHtmlDigest: sha256(previousHtml),
      stepSpecificDigest: sha256(currentHtml)
    }
  ];
  const assertions: FrenchReuseSourceAssertionProof[] = [
    {
      sourceKey: "step-tbesh-meaning",
      locator: `StepEntries:${stepEntryId}:meaning`,
      assertionHash: "a".repeat(64),
      stance: "context",
      valueHtml: previousHtml
    },
    {
      sourceKey: "step-tbesh-meaning",
      locator: `StepEntries:${stepEntryId}:meaning:step-specific`,
      assertionHash: "b".repeat(64),
      stance: "supports",
      valueHtml: currentHtml
    }
  ];
  return {
    currentHtml,
    previousHtml,
    input: {
      stepEntryId,
      currentHtml,
      previousHtml,
      publicationProofs,
      assertions
    }
  };
}

function syntheticReuseBuild(): FrenchReuseManifestBuild {
  const identity = {
    language: "greek" as const,
    eStrong: "G0001",
    primaryDStrong: "G0001",
    dStrong: "G0001",
    uStrong: "G0001",
    original: "ἄλφα",
    transliteration: "alpha",
    morph: "N"
  };
  const parent = (field: "gloss" | "meaning", fieldVersionId: number) => ({
    releaseKey: "lexicon-v3-en-fixture.1",
    releaseSnapshotFingerprint: "1".repeat(64),
    entryKey: "greek:G0001",
    field,
    fieldVersionId,
    contentHash: String(fieldVersionId).repeat(64),
    valueTextHash: "3".repeat(64),
    valueHtmlHash: field === "meaning" ? "4".repeat(64) : null,
    state: "auto_validated" as const,
    method: "source",
    generator: "fixture"
  });
  const content: Omit<FrenchReuseRecord, "recordDigest"> = {
    schemaVersion: FRENCH_REUSE_RECORD_SCHEMA_VERSION,
    entryKey: "greek:G0001",
    stepEntryId: 1,
    identity,
    identityHash: sha256(canonicalFrenchReuseJson(identity)),
    parents: { gloss: parent("gloss", 1), meaning: parent("meaning", 2) },
    priorEnglish: {
      glossHash: "5".repeat(64),
      meaningHtmlHash: "6".repeat(64)
    },
    priorFrench: {
      glossHash: "7".repeat(64),
      meaningTextHash: "8".repeat(64),
      meaningHtmlHash: "9".repeat(64),
      specificTextHash: null,
      specificHtmlHash: null,
      specificVisibleTextHtmlMatch: null
    },
    meaningCohort: "unchanged",
    cohortProof: {
      kind: "byte_identity",
      currentHtmlDigest: "6".repeat(64),
      previousHtmlDigest: "6".repeat(64)
    },
    publicationAction: null,
    glossReviewSeed: false,
    meaningReviewSeed: false,
    glossRiskFlags: [],
    highRiskFlags: []
  };
  const record: FrenchReuseRecord = {
    ...content,
    recordDigest: sha256(canonicalFrenchReuseJson(content))
  };
  return {
    records: [record],
    summary: {
      schemaVersion: FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
      policyVersion: FRENCH_REUSE_POLICY_VERSION,
      englishRelease: {
        releaseKey: "lexicon-v3-en-fixture.1",
        snapshotFingerprint: "1".repeat(64)
      }
    } as FrenchReuseManifestBuild["summary"]
  };
}

function digestRecord(
  record: FrenchReuseManifestBuild["records"][number]
): string {
  const { recordDigest, ...content } = record;
  void recordDigest;
  return sha256(canonicalFrenchReuseJson(content));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

assert.equal(FRENCH_REUSE_HISTORICAL_EN_1_BASELINE.expectedEntryCount, 22_717);
