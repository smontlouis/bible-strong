import assert from "node:assert/strict";
import { normalizeStepStrongCode } from "./lexiconV3/identity.js";
import {
  parseStepReference,
  type StepReferenceVariant
} from "./stepReference.js";
import type { OriginalStrongOccurrence } from "./completeAlignment.js";
import {
  assessSourceReading,
  type SourceReadingAssessment
} from "./strongSourceReading.js";
type SourceVerse = { source: OriginalStrongOccurrence[] };

export interface SourceRow {
  id: string;
  source: "TAGNT" | "TAHOT";
  reference: string;
  referenceVariants?: StepReferenceVariant[];
  tokenIndex: number;
  reading: string;
  file: string;
  line: number;
  surface: string;
  gloss: string;
  primary: string[];
  alternatives: string[];
  technicalMarkers: string[];
  evidence: {
    primary: string;
    instances: string;
    alternatives: string;
    expanded: string;
    meaningVariants: string;
    spellingVariants: string;
    conjoin: string;
    editions: string;
  };
}
export const baseStrong = (code: string) => code.match(/^[GH]\d+/u)![0];
const unique = <T>(xs: T[]) => [...new Set(xs)];
function codes(text: string) {
  return unique(
    [...text.matchAll(/[GH]\d{1,5}[A-Za-z]?(?:_[A-Za-z])?/gu)].map((m) =>
      normalizeStepStrongCode(m[0])!
    )
  );
}
const technical = (code: string) => /^H90\d{2}/u.test(code);

/** Keep raw columns: commas in Alt Strongs do not specify AND versus OR. */
export function parseSourceRow(
  line: string,
  file: string,
  lineNumber: number
): SourceRow | undefined {
  const p = line.split("\t");
  const parsed = parseStepReference(p[0] ?? "");
  if (!parsed) return;
  const source = file.includes("TAGNT") ? "TAGNT" : "TAHOT";
  const greek = source === "TAGNT";
  const primary = greek ? p[3].split("=")[0] : p[4];
  const evidence = {
    primary,
    instances: p[greek ? 11 : 8] ?? "",
    alternatives: p[greek ? 12 : 9] ?? "",
    expanded: greek ? "" : (p[11] ?? ""),
    meaningVariants: p[6] ?? "",
    spellingVariants: p[7] ?? "",
    conjoin: p[10] ?? "",
    editions: greek ? p[5] : ""
  };
  const primaryCodes = codes(`${primary} ${evidence.expanded}`);
  const primaryBases = new Set(primaryCodes.map(baseStrong));
  const reference = parsed.key;
  return {
    id: `${source}.${reference}.${parsed.tokenIndex}.${parsed.type}`,
    source,
    reference,
    ...(parsed.variants.length ? { referenceVariants: parsed.variants } : {}),
    tokenIndex: parsed.tokenIndex,
    reading: parsed.type,
    file,
    line: lineNumber,
    surface: p[1],
    gloss: p[greek ? 2 : 3],
    primary: primaryCodes.filter((c) => !technical(c)),
    alternatives: unique(
      codes(`${evidence.instances} ${evidence.alternatives}`)
        .filter((c) => !technical(c) && !primaryBases.has(baseStrong(c)))
        .map(baseStrong)
    ),
    technicalMarkers: primaryCodes.filter(technical),
    evidence
  };
}

export type Structure =
  | "single-identity"
  | "single-row-alternatives"
  | "variant-conditioned"
  | "multiple-components"
  | "unresolved-alternatives";
export interface SourceUnit {
  readingAssessment?: SourceReadingAssessment;
  id: string;
  row: SourceRow;
  occurrenceIds: string[];
  logicalStrong: string[];
  members: { occurrenceId: string; strong: string }[];
  /** Shape of the source columns, NOT proof of lexical interchangeability. */
  structure: Structure;
  /** Alternatives of sets, never flatten a known multi-component tagging. */
  taggings: { kind: "primary" | "alternative"; codes: string[] }[];
  unresolvedIdentifiers: string[];
}

export function makeUnits(verse: SourceVerse, rows: Map<string, SourceRow>) {
  const groups = new Map<string, SourceVerse["source"]>();
  for (const s of verse.source) {
    assert(s.sourceIdentity, `missing-source-identity:${s.occurrenceId}`);
    const group = groups.get(s.sourceIdentity) ?? [];
    group.push(s);
    groups.set(s.sourceIdentity, group);
  }
  return [...groups].map(([id, members]): SourceUnit => {
    const row = rows.get(id);
    assert(row, `missing-source-row:${id}`);
    const primary = unique(row.primary.map(baseStrong));
    const logicalStrong = unique(members.map((s) => s.strong));
    assert(
      logicalStrong.every((s) => [...primary, ...row.alternatives].includes(s))
    );
    assert(members.every((s) => s.text === row.surface));
    const readingAssessment = assessSourceReading(row, members[0]?.morph);
    const variant = readingAssessment.lexicalReadingUnresolved;
    // A deliberately narrow operational rule, not a global synonym assertion.
    // Hebrew alternative roots and comma-separated Greek lists need adjudication.
    const structure: Structure = variant
      ? "variant-conditioned"
      : primary.length > 1
        ? "multiple-components"
        : !row.alternatives.length
          ? "single-identity"
          : row.source === "TAGNT" && row.alternatives.length === 1
            ? "single-row-alternatives"
            : "unresolved-alternatives";
    return {
      readingAssessment,
      id,
      row,
      occurrenceIds: members.map((s) => s.occurrenceId),
      logicalStrong,
      members: members.map((s) => ({
        occurrenceId: s.occurrenceId,
        strong: s.strong
      })),
      structure,
      taggings: [
        { kind: "primary", codes: primary },
        ...(structure === "single-row-alternatives"
          ? row.alternatives.map((code) => ({
              kind: "alternative" as const,
              codes: [code]
            }))
          : [])
      ],
      unresolvedIdentifiers:
        structure === "single-row-alternatives" ? [] : row.alternatives
    };
  });
}

/** A relation can be many-to-many and discontinuous; it does not choose a display code. */
export interface TranslationRelation {
  sourceUnitIds: string[];
  targetWordIndices: number[];
  status: "proposed" | "reviewed-present" | "reviewed-absent" | "unresolved";
  evidenceIds: string[];
}
export function validateRelation(
  relation: TranslationRelation,
  units: SourceUnit[],
  wordCount: number
) {
  assert(relation.sourceUnitIds.length > 0);
  assert.equal(
    new Set(relation.sourceUnitIds).size,
    relation.sourceUnitIds.length
  );
  assert(relation.sourceUnitIds.every((id) => units.some((u) => u.id === id)));
  assert.equal(
    new Set(relation.targetWordIndices).size,
    relation.targetWordIndices.length
  );
  assert(
    relation.targetWordIndices.every(
      (i) => Number.isInteger(i) && i >= 0 && i < wordCount
    )
  );
  if (relation.status === "reviewed-absent")
    assert.equal(relation.targetWordIndices.length, 0);
  if (relation.status === "proposed" || relation.status === "reviewed-present")
    assert(relation.targetWordIndices.length > 0);
}
