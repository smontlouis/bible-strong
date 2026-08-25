import assert from "node:assert/strict";
import test from "node:test";

import { parseFrenchInternalAssemblyArgs } from "../scripts/assembleLexiconV3FrenchInternalReview.js";
import { parseBuildLexiconV3FrenchRemediationArgs } from "../scripts/buildLexiconV3FrenchRemediation.js";
import { parseFrenchCodexAdjudicationBatchArgs } from "../scripts/buildLexiconV3FrenchCodexAdjudicationBatches.js";
import { parseFrenchEntityMentionsArgs } from "../scripts/buildLexiconV3FrenchEntityMentions.js";
import { parseBuildLexiconV3AuthoringArgs } from "../scripts/buildLexiconV3Authoring.js";
import { parseFrenchEntityGateArgs } from "../scripts/gateLexiconV3FrenchEntities.js";
import { parseFrenchEntityAgentMergeArgs } from "../scripts/mergeLexiconV3FrenchEntityAgentResults.js";
import { parseFinalizeLexiconV3FrenchProposerDraftsArgs } from "../scripts/finalizeLexiconV3FrenchProposerDrafts.js";
import { parseMergeLexiconV3FrenchInternalReviewsArgs } from "../scripts/mergeLexiconV3FrenchInternalReviews.js";
import { parseFrenchCodexAdjudicationArgs } from "../scripts/runLexiconV3FrenchCodexPilotAdjudication.js";
import { parseRunLexiconV3FrenchInternalRemediationArgs } from "../scripts/runLexiconV3FrenchInternalRemediation.js";
import { FRENCH_CODEX_IMMUTABLE_BINARY_PATH } from "../src/lexiconV3/frenchCodexImmutableBinary.js";

test("French publication CLIs reject unknown, duplicate, positional and missing options", () => {
  assert.throws(
    () => parseFrenchInternalAssemblyArgs(["--execution-receipts"]),
    /missing-value:execution-receipts/u
  );
  assert.throws(
    () =>
      parseFrenchCodexAdjudicationArgs([
        "--phase",
        "arbiter",
        "--phase",
        "auditor"
      ]),
    /duplicate-option:phase/u
  );
  assert.throws(
    () => parseFrenchCodexAdjudicationBatchArgs(["--not-a-real-option", "x"]),
    /unknown-option:not-a-real-option/u
  );
  assert.throws(
    () => parseBuildLexiconV3AuthoringArgs(["--french-reveiw", "x"]),
    /unknown-option:french-reveiw/u
  );
  assert.throws(
    () =>
      parseBuildLexiconV3AuthoringArgs([
        "--french-remediation-summary",
        "run-summary.json"
      ]),
    /french-remediation-summary-requires-review/u
  );
  assert.equal(
    parseBuildLexiconV3AuthoringArgs([
      "--french-review",
      "reviews.jsonl",
      "--french-remediation-summary",
      "run-summary.json"
    ]).frenchRemediationSummary,
    "run-summary.json"
  );
  assert.throws(
    () =>
      parseBuildLexiconV3FrenchRemediationArgs([
        "--round",
        "1",
        "--round",
        "2"
      ]),
    /duplicate-option:round/u
  );
  assert.throws(
    () =>
      parseFinalizeLexiconV3FrenchProposerDraftsArgs([
        "--role",
        "proposerA",
        "--role",
        "proposerB"
      ]),
    /duplicate-option:role/u
  );
  assert.throws(
    () => parseMergeLexiconV3FrenchInternalReviewsArgs(["positional"]),
    /unexpected-argument:positional/u
  );
  assert.throws(
    () =>
      parseRunLexiconV3FrenchInternalRemediationArgs([
        "--gateway-url",
        "https://forbidden.invalid"
      ]),
    /unknown-option:gateway-url/u
  );
  assert.equal(
    parseFrenchEntityMentionsArgs([
      "--packets",
      "packets.jsonl",
      "--generated-at=2026-07-14T00:00:00.000Z"
    ]).packets.endsWith("/packets.jsonl"),
    true
  );
  assert.throws(
    () => parseFrenchEntityMentionsArgs(["--entity-mentons", "x"]),
    /french-entity-mentions-unknown-option:entity-mentons/u
  );
  assert.throws(
    () => parseFrenchEntityMentionsArgs(["--output", "x", "--output", "y"]),
    /french-entity-mentions-duplicate-option:output/u
  );
  assert.throws(
    () => parseFrenchEntityMentionsArgs(["--generated-at", "not-a-date"]),
    /french-entity-mentions-invalid-generated-at:not-a-date/u
  );
});

