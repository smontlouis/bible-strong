import assert from "node:assert/strict";
import test from "node:test";

import { parseFrenchEntityCanonicalizationPlanArgs } from "../scripts/buildLexiconV3FrenchEntityCanonicalizationPlan.js";
import {
  assertFrenchEntityCanonicalizationResolved,
  buildFrenchEntityCanonicalizationPlan,
  canonicalFrenchEntityPolicyForms,
  frenchEntityCanonicalSecondaryRelation,
  frenchEntityDirectNamedMatchEntityIds,
  isFrenchUnboundAlternateNameCandidate,
  finalizeFrenchCanonicalEntity,
  finalizeFrenchCanonicalEntryNamePolicy,
  finalizeFrenchEntityClassificationProof,
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
  hashFrenchEntityJson,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchCanonicalEntityRecord,
  type FrenchEntityCanonicalizationCandidate,
  type FrenchEntityCanonicalizationExpectations,
  type FrenchEntityCanonicalizationPlan,
  type FrenchEntityCanonicalizationReviewUnit,
  type FrenchEntityNameTreatment,
  type FrenchEntityRegistrySourceMatch,
  type FrenchEntityRegistrySourceRecord
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import {
  FRENCH_EDITORIAL_POLICY_VERSION,
  FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION
} from "../src/lexiconV3/frenchEditorialPolicy.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

const SOURCE_DIGESTS = {
  entityRegistry: "a".repeat(64),
  packets: "b".repeat(64)
};

const EXPECTATIONS = {
  packets: 6,
  entries: 6,
  anchors: 1,
  reviews: 5,
  singleEntityEntries: 3,
  noEntityEntries: 2,
  multiEntityEntries: 1,
  entityIds: 3,
  sharedEntityGroups: 2,
  sharedEntityEntries: 4,
  crossLanguageEntityGroups: 2,
  reviewUnits: 5,
  entityReviewUnits: 2,
  noEntityReviewUnits: 2,
  multiEntityReviewUnits: 1
} satisfies FrenchEntityCanonicalizationExpectations;

test("derives an ownerless multi-entity primary and preserves compound semantics", () => {
  const matches = [
    {
      entityId: 19,
      significance: "NameCombined",
      aliasEn: "father [ie re-founder] of Gibeon",
      entityEn: "Abiel"
    },
    {
      entityId: 3514,
      significance: "Named",
      aliasEn: "Gibeon",
      entityEn: "Gibeon"
    }
  ];
  assert.deepEqual(
    frenchEntityDirectNamedMatchEntityIds({
      englishGloss: "Gibeon",
      entityMatches: matches
    }),
    [3514]
  );
  assert.equal(
    frenchEntityCanonicalSecondaryRelation({
      entityId: 19,
      entityMatches: matches
    }),
    "compound"
  );
  assert.equal(
    frenchEntityCanonicalSecondaryRelation({
      entityId: 3514,
      entityMatches: matches
    }),
    "alias"
  );
});

test("allows unbound alternate-name only for an explicit proper-name spelling", () => {
  const common = {
    entryKey: "hebrew:H7774H",
    entityIds: [],
    initialTreatment: "unresolved" as const,
    initialConstraint: "blocked" as const,
    anchor: null
  };
  assert.equal(
    isFrenchUnboundAlternateNameCandidate({
      ...common,
      identity: {
        stepEntryId: 21485,
        language: "hebrew",
        primaryDStrong: "H7774H",
        eStrong: "H7774",
        dStrong: "H7774H = a Spelling of",
        uStrong: "H7770",
        original: "שׁוּעָא",
        transliteration: "shu.a",
        morph: "N:N-F-P"
      }
    }),
    true
  );
  assert.equal(
    isFrenchUnboundAlternateNameCandidate({
      ...common,
      entryKey: "hebrew:H5757",
      identity: {
        stepEntryId: 17577,
        language: "hebrew",
        primaryDStrong: "H5757",
        eStrong: "H5757",
        dStrong: "H5757 = a Spelling of",
        uStrong: "H5761",
        original: "עַוִּי",
        transliteration: "avvi",
        morph: "N:N--PG"
      }
    }),
    false
  );
});

test("builds exact entity, no-entity and multi-entity review units with sealed English lineage", () => {
  const fixture = buildFixture();
  const plan = buildPlan(fixture, "2026-07-14T12:00:00.000Z");

  assert.deepEqual(plan.counts, EXPECTATIONS);
  assert.equal(plan.anchors.length, 1);
  assert.equal(plan.reviewCandidates.length, 5);
  assert.equal(plan.entityGroups.length, 3);
  assert.equal(plan.reviewUnits.length, 5);
  assert.deepEqual(countValues(plan.reviewUnits.map((unit) => unit.kind)), {
    "entity-group": 2,
    "multi-entity": 1,
    "no-entity": 2
  });

  const aaronUnit = plan.reviewUnits.find(
    (unit) => unit.kind === "entity-group" && unit.entityIds[0] === 1
  );
  assert.deepEqual(aaronUnit?.memberEntryKeys, ["greek:G0002", "hebrew:H1001"]);
  assert.deepEqual(aaronUnit?.anchorEntryKeys, ["greek:G0002"]);
  assert.deepEqual(aaronUnit?.reviewEntryKeys, ["hebrew:H1001"]);
  assert.equal(aaronUnit?.crossLanguage, true);

  const common = requiredCandidate(plan, "greek:G9048");
  assert.equal(common.initialTreatment, "etymological-or-common-gloss");
  assert.equal(common.initialConstraint, "lexical-translation");
  assert.deepEqual(common.entityIds, []);
  assert.match(common.englishParentHashes.lineageHash, /^[a-f0-9]{64}$/u);
  assert.equal(common.identity.stepEntryId, common.stepEntryId);

  const second = buildPlan(fixture, "2030-01-01T00:00:00.000Z");
  assert.notEqual(plan.generatedAt, second.generatedAt);
  assert.equal(plan.planHash, second.planHash);
});

test("fails closed on registry hash, STEP identity and English-parent drift", () => {
  const fixture = buildFixture();
  const registryHashDrift = structuredClone(fixture.registry);
  const firstRegistry = registryHashDrift[0];
  assert.ok(firstRegistry);
  firstRegistry.englishGloss = "wrong";
  assert.throws(
    () =>
      buildFrenchEntityCanonicalizationPlan({
        entityRegistry: registryHashDrift,
        packets: fixture.packets,
        sourceDigests: SOURCE_DIGESTS,
        expectations: EXPECTATIONS
      }),
    /registry-hash/u
  );

  const identityDrift = structuredClone(fixture.registry);
  const identityRecord = identityDrift[1];
  assert.ok(identityRecord);
  identityRecord.identity.uStrong = "H9999";
  rehashRegistryRecord(identityRecord);
  assert.throws(
    () =>
      buildFrenchEntityCanonicalizationPlan({
        entityRegistry: identityDrift,
        packets: fixture.packets,
        sourceDigests: SOURCE_DIGESTS,
        expectations: EXPECTATIONS
      }),
    /exact-join/u
  );

  const packetDrift = structuredClone(fixture.packets);
  const packet = packetDrift[2];
  assert.ok(packet);
  packet.englishRelease.parents.gloss.valueTextHash = "c".repeat(64);
  assert.throws(
    () =>
      buildFrenchEntityCanonicalizationPlan({
        entityRegistry: fixture.registry,
        packets: packetDrift,
        sourceDigests: SOURCE_DIGESTS,
        expectations: EXPECTATIONS
      }),
    /invalid-packet/u
  );
});

test("passes the global gate only with exact coverage, one primary French name and explicit relations", () => {
  const fixture = buildFixture();
  const plan = buildPlan(fixture, "2026-07-14T12:00:00.000Z");
  const canonicalEntities = buildCanonicalEntities(plan);
  const entryPolicies = buildResolvedPolicies(plan, canonicalEntities);

  const gate = assertFrenchEntityCanonicalizationResolved({
    plan,
    canonicalEntities,
    entryPolicies,
    expectations: EXPECTATIONS
  });
  assert.equal(gate.entityCount, 3);
  assert.equal(gate.policyCount, 6);
  assert.equal(gate.unresolvedCount, 0);
  assert.equal(gate.blockedCount, 0);
  assert.equal(gate.exactCoverage, true);
  assert.equal(gate.onePrimaryFrenchPerEntity, true);
  assert.match(gate.gateHash, /^[a-f0-9]{64}$/u);

  assert.throws(
    () =>
      assertFrenchEntityCanonicalizationResolved({
        plan,
        canonicalEntities: canonicalEntities.slice(1),
        entryPolicies,
        expectations: EXPECTATIONS
      }),
    /entity-coverage/u
  );

  const unresolved = entryPolicies.map((policy) =>
    policy.entryKey === "greek:G9048"
      ? finalizeFrenchCanonicalEntryNamePolicy({
          ...withoutPolicyEnvelope(policy),
          treatment: "unresolved",
          constraint: "blocked",
          primaryFr: null,
          derivedFr: null,
          englishForms: [],
          allowedFrenchForms: [],
          entityBindings: []
        })
      : policy
  );
  assert.throws(
    () =>
      assertFrenchEntityCanonicalizationResolved({
        plan,
        canonicalEntities,
        entryPolicies: unresolved,
        expectations: EXPECTATIONS
      }),
    /unresolved-policy/u
  );

  const alias = entryPolicies.find(
    (policy) => policy.entryKey === "hebrew:H1001"
  );
  assert.ok(alias);
  assert.throws(
    () =>
      finalizeFrenchCanonicalEntryNamePolicy({
        ...withoutPolicyEnvelope(alias),
        entityBindings: [{ entityId: 1, relation: "primary" }]
      }),
    /invalid-policy-relation/u
  );
  const implicitAlias = entryPolicies.map((policy) => {
    if (policy !== alias) return policy;
    const forged = structuredClone(policy);
    forged.entityBindings = [{ entityId: 1, relation: "primary" }];
    resealEntryPolicy(forged);
    return forged;
  });
  assert.throws(
    () =>
      assertFrenchEntityCanonicalizationResolved({
        plan,
        canonicalEntities,
        entryPolicies: implicitAlias,
        expectations: EXPECTATIONS
      }),
    /invalid-policy-relation/u
  );
});

test("derives a closed French form set and rejects a rehashed competing spelling", () => {
  assert.deepEqual(canonicalFrenchEntityPolicyForms("gentilic", "Israélite"), [
    "Israélite",
    "Israélites"
  ]);
  assert.deepEqual(canonicalFrenchEntityPolicyForms("gentilic", "Royal"), [
    "Royal",
    "Royaux"
  ]);
  assert.deepEqual(canonicalFrenchEntityPolicyForms("gentilic", "Hébreu"), [
    "Hébreu",
    "Hébreux"
  ]);
  assert.deepEqual(canonicalFrenchEntityPolicyForms("gentilic", "Français"), [
    "Français"
  ]);
  assert.deepEqual(
    canonicalFrenchEntityPolicyForms("gentilic", "Jésus de Jérusalem"),
    ["Jésus de Jérusalem"]
  );
  assert.deepEqual(
    canonicalFrenchEntityPolicyForms("alternate-name", "Abigaïl"),
    ["Abigaïl"]
  );

  const fixture = buildFixture();
  const plan = buildPlan(fixture, "2026-07-14T12:00:00.000Z");
  const canonicalEntities = buildCanonicalEntities(plan);
  const entryPolicies = buildResolvedPolicies(plan, canonicalEntities);
  const gentilic = entryPolicies.find(
    (policy) => policy.treatment === "gentilic"
  );
  assert.ok(gentilic);
  assert.throws(
    () =>
      finalizeFrenchCanonicalEntryNamePolicy({
        ...withoutPolicyEnvelope(gentilic),
        allowedFrenchForms: [...gentilic.allowedFrenchForms, "Ihézrite"]
      }),
    /finalizer-noncanonical-forms/u
  );
  const contaminated = structuredClone(gentilic);
  contaminated.allowedFrenchForms = [
    ...contaminated.allowedFrenchForms,
    "Ihézrite"
  ].sort();
  const { contentHash: _contentHash, ...content } = contaminated;
  void _contentHash;
  contaminated.contentHash = hashFrenchEntityJson(content);

  assert.throws(
    () =>
      assertFrenchEntityCanonicalizationResolved({
        plan,
        canonicalEntities,
        entryPolicies: entryPolicies.map((policy) =>
          policy.entryKey === contaminated.entryKey ? contaminated : policy
        ),
        expectations: EXPECTATIONS
      }),
    /noncanonical-french-forms/u
  );
});

test("requires four internal review artifacts and non-historical sealed evidence", () => {
  const fixture = buildFixture();
  const plan = buildPlan(fixture, "2026-07-14T12:00:00.000Z");
  const canonicalEntities = buildCanonicalEntities(plan);
  const policies = buildResolvedPolicies(plan, canonicalEntities);
  const target = policies.find((policy) => policy.entryKey === "greek:G9048");
  assert.ok(target);

  const missingAuditor = policies.map((policy) => {
    if (policy !== target) return policy;
    const proof = finalizeFrenchEntityClassificationProof({
      ...withoutProofEnvelope(policy.classificationProof),
      agentArtifacts: null
    });
    return finalizeFrenchCanonicalEntryNamePolicy({
      ...withoutPolicyEnvelope(policy),
      classificationProof: proof
    });
  });
  assert.throws(
    () =>
      assertFrenchEntityCanonicalizationResolved({
        plan,
        canonicalEntities,
        entryPolicies: missingAuditor,
        expectations: EXPECTATIONS
      }),
    /review-proof/u
  );

  const forgedAgentArtifactMaps: Array<Record<string, string>> = [
    { proposerAHash: "1".repeat(64) },
    {
      proposerAHash: "1".repeat(64),
      proposerBHash: "2".repeat(64),
      arbiterHash: "3".repeat(64),
      auditorHash: "4".repeat(64),
      unexpectedHash: "5".repeat(64)
    }
  ];
  for (const agentArtifacts of forgedAgentArtifactMaps) {
    const forged = structuredClone(target);
    (
      forged.classificationProof as unknown as {
        agentArtifacts: Record<string, string>;
      }
    ).agentArtifacts = agentArtifacts;
    resealClassificationProof(forged);
    resealEntryPolicy(forged);
    assert.throws(
      () =>
        assertFrenchEntityCanonicalizationResolved({
          plan,
          canonicalEntities,
          entryPolicies: policies.map((policy) =>
            policy === target ? forged : policy
          ),
          expectations: EXPECTATIONS
        }),
      /proof-agent-artifacts/u
    );
  }

  const historicalOnly = policies.map((policy) => {
    if (policy !== target) return policy;
    const candidate = requiredCandidate(plan, policy.entryKey);
    assert.ok(candidate.sourceHashes.historicalCandidateHash);
    const proof = finalizeFrenchEntityClassificationProof({
      ...withoutProofEnvelope(policy.classificationProof),
      evidenceHashes: [candidate.sourceHashes.historicalCandidateHash]
    });
    return finalizeFrenchCanonicalEntryNamePolicy({
      ...withoutPolicyEnvelope(policy),
      classificationProof: proof
    });
  });
  assert.throws(
    () =>
      assertFrenchEntityCanonicalizationResolved({
        plan,
        canonicalEntities,
        entryPolicies: historicalOnly,
        expectations: EXPECTATIONS
      }),
    /historical-only-proof/u
  );
});

test("rejects rehashed unknown or treatment-incoherent policy discriminants", () => {
  const fixture = buildFixture();
  const plan = buildPlan(fixture, "2026-07-14T12:00:00.000Z");
  const canonicalEntities = buildCanonicalEntities(plan);
  const policies = buildResolvedPolicies(plan, canonicalEntities);

  const assertForgedRejected = (
    entryKey: string,
    mutate: (policy: Record<string, unknown>) => void,
    pattern: RegExp
  ): void => {
    const target = policies.find((policy) => policy.entryKey === entryKey);
    assert.ok(target);
    const forged = structuredClone(target);
    mutate(forged as unknown as Record<string, unknown>);
    resealEntryPolicy(forged);
    assert.throws(
      () =>
        assertFrenchEntityCanonicalizationResolved({
          plan,
          canonicalEntities,
          entryPolicies: policies.map((policy) =>
            policy === target ? forged : policy
          ),
          expectations: EXPECTATIONS
        }),
      pattern
    );
  };

  assertForgedRejected(
    "greek:G9048",
    (policy) => {
      policy.treatment = "invented-runtime-treatment";
    },
    /invalid-policy-treatment/u
  );
  assertForgedRejected(
    "hebrew:H1001",
    (policy) => {
      policy.constraint = "lexical-translation";
    },
    /invalid-policy-constraint/u
  );
  assertForgedRejected(
    "greek:G1002",
    (policy) => {
      const bindings = policy.entityBindings as Array<Record<string, unknown>>;
      assert.ok(bindings[0]);
      bindings[0].relation = "primary";
    },
    /invalid-policy-relation/u
  );
  assertForgedRejected(
    "hebrew:H1001",
    (policy) => {
      const bindings = policy.entityBindings as Array<Record<string, unknown>>;
      assert.ok(bindings[0]);
      bindings[0].relation = "invented-runtime-relation";
    },
    /invalid-policy-relation/u
  );
  assert.throws(
    () =>
      canonicalFrenchEntityPolicyForms(
        "invented-runtime-treatment" as never,
        "Aharon"
      ),
    /invalid-policy-treatment/u
  );
});

test("exposes a strict plan-only CLI surface", () => {
  const parsed = parseFrenchEntityCanonicalizationPlanArgs([
    "--plan-only",
    "--entity-registry",
    "/tmp/entities.jsonl",
    "--packets=/tmp/packets.jsonl",
    "--output",
    "/tmp/plan.json",
    "--generated-at",
    "2026-07-14T12:00:00.000Z"
  ]);
  assert.equal(parsed.planOnly, true);
  assert.equal(parsed.output, "/tmp/plan.json");
  assert.throws(
    () => parseFrenchEntityCanonicalizationPlanArgs(["--plan-only=false"]),
    /non-plan-mode-unsupported/u
  );
  assert.throws(
    () => parseFrenchEntityCanonicalizationPlanArgs(["--model", "x"]),
    /unknown-option/u
  );
});

function buildFixture(): {
  packets: LexiconV3FrenchPacket[];
  registry: FrenchEntityRegistrySourceRecord[];
} {
  const specs: Array<{
    entryKey: string;
    stepEntryId: number;
    language: "greek" | "hebrew";
    dStrong: string;
    gloss: string;
    morph: string;
    status: "green" | "yellow" | "red";
    canonicalFr: string | null;
    matches: FrenchEntityRegistrySourceMatch[];
  }> = [
    {
      entryKey: "greek:G0002",
      stepEntryId: 1,
      language: "greek",
      dStrong: "G0002 = the Greek of",
      gloss: "Aaron",
      morph: "N:N-M-P",
      status: "green",
      canonicalFr: "Aaron",
      matches: [match(1, "Aaron", "Aaron", "Aaron", "person", "Male")]
    },
    {
      entryKey: "hebrew:H1001",
      stepEntryId: 2,
      language: "hebrew",
      dStrong: "H1001 =",
      gloss: "Aharon",
      morph: "N:N-M-P",
      status: "yellow",
      canonicalFr: null,
      matches: [match(1, "Aharon", "Aaron", "Aaron", "person", "Male")]
    },
    {
      entryKey: "greek:G1002",
      stepEntryId: 3,
      language: "greek",
      dStrong: "G1002 =",
      gloss: "Judean",
      morph: "N:N-M-T",
      status: "yellow",
      canonicalFr: null,
      matches: [match(2, "Judean", "Judah", "Juda", "place", "Region")]
    },
    {
      entryKey: "greek:G9048",
      stepEntryId: 4,
      language: "greek",
      dStrong: "G9048 =",
      gloss: "a plain",
      morph: "N:N",
      status: "red",
      canonicalFr: null,
      matches: []
    },
    {
      entryKey: "hebrew:H1003",
      stepEntryId: 5,
      language: "hebrew",
      dStrong: "H1003 =",
      gloss: "a hill",
      morph: "H:N",
      status: "red",
      canonicalFr: null,
      matches: []
    },
    {
      entryKey: "hebrew:H1004",
      stepEntryId: 6,
      language: "hebrew",
      dStrong: "H1004 =",
      gloss: "Judah-Israel",
      morph: "N:N--T",
      status: "red",
      canonicalFr: null,
      matches: [
        match(2, "Judah", "Judah", "Juda", "place", "Region"),
        match(3, "Israel", "Israel", "Israël", "place", "Region")
      ]
    }
  ];
  const packets = specs.map((spec) => makePacket(spec));
  const registry = specs.map((spec, index) =>
    makeRegistryRecord(packets[index] as LexiconV3FrenchPacket, spec)
  );
  return { packets, registry };
}

function makePacket(spec: {
  entryKey: string;
  stepEntryId: number;
  language: "greek" | "hebrew";
  dStrong: string;
  gloss: string;
  morph: string;
}): LexiconV3FrenchPacket {
  const primaryDStrong = spec.entryKey.split(":")[1] ?? "";
  const eStrong = primaryDStrong.replace(/[A-Z]$/u, "");
  const meaning = `${spec.gloss} definition`;
  const meaningHtml = `<p>${meaning}</p>`;
  return buildFrenchPacket(
    {
      entryKey: spec.entryKey,
      identity: {
        stepEntryId: spec.stepEntryId,
        language: spec.language,
        eStrong,
        dStrong: spec.dStrong,
        uStrong: primaryDStrong,
        original: `original-${spec.stepEntryId}`,
        transliteration: `transliteration-${spec.stepEntryId}`,
        morph: spec.morph
      },
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: spec.entryKey,
        gloss: spec.gloss,
        meaning,
        meaningHtml,
        glossFieldVersionId: spec.stepEntryId * 2 - 1,
        meaningFieldVersionId: spec.stepEntryId * 2
      }),
      english: {
        contentHash: "",
        status: "validated",
        gloss: spec.gloss,
        meaning,
        meaningHtml,
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      }
    },
    "2026-07-14T12:00:00.000Z"
  );
}

