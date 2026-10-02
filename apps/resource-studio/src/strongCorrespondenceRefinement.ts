import type { VerseCorrespondenceBlock } from "./verseCorrespondence.js";

/** Refine complete connected groups using unique exact witness texts. Never
 * fill unmatched gaps, discard source verses, or force a non-monotone order. */
export function refineExactCorrespondence(
  blocks: VerseCorrespondenceBlock[],
  exact: ReadonlyMap<string, { canonicalRef: string; witnesses: string[] }>,
  conflictedTargets: ReadonlySet<string> = new Set()
): {
  blocks: VerseCorrespondenceBlock[];
  repairs: Array<{
    before: VerseCorrespondenceBlock[];
    after: VerseCorrespondenceBlock[];
  }>;
} {
  const owner = new Map(
    blocks.flatMap((b, i) => b.canonicalRefs.map((r) => [r, i] as const))
  );
  const edges = blocks.map(() => new Set<number>());
  blocks.forEach((b, i) => {
    for (const target of b.targetRefs) {
      const matched = exact.get(target);
      const j = matched ? owner.get(matched.canonicalRef) : undefined;
      if (j !== undefined) {
        edges[i].add(j);
        edges[j].add(i);
      }
    }
  });
  const seen = new Set<number>(),
    replacements = new Map<number, VerseCorrespondenceBlock[]>(),
    removed = new Set<number>();
  const repairs: Array<{
    before: VerseCorrespondenceBlock[];
    after: VerseCorrespondenceBlock[];
  }> = [];
  const uncertain = new Set<number>();
  for (let i = 0; i < blocks.length; i++) {
    if (seen.has(i)) continue;
    const component: number[] = [],
      pending = [i];
    while (pending.length) {
      const j = pending.pop()!;
      if (seen.has(j)) continue;
      seen.add(j);
      component.push(j);
      pending.push(...edges[j]);
    }
    component.sort((a, b) => a - b);
    if (
      component.some((j) =>
        blocks[j].targetRefs.some((r) => conflictedTargets.has(r))
      )
    )
      component.forEach((j) => uncertain.add(j));
    if (component.at(-1)! - component[0] + 1 !== component.length) continue;
    const before = component.map((j) => blocks[j]);
    const targets = before.flatMap((b) => b.targetRefs),
      canonical = before.flatMap((b) => b.canonicalRefs);
    if (!targets.length || targets.length !== canonical.length) continue;
    const matches = targets.map((t) => exact.get(t));
    if (matches.some((m, j) => !m || m.canonicalRef !== canonical[j])) continue;
    if (
      before.every(
        (b) => b.targetRefs.length === 1 && b.canonicalRefs.length === 1
      )
    )
      continue;
    const after = targets.map((target, j): VerseCorrespondenceBlock => ({
      targetRefs: [target],
      canonicalRefs: [canonical[j]],
      kind:
        target === canonical[j]
          ? "identity"
          : target.split(".")[1] === canonical[j].split(".")[1]
            ? "shift"
            : "chapter-boundary",
      reason: `unique-exact-witness-text-bijection:${matches[j]!.witnesses.join("+")}`,
      evidence: { score: 1 }
    }));
    replacements.set(component[0], after);
    component.forEach((j) => uncertain.delete(j));
    component.slice(1).forEach((j) => removed.add(j));
    repairs.push({ before, after });
  }
  return {
    blocks: blocks.flatMap(
      (b, i) =>
        replacements.get(i) ??
        (removed.has(i)
          ? []
          : [
              uncertain.has(i)
                ? {
                    ...b,
                    reason: [
                      b.reason,
                      "unresolved-exact-text-witness-correspondence"
                    ]
                      .filter(Boolean)
                      .join("; ")
                  }
                : b
            ])
    ),
    repairs
  };
}
