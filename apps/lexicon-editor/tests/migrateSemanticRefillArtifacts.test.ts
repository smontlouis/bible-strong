import assert from "node:assert/strict";
import test from "node:test";

import type { BibleVerse } from "../src/bibleJson.js";
import type { CuratedStrongOverride } from "../src/curatedStrongOverrides.js";
import {
  artifactOutcomeCanProveProduction,
  migrateOverrides,
  overridePlacementKey,
  revertArtifactMigrations,
  upgradeLegacyDecisionChoices,
  type MigrationProof
} from "../src/migrateSemanticRefillArtifacts.js";

function override(
  partial: Partial<CuratedStrongOverride> = {}
): CuratedStrongOverride {
  return {
    bible: "nbs",
    ref: "Gen.1.1",
    target: "word",
    wordIndex: 1,
    normalized: "commencement",
    strong: ["H7225"],
    confidence: 0.91,
    source: "semantic-refill:llm",
    reason: "legacy free-form consensus claim",
    ...partial
  };
}

test("artifact migration promotes only current witness-backed non-relocations", () => {
  const promotable = override();
  const noProof = override({ strong: ["H0002"] });
  const relocation = override({
    strong: ["H0003"],
    replace: { target: "word", wordIndex: 0 }
  });
  const drifted = override({ strong: ["H0004"], normalized: "ancien" });
  const proof = (family: string): MigrationProof => ({
    exactWitnessFamilies: new Set([family]),
    sourceReviews: new Set(["review.json"]),
    currentDirectDeterministicSupport: false
  });
  const proofs = new Map([
    [overridePlacementKey(promotable), proof("Sg1910")],
    [overridePlacementKey(relocation), proof("Sg1910")],
    [overridePlacementKey(drifted), proof("Darby-family")]
  ]);
  const versesByRef = new Map<string, BibleVerse>([
    [
      "Gen.1.1",
      {
        bookNumber: "01",
        bookId: "Gen",
        chapter: 1,
        verse: 1,
        text: "Au commencement"
      }
    ]
  ]);

  const result = migrateOverrides({
    bible: "nbs",
    overrides: [promotable, noProof, relocation, drifted],
    proofs,
    versesByRef
  });

  assert.equal(
    result.overrides[0]?.source,
    "semantic-refill:llm-consensus-filtered"
  );
  assert.match(
    result.overrides[0]?.reason ?? "",
    /exact-witness-families:Sg1910/u
  );
  assert.equal(result.overrides[1]?.source, "semantic-refill:llm");
  assert.equal(result.overrides[2]?.source, "semantic-refill:llm");
  assert.equal(result.overrides[3]?.source, "semantic-refill:llm");
  assert.deepEqual(result.counts, {
    legacyUnfilteredOverrides: 4,
    promotedOverrides: 1,
    skippedInvalidTarget: 1,
    skippedRelocation: 1,
    skippedCarrierConflict: 0,
    legacyWithoutCurrentWitnessProof: 1
  });
});

test("artifact migration keeps overlapping carriers quarantined", () => {
  const first = override({ strong: ["H0001"] });
  const second = override({ strong: ["H0002"] });
  const proof = (): MigrationProof => ({
    exactWitnessFamilies: new Set(["Sg1910"]),
    sourceReviews: new Set(["review.json"]),
    currentDirectDeterministicSupport: false
  });
  const result = migrateOverrides({
    bible: "nbs",
    overrides: [first, second],
    proofs: new Map([
      [overridePlacementKey(first), proof()],
      [overridePlacementKey(second), proof()]
    ]),
    versesByRef: new Map([
      [
        "Gen.1.1",
        {
          bookNumber: "01",
          bookId: "Gen",
          chapter: 1,
          verse: 1,
          text: "Au commencement"
        }
      ]
    ])
  });

  assert.equal(result.counts.promotedOverrides, 0);
  assert.equal(result.counts.skippedCarrierConflict, 2);
  assert.deepEqual(
    result.overrides.map((item) => item.source),
    ["semantic-refill:llm", "semantic-refill:llm"]
  );
});

test("artifact migration rollback restores the quarantined source and reason", () => {
  const original = override();
  const migrated = {
    ...original,
    source: "semantic-refill:llm-consensus-filtered",
    reason: `${original.reason}; artifact-migration:current-post-consensus-filter; exact-witness-families:Sg1910`
  };
  const result = revertArtifactMigrations([migrated]);
  assert.equal(result.reverted, 1);
  assert.deepEqual(result.overrides, [original]);
});

test("artifact migration never promotes a relocation candidate as an insertion", () => {
  const outcome = {
    status: "accepted-safe" as const,
    exactWitnessFamilies: ["Sg1910"]
  };
  assert.equal(
    artifactOutcomeCanProveProduction({
      outcome,
      candidateAuditKind: "relocation",
      currentOpenCandidate: true,
      currentDirectDeterministicSupport: true
    }),
    false
  );
  assert.equal(
    artifactOutcomeCanProveProduction({
      outcome,
      candidateAuditKind: "missing",
      currentOpenCandidate: true,
      currentDirectDeterministicSupport: false
    }),
    true
  );
  assert.equal(
    artifactOutcomeCanProveProduction({
      outcome,
      candidateAuditKind: "missing",
      currentOpenCandidate: false,
      currentDirectDeterministicSupport: true
    }),
    false
  );
});

test("artifact migration upgrades an old exact target to its bounded choice", () => {
  const decision = {
    id: "candidate-1",
    choiceId: "",
    ref: "Gen.1.1",
    decision: "word" as const,
    strong: ["H7225"],
    confidence: 0.91,
    reason: "legacy consensus",
    wordIndex: 1,
    normalized: "commencement",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: []
  };
  const [upgraded] = upgradeLegacyDecisionChoices([decision], {
    bible: "nbs",
    scope: "Gen.1",
    candidates: [
      {
        id: "candidate-1",
        bible: "nbs",
        ref: "Gen.1.1",
        text: "Au commencement",
        auditKind: "missing",
        priority: "semantic-high",
        strong: "H7225",
        currentPlacement: "empty",
        sourcePlacement: { placement: "empty" },
        reason: "",
        eligible: true,
        tokens: [],
        originalInventory: ["H7225"],
        referenceInventory: {},
        existingReaderStrong: [],
        occupiedTargets: [],
        availableTargets: [
          {
            wordIndex: 1,
            text: "commencement",
            normalized: "commencement",
            weak: false,
            occupiedStrong: []
          }
        ],
        blockedTargets: [],
        openContentTargets: [],
        nearbyOpenTargets: [],
        placementWarnings: [],
        deterministicCandidates: []
      }
    ]
  });

  assert.equal(upgraded?.choiceId, "word:1");
});
