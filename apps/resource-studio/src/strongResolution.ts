import { createHash } from "node:crypto";

/** Evidence about absence and display position must never share one confidence. */
export interface EmptyStrongEvidence {
  absence: {
    status: "unresolved" | "witness-supported" | "linguistic-rule";
    families: string[];
    reason: string;
  };
  anchor: {
    status:
      | "heuristic"
      | "editorial-convention"
      | "neighbor-supported"
      | "existing-fallback";
    method:
      | "witness-relative-position"
      | "previous-source-placement"
      | "occurrence-neighbors";
    insertAfterWordIndex: number;
    reason: string;
  };
}

export function witnessEmptyEvidence(
  families: string[],
  after: number
): EmptyStrongEvidence {
  return {
    absence: {
      status: "witness-supported",
      families: [...new Set(families)].sort(),
      reason:
        "Explicit empty annotations in witness families support a proposal; absence in the target verse has not been established."
    },
    anchor: {
      status: "heuristic",
      method: "witness-relative-position",
      insertAfterWordIndex: after,
      reason:
        "Position projected by relative witness length; neighboring target carriers have not validated this position."
    }
  };
}

export function unresolvedEmptyEvidence(after: number): EmptyStrongEvidence {
  return {
    absence: {
      status: "unresolved",
      families: [],
      reason:
        "No reliable carrier was assigned. Failed placement is not evidence of absent translation."
    },
    anchor: {
      status: "heuristic",
      method: "previous-source-placement",
      insertAfterWordIndex: after,
      reason:
        "Legacy display fallback based on earlier source assignments; not a reviewed insertion point."
    }
  };
}

export interface ResolutionCarrier {
  id: string;
  strong: string;
  kind: "word" | "phrase" | "empty";
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
  originalOccurrenceId?: string;
}
export interface ResolutionUnit {
  id: string;
  occurrenceIds: string[];
  strong: string[];
  readingUnresolved: boolean;
  sourceEvidenceSha256: string;
}
export interface AnchorNeighbor {
  side: "left" | "right";
  strong: string;
  carrierId: string;
  sourceUnitId?: string;
}
export interface AnchorProposal {
  status: "supported" | "unresolved";
  method: "witness-neighbors" | "source-neighbors" | "witness-and-source";
  interval?: [number, number];
  insertAfterWordIndex?: number;
  neighbors: AnchorNeighbor[];
  families: string[];
  reasons: string[];
}
export interface ResolutionWitness {
  name: string;
  family: string;
  placements: ResolutionCarrier[];
}

function visible(p: ResolutionCarrier) {
  return p.kind !== "empty";
}
function boundaryProposal(
  method: AnchorProposal["method"],
  left: ResolutionCarrier | undefined,
  right: ResolutionCarrier | undefined,
  wordCount: number,
  families: string[] = []
): AnchorProposal {
  const neighbors: AnchorNeighbor[] = [
    ...(left
      ? [{ side: "left" as const, strong: left.strong, carrierId: left.id }]
      : []),
    ...(right
      ? [{ side: "right" as const, strong: right.strong, carrierId: right.id }]
      : [])
  ];
  if (!left && !right)
    return {
      status: "unresolved",
      method,
      neighbors,
      families,
      reasons: ["no-identifiable-neighbor"]
    };
  const lower = left?.endWordIndex ?? -1;
  const upper = right ? right.startWordIndex! - 1 : wordCount - 1;
  if (
    !Number.isInteger(lower) ||
    !Number.isInteger(upper) ||
    lower < -1 ||
    upper >= wordCount ||
    lower > upper
  )
    return {
      status: "unresolved",
      method,
      neighbors,
      families,
      reasons: ["reordered-or-overlapping-neighbors"]
    };
  return {
    status: lower === upper ? "supported" : "unresolved",
    method,
    interval: [lower, upper],
    insertAfterWordIndex: lower === upper ? lower : undefined,
    neighbors,
    families,
    reasons: [
      lower === upper ? "unique-neighbor-boundary" : "multiple-insertion-points"
    ]
  };
}

