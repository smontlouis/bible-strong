import { createHash } from "node:crypto";

import { BOOK_IDS } from "../books.js";

export const FRENCH_EDITORIAL_POLICY_VERSION =
  "lexicon-v3-french-editorial-policy@1" as const;
export const FRENCH_BOOK_REGISTRY_SCHEMA_VERSION =
  "lexicon-v3-french-book-registry@1" as const;
export const FRENCH_ENTITY_REGISTRY_SCHEMA_VERSION =
  "lexicon-v3-french-entity-registry@1" as const;
export const FRENCH_TERMBASE_CANDIDATE_SCHEMA_VERSION =
  "lexicon-v3-french-termbase-candidate@1" as const;
export const FRENCH_MORPHOLOGY_SCHEMA_VERSION =
  "lexicon-v3-french-morphology@1" as const;
export const FRENCH_EDITORIAL_BUILD_SCHEMA_VERSION =
  "lexicon-v3-french-editorial-build@1" as const;

export type FrenchEditorialStatus = "green" | "yellow" | "red";
export type FrenchEditorialPos =
  | "proper-name"
  | "verb"
  | "noun"
  | "adjective"
  | "adverb"
  | "number"
  | "particle"
  | "function-word"
  | "unknown";

export interface FrenchBookRegistryEntry {
  bookId: (typeof BOOK_IDS)[number];
  canonicalFr: string;
  aliases: string[];
}

const BOOK_NAMES_FR = [
  "Genèse",
  "Exode",
  "Lévitique",
  "Nombres",
  "Deutéronome",
  "Josué",
  "Juges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Rois",
  "2 Rois",
  "1 Chroniques",
  "2 Chroniques",
  "Esdras",
  "Néhémie",
  "Esther",
  "Job",
  "Psaumes",
  "Proverbes",
  "Ecclésiaste",
  "Cantique des cantiques",
  "Ésaïe",
  "Jérémie",
  "Lamentations",
  "Ézéchiel",
  "Daniel",
  "Osée",
  "Joël",
  "Amos",
  "Abdias",
  "Jonas",
  "Michée",
  "Nahum",
  "Habacuc",
  "Sophonie",
  "Aggée",
  "Zacharie",
  "Malachie",
  "Matthieu",
  "Marc",
  "Luc",
  "Jean",
  "Actes",
  "Romains",
  "1 Corinthiens",
  "2 Corinthiens",
  "Galates",
  "Éphésiens",
  "Philippiens",
  "Colossiens",
  "1 Thessaloniciens",
  "2 Thessaloniciens",
  "1 Timothée",
  "2 Timothée",
  "Tite",
  "Philémon",
  "Hébreux",
  "Jacques",
  "1 Pierre",
  "2 Pierre",
  "1 Jean",
  "2 Jean",
  "3 Jean",
  "Jude",
  "Apocalypse"
] as const;

export const FRENCH_BOOK_REGISTRY: readonly FrenchBookRegistryEntry[] =
  BOOK_IDS.map((bookId, index) => {
    const canonicalFr = BOOK_NAMES_FR[index];
    if (!canonicalFr) throw new Error("missing-french-book-name:" + bookId);
    return {
      bookId,
      canonicalFr,
      aliases: uniqueSorted([bookId, canonicalFr])
    };
  });

export const THEOLOGICAL_REVIEW_BASE_STRONGS = new Set([
  "G0026",
  "G0266",
  "G0629",
  "G1343",
  "G1344",
  "G1577",
  "G1680",
  "G2434",
  "G2962",
  "G3056",
  "G3952",
  "G4102",
  "G4151",
  "G4991",
  "G5547",
  "H0430",
  "H1285",
  "H2617",
  "H3068",
  "H3722",
  "H5315",
  "H6664",
  "H6942",
  "H7307",
  "H7585"
]);

export interface MorphologyCodeSourceRow {
  id: number;
  code: string;
  normalizedCode: string;
  language: string;
  scope: string;
  example: string;
  meaning: string;
  description: string;
  source: string;
}

export interface FrenchMorphologyContent {
  morphologyCodeId: number;
  code: string;
  normalizedCode: string;
  source: string;
  scope: string;
  sourceLanguage: string;
  language: "fr";
  meaning: string;
  description: string;
  example: string;
  structuredPairs: Array<{ field: string; source: string; french: string }>;
}

