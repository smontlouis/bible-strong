import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertFrenchPilotBlindReauditCodexAuthentication,
  parseFrenchPilotBlindReauditArgs
} from "../scripts/runLexiconV3FrenchPilotBlindReaudit.js";
import {
  FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION,
  FRENCH_BLIND_REAUDIT_CHECKS,
  FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION,
  assertFrenchBlindReauditView,
  buildFrenchBlindReauditPrompt,
  buildFrenchBlindReauditView,
  frenchBlindReauditOutputSchema,
  parseFrenchBlindReauditAgentResponse
} from "../src/lexiconV3/frenchBlindReauditRuntime.js";
import {
  FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE,
  FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
  buildFrenchPilotBlindReauditSelection,
  type FrenchPilotBlindReauditPopulationItem,
  type FrenchPilotBlindReauditView
} from "../src/lexiconV3/frenchPilotBlindReaudit.js";
import {
  hashFrenchInternalJson,
  type FrenchInternalAuditChecks
} from "../src/lexiconV3/frenchInternalReview.js";
import type { FrenchInternalWorkStrata } from "../src/lexiconV3/frenchInternalWork.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";
import type { FrenchInternalReviewRecord } from "../src/lexiconV3/frenchInternalReview.js";

test("blind re-audit rejects pre-snapshot runtime proofs", () => {
  assert.equal(
    FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION,
    "lexicon-v3-french-blind-reaudit-runtime-policy@2"
  );
});

