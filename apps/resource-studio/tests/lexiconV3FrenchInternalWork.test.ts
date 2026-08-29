import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import test from "node:test";

import { parseFrenchInternalWorkArgs } from "../scripts/buildLexiconV3FrenchInternalWork.js";
import { buildFrenchHtmlTemplate } from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  assertFrenchInternalWorkBuild,
  assertFrenchInternalWorkViewHash,
  assertProposerABlindView,
  buildCanonicalRegistry,
  buildFrenchInternalEntityConstraints,
  buildFrenchInternalPublicationGate,
  buildFrenchInternalPilot,
  buildFrenchInternalShards,
  canonicalFrenchInternalWorkJson,
  extractFrenchInternalPilotViews,
  finalizeFrenchInternalView,
  FRENCH_INTERNAL_HISTORICAL_EN_1_BASELINE,
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  FRENCH_INTERNAL_WORK_VIEW_SCHEMA_VERSION,
  hashFrenchInternalWorkJson,
  type FrenchInternalProposerAView,
  type FrenchInternalProposerBView,
  type FrenchEditorialTermbaseRecord,
  type FrenchInternalEntityConstraints,
  type FrenchInternalWorkBuild,
  type FrenchInternalWorkStrata,
  type FrenchInternalWorkView
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import { type RequiredFrenchEntityMention } from "../src/lexiconV3/frenchEntityMentions.js";
import {
  FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION,
  FRENCH_PRETRANSLATION_POLICY_VERSION,
  type FrenchPretranslationAuditRecord
} from "../src/lexiconV3/frenchPretranslationQuality.js";

const HASH = "a".repeat(64);

test("keeps only entity lemmas green while preserving mention inflections", () => {
  const entryKey = "hebrew:H0033";
  const policy = {
    entryKey,
    primaryFr: "Abiézer",
    derivedFr: "Abiézerite",
    allowedFrenchForms: ["Abiézer", "Abiézerite", "Abiézerites", "Abiezrite"],
    entityBindings: [{ entityId: 7, relation: "gentilic" }],
    contentHash: hashText("policy")
  } as FrenchCanonicalEntryNamePolicy;
  const mention = {
    mentionId: "mention:1",
    sourceEntryKey: entryKey,
    segmentId: "meaning:0",
    sourceSurface: "Abiezrites",
    citedStrong: "H0033",
    targetEntryKey: entryKey,
    targetEntityIds: [7],
    allowedFrenchForms: ["Abiézerite", "Abiézerites"],
    resolution: "exact",
    contentHash: hashText("mention")
  } satisfies RequiredFrenchEntityMention;
  const canonicalEntity = {
    entityId: 7,
    primaryFr: "Abiézer"
  } as FrenchCanonicalEntityRecord;
  const constraints = buildFrenchInternalEntityConstraints({
    entryKey,
    canonicalEntryPolicyByKey: new Map([[entryKey, policy]]),
    canonicalEntityById: new Map([[7, canonicalEntity]]),
    quarantinedEntryKeys: new Set(),
    requiredMentions: [mention]
  });
  const termbase = {
    status: "red",
    canonicalFr: null,
    contentHash: hashText("termbase")
  } as FrenchEditorialTermbaseRecord;

  assert.deepEqual(
    buildCanonicalRegistry(termbase, constraints).map(
      (record) => record.canonicalFr
    ),
    ["Abiézer", "Abiézerite"]
  );
  assert.deepEqual(constraints.requiredMentions[0]?.allowedFrenchForms, [
    "Abiézerite",
    "Abiézerites"
  ]);
  assert.equal(
    buildCanonicalRegistry(
      termbase,
      constraints as FrenchInternalEntityConstraints
    ).some((record) => record.canonicalFr === "Abiézerites"),
    false
  );
  assert.equal(FRENCH_INTERNAL_WORK_POLICY_VERSION.endsWith("@6"), true);
});

