import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  approvedMultiStrongRiskAllowance,
  assertApprovalMetricsGates,
  assertApprovedDecisionsVisible,
  assertNoLexicalAutoSafeRegression,
  buildHumanApprovedOverrides,
  readLexicalMetricsHeader,
  readerSameTokenIdentityDuplicateCount
} from "../src/semanticRefillApprovedApply";
import { type ApprovalDecision } from "../src/semanticRefillApprovalBundle";
import { type StrongLedgerVerse } from "../src/strongLedger";

function decision(overrides: Partial<ApprovalDecision> = {}): ApprovalDecision {
  return {
    bible: "ost",
    ref: "Gen.1.1",
    strong: ["H1234"],
    confidence: 0.99,
    source: "semantic-refill:llm",
    reason: "internally audited safe",
    target: "word",
    wordIndex: 1,
    normalized: "mot",
    status: "accept",
    evidence: ["proof"],
    ...overrides
  };
}

function verse(
  annotations: StrongLedgerVerse["annotations"]
): StrongLedgerVerse {
  return {
    ref: "Gen.1.1",
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    text: "mot autre",
    tokens: [
      { wordIndex: 1, text: "mot", normalized: "mot" },
      { wordIndex: 2, text: "autre", normalized: "autre" }
    ],
    annotations,
    views: { readerHtml: "", advancedHtml: "", debugHtml: "" },
    inventories: {
      references: { Sg1910: [], Darby: [], DarbyR: [] },
      original: [],
      reader: [],
      advanced: []
    },
    metrics: {} as StrongLedgerVerse["metrics"]
  };
}

test("human-approved overrides strip review-only fields and bind the hash", () => {
  const output = buildHumanApprovedOverrides([decision()], "a".repeat(64));
  assert.equal(output[0]?.source, "llm-review:human-approved");
  assert.match(output[0]?.reason ?? "", /SHA-256 a{64}/u);
  assert.equal("status" in (output[0] ?? {}), false);
  assert.equal("evidence" in (output[0] ?? {}), false);
});

test("human-approved decisions already visible in reader mode are idempotent", () => {
  const inputVerse = verse([
    {
      id: "existing-empty",
      strong: "H1234",
      visibility: "reader",
      placement: "empty",
      source: "reference-transfer",
      confidence: 0.74,
      reason: "editorial empty",
      diagnostics: [],
      insertAfterWordIndex: 1
    }
  ]);
  const output = buildHumanApprovedOverrides(
    [decision({ target: "empty", wordIndex: 1, normalized: "" })],
    "a".repeat(64),
    [inputVerse]
  );
  assert.deepEqual(output, []);
});

test("human-approved word decisions relocate a unique reader empty occurrence", () => {
  const inputVerse = verse([
    {
      id: "empty",
      strong: "H1234",
      visibility: "reader",
      placement: "empty",
      source: "reference-transfer",
      confidence: 0.74,
      reason: "editorial empty",
      diagnostics: [],
      insertAfterWordIndex: 0
    },
    {
      id: "other-occurrence",
      strong: "H1234",
      visibility: "reader",
      placement: "word",
      source: "reference-transfer",
      confidence: 0.99,
      reason: "other occurrence",
      diagnostics: [],
      wordIndex: 2,
      normalizedWord: "autre"
    }
  ]);
  const output = buildHumanApprovedOverrides([decision()], "a".repeat(64), [
    inputVerse
  ]);
  assert.deepEqual(output[0]?.replace, {
    target: "empty",
    wordIndex: 0
  });
});

test("human-approved word decisions do not guess between reader empties", () => {
  const empty = {
    id: "empty-a",
    strong: "H1234",
    visibility: "reader" as const,
    placement: "empty" as const,
    source: "reference-transfer" as const,
    confidence: 0.74,
    reason: "editorial empty",
    diagnostics: [],
    insertAfterWordIndex: 0
  };
  const output = buildHumanApprovedOverrides([decision()], "a".repeat(64), [
    verse([empty, { ...empty, id: "empty-b", insertAfterWordIndex: 1 }])
  ]);
  assert.equal(output[0]?.replace, undefined);
});

test("human-approved repeated Strong decisions relocate only reader STEP identities", () => {
  const inputVerse = verse([
    {
      id: "token-9",
      strong: "H1234",
      visibility: "advanced",
      placement: "empty",
      source: "original-complete",
      confidence: 0.35,
      reason: "original empty",
      diagnostics: [],
      insertAfterWordIndex: 0,
      originalTokenId: "TAHOT.Gen.1.1.9.L.main"
    },
    {
      id: "token-16",
      strong: "H1234",
      visibility: "reader",
      placement: "empty",
      source: "reference-transfer",
      confidence: 0.74,
      reason: "editorial empty",
      diagnostics: [],
      insertAfterWordIndex: 1,
      originalOccurrenceId: "TAHOT.Gen.1.1.16.L.main:0"
    }
  ]);
  const output = buildHumanApprovedOverrides(
    [
      decision({ reason: "STEP TAHOT.Gen.1.1.9.L.main", wordIndex: 1 }),
      decision({
        reason: "STEP TAHOT.Gen.1.1.16.L.main:0",
        wordIndex: 2,
        normalized: "autre"
      })
    ],
    "a".repeat(64),
    [inputVerse]
  );
  assert.deepEqual(
    output.map((override) => override.replace),
    [undefined, { target: "empty", wordIndex: 1 }]
  );
});