/** Repetitions without an occurrence correspondence are never paired by ordinal guess. */
export function witnessNeighborAnchor(
  strong: string,
  witnesses: ResolutionWitness[],
  target: ResolutionCarrier[],
  wordCount: number
): AnchorProposal {
  const proposals: AnchorProposal[] = [];
  const reasons: string[] = [];
  for (const witness of witnesses) {
    const matching = witness.placements.filter((p) => p.strong === strong);
    if (matching.length !== 1 || matching[0].kind !== "empty") {
      reasons.push(
        `${witness.name}:${matching.length > 1 ? "ambiguous-repetition" : matching.length ? "visible-witness" : "untagged-witness"}`
      );
      continue;
    }
    const empty = matching[0];
    const mapped = witness.placements.filter(visible).flatMap((p) => {
      const sourceMatches = witness.placements.filter(
        (q) => q.strong === p.strong
      );
      const targetMatches = target.filter(
        (q) => q.strong === p.strong && visible(q)
      );
      if (sourceMatches.length !== 1 || targetMatches.length !== 1) return [];
      return [{ from: p, to: targetMatches[0] }];
    });
    const before = mapped
      .filter((p) => p.from.endWordIndex! <= empty.insertAfterWordIndex!)
      .sort(
        (a, b) =>
          b.from.endWordIndex! - a.from.endWordIndex! ||
          a.from.id.localeCompare(b.from.id)
      );
    const after = mapped
      .filter((p) => p.from.startWordIndex! > empty.insertAfterWordIndex!)
      .sort(
        (a, b) =>
          a.from.startWordIndex! - b.from.startWordIndex! ||
          a.from.id.localeCompare(b.from.id)
      );
    // Several identities on the same witness boundary must point to the same target boundary.
    const left = before.filter(
      (p) => p.from.endWordIndex === before[0]?.from.endWordIndex
    );
    const right = after.filter(
      (p) => p.from.startWordIndex === after[0]?.from.startWordIndex
    );
    if (
      new Set(left.map((p) => p.to.endWordIndex)).size > 1 ||
      new Set(right.map((p) => p.to.startWordIndex)).size > 1
    ) {
      proposals.push({
        status: "unresolved",
        method: "witness-neighbors",
        families: [witness.family],
        neighbors: [],
        reasons: ["ambiguous-neighbor-identities"]
      });
      continue;
    }
    proposals.push(
      boundaryProposal(
        "witness-neighbors",
        left[0]?.to,
        right[0]?.to,
        wordCount,
        [witness.family]
      )
    );
  }
  const merged = intersectAnchors(proposals, "witness-neighbors");
  return { ...merged, reasons: [...merged.reasons, ...reasons] };
}

export function sourceNeighborAnchor(
  unit: ResolutionUnit,
  units: ResolutionUnit[],
  target: ResolutionCarrier[],
  wordCount: number
): AnchorProposal {
  const index = units.findIndex((u) => u.id === unit.id);
  if (index < 0) throw new Error("unknown-source-unit");
  if (unit.readingUnresolved)
    return {
      status: "unresolved",
      method: "source-neighbors",
      neighbors: [],
      families: [],
      reasons: ["unresolved-source-reading"]
    };
  const located = (u: ResolutionUnit) => {
    if (u.readingUnresolved) return undefined;
    const placements = target.filter(
      (p) =>
        visible(p) &&
        p.originalOccurrenceId &&
        u.occurrenceIds.includes(p.originalOccurrenceId)
    );
    const spans = new Set(
      placements.map((p) => `${p.startWordIndex}:${p.endWordIndex}`)
    );
    return spans.size === 1 ? placements[0] : undefined;
  };
  const previous = units
    .slice(0, index)
    .reverse()
    .map((u) => ({ unit: u, p: located(u) }))
    .find((p) => p.p);
  const next = units
    .slice(index + 1)
    .map((u) => ({ unit: u, p: located(u) }))
    .find((p) => p.p);
  const out = boundaryProposal(
    "source-neighbors",
    previous?.p,
    next?.p,
    wordCount
  );
  out.neighbors = out.neighbors.map((n) => ({
    ...n,
    sourceUnitId: n.side === "left" ? previous?.unit.id : next?.unit.id
  }));
  return out;
}

export function intersectAnchors(
  proposals: AnchorProposal[],
  method: AnchorProposal["method"] = "witness-and-source"
): AnchorProposal {
  const families = [...new Set(proposals.flatMap((p) => p.families))].sort();
  const neighbors = proposals.flatMap((p) => p.neighbors);
  if (!proposals.length || proposals.some((p) => !p.interval))
    return {
      status: "unresolved",
      method,
      families,
      neighbors,
      reasons: [
        "missing-or-conflicting-anchor-evidence",
        ...proposals.flatMap((p) => p.reasons)
      ]
    };
  const lower = Math.max(...proposals.map((p) => p.interval![0]));
  const upper = Math.min(...proposals.map((p) => p.interval![1]));
  if (lower > upper)
    return {
      status: "unresolved",
      method,
      families,
      neighbors,
      reasons: ["disagreeing-anchor-intervals"]
    };
  return {
    status: lower === upper ? "supported" : "unresolved",
    method,
    families,
    neighbors,
    interval: [lower, upper],
    insertAfterWordIndex: lower === upper ? lower : undefined,
    reasons: [
      lower === upper
        ? "unique-shared-boundary"
        : "multiple-shared-insertion-points"
    ]
  };
}