type MorphologyField =
  | "Function"
  | "Stem"
  | "Action"
  | "Voice"
  | "Form"
  | "Tense"
  | "Mood"
  | "Case"
  | "Person"
  | "Gender"
  | "Number"
  | "State"
  | "Adj.Numb."
  | "Name type"
  | "Extra";

const MORPHOLOGY_FIELD_ORDER: readonly MorphologyField[] = [
  "Function",
  "Stem",
  "Action",
  "Voice",
  "Form",
  "Tense",
  "Mood",
  "Case",
  "Person",
  "Gender",
  "Number",
  "State",
  "Adj.Numb.",
  "Name type",
  "Extra"
];

const FIELD_LABELS: Record<MorphologyField, string> = {
  Function: "Fonction",
  Stem: "Thème verbal",
  Action: "Valeur",
  Voice: "Voix",
  Form: "Forme",
  Tense: "Temps",
  Mood: "Mode",
  Case: "Cas",
  Person: "Personne",
  Gender: "Genre",
  Number: "Nombre",
  State: "État",
  "Adj.Numb.": "Type numéral",
  "Name type": "Type de nom",
  Extra: "Précision"
};

const FIELD_VALUES: Record<MorphologyField, Record<string, string>> = {
  Function: {
    "Adverb or adverb and particle combined":
      "adverbe ou combinaison d’un adverbe et d’une particule",
    "Aramaic transliterated word a transliterated Aramaic word":
      "mot araméen translittéré",
    "Correlative or Interrogative pronoun": "pronom corrélatif ou interrogatif",
    "Demonstrative pronoun+Conjunction": "pronom démonstratif et conjonction",
    "Indeclinable Noun of Other type": "nom indéclinable d’un autre type",
    "Indeclinable Proper Noun": "nom propre indéclinable",
    "Particle or Disjunctive introducing an alternative":
      "particule disjonctive introduisant une alternative",
    "Preposition a RELATIONSHIP to another person or thing": "préposition",
    "Preposition relating it to another person or thing": "préposition",
    "Conjunction a conditional": "conjonction conditionnelle",
    "Conjunction a conjunction": "conjonction",
    "Interjection an Interjection": "interjection",
    "Particle or Disjunctive": "particule disjonctive",
    Adjective: "adjectif",
    Adverb: "adverbe",
    Conjunction: "conjonction",
    "Correlative pronoun": "pronom corrélatif",
    "Definite article": "article défini",
    "Demonstrative pronoun": "pronom démonstratif",
    "Indefinite pronoun": "pronom indéfini",
    Interjection: "interjection",
    "Interrogative Particle": "particule interrogative",
    "Interrogative pronoun": "pronom interrogatif",
    "Negative Particle": "particule négative",
    Noun: "nom",
    Particle: "particule",
    "Personal pronoun": "pronom personnel",
    "Possessive pronoun": "pronom possessif",
    Preposition: "préposition",
    Pronoun: "pronom",
    "Reciprocal pronoun": "pronom réciproque",
    "Reflexive pronoun": "pronom réfléchi",
    "Relative pronoun": "pronom relatif",
    Suffix: "suffixe",
    Verb: "verbe"
  },
  Stem: Object.fromEntries(
    [
      "Aphel",
      "Haphel",
      "Hiphil",
      "Hishtaphel",
      "Hithpael",
      "Hitpaal",
      "Hitpael",
      "Hitpeel",
      "Hophal",
      "Hothpaal",
      "Ishtaphel",
      "Niphal",
      "Nithpael",
      "Pael",
      "Peal",
      "Peil",
      "Piel",
      "Polal",
      "Pual",
      "Qal",
      "Shaphel",
      "Tiphil"
    ].map((value) => [value, value])
  ),
  Action: {
    "Causative/declarative": "causatif ou déclaratif",
    "Intensive/resultive/transtive": "intensif, résultatif ou transitif",
    Simple: "simple"
  },
  Voice: {
    "Middle or Passive Deponent": "moyenne ou passive déponente",
    "Middle or Passive": "moyenne ou passive",
    "Middle Deponent": "moyenne déponente",
    "Passive Deponent": "passive déponente",
    "Reflexive/iterative": "réfléchie ou itérative",
    "impersonal active": "active impersonnelle",
    "indefinite voice": "voix indéterminée",
    Active: "active",
    Middle: "moyenne",
    Passive: "passive"
  },
  Form: {
    "Conjunction+Imperfect": "conjonction avec imparfait",
    "Consecutive Imperfect": "imparfait consécutif",
    "Consecutive Perfect": "parfait consécutif",
    "Definite a RELATIONSHIP to another person or thing with an indication":
      "définie",
    "Directional AND the direction is toward this": "directionnelle",
    "Object indicator an INDICATOR": "marqueur d’objet",
    "Paragogic Hé AND it is": "hé paragogique",
    "Paragogic Nun AND it is": "noun paragogique",
    "Participle passive": "participe passif",
    "Conditional an INDICATOR": "conditionnelle",
    "Demonstrative an INDICATOR": "démonstrative",
    "Interjection an INDICATOR": "interjective",
    "Interrogative an INDICATOR": "interrogative",
    "Negative an INDICATOR": "négative",
    "Relative an INDICATOR": "relative",
    "Infinitive an ACTION": "infinitif",
    Consecutive: "consécutive",
    Common: "commune",
    "Definite article": "article défini",
    Definite: "définie",
    Gentilic: "gentilé",
    Imperative: "impératif",
    Imperfect: "imparfait",
    Infinitive: "infinitif",
    Interjection: "interjection",
    Numerical: "numérale",
    "Numerical position": "ordinale",
    Participle: "participe",
    Perfect: "parfait",
    Personal: "personnelle",
    Proper: "propre",
    Title: "titre"
  },
  Tense: {
    "2nd Pluperfect": "second plus-que-parfait",
    "2nd Perfect": "second parfait",
    "2nd Present": "second présent",
    "2nd Future": "second futur",
    "2nd Aorist": "second aoriste",
    "Future/present": "futur ou présent",
    "Past/present": "passé ou présent",
    "Present/future": "présent ou futur",
    "indefinite tense": "temps indéterminé",
    Aorist: "aoriste",
    Future: "futur",
    Imperfect: "imparfait",
    Perfect: "parfait",
    Pluperfect: "plus-que-parfait",
    Present: "présent"
  },
  Mood: {
    "Indicative/cohortative": "indicatif ou cohortatif",
    "Indicative/jussive": "indicatif ou jussif",
    Cohortative: "cohortatif",
    Imperative: "impératif",
    Indicative: "indicatif",
    Jussive: "jussif",
    Optative: "optatif",
    Subjunctive: "subjonctif",
    jussive: "jussif"
  },
  Case: {
    Accusative: "accusatif",
    Dative: "datif",
    Genitive: "génitif",
    Nominative: "nominatif",
    Vocative: "vocatif"
  },
  Person: {
    "1st Person": "1re personne",
    "2nd Person": "2e personne",
    "2nd Plural": "2e personne du pluriel",
    "2nd Singular": "2e personne du singulier",
    "1st": "1re personne",
    "2nd": "2e personne",
    "3rd": "3e personne",
    First: "1re personne",
    Second: "2e personne",
    Third: "3e personne"
  },
  Gender: {
    "Either gender": "commun",
    Feminine: "féminin",
    Location: "lieu",
    Masculine: "masculin",
    Neuter: "neutre",
    Title: "titre"
  },
  Number: {
    Dual: "duel",
    Plural: "pluriel",
    Singular: "singulier"
  },
  State: {
    Absolute: "absolu",
    Construct: "construit",
    Definite: "défini"
  },
  "Adj.Numb.": {
    "Indeclinable Numeral": "numéral indéclinable"
  },
  "Name type": {
    "Person name Transcribed from Aramaic":
      "nom de personne transcrit de l’araméen",
    "Location Gentilic": "gentilé formé sur un lieu",
    "Person Gentilic": "gentilé formé sur un nom de personne",
    "Individual Gentilic": "gentilé individuel",
    "Title Gentilic": "gentilé formé sur un titre",
    "a proper name of a female PERSON OR THING":
      "nom propre féminin de personne ou de chose",
    "a proper name of male PEOPLE OR THINGS":
      "nom propre masculin pluriel de personnes ou de choses",
    Gentilic: "gentilé",
    Individual: "personne",
    Location: "lieu",
    Title: "titre",
    Type: "type"
  },
  Extra: {
    "Apocopated form": "forme apocopée",
    "Attic Greek form": "forme grecque attique",
    "Contracted form": "forme contractée",
    "IRRegular or impure form": "forme irrégulière ou impure",
    "Indeclinable Letter": "lettre indéclinable",
    "Abbreviated Numeral": "numéral abrégé",
    Abbreviated: "abrégée",
    Aeolic: "éolienne",
    Comparative: "comparatif",
    Interrogative: "interrogatif",
    Negative: "négatif",
    Numeral: "numéral",
    Superlative: "superlatif",
    Transitive: "transitif"
  }
};

