import assert from "node:assert/strict";
import test from "node:test";

import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  assertFrenchInternalReviewRecord,
  buildFrenchInternalAgentProof,
  buildFrenchInternalCarrierTerms,
  canonicalFrenchInternalJson,
  evaluateFrenchInternalReview,
  finalizeFrenchInternalExecutionAttestation,
  finalizeFrenchInternalExecutionReceipt,
  finalizeFrenchInternalReviewRecord,
  finalizeFrenchInternalSiblingConsistencyProof,
  FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION,
  FRENCH_INTERNAL_PROMPT_VERSION,
  FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
  FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION,
  frenchInternalArbiterDependencies,
  frenchInternalArbiterResponsePayload,
  frenchInternalAuditorDependencies,
  frenchInternalGenerationConfigHash,
  hashFrenchInternalJson,
  rebuildFrenchInternalSiblingConsistency,
  type FrenchInternalAgentProof,
  type FrenchInternalAudit,
  type FrenchInternalExecutionReceipt,
  type FrenchInternalReviewConfiguration,
  type FrenchInternalReviewRecord,
  type FrenchInternalReviewStatus
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  validateFrenchProposal
} from "../src/lexiconV3/frenchValidation.js";
import {
  buildFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import { frenchPacketFixtureEnglishRelease } from "./lexiconV3FrenchPacketFixture.js";

test("accepts a fully linked four-agent internal review without Gateway proof", () => {
  const fixture = reviewFixture();
  const evaluation = evaluateFrenchInternalReview({
    record: fixture.record,
    packet: fixture.packet,
    expectedGenerationConfigHash: fixture.record.generationConfigHash
  });

  assert.equal(
    evaluation.structurallyValid,
    true,
    JSON.stringify({
      structural: evaluation.structuralIssues,
      automatic: evaluation.autoEligibilityIssues,
      validationA: evaluation.validationA,
      validationB: evaluation.validationB,
      finalValidation: evaluation.finalValidation
    })
  );
  assert.equal(evaluation.autoEligible, true);
  assert.deepEqual(evaluation.structuralIssues, []);
  assert.deepEqual(evaluation.autoEligibilityIssues, []);
  assert.equal(evaluation.carrierTerms[0]?.state, "auto_validated");
  assert.equal(
    evaluation.carrierTerms[0]?.reason,
    "two-agent-agreement-final-selection-and-two-witness-families"
  );
  assert.doesNotThrow(() =>
    assertFrenchInternalReviewRecord({
      record: fixture.record,
      packet: fixture.packet,
      expectedGenerationConfigHash: fixture.record.generationConfigHash
    })
  );
});

test("fails closed when an entity-first configuration hash is absent", () => {
  const fixture = reviewFixture();
  const configuration = {
    ...fixture.record.configuration
  } as Partial<FrenchInternalReviewConfiguration>;
  delete configuration.entityMentionsHash;
  const generationConfigHash = frenchInternalGenerationConfigHash(
    configuration as FrenchInternalReviewConfiguration
  );
  const withoutHash = {
    ...withoutArtifactHash(fixture.record),
    configuration: configuration as FrenchInternalReviewConfiguration,
    generationConfigHash
  };
  const record: FrenchInternalReviewRecord = {
    ...withoutHash,
    artifactHash: hashFrenchInternalJson(withoutHash)
  };
  const evaluation = evaluateFrenchInternalReview({
    record,
    packet: fixture.packet,
    expectedGenerationConfigHash: generationConfigHash
  });

  assert.equal(evaluation.structurallyValid, false);
  assert.ok(
    evaluation.structuralIssues.includes("invalid-review-configuration-keys")
  );
});

test("uses canonical hashes and detects a changed agent response", () => {
  assert.equal(
    canonicalFrenchInternalJson({ b: 2, a: { d: 4, c: 3 } }),
    canonicalFrenchInternalJson({ a: { c: 3, d: 4 }, b: 2 })
  );
  assert.equal(
    hashFrenchInternalJson({ b: 2, a: 1 }),
    hashFrenchInternalJson({ a: 1, b: 2 })
  );

  const fixture = reviewFixture();
  const changedProposal = {
    ...fixture.record.proposalA!,
    notesFr: "Réponse altérée après la preuve."
  };
  const tampered = finalizeFrenchInternalReviewRecord({
    ...withoutArtifactHash(fixture.record),
    proposalA: changedProposal
  });
  const evaluation = evaluateFrenchInternalReview({
    record: tampered,
    packet: fixture.packet
  });

  assert.equal(evaluation.structurallyValid, false);
  assert.ok(
    evaluation.structuralIssues.includes(
      "proposerA:proof-response-hash-mismatch"
    )
  );
  assert.throws(
    () =>
      assertFrenchInternalReviewRecord({
        record: tampered,
        packet: fixture.packet
      }),
    /proof-response-hash-mismatch/u
  );
});

test("refuses an arbiter translation that is not exactly proposal A or B", () => {
  const fixture = reviewFixture({
    finalProposal: {
      glossFr: "terme",
      meaningFr: "Un λόγος désigne ici un terme.",
      meaningHtmlFr: "<p>Un <b>λόγος</b> désigne ici un terme.</p>",
      carrierTermsFr: []
    }
  });
  const evaluation = evaluateFrenchInternalReview({
    record: fixture.record,
    packet: fixture.packet
  });

  assert.equal(evaluation.structurallyValid, false);
  assert.ok(
    evaluation.structuralIssues.includes("arbiter-invented-third-proposal")
  );
  assert.ok(
    evaluation.structuralIssues.includes("unsafe-auto-validated-status")
  );
});

test("keeps an auditor hold structurally valid but never auto-eligible", () => {
  const fixture = reviewFixture({
    status: "review_needed",
    audit: {
      verdict: "hold",
      reasons: ["terminologie à reprendre"],
      confidence: 0.96
    }
  });
  const evaluation = evaluateFrenchInternalReview({
    record: fixture.record,
    packet: fixture.packet
  });

  assert.equal(evaluation.structurallyValid, true);
  assert.equal(evaluation.autoEligible, false);
  assert.ok(evaluation.autoEligibilityIssues.includes("auditor-not-safe"));
  assert.ok(
    evaluation.autoEligibilityIssues.includes("auditor-has-reservations")
  );
});

test("requires four distinct agent identities and task names", () => {
  const fixture = reviewFixture({ sharedAgentIdentity: true });
  const evaluation = evaluateFrenchInternalReview({
    record: fixture.record,
    packet: fixture.packet
  });

  assert.equal(evaluation.structurallyValid, false);
  assert.ok(
    evaluation.structuralIssues.includes("agent-identities-not-distinct")
  );
  assert.ok(evaluation.structuralIssues.includes("agent-tasks-not-distinct"));
});

test("rejects a self-rehashed receipt that downgrades the approved model", () => {
  const fixture = reviewFixture();
  const attestation = fixture.record.executionAttestation!;
  const original = attestation.roleReceipts.proposerA;
  const { receiptHash: _receiptHash, ...receiptContent } = original;
  void _receiptHash;
  const downgraded = finalizeFrenchInternalExecutionReceipt({
    ...receiptContent,
    model: "cheap-unapproved-model"
  });
  const { attestationHash: _attestationHash, ...attestationContent } =
    attestation;
  void _attestationHash;
  const record = finalizeFrenchInternalReviewRecord({
    ...withoutArtifactHash(fixture.record),
    executionAttestation: finalizeFrenchInternalExecutionAttestation({
      ...attestationContent,
      roleReceipts: {
        ...attestation.roleReceipts,
        proposerA: downgraded
      }
    }),
    status: "review_needed"
  });
  const evaluation = evaluateFrenchInternalReview({
    record,
    packet: fixture.packet
  });
  assert.equal(evaluation.structurallyValid, false);
  assert.ok(
    evaluation.structuralIssues.includes("execution-profile-mismatch:proposerA")
  );
});

test("pins the style, termbase and prompt configuration supplied by authoring", () => {
  const fixture = reviewFixture({ status: "review_needed" });
  const evaluation = evaluateFrenchInternalReview({
    record: fixture.record,
    packet: fixture.packet,
    expectedGenerationConfigHash: "f".repeat(64)
  });

  assert.equal(evaluation.structurallyValid, false);
  assert.ok(
    evaluation.structuralIssues.includes("unexpected-generation-config-hash")
  );
});

test("checks HTML structure and every protected original token independently", () => {
  const fixture = reviewFixture({
    status: "review_needed",
    proposalA: {
      meaningFr: "Une parole signifie un mot.",
      meaningHtmlFr: "<p>Une parole signifie un mot.</p>"
    },
    proposalB: {
      meaningFr: "Une parole signifie un mot.",
      meaningHtmlFr: "<p>Une parole signifie un mot.</p>"
    }
  });
  const evaluation = evaluateFrenchInternalReview({
    record: fixture.record,
    packet: fixture.packet
  });

  assert.equal(evaluation.structurallyValid, true);
  assert.equal(evaluation.autoEligible, false);
  assert.ok(
    evaluation.autoEligibilityIssues.includes("html-skeleton-mismatch")
  );
  assert.ok(
    evaluation.autoEligibilityIssues.includes(
      "missing-protected-original-token"
    )
  );
});

test("accepts the local STEP legacy-tag normalization but not a changed HTML skeleton", () => {
  const packet = frenchLegacyHtmlPacket();
  const meaningFr = "λόγος signifie IVe s. Auteur.";
  const meaningHtmlFr =
    "<span><span><b>λόγος</b></span> signifie <span>IVe s.</span> <span>Auteur</span>.</span>";
  const normalized = reviewFixture({
    packet,
    status: "review_needed",
    proposalA: { meaningFr, meaningHtmlFr },
    proposalB: { meaningFr, meaningHtmlFr }
  });
  const normalizedEvaluation = evaluateFrenchInternalReview({
    record: normalized.record,
    packet
  });
  assert.equal(
    normalizedEvaluation.autoEligibilityIssues.includes(
      "html-skeleton-mismatch"
    ),
    false
  );

  const changed = reviewFixture({
    packet,
    status: "review_needed",
    proposalA: {
      meaningFr,
      meaningHtmlFr: "<span><b>λόγος</b> signifie IVe s. Auteur.</span>"
    },
    proposalB: {
      meaningFr,
      meaningHtmlFr: "<span><b>λόγος</b> signifie IVe s. Auteur.</span>"
    }
  });
  const changedEvaluation = evaluateFrenchInternalReview({
    record: changed.record,
    packet
  });
  assert.equal(
    changedEvaluation.autoEligibilityIssues.includes("html-skeleton-mismatch"),
    true
  );
});

test("recomputes STEP sub-entry siblings globally and holds divergent French", () => {
  const first = reviewFixture();
  const secondPacket = frenchSiblingPacket();
  const second = reviewFixture({
    packet: secondPacket,
    status: "review_needed",
    proposalA: {
      glossFr: "mot",
      meaningFr: "Un λόγος signifie un mot.",
      meaningHtmlFr: "<p>Un <b>λόγος</b> signifie un mot.</p>",
      carrierTermsFr: ["mot"]
    },
    proposalB: {
      glossFr: "mot",
      meaningFr: "Un λόγος signifie un mot.",
      meaningHtmlFr: "<p>Un <b>λόγος</b> signifie un mot.</p>",
      carrierTermsFr: ["mot"]
    }
  });
  const rebuilt = rebuildFrenchInternalSiblingConsistency({
    packets: [first.packet, second.packet],
    records: [first.record, second.record]
  });
  assert.equal(rebuilt.length, 2);
  for (const record of rebuilt) {
    assert.equal(record.status, "review_needed");
    assert.equal(record.siblingConsistency?.verdict, "divergent");
    assert.deepEqual(record.siblingConsistency?.memberEntryKeys, [
      "greek:G3056",
      "greek:G3056A"
    ]);
    assert.ok(record.issues.some((issue) => issue.startsWith("sibling-")));
  }
});

interface ReviewFixtureOptions {
  packet?: LexiconV3FrenchPacket;
  status?: FrenchInternalReviewStatus;
  proposalA?: Partial<FrenchLexiconProposal>;
  proposalB?: Partial<FrenchLexiconProposal>;
  finalProposal?: Partial<FrenchLexiconProposal>;
  audit?: Partial<Omit<FrenchInternalAudit, "checks">> & {
    checks?: Partial<FrenchInternalAudit["checks"]>;
  };
  sharedAgentIdentity?: boolean;
}

function reviewFixture(options: ReviewFixtureOptions = {}): {
  packet: LexiconV3FrenchPacket;
  record: FrenchInternalReviewRecord;
} {
  const packet = options.packet ?? frenchPacket();
  const configuration = frenchConfiguration();
  const generationConfigHash =
    frenchInternalGenerationConfigHash(configuration);
  const proposalA = proposal(packet, "internal-agent/proposer-a", {
    derivedFromEnglishHash: packet.english.contentHash,
    ...options.proposalA
  });
  const proposalB = proposal(packet, "internal-agent/proposer-b", {
    derivedFromEnglishHash: packet.english.contentHash,
    ...options.proposalB
  });
  const finalProposal = options.finalProposal
    ? proposal(packet, "internal-agent/arbiter-third", {
        derivedFromEnglishHash: packet.english.contentHash,
        ...options.finalProposal
      })
    : proposalA;
  const context = validationContext(packet);
  const validationA = validateFrenchProposal(proposalA, context);
  const validationB = validateFrenchProposal(proposalB, context);
  const finalValidation = validateFrenchProposal(finalProposal, context);
  const arbiter = {
    verdict: "accept" as const,
    selectedProposal: "proposalA" as const,
    reasons: [],
    proposal: finalProposal,
    validation: finalValidation
  };
  const { checks: auditCheckOverrides, ...auditOverrides } =
    options.audit ?? {};
  const audit: FrenchInternalAudit = {
    verdict: "safe",
    reasons: [],
    confidence: 0.97,
    ...auditOverrides,
    checks: {
      ...passingAuditChecks(),
      ...auditCheckOverrides
    }
  };
  const common = {
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash
  };
  const threadIds = {
    proposerA: "00000000-0000-4000-8000-000000000001",
    proposerB: "00000000-0000-4000-8000-000000000002",
    arbiter: "00000000-0000-4000-8000-000000000003",
    auditor: "00000000-0000-4000-8000-000000000004"
  } as const;
  const identity = (
    role: keyof typeof threadIds
  ): { agentId: string; taskName: string; threadId: string } => {
    const threadId = options.sharedAgentIdentity
      ? threadIds.proposerA
      : threadIds[role];
    return {
      agentId: `codex-agent:${threadId}`,
      taskName: options.sharedAgentIdentity ? "/root/shared" : `/root/${role}`,
      threadId
    };
  };
  const receiptA = syntheticReceipt({
    role: "proposerA",
    ...identity("proposerA"),
    entryKey: packet.entryKey,
    inputHash: "1".repeat(64),
    completedAt: "2026-07-13T10:00:00.000Z"
  });
  const receiptB = syntheticReceipt({
    role: "proposerB",
    ...identity("proposerB"),
    entryKey: packet.entryKey,
    inputHash: "2".repeat(64),
    completedAt: "2026-07-13T10:01:00.000Z"
  });
  const receiptArbiter = syntheticReceipt({
    role: "arbiter",
    ...identity("arbiter"),
    entryKey: packet.entryKey,
    inputHash: "3".repeat(64),
    completedAt: "2026-07-13T10:02:00.000Z"
  });
  const receiptAuditor = syntheticReceipt({
    role: "auditor",
    ...identity("auditor"),
    entryKey: packet.entryKey,
    inputHash: "4".repeat(64),
    completedAt: "2026-07-13T10:03:00.000Z"
  });
  const proofA = buildFrenchInternalAgentProof({
    role: "proposerA",
    ...common,
    inputHash: "1".repeat(64),
    executionReceiptHash: receiptA.receiptHash,
    agentId: receiptA.agentId,
    taskName: receiptA.taskName,
    response: proposalA,
    completedAt: "2026-07-13T10:00:00.000Z"
  });
  const proofB = buildFrenchInternalAgentProof({
    role: "proposerB",
    ...common,
    inputHash: "2".repeat(64),
    executionReceiptHash: receiptB.receiptHash,
    agentId: receiptB.agentId,
    taskName: receiptB.taskName,
    response: proposalB,
    completedAt: "2026-07-13T10:01:00.000Z"
  });
  const proofArbiter = buildFrenchInternalAgentProof({
    role: "arbiter",
    ...common,
    inputHash: "3".repeat(64),
    executionReceiptHash: receiptArbiter.receiptHash,
    agentId: receiptArbiter.agentId,
    taskName: receiptArbiter.taskName,
    dependencies: frenchInternalArbiterDependencies(proofA, proofB),
    response: frenchInternalArbiterResponsePayload(arbiter),
    completedAt: "2026-07-13T10:02:00.000Z"
  });
  const proofAuditor = buildFrenchInternalAgentProof({
    role: "auditor",
    ...common,
    inputHash: "4".repeat(64),
    executionReceiptHash: receiptAuditor.receiptHash,
    agentId: receiptAuditor.agentId,
    taskName: receiptAuditor.taskName,
    dependencies: frenchInternalAuditorDependencies({
      proposerA: proofA,
      proposerB: proofB,
      arbiter: proofArbiter,
      arbitration: arbiter
    }),
    response: audit,
    completedAt: "2026-07-13T10:03:00.000Z"
  });
  const proofs: Record<
    "proposerA" | "proposerB" | "arbiter" | "auditor",
    FrenchInternalAgentProof
  > = {
    proposerA: proofA,
    proposerB: proofB,
    arbiter: proofArbiter,
    auditor: proofAuditor
  };
  const carrierTerms = buildFrenchInternalCarrierTerms(
    proposalA,
    proposalB,
    finalProposal,
    context
  );
  const record = finalizeFrenchInternalReviewRecord({
    schemaVersion: FRENCH_INTERNAL_REVIEW_SCHEMA_VERSION,
    reviewMode: "internal_agents",
    policyVersion: FRENCH_INTERNAL_REVIEW_POLICY_VERSION,
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash,
    configuration,
    status: options.status ?? "auto_validated",
    proposalA,
    proposalB,
    validationA,
    validationB,
    arbiter,
    auditor: audit,
    agentProofs: proofs,
    executionAttestation: finalizeFrenchInternalExecutionAttestation({
      schemaVersion: FRENCH_INTERNAL_EXECUTION_ATTESTATION_SCHEMA_VERSION,
      namespace: "/fr-internal/pilot",
      releaseKey: packet.englishRelease.releaseKey,
      releaseSnapshotFingerprint:
        packet.englishRelease.releaseSnapshotFingerprint,
      selectionHash: "5".repeat(64),
      keyOrderHash: "6".repeat(64),
      proposerManifestHash: "7".repeat(64),
      proposerSummaryHash: "8".repeat(64),
      arbiterManifestHash: "9".repeat(64),
      arbiterSummaryHash: "a".repeat(64),
      auditorManifestHash: "b".repeat(64),
      auditorSummaryHash: "c".repeat(64),
      executionReceiptsDigest: "d".repeat(64),
      adjudicationSummaryHash: "e".repeat(64),
      roleReceipts: {
        proposerA: receiptA,
        proposerB: receiptB,
        arbiter: receiptArbiter,
        auditor: receiptAuditor
      }
    }),
    siblingConsistency: finalizeFrenchInternalSiblingConsistencyProof({
      schemaVersion: "lexicon-v3-french-sibling-consistency-proof@1",
      familyKey: "greek:G3056",
      entryKey: packet.entryKey,
      memberEntryKeys: [packet.entryKey],
      familyInputDigest: hashFrenchInternalJson([packet.entryKey]),
      verdict: "consistent",
      issues: []
    }),
    carrierTerms,
    issues: [],
    generatedAt: "2026-07-13T10:04:00.000Z"
  });
  return { packet, record };
}

function syntheticReceipt(input: {
  role: "proposerA" | "proposerB" | "arbiter" | "auditor";
  entryKey: string;
  inputHash: string;
  agentId: string;
  taskName: string;
  threadId: string;
  completedAt: string;
}): FrenchInternalExecutionReceipt {
  const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
  return finalizeFrenchInternalExecutionReceipt({
    schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
    role: input.role,
    entryKey: input.entryKey,
    batchId: `batch-${input.role}`,
    namespace: "/fr-internal/pilot",
    manifestHash:
      input.role === "proposerA" || input.role === "proposerB"
        ? "7".repeat(64)
        : input.role === "arbiter"
          ? "9".repeat(64)
          : "b".repeat(64),
    selectionHash: "5".repeat(64),
    inputHash: input.inputHash,
    artifactHash: hashFrenchInternalJson({
      entryKey: input.entryKey,
      role: input.role
    }),
    agentId: input.agentId,
    taskName: input.taskName,
    threadId: input.threadId,
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    executorPolicyVersion:
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion,
    executor: {
      path: "/Applications/ChatGPT.app/Contents/Resources/codex",
      version: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
      sha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256
    },
    capabilities: {
      localTools: "disabled",
      networkDataTools: "disabled",
      shell: "disabled",
      eventPolicy: "agent-message-only",
      sealedWorkingDirectory: `/sealed/${input.role}`,
      disabledFeaturesHash: "f".repeat(64),
      environmentPolicyHash: "0".repeat(64)
    },
    sourcePaths: {
      input: `/sealed/${input.role}/input.jsonl`,
      runPointer: `/sealed/${input.role}/run.json`
    },
    sourceHashes: {
      input: input.inputHash,
      runPointer: hashFrenchInternalJson({
        role: input.role,
        pointer: true
      })
    },
    resultPaths: {
      agentEvents: `/sealed/${input.role}/events.jsonl`,
      structuredResponse: `/sealed/${input.role}/response.json`
    },
    resultHashes: {
      agentEvents: hashFrenchInternalJson({ role: input.role, events: true }),
      structuredResponse: hashFrenchInternalJson({
        role: input.role,
        response: true
      })
    },
    startedAt: "2026-07-13T09:59:00.000Z",
    completedAt: input.completedAt,
    runHash: hashFrenchInternalJson({ run: input.role })
  });
}

function frenchPacket(): LexiconV3FrenchPacket {
  return buildFrenchPacket(
    {
      entryKey: "greek:G3056",
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: "greek:G3056",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>"
      }),
      identity: {
        stepEntryId: 3056,
        language: "greek",
        eStrong: "G3056",
        dStrong: "G3056",
        uStrong: "G3056",
        original: "λόγος",
        transliteration: "logos",
        morph: "N"
      },
      english: {
        contentHash: "e".repeat(64),
        status: "validated",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>",
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [
          {
            surface: "parole",
            normalized: "parole",
            count: 4,
            strongCount: 1,
            witnessFamilies: ["Darby-family", "Sg1910"],
            sources: ["Darby", "DarbyR", "Sg1910"]
          }
        ],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: [],
        references: [],
        originalTokens: ["λόγος"]
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}

function frenchLegacyHtmlPacket(): LexiconV3FrenchPacket {
  const meaning = "λόγος means fourth c. Author.";
  const meaningHtml =
    "<re><Level2><b>λόγος</b></Level2> means <date>fourth c.</date> <author>Author</author>.</re>";
  return buildFrenchPacket(
    {
      entryKey: "greek:G3056",
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: "greek:G3056",
        gloss: "word",
        meaning,
        meaningHtml
      }),
      identity: {
        stepEntryId: 3056,
        language: "greek",
        eStrong: "G3056",
        dStrong: "G3056",
        uStrong: "G3056",
        original: "λόγος",
        transliteration: "logos",
        morph: "N"
      },
      english: {
        contentHash: "e".repeat(64),
        status: "validated",
        gloss: "word",
        meaning,
        meaningHtml,
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [
          {
            surface: "parole",
            normalized: "parole",
            count: 4,
            strongCount: 1,
            witnessFamilies: ["Darby-family", "Sg1910"],
            sources: ["Darby", "DarbyR", "Sg1910"]
          }
        ],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}

function frenchSiblingPacket(): LexiconV3FrenchPacket {
  return buildFrenchPacket(
    {
      entryKey: "greek:G3056A",
      englishRelease: frenchPacketFixtureEnglishRelease({
        entryKey: "greek:G3056A",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>"
      }),
      identity: {
        stepEntryId: 30560,
        language: "greek",
        eStrong: "G3056A",
        dStrong: "G3056A",
        uStrong: "G3056A",
        original: "λόγος",
        transliteration: "logos",
        morph: "N"
      },
      english: {
        contentHash: "f".repeat(64),
        status: "validated",
        gloss: "word",
        meaning: "A λόγος means a word.",
        meaningHtml: "<p>A <b>λόγος</b> means a word.</p>",
        sources: ["fixture"],
        issues: []
      },
      evidence: {
        occurrenceGlosses: [],
        concordanceForms: [],
        legacy: null,
        existingFrench: null,
        resourceFrench: []
      },
      protectedContent: {
        strongCodes: [],
        references: [],
        originalTokens: ["λόγος"]
      }
    },
    "2026-07-13T09:00:00.000Z"
  );
}

function proposal(
  packet: LexiconV3FrenchPacket,
  model: string,
  overrides: Partial<FrenchLexiconProposal> = {}
): FrenchLexiconProposal {
  return {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    derivedFromEnglishHash: packet.english.contentHash,
    model,
    glossFr: "parole",
    meaningSegmentsFr: [],
    entityMentionsFr: [],
    meaningFr: "Un λόγος signifie une parole.",
    meaningHtmlFr: "<p>Un <b>λόγος</b> signifie une parole.</p>",
    notesFr: "",
    carrierTermsFr: ["parole"],
    confidence: 0.97,
    ...overrides
  };
}

function validationContext(
  packet: LexiconV3FrenchPacket
): FrenchValidationContext {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    concordanceForms: packet.evidence.concordanceForms
  };
}

function frenchConfiguration(): FrenchInternalReviewConfiguration {
  return {
    promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
    proposerAPromptHash: hashFrenchInternalJson("prompt-a"),
    proposerBPromptHash: hashFrenchInternalJson("prompt-b"),
    arbiterPromptHash: hashFrenchInternalJson("prompt-arbiter"),
    auditorPromptHash: hashFrenchInternalJson("prompt-auditor"),
    styleGuideHash: hashFrenchInternalJson("style-guide"),
    termbaseHash: hashFrenchInternalJson("termbase"),
    canonicalNamesHash: hashFrenchInternalJson("canonical-names"),
    canonicalEntitiesHash: hashFrenchInternalJson("canonical-entities"),
    canonicalEntryPoliciesHash: hashFrenchInternalJson("canonical-policies"),
    entityMergeAttestationHash: hashFrenchInternalJson("entity-attestation"),
    entityGateHash: hashFrenchInternalJson("entity-gate"),
    entityMentionsHash: hashFrenchInternalJson("entity-mentions"),
    htmlRendererVersion: "lexicon-v3-french-html-renderer@3",
    approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
  };
}

function passingAuditChecks(): FrenchInternalAudit["checks"] {
  return {
    identityExact: "pass",
    semanticCoverage: "pass",
    noSemanticAddition: "pass",
    noSemanticOmission: "pass",
    polarityModalityUncertaintyPreserved: "pass",
    glossMorphologyConform: "pass",
    properNamesAndTermsConform: "pass",
    entityMentionsConform: "pass",
    protectedContentPreserved: "pass",
    htmlStructurePreserved: "pass",
    naturalFrench: "pass",
    siblingStepConsistency: "pass"
  };
}

function withoutArtifactHash(
  record: FrenchInternalReviewRecord
): Omit<FrenchInternalReviewRecord, "artifactHash"> {
  const { artifactHash: _artifactHash, ...content } = record;
  void _artifactHash;
  return content;
}
