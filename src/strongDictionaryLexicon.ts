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
  gloss: string;
  meaning: string;
}

interface DictionaryForm {
  strong: string;
  form: string;
  score: number;
  source: string;
  method: StrongTranslationCandidate["method"];
}

const DEFAULT_PRODUCTION_DB =
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
  dbPath = DEFAULT_PRODUCTION_DB
): StrongTranslationCandidate[] {
  if (!isReadableSqlite(dbPath)) {
    return [];
  }

  const rows = safeReadDictionaryRows(dbPath);
  const formsByStrong = new Map<string, Map<string, DictionaryForm>>();

  for (const row of rows) {
    for (const strong of candidateStrongCodes(row)) {
      addGlossForms(formsByStrong, strong, row);
      addMeaningForms(formsByStrong, strong, row);
    }
  }

  return [...formsByStrong.values()].flatMap((forms) =>
    [...forms.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_FORMS_PER_STRONG)
      .flatMap((form) => [
        {
          strong: form.strong,
          normalized: form.form,
          score: form.score,
          source: form.source,
          method: form.method
        },
        ...stemCandidate(form)
      ])
  );
}

function safeReadDictionaryRows(dbPath: string): DictionaryRow[] {
  try {
    return readDictionaryRows(dbPath);
  } catch {
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

function candidateStrongCodes(row: DictionaryRow): string[] {
  const codes = new Set<string>();
  for (const raw of [row.eStrong, row.uStrong]) {
    const strong = normalizeClassicalStrong(raw);
    if (strong) codes.add(strong);
  }
  return [...codes];
}

function addGlossForms(
  formsByStrong: Map<string, Map<string, DictionaryForm>>,
  strong: string,
  row: DictionaryRow
): void {
  const words = normalizedWords(row.gloss);
  const contentWords = words.filter(isContentWord);

  if (contentWords.length === 1) {
    addForm(formsByStrong, {
      strong,
      form: contentWords[0] ?? "",
      score: 0.5,
      source: "strong-lexicon-sqlite:fr-gloss",
      method: "dictionary-fr-exact"
    });
    return;
  }

  if (contentWords.length > 1 && contentWords.length <= 4) {
    for (const word of contentWords) {
      addForm(formsByStrong, {
        strong,
        form: word,
        score: 0.34,
        source: "strong-lexicon-sqlite:fr-gloss-token",
        method: "dictionary-fr-exact"
      });
    }
  }
}

function addMeaningForms(
  formsByStrong: Map<string, Map<string, DictionaryForm>>,
  strong: string,
  row: DictionaryRow
): void {
  const counts = new Map<string, number>();
  for (const word of normalizedWords(row.meaning).filter(isContentWord)) {
    if (word.length < 5) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  for (const [word, count] of counts) {
    addForm(formsByStrong, {
      strong,
      form: word,
      score: Math.min(0.3, 0.18 + count * 0.04),
      source: "strong-lexicon-sqlite:fr-meaning",
      method: "dictionary-fr-exact"
    });
  }
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
  form: DictionaryForm
): void {
  if (!form.form) return;
  const forms = formsByStrong.get(form.strong) ?? new Map();
  const existing = forms.get(form.form);
  if (!existing || form.score > existing.score) {
    forms.set(form.form, form);
  }
  formsByStrong.set(form.strong, forms);
}

function stemCandidate(form: DictionaryForm): StrongTranslationCandidate[] {
  const stem = stemWord(form.form);
  if (stem.length < 4 || stem === form.form) return [];
  return [
    {
      strong: form.strong,
      normalized: stem,
      score: Math.max(0.18, form.score - 0.12),
      source: `${form.source}:stem`,
      method: "dictionary-fr-stem"
    }
  ];
}