const MORPHOLOGY_FIELD_PATTERN =
  /(Function|Case|Number|Gender|Extra|Name type|Adj\.Numb\.|Form|Stem|Action|Voice|Tense|Mood|Person|State)=([^;()"]+)/gu;

const RESIDUAL_ENGLISH_PATTERN =
  /\b(?:Greek|Hebrew|Aramaic|Noun|Verb|Adjective|Adverb|Pronoun|Particle|Preposition|Conjunction|Interogative|Intjection|Proper|Name|Location|Person|Male|Female|Plural|Singular|Common|Object|Possessive|Subject|Gentilic|WITH|JOINED|some kind|Indeclinable|Numeral|Negative|Correlative|Letter)\b/u;

export function buildFrenchMorphologyContent(
  row: MorphologyCodeSourceRow
): FrenchMorphologyContent {
  if (!row.code.trim() || !row.scope.trim() || !row.source.trim()) {
    throw new Error("invalid-morphology-source-row:" + row.id);
  }

  if (row.scope === "tagged_full") {
    const fields = parseStructuredMorphology(row.description);
    if (fields.length === 0) {
      throw new Error("missing-structured-morphology-pairs:" + row.id);
    }
    const ordered = [...fields].sort(
      (left, right) =>
        MORPHOLOGY_FIELD_ORDER.indexOf(left.field) -
        MORPHOLOGY_FIELD_ORDER.indexOf(right.field)
    );
    const meaning = sentenceCase(
      uniqueInOrder(ordered.map((field) => field.french)).join(", ")
    );
    return validateFrenchMorphologyContent({
      morphologyCodeId: row.id,
      code: row.code,
      normalizedCode: row.normalizedCode,
      source: row.source,
      scope: row.scope,
      sourceLanguage: row.language,
      language: "fr",
      meaning,
      description:
        ordered
          .map((field) => FIELD_LABELS[field.field] + " : " + field.french)
          .join("; ") + ".",
      example: "Code morphologique : " + row.code + " — " + meaning + ".",
      structuredPairs: ordered
    });
  }

  if (row.scope !== "lexical_brief") {
    throw new Error("unsupported-morphology-scope:" + row.scope);
  }
  const meaning = translateLexicalBrief(row.meaning);
  return validateFrenchMorphologyContent({
    morphologyCodeId: row.id,
    code: row.code,
    normalizedCode: row.normalizedCode,
    source: row.source,
    scope: row.scope,
    sourceLanguage: row.language,
    language: "fr",
    meaning,
    description: "Catégorie lexicale : " + meaning + ".",
    example: "Code lexical : " + row.code + ".",
    structuredPairs: [
      { field: "Function", source: row.meaning, french: meaning }
    ]
  });
}

export function validateFrenchMorphologyContent(
  content: FrenchMorphologyContent
): FrenchMorphologyContent {
  const visible = [content.meaning, content.description, content.example].join(
    " "
  );
  if (
    !content.meaning.trim() ||
    !content.description.trim() ||
    !content.example.trim()
  ) {
    throw new Error(
      "empty-french-morphology-field:" + content.morphologyCodeId
    );
  }
  if (RESIDUAL_ENGLISH_PATTERN.test(visible)) {
    throw new Error(
      "residual-english-in-french-morphology:" +
        content.morphologyCodeId +
        ":" +
        visible
    );
  }
  return content;
}

export function classifyFrenchEditorialPos(morph: string): FrenchEditorialPos {
  const value = morph.trim();
  if (/^N:/u.test(value) || value === "G:N-PRI") return "proper-name";
  if (/(?:^|[ +/])(?:G|H|A):V(?:$|[ +/])/u.test(value)) return "verb";
  if (/(?:^|[ +/])(?:G|H|A):N/u.test(value)) return "noun";
  if (/(?:^|[ +/])(?:G|H|A):A/u.test(value)) return "adjective";
  if (/ADV|Adv/u.test(value)) return "adverb";
  if (/NUI|Numer/u.test(value)) return "number";
  if (/PRT|Part|Neg|Cond/u.test(value)) return "particle";
  if (/PREP|Prep|CONJ|Conj|Pron|PerP|RelP|DemP|IndP/u.test(value)) {
    return "function-word";
  }
  return "unknown";
}

export function classicalStrongCode(
  language: "greek" | "hebrew",
  baseCode: number
): string {
  if (!Number.isInteger(baseCode) || baseCode < 0) {
    throw new Error("invalid-base-strong:" + baseCode);
  }
  return (language === "greek" ? "G" : "H") + String(baseCode).padStart(4, "0");
}

export function normalizeFrenchEvidence(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[’']/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(object)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableJson(object[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value) ?? "null";
}

export function validateFrenchBookRegistry(): void {
  if (FRENCH_BOOK_REGISTRY.length !== 66 || BOOK_NAMES_FR.length !== 66) {
    throw new Error("french-book-registry-count-mismatch");
  }
  const ids = new Set(FRENCH_BOOK_REGISTRY.map((book) => book.bookId));
  const names = new Set(
    FRENCH_BOOK_REGISTRY.map((book) =>
      normalizeFrenchEvidence(book.canonicalFr)
    )
  );
  if (ids.size !== 66 || names.size !== 66) {
    throw new Error("duplicate-french-book-registry-value");
  }
  for (const id of BOOK_IDS) {
    if (!ids.has(id)) throw new Error("missing-french-book:" + id);
  }
}

function parseStructuredMorphology(
  description: string
): Array<{ field: MorphologyField; source: string; french: string }> {
  const result: Array<{
    field: MorphologyField;
    source: string;
    french: string;
  }> = [];
  for (const match of description.matchAll(MORPHOLOGY_FIELD_PATTERN)) {
    const field = match[1] as MorphologyField | undefined;
    const source = match[2]?.trim() ?? "";
    if (!field || !source) continue;
    result.push({
      field,
      source,
      french: translateStructuredValue(field, source)
    });
  }
  return result;
}

function translateStructuredValue(
  field: MorphologyField,
  source: string
): string {
  const candidates = Object.entries(FIELD_VALUES[field]).sort(
    ([left], [right]) => right.length - left.length
  );
  const normalized = source.replace(/\s+/gu, " ").trim();
  const match = candidates.find(
    ([english]) =>
      normalized === english || normalized.startsWith(english + " ")
  );
  if (!match) {
    throw new Error("unsupported-morphology-value:" + field + ":" + source);
  }
  return match[1];
}

function translateLexicalBrief(source: string): string {
  const suffix =
    /^(Object|Possessive|Subject) suffix: (1st|2nd|3rd) person (common|feminine|masculine) (plural|singular)$/u.exec(
      source.trim()
    );
  if (suffix) {
    const kind =
      suffix[1] === "Object"
        ? "objet"
        : suffix[1] === "Possessive"
          ? "possessif"
          : "sujet";
    const person =
      suffix[2] === "1st" ? "1re" : suffix[2] === "2nd" ? "2e" : "3e";
    const gender =
      suffix[3] === "common"
        ? "commun"
        : suffix[3] === "feminine"
          ? "féminin"
          : "masculin";
    const number = suffix[4] === "plural" ? "pluriel" : "singulier";
    return (
      "suffixe " +
      kind +
      " : " +
      person +
      " personne, " +
      gender +
      ", " +
      number
    );
  }

  let value = source.trim();
  const replacements: Array<[RegExp, string]> = [
    [/\bAramaic Interogative\b/gu, "interrogatif araméen"],
    [/\bAramaic Noun\b/gu, "nom araméen"],
    [/\bAramaic Verb\b/gu, "verbe araméen"],
    [
      /\bGreek Correlative or Interrogative\b/gu,
      "corrélatif ou interrogatif grec"
    ],
    [/\bGreek DemonstrativePronoun\b/gu, "pronom démonstratif grec"],
    [/\bGreek Reciprocal Pronoun\b/gu, "pronom réciproque grec"],
    [/\bGreek Reflexive Pronoun\b/gu, "pronom réfléchi grec"],
    [/\bGreek Personal Pronoun\b/gu, "pronom personnel grec"],
    [/\bGreek Possessive Pronoun\b/gu, "pronom possessif grec"],
    [/\bGreek Indefinite Pronoun\b/gu, "pronom indéfini grec"],
    [/\bGreek Relative Pronoun\b/gu, "pronom relatif grec"],
    [/\bGreek Adjective\b/gu, "adjectif grec"],
    [/\bGreek Adverb\b/gu, "adverbe grec"],
    [/\bGreek Article\b/gu, "article grec"],
    [/\bGreek Conditional\b/gu, "conditionnel grec"],
    [/\bGreek Conjunction\b/gu, "conjonction grecque"],
    [/\bGreek Correlative\b/gu, "corrélatif grec"],
    [/\bGreek Interogative\b/gu, "interrogatif grec"],
    [/\bGreek Intjection\b/gu, "interjection grecque"],
    [/\bGreek Letter\b/gu, "lettre grecque"],
    [/\bGreek Negative\b/gu, "négation grecque"],
    [/\bGreek Number\b/gu, "nombre grec"],
    [/\bGreek Noun\b/gu, "nom grec"],
    [/\bGreek Particle\b/gu, "particule grecque"],
    [/\bGreek Preposition\b/gu, "préposition grecque"],
    [/\bGreek Verb\b/gu, "verbe grec"],
    [/\bHebrew Demonstrative Pronoun\b/gu, "pronom démonstratif hébreu"],
    [/\bHebrew Indefinite Pronoun\b/gu, "pronom indéfini hébreu"],
    [/\bHebrew Personal Pronoun\b/gu, "pronom personnel hébreu"],
    [/\bHebrew Relative Pronoun\b/gu, "pronom relatif hébreu"],
    [/\bHebrew Adjective\b/gu, "adjectif hébreu"],
    [/\bHebrew Adverb\b/gu, "adverbe hébreu"],
    [/\bHebrew Conditional\b/gu, "conditionnel hébreu"],
    [/\bHebrew Conjunction\b/gu, "conjonction hébraïque"],
    [/\bHebrew Interogative\b/gu, "interrogatif hébreu"],
    [/\bHebrew Interjection\b/gu, "interjection hébraïque"],
    [/\bHebrew Intjection\b/gu, "interjection hébraïque"],
    [/\bHebrew Negative\b/gu, "négation hébraïque"],
    [/\bHebrew Noun\b/gu, "nom hébreu"],
    [/\bHebrew Particle\b/gu, "particule hébraïque"],
    [/\bHebrew Preposition\b/gu, "préposition hébraïque"],
    [/\bHebrew Verb\b/gu, "verbe hébreu"],
    [/\bProper Name Adjective\b/gu, "adjectif de nom propre"],
    [/\bName Adverb\b/gu, "adverbe de nom propre"],
    [/\bProper Noun of some kind\b/gu, "nom propre d’un certain type"],
    [/\bProper Name Title\b/gu, "titre de nom propre"],
    [/\bProper Name\b/gu, "nom propre"],
    [/\bof a Location in Gentilic sense\b/gu, "de lieu employé comme gentilé"],
    [
      /\bof a Person in Gentilic sense\b/gu,
      "de personne employé comme gentilé"
    ],
    [
      /\bof a Male Person in Gentilic sense\b/gu,
      "de personne masculine employé comme gentilé"
    ],
    [
      /\bof a Female Person in Gentilic sense\b/gu,
      "de personne féminine employé comme gentilé"
    ],
    [/\bMale of some kind\b/gu, "masculin d’un certain type"],
    [/\bFemale of some kind\b/gu, "féminin d’un certain type"],
    [/\bof a Male some kind\b/gu, "masculin d’un certain type"],
    [/\bof a Male Person\b/gu, "de personne masculine"],
    [/\bof a Female Person\b/gu, "de personne féminine"],
    [/\bof a Location\b/gu, "de lieu"],
    [/\bof a Person\b/gu, "de personne"],
    [/\bof some kind\b/gu, "d’un certain type"],
    [/\bwith no stated gender\b/gu, "sans genre indiqué"],
    [/\bwith no gender\b/gu, "sans genre indiqué"],
    [/\bin Gentilic sense\b/gu, "employé comme gentilé"],
    [
      /\bie not the name of a person or place\b/gu,
      "c.-à-d. ni personne ni lieu"
    ],
    [
      /\bupper case for other than a person or place\b/gu,
      "avec majuscule hors nom de personne ou de lieu"
    ],
    [/\bFeminine person\b/gu, "personne féminine"],
    [/\bLocation Gentilic\b/gu, "gentilé de lieu"],
    [/\bPerson Gentilic\b/gu, "gentilé de personne"],
    [/\bRelative Pronoun\b/gu, "pronom relatif"],
    [/\bPersonal Pronoun\b/gu, "pronom personnel"],
    [/\bPossessive Pronoun\b/gu, "pronom possessif"],
    [/\bReciprocal Pronoun\b/gu, "pronom réciproque"],
    [/\bReflexive Pronoun\b/gu, "pronom réfléchi"],
    [/\bIndefinite Pronoun\b/gu, "pronom indéfini"],
    [/\bDemonstrative Pronoun\b/gu, "pronom démonstratif"],
    [/\bNoun Proper\b/gu, "nom propre"],
    [/\bNoun\b/gu, "nom"],
    [/\bAdjective\b/gu, "adjectif"],
    [/\bAdverb\b/gu, "adverbe"],
    [/\bConjunction\b/gu, "conjonction"],
    [/\bPreposition\b/gu, "préposition"],
    [/\bPronoun\b/gu, "pronom"],
    [/\bLocation\b/gu, "lieu"],
    [/\bPerson\b/gu, "personne"],
    [/\bGentilic\b/gu, "gentilé"],
    [/\bProper\b/gu, "propre"],
    [/\bAdjectival\b/gu, "adjectival"],
    [/\bIndeclinable\b/gu, "indéclinable"],
    [/\bComparative\b/gu, "comparatif"],
    [/\bSuperlative\b/gu, "superlatif"],
    [/\bInterogative\b/gu, "interrogatif"],
    [/\bInterrogative\b/gu, "interrogatif"],
    [/\bNegative\b/gu, "négatif"],
    [/\bFeminine or Neuter\b/gu, "féminin ou neutre"],
    [/\bMasculine or Feminine\b/gu, "masculin ou féminin"],
    [/\bMasculine or Neuter\b/gu, "masculin ou neutre"],
    [/\bCommon Plural\b/gu, "commun pluriel"],
    [/\bCommon Singular\b/gu, "commun singulier"],
    [/\bFeminine Plural\b/gu, "féminin pluriel"],
    [/\bFeminine Singular\b/gu, "féminin singulier"],
    [/\bMasculine Plural\b/gu, "masculin pluriel"],
    [/\bMasculine Singular\b/gu, "masculin singulier"],
    [/\bFeminine\b/gu, "féminin"],
    [/\bMasculine\b/gu, "masculin"],
    [/\bNeuter\b/gu, "neutre"],
    [/\b1st person\b/gu, "1re personne"],
    [/\b2nd person\b/gu, "2e personne"],
    [/\b3rd person\b/gu, "3e personne"],
    [/\bJOINED TO\b/gu, "JOINT À"],
    [/\bWITH\b/gu, "AVEC"],
    [/\bOR\b/gu, "OU"],
    [/\bor\b/gu, "ou"],
    [/\bAramaic\b/gu, "araméen"],
    [/\bGreek\b/gu, "grec"],
    [/\bHebrew\b/gu, "hébreu"]
  ];
  for (const [pattern, replacement] of replacements) {
    value = value.replace(pattern, replacement);
  }
  value = value.replace(/\s+/gu, " ").trim();
  if (!value || RESIDUAL_ENGLISH_PATTERN.test(value)) {
    throw new Error(
      "unsupported-lexical-brief-translation:" + source + ":" + value
    );
  }
  return value[0]?.toLocaleLowerCase("fr") + value.slice(1);
}

function sentenceCase(value: string): string {
  return value ? value[0]?.toLocaleUpperCase("fr") + value.slice(1) : value;
}

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

validateFrenchBookRegistry();