test("builds a strictly blind view with only source English and final French", () => {
  const { packet, review } = fixture();
  const view = fixtureView(packet, review);
  assert.doesNotThrow(() => assertFrenchBlindReauditView(view));
  assert.deepEqual(Object.keys(view.source).sort(), [
    "english",
    "identity",
    "protectedContent"
  ]);
  assert.deepEqual(Object.keys(view.finalFrench).sort(), [
    "carrierTermsFr",
    "glossFr",
    "meaningFr",
    "meaningHtmlFr",
    "notesFr"
  ]);
  const serialized = JSON.stringify(view);
  for (const forbidden of [
    "HISTORICAL-SECRET",
    "RESOURCE-SECRET",
    "PROPOSER-A-SECRET",
    "PROPOSER-B-SECRET",
    "ARBITER-REASON-SECRET",
    "AUDITOR-REASON-SECRET"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(view.exposurePolicy.historicalFrenchExposed, false);
  assert.equal(view.exposurePolicy.proposerOutputsExposed, false);
});

test("seals every available STEP sibling without exposing prior review state", () => {
  const { packet, review } = fixture();
  const self = fixtureView(packet, review).siblingContext.members[0]!;
  const sibling = {
    ...structuredClone(self),
    entryKey: "greek:G3056.3",
    identity: { ...self.identity, dStrong: "G3056.3", stepEntryId: 30563 },
    english: {
      ...self.english,
      contentHash: "4".repeat(64),
      gloss: "statement"
    },
    finalFrench: {
      ...self.finalFrench,
      glossFr: "déclaration",
      meaningFr: "Une déclaration formulée.",
      meaningHtmlFr: "<p>Une déclaration formulée.</p>",
      carrierTermsFr: ["déclaration"]
    }
  };
  const view = buildFrenchBlindReauditView({
    packet,
    finalReview: review,
    siblingContext: {
      scope: "selected-pilot-family-members",
      familyKey: "greek:G3056",
      members: [self, sibling]
    }
  });
  assert.doesNotThrow(() => assertFrenchBlindReauditView(view));
  assert.deepEqual(
    view.siblingContext.members.map((member) => member.entryKey),
    [packet.entryKey, sibling.entryKey]
  );
  assert.deepEqual(Object.keys(view.siblingContext.members[1]!).sort(), [
    "english",
    "entryKey",
    "finalFrench",
    "identity"
  ]);

  const unsorted = structuredClone(view);
  unsorted.siblingContext.members.reverse();
  const { viewHash: _viewHash, ...content } = unsorted;
  void _viewHash;
  unsorted.viewHash = hashFrenchInternalJson(content);
  assert.throws(
    () => assertFrenchBlindReauditView(unsorted),
    /sibling-order-invalid/u
  );
});

test("accepts only bounded decisions in exact view order", () => {
  const views = fourViews();
  const response = responseFor(views, "safe");
  const parsed = parseFrenchBlindReauditAgentResponse({
    responseText: JSON.stringify(response),
    views
  });
  assert.equal(parsed.decisions.length, 4);
  assert.ok(parsed.decisions.every((decision) => decision.verdict === "safe"));

  const reordered = structuredClone(response);
  [reordered.decisions[0], reordered.decisions[1]] = [
    reordered.decisions[1]!,
    reordered.decisions[0]!
  ];
  assert.throws(
    () =>
      parseFrenchBlindReauditAgentResponse({
        responseText: JSON.stringify(reordered),
        views
      }),
    /decision-invalid/u
  );
});

test("fails closed on a falsely safe, low-confidence, or unbounded response", () => {
  const views = fourViews();
  const withReason = responseFor(views, "safe");
  withReason.decisions[0]!.reasons = ["une réserve"];
  assert.throws(
    () =>
      parseFrenchBlindReauditAgentResponse({
        responseText: JSON.stringify(withReason),
        views
      }),
    /decision-invalid/u
  );

  const lowConfidence = responseFor(views, "safe");
  lowConfidence.decisions[0]!.confidence = 0.89;
  assert.throws(
    () =>
      parseFrenchBlindReauditAgentResponse({
        responseText: JSON.stringify(lowConfidence),
        views
      }),
    /decision-invalid/u
  );

  const failedSafe = responseFor(views, "safe");
  failedSafe.decisions[0]!.checks.naturalFrench = "fail";
  assert.throws(
    () =>
      parseFrenchBlindReauditAgentResponse({
        responseText: JSON.stringify(failedSafe),
        views
      }),
    /decision-invalid/u
  );

  const extra = responseFor(views, "safe") as unknown as Record<
    string,
    unknown
  >;
  extra.unbounded = "forbidden";
  assert.throws(
    () =>
      parseFrenchBlindReauditAgentResponse({
        responseText: JSON.stringify(extra),
        views
      }),
    /response-keys-invalid/u
  );
});

test("retains a bounded hold as evidence instead of coercing it to safe", () => {
  const views = fourViews();
  const response = responseFor(views, "safe");
  response.decisions[0] = {
    ...response.decisions[0]!,
    verdict: "hold",
    reasons: ["La portée de la négation reste douteuse."],
    confidence: 0.72,
    checks: { ...response.decisions[0]!.checks, semanticCoverage: "fail" }
  };
  const parsed = parseFrenchBlindReauditAgentResponse({
    responseText: JSON.stringify(response),
    views
  });
  assert.equal(parsed.decisions[0]?.verdict, "hold");
  assert.equal(parsed.decisions[0]?.checks.semanticCoverage, "fail");
});

test("prompt and schema keep the fifth role sealed and tool-free", () => {
  const views = fourViews();
  const prompt = buildFrenchBlindReauditPrompt({
    namespace: "/fr-internal/post-full-blind-reaudit",
    batchId: "blind-reaudit-001",
    views
  });
  assert.match(prompt, /Aucun outil, shell, réseau/u);
  assert.match(
    prompt,
    /ni proposition A\/B, ni arbitrage, ni audit précédent/u
  );
  assert.equal(prompt.includes("HISTORICAL-SECRET"), false);

  const schema = frenchBlindReauditOutputSchema(4) as {
    properties: { decisions: { minItems: number; maxItems: number } };
  };
  assert.equal(schema.properties.decisions.minItems, 4);
  assert.equal(schema.properties.decisions.maxItems, 4);
});

test("selects exactly 60 of 300 deterministically and binds both seed hashes", () => {
  const population = populationFixture();
  const first = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "a".repeat(64),
    finalReviewLogicalDigest: "b".repeat(64),
    population
  });
  const replay = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "a".repeat(64),
    finalReviewLogicalDigest: "b".repeat(64),
    population: structuredClone(population)
  });
  const changed = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: "a".repeat(64),
    finalReviewLogicalDigest: "c".repeat(64),
    population
  });
  assert.equal(
    first.populationSize,
    FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE
  );
  assert.equal(first.keys.length, FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE);
  assert.equal(
    new Set(first.keys).size,
    FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE
  );
  assert.equal(first.selectionHash, replay.selectionHash);
  assert.notEqual(first.selectionHash, changed.selectionHash);
  assert.ok((first.strataCounts.language?.greek ?? 0) > 0);
  assert.ok((first.strataCounts.language?.hebrew ?? 0) > 0);
});

