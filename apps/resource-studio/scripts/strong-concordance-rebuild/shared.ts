import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Every artifact of this experiment lives below this ignored directory. */
export const OUT_ROOT = "outputs/strong-concordance-night";
/** Raw Concordance pages and their receipts: readable only by the evaluator. */
export const ACQUISITION_ROOT = path.join(OUT_ROOT, "acquisition");
export const EVALUATOR_ROOT = path.join(OUT_ROOT, "evaluator-only");

export const sha256 = (data: string | Buffer): string =>
  createHash("sha256").update(data).digest("hex");

export async function fileSha256(file: string): Promise<string> {
  return sha256(await readFile(file));
}

/** Deterministic JSON with sorted object keys, used for hashing and sealing. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/** Write once: experiment artifacts are immutable, a new run needs a new path. */
export async function writeJsonOnce(
  file: string,
  data: unknown
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
}

export async function writeTextOnce(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, { flag: "wx" });
}

export type Testament = "OT" | "NT";

export const GENRE_GROUPS: Array<{ id: string; books: string[] }> = [
  { id: "law", books: ["Gen", "Exod", "Lev", "Num", "Deut"] },
  {
    id: "history",
    books: [
      "Josh",
      "Judg",
      "Ruth",
      "1Sam",
      "2Sam",
      "1Kgs",
      "2Kgs",
      "1Chr",
      "2Chr",
      "Ezra",
      "Neh",
      "Esth"
    ]
  },
  { id: "poetry-wisdom", books: ["Job", "Ps", "Prov", "Eccl", "Song"] },
  { id: "major-prophets", books: ["Isa", "Jer", "Lam", "Ezek", "Dan"] },
  {
    id: "minor-prophets",
    books: [
      "Hos",
      "Joel",
      "Amos",
      "Obad",
      "Jonah",
      "Mic",
      "Nah",
      "Hab",
      "Zeph",
      "Hag",
      "Zech",
      "Mal"
    ]
  },
  { id: "gospels-acts", books: ["Matt", "Mark", "Luke", "John", "Acts"] },
  {
    id: "pauline",
    books: [
      "Rom",
      "1Cor",
      "2Cor",
      "Gal",
      "Eph",
      "Phil",
      "Col",
      "1Thess",
      "2Thess",
      "1Tim",
      "2Tim",
      "Titus",
      "Phlm"
    ]
  },
  {
    id: "general-revelation",
    books: [
      "Heb",
      "Jas",
      "1Pet",
      "2Pet",
      "1John",
      "2John",
      "3John",
      "Jude",
      "Rev"
    ]
  }
];

const NT_GROUPS = new Set(["gospels-acts", "pauline", "general-revelation"]);

export function genreOfBook(bookId: string): string {
  const group = GENRE_GROUPS.find((candidate) =>
    candidate.books.includes(bookId)
  );
  if (!group) throw new Error(`unknown-book:${bookId}`);
  return group.id;
}

export function testamentOfBook(bookId: string): Testament {
  return NT_GROUPS.has(genreOfBook(bookId)) ? "NT" : "OT";
}

export const chapterOfRef = (ref: string): string =>
  ref.split(".").slice(0, 2).join(".");

/**
 * Editions handled by the experiment. Concordance codes are the site's own
 * identifiers; `witness` names the local CSV when the edition is also one of
 * the three historical prediction witnesses.
 */
export interface EditionDefinition {
  id: "SG21" | "NEG" | "Sg1910" | "Darby" | "DarbyR";
  concordanceCode: string;
  family: "Segond" | "Darby";
  profileBible: string;
  ledgerBible: string;
  /** Local exact target text used for prediction (never a Concordance page). */
  localText:
    | { kind: "bible-json"; path: string; verseCorrespondencePath?: string }
    | { kind: "witness-csv"; path: string };
  witness?: "Sg1910" | "Darby" | "DarbyR";
}

export const EDITIONS: Record<EditionDefinition["id"], EditionDefinition> = {
  SG21: {
    id: "SG21",
    concordanceCode: "SG21",
    family: "Segond",
    profileBible: "s21",
    ledgerBible: "s21",
    localText: { kind: "bible-json", path: "data/bibles/bible-s21.json" }
  },
  NEG: {
    id: "NEG",
    concordanceCode: "NEG",
    family: "Segond",
    profileBible: "neg79",
    ledgerBible: "neg79",
    localText: {
      kind: "bible-json",
      path: "data/bibles/bible-neg79.json",
      verseCorrespondencePath:
        "data/bibles/bible-neg79-verse-correspondence.json"
    }
  },
  Sg1910: {
    id: "Sg1910",
    concordanceCode: "Sg1910",
    family: "Segond",
    profileBible: "nbs",
    ledgerBible: "gold-eval-sg1910",
    localText: { kind: "witness-csv", path: "data/strongs/Sg1910.csv" },
    witness: "Sg1910"
  },
  Darby: {
    id: "Darby",
    concordanceCode: "Darby",
    family: "Darby",
    profileBible: "fmar",
    ledgerBible: "gold-eval-darby",
    localText: { kind: "witness-csv", path: "data/strongs/Darby.csv" },
    witness: "Darby"
  },
  DarbyR: {
    id: "DarbyR",
    concordanceCode: "DarbyR",
    family: "Darby",
    profileBible: "fmar",
    ledgerBible: "gold-eval-darbyr",
    localText: { kind: "witness-csv", path: "data/strongs/DarbyR.csv" },
    witness: "DarbyR"
  }
};

export const WITNESS_FAMILY: Record<"Sg1910" | "Darby" | "DarbyR", string> = {
  Sg1910: "Segond",
  Darby: "Darby",
  DarbyR: "Darby"
};

export type ScenarioId = "target-excluded" | "family-excluded";

/**
 * Witnesses withheld from prediction. The target itself is always excluded,
 * Darby sisters are always excluded together, and the second scenario also
 * removes every witness of the target's editorial family.
 */
export function excludedWitnesses(
  edition: EditionDefinition,
  scenario: ScenarioId
): Array<"Sg1910" | "Darby" | "DarbyR"> {
  const all = ["Sg1910", "Darby", "DarbyR"] as const;
  return all.filter((witness) => {
    if (
      edition.witness &&
      WITNESS_FAMILY[witness] === WITNESS_FAMILY[edition.witness]
    )
      return true;
    return (
      scenario === "family-excluded" &&
      WITNESS_FAMILY[witness] === edition.family
    );
  });
}