function makeRegistryRecord(
  packet: LexiconV3FrenchPacket,
  spec: {
    status: "green" | "yellow" | "red";
    canonicalFr: string | null;
    matches: FrenchEntityRegistrySourceMatch[];
  }
): FrenchEntityRegistrySourceRecord {
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION,
    policyVersion: FRENCH_EDITORIAL_POLICY_VERSION,
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    identity: {
      language: packet.identity.language,
      primaryDStrong: packet.entryKey.split(":")[1] ?? "",
      eStrong: packet.identity.eStrong,
      dStrong: packet.identity.dStrong,
      uStrong: packet.identity.uStrong,
      morph: packet.identity.morph
    },
    englishGloss: packet.english.gloss,
    status: spec.status,
    canonicalFr: spec.canonicalFr,
    reasons:
      spec.status === "green"
        ? ["exact-entity-alias-and-two-family-french-attestation"]
        : ["requires-editorial-adjudication"],
    matches: spec.matches,
    referenceEvidence:
      spec.status === "green"
        ? [
            {
              surface: spec.canonicalFr,
              witnessFamilies: ["Darby-family", "Sg1910"]
            }
          ]
        : [],
    historicalCandidate: {
      gloss: spec.canonicalFr ?? `historical-${packet.entryKey}`,
      trust: "untrusted-candidate" as const,
      sourceHash: hashFrenchEntityJson({ entryKey: packet.entryKey })
    },
    inputHash: hashFrenchEntityJson({ packetHash: packet.packetHash })
  };
  return {
    ...withoutHash,
    contentHash: hashFrenchEntityJson(withoutHash)
  };
}