test("uses a strict CLI parser", () => {
  assert.throws(
    () => parseFrenchPilotBlindReauditArgs(["stray"]),
    /unexpected-argument:stray/u
  );
  assert.throws(
    () => parseFrenchPilotBlindReauditArgs(["--unknown", "x"]),
    /unknown-option:unknown/u
  );
  assert.throws(
    () =>
      parseFrenchPilotBlindReauditArgs([
        "--output-dir",
        "a",
        "--output-dir",
        "b"
      ]),
    /duplicate-option:output-dir/u
  );
  assert.throws(
    () => parseFrenchPilotBlindReauditArgs(["--output-dir"]),
    /missing-value:output-dir/u
  );
  assert.throws(
    () => parseFrenchPilotBlindReauditArgs(["--prepare-only=true"]),
    /boolean-option-value:prepare-only/u
  );
  assert.throws(
    () => parseFrenchPilotBlindReauditArgs(["--concurrency", "0"]),
    /options-invalid/u
  );
  assert.throws(
    () =>
      parseFrenchPilotBlindReauditArgs(["--prepare-only", "--existing-only"]),
    /options-invalid/u
  );
  const parsed = parseFrenchPilotBlindReauditArgs([
    "--output-dir=outputs/test-blind",
    "--concurrency",
    "2",
    "--prepare-only"
  ]);
  assert.equal(parsed.concurrency, 2);
  assert.equal(parsed.prepareOnly, true);
});

test("accepts only a private regular auth target through the standard symlink", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-blind-auth-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const secureHome = join(directory, "secure-home");
  const secureTarget = join(directory, "secure-auth.json");
  mkdirSync(secureHome);
  writeFileSync(secureTarget, "secret-not-read-by-validator\n", {
    mode: 0o600
  });
  chmodSync(secureTarget, 0o600);
  symlinkSync(secureTarget, join(secureHome, "auth.json"));
  assert.doesNotThrow(() =>
    assertFrenchPilotBlindReauditCodexAuthentication(secureHome)
  );

  const directHome = join(directory, "direct-home");
  mkdirSync(directHome);
  writeFileSync(join(directHome, "auth.json"), "direct-secret\n", {
    mode: 0o600
  });
  chmodSync(join(directHome, "auth.json"), 0o600);
  assert.doesNotThrow(() =>
    assertFrenchPilotBlindReauditCodexAuthentication(directHome)
  );

  const danglingHome = join(directory, "dangling-home");
  mkdirSync(danglingHome);
  symlinkSync(
    join(directory, "missing-auth.json"),
    join(danglingHome, "auth.json")
  );
  assert.throws(
    () => assertFrenchPilotBlindReauditCodexAuthentication(danglingHome),
    /auth-dangling-symlink/u
  );

  const directoryHome = join(directory, "directory-home");
  const directoryTarget = join(directory, "auth-directory");
  mkdirSync(directoryHome);
  mkdirSync(directoryTarget);
  symlinkSync(directoryTarget, join(directoryHome, "auth.json"));
  assert.throws(
    () => assertFrenchPilotBlindReauditCodexAuthentication(directoryHome),
    /auth-target-not-regular/u
  );

  const insecureHome = join(directory, "insecure-home");
  const insecureTarget = join(directory, "insecure-auth.json");
  mkdirSync(insecureHome);
  writeFileSync(insecureTarget, "insecure-secret\n", { mode: 0o600 });
  chmodSync(insecureTarget, 0o640);
  symlinkSync(insecureTarget, join(insecureHome, "auth.json"));
  assert.throws(
    () => assertFrenchPilotBlindReauditCodexAuthentication(insecureHome),
    /auth-permissions-insecure/u
  );
});

function fixture(): {
  packet: LexiconV3FrenchPacket;
  review: FrenchInternalReviewRecord;
} {
  const packet = {
    packetHash: "1".repeat(64),
    entryKey: "greek:G3056.2",
    identity: {
      stepEntryId: 30562,
      language: "greek",
      eStrong: "G3056",
      dStrong: "G3056.2",
      uStrong: "G3056",
      original: "λόγος",
      transliteration: "logos",
      morph: "N"
    },
    english: {
      contentHash: "2".repeat(64),
      status: "validated",
      gloss: "word",
      meaning: "A word or statement.",
      meaningHtml: "<p>A <b>word</b> or statement.</p>",
      sources: ["STEP"],
      issues: []
    },
    evidence: {
      existingFrench: {
        meaning: "HISTORICAL-SECRET"
      },
      resourceFrench: [{ meaning: "RESOURCE-SECRET" }]
    },
    protectedContent: {
      strongCodes: ["G3056"],
      references: [],
      referenceLiterals: [],
      originalTokens: ["λόγος"],
      numericLiterals: [],
      sigla: []
    }
  } as unknown as LexiconV3FrenchPacket;
  const finalProposal = {
    entryKey: packet.entryKey,
    derivedFromEnglishHash: packet.english.contentHash,
    glossFr: "parole",
    meaningFr: "Une parole ou une déclaration.",
    meaningHtmlFr: "<p>Une <b>parole</b> ou une déclaration.</p>",
    notesFr: "",
    carrierTermsFr: ["parole"]
  };
  const review = {
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    status: "auto_validated",
    artifactHash: "3".repeat(64),
    proposalA: { secret: "PROPOSER-A-SECRET" },
    proposalB: { secret: "PROPOSER-B-SECRET" },
    arbiter: {
      reasons: ["ARBITER-REASON-SECRET"],
      proposal: finalProposal
    },
    auditor: { reasons: ["AUDITOR-REASON-SECRET"] }
  } as unknown as FrenchInternalReviewRecord;
  return { packet, review };
}

