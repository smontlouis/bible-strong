import type { TbeshMeaningClassification } from "./tbeshMeaning.js";

export type TbeshReferenceInput =
  | string
  | {
      book: string;
      chapter: number;
      verse: number;
      /** EntityRefs suffixes are intentionally compared at verse scope. */
      suffix?: string;
    };

export interface TbeshExactDStrongOccurrence {
  dStrong: string;
  /** Omit for one raw token; use an aggregate count for a pre-indexed set. */
  count?: number;
  /** Canonical ref plus any alternate versification refs for this occurrence. */
  references: readonly TbeshReferenceInput[];
}

export type TbeshTipnrScopeProofIssue =
  | "tbesh-scope-section-not-both"
  | "tbesh-scope-not-proper-name"
  | "tbesh-scope-dstrong-invalid"
  | "tbesh-scope-tipnr-identity-not-exact"
  | "tbesh-scope-tipnr-reference-invalid"
  | "tbesh-scope-tipnr-references-missing"
  | "tbesh-scope-specific-citation-invalid"
  | "tbesh-scope-specific-citation-outside-tipnr"
  | "tbesh-scope-exact-occurrence-missing"
  | "tbesh-scope-exact-occurrence-reference-invalid"
  | "tbesh-scope-exact-occurrence-outside-tipnr";

export interface TbeshTipnrScopeProofInput {
  sectionClassification: TbeshMeaningClassification;
  properName: boolean;
  primaryDStrong: string;
  /** Duplicate rows for one entity are allowed; distinct ids are not. */
  tipnrEntityIds: readonly number[];
  /** References from EntityRefs for the exact TIPNR entity. */
  tipnrEntityReferences: readonly TbeshReferenceInput[];
  /** Only citations parsed from the section before § belong here. */
  stepSpecificCitations: readonly TbeshReferenceInput[];
  /** Exact STEP occurrences from TAHOT, including alternate references. */
  tahotOccurrences: readonly TbeshExactDStrongOccurrence[];
}

export interface TbeshTipnrScopeProof {
  proven: boolean;
  issueCodes: TbeshTipnrScopeProofIssue[];
  normalizedDStrong: string | null;
  tipnrEntityId: number | null;
  facts: {
    exactTipnrIdentity: boolean;
    allSpecificCitationsBelongToEntity: boolean;
    exactOccurrenceCount: number;
    exactOccurrenceIntersectsEntity: boolean;
  };
  references: {
    stepSpecificCitations: string[];
    tipnrEntity: string[];
    exactTahotOccurrences: string[];
  };
}

const EXACT_DSTRONG_PATTERN = /^([GH])0*(\d{1,5})([A-Za-z]?)(?:_([A-Za-z]))?$/i;
const STRING_REFERENCE_PATTERN =
  /^([1-3]?[A-Za-z]+)\s*\.\s*(\d+)\s*[.:]\s*(\d+)(?:[a-z])?$/i;

