import {
  type LexiconLanguage,
  type LexiconV3EntryIdentity,
  type LexiconV3SourceEntry
} from "./contracts.js";

const STEP_STRONG_PATTERN = /([GH])0*(\d{1,5})([A-Za-z]?)(?:_([A-Za-z]))?/i;

export function normalizeLexiconLanguage(value: string): LexiconLanguage {
  const normalized = value.trim().toLowerCase();
  if (normalized === "greek") return "greek";
  if (normalized === "hebrew") return "hebrew";
  throw new Error(`unsupported-lexicon-language:${value}`);
}

export function normalizeStepStrongCode(value: string): string | null {
  const match = STEP_STRONG_PATTERN.exec(value.trim());
  if (!match) return null;
  const number = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isInteger(number)) return null;
  // STEP uses letter case as data: e.g. H2148V and H2148v identify two
  // distinct sub-entries. Normalize only the language prefix and padding.
  const suffix = match[3] ?? "";
  const variant = match[4] ? `_${match[4]}` : "";
  return `${match[1]?.toUpperCase()}${String(number).padStart(4, "0")}${suffix}${variant}`;
}

/** Return the first case-sensitive STEP code in dStrong. */
export function extractPrimaryDStrong(dStrong: string): string | null {
  const match = STEP_STRONG_PATTERN.exec(dStrong);
  return match ? normalizeStepStrongCode(match[0]) : null;
}

export function buildLexiconEntryKey(
  languageValue: LexiconLanguage | string,
  dStrong: string
): string {
  const language = normalizeLexiconLanguage(languageValue);
  const primaryDStrong = extractPrimaryDStrong(dStrong);
  if (!primaryDStrong) {
    throw new Error(`missing-primary-dstrong:${dStrong}`);
  }

  const expectedPrefix = language === "greek" ? "G" : "H";
  if (!primaryDStrong.startsWith(expectedPrefix)) {
    throw new Error(`dstrong-language-mismatch:${language}:${primaryDStrong}`);
  }
  return `${language}:${primaryDStrong}`;
}

export function buildLexiconEntryIdentity(
  entry: Pick<
    LexiconV3SourceEntry,
    "language" | "eStrong" | "dStrong" | "uStrong"
  >
): LexiconV3EntryIdentity {
  const language = normalizeLexiconLanguage(entry.language);
  const primaryDStrong = extractPrimaryDStrong(entry.dStrong);
  if (!primaryDStrong) {
    throw new Error(`missing-primary-dstrong:${entry.dStrong}`);
  }

  return {
    entryKey: buildLexiconEntryKey(language, entry.dStrong),
    language,
    primaryDStrong,
    eStrong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong
  };
}
