import type { CarrierPlacement } from "../../src/evaluateStrongGold.js";
import {
  candidateSpan,
  carrierKey,
  spanKey,
  type BaselineVerse,
  type EvalVerse
} from "./shared.js";

export interface Links {
  ref: string;
  seed: number;
  forward: [number, number][];
  reverse: [number, number][];
  elapsedMs?: number;
}
export type Direction = "intersection" | "union";
export const POLICIES = [
  "stable-intersection",
  "stable-intersection-lexical",
  "stable-union-lexical"
] as const;
export type Policy = (typeof POLICIES)[number];
type Placement = BaselineVerse["placements"][number];

export function project(verse: EvalVerse, links: Links, direction: Direction) {
  const fwd = new Set(links.forward.map(([i, j]) => `${i}:${j}`));
  const rev = new Set(links.reverse.map(([i, j]) => `${i}:${j}`));
  const chosen =
    direction === "intersection"
      ? [...fwd].filter((p) => rev.has(p))
      : [...new Set([...fwd, ...rev])];
  const targets = new Map<number, number[]>();
  for (const p of chosen) {
    const [i, j] = p.split(":").map(Number);
    if (
      !verse.source[i] ||
      !Number.isInteger(j) ||
      j < 0 ||
      j >= verse.words.length
    )
      throw new Error("invalid-link");
    const list = targets.get(i) ?? [];
    list.push(j);
    targets.set(i, list);
  }
  const placements = new Map<number, Placement>();
  let discontinuous = 0;
  for (const [i, values] of targets) {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    if (sorted.at(-1)! - sorted[0] + 1 !== sorted.length) {
      discontinuous++;
      continue;
    }
    placements.set(i, {
      id: `eflomal:${verse.source[i].occurrenceId}`,
      originalOccurrenceId: verse.source[i].occurrenceId,
      strong: verse.source[i].strong,
      kind: sorted.length === 1 ? "word" : "phrase",
      startWordIndex: sorted[0],
      endWordIndex: sorted.at(-1)!
    });
  }
  return {
    placements,
    discontinuous,
    unlinked: verse.source.length - targets.size
  };
}

export function stableProposals(
  verse: EvalVerse,
  runs: Links[],
  direction: Direction
) {
  if (runs.length !== 3 || new Set(runs.map((r) => r.seed)).size !== 3)
    throw new Error("three-distinct-seeds-required");
  const projections = runs.map(
    (run) => project(verse, run, direction).placements
  );
  return [...projections[0]]
    .filter(([i, p]) =>
      projections.every(
        (m) => m.has(i) && carrierKey(m.get(i)!) === carrierKey(p)
      )
    )
    .map(([, p]) => p);
}

function overlap(a: CarrierPlacement, b: CarrierPlacement) {
  return (
    a.kind !== "empty" &&
    b.kind !== "empty" &&
    a.startWordIndex! <= b.endWordIndex! &&
    b.startWordIndex! <= a.endWordIndex!
  );
}

/** Simultaneous replacement supports swaps; rejected moves restore their old carriers. No gold input. */
export function applyHybrid(
  verse: EvalVerse,
  baseline: BaselineVerse,
  runs: Links[],
  policy: Policy
) {
  const proposals = stableProposals(
    verse,
    runs,
    policy.includes("union") ? "union" : "intersection"
  );
  const accepted = new Map<string, Placement>();
  let noIdentity = 0,
    lexicalRejected = 0,
    unchanged = 0,
    blocked = 0;
  for (const p of proposals) {
    const exact = baseline.placements.filter(
      (b) => b.originalOccurrenceId === p.originalOccurrenceId
    );
    const sameStrong = baseline.placements.filter((b) => b.strong === p.strong);
    const uniqueSource =
      verse.source.filter((s) => s.strong === p.strong).length === 1;
    const previous =
      exact.length === 1
        ? exact[0]
        : uniqueSource && sameStrong.length === 1
          ? sameStrong[0]
          : undefined;
    if (exact.length > 1 || (!previous && sameStrong.length > 0)) {
      noIdentity++;
      continue;
    }
    if (previous && carrierKey(previous) === carrierKey(p)) {
      unchanged++;
      continue;
    }
    if (
      policy.endsWith("lexical") &&
      !baseline.items.some(
        (item) =>
          item.strong === p.strong &&
          (previous ? item.annotationId === previous.id : true) &&
          item.candidates.some(
            (c) =>
              candidateSpan(c) === spanKey(p.startWordIndex!, p.endWordIndex!)
          )
      )
    ) {
      lexicalRejected++;
      continue;
    }
    const id = previous?.id ?? p.id;
    if (accepted.has(id)) throw new Error("two-proposals-one-annotation");
    accepted.set(id, { ...p, id });
  }
  while (true) {
    const preserved = baseline.placements.filter((p) => !accepted.has(p.id));
    const rejected = [...accepted.values()].filter(
      (p) =>
        preserved.some((q) => overlap(p, q)) ||
        [...accepted.values()].some((q) => q.id !== p.id && overlap(p, q))
    );
    if (!rejected.length) break;
    for (const p of rejected) {
      accepted.delete(p.id);
      blocked++;
    }
  }
  return {
    placements: [
      ...baseline.placements.filter((p) => !accepted.has(p.id)),
      ...accepted.values()
    ],
    changed: [...accepted.values()],
    counts: {
      proposed: proposals.length,
      applied: accepted.size,
      noIdentity,
      lexicalRejected,
      unchanged,
      blocked
    }
  };
}