test("metrics gates reject every protected regression", () => {
  const baseline = {
    verseCount: 10,
    placementRiskCount: 3,
    originalRepresentationRate: 0.9,
    referenceStrongCoverage: 0.8,
    referenceStrongCarrierCoverage: 0.7
  };
  assert.doesNotThrow(() => assertApprovalMetricsGates(baseline, baseline));
  assert.throws(
    () =>
      assertApprovalMetricsGates(baseline, {
        ...baseline,
        placementRiskCount: 4
      }),
    /placement-risk-regression/u
  );
  assert.doesNotThrow(() =>
    assertApprovalMetricsGates(
      baseline,
      { ...baseline, placementRiskCount: 4 },
      1
    )
  );
  assert.throws(
    () =>
      assertApprovalMetricsGates(baseline, {
        ...baseline,
        referenceStrongCarrierCoverage: 0.6
      }),
    /referenceStrongCarrierCoverage-regression/u
  );
});

test("placement-risk allowance requires a distinct, fully approved word stack", () => {
  const before = verse([]);
  const after = verse([
    {
      id: "approved-a",
      strong: "G0039",
      visibility: "reader",
      placement: "word",
      source: "curated-override",
      confidence: 0.99,
      reason: "approved",
      diagnostics: ["llm-review:human-approved"],
      wordIndex: 1
    },
    {
      id: "approved-b",
      strong: "G4151",
      visibility: "reader",
      placement: "word",
      source: "curated-override",
      confidence: 0.99,
      reason: "approved",
      diagnostics: ["llm-review:human-approved"],
      wordIndex: 1
    }
  ]);
  assert.equal(
    approvedMultiStrongRiskAllowance({
      decisions: [
        decision({ strong: ["G0039"], wordIndex: 1 }),
        decision({ strong: ["G4151"], wordIndex: 1 })
      ],
      beforeVerses: [before],
      afterVerses: [after]
    }),
    1
  );
  assert.throws(
    () =>
      approvedMultiStrongRiskAllowance({
        decisions: [decision({ strong: ["G0039"], wordIndex: 1 })],
        beforeVerses: [before],
        afterVerses: [after]
      }),
    /unapproved-new-multi-strong-carrier/u
  );
});

test("scoped lexical gates compare like-for-like before and after", () => {
  assert.doesNotThrow(() =>
    assertNoLexicalAutoSafeRegression(
      { autoSafeCandidates: 1, autoSafeItems: 1, groupAutoSafeItems: 0 },
      { autoSafeCandidates: 1, autoSafeItems: 1, groupAutoSafeItems: 0 },
      "Exod.15"
    )
  );
  assert.throws(
    () =>
      assertNoLexicalAutoSafeRegression(
        { autoSafeCandidates: 1, autoSafeItems: 1, groupAutoSafeItems: 0 },
        { autoSafeCandidates: 2, autoSafeItems: 1, groupAutoSafeItems: 0 },
        "Exod.15"
      ),
    /lexical-auto-safe-regression:Exod\.15:autoSafeCandidates:1->2/u
  );
});

test("visibility proof checks the exact carrier and removed relocation source", () => {
  const visible = verse([
    {
      id: "x",
      strong: "H1234",
      visibility: "reader",
      placement: "word",
      source: "curated-override",
      confidence: 0.99,
      reason: "approved",
      diagnostics: [],
      wordIndex: 1,
      normalizedWord: "mot"
    }
  ]);
  assert.doesNotThrow(() =>
    assertApprovedDecisionsVisible([decision()], [visible])
  );
  assert.throws(
    () =>
      assertApprovedDecisionsVisible(
        [decision({ replace: { target: "word", wordIndex: 2 } })],
        [
          verse([
            ...visible.annotations,
            { ...visible.annotations[0]!, id: "old", wordIndex: 2 }
          ])
        ]
      ),
    /approved-relocation-source-still-visible/u
  );
});

test("same-token identity duplicates count only repeated reader identities", () => {
  const base = {
    id: "a",
    strong: "H1234",
    visibility: "reader" as const,
    placement: "word" as const,
    source: "curated-override" as const,
    confidence: 0.99,
    reason: "approved",
    diagnostics: [],
    wordIndex: 1
  };
  assert.equal(
    readerSameTokenIdentityDuplicateCount([
      verse([
        base,
        { ...base, id: "b" },
        { ...base, id: "c", visibility: "advanced" }
      ])
    ]),
    1
  );
});

test("streams lexical metrics without parsing the large items array", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lexical-header-"));
  const filePath = path.join(directory, "report.json");
  try {
    await writeFile(
      filePath,
      `{\n  "bible": "ost",\n  "metrics": ${JSON.stringify(
        {
          autoSafeCandidates: 0,
          autoSafeItems: 0,
          groupAutoSafeItems: 0
        },
        null,
        2
      ).replaceAll(
        "\n",
        "\n  "
      )},\n  "items": [\n    {"large":"ignored"}\n  ]\n}\n`
    );
    assert.deepEqual(await readLexicalMetricsHeader(filePath), {
      autoSafeCandidates: 0,
      autoSafeItems: 0,
      groupAutoSafeItems: 0
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
