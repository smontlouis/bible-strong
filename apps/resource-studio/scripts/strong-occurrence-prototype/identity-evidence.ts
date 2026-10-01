import { baseStrong, type SourceUnit } from "./model.js";

export interface LexiconIdentity {
  code: string;
  relation: string;
  target: string;
  headword: string;
  file: string;
  line: number;
}
/** Read identity metadata only, not unrestricted Strong references in definitions. */
export function readIdentityEvidence(text: string, file: string) {
  const index = new Map<string, LexiconIdentity[]>();
  for (const [i, line] of text.split(/\r?\n/u).entries()) {
    const p = line.split("\t");
    if (!/^G\d{4,5}$/u.test(p[0] ?? "") || p.length < 7) continue;
    const records = index.get(p[0]) ?? [];
    records.push({
      code: p[0],
      relation: p[1],
      target: p[2],
      headword: p[3],
      file,
      line: i + 1
    });
    index.set(p[0], records);
  }
  return index;
}
export function identityEvidence(
  units: SourceUnit[],
  index: Map<string, LexiconIdentity[]>
) {
  return units
    .filter((u) => u.logicalStrong.length > 1)
    .map((unit) => {
      const records = unit.logicalStrong.flatMap(
        (code) => index.get(code) ?? []
      );
      const decompositions = records.flatMap((r) => {
        if (!r.relation.endsWith("= a Combination of")) return [];
        const expression = r.target.match(/\((G\d+(?:\+G\d+)+)\)/u)?.[1];
        if (!expression) return []; // A label alone does not provide components (e.g. G4275).
        const components = expression.split("+");
        // Only suggest an exact, adjacent, variant-free source span. An alias on a
        // single row does not prove all components occur in this textual reading.
        const matchingSpans: string[][] = [];
        for (
          let start = 0;
          start <= units.length - components.length;
          start++
        ) {
          const slice = units.slice(start, start + components.length);
          if (!slice.some((u) => u.id === unit.id)) continue;
          if (
            slice.every(
              (u, i) =>
                u.row.reading === "NKO" &&
                !u.row.evidence.meaningVariants &&
                u.row.primary.length === 1 &&
                baseStrong(u.row.primary[0]) === components[i] &&
                (i === 0 ||
                  u.row.tokenIndex === slice[i - 1].row.tokenIndex + 1)
            )
          ) {
            matchingSpans.push(slice.map((u) => u.id));
          }
        }
        return [
          {
            combinedCode: r.code,
            componentCodes: components,
            matchingSourceSpans: matchingSpans,
            evidence: r
          }
        ];
      });
      const family = (code: string) => {
        const candidates = index.get(code) ?? [];
        // Multiple senses are not resolved by stripping the suffix.
        if (candidates.length !== 1) return undefined;
        const r = candidates[0];
        if (
          /= a (Form|Spelling) of$/u.test(r.relation) &&
          /^G\d{4,5}[A-Za-z]?$/u.test(r.target)
        )
          return baseStrong(r.target);
        if (r.relation === `${code} =` && r.target === code) return code;
        return undefined;
      };
      const families = unit.logicalStrong.map(family);
      const status =
        unit.structure === "variant-conditioned"
          ? "variant-conditioned"
          : decompositions.length
            ? "documented-decomposition"
            : families.every(Boolean) && new Set(families).size === 1
              ? "documented-form-or-spelling-family"
              : "unresolved";
      return { unitId: unit.id, status, records, decompositions };
    });
}