test("French remediation seals a safe batch byte limit and immutable Codex default", () => {
  const defaults = parseRunLexiconV3FrenchInternalRemediationArgs([]);
  assert.equal(defaults.maxCombinedBytes, 400_000);
  assert.equal(defaults.codexBinary, FRENCH_CODEX_IMMUTABLE_BINARY_PATH);
  assert.equal(
    defaults.entityPacketsPath.endsWith(
      "/outputs/lexicon-v3/fr-internal/french-packets.jsonl"
    ),
    true
  );
  const pilot = parseRunLexiconV3FrenchInternalRemediationArgs([
    "--packets",
    "pilot/selected-packets.jsonl",
    "--entity-packets",
    "full/french-packets.jsonl"
  ]);
  assert.equal(
    pilot.packetsPath.endsWith("/pilot/selected-packets.jsonl"),
    true
  );
  assert.equal(
    pilot.entityPacketsPath.endsWith("/full/french-packets.jsonl"),
    true
  );
  assert.notEqual(pilot.packetsPath, pilot.entityPacketsPath);
  assert.throws(
    () =>
      parseRunLexiconV3FrenchInternalRemediationArgs([
        "--entity-packets",
        "one.jsonl",
        "--entity-packets",
        "two.jsonl"
      ]),
    /duplicate-option:entity-packets/u
  );
  assert.equal(
    parseRunLexiconV3FrenchInternalRemediationArgs([
      "--max-combined-bytes",
      "400000"
    ]).maxCombinedBytes,
    400_000
  );

  assert.throws(
    () =>
      parseRunLexiconV3FrenchInternalRemediationArgs([
        "--max-combined-bytes",
        "400001"
      ]),
    /invalid-bounded-positive-safe-integer:max-combined-bytes:400001:max=400000/u
  );
  assert.equal(
    parseRunLexiconV3FrenchInternalRemediationArgs([
      "--max-combined-bytes",
      "399999"
    ]).maxCombinedBytes,
    399_999
  );
  assert.throws(
    () =>
      parseRunLexiconV3FrenchInternalRemediationArgs([
        "--max-combined-bytes",
        "0"
      ]),
    /invalid-positive-safe-integer:max-combined-bytes:0/u
  );
  assert.throws(
    () =>
      parseRunLexiconV3FrenchInternalRemediationArgs([
        "--max-combined-bytes",
        "9007199254740992"
      ]),
    /invalid-positive-safe-integer:max-combined-bytes/u
  );
  for (const invalid of ["-1", "400000.5", "NaN", "1e5"]) {
    assert.throws(
      () =>
        parseRunLexiconV3FrenchInternalRemediationArgs([
          "--max-combined-bytes",
          invalid
        ]),
      /invalid-positive-safe-integer:max-combined-bytes/u
    );
  }
});

test("keeps resolved entity outputs under french-entities/resolved by default", () => {
  const mentions = parseFrenchEntityMentionsArgs([]);
  const gate = parseFrenchEntityGateArgs(["--release-key", "release"]);
  const merge = parseFrenchEntityAgentMergeArgs(["--release-key", "release"]);
  const remediation = parseRunLexiconV3FrenchInternalRemediationArgs([]);
  const authoring = parseBuildLexiconV3AuthoringArgs([
    "--french-review",
    "review.jsonl"
  ]);
  const resolvedSuffix = "outputs/lexicon-v3/french-entities/resolved/";
  for (const path of [
    mentions.entityMergeAttestation,
    mentions.canonicalEntities,
    mentions.canonicalEntryPolicies,
    mentions.entityGate,
    mentions.output,
    mentions.summary,
    gate.attestation,
    gate.canonicalEntities,
    gate.entryPolicies,
    remediation.entityMergeAttestationPath,
    remediation.canonicalEntitiesPath,
    remediation.canonicalEntryPoliciesPath,
    remediation.entityGatePath,
    remediation.entityMentionsPath,
    authoring.frenchEntityMergeAttestation!,
    authoring.frenchCanonicalEntities!,
    authoring.frenchCanonicalEntryPolicies!,
    authoring.frenchEntityGate!,
    authoring.frenchEntityMentions!
  ]) {
    assert.equal(path.includes(resolvedSuffix), true, path);
  }
  assert.match(
    merge.outputDir,
    new RegExp(`/${resolvedSuffix.slice(0, -1)}$`, "u")
  );
  assert.doesNotMatch(mentions.plan, /\/resolved\//u);
  assert.doesNotMatch(mentions.manifest, /\/resolved\//u);
  assert.doesNotMatch(mentions.resultsDir, /\/resolved\//u);
});
