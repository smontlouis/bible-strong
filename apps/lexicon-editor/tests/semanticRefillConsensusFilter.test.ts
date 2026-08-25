import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  filterConsensusReview,
  filterDecisions
} from "../src/semanticRefillConsensusFilter.js";
import { type SemanticRefillLlmCandidatePacket } from "../src/semanticRefillLlm.js";

interface TestReviewOutput {
  decisions: Array<{ id: string; strong: string[] }>;
  postConsensusFilter: {
    outcomes: Array<{
      decision: { id: string };
      status: string;
      reasons: string[];
    }>;
  };
}

interface TestReportDecision {
  ref: string;
  strong: string[];
  target: string;
  normalized: string | null;
  status: string;
  reasons: string[];
  exactWitnessFamilies: string[];
  directDeterministicSupport: boolean;
}

test("post-consensus filter holds generic carriers and resolves same-target stacking by carrier support", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const sgPath = path.join(dir, "Sg1910.csv");
  const darbyPath = path.join(dir, "Darby.csv");
  const darbyRPath = path.join(dir, "DarbyR.csv");
  const reviewPath = path.join(dir, "review.json");
  const packetPath = path.join(dir, "packet.json");
  const outputPath = path.join(dir, "filtered.json");
  const reportJsonPath = path.join(dir, "report.json");
  const reportMarkdownPath = path.join(dir, "report.md");

  await Promise.all([
    writeFile(
      sgPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Hos\t2\t7\tElle a <w strong="H0559">dit</w> cela.',
        'Rev\t5\t1\tun livre écrit en <w strong="G1855">dehors</w>'
      ].join("\n")
    ),
    writeFile(
      darbyPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Hos\t2\t7\tElle <w strong="H0559">dit</w> encore.',
        'Rev\t5\t1\técrit sur le <w strong="G1855">revers</w>'
      ].join("\n")
    ),
    writeFile(
      darbyRPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Hos\t2\t7\tElle <w strong="H0559">dit</w> encore.',
        'Rev\t5\t1\técrit à l’<w strong="G1855">extérieur</w>'
      ].join("\n")
    )
  ]);

  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [
      candidate("hos-generic", "Hos.2.7", "H0559"),
      candidate("rev-g1855", "Rev.5.1", "G1855", {}, [
        directWordCandidate("G1855", 22, "dos")
      ]),
      candidate("rev-g3693", "Rev.5.1", "G3693")
    ]
  };
  const review = {
    bible: "nbs",
    scope: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    sourcePacket: packetPath,
    model: "consensus(model-a,model-b)",
    contract: { version: 2 },
    decisions: [
      decision("hos-generic", "Hos.2.7", ["H0559"], 3, "quoi"),
      decision("rev-g1855", "Rev.5.1", ["G1855"], 22, "dos"),
      decision("rev-g3693", "Rev.5.1", ["G3693"], 22, "dos")
    ]
  };
  attachDecisionChoices(packet, review.decisions);

  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  ]);

  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath,
    reportMarkdownPath,
    referencePaths: [
      { name: "Sg1910", path: sgPath },
      { name: "Darby", path: darbyPath },
      { name: "DarbyR", path: darbyRPath }
    ]
  });
  const output = JSON.parse(
    await readFile(outputPath, "utf8")
  ) as TestReviewOutput;
  const decisions = report.decisions as TestReportDecision[];

  assert.deepEqual(report.counts, {
    input: 3,
    acceptedSafe: 1,
    needsWitnessReview: 1,
    rejectedRisky: 1
  });
  assert.deepEqual(
    output.decisions.map((item) => item.id),
    ["rev-g1855"]
  );
  assert.deepEqual(
    output.postConsensusFilter.outcomes.map((item) => [
      item.decision.id,
      item.status
    ]),
    [
      ["hos-generic", "needs-witness-review"],
      ["rev-g1855", "accepted-safe"],
      ["rev-g3693", "rejected-risky"]
    ]
  );
  assert.equal(findDecision(decisions, "H0559").status, "needs-witness-review");
  assert.deepEqual(findDecision(decisions, "H0559").reasons, [
    "generic-carrier-needs-witness-review"
  ]);
  assert.equal(findDecision(decisions, "G1855").status, "accepted-safe");
  assert.equal(findDecision(decisions, "G3693").status, "rejected-risky");
  assert.equal(
    findDecision(decisions, "G3693").reasons.includes(
      "same-target-stacking-lacks-carrier-support"
    ),
    true
  );
  assert.equal(
    findDecision(decisions, "G1855").directDeterministicSupport,
    true
  );
});