test("keeps proposer A blind while exposing only green canonical French context", () => {
  const { workItems, proposerAViews } = fixtureViews(12);
  const blind = proposerAViews[0]!;
  const serialized = canonicalFrenchInternalWorkJson(blind);

  assert.doesNotThrow(() => assertProposerABlindView(blind));
  assert.match(serialized, /CANONIQUE_VERT_0/u);
  assert.doesNotMatch(serialized, /CANDIDAT_HISTORIQUE_0/u);
  assert.doesNotMatch(
    serialized,
    /existingFrench|resourceFrench|historicalCandidate|historicalFrench|legacyFrench|concordanceForms/u
  );
  assert.equal(
    blind.translationTask.htmlTemplate.sourceHtmlHash,
    rawSha256(workItems[0]!.english.meaningHtml)
  );
  assert.ok(
    blind.translationTask.htmlTemplate.tokens.some(
      (token) => token.kind === "text" && token.translatable
    )
  );

  const leaking = structuredClone(blind) as FrenchInternalProposerAView & {
    existingFrench?: unknown;
  };
  leaking.existingFrench = { meaning: "CANDIDAT_HISTORIQUE_0" };
  assert.throws(
    () => assertProposerABlindView(leaking),
    /french-internal-proposer-a-leak/u
  );
});

test("marks every proposer B French source as candidate-only and content-addresses it", () => {
  const { proposerBViews } = fixtureViews(4);
  const view = proposerBViews[0]!;

  assert.equal(view.candidateEvidence.trust, "untrusted-candidate");
  assert.equal(view.candidateEvidence.authoritative, false);
  assert.equal(
    view.candidateEvidence.packet.existingFrench?.trust,
    "untrusted-candidate"
  );
  assert.deepEqual(view.candidateEvidence.packet.resourceFrench, []);
  assert.equal(
    view.candidateEvidence.packet.concordanceForms.length <= 20,
    true
  );
  assert.equal(view.candidateEvidence.editorial.historicalFrench, null);
  assert.equal(view.candidateEvidence.editorial.legacyFrench, null);
  assert.deepEqual(view.candidateEvidence.editorial.concordanceForms, []);
  const { evidenceHash, ...candidateContent } = view.candidateEvidence;
  assert.equal(hashFrenchInternalWorkJson(candidateContent), evidenceHash);
  assert.doesNotThrow(() => assertFrenchInternalWorkViewHash(view));
});

test("detects view drift even when the entry key and parent lineage remain unchanged", () => {
  const { proposerAViews } = fixtureViews(2);
  const tampered = structuredClone(proposerAViews[0]!);
  tampered.english.gloss = "tampered English";

  assert.throws(
    () => assertFrenchInternalWorkViewHash(tampered, "proposer-a"),
    /french-internal-work-proposer-a-view-hash/u
  );
  assert.equal(
    canonicalFrenchInternalWorkJson({ z: 1, a: { y: 2, x: 1 } }),
    canonicalFrenchInternalWorkJson({ a: { x: 1, y: 2 }, z: 1 })
  );
});

test("refuses mixed .1/.2 release lineage even when every changed view is rehashed", () => {
  const { workItems, proposerAViews, proposerBViews } = fixtureViews(4);
  const mixed = structuredClone(proposerBViews[0]!);
  mixed.lineage.releaseKey = "fixture-release.2";
  const rehashed = finalizeFrenchInternalView(
    mixed as unknown as Record<string, unknown>
  ) as unknown as FrenchInternalProposerBView;
  assert.throws(
    () =>
      buildFrenchInternalPilot(
        workItems,
        proposerAViews,
        [rehashed, ...proposerBViews.slice(1)],
        HASH,
        2
      ),
    /french-internal-entry-lineage-mismatch|french-internal-pilot-release-lineage-mismatch/u
  );
});

