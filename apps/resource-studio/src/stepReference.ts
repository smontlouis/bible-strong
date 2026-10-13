import { referenceKey } from "./strongCsv.js";

export const STEP_TO_OSIS_BOOK = new Map<string, string>([
  ["Gen", "Gen"],
  ["Exo", "Exod"],
  ["Lev", "Lev"],
  ["Num", "Num"],
  ["Deu", "Deut"],
  ["Jos", "Josh"],
  ["Jdg", "Judg"],
  ["Rut", "Ruth"],
  ["1Sa", "1Sam"],
  ["2Sa", "2Sam"],
  ["1Ki", "1Kgs"],
  ["2Ki", "2Kgs"],
  ["1Ch", "1Chr"],
  ["2Ch", "2Chr"],
  ["Ezr", "Ezra"],
  ["Neh", "Neh"],
  ["Est", "Esth"],
  ["Job", "Job"],
  ["Psa", "Ps"],
  ["Pro", "Prov"],
  ["Ecc", "Eccl"],
  ["Sng", "Song"],
  ["Isa", "Isa"],
  ["Jer", "Jer"],
  ["Lam", "Lam"],
  ["Eze", "Ezek"],
  ["Ezk", "Ezek"],
  ["Dan", "Dan"],
  ["Hos", "Hos"],
  ["Joe", "Joel"],
  ["Jol", "Joel"],
  ["Amo", "Amos"],
  ["Oba", "Obad"],
  ["Jon", "Jonah"],
  ["Mic", "Mic"],
  ["Nah", "Nah"],
  ["Nam", "Nah"],
  ["Hab", "Hab"],
  ["Zep", "Zeph"],
  ["Hag", "Hag"],
  ["Zec", "Zech"],
  ["Mal", "Mal"],
  ["Mat", "Matt"],
  ["Mrk", "Mark"],
  ["Mar", "Mark"],
  ["Luk", "Luke"],
  ["Jhn", "John"],
  ["Joh", "John"],
  ["Act", "Acts"],
  ["Rom", "Rom"],
  ["1Co", "1Cor"],
  ["2Co", "2Cor"],
  ["Gal", "Gal"],
  ["Eph", "Eph"],
  ["Php", "Phil"],
  ["Phi", "Phil"],
  ["Col", "Col"],
  ["1Th", "1Thess"],
  ["2Th", "2Thess"],
  ["1Ti", "1Tim"],
  ["2Ti", "2Tim"],
  ["Tit", "Titus"],
  ["Phm", "Phlm"],
  ["Heb", "Heb"],
  ["Jas", "Jas"],
  ["Jam", "Jas"],
  ["1Pe", "1Pet"],
  ["2Pe", "2Pet"],
  ["1Jn", "1John"],
  ["2Jn", "2John"],
  ["3Jn", "3John"],
  ["Jud", "Jude"],
  ["Rev", "Rev"]
]);

export interface StepReferenceVariant {
  ref: string;
  notation: "round" | "square" | "curly";
}
export interface ParsedStepReference {
  key: string;
  /** The French reference projection uses round-bracket coordinates only. */
  alternateKeys: string[];
  variants: StepReferenceVariant[];
  tokenIndex: number;
  type: string;
}

/** TAGNT's legend distinguishes NA (round), KJV (square), and other editions
 * (curly). Retain every declared coordinate but never substitute the latter
 * two for the French/NA projection. The existing OT round projection is kept. */
export function parseStepReference(
  input: string
): ParsedStepReference | undefined {
  const m = input
    .replace(/^\uFEFF/u, "")
    .match(
      /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)((?:\(\d+\.\d+\)|\[\d+\.\d+\]|\{\d+\.\d+\})*)#(\d+)=([^\t]+)$/u
    );
  if (!m) return;
  const book = STEP_TO_OSIS_BOOK.get(m[1]);
  if (!book) return;
  const variants: StepReferenceVariant[] = [
    ...m[4].matchAll(/([([{])(\d+)\.(\d+)[)\]}]/gu)
  ].map((v) => ({
    ref: referenceKey(book, v[2], v[3]),
    notation: v[1] === "(" ? "round" : v[1] === "[" ? "square" : "curly"
  }));
  // Multiple contradictory coordinates in one convention need interpretation.
  for (const kind of ["round", "square", "curly"])
    if (variants.filter((v) => v.notation === kind).length > 1) return;
  return {
    key: referenceKey(book, m[2], m[3]),
    alternateKeys: variants
      .filter((v) => v.notation === "round")
      .map((v) => v.ref),
    variants,
    tokenIndex: Number(m[5]),
    type: m[6]
  };
}
