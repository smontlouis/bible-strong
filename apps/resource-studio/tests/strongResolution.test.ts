import assert from "node:assert/strict";
import test from "node:test";
import {
  intersectAnchors,
  resolveOccurrence,
  resolutionSourceHash,
  resolutionTextHash,
  sourceNeighborAnchor,
  witnessNeighborAnchor,
  type AnchorProposal,
  type ResolutionCarrier,
  type ResolutionUnit,
  type ResolutionWitness
} from "../src/strongResolution.js";

const unit = (id: string, strong: string): ResolutionUnit => ({
  id,
  occurrenceIds: [id],
  strong: [strong],
  readingUnresolved: false,
  sourceEvidenceSha256: resolutionTextHash(id)
});
const word = (
  strong: string,
  index: number,
  occurrenceId = strong
): ResolutionCarrier => ({
  id: occurrenceId,
  originalOccurrenceId: occurrenceId,
  strong,
  kind: "word",
  startWordIndex: index,
  endWordIndex: index
});
const empty = (strong: string, index: number): ResolutionCarrier => ({
  id: `empty:${strong}`,
  strong,
  kind: "empty",
  insertAfterWordIndex: index
});
const witness = (
  name: string,
  family: string,
  placements: ResolutionCarrier[]
): ResolutionWitness => ({ name, family, placements });
const uncertain: AnchorProposal = {
  status: "unresolved",
  method: "witness-neighbors",
  neighbors: [],
  families: [],
  reasons: ["no-neighbor"]
};