function fourViews(): FrenchPilotBlindReauditView[] {
  const current = fixture();
  const base = fixtureView(current.packet, current.review);
  return Array.from({ length: 4 }, (_, index) => {
    const entryKey = `${base.entryKey}-${index + 1}`;
    const content = {
      ...base,
      entryKey,
      packetHash: String(index + 4).repeat(64),
      siblingContext: {
        ...base.siblingContext,
        members: base.siblingContext.members.map((member) => ({
          ...member,
          entryKey
        }))
      },
      viewHash: undefined
    };
    const { viewHash: _viewHash, ...withoutHash } = content;
    void _viewHash;
    return {
      ...withoutHash,
      viewHash: hashFrenchInternalJson(withoutHash)
    } as FrenchPilotBlindReauditView;
  });
}

function fixtureView(
  packet: LexiconV3FrenchPacket,
  review: FrenchInternalReviewRecord
): FrenchPilotBlindReauditView {
  const proposal = review.arbiter!.proposal;
  return buildFrenchBlindReauditView({
    packet,
    finalReview: review,
    siblingContext: {
      scope: "selected-pilot-family-members",
      familyKey: "greek:G3056",
      members: [
        {
          entryKey: packet.entryKey,
          identity: structuredClone(packet.identity) as unknown as Record<
            string,
            unknown
          >,
          english: structuredClone(packet.english) as unknown as Record<
            string,
            unknown
          >,
          finalFrench: {
            glossFr: proposal.glossFr,
            meaningFr: proposal.meaningFr,
            meaningHtmlFr: proposal.meaningHtmlFr,
            notesFr: proposal.notesFr,
            carrierTermsFr: [...proposal.carrierTermsFr]
          }
        }
      ]
    }
  });
}

function responseFor(
  views: readonly FrenchPilotBlindReauditView[],
  verdict: "safe"
): {
  schemaVersion: typeof FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION;
  decisions: Array<{
    entryKey: string;
    inputHash: string;
    verdict: "safe" | "hold" | "block";
    reasons: string[];
    confidence: number;
    checks: FrenchInternalAuditChecks;
  }>;
} {
  return {
    schemaVersion: FRENCH_BLIND_REAUDIT_AGENT_RESPONSE_SCHEMA_VERSION,
    decisions: views.map((view) => ({
      entryKey: view.entryKey,
      inputHash: view.viewHash,
      verdict,
      reasons: [],
      confidence: 0.96,
      checks: passingChecks()
    }))
  };
}

function passingChecks(): FrenchInternalAuditChecks {
  return Object.fromEntries(
    FRENCH_BLIND_REAUDIT_CHECKS.map((check) => [check, "pass"])
  ) as FrenchInternalAuditChecks;
}

function populationFixture(): FrenchPilotBlindReauditPopulationItem[] {
  const positions = ["noun", "verb", "adjective", "adverb"] as const;
  const sizes = ["short", "medium", "long", "very_long"] as const;
  return Array.from(
    { length: FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE },
    (_, index) => {
      const strata: FrenchInternalWorkStrata = {
        language: index % 2 === 0 ? "greek" : "hebrew",
        meaningCohort: index % 3 === 0 ? "step_specific_only" : "unchanged",
        pos: positions[index % positions.length],
        properName: index % 7 === 0,
        theological: index % 11 === 0,
        legacyHtmlCategory: index % 5 === 0 ? "normalized_divergent" : "absent",
        meaningSize: sizes[index % sizes.length],
        riskCategories: index % 13 === 0 ? ["rare-risk"] : []
      };
      return {
        entryKey: `entry-${String(index + 1).padStart(3, "0")}`,
        packetHash: hashFrenchInternalJson({ packet: index }),
        englishHash: hashFrenchInternalJson({ english: index }),
        finalReviewArtifactHash: hashFrenchInternalJson({ review: index }),
        strata
      };
    }
  );
}
