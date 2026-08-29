import assert from "node:assert/strict";
import test from "node:test";

import { parseLexiconV3EnglishAuditArgs } from "../scripts/auditLexiconV3English.js";
import { parseFrenchCandidateAuditArgs } from "../scripts/auditLexiconV3FrenchCandidates.js";
import { parseFrenchPretranslationAuditArgs } from "../scripts/auditLexiconV3FrenchPretranslation.js";
import { parseLexiconV3TbeshSectionAuditArgs } from "../scripts/auditLexiconV3TbeshSections.js";
import { parseFrenchCodexAdjudicationBatchArgs } from "../scripts/buildLexiconV3FrenchCodexAdjudicationBatches.js";
import { parseFrenchCodexBatchArgs } from "../scripts/buildLexiconV3FrenchCodexBatches.js";
import { parseFrenchEditorialAssetsArgs } from "../scripts/buildLexiconV3FrenchEditorialAssets.js";
import { parseFrenchInternalConfigurationArgs } from "../scripts/buildLexiconV3FrenchInternalConfiguration.js";
import { parseFrenchInternalWorkArgs } from "../scripts/buildLexiconV3FrenchInternalWork.js";
import { parseFrenchPacketsArgs } from "../scripts/buildLexiconV3FrenchPackets.js";
import { parseFrenchReuseManifestArgs } from "../scripts/buildLexiconV3FrenchReuseManifest.js";
import { parseLexiconV3ProductionBuildArgs } from "../scripts/buildLexiconV3Production.js";
import { parseLexiconV3HebrewEnglishArgs } from "../scripts/buildLexiconV3HebrewEnglish.js";
import { parseLexiconV3ProductionDeployArgs } from "../scripts/deployLexiconV3Production.js";
import { parseLexiconV3HebrewFetchArgs } from "../scripts/fetchLexiconV3HebrewSources.js";
import { parseLexiconV3ReleaseArgs } from "../scripts/releaseLexiconV3.js";
import { parseLexiconV3ReviewArgs } from "../scripts/reviewLexiconV3.js";
import { parseFrenchCodexProposersArgs } from "../scripts/runLexiconV3FrenchCodexPilotProposers.js";
import { parseFrenchCodexProposerBatchArgs } from "../scripts/runLexiconV3FrenchCodexProposerBatch.js";

test("production and release CLIs reject typos, implicit booleans, and extra positionals", () => {
  assert.deepEqual(
    parseLexiconV3ProductionBuildArgs([
      "--release-key",
      "release-1",
      "--profile=core-en",
      "--write",
      "true"
    ]),
    {
      releaseKey: "release-1",
      profile: "core-en",
      write: "true"
    }
  );
  assert.throws(
    () => parseLexiconV3ProductionBuildArgs(["--relese-key", "release-1"]),
    /unknown-option:relese-key/u
  );
  assert.throws(
    () => parseLexiconV3ProductionBuildArgs(["--write"]),
    /missing-value:write/u
  );
  assert.throws(
    () => parseLexiconV3ProductionBuildArgs(["stray"]),
    /unexpected-argument:stray/u
  );

  const deploy = parseLexiconV3ProductionDeployArgs([
    "--release-key",
    "release-1"
  ]);
  assert.equal(deploy.releaseKey, "release-1");
  assert.equal(
    deploy.authoringPath.endsWith("/outputs/lexicon-v3/authoring.sqlite"),
    true
  );
  assert.throws(
    () =>
      parseLexiconV3ProductionDeployArgs([
        "stray",
        "--release-key",
        "release-1"
      ]),
    /unexpected-argument:stray/u
  );
  assert.throws(
    () =>
      parseLexiconV3ProductionDeployArgs([
        "--release-key",
        "release-1",
        "--release-key",
        "release-2"
      ]),
    /duplicate-option:release-key/u
  );
  assert.throws(
    () => parseLexiconV3ProductionDeployArgs(["--release-key="]),
    /missing-value:release-key/u
  );

  assert.deepEqual(
    parseLexiconV3ReleaseArgs([
      "candidate",
      "--release-key",
      "release-1",
      "--profile",
      "core-en"
    ]),
    {
      command: "candidate",
      releaseKey: "release-1",
      profile: "core-en"
    }
  );
  assert.throws(
    () => parseLexiconV3ReleaseArgs(["plan", "unexpected"]),
    /unexpected-argument:unexpected/u
  );
  assert.throws(
    () => parseLexiconV3ReleaseArgs(["plan", "--verbse", "true"]),
    /unknown-option:verbse/u
  );
  assert.throws(
    () => parseLexiconV3ReleaseArgs(["candidate", "--current"]),
    /missing-value:current/u
  );
});

