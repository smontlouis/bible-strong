import assert from "node:assert/strict";
import test from "node:test";
import {
  refineConcordanceFollowup,
  sourceConjoinHead,
  isGrammaticalExpressionMorphology,
  type FollowupPolicy
} from "../src/strongConcordanceFollowup.js";
import type {
  ReconstructionVerse,
  ReconstructionPlacement
} from "../src/strongConcordanceRefinement.js";
import { parseSourceRow, type SourceRow } from "../src/strongSourceUnits.js";
import { resolveCanonicalVerse } from "../src/strongCanonicalResolution.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";

const policy: FollowupPolicy = {
  minorReadings: true,
  functionExpressions: true,
  articleLinks: true,
  minimumHeadFamilies: 1
};

test("a Hebrew bound prefix does not replace the lexical part of speech", () => {
  for (const morphology of [
    "HR/Ncmsa",
    "HC/R/Ncfsa/Sp3ms",
    "HR/Vqcc",
    "HC/Td/Ncmpa"
  ])
    assert.equal(
      isGrammaticalExpressionMorphology(morphology),
      false,
      morphology
    );
  for (const morphology of ["HR", "HC/R/Sp3ms", "HTc", "HTr", "CONJ", "PREP"])
    assert.equal(
      isGrammaticalExpressionMorphology(morphology),
      true,
      morphology
    );
});

test("conjoin does not change a different French realization into an article", () => {
  const f = articlesFixture();
  f.initial.text = "le bien puis leur Juif";
  f.initial.words = ["le", "bien", "puis", "leur", "Juif"];
  assert.equal(
    refineConcordanceFollowup(f).changes.filter(
      (c) => c.rule === "source-conjoin-article"
    ).length,
    0
  );
});