test("post-consensus filter accepts generic carriers only with two exact witness matches", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const sgPath = path.join(dir, "Sg1910.csv");
  const darbyPath = path.join(dir, "Darby.csv");
  const darbyRPath = path.join(dir, "DarbyR.csv");
  const reviewPath = path.join(dir, "review.json");
  const packetPath = path.join(dir, "packet.json");
  const outputPath = path.join(dir, "filtered.json");
  const reportJsonPath = path.join(dir, "report.json");
  const reportMarkdownPath = path.join(dir, "report.md");

  await Promise.all([
    writeFile(
      sgPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Acts\t3\t10\tC’<w strong="G2258">était</w> lui.'
      ].join("\n")
    ),
    writeFile(
      darbyPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Acts\t3\t10\tC’<w strong="G2258">était</w> lui.'
      ].join("\n")
    ),
    writeFile(
      darbyRPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Acts\t3\t10\tIl <w strong="G2258">fut</w> reconnu.'
      ].join("\n")
    )
  ]);

  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [candidate("acts-g2258", "Acts.3.10", "G2258")]
  };
  const review = {
    bible: "nbs",
    scope: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    sourcePacket: packetPath,
    model: "consensus(model-a,model-b)",
    contract: { version: 2 },
    decisions: [decision("acts-g2258", "Acts.3.10", ["G2258"], 1, "etait")]
  };
  attachDecisionChoices(packet, review.decisions);

  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  ]);

  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath,
    reportMarkdownPath,
    referencePaths: [
      { name: "Sg1910", path: sgPath },
      { name: "Darby", path: darbyPath },
      { name: "DarbyR", path: darbyRPath }
    ]
  });
  const output = JSON.parse(
    await readFile(outputPath, "utf8")
  ) as TestReviewOutput;

  assert.deepEqual(report.counts, {
    input: 1,
    acceptedSafe: 1,
    needsWitnessReview: 0,
    rejectedRisky: 0
  });
  assert.deepEqual(
    output.decisions.map((item) => item.id),
    ["acts-g2258"]
  );
  assert.deepEqual(report.decisions[0]?.reasons, [
    "generic-carrier-exact-witness-supported"
  ]);
  assert.deepEqual(report.decisions[0]?.exactWitnessFamilies, [
    "Darby-family",
    "Sg1910"
  ]);
});

test("post-consensus filter counts Darby and DarbyR as one editorial family", async () => {
  const result = await runSingleDecisionFilter({
    referenceTexts: {
      Sg1910: 'Il <w strong="G2258">fut</w> reconnu.',
      Darby: 'C’<w strong="G2258">était</w> lui.',
      DarbyR: 'C’<w strong="G2258">était</w> lui.'
    },
    candidate: candidate("acts-g2258", "Acts.3.10", "G2258"),
    decision: decision("acts-g2258", "Acts.3.10", ["G2258"], 1, "etait")
  });

  assert.deepEqual(result.report.counts, {
    input: 1,
    acceptedSafe: 0,
    needsWitnessReview: 1,
    rejectedRisky: 0
  });
  assert.deepEqual(result.output.decisions, []);
  assert.deepEqual(result.report.decisions[0]?.exactWitnessFamilies, [
    "Darby-family"
  ]);
  assert.deepEqual(result.report.decisions[0]?.reasons, [
    "generic-carrier-needs-witness-review"
  ]);
});