test("French editorial and configuration CLIs reject unknown or missing options", () => {
  const editorial = parseFrenchEditorialAssetsArgs([
    "--output-dir",
    "out",
    "--expected-entries=22717"
  ]);
  assert.equal(editorial.outputDir.endsWith("/out"), true);
  assert.equal(editorial.expectedEntryCount, 22_717);
  assert.throws(
    () => parseFrenchEditorialAssetsArgs(["--outpt-dir", "out"]),
    /unknown-option:outpt-dir/u
  );
  assert.throws(
    () => parseFrenchEditorialAssetsArgs(["positional"]),
    /unexpected-argument:positional/u
  );
  assert.throws(
    () => parseFrenchEditorialAssetsArgs(["--guide"]),
    /missing-value:guide/u
  );

  assert.deepEqual(
    parseFrenchInternalConfigurationArgs([
      "--guide=config.json",
      "--output",
      "configuration.json"
    ]),
    { guide: "config.json", output: "configuration.json" }
  );
  assert.throws(
    () => parseFrenchInternalConfigurationArgs(["--ouput", "x"]),
    /unknown-option:ouput/u
  );
  assert.throws(
    () => parseFrenchInternalConfigurationArgs(["stray"]),
    /unexpected-argument:stray/u
  );
});

test("French packet, reuse, and work CLIs reject ambiguous values", () => {
  const packets = parseFrenchPacketsArgs([
    "--authoring",
    "authoring.sqlite",
    "--offset=12",
    "--limit",
    "25"
  ]);
  assert.equal(packets.offset, 12);
  assert.equal(packets.limit, 25);
  assert.throws(
    () => parseFrenchPacketsArgs(["--authoring"]),
    /french-packets-missing-option-value:authoring/u
  );
  assert.throws(
    () =>
      parseFrenchPacketsArgs([
        "--authoring",
        "first.sqlite",
        "--authoring",
        "second.sqlite"
      ]),
    /french-packets-duplicate-option:authoring/u
  );
  assert.throws(
    () =>
      parseFrenchPacketsArgs([
        "--authoring",
        "authoring.sqlite",
        "--limit=12abc"
      ]),
    /invalid-limit:12abc/u
  );
  assert.throws(
    () =>
      parseFrenchPacketsArgs([
        "--authoring",
        "authoring.sqlite",
        "--offset=1.5"
      ]),
    /invalid-offset:1\.5/u
  );

  assert.throws(
    () => parseFrenchReuseManifestArgs(["--release-key="]),
    /french-reuse-missing-argument-value:release-key/u
  );
  assert.throws(
    () =>
      parseFrenchReuseManifestArgs([
        "--authoring",
        "first.sqlite",
        "--authoring",
        "second.sqlite"
      ]),
    /french-reuse-duplicate-option:authoring/u
  );

  assert.throws(
    () => parseFrenchInternalWorkArgs(["--packets="]),
    /french-internal-work-missing-option-value:packets/u
  );
  assert.throws(
    () =>
      parseFrenchInternalWorkArgs([
        "--summary",
        "first.json",
        "--summary",
        "second.json"
      ]),
    /french-internal-work-duplicate-option:summary/u
  );
});

