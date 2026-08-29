import { createHash } from "node:crypto";

export const STEP_GREEK_LEXICON_COMMIT =
  "4378c85f2593b7ad4df8785881266af27e07d0d4" as const;
export const STEP_GREEK_LEXICON_SHA256 =
  "34090eefe8f7dbc1ee6b44711800b78542d6db763c0f1e292d52bec3814013a8" as const;
export const STEP_GREEK_LEXICON_URL =
  `https://raw.githubusercontent.com/STEPBible/step/${STEP_GREEK_LEXICON_COMMIT}/step-core-data/src/main/resources/com/tyndalehouse/step/core/data/create/lexicon/lexicon_greek.txt` as const;

export const GREEK_LEXICON_REORGANIZATION_SCHEMA =
  "greek-lexicon-reorganization@1" as const;
export const ABBOTT_SMITH_RESOURCE_SOURCE = "AS" as const;
export const ABBOTT_SMITH_RESOURCE_KIND = "biblical_full" as const;
export const ABBOTT_SMITH_RESOURCE_ID_OFFSET = 1_000_000 as const;

export interface StepGreekLexiconEntry {
  code: string;
  sourceLine: number;
  fields: Readonly<Record<string, string>>;
  fieldLines: Readonly<Record<string, number>>;
}

export type GreekMeaningSource =
  | "TIPNR_SHORT"
  | "MOUNCE_SHORT"
  | "STEP_DSTRONG_SHORT"
  | "STEP_EXTENDED_SHORT"
  | "TIPNR_SHORT_FALLBACK"
  | "MOUNCE_MEDIUM_FALLBACK"
  | "STEP_DSTRONG_MEDIUM_FALLBACK"
  | "STEP_EXTENDED_MEDIUM_FALLBACK"
  | "STEP_GLOSS_FALLBACK"
  | "STEP_DATABASE_GLOSS_FALLBACK";

export interface GreekMeaningSelection {
  code: string;
  meaningHtml: string;
  meaningText: string;
  source: GreekMeaningSource;
  sourceField: "ShortDef" | "MounceShortDef" | "MounceMedDef" | "StepGloss";
  sourceLine: number;
  rule:
    | "entity-short-explicitly-names-gloss"
    | "short-field-primary"
    | "entity-short-fallback"
    | "medium-field-fallback"
    | "step-gloss-last-resort";
}

export type AbbottSmithDefinitionClassification =
  | "abbott_smith"
  | "lsj_fallback"
  | "missing";