test("post-consensus filter rejects single-model provenance", async () => {
  await assert.rejects(
    runSingleDecisionFilter({
      model: "model-a",
      referenceTexts: {
        Sg1910: 'Au <w strong="H7225">commencement</w>.',
        Darby: 'Au <w strong="H7225">commencement</w>.',
        DarbyR: 'Au <w strong="H7225">commencement</w>.'
      },
      candidate: candidate("gen-h7225", "Acts.3.10", "H7225"),
      decision: decision("gen-h7225", "Acts.3.10", ["H7225"], 1, "commencement")
    }),
    /consensus-model-provenance-required:model-a/u
  );
});

test("post-consensus filter rejects a non-generic carrier when the Strong is witnessed only on other words", async () => {
  const result = await runSingleDecisionFilter({
    ref: "Rev.5.1",
    referenceTexts: {
      Sg1910: 'écrit en <w strong="G1855">dehors</w>',
      Darby: 'écrit sur le <w strong="G1855">revers</w>',
      DarbyR: 'écrit à l’<w strong="G1855">extérieur</w>'
    },
    candidate: candidate("rev-g1855", "Rev.5.1", "G1855", {}, [
      directWordCandidate("G1855", 21, "dehors")
    ]),
    decision: decision("rev-g1855", "Rev.5.1", ["G1855"], 22, "dos")
  });

  assert.deepEqual(result.report.counts, {
    input: 1,
    acceptedSafe: 0,
    needsWitnessReview: 1,
    rejectedRisky: 0
  });
  assert.deepEqual(result.output.decisions, []);
  assert.deepEqual(result.report.decisions[0]?.exactWitnessFamilies, []);
  assert.equal(result.report.decisions[0]?.directDeterministicSupport, false);
  assert.deepEqual(result.report.decisions[0]?.reasons, [
    "carrier-needs-exact-witness-or-direct-evidence"
  ]);
});

test("post-consensus filter never treats review-only lexical evidence as direct support", async () => {
  const deterministic = directWordCandidate("G1855", 22, "dos");
  deterministic.evidence = [
    "lexical-confidence:medium",
    "review-only:seed-term:dos inferred from prose:0.5"
  ];
  const result = await runSingleDecisionFilter({
    ref: "Rev.5.1",
    referenceTexts: {
      Sg1910: 'écrit en <w strong="G1855">dehors</w>',
      Darby: 'écrit sur le <w strong="G1855">revers</w>',
      DarbyR: 'écrit à l’<w strong="G1855">extérieur</w>'
    },
    candidate: candidate(
      "rev-review-only",
      "Rev.5.1",
      "G1855",
      { Sg1910: ["G1855"] },
      [deterministic]
    ),
    decision: decision("rev-review-only", "Rev.5.1", ["G1855"], 22, "dos")
  });

  assert.equal(result.report.decisions[0]?.directDeterministicSupport, false);
  assert.equal(result.report.decisions[0]?.status, "needs-witness-review");
});

