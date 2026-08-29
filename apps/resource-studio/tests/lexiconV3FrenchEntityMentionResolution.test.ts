import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFrenchEntityMentionResolution,
  buildFrenchEntityMentionResolutionPlan,
  finalizeFrenchEntityMentionAudit,
  finalizeFrenchEntityMentionDecision
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import {
  finalizeFrenchEntityMentionsArtifact,
  type FrenchEntityMentionCanonicalPolicy,
  type RequiredFrenchEntityMention
} from "../src/lexiconV3/frenchEntityMentions.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import { buildFrenchEntityMentionAdjudicationPrompt } from "../scripts/runLexiconV3FrenchEntityMentionAdjudication.js";

test("adjudication prompts forbid using the source notice identity as mention evidence", () => {
  for (const role of ["arbiter", "auditor"] as const) {
    const prompt = buildFrenchEntityMentionAdjudicationPrompt(
      role,
      '{"units":[]}',
      0,
      []
    );
    assert.match(prompt, /NOTICE SOURCE/u);
    assert.match(prompt, /MENTION INTERNE/u);
    assert.match(prompt, /sourceEntryKey\/sourceIdentity/u);
  }
  assert.match(
    buildFrenchEntityMentionAdjudicationPrompt(
      "auditor",
      '{"units":[]}',
      0,
      []
    ),
    /sourceContextExact=false/u
  );
});