const OSIS_BOOK_BY_ALIAS = buildBookAliasMap({
  Gen: ["Gen"],
  Exod: ["Exod", "Exo"],
  Lev: ["Lev"],
  Num: ["Num"],
  Deut: ["Deut", "Deu"],
  Josh: ["Josh", "Jos"],
  Judg: ["Judg", "Jdg"],
  Ruth: ["Ruth", "Rut"],
  "1Sam": ["1Sam", "1Sa"],
  "2Sam": ["2Sam", "2Sa"],
  "1Kgs": ["1Kgs", "1Ki"],
  "2Kgs": ["2Kgs", "2Ki"],
  "1Chr": ["1Chr", "1Ch"],
  "2Chr": ["2Chr", "2Ch"],
  Ezra: ["Ezra", "Ezr"],
  Neh: ["Neh"],
  Esth: ["Esth", "Est"],
  Job: ["Job"],
  Ps: ["Ps", "Psa"],
  Prov: ["Prov", "Pro"],
  Eccl: ["Eccl", "Ecc"],
  Song: ["Song", "Sng"],
  Isa: ["Isa"],
  Jer: ["Jer"],
  Lam: ["Lam"],
  Ezek: ["Ezek", "Eze", "Ezk"],
  Dan: ["Dan"],
  Hos: ["Hos"],
  Joel: ["Joel", "Jol"],
  Amos: ["Amos", "Amo"],
  Obad: ["Obad", "Oba"],
  Jonah: ["Jonah", "Jon"],
  Mic: ["Mic"],
  Nah: ["Nah", "Nam"],
  Hab: ["Hab"],
  Zeph: ["Zeph", "Zep"],
  Hag: ["Hag"],
  Zech: ["Zech", "Zec"],
  Mal: ["Mal"],
  Matt: ["Matt", "Mat"],
  Mark: ["Mark", "Mrk"],
  Luke: ["Luke", "Luk"],
  John: ["John", "Jhn"],
  Acts: ["Acts", "Act"],
  Rom: ["Rom"],
  "1Cor": ["1Cor", "1Co"],
  "2Cor": ["2Cor", "2Co"],
  Gal: ["Gal"],
  Eph: ["Eph"],
  Phil: ["Phil", "Php"],
  Col: ["Col"],
  "1Thess": ["1Thess", "1Th"],
  "2Thess": ["2Thess", "2Th"],
  "1Tim": ["1Tim", "1Ti"],
  "2Tim": ["2Tim", "2Ti"],
  Titus: ["Titus", "Tit"],
  Phlm: ["Phlm", "Phm"],
  Heb: ["Heb"],
  Jas: ["Jas"],
  "1Pet": ["1Pet", "1Pe"],
  "2Pet": ["2Pet", "2Pe"],
  "1John": ["1John", "1Jn"],
  "2John": ["2John", "2Jn"],
  "3John": ["3John", "3Jn"],
  Jude: ["Jude", "Jud"],
  Rev: ["Rev"]
});

/** Normalizes only prefix/padding: STEP suffix and variant case remain data. */
export function normalizeExactDStrong(value: string): string | null {
  const match = EXACT_DSTRONG_PATTERN.exec(value.trim());
  if (!match) return null;
  const number = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isInteger(number) || number < 1) return null;
  const suffix = match[3] ?? "";
  const variant = match[4] ? `_${match[4]}` : "";
  return `${match[1]?.toUpperCase()}${String(number).padStart(4, "0")}${suffix}${variant}`;
}

/**
 * Converts STEP or OSIS references to a verse-level OSIS key. Entity suffixes
 * such as `a`/`b` are deliberately collapsed because TBESH citations and
 * TAHOT alternate references are audited at verse scope.
 */
export function normalizeStepOrOsisVerseReference(
  reference: TbeshReferenceInput
): string | null {
  if (typeof reference === "string") {
    const match = STRING_REFERENCE_PATTERN.exec(reference.trim());
    if (!match) return null;
    return normalizedReference(
      match[1] ?? "",
      Number.parseInt(match[2] ?? "", 10),
      Number.parseInt(match[3] ?? "", 10)
    );
  }

  return normalizedReference(
    reference.book,
    reference.chapter,
    reference.verse
  );
}

/**
 * Produces a fail-closed proof that a section before § is scoped to one exact
 * TIPNR entity and is independently instantiated by the same case-sensitive
 * dStrong in TAHOT. Legacy-general references are intentionally absent from
 * this API and therefore cannot satisfy the proof.
 */