test("audit and source CLIs reject typos, duplicate options, and partial numbers", () => {
  assert.equal(parseLexiconV3EnglishAuditArgs(["--limit", "25"]).limit, 25);
  assert.throws(
    () => parseLexiconV3EnglishAuditArgs(["stray"]),
    /unexpected-argument:stray/u
  );
  assert.throws(
    () => parseLexiconV3EnglishAuditArgs(["--limt", "25"]),
    /unknown-option:limt/u
  );
  assert.throws(
    () => parseLexiconV3EnglishAuditArgs(["--limit=12abc"]),
    /invalid-limit:12abc/u
  );
  assert.throws(
    () =>
      parseLexiconV3EnglishAuditArgs([
        "--output",
        "first.jsonl",
        "--output",
        "second.jsonl"
      ]),
    /duplicate-option:output/u
  );

  assert.throws(
    () => parseFrenchCandidateAuditArgs(["--expected-entries", "22717x"]),
    /french-candidate-invalid-expected-entries/u
  );
  assert.throws(
    () =>
      parseFrenchCandidateAuditArgs([
        "--summary",
        "first.json",
        "--summary",
        "second.json"
      ]),
    /french-candidate-duplicate-option:summary/u
  );
  assert.throws(
    () => parseFrenchPretranslationAuditArgs(["--fail-on="]),
    /french-pretranslation-missing-value:fail-on/u
  );
  assert.throws(
    () =>
      parseFrenchPretranslationAuditArgs([
        "--output",
        "first.jsonl",
        "--output",
        "second.jsonl"
      ]),
    /french-pretranslation-duplicate-option:output/u
  );
  assert.throws(
    () => parseLexiconV3TbeshSectionAuditArgs(["--generated-at="]),
    /missing-option-value:generated-at/u
  );
  assert.throws(
    () =>
      parseLexiconV3TbeshSectionAuditArgs([
        "--source",
        "first.sqlite",
        "--source",
        "second.sqlite"
      ]),
    /duplicate-option:source/u
  );
  assert.throws(
    () => parseLexiconV3HebrewFetchArgs(["--timeout-ms", "1200ms"]),
    /invalid-timeout-ms:1200ms/u
  );
  assert.throws(
    () => parseLexiconV3HebrewFetchArgs(["--unknown", "value"]),
    /unknown-option:unknown/u
  );
  assert.throws(
    () => parseLexiconV3HebrewEnglishArgs(["--revision", "moving-head"]),
    /hebrew-source-pinning-cannot-be-disabled/u
  );
  assert.throws(
    () => parseLexiconV3HebrewEnglishArgs(["--outpt", "artifact.jsonl"]),
    /unknown-option:outpt/u
  );
  assert.throws(
    () =>
      parseLexiconV3HebrewEnglishArgs([
        "--output",
        "first.jsonl",
        "--output",
        "second.jsonl"
      ]),
    /duplicate-option:output/u
  );

  assert.deepEqual(
    parseLexiconV3ReviewArgs([
      "export",
      "--limit",
      "1000000",
      "--include-info-issues=false"
    ]),
    {
      _command: "export",
      limit: "1000000",
      includeInfoIssues: "false"
    }
  );
  assert.throws(
    () => parseLexiconV3ReviewArgs(["export", "unexpected"]),
    /unexpected-argument:unexpected/u
  );
  assert.throws(
    () => parseLexiconV3ReviewArgs(["export", "--limit", "12items"]),
    /invalid-limit:12items/u
  );
  assert.throws(
    () => parseLexiconV3ReviewArgs(["export", "--include-auto-glosses", "yes"]),
    /invalid-boolean:includeAutoGlosses:yes/u
  );
  assert.throws(
    () => parseLexiconV3ReviewArgs(["apply", "--output", "queue.json"]),
    /option-not-valid-for-command:apply:output/u
  );
});

test("internal Codex CLIs reject duplicate flags and partial numeric values", () => {
  assert.throws(
    () =>
      parseFrenchCodexBatchArgs([
        "--expected-entries",
        "300",
        "--replace-existing",
        "--replace-existing"
      ]),
    /duplicate-option:replace-existing/u
  );
  assert.throws(
    () => parseFrenchCodexBatchArgs(["--expected-entries", "300items"]),
    /invalid-positive-integer:expected-entries:300items/u
  );
  assert.throws(
    () =>
      parseFrenchCodexProposersArgs(["--aggregate-only", "--aggregate-only"]),
    /duplicate-option:aggregate-only/u
  );
  assert.throws(
    () => parseFrenchCodexProposersArgs(["--timeout-ms", "1200ms"]),
    /invalid-positive-integer:timeout-ms:1200ms/u
  );
  assert.throws(
    () =>
      parseFrenchCodexProposerBatchArgs([
        "--role",
        "proposerA",
        "--force",
        "--force"
      ]),
    /duplicate-option:force/u
  );
  assert.throws(
    () =>
      parseFrenchCodexProposerBatchArgs([
        "--role",
        "proposerA",
        "--expected-entries",
        "300.5"
      ]),
    /invalid-positive-integer:expected-entries:300\.5/u
  );

  assert.throws(
    () =>
      parseFrenchCodexAdjudicationBatchArgs([
        "--role",
        "arbiter",
        "--max-items",
        "8items"
      ]),
    /invalid-positive-integer:max-items:8items/u
  );
});