test("plans contextual candidates and applies safe select/non-entity/quarantine decisions", () => {
  const source = finalizeFrenchEntityMentionsArtifact({
    inputHashes: {
      stepEntries: "1".repeat(64),
      canonicalEntities: "2".repeat(64),
      canonicalPolicies: "3".repeat(64),
      englishMeanings: "4".repeat(64)
    },
    requiredEntityMentions: [
      mention("a", "Jordan"),
      mention("b", "Ham"),
      mention("c", "Diblathaim"),
      mention("d", "Mark")
    ]
  });
  const packet = (entryKey: string, meaning: string) =>
    ({
      entryKey,
      identity: {
        stepEntryId: 1,
        language: "greek",
        eStrong: "G0001",
        dStrong: "G0001 =",
        uStrong: "G0001",
        original: "x",
        transliteration: "x",
        morph: "N:N"
      },
      englishRelease: {
        releaseKey: "fixture-release",
        releaseSnapshotFingerprint: "5".repeat(64)
      },
      english: { gloss: "fixture", meaning, meaningHtml: meaning }
    }) as unknown as LexiconV3FrenchPacket;
  const policies = [
    policy("hebrew:H3383", "Jordan", "Jourdain", 1),
    policy("greek:G9992", "Jordan", "Jordan", 2),
    policy("hebrew:H1990", "Ham", "Cham", 3),
    policy("hebrew:H1991", "Ham", "Ham", 4),
    policy("hebrew:H1016", "Diblathaim", "Beth-Diblathaïm", 5),
    policy("hebrew:H5963", "Diblathaim", "Almon-Diblathaïm", 6),
    policy("greek:G3138", "Mark", "Marc", 7)
  ];
  const plan = buildFrenchEntityMentionResolutionPlan({
    mentions: source,
    packets: [
      packet("greek:G0001", "Jordan"),
      packet("greek:G0002", "the ham"),
      packet("greek:G0003", "Diblathaim"),
      packet("greek:G0004", "to mark")
    ],
    canonicalPolicies: policies
  });
  assert.equal(plan.units.length, 4);
  assert.equal(
    plan.units.find((unit) => unit.sourceSurface === "Mark")?.candidates.length,
    1
  );

  const dispositions = new Map([
    [
      "Jordan",
      { disposition: "select" as const, selectedEntryKey: "hebrew:H3383" }
    ],
    ["Ham", { disposition: "non-entity" as const, selectedEntryKey: null }],
    ["Mark", { disposition: "non-entity" as const, selectedEntryKey: null }],
    [
      "Diblathaim",
      { disposition: "quarantine" as const, selectedEntryKey: null }
    ]
  ]);
  const decisions = plan.units.map((unit) => {
    const selected = dispositions.get(unit.sourceSurface)!;
    return finalizeFrenchEntityMentionDecision({
      role: "arbiter",
      unitId: unit.unitId,
      inputHash: unit.inputHash,
      ...selected,
      reasonCodes: ["fixture"],
      rationale: "fixture",
      confidence: 0.99
    });
  });
  const proposerA = decisions.map((decision) =>
    finalizeFrenchEntityMentionDecision({
      role: "proposerA",
      unitId: decision.unitId,
      inputHash: decision.inputHash,
      disposition: decision.disposition,
      selectedEntryKey: decision.selectedEntryKey,
      reasonCodes: decision.reasonCodes,
      rationale: decision.rationale,
      confidence: decision.confidence
    })
  );
  const proposerB = decisions.map((decision) =>
    finalizeFrenchEntityMentionDecision({
      role: "proposerB",
      unitId: decision.unitId,
      inputHash: decision.inputHash,
      disposition: decision.disposition,
      selectedEntryKey: decision.selectedEntryKey,
      reasonCodes: decision.reasonCodes,
      rationale: decision.rationale,
      confidence: decision.confidence
    })
  );
  const audits = plan.units.map((unit) => {
    const decision = decisions.find((item) => item.unitId === unit.unitId)!;
    return finalizeFrenchEntityMentionAudit({
      unitId: unit.unitId,
      inputHash: unit.inputHash,
      arbiterArtifactHash: decision.artifactHash,
      verdict: "safe",
      checks: {
        sourceContextExact: true,
        selectedPolicyAuthorized: true,
        nonEntityJustified: true,
        noInventedFrenchForm: true
      },
      reasons: [],
      confidence: 0.99
    });
  });
  const result = applyFrenchEntityMentionResolution({
    source,
    plan,
    proposerADecisions: proposerA,
    proposerBDecisions: proposerB,
    arbiterDecisions: decisions,
    audits,
    executionRunHashes: ["6".repeat(64)]
  });
  assert.deepEqual(
    result.mentions.requiredEntityMentions.map((item) => ({
      surface: item.sourceSurface,
      resolution: item.resolution,
      target: item.targetEntryKey,
      forms: item.allowedFrenchForms
    })),
    [
      {
        surface: "Jordan",
        resolution: "exact",
        target: "hebrew:H3383",
        forms: ["Jourdain"]
      },
      {
        surface: "Ham",
        resolution: "non-entity",
        target: null,
        forms: []
      },
      {
        surface: "Diblathaim",
        resolution: "quarantined",
        target: null,
        forms: []
      },
      {
        surface: "Mark",
        resolution: "non-entity",
        target: null,
        forms: []
      }
    ]
  );
  assert.equal(result.mentions.blockingMentionIds.length, 0);
  assert.deepEqual(result.attestation.counts, {
    selected: 1,
    nonEntity: 2,
    policyRepair: 0,
    quarantined: 1,
    unsafeAuditsQuarantined: 0
  });
});

test("publishable resolution clears a retained target from bare Strong-code non-entities", () => {
  const { contentHash: _codedHash, ...codedBase } = mention("e", "H3878");
  const codedWithoutHash = {
    ...codedBase,
    citedStrong: "H3878",
    targetEntryKey: "hebrew:H3878",
    targetEntityIds: [],
    allowedFrenchForms: [],
    resolution: "non-entity" as const
  };
  const codedNonEntity = {
    ...codedWithoutHash,
    contentHash: hashFrenchInternalJson(codedWithoutHash)
  };
  const source = finalizeFrenchEntityMentionsArtifact({
    inputHashes: {
      stepEntries: "1".repeat(64),
      canonicalEntities: "2".repeat(64),
      canonicalPolicies: "3".repeat(64),
      englishMeanings: "4".repeat(64)
    },
    requiredEntityMentions: [codedNonEntity]
  });
  const plan = buildFrenchEntityMentionResolutionPlan({
    mentions: source,
    packets: [
      {
        entryKey: "greek:G0004",
        englishRelease: {
          releaseKey: "fixture-release",
          releaseSnapshotFingerprint: "6".repeat(64)
        }
      } as unknown as LexiconV3FrenchPacket
    ],
    canonicalPolicies: []
  });
  const result = applyFrenchEntityMentionResolution({
    source,
    plan,
    proposerADecisions: [],
    proposerBDecisions: [],
    arbiterDecisions: [],
    audits: [],
    executionRunHashes: ["5".repeat(64)]
  });
  assert.equal(result.mentions.requiredEntityMentions[0]?.resolution, "non-entity");
  assert.equal(result.mentions.requiredEntityMentions[0]?.citedStrong, "H3878");
  assert.equal(result.mentions.requiredEntityMentions[0]?.targetEntryKey, null);
});

