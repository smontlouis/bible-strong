import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { stemWord } from "./align.js";
import { normalizeClassicalStrong } from "./stepOriginals.js";
import { tokenizeText } from "./tokenize.js";
import { type StrongTranslationCandidate } from "./translationLexicon.js";

interface DictionaryRow {
  eStrong: string;
  dStrong: string;
  uStrong: string;
  morph: string;
  gloss: string;
  meaning: string;
}

interface DictionaryForm {
  strong: string;
  stepStrong?: string;
  form: string;
  score: number;
  source: string;
  method: StrongTranslationCandidate["method"];
  reviewOnly?: boolean;
}

export const DEFAULT_PRODUCTION_STRONG_DICTIONARY =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const MAX_MEANING_CHARS = 180;
const MAX_FORMS_PER_STRONG = 12;

const FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "cet",
  "cette",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "la",
  "le",
  "les",
  "ou",
  "par",
  "pas",
  "pour",
  "qu",
  "que",
  "qui",
  "sans",
  "se",
  "sur",
  "un",
  "une"
]);

export function readStrongDictionaryTranslationCandidates(
  dbPath = DEFAULT_PRODUCTION_STRONG_DICTIONARY,
  options: { strict?: boolean } = {}
): StrongTranslationCandidate[] {
  if (!isReadableSqlite(dbPath)) {
    if (options.strict) {
      throw new Error(`missing-or-empty-strong-dictionary:${dbPath}`);
    }
    return [];
  }

  const rows = safeReadDictionaryRows(dbPath, options.strict ?? false);
  const formsByStrong = new Map<string, Map<string, DictionaryForm>>();

  for (const row of rows) {
    for (const candidate of candidateStrongCodes(row)) {
      const key = `${candidate.strong}|${candidate.stepStrong ?? ""}`;
      addGlossForms(formsByStrong, key, candidate, row);
      addMeaningForms(formsByStrong, key, candidate, row);
    }
  }

  return [...formsByStrong.values()].flatMap((forms) =>
    [...forms.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_FORMS_PER_STRONG)
      .flatMap((form) => [
        {
          strong: form.strong,
          stepStrong: form.stepStrong,
          normalized: form.form,
          score: form.score,
          source: form.source,
          provenanceRoot: "strong-lexicon-sqlite",
          reviewOnly: form.reviewOnly,
          method: form.method
        },
        ...stemCandidate(form)
      ])
  );
}

function safeReadDictionaryRows(
  dbPath: string,
  strict: boolean
): DictionaryRow[] {
  try {
    return readDictionaryRows(dbPath);
  } catch (error) {
    if (strict) throw error;
    return [];
  }
}

function isReadableSqlite(dbPath: string): boolean {
  return existsSync(dbPath) && statSync(dbPath).size > 0;
}

function readDictionaryRows(dbPath: string): DictionaryRow[] {
  const sql = `
    select
      se.eStrong as eStrong,
      se.dStrong as dStrong,
      se.uStrong as uStrong,
      se.morph as morph,
      lt.gloss as gloss,
      substr(lt.meaning, 1, ${MAX_MEANING_CHARS}) as meaning
    from StepEntries se
    join LexiconTranslations lt on lt.stepEntryId = se.id
    where lt.language = 'fr'
      and (lt.gloss <> '' or lt.meaning <> '')
  `;
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(output) as DictionaryRow[];
}

function candidateStrongCodes(
  row: DictionaryRow
): Array<{ strong: string; stepStrong?: string }> {
  const codes = new Map<string, { strong: string; stepStrong?: string }>();
  const eStrong = normalizeClassicalStrong(row.eStrong);
  const stepStrong = normalizeStepStrong(row.dStrong);
  if (eStrong) codes.set(eStrong, { strong: eStrong, stepStrong });

  const uStrong = normalizeClassicalStrong(row.uStrong);
  if (uStrong && (uStrong === eStrong || isPronounRow(row))) {
    codes.set(uStrong, {
      strong: uStrong,
      stepStrong: uStrong === eStrong ? stepStrong : undefined
    });
  }
  return [...codes.values()];
}

function normalizeStepStrong(value: string): string | undefined {
  return value.toUpperCase().match(/\b[HG]\d{4,5}[A-Z]?(?:_[A-Z])?\b/u)?.[0];
}

function addGlossForms(
  formsByStrong: Map<string, Map<string, DictionaryForm>>,
  key: string,
  candidate: { strong: string; stepStrong?: string },
  row: DictionaryRow
): void {
  const words = normalizedWords(row.gloss);
  const contentWords = words.filter(isContentWord);

  if (contentWords.length === 1) {
    addForm(formsByStrong, key, {
      ...candidate,
      form: contentWords[0] ?? "",
      score: 0.5,
      source: "strong-lexicon-sqlite:fr-gloss",
      method: "dictionary-fr-exact"
    });
    return;
  }

  if (contentWords.length > 1 && contentWords.length <= 4) {
    for (const word of contentWords) {
      addForm(formsByStrong, key, {
        ...candidate,
        form: word,
        score: 0.34,
        source: "strong-lexicon-sqlite:fr-gloss-token",
        reviewOnly: true,
        method: "dictionary-fr-exact"
      });
    }
  }
}

function addMeaningForms(
  formsByStrong: Map<string, Map<string, DictionaryForm>>,
  key: string,
  candidate: { strong: string; stepStrong?: string },
  row: DictionaryRow
): void {
  if (isProperNameRow(row)) return;

  const counts = new Map<string, number>();
  for (const word of normalizedWords(row.meaning).filter(isContentWord)) {
    if (word.length < 5) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  for (const [word, count] of counts) {
    addForm(formsByStrong, key, {
      ...candidate,
      form: word,
      score: Math.min(0.3, 0.18 + count * 0.04),
      source: "strong-lexicon-sqlite:fr-meaning",
      reviewOnly: true,
      method: "dictionary-fr-exact"
    });
  }
}

function isProperNameRow(row: DictionaryRow): boolean {
  return /(?:^|[-:])PG?(?:$|[-:])/u.test(row.morph);
}

function isPronounRow(row: DictionaryRow): boolean {
  return /(?:^|[-:])P(?:$|[-:])/u.test(row.morph);
}

function normalizedWords(text: string): string[] {
  return tokenizeText(text)
    .filter((segment) => segment.kind === "word")
    .map((segment) => segment.normalized);
}

function isContentWord(word: string): boolean {
  return word.length >= 2 && !FUNCTION_WORDS.has(word) && !/^\d+$/u.test(word);
}

function addForm(
  formsByStrong: Map<string, Map<string, DictionaryForm>>,
  key: string,
  form: DictionaryForm
): void {
  if (!form.form) return;
  const forms = formsByStrong.get(key) ?? new Map();
  const existing = forms.get(form.form);
  if (!existing || form.score > existing.score) {
    forms.set(form.form, form);
  }
  formsByStrong.set(key, forms);
}

function stemCandidate(form: DictionaryForm): StrongTranslationCandidate[] {
  const stem = stemWord(form.form);
  if (stem.length < 4 || stem === form.form) return [];
  return [
    {
      strong: form.strong,
      stepStrong: form.stepStrong,
      normalized: stem,
      score: Math.max(0.18, form.score - 0.12),
      source: `${form.source}:stem`,
      provenanceRoot: "strong-lexicon-sqlite",
      reviewOnly: form.reviewOnly,
      method: "dictionary-fr-stem"
    }
  ];
}
