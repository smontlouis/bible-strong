import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { stemWord } from "./align.js";
import { normalizeClassicalStrong } from "./stepOriginals.js";
import { tokenizeText } from "./tokenize.js";
import { type StrongTranslationCandidate } from "./translationLexicon.js";
import { normalizeStepStrongCode } from "./lexiconV3/identity.js";
import {
  DEFAULT_LEXICON_V3_CURRENT_MANIFEST,
  lexiconV3CurrentProductionExists,
  resolveLexiconV3CurrentProduction
} from "./lexiconV3/productionPointer.js";

interface DictionaryRow {
  eStrong: string;
  dStrong: string;
  uStrong: string;
  morph: string;
  gloss: string;
  meaning: string;
}

interface V3CarrierRow {
  strong: string;
  stepStrong: string;
  normalized: string;
  policy: "auto_safe" | "review_only";
  confidence: number;
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

export type StrongDictionaryActivationIdentity =
  | {
      mode: "legacy";
      path: string;
    }
  | {
      mode: "lexicon-v3-current";
      pointerPath: string;
      pointerHash: string;
      releaseKey: string;
      deploymentReceipt: string;
      deploymentHash: string;
      fullPath: string;
      fullSha256: string;
      fullLogicalFingerprint: string;
    };

export interface ResolvedDefaultStrongDictionaryInput {
  path: string;
  activation: StrongDictionaryActivationIdentity;
}

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
  dbPath?: string,
  options: { strict?: boolean; currentManifestPath?: string } = {}
): StrongTranslationCandidate[] {
  let selectedPath: string;
  try {
    selectedPath =
      dbPath ?? resolveDefaultStrongDictionaryPath(options.currentManifestPath);
  } catch (error) {
    if (options.strict) throw error;
    return [];
  }
  if (!isReadableSqlite(selectedPath)) {
    if (options.strict) {
      throw new Error(`missing-or-empty-strong-dictionary:${selectedPath}`);
    }
    return [];
  }

  const v3Projection = detectV3Projection(selectedPath);
  if (v3Projection === "promoted") {
    return safeReadV3CarrierCandidates(selectedPath, options.strict ?? false);
  }
  if (v3Projection === "unattested") {
    if (options.strict) {
      throw new Error(`unattested-v3-carrier-database:${selectedPath}`);
    }
    return [];
  }

  const rows = safeReadDictionaryRows(selectedPath, options.strict ?? false);
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

export function resolveDefaultStrongDictionaryPath(
  currentManifestPath = DEFAULT_LEXICON_V3_CURRENT_MANIFEST
): string {
  return resolveDefaultStrongDictionaryInput(currentManifestPath).path;
}

/**
 * Resolves the immutable dictionary and the exact activation identity in one
 * snapshot. Consumers that persist a cache key must bind both values: the
 * selected SQLite bytes alone do not attest which release pointer authorized
 * them.
 */
export function resolveDefaultStrongDictionaryInput(
  currentManifestPath = DEFAULT_LEXICON_V3_CURRENT_MANIFEST
): ResolvedDefaultStrongDictionaryInput {
  if (!lexiconV3CurrentProductionExists(currentManifestPath)) {
    return {
      path: DEFAULT_PRODUCTION_STRONG_DICTIONARY,
      activation: {
        mode: "legacy",
        path: DEFAULT_PRODUCTION_STRONG_DICTIONARY
      }
    };
  }
  const production = resolveLexiconV3CurrentProduction(currentManifestPath);
  return {
    path: production.full.path,
    activation: {
      mode: "lexicon-v3-current",
      pointerPath: production.pointerPath,
      pointerHash: production.pointerHash,
      releaseKey: production.releaseKey,
      deploymentReceipt: production.deploymentReceipt,
      deploymentHash: production.deploymentHash,
      fullPath: production.full.path,
      fullSha256: production.full.sha256,
      fullLogicalFingerprint: production.full.logicalFingerprint
    }
  };
}

function detectV3Projection(
  dbPath: string
): "none" | "unattested" | "promoted" {
  try {
    const carrierTable = runJson<{ present: number }>(
      dbPath,
      `select exists(
         select 1 from sqlite_master
         where type = 'table' and name = 'LexiconCarrierTerms'
       ) as present`
    );
    if (carrierTable[0]?.present !== 1) return "none";
    const requiredTables = new Set(
      runJson<{ name: string }>(
        dbPath,
        `select name
         from sqlite_master
         where type = 'table'
           and name in (
             'DictionaryMeta',
             'LexiconCarrierTerms',
             'LexiconFieldStatus'
           )`
      ).map((row) => row.name)
    );
    if (
      !["DictionaryMeta", "LexiconCarrierTerms", "LexiconFieldStatus"].every(
        (table) => requiredTables.has(table)
      )
    ) {
      return "unattested";
    }
    const rows = runJson<{ valid: number }>(
      dbPath,
      `select (
         exists(
           select 1 from DictionaryMeta
           where key = 'lexiconV3ReleaseKey' and value <> ''
         )
         and exists(
           select 1 from DictionaryMeta
           where key = 'lexiconV3Profile' and value in ('core', 'full')
         )
         and exists(
           select 1 from DictionaryMeta
           where key = 'lexiconV3SourceFingerprint' and length(value) = 64
         )
         and exists(
           select 1 from DictionaryMeta
           where key = 'lexiconV3CodeFingerprint' and length(value) = 64
         )
         and exists(
           select 1 from DictionaryMeta
           where key = 'lexiconV3SnapshotFingerprint' and length(value) = 64
         )
         and exists(
           select 1 from DictionaryMeta
           where key = 'lexiconV3PolicyVersion' and value <> ''
         )
         and not exists(
           select 1 from LexiconCarrierTerms
           where releaseKey <> (
             select value from DictionaryMeta where key = 'lexiconV3ReleaseKey'
           )
         )
         and not exists(
           select 1 from LexiconFieldStatus
           where releaseKey <> (
             select value from DictionaryMeta where key = 'lexiconV3ReleaseKey'
           )
         )
       ) as valid`
    );
    return rows[0]?.valid === 1 ? "promoted" : "unattested";
  } catch {
    return "unattested";
  }
}

function safeReadV3CarrierCandidates(
  dbPath: string,
  strict: boolean
): StrongTranslationCandidate[] {
  try {
    return readV3CarrierCandidates(dbPath);
  } catch (error) {
    if (strict) throw error;
    return [];
  }
}

function readV3CarrierCandidates(dbPath: string): StrongTranslationCandidate[] {
  const rows = runJson<V3CarrierRow>(
    dbPath,
    `select
       strong,
       coalesce(stepStrong, '') as stepStrong,
       normalized,
       policy,
       confidence
     from LexiconCarrierTerms
     where locale = 'fr'
       and releaseKey = (
         select value from DictionaryMeta where key = 'lexiconV3ReleaseKey'
       )
       and state in ('auto_validated', 'human_validated')
       and policy in ('auto_safe', 'review_only')
       and normalized <> ''
       and (
         derivedFromVersionId is null
         or exists (
           select 1 from LexiconFieldStatus status
           where status.stepEntryId = LexiconCarrierTerms.stepEntryId
             and status.locale = 'fr'
             and status.field = 'gloss'
             and status.fieldVersionId = LexiconCarrierTerms.derivedFromVersionId
             and status.releaseKey = LexiconCarrierTerms.releaseKey
         )
       )
     order by strong, stepStrong, normalized`
  );

  return rows.flatMap((row) => {
    const form: DictionaryForm = {
      strong: row.strong,
      stepStrong: row.stepStrong || undefined,
      form: row.normalized,
      score: Math.max(0.18, Math.min(0.5, row.confidence)),
      source: "strong-lexicon-v3:carrier",
      reviewOnly: row.policy === "review_only",
      method: "dictionary-fr-exact"
    };
    return [
      {
        strong: form.strong,
        stepStrong: form.stepStrong,
        normalized: form.form,
        score: form.score,
        source: form.source,
        provenanceRoot: "strong-lexicon-v3-carriers",
        reviewOnly: form.reviewOnly,
        method: form.method
      } satisfies StrongTranslationCandidate,
      ...stemCandidate(form).map((candidate) => ({
        ...candidate,
        provenanceRoot: "strong-lexicon-v3-carriers"
      }))
    ];
  });
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

function runJson<T>(dbPath: string, sql: string): T[] {
  const output = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(output || "[]") as T[];
}

function candidateStrongCodes(
  row: DictionaryRow
): Array<{ strong: string; stepStrong?: string }> {
  const codes = new Map<string, { strong: string; stepStrong?: string }>();
  const eStrong = normalizeClassicalStrong(row.eStrong);
  const stepStrong = normalizeStepStrongCode(row.dStrong) ?? undefined;
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
      reviewOnly: true,
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