test("refuses raw exact mentions that bypass context review or expose only a Strong code", () => {
  const { contentHash: _uncitedHash, ...uncitedBase } = mention("d", "Mark");
  const uncitedWithoutHash = {
    ...uncitedBase,
    citedStrong: null,
    targetEntryKey: "greek:G3138",
    resolution: "exact" as const
  };
  const uncited = finalizeFrenchEntityMentionsArtifact({
    inputHashes: {
      stepEntries: "1".repeat(64),
      canonicalEntities: "2".repeat(64),
      canonicalPolicies: "3".repeat(64),
      englishMeanings: "4".repeat(64)
    },
    requiredEntityMentions: [
      {
        ...uncitedWithoutHash,
        contentHash: hashFrenchInternalJson(uncitedWithoutHash)
      }
    ]
  });
  assert.throws(
    () =>
      buildFrenchEntityMentionResolutionPlan({
        mentions: uncited,
        packets: [],
        canonicalPolicies: []
      }),
    /unreviewed-uncited-exact/u
  );

  const { contentHash: _codeHash, ...codeBase } = mention("d", "G3138");
  const codeWithoutHash = {
    ...codeBase,
    citedStrong: "G3138",
    targetEntryKey: "greek:G3138",
    resolution: "exact" as const
  };
  const codeOnly = finalizeFrenchEntityMentionsArtifact({
    inputHashes: uncited.inputHashes,
    requiredEntityMentions: [
      {
        ...codeWithoutHash,
        contentHash: hashFrenchInternalJson(codeWithoutHash)
      }
    ]
  });
  assert.throws(
    () =>
      buildFrenchEntityMentionResolutionPlan({
        mentions: codeOnly,
        packets: [],
        canonicalPolicies: []
      }),
    /code-surface-exact/u
  );
});

function mention(seed: string, surface: string): RequiredFrenchEntityMention {
  const sourceEntryKey = `greek:G000${
    seed === "a" ? "1" : seed === "b" ? "2" : seed === "c" ? "3" : "4"
  }`;
  const withoutHash = {
    mentionId: `entity-mention:${seed.repeat(64)}`,
    sourceEntryKey,
    segmentId: "t0",
    sourceSurface: surface,
    citedStrong: null,
    targetEntryKey: null,
    targetEntityIds:
      surface === "Jordan"
        ? [1, 2]
        : surface === "Ham"
          ? [3, 4]
          : surface === "Mark"
            ? [7]
            : [5, 6],
    allowedFrenchForms:
      surface === "Jordan"
        ? ["Jordan", "Jourdain"]
        : surface === "Ham"
          ? ["Cham", "Ham"]
          : surface === "Mark"
            ? ["Marc"]
            : ["Almon-Diblathaïm", "Beth-Diblathaïm"],
    resolution: "contextual" as const
  };
  return { ...withoutHash, contentHash: hashFrenchInternalJson(withoutHash) };
}

function policy(
  entryKey: string,
  english: string,
  french: string,
  entityId: number
): FrenchEntityMentionCanonicalPolicy {
  return {
    entryKey,
    englishForms: [english],
    allowedFrenchForms: [french],
    entityBindings: [{ entityId, relation: "primary" }],
    treatment: "canonical-name",
    constraint: "canonical",
    primaryFr: french,
    derivedFr: null,
    contentHash: hashFrenchInternalJson({ entryKey, english, french, entityId })
  } as unknown as FrenchEntityMentionCanonicalPolicy;
}