test("a standalone French function carrier is not expanded to its pronoun context", () => {
  const row = greek(1, "G2532", "CONJ"),
    u = unit(row, "G2532", "CONJ");
  const initial: ReconstructionVerse = {
    ref: "Rom.1.1",
    text: "Puis il",
    words: ["Puis", "il"],
    units: [u],
    placements: [
      {
        ...word(u, 0),
        kind: "phrase",
        endWordIndex: 1,
        source: "phrase-transfer:learned-phrase"
      }
    ],
    issues: [],
    unownedAnnotationIds: []
  };
  const result = refineConcordanceFollowup({
    initial,
    sourceRows: new Map([[row.id, row]]),
    witnesses: [
      {
        name: "Darby",
        family: "Darby-family",
        words: ["Puis", "il"],
        placements: [word(u, 0)]
      }
    ],
    displayEvidence: [],
    policy
  });
  assert.equal(result.prediction.placements[0].kind, "word");
  assert.equal(result.prediction.placements[0].startWordIndex, 0);
});
function greek(
  index: number,
  strong: string,
  morph: string,
  conjoin = `#${index}`,
  reading = "NKO",
  variants = ""
) {
  return parseSourceRow(
    `Rom.1.1#${index}=${reading}\ts${index}\tg${index}\t${strong}=${morph}\tlemma\tNA28+TR\t${variants}\t\t\t\t${conjoin}\t${strong}\t`,
    "TAGNT fixture.txt",
    index
  )!;
}
function unit(
  row: SourceRow,
  strong: string,
  morphology: string,
  readingUnresolved = false
): ReconstructionVerse["units"][number] {
  return {
    sourceUnitId: row.id,
    occurrenceIds: [`${row.id}.main:0`],
    strong: [strong],
    source: {
      file: row.file,
      line: row.line,
      surface: row.surface,
      gloss: row.gloss,
      morphology,
      evidenceSha256: "fixture",
      readingUnresolved
    },
    state: readingUnresolved ? "unresolved" : "visible",
    assurance: "fixture",
    targetWordIndices: [],
    annotationIds: [],
    placementEvidence: [],
    reasons: [],
    exploration: {
      status: "completed-locally",
      methods: [],
      exactWitnessProposal: null,
      lexicalCandidates: [],
      remainingReason: readingUnresolved ? "unresolved-source-reading" : null
    }
  };
}
function word(
  u: ReconstructionVerse["units"][number],
  index: number
): ReconstructionPlacement {
  return {
    id: `p:${u.sourceUnitId}`,
    strong: u.strong[0],
    originalOccurrenceId: u.occurrenceIds[0],
    kind: "word",
    startWordIndex: index,
    endWordIndex: index,
    source: "reference-transfer:exact|fixture",
    confidence: 0.99
  };
}
function articlesFixture() {
  const rows = [
    greek(1, "G3588", "T-ASN", "#01»02:G0018"),
    greek(2, "G0018", "A-ASN"),
    greek(3, "G3588", "T-ASM", "#03»04:G2453"),
    greek(4, "G2453", "A-ASM")
  ];
  const units = rows.map((r, i) =>
    unit(
      r,
      ["G3588", "G0018", "G3588", "G2453"][i],
      ["T-ASN", "A-ASN", "T-ASM", "A-ASM"][i]
    )
  );
  const initial: ReconstructionVerse = {
    ref: "Rom.1.1",
    text: "le bien puis le Juif",
    words: ["le", "bien", "puis", "le", "Juif"],
    units,
    placements: [
      word(units[0], 3),
      word(units[1], 1),
      word(units[2], 0),
      word(units[3], 4)
    ],
    issues: [],
    unownedAnnotationIds: []
  };
  return {
    initial,
    sourceRows: new Map(rows.map((r) => [r.id, r])),
    witnesses: [],
    displayEvidence: [],
    policy
  };
}
test("source conjoin corrects a repeated article swap atomically without changing owners or text", () => {
  const f = articlesFixture(),
    before = structuredClone(f.initial);
  const r = refineConcordanceFollowup(f);
  assert.equal(
    r.changes.filter((c) => c.rule === "source-conjoin-article").length,
    2
  );
  assert.deepEqual(
    r.prediction.placements
      .filter((p) => p.strong === "G3588")
      .map((p) => [p.originalOccurrenceId, p.startWordIndex]),
    [
      [f.initial.units[0].occurrenceIds[0], 0],
      [f.initial.units[2].occurrenceIds[0], 3]
    ]
  );
  assert.deepEqual(f.initial, before);
  assert.equal(r.prediction.text, before.text);
  assert.deepEqual(r, refineConcordanceFollowup(f));
});
test("conjoin does not steal an occupied carrier when the other move is unsupported", () => {
  const f = articlesFixture();
  f.sourceRows.get(f.initial.units[2].sourceUnitId)!.evidence.conjoin = "#03";
  const r = refineConcordanceFollowup(f);
  assert.equal(
    r.changes.filter((c) => c.rule === "source-conjoin-article").length,
    0
  );
});
test("conjoin refuses weak heads, clause boundaries, repeated heads, and multi-head links", () => {
  const weak = articlesFixture();
  weak.initial.placements[1].confidence = 0.5;
  assert.equal(
    refineConcordanceFollowup(weak).changes.filter(
      (c) => c.rule === "source-conjoin-article"
    ).length,
    0
  );
  const clause = articlesFixture();
  clause.initial.text = "le, bien puis le Juif";
  assert.equal(
    refineConcordanceFollowup(clause).changes.filter(
      (c) => c.rule === "source-conjoin-article"
    ).length,
    0
  );
  const repeated = articlesFixture();
  repeated.initial.units[3].strong = ["G0018"];
  assert.equal(
    refineConcordanceFollowup(repeated).changes.filter(
      (c) => c.rule === "source-conjoin-article"
    ).length,
    0
  );
  for (const link of [
    "#01»02:G0018+03:G2453",
    "#03»02:G0018",
    "#01«02:G0018",
    "#01»01:G0018"
  ])
    assert.equal(
      sourceConjoinHead(greek(1, "G3588", "T-ASN", link)),
      undefined
    );
});
test("a grammatical expression is preserved without a Strong-specific or French phrase list", () => {
  const row = greek(1, "G1063", "CONJ");
  const u = unit(row, "G1063", "CONJ");
  u.targetWordIndices = [0, 1];
  const initial: ReconstructionVerse = {
    ref: "Rom.1.1",
    text: "en effet",
    words: ["en", "effet"],
    units: [u],
    placements: [
      {
        ...word(u, 0),
        kind: "phrase",
        endWordIndex: 1,
        source: "phrase-transfer:learned-phrase"
      }
    ],
    issues: [],
    unownedAnnotationIds: []
  };
  const f = {
    initial,
    sourceRows: new Map([[row.id, row]]),
    witnesses: [
      {
        name: "Darby",
        family: "Darby-family",
        words: ["en", "effet"],
        placements: [word(u, 1)]
      }
    ],
    displayEvidence: [],
    policy
  };
  assert.equal(
    refineConcordanceFollowup(f).prediction.placements[0].kind,
    "phrase"
  );
  assert.equal(
    refineConcordanceFollowup({
      ...f,
      policy: { ...policy, functionExpressions: false }
    }).prediction.placements[0].kind,
    "word"
  );
});
test("minor-reading recovery retains a known carrier, while a lexical alternative stays uncertain", () => {
  for (const [variant, visible] of [
    ["G2090", true],
    ["G2091", false]
  ] as const) {
    const row = greek(
      1,
      "G2090",
      "V-PAI-1P",
      "#01",
      "NK(o)",
      `form - ${variant}=V-FAI-1P`
    );
    const u = unit(row, "G2090", "V-PAI-1P", true);
    const initial: ReconstructionVerse = {
      ref: "Rom.1.1",
      text: "préparons",
      words: ["préparons"],
      units: [u],
      placements: [word(u, 0)],
      issues: [],
      unownedAnnotationIds: []
    };
    const r = refineConcordanceFollowup({
      initial,
      sourceRows: new Map([[row.id, row]]),
      witnesses: [],
      displayEvidence: [],
      policy
    });
    assert.equal(
      r.prediction.units[0].state,
      visible ? "visible" : "unresolved"
    );
    assert.equal(r.prediction.placements.length, visible ? 1 : 0);
    assert(r.prediction.placements.every((p) => p.kind !== "empty"));
    assert.equal(
      r.prediction.units[0].source.readingAssessment?.grammarAndEditionChoice,
      "not-adjudicated"
    );
  }
});
test("the canonical ledger uses the same minor-reading interpretation and preserves raw source flags", () => {
  for (const [reading, expected] of [
    ["L(p)", "visible"],
    ["L(P)", "unresolved"]
  ] as const) {
    const row = parseSourceRow(
      `Gen.1.1#01=${reading}\tsource\ttranslit\twater\t{H4325}\tHNcmpa\t\t\tH4325\t\t\t`,
      "TAHOT fixture.txt",
      1
    )!;
    const occurrence: OriginalStrongOccurrence = {
      occurrenceId: `${row.id}.main:0`,
      tokenId: `${row.id}.main`,
      tokenIndex: 1,
      sourceIdentity: row.id,
      strong: "H4325",
      sourceStrong: "H4325",
      text: row.surface,
      gloss: row.gloss,
      lemma: row.surface,
      morph: "HNcmpa",
      pos: ""
    };
    const result = resolveCanonicalVerse({
      bible: "s21",
      verse: {
        ref: "Gen.1.1",
        text: "eaux",
        tokens: [{ wordIndex: 0, text: "eaux", normalized: "eaux" }],
        annotations: [
          {
            id: "a",
            strong: "H4325",
            visibility: "reader",
            placement: "word",
            source: "reference-transfer",
            confidence: 0.99,
            reason: "fixture",
            diagnostics: ["exact"],
            wordIndex: 0,
            originalOccurrenceId: occurrence.occurrenceId
          }
        ]
      },
      input: { occurrences: [occurrence], references: [], issues: [] },
      sourceRows: new Map([[row.id, row]]),
      lexicalItems: []
    });
    assert.equal(result.decisions[0].state, expected);
    assert.equal(
      result.decisions[0].source.readingAssessment?.rawReading,
      reading
    );
    assert.equal(result.policy, "autonomous-fr-occurrences-v2");
  }
});

