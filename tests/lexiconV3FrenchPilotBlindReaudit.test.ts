import assert from "node:assert/strict";
import test from "node:test";

import {
  FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
  buildFrenchPilotBlindReauditSelection,
  type FrenchPilotBlindReauditPopulationItem
} from "../src/lexiconV3/frenchPilotBlindReaudit.js";

test("selects exactly 60 deterministic pilot entries while covering every stratum", () => {
  const population = populationFixture();
  const first = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "1".repeat(64),
    finalReviewLogicalDigest: "2".repeat(64),
    population
  });
  const second = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "1".repeat(64),
    finalReviewLogicalDigest: "2".repeat(64),
    population: [...population].reverse()
  });

  assert.equal(first.items.length, FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE);
  assert.equal(
    new Set(first.keys).size,
    FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE
  );
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first.strataCounts.language).sort(), [
    "greek",
    "hebrew"
  ]);
  assert.deepEqual(Object.keys(first.strataCounts.meaningSize).sort(), [
    "long",
    "medium",
    "short",
    "very_long"
  ]);
  assert.deepEqual(Object.keys(first.strataCounts.properName).sort(), [
    "false",
    "true"
  ]);
  assert.deepEqual(Object.keys(first.strataCounts.theological).sort(), [
    "false",
    "true"
  ]);
  assert.ok(first.strataCounts.riskCategory?.rare);
});

test("changes the sealed sample when the final-review digest changes", () => {
  const population = populationFixture();
  const first = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "1".repeat(64),
    finalReviewLogicalDigest: "2".repeat(64),
    population
  });
  const changed = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "1".repeat(64),
    finalReviewLogicalDigest: "3".repeat(64),
    population
  });
  assert.notEqual(first.selectionHash, changed.selectionHash);
  assert.notDeepEqual(first.keys, changed.keys);
});

function populationFixture(): FrenchPilotBlindReauditPopulationItem[] {
  const positions = [
    "proper-name",
    "verb",
    "noun",
    "adjective",
    "adverb",
    "number",
    "particle",
    "function-word",
    "unknown"
  ] as const;
  const cohorts = ["unchanged", "step_specific_only", "other_changed"] as const;
  const html = [
    "absent",
    "normalized_equivalent",
    "normalized_divergent"
  ] as const;
  const sizes = ["short", "medium", "long", "very_long"] as const;
  return Array.from({ length: 300 }, (_, index) => ({
    entryKey: `entry-${String(index).padStart(3, "0")}`,
    packetHash: hash(index, "packet"),
    englishHash: hash(index, "english"),
    finalReviewArtifactHash: hash(index, "review"),
    strata: {
      language: index % 2 === 0 ? "greek" : "hebrew",
      meaningCohort: cohorts[index % cohorts.length]!,
      pos: positions[index % positions.length]!,
      properName: index % 11 === 0,
      theological: index % 17 === 0,
      legacyHtmlCategory: html[index % html.length]!,
      meaningSize: sizes[index % sizes.length]!,
      riskCategories:
        index === 299 ? ["rare"] : index % 5 === 0 ? ["common"] : []
    }
  }));
}

function hash(index: number, label: string): string {
  const seed = `${label}-${index}`;
  return Buffer.from(seed.padEnd(64, "0")).toString("hex").slice(0, 64);
}
