export interface WeightedMatchEdge<T> {
  left: number;
  right: number;
  weight: number;
  value: T;
}

/**
 * Deterministic maximum-weight one-to-one bipartite matching.
 *
 * Every left node may abstain through its own zero-weight dummy column. Invalid
 * edges therefore never need a magic fallback assignment, and positive edges
 * are selected only when they improve the global objective.
 */
export function maximumWeightMatching<T>(options: {
  leftCount: number;
  rightCount: number;
  edges: WeightedMatchEdge<T>[];
}): WeightedMatchEdge<T>[] {
  const { leftCount, rightCount } = options;
  if (leftCount <= 0 || rightCount <= 0 || options.edges.length === 0) {
    return [];
  }

  const columnCount = rightCount + leftCount;
  const missingWeight = -1_000_000_000;
  const weights = Array.from({ length: leftCount }, () =>
    Array.from({ length: columnCount }, () => missingWeight)
  );
  const edgeByPair = new Map<string, WeightedMatchEdge<T>>();

  for (let left = 0; left < leftCount; left += 1) {
    weights[left]![rightCount + left] = 0;
  }

  for (const edge of options.edges) {
    if (
      edge.left < 0 ||
      edge.left >= leftCount ||
      edge.right < 0 ||
      edge.right >= rightCount ||
      !Number.isFinite(edge.weight)
    ) {
      continue;
    }
    const key = `${edge.left}:${edge.right}`;
    const previous = edgeByPair.get(key);
    if (!previous || edge.weight > previous.weight) {
      edgeByPair.set(key, edge);
      weights[edge.left]![edge.right] = edge.weight;
    }
  }

  // Hungarian algorithm, expressed as minimisation of the negated weights.
  // There are always at least as many columns as rows because of the dummies.
  const u = Array.from({ length: leftCount + 1 }, () => 0);
  const v = Array.from({ length: columnCount + 1 }, () => 0);
  const p = Array.from({ length: columnCount + 1 }, () => 0);
  const way = Array.from({ length: columnCount + 1 }, () => 0);

  for (let row = 1; row <= leftCount; row += 1) {
    p[0] = row;
    let column0 = 0;
    const minValue = Array.from(
      { length: columnCount + 1 },
      () => Number.POSITIVE_INFINITY
    );
    const used = Array.from({ length: columnCount + 1 }, () => false);

    do {
      used[column0] = true;
      const row0 = p[column0]!;
      let delta = Number.POSITIVE_INFINITY;
      let column1 = 0;

      for (let column = 1; column <= columnCount; column += 1) {
        if (used[column]) continue;
        const cost = -weights[row0 - 1]![column - 1]!;
        const current = cost - u[row0]! - v[column]!;
        if (current < minValue[column]!) {
          minValue[column] = current;
          way[column] = column0;
        }
        if (minValue[column]! < delta) {
          delta = minValue[column]!;
          column1 = column;
        }
      }

      for (let column = 0; column <= columnCount; column += 1) {
        if (used[column]) {
          u[p[column]!] = u[p[column]!]! + delta;
          v[column] = v[column]! - delta;
        } else {
          minValue[column] = minValue[column]! - delta;
        }
      }
      column0 = column1;
    } while (p[column0] !== 0);

    do {
      const column1 = way[column0]!;
      p[column0] = p[column1]!;
      column0 = column1;
    } while (column0 !== 0);
  }

  const result: WeightedMatchEdge<T>[] = [];
  for (let column = 1; column <= rightCount; column += 1) {
    const row = p[column]! - 1;
    if (row < 0) continue;
    const edge = edgeByPair.get(`${row}:${column - 1}`);
    if (edge && edge.weight > 0) result.push(edge);
  }

  return result.sort(
    (left, right) => left.left - right.left || left.right - right.right
  );
}