function match(
  entityId: number,
  aliasEn: string,
  entityEn: string,
  candidateFr: string,
  category: string,
  type: string
): FrenchEntityRegistrySourceMatch {
  return {
    entityId,
    significance: "fixture",
    aliasEn,
    entityEn,
    candidateFr,
    category,
    type
  };
}

function buildPlan(
  fixture: ReturnType<typeof buildFixture>,
  generatedAt: string
): FrenchEntityCanonicalizationPlan {
  return buildFrenchEntityCanonicalizationPlan({
    entityRegistry: fixture.registry,
    packets: fixture.packets,
    sourceDigests: SOURCE_DIGESTS,
    generatedAt,
    expectations: EXPECTATIONS
  });
}

function buildCanonicalEntities(
  plan: FrenchEntityCanonicalizationPlan
): FrenchCanonicalEntityRecord[] {
  const primary = new Map([
    [1, "Aaron"],
    [2, "Juda"],
    [3, "Israël"]
  ]);
  return plan.entityGroups.map((group) =>
    finalizeFrenchCanonicalEntity({
      entityId: group.entityId,
      primaryFr: primary.get(group.entityId) ?? "",
      category: group.category,
      type: group.type,
      memberEntryKeys: group.memberEntryKeys,
      sourceEntityHash: group.sourceEntityHash,
      groupProofHash: group.groupProofHash
    })
  );
}