export function parseStepGreekLexicon(
  content: string
): StepGreekLexiconEntry[] {
  const entries: StepGreekLexiconEntry[] = [];
  const lines = content.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  let current:
    | {
        code: string;
        sourceLine: number;
        fields: Record<string, string>;
        fieldLines: Record<string, number>;
      }
    | undefined;

  const finish = (): void => {
    if (!current) return;
    entries.push({
      code: current.code,
      sourceLine: current.sourceLine,
      fields: Object.freeze({ ...current.fields }),
      fieldLines: Object.freeze({ ...current.fieldLines })
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const header = line.match(/^\$=(G\d{4,5}[A-Za-z]?)=/u);
    if (header) {
      finish();
      current = {
        code: header[1]!,
        sourceLine: index + 1,
        fields: {},
        fieldLines: {}
      };
      continue;
    }
    if (!current) continue;

    const field = line.match(/^@([^=]+)=\s*(.*)$/u);
    if (!field) continue;
    const key = field[1]!.trim();
    current.fields[key] = field[2]!.trim();
    current.fieldLines[key] = index + 1;
  }
  finish();

  return entries;
}

export function selectGreekMeaning(
  entry: StepGreekLexiconEntry
): GreekMeaningSelection | null {
  const article = field(entry, "STEP_Article");
  const stepGloss = field(entry, "StepGloss");
  const shortDefinition = field(entry, "ShortDef");
  const mounceShort = field(entry, "MounceShortDef");
  const mounceMedium = field(entry, "MounceMedDef");

  if (
    article &&
    shortDefinition &&
    stepGloss &&
    containsNormalizedPhrase(shortDefinition, stepGloss)
  ) {
    return selection(
      entry,
      "ShortDef",
      shortDefinition,
      "TIPNR_SHORT",
      "entity-short-explicitly-names-gloss"
    );
  }

  if (mounceShort) {
    return selection(
      entry,
      "MounceShortDef",
      mounceShort,
      classifyShortSource(entry.code),
      "short-field-primary"
    );
  }

  if (shortDefinition) {
    return selection(
      entry,
      "ShortDef",
      shortDefinition,
      "TIPNR_SHORT_FALLBACK",
      "entity-short-fallback"
    );
  }

  if (mounceMedium) {
    return selection(
      entry,
      "MounceMedDef",
      mounceMedium,
      classifyMediumSource(entry.code),
      "medium-field-fallback"
    );
  }

  if (stepGloss) {
    return selection(
      entry,
      "StepGloss",
      stepGloss,
      "STEP_GLOSS_FALLBACK",
      "step-gloss-last-resort"
    );
  }

  return null;
}

export function classifyAbbottSmithDefinition(
  rawValue: string | undefined
): AbbottSmithDefinitionClassification {
  const value = rawValue?.trim() ?? "";
  if (!value) return "missing";
  const normalized = htmlToText(value).toLocaleLowerCase("en");
  return /\bfrom\s+(?:f?lsj|mlsj|middle\s+liddell)\b/u.test(normalized) ||
    /\babbreviated\s+f?lsj\b/u.test(normalized)
    ? "lsj_fallback"
    : "abbott_smith";
}

export function cleanLexiconSourceHtml(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .replace(/<\s*BR\s*\/?\s*>/giu, "<br />")
    .replace(/\s+__([IVX0-9a-z])/giu, "<br />$1")
    .replace(/__([IVX0-9a-z])/giu, "$1")
    .replace(/\s+([,.;:])/gu, "$1")
    .trim();
}

export function htmlToText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/giu, " ")
    .replace(/<ref=(?:'[^']*'|"[^"]*")>(.*?)<\/ref>/giu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&(?:apos|#39);/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Exact semantic-parent comparison: formatting and source labels may differ,
 * but the complete ordered sequence of letters and numbers must be identical.
 */
export function sourceValuesEquivalent(left: string, right: string): boolean {
  return comparableSourceValue(left) === comparableSourceValue(right);
}

export function comparableSourceValue(value: string): string {
  return stripSourceTail(htmlToText(cleanLexiconSourceHtml(value)))
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’']/gu, "'")
    .replace(/[^\p{L}\p{M}\p{N}']+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function stripLsjAbsenceTail(value: string): string {
  const open = Math.max(value.lastIndexOf("("), value.lastIndexOf("["));
  if (open < 0) return value.trim();
  const tail = value.slice(open);
  return containsLsjAbsenceText(tail)
    ? value.slice(0, open).trim()
    : value.trim();
}

export function containsLsjAbsenceText(value: string): boolean {
  const normalized = htmlToText(value)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[’']/gu, " ")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return (
    /\blsj (?:has|contains?) no entr(?:y|ies)\b/u.test(normalized) ||
    /\blsj (?:does not|doesnt) (?:have|contain) (?:an|any) entr(?:y|ies)\b/u.test(
      normalized
    ) ||
    /\ble lsj ne (?:contient|comporte|possede|presente) aucune? entree\b/u.test(
      normalized
    ) ||
    /\ble lsj n a (?:pas d|aucune) entree\b/u.test(normalized)
  );
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function field(entry: StepGreekLexiconEntry, key: string): string {
  return entry.fields[key]?.trim() ?? "";
}

function selection(
  entry: StepGreekLexiconEntry,
  sourceField: GreekMeaningSelection["sourceField"],
  rawValue: string,
  source: GreekMeaningSource,
  rule: GreekMeaningSelection["rule"]
): GreekMeaningSelection {
  const meaningHtml = cleanLexiconSourceHtml(rawValue);
  return {
    code: entry.code,
    meaningHtml,
    meaningText: htmlToText(meaningHtml),
    source,
    sourceField,
    sourceLine: entry.fieldLines[sourceField] ?? entry.sourceLine,
    rule
  };
}

function classifyShortSource(code: string): GreekMeaningSource {
  const identity = parseCode(code);
  if (identity.baseCode > 5624) return "STEP_EXTENDED_SHORT";
  if (identity.suffix) return "STEP_DSTRONG_SHORT";
  return "MOUNCE_SHORT";
}

function classifyMediumSource(code: string): GreekMeaningSource {
  const identity = parseCode(code);
  if (identity.baseCode > 5624) return "STEP_EXTENDED_MEDIUM_FALLBACK";
  if (identity.suffix) return "STEP_DSTRONG_MEDIUM_FALLBACK";
  return "MOUNCE_MEDIUM_FALLBACK";
}

function parseCode(code: string): { baseCode: number; suffix: string } {
  const match = code.match(/^G(\d{4,5})([A-Za-z]?)$/u);
  if (!match) throw new Error(`invalid-greek-code:${code}`);
  return {
    baseCode: Number.parseInt(match[1]!, 10),
    suffix: match[2] ?? ""
  };
}

function containsNormalizedPhrase(container: string, phrase: string): boolean {
  const normalizedContainer = normalizePhrase(container);
  const normalizedPhrase = normalizePhrase(phrase);
  if (!normalizedPhrase) return false;
  return ` ${normalizedContainer} `.includes(` ${normalizedPhrase} `);
}

function normalizePhrase(value: string): string {
  return htmlToText(value)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function stripSourceTail(value: string): string {
  return stripLsjAbsenceTail(value)
    .replace(/\s*[\[(]\s*(?:AS|Abbott[- ]Smith)\s*[\])]\s*$/iu, "")
    .replace(
      /\s*[\[(]\s*(?:From|D.apres)\s+Abbott[- ]Smith[^)\]]*[\])]\s*$/iu,
      ""
    )
    .trim();
}