export function proveStrictTbeshTipnrScope(
  input: TbeshTipnrScopeProofInput
): TbeshTipnrScopeProof {
  const issues = new Set<TbeshTipnrScopeProofIssue>();
  if (input.sectionClassification !== "both") {
    issues.add("tbesh-scope-section-not-both");
  }
  if (!input.properName) issues.add("tbesh-scope-not-proper-name");

  const normalizedDStrong = normalizeExactDStrong(input.primaryDStrong);
  if (!normalizedDStrong) issues.add("tbesh-scope-dstrong-invalid");

  const validEntityIds = input.tipnrEntityIds.filter(
    (id) => Number.isSafeInteger(id) && id > 0
  );
  const distinctEntityIds = [...new Set(validEntityIds)].sort(
    (left, right) => left - right
  );
  const exactTipnrIdentity =
    validEntityIds.length === input.tipnrEntityIds.length &&
    distinctEntityIds.length === 1;
  if (!exactTipnrIdentity) {
    issues.add("tbesh-scope-tipnr-identity-not-exact");
  }

  const entityReferences = normalizeReferences(input.tipnrEntityReferences);
  if (entityReferences.invalidCount > 0) {
    issues.add("tbesh-scope-tipnr-reference-invalid");
  }
  if (entityReferences.values.length === 0) {
    issues.add("tbesh-scope-tipnr-references-missing");
  }
  const entityReferenceSet = new Set(entityReferences.values);

  const specificCitations = normalizeReferences(input.stepSpecificCitations);
  if (specificCitations.invalidCount > 0) {
    issues.add("tbesh-scope-specific-citation-invalid");
  }
  const allSpecificCitationsBelongToEntity =
    specificCitations.invalidCount === 0 &&
    specificCitations.values.every((reference) =>
      entityReferenceSet.has(reference)
    );
  if (!allSpecificCitationsBelongToEntity) {
    issues.add("tbesh-scope-specific-citation-outside-tipnr");
  }

  const exactOccurrences = normalizedDStrong
    ? input.tahotOccurrences.filter(
        (occurrence) =>
          normalizeExactDStrong(occurrence.dStrong) === normalizedDStrong &&
          occurrenceCount(occurrence) > 0
      )
    : [];
  const exactOccurrenceCount = exactOccurrences.reduce(
    (sum, occurrence) => sum + occurrenceCount(occurrence),
    0
  );
  if (exactOccurrenceCount === 0) {
    issues.add("tbesh-scope-exact-occurrence-missing");
  }
  const occurrenceReferences = normalizeReferences(
    exactOccurrences.flatMap((occurrence) => occurrence.references)
  );
  if (
    occurrenceReferences.invalidCount > 0 &&
    occurrenceReferences.values.length === 0
  ) {
    issues.add("tbesh-scope-exact-occurrence-reference-invalid");
  }
  const exactOccurrenceIntersectsEntity = occurrenceReferences.values.some(
    (reference) => entityReferenceSet.has(reference)
  );
  if (exactOccurrenceCount > 0 && !exactOccurrenceIntersectsEntity) {
    issues.add("tbesh-scope-exact-occurrence-outside-tipnr");
  }

  const issueCodes = [...issues].sort();
  return {
    proven: issueCodes.length === 0,
    issueCodes,
    normalizedDStrong,
    tipnrEntityId: exactTipnrIdentity ? (distinctEntityIds[0] ?? null) : null,
    facts: {
      exactTipnrIdentity,
      allSpecificCitationsBelongToEntity,
      exactOccurrenceCount,
      exactOccurrenceIntersectsEntity
    },
    references: {
      stepSpecificCitations: specificCitations.values,
      tipnrEntity: entityReferences.values,
      exactTahotOccurrences: occurrenceReferences.values
    }
  };
}

function occurrenceCount(occurrence: TbeshExactDStrongOccurrence): number {
  const count = occurrence.count ?? 1;
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

function normalizedReference(
  rawBook: string,
  chapter: number,
  verse: number
): string | null {
  if (
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    !Number.isSafeInteger(verse) ||
    verse < 1
  ) {
    return null;
  }
  const book = OSIS_BOOK_BY_ALIAS.get(rawBook.trim().toLowerCase());
  return book ? `${book}.${chapter}.${verse}` : null;
}

function normalizeReferences(references: readonly TbeshReferenceInput[]): {
  values: string[];
  invalidCount: number;
} {
  const values = new Set<string>();
  let invalidCount = 0;
  for (const reference of references) {
    const normalized = normalizeStepOrOsisVerseReference(reference);
    if (normalized) values.add(normalized);
    else invalidCount += 1;
  }
  return { values: [...values].sort(), invalidCount };
}

function buildBookAliasMap(
  aliasesByOsis: Readonly<Record<string, readonly string[]>>
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const [osis, aliases] of Object.entries(aliasesByOsis)) {
    for (const alias of aliases) result.set(alias.toLowerCase(), osis);
  }
  return result;
}