export const resolutionTextHash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const resolutionSourceHash = (unit: ResolutionUnit) =>
  resolutionTextHash(JSON.stringify(unit));
export interface ReviewedTranslationDecision {
  ref: string;
  targetTextSha256: string;
  sourceUnitSha256: string;
  sourceUnitId: string;
  reviewer: string;
  rationale: string;
  state: "visible" | "empty";
  targetWordIndices: number[];
}
export interface OccurrenceResolution {
  sourceUnitId: string;
  state: "visible" | "empty" | "unresolved";
  assurance: "existing-generator" | "reviewed" | "unresolved";
  targetWordIndices: number[];
  reasons: string[];
  anchor?: AnchorProposal;
  emptyWitnessFamilies: string[];
  visibleWitnessFamilies: string[];
}

/** Structural review validation is not a philological verification of the reviewer. */
export function resolveOccurrence(options: {
  ref: string;
  text: string;
  wordCount: number;
  unit: ResolutionUnit;
  placements: ResolutionCarrier[];
  witnesses: ResolutionWitness[];
  anchor: AnchorProposal;
  review?: ReviewedTranslationDecision;
}): OccurrenceResolution {
  const { unit, review } = options;
  const explicit = options.witnesses.flatMap((w) =>
    w.placements
      .filter((p) => unit.strong.includes(p.strong))
      .map((p) => ({ family: w.family, empty: p.kind === "empty" }))
  );
  const evidence = {
    emptyWitnessFamilies: [
      ...new Set(explicit.filter((p) => p.empty).map((p) => p.family))
    ].sort(),
    visibleWitnessFamilies: [
      ...new Set(explicit.filter((p) => !p.empty).map((p) => p.family))
    ].sort()
  };
  const base = { sourceUnitId: unit.id, ...evidence };
  if (review) {
    if (!["visible", "empty"].includes(review.state))
      throw new Error("invalid-reviewed-state");
    if (
      review.ref !== options.ref ||
      review.sourceUnitId !== unit.id ||
      review.targetTextSha256 !== resolutionTextHash(options.text) ||
      review.sourceUnitSha256 !== resolutionSourceHash(unit)
    )
      throw new Error("stale-or-misbound-translation-review");
    if (
      !review.reviewer.trim() ||
      !review.rationale.trim() ||
      unit.readingUnresolved
    )
      throw new Error("incomplete-translation-review");
    if (
      new Set(review.targetWordIndices).size !==
        review.targetWordIndices.length ||
      review.targetWordIndices.some(
        (i) => !Number.isInteger(i) || i < 0 || i >= options.wordCount
      ) ||
      (review.state === "empty") !== (review.targetWordIndices.length === 0)
    )
      throw new Error("invalid-reviewed-target");
    return {
      ...base,
      state: review.state,
      assurance: "reviewed",
      targetWordIndices: [...review.targetWordIndices],
      reasons: [review.rationale],
      anchor: review.state === "empty" ? options.anchor : undefined
    };
  }
  const existing = options.placements.filter(
    (p) =>
      visible(p) &&
      p.originalOccurrenceId &&
      unit.occurrenceIds.includes(p.originalOccurrenceId)
  );
  const spans = new Set(
    existing.map((p) => `${p.startWordIndex}:${p.endWordIndex}`)
  );
  if (!unit.readingUnresolved && spans.size === 1) {
    const p = existing[0];
    return {
      ...base,
      state: "visible",
      assurance: "existing-generator",
      targetWordIndices: Array.from(
        { length: p.endWordIndex! - p.startWordIndex! + 1 },
        (_, i) => p.startWordIndex! + i
      ),
      reasons: ["existing-carrier-not-independently-reviewed"]
    };
  }
  return {
    ...base,
    state: "unresolved",
    assurance: "unresolved",
    targetWordIndices: [],
    anchor: options.anchor,
    reasons: [
      unit.readingUnresolved
        ? "unresolved-source-reading"
        : spans.size > 1
          ? "competing-existing-carriers"
          : evidence.emptyWitnessFamilies.length
            ? "witness-absence-does-not-establish-target-absence"
            : "missing-carrier-is-not-absent-translation"
    ]
  };
}