test("post-consensus filter holds original-only decisions with no Strong witness support", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const sgPath = path.join(dir, "Sg1910.csv");
  const darbyPath = path.join(dir, "Darby.csv");
  const darbyRPath = path.join(dir, "DarbyR.csv");
  const reviewPath = path.join(dir, "review.json");
  const packetPath = path.join(dir, "packet.json");
  const outputPath = path.join(dir, "filtered.json");
  const reportJsonPath = path.join(dir, "report.json");
  const reportMarkdownPath = path.join(dir, "report.md");

  await Promise.all([
    writeFile(
      sgPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Rom\t4\t17\tce qui <w strong="G1510">est</w>'
      ].join("\n")
    ),
    writeFile(
      darbyPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Rom\t4\t17\tce qui <w strong="G1510">est</w>'
      ].join("\n")
    ),
    writeFile(
      darbyRPath,
      [
        "book_id\tnum_chapter\tnum_verse\ttext",
        'Rom\t4\t17\tce qui <w strong="G1510">est</w>'
      ].join("\n")
    )
  ]);

  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [
      candidate("rom-original-only", "Rom.4.17", "G5607", {
        Sg1910: ["G1510"],
        Darby: ["G1510"],
        DarbyR: ["G1510"]
      })
    ]
  };
  const review = {
    bible: "nbs",
    scope: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    sourcePacket: packetPath,
    model: "consensus(model-a,model-b)",
    contract: { version: 2 },
    decisions: [
      decision("rom-original-only", "Rom.4.17", ["G5607"], 35, "existe")
    ]
  };
  attachDecisionChoices(packet, review.decisions);

  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`)
  ]);

  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath,
    reportMarkdownPath,
    referencePaths: [
      { name: "Sg1910", path: sgPath },
      { name: "Darby", path: darbyPath },
      { name: "DarbyR", path: darbyRPath }
    ]
  });
  const output = JSON.parse(
    await readFile(outputPath, "utf8")
  ) as TestReviewOutput;

  assert.deepEqual(report.counts, {
    input: 1,
    acceptedSafe: 0,
    needsWitnessReview: 1,
    rejectedRisky: 0
  });
  assert.deepEqual(output.decisions, []);
  assert.deepEqual(report.decisions[0]?.reasons, ["no-strong-witness-support"]);
});

test("post-consensus filter holds overlapping supported phrase carriers", () => {
  const firstCandidate = candidate("phrase-a", "Gen.1.1", "H0001", {}, [
    directPhraseCandidate("H0001", 1, 3, ["un", "deux", "trois"])
  ]);
  const secondCandidate = candidate("phrase-b", "Gen.1.1", "H0002", {}, [
    directPhraseCandidate("H0002", 3, 4, ["trois", "quatre"])
  ]);
  const first = phraseDecision("phrase-a", "Gen.1.1", "H0001", 1, 3, [
    "un",
    "deux",
    "trois"
  ]);
  const second = phraseDecision("phrase-b", "Gen.1.1", "H0002", 3, 4, [
    "trois",
    "quatre"
  ]);

  const filtered = filterDecisions({
    review: {
      bible: "nbs",
      scope: "Gen.1",
      generatedAt: "2026-07-10T00:00:00.000Z",
      decisions: [first, second]
    },
    packet: {
      bible: "nbs",
      scope: "Gen.1",
      candidates: [firstCandidate, secondCandidate]
    },
    referenceMaps: new Map()
  });

  assert.deepEqual(
    filtered.map((item) => item.status),
    ["needs-witness-review", "needs-witness-review"]
  );
  assert.equal(
    filtered.every((item) =>
      item.reasons.includes("same-target-stacking-multiple-carriers-supported")
    ),
    true
  );
});

function candidate(
  id: string,
  ref: string,
  strong: string,
  referenceInventory: Record<string, string[]> = {},
  deterministicCandidates: SemanticRefillLlmCandidatePacket["deterministicCandidates"] = []
): SemanticRefillLlmCandidatePacket {
  return {
    id,
    bible: "nbs",
    ref,
    text: "",
    auditKind: "missing",
    priority: "lexical-high",
    strong,
    currentPlacement: "empty",
    sourcePlacement: { placement: "empty" },
    reason: "",
    eligible: true,
    tokens: [],
    originalInventory: [strong],
    referenceInventory,
    existingReaderStrong: [],
    occupiedTargets: [],
    availableTargets: [],
    blockedTargets: [],
    openContentTargets: [],
    nearbyOpenTargets: [],
    placementWarnings: [],
    deterministicCandidates
  };
}

function directWordCandidate(
  strong: string,
  wordIndex: number,
  normalizedWord: string
): SemanticRefillLlmCandidatePacket["deterministicCandidates"][number] {
  return {
    target: "word",
    strong,
    score: 0.91,
    wordIndex,
    normalizedWord,
    evidence: [
      "lexical-confidence:high",
      `seed-term:${normalizedWord} matches Strong lexical hint:0.5`
    ]
  };
}

function directPhraseCandidate(
  strong: string,
  startWordIndex: number,
  endWordIndex: number,
  normalizedPhrase: string[]
): SemanticRefillLlmCandidatePacket["deterministicCandidates"][number] {
  return {
    target: "phrase",
    strong,
    score: 0.91,
    startWordIndex,
    endWordIndex,
    normalizedPhrase,
    evidence: [
      "lexical-confidence:high",
      `seed-term:${normalizedPhrase.join(" ")} matches Strong lexical hint:0.5`
    ]
  };
}

function decision(
  id: string,
  ref: string,
  strong: string[],
  wordIndex: number,
  normalized: string
) {
  return {
    id,
    choiceId: `word:${wordIndex}`,
    ref,
    decision: "word",
    strong,
    confidence: 0.91,
    reason: "",
    wordIndex,
    normalized,
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: []
  };
}

function phraseDecision(
  id: string,
  ref: string,
  strong: string,
  startWordIndex: number,
  endWordIndex: number,
  normalizedPhrase: string[]
) {
  return {
    id,
    choiceId: `phrase:${startWordIndex}-${endWordIndex}`,
    ref,
    decision: "phrase" as const,
    strong: [strong],
    confidence: 0.91,
    reason: "",
    wordIndex: null,
    normalized: null,
    startWordIndex,
    endWordIndex,
    normalizedPhrase,
    evidence: []
  };
}

function findDecision(
  decisions: TestReportDecision[],
  strong: string
): TestReportDecision {
  const found = decisions.find((item) => item.strong.includes(strong));
  assert.ok(found);
  return found;
}

async function runSingleDecisionFilter(options: {
  ref?: string;
  model?: string;
  referenceTexts: Record<"Sg1910" | "Darby" | "DarbyR", string>;
  candidate: SemanticRefillLlmCandidatePacket;
  decision: ReturnType<typeof decision>;
}): Promise<{
  report: Awaited<ReturnType<typeof filterConsensusReview>>;
  output: TestReviewOutput;
}> {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "semantic-refill-consensus-filter-")
  );
  const ref = options.ref ?? "Acts.3.10";
  const [bookId, chapter, verse] = ref.split(".");
  assert.ok(bookId && chapter && verse);
  const referencePaths = (["Sg1910", "Darby", "DarbyR"] as const).map(
    (name) => ({ name, path: path.join(dir, `${name}.csv`) })
  );
  await Promise.all(
    referencePaths.map(({ name, path: referencePath }) =>
      writeFile(
        referencePath,
        [
          "book_id\tnum_chapter\tnum_verse\ttext",
          `${bookId}\t${chapter}\t${verse}\t${options.referenceTexts[name]}`
        ].join("\n")
      )
    )
  );

  const packetPath = path.join(dir, "packet.json");
  const reviewPath = path.join(dir, "review.json");
  const outputPath = path.join(dir, "filtered.json");
  const packet = {
    bible: "nbs",
    scope: "test",
    candidates: [options.candidate]
  };
  attachDecisionChoices(packet, [options.decision]);
  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`),
    writeFile(
      reviewPath,
      `${JSON.stringify(
        {
          bible: "nbs",
          scope: "test",
          generatedAt: "2026-07-10T00:00:00.000Z",
          sourcePacket: packetPath,
          model: options.model ?? "consensus(model-a,model-b)",
          contract: { version: 2 },
          decisions: [options.decision]
        },
        null,
        2
      )}\n`
    )
  ]);
  const report = await filterConsensusReview({
    reviewPath,
    packetPath,
    outputPath,
    reportJsonPath: path.join(dir, "report.json"),
    reportMarkdownPath: path.join(dir, "report.md"),
    referencePaths
  });
  return {
    report,
    output: JSON.parse(await readFile(outputPath, "utf8")) as TestReviewOutput
  };
}

function attachDecisionChoices(
  packet: {
    candidates: SemanticRefillLlmCandidatePacket[];
  },
  decisions: Array<ReturnType<typeof decision>>
): void {
  for (const candidate of packet.candidates) {
    const selected = decisions.find((item) => item.id === candidate.id);
    if (!selected) continue;
    candidate.choices = [
      {
        id: selected.choiceId,
        decision: selected.decision,
        description: "test bounded choice",
        wordIndex: selected.wordIndex,
        normalized: selected.normalized,
        startWordIndex: selected.startWordIndex,
        endWordIndex: selected.endWordIndex,
        normalizedPhrase: selected.normalizedPhrase
      }
    ];
  }
}