test("minor recovery recomputes a newly supported grammatical empty with a separate anchor", () => {
  const codes = ["H7200", "H0853", "H1004"],
    morphs = ["HVqp3ms", "HTo", "HTd/Ncmsa"];
  const rows = codes.map((code, i) =>
    parseSourceRow(
      `Gen.1.1#0${i + 1}=${i === 0 ? "L(p)" : "L"}\ts${i}\ttranslit\tgloss\t{${code}}\t${morphs[i]}\t\t\t${code}\t\t\t`,
      "TAHOT fixture.txt",
      i + 1
    )!
  );
  const units = rows.map((r, i) => unit(r, codes[i], morphs[i], i === 0));
  units[1].state = "unresolved";
  const initial: ReconstructionVerse = {
    ref: "Gen.1.1",
    text: "Il voit la maison",
    words: ["Il", "voit", "la", "maison"],
    units,
    placements: [word(units[0], 1), word(units[2], 3)],
    issues: [],
    unownedAnnotationIds: []
  };
  const result = refineConcordanceFollowup({
    initial,
    sourceRows: new Map(rows.map((r) => [r.id, r])),
    witnesses: [],
    displayEvidence: [],
    policy
  });
  assert.equal(result.prediction.units[0].state, "visible");
  assert.equal(result.prediction.units[1].state, "empty");
  assert.equal(result.prediction.units[1].anchor?.absenceEstablished, true);
  assert.equal(result.prediction.units[1].anchor?.insertAfterWordIndex, 1);
  assert.equal(
    result.prediction.units[1].grammaticalRelation?.kind,
    "direct-object"
  );
  assert.equal(
    result.prediction.placements.find((p) => p.strong === "H0853")?.kind,
    "empty"
  );
});