function buildResolvedPolicies(
  plan: FrenchEntityCanonicalizationPlan,
  canonicalEntities: readonly FrenchCanonicalEntityRecord[]
): FrenchCanonicalEntryNamePolicy[] {
  const entityById = new Map(
    canonicalEntities.map((entity) => [entity.entityId, entity])
  );
  const unitsByEntry = new Map<
    string,
    FrenchEntityCanonicalizationReviewUnit
  >();
  for (const unit of plan.reviewUnits) {
    for (const entryKey of unit.reviewEntryKeys) {
      unitsByEntry.set(entryKey, unit);
    }
  }
  return [...plan.anchors, ...plan.reviewCandidates]
    .sort((left, right) => left.entryKey.localeCompare(right.entryKey))
    .map((candidate) => {
      const unit = unitsByEntry.get(candidate.entryKey) ?? null;
      const proof = finalizeFrenchEntityClassificationProof({
        sourceCandidateHash: candidate.candidateHash,
        sourceReviewUnitHash: unit?.unitHash ?? null,
        decisionMethod: candidate.anchor
          ? "deterministic-green-anchor"
          : "internal-agent-adjudication",
        agentArtifacts: candidate.anchor
          ? null
          : {
              proposerAHash: "1".repeat(64),
              proposerBHash: "2".repeat(64),
              arbiterHash: "3".repeat(64),
              auditorHash: "4".repeat(64)
            },
        evidenceHashes: [
          candidate.anchor
            ? candidate.sourceHashes.referenceEvidenceHash
            : candidate.englishParentHashes.lineageHash
        ],
        reasons: ["fixture-reviewed-decision"]
      });
      const base = {
        entryKey: candidate.entryKey,
        stepEntryId: candidate.stepEntryId,
        identity: candidate.identity,
        englishParentHashes: candidate.englishParentHashes,
        classificationProof: proof
      };
      if (candidate.anchor) {
        const primaryFr =
          entityById.get(candidate.anchor.entityId)?.primaryFr ?? "";
        return finalizeFrenchCanonicalEntryNamePolicy({
          ...base,
          treatment: "canonical-name",
          entityBindings: [
            { entityId: candidate.anchor.entityId, relation: "primary" }
          ],
          constraint: "canonical",
          primaryFr,
          derivedFr: null,
          englishForms: [candidate.englishGloss],
          allowedFrenchForms: [primaryFr]
        });
      }
      const treatment = treatmentForEntry(candidate.entryKey);
      if (treatment === "etymological-or-common-gloss") {
        const derivedFr =
          candidate.entryKey === "greek:G9048" ? "une plaine" : "une colline";
        return finalizeFrenchCanonicalEntryNamePolicy({
          ...base,
          treatment,
          entityBindings: [],
          constraint: "lexical-translation",
          primaryFr: null,
          derivedFr,
          englishForms: [],
          allowedFrenchForms: [derivedFr]
        });
      }
      if (treatment === "compound-name") {
        return finalizeFrenchCanonicalEntryNamePolicy({
          ...base,
          treatment,
          entityBindings: candidate.entityIds.map((entityId) => ({
            entityId,
            relation: "compound" as const
          })),
          constraint: "derived",
          primaryFr: null,
          derivedFr: "Juda-Israël",
          englishForms: [candidate.englishGloss],
          allowedFrenchForms: ["Juda-Israël"]
        });
      }
      const isGentilic = treatment === "gentilic";
      const derivedFr = isGentilic ? "Judéen" : "Aharon";
      return finalizeFrenchCanonicalEntryNamePolicy({
        ...base,
        treatment,
        entityBindings: [
          {
            entityId: candidate.entityIds[0] as number,
            relation: isGentilic ? "gentilic" : "alias"
          }
        ],
        constraint: "derived",
        primaryFr: null,
        derivedFr,
        englishForms: [candidate.englishGloss],
        allowedFrenchForms: [derivedFr]
      });
    });
}