test("keeps a review-needed pretranslation entry agent-eligible but forbids direct publication", () => {
  const audit: FrenchPretranslationAuditRecord = {
    schemaVersion: FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_PRETRANSLATION_POLICY_VERSION,
    entryKey: "greek:G0001",
    packetHash: "1".repeat(64),
    englishHash: "2".repeat(64),
    englishStatus: "validated",
    gateStatus: "review_needed",
    translationAllowed: true,
    autoPublicationAllowed: false,
    exactStepIdentity: {
      eStrong: "G0001",
      dStrong: "G0001 =",
      uStrong: "G0001",
      isSubStep: false
    },
    englishGlossPunctuationAttestation: null,
    issues: [
      {
        code: "english-gloss-terminal-punctuation",
        status: "review_needed",
        field: "english.gloss",
        message: "fixture review"
      }
    ],
    sourceRepairContext: null
  };
  const gate = buildFrenchInternalPublicationGate(audit);
  assert.equal(gate.translationAllowed, true);
  assert.equal(gate.autoPublicationAllowed, false);
  assert.equal(gate.fourAgentReviewRequired, true);
  assert.equal(gate.directPublicationAllowed, false);
  assert.throws(
    () =>
      buildFrenchInternalPublicationGate({
        ...audit,
        autoPublicationAllowed: true
      }),
    /french-internal-pretranslation-gate/u
  );
});