test("witness neighbors transfer an insertion boundary despite unequal sentence lengths", () => {
  const refs = [
    witness("Sg1910", "Sg1910", [
      word("H0001", 1),
      empty("H0002", 1),
      word("H0003", 2)
    ])
  ];
  const out = witnessNeighborAnchor(
    "H0002",
    refs,
    [word("H0001", 6), word("H0003", 7)],
    12
  );
  assert.equal(out.status, "supported");
  assert.equal(out.insertAfterWordIndex, 6);
  assert.deepEqual(
    out.neighbors.map((n) => n.strong),
    ["H0001", "H0003"]
  );
});
test("a gap gives an interval, not an invented exact anchor", () => {
  const refs = [
    witness("Sg1910", "Sg1910", [
      word("H0001", 0),
      empty("H0002", 0),
      word("H0003", 1)
    ])
  ];
  const out = witnessNeighborAnchor(
    "H0002",
    refs,
    [word("H0001", 2), word("H0003", 6)],
    9
  );
  assert.deepEqual(out.interval, [2, 5]);
  assert.equal(out.status, "unresolved");
  assert.equal(out.insertAfterWordIndex, undefined);
});
test("Darby sisters count once and conflicting sister anchors are retained as uncertainty", () => {
  const refs = [
    witness("Darby", "Darby-family", [
      word("H0001", 0),
      empty("H0002", 0),
      word("H0003", 1)
    ]),
    witness("DarbyR", "Darby-family", [
      word("H0003", 0),
      empty("H0002", 0),
      word("H0004", 1)
    ])
  ];
  const out = witnessNeighborAnchor(
    "H0002",
    refs,
    [word("H0001", 1), word("H0003", 2), word("H0004", 3)],
    4
  );
  assert.deepEqual(out.families, ["Darby-family"]);
  assert.equal(out.status, "unresolved");
  assert(out.reasons.includes("disagreeing-anchor-intervals"));
});
test("repeated Strong witnesses or targets are not matched by a guessed occurrence number", () => {
  const refs = [
    witness("Sg1910", "Sg1910", [
      word("H0001", 0),
      empty("H0002", 0),
      word("H0002", 1)
    ])
  ];
  assert.equal(
    witnessNeighborAnchor("H0002", refs, [word("H0001", 0)], 3).status,
    "unresolved"
  );
  const refs2 = [
    witness("Sg1910", "Sg1910", [word("H0001", 0), empty("H0002", 0)])
  ];
  const out = witnessNeighborAnchor(
    "H0002",
    refs2,
    [word("H0001", 0), word("H0001", 2, "repeat")],
    3
  );
  assert.equal(out.status, "unresolved");
});
test("source anchors reject French reordering and retain occurrence identity across repeats", () => {
  const units = [
    unit("first", "H0001"),
    unit("empty", "H0002"),
    unit("second", "H0001")
  ];
  const out = sourceNeighborAnchor(
    units[1],
    units,
    [word("H0001", 1, "first"), word("H0001", 2, "second")],
    4
  );
  assert.equal(out.insertAfterWordIndex, 1);
  const reversed = sourceNeighborAnchor(
    units[1],
    units,
    [word("H0001", 2, "first"), word("H0001", 1, "second")],
    4
  );
  assert.equal(reversed.status, "unresolved");
  assert(reversed.reasons.includes("reordered-or-overlapping-neighbors"));
});
test("leading and trailing boundaries can be supported by a neighboring carrier", () => {
  const units = [unit("empty", "H0002"), unit("word", "H0001")];
  assert.equal(
    sourceNeighborAnchor(units[0], units, [word("H0001", 0, "word")], 2)
      .insertAfterWordIndex,
    -1
  );
  assert.equal(
    sourceNeighborAnchor(
      units[0],
      [...units].reverse(),
      [word("H0001", 1, "word")],
      2
    ).insertAfterWordIndex,
    1
  );
});
test("witness and source agreement may narrow an interval; conflict is never averaged", () => {
  const left: AnchorProposal = { ...uncertain, interval: [2, 4] };
  assert.equal(
    intersectAnchors([left, { ...uncertain, interval: [4, 6] }])
      .insertAfterWordIndex,
    4
  );
  assert.equal(
    intersectAnchors([left, { ...uncertain, interval: [5, 6] }]).status,
    "unresolved"
  );
});
test("multiple empty witnesses and a certain boundary cannot establish target absence", () => {
  const u = unit("source", "H0002");
  const out = resolveOccurrence({
    ref: "Gen.1.1",
    text: "Dieu",
    wordCount: 1,
    unit: u,
    placements: [],
    witnesses: [
      witness("Sg1910", "Sg1910", [empty("H0002", 0)]),
      witness("Darby", "Darby-family", [empty("H0002", 0)])
    ],
    anchor: {
      ...uncertain,
      status: "supported",
      interval: [0, 0],
      insertAfterWordIndex: 0
    }
  });
  assert.equal(out.state, "unresolved");
  assert.equal(out.emptyWitnessFamilies.length, 2);
  assert.equal(out.anchor?.status, "supported");
});
test("reviewed absence remains established even when the anchor is uncertain", () => {
  const u = unit("source", "H0002");
  const review = {
    ref: "Gen.1.1",
    sourceUnitId: u.id,
    sourceUnitSha256: resolutionSourceHash(u),
    targetTextSha256: resolutionTextHash("Dieu"),
    reviewer: "fixture-reviewer",
    rationale: "Explicit target review fixture",
    state: "empty" as const,
    targetWordIndices: []
  };
  const input = {
    ref: "Gen.1.1",
    text: "Dieu",
    wordCount: 1,
    unit: u,
    placements: [],
    witnesses: [],
    anchor: uncertain,
    review
  };
  const out = resolveOccurrence(input);
  assert.equal(out.state, "empty");
  assert.equal(out.assurance, "reviewed");
  assert.equal(out.anchor?.status, "unresolved");
  const invalidReview = JSON.parse(JSON.stringify(review));
  invalidReview.state = "unsupported-state";
  assert.throws(
    () => resolveOccurrence({ ...input, review: invalidReview }),
    /invalid-reviewed-state/
  );
  assert.throws(
    () => resolveOccurrence({ ...input, text: "Le Dieu" }),
    /stale-or-misbound/
  );
  assert.throws(
    () =>
      resolveOccurrence({
        ...input,
        unit: { ...u, sourceEvidenceSha256: "changed-source" }
      }),
    /stale-or-misbound/
  );
});
test("existing carriers keep their limited assurance and uncertain readings stay unresolved", () => {
  const u = unit("source", "H0002");
  const input = {
    ref: "Gen.1.1",
    text: "Dieu",
    wordCount: 1,
    unit: u,
    placements: [word("H0002", 0, u.id)],
    witnesses: [],
    anchor: uncertain
  };
  assert.equal(resolveOccurrence(input).assurance, "existing-generator");
  assert.equal(
    resolveOccurrence({ ...input, unit: { ...u, readingUnresolved: true } })
      .state,
    "unresolved"
  );
});