function treatmentForEntry(entryKey: string): FrenchEntityNameTreatment {
  if (entryKey === "hebrew:H1001") return "alternate-name";
  if (entryKey === "greek:G1002") return "gentilic";
  if (entryKey === "hebrew:H1004") return "compound-name";
  return "etymological-or-common-gloss";
}

function resealClassificationProof(
  policy: FrenchCanonicalEntryNamePolicy
): void {
  const { proofHash: _proofHash, ...proofContent } = policy.classificationProof;
  void _proofHash;
  policy.classificationProof.proofHash = hashFrenchEntityJson(proofContent);
}

function resealEntryPolicy(policy: FrenchCanonicalEntryNamePolicy): void {
  const { contentHash: _contentHash, ...content } = policy;
  void _contentHash;
  policy.contentHash = hashFrenchEntityJson(content);
}

function requiredCandidate(
  plan: FrenchEntityCanonicalizationPlan,
  entryKey: string
): FrenchEntityCanonicalizationCandidate {
  const candidate = [...plan.anchors, ...plan.reviewCandidates].find(
    (value) => value.entryKey === entryKey
  );
  if (!candidate) throw new Error(`missing-candidate:${entryKey}`);
  return candidate;
}

function rehashRegistryRecord(record: FrenchEntityRegistrySourceRecord): void {
  const { contentHash: _contentHash, ...content } = record;
  void _contentHash;
  record.contentHash = hashFrenchEntityJson(content);
}

function withoutPolicyEnvelope(
  policy: FrenchCanonicalEntryNamePolicy
): Omit<
  FrenchCanonicalEntryNamePolicy,
  "schemaVersion" | "policyVersion" | "contentHash"
> {
  const {
    schemaVersion: _schemaVersion,
    policyVersion: _policyVersion,
    contentHash: _contentHash,
    ...content
  } = policy;
  void _schemaVersion;
  void _policyVersion;
  void _contentHash;
  return content;
}

function withoutProofEnvelope(
  proof: FrenchCanonicalEntryNamePolicy["classificationProof"]
): Omit<
  FrenchCanonicalEntryNamePolicy["classificationProof"],
  "schemaVersion" | "proofHash"
> {
  const {
    schemaVersion: _schemaVersion,
    proofHash: _proofHash,
    ...content
  } = proof;
  void _schemaVersion;
  void _proofHash;
  return content;
}

function countValues(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

assert.equal(
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
  "lexicon-v3-french-entity-canonicalization-policy@3"
);