test("selects exactly 300 deterministic pilot keys across every required stratum", () => {
  const { workItems, proposerAViews, proposerBViews } = fixtureViews(360);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("network-forbidden");
  }) as typeof globalThis.fetch;
  try {
    const first = buildFrenchInternalPilot(
      workItems,
      proposerAViews,
      proposerBViews,
      HASH,
      300
    );
    const second = buildFrenchInternalPilot(
      workItems,
      proposerAViews,
      proposerBViews,
      HASH,
      300
    );

    assert.equal(fetchCalls, 0);
    assert.equal(first.keys.length, 300);
    assert.equal(first.selections.length, 300);
    assert.equal(new Set(first.keys).size, 300);
    assert.deepEqual(first.keys, [...first.keys].sort());
    assert.equal(first.contentHash, second.contentHash);
    assert.deepEqual(first.keys, second.keys);
    assert.ok((first.strataCounts.languages.greek ?? 0) >= 40);
    assert.ok((first.strataCounts.languages.hebrew ?? 0) >= 40);
    for (const cohort of ["unchanged", "step_specific_only", "other_changed"]) {
      assert.ok((first.strataCounts.meaningCohorts[cohort] ?? 0) >= 30);
    }
    assert.ok((first.strataCounts.properNames.true ?? 0) >= 30);
    assert.ok((first.strataCounts.theological.true ?? 0) >= 20);
    for (const category of [
      "absent",
      "normalized_equivalent",
      "normalized_divergent"
    ]) {
      assert.ok((first.strataCounts.legacyHtmlCategories[category] ?? 0) >= 15);
    }
    for (const size of ["short", "medium", "long", "very_long"]) {
      assert.ok((first.strataCounts.meaningSizes[size] ?? 0) >= 15);
    }
    const { contentHash, ...content } = first;
    assert.equal(hashFrenchInternalWorkJson(content), contentHash);
    for (const selection of first.selections) {
      const { selectionHash, ...selectionContent } = selection;
      assert.equal(hashFrenchInternalWorkJson(selectionContent), selectionHash);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("extracts the exact pilot A and B views in pilot-key order", () => {
  const { workItems, proposerAViews, proposerBViews } = fixtureViews(360);
  const pilot = buildFrenchInternalPilot(
    workItems,
    proposerAViews,
    proposerBViews,
    HASH,
    300
  );
  const extracted = extractFrenchInternalPilotViews(
    pilot,
    proposerAViews,
    proposerBViews
  );

  assert.deepEqual(
    extracted.proposerAViews.map((view) => view.entryKey),
    pilot.keys
  );
  assert.deepEqual(
    extracted.proposerBViews.map((view) => view.entryKey),
    pilot.keys
  );
  for (let index = 0; index < pilot.selections.length; index += 1) {
    assert.equal(
      extracted.proposerAViews[index]!.viewHash,
      pilot.selections[index]!.proposerAViewHash
    );
    assert.equal(
      extracted.proposerBViews[index]!.viewHash,
      pilot.selections[index]!.proposerBViewHash
    );
  }

  const drifted = structuredClone(pilot);
  drifted.selections[0]!.proposerAViewHash = HASH;
  assert.throws(
    () =>
      extractFrenchInternalPilotViews(drifted, proposerAViews, proposerBViews),
    /french-internal-pilot-extraction-plan-invalid/u
  );
});

test("builds resumable shards with progressively smaller long-notice batches", () => {
  const { workItems, proposerAViews, proposerBViews } = fixtureViews(360);
  const plan = buildFrenchInternalShards(
    workItems,
    proposerAViews,
    proposerBViews,
    HASH
  );

  assert.deepEqual(plan.batchSizes, {
    short: 40,
    medium: 30,
    long: 16,
    very_long: 8
  });
  assert.equal(
    plan.shards.reduce((total, shard) => total + shard.items.length, 0),
    360
  );
  assert.equal(
    new Set(
      plan.shards.flatMap((shard) => shard.items.map((item) => item.entryKey))
    ).size,
    360
  );
  for (const shard of plan.shards) {
    assert.ok(shard.items.length <= plan.batchSizes[shard.meaningSize]);
    const { shardHash, ...shardContent } = shard;
    assert.equal(hashFrenchInternalWorkJson(shardContent), shardHash);
    for (const item of shard.items) {
      const { itemHash, ...itemContent } = item;
      assert.equal(hashFrenchInternalWorkJson(itemContent), itemHash);
    }
  }
  const { contentHash, ...content } = plan;
  assert.equal(hashFrenchInternalWorkJson(content), contentHash);
});

test("fails closed on pilot, role, and total cardinality drift", () => {
  const { workItems, proposerAViews, proposerBViews } = fixtureViews(320);
  assert.throws(
    () =>
      buildFrenchInternalPilot(
        workItems,
        proposerAViews,
        proposerBViews,
        HASH,
        321
      ),
    /french-internal-pilot-size-invalid/u
  );
  assert.throws(
    () =>
      buildFrenchInternalShards(
        workItems,
        proposerAViews.slice(1),
        proposerBViews,
        HASH
      ),
    /french-internal-work-shard-a-missing/u
  );
  assert.throws(
    () =>
      assertFrenchInternalWorkBuild(
        {
          workItems,
          proposerAViews: proposerAViews.slice(1),
          proposerBViews,
          pilot: {} as FrenchInternalWorkBuild["pilot"],
          shards: {} as FrenchInternalWorkBuild["shards"],
          summary: {} as FrenchInternalWorkBuild["summary"]
        },
        { expectedEntryCount: 320, expectedPilotSize: 300 }
      ),
    /french-internal-work-output-cardinality-invalid/u
  );
});

test("uses only the fresh internal packet defaults and fixes the pilot at 300", () => {
  const options = parseFrenchInternalWorkArgs([]);

  assert.equal(
    options.sourcePaths.packets,
    resolve("outputs/lexicon-v3/fr-internal/french-packets.jsonl")
  );
  assert.equal(
    options.sourcePaths.packetSummary,
    resolve("outputs/lexicon-v3/fr-internal/french-packets.summary.json")
  );
  assert.equal(
    options.sourcePaths.entityMergeAttestation,
    resolve(
      "outputs/lexicon-v3/french-entities/resolved/entity-merge-attestation.json"
    )
  );
  assert.equal(
    options.outputPaths.workItems,
    resolve("outputs/lexicon-v3/fr-internal/work/work-items.jsonl")
  );
  assert.equal(FRENCH_INTERNAL_HISTORICAL_EN_1_BASELINE.expectedPilotSize, 300);
  assert.equal(
    FRENCH_INTERNAL_HISTORICAL_EN_1_BASELINE.packetOutputDigest,
    "fa4bba35ce884008daacac97c6c1c55f4c4f29bc12cad1a2da9a9f8044ab7b63"
  );
  assert.throws(
    () => parseFrenchInternalWorkArgs(["--packets"]),
    /french-internal-work-missing-option-value:packets/u
  );
  assert.throws(
    () => parseFrenchInternalWorkArgs(["--network", "on"]),
    /french-internal-work-unknown-option:network/u
  );
});

function fixtureViews(count: number): {
  workItems: FrenchInternalWorkView[];
  proposerAViews: FrenchInternalProposerAView[];
  proposerBViews: FrenchInternalProposerBView[];
} {
  const workItems: FrenchInternalWorkView[] = [];
  const proposerAViews: FrenchInternalProposerAView[] = [];
  const proposerBViews: FrenchInternalProposerBView[] = [];
  for (let index = 0; index < count; index += 1) {
    const entryKey = `${index % 2 === 0 ? "greek:G" : "hebrew:H"}${String(
      index + 1
    ).padStart(4, "0")}`;
    const meaningSize = ["short", "medium", "long", "very_long"][
      index % 4
    ] as FrenchInternalWorkStrata["meaningSize"];
    const meaningLength = {
      short: 120,
      medium: 500,
      long: 1_200,
      very_long: 2_100
    }[meaningSize];
    const meaning = `English meaning ${index} ${"x".repeat(meaningLength)}`;
    const meaningHtml = `<p>${meaning}</p>`;
    const meaningHtmlHash = rawSha256(meaningHtml);
    const strata: FrenchInternalWorkStrata = {
      language: index % 2 === 0 ? "greek" : "hebrew",
      meaningCohort: ["unchanged", "step_specific_only", "other_changed"][
        index % 3
      ] as FrenchInternalWorkStrata["meaningCohort"],
      pos: index % 5 === 0 ? "proper-name" : index % 2 === 0 ? "verb" : "noun",
      properName: index % 5 === 0,
      theological: index % 9 === 0,
      legacyHtmlCategory: [
        "absent",
        "normalized_equivalent",
        "normalized_divergent"
      ][index % 3] as FrenchInternalWorkStrata["legacyHtmlCategory"],
      meaningSize,
      riskCategories: [
        ["baseline"],
        ["protected-content"],
        ["sub-step-boundary", "historical-french-risk"],
        ["long-notice"]
      ][index % 4]!
    };
    const lineage = {
      sourceLogicalDigest: HASH,
      packetHash: hashText(`packet-${index}`),
      englishHash: hashText(`english-${index}`),
      reuseRecordDigest: hashText(`reuse-${index}`),
      releaseKey: "fixture-release",
      releaseSnapshotFingerprint: HASH,
      glossParentContentHash: hashText(`gloss-parent-${index}`),
      meaningParentContentHash: meaningHtmlHash,
      termbaseContentHash: hashText(`termbase-${index}`),
      entityContentHash: strata.properName ? hashText(`entity-${index}`) : null,
      morphologyContentHashes: [hashText(`morphology-${index % 2}`)],
      editorialSummaryContentHash: HASH,
      guideSourceDigest: HASH
    };
    const identity = {
      stepEntryId: index + 1,
      language: strata.language,
      eStrong: entryKey.slice(entryKey.indexOf(":") + 1),
      dStrong: `${entryKey.slice(entryKey.indexOf(":") + 1)} =`,
      uStrong: entryKey.slice(entryKey.indexOf(":") + 1),
      original: strata.language === "greek" ? "λόγος" : "דָּבָר",
      transliteration: `fixture-${index}`,
      morph: strata.pos === "proper-name" ? "N:N-M-P" : "G:V"
    } as const;
    const english = {
      contentHash: lineage.englishHash,
      status: "validated" as const,
      gloss: `English gloss ${index}`,
      meaning,
      meaningHtml,
      sources: ["fixture"],
      issues: []
    };
    const guide = {
      schemaVersion: "lexicon-v3-french-editorial-guide@1" as const,
      locale: "fr" as const,
      releaseRule: "Toute divergence bloque la publication.",
      style: { register: "français lexicographique" }
    };
    const work = finalizeFrenchInternalView({
      schemaVersion: FRENCH_INTERNAL_WORK_VIEW_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      viewKind: "full" as const,
      entryKey,
      lineage,
      identity,
      english,
      sourceEvidence: {
        occurrenceGlosses: [],
        concordanceForms: [],
        legacy: {
          gloss: `LEGACY_FR_${index}`,
          meaning: `LEGACY_MEANING_FR_${index}`,
          source: "fixture",
          sourceHash: HASH
        },
        existingFrench: {
          gloss: `CANDIDAT_HISTORIQUE_${index}`,
          meaning: `SENS_HISTORIQUE_${index}`,
          meaningHtml: `<p>SENS_HISTORIQUE_${index}</p>`,
          source: "fixture",
          sourceHash: HASH,
          trust: "untrusted-candidate" as const
        },
        resourceFrench: [
          {
            gloss: `RESOURCE_FR_${index}`,
            meaning: `RESOURCE_MEANING_FR_${index}`,
            meaningHtml: `<p>RESOURCE_MEANING_FR_${index}</p>`,
            source: "fixture-resource",
            sourceHash: HASH,
            trust: "untrusted-candidate" as const
          }
        ]
      },
      protectedContent: {
        strongCodes: [],
        references: [],
        originalTokens: [identity.original]
      },
      reuse: {} as never,
      editorial: {
        termbase: {} as never,
        entity: null,
        morphology: []
      },
      guide,
      guideContentHash: hashFrenchInternalWorkJson(guide),
      legacyHtmlNormalization: null,
      strata
    }) as unknown as FrenchInternalWorkView;
    const common = {
      schemaVersion: FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      entryKey,
      workViewHash: work.viewHash,
      lineage,
      identity,
      english,
      protectedContent: work.protectedContent,
      translationTask: {
        locale: "fr" as const,
        outputFields: [
          "glossFr",
          "meaningSegmentsFr",
          "notesFr",
          "carrierTermsFr"
        ] as const,
        htmlRule: "translate-text-segments-only-html-rebuilt-locally" as const,
        identityRule:
          "translate-exact-step-entry-never-generalize-to-classical-strong" as const,
        htmlTemplate: buildFrenchHtmlTemplate(meaningHtml)
      },
      guide,
      guideContentHash: hashFrenchInternalWorkJson(guide),
      canonicalRegistry: strata.properName
        ? [
            {
              kind: "entity" as const,
              status: "green" as const,
              canonicalFr: `CANONIQUE_VERT_${index}`,
              sourceContentHash: hashText(`canonical-${index}`)
            }
          ]
        : [],
      morphology: [],
      translationProfile: {
        pos: strata.pos,
        properName: strata.properName,
        theological: strata.theological,
        meaningCohort: strata.meaningCohort,
        meaningSize: strata.meaningSize,
        englishRiskCategories: strata.riskCategories.filter(
          (category) => !category.includes("historical")
        )
      }
    };
    const proposerA = finalizeFrenchInternalView({
      ...common,
      viewKind: "proposer_a_blind" as const,
      role: "proposerA" as const,
      evidencePolicy: {
        mode: "blind-independent-translation" as const,
        frenchEntryCandidatesExposed: false as const,
        allowedFrenchContext: [
          "editorial-guide",
          "green-canonical-registry",
          "morphology-registry"
        ] as const
      }
    }) as unknown as FrenchInternalProposerAView;
    const candidateContent = {
      trust: "untrusted-candidate" as const,
      authoritative: false as const,
      usage:
        "compare-diagnose-never-copy-without-independent-validation" as const,
      packet: {
        legacy: {
          ...work.sourceEvidence.legacy!,
          trust: "untrusted-candidate" as const
        },
        existingFrench: {
          ...work.sourceEvidence.existingFrench!,
          sourceTrust: "untrusted-candidate" as const,
          trust: "untrusted-candidate" as const
        },
        resourceFrench: [],
        concordanceForms: []
      },
      editorial: {
        entityCandidates: null,
        historicalFrench: null,
        legacyFrench: null,
        concordanceForms: [],
        deterministicRepairCandidate: null
      },
      normalizedLegacyHtml: null
    };
    const proposerB = finalizeFrenchInternalView({
      ...common,
      viewKind: "proposer_b_candidates" as const,
      role: "proposerB" as const,
      evidencePolicy: {
        mode: "candidate-aware-independent-review" as const,
        candidatesAreAuthority: false as const,
        requireEnglishSemanticJustification: true as const
      },
      candidateEvidence: {
        ...candidateContent,
        evidenceHash: hashFrenchInternalWorkJson(candidateContent)
      }
    }) as unknown as FrenchInternalProposerBView;
    workItems.push(work);
    proposerAViews.push(proposerA);
    proposerBViews.push(proposerB);
  }
  return { workItems, proposerAViews, proposerBViews };
}

function hashText(value: string): string {
  return hashFrenchInternalWorkJson(value);
}

function rawSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
