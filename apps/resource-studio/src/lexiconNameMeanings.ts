import { createHash } from "node:crypto";

export type LexiconNameMeaningSourceField = "NameMeans" | "MounceShortDef";

export interface StepCompiledNameMeaning {
  stepCode: string;
  lexicalLanguage: "greek" | "hebrew";
  sourceField: LexiconNameMeaningSourceField;
  sourceText: string;
  sourceTextSha256: string;
}

interface StepCompiledEntry {
  stepCode: string;
  fields: Map<string, string>;
}

const GREEK_NAMED_ENTITY_TYPES = new Set([
  "angel",
  "god",
  "group",
  "judge",
  "king",
  "language",
  "location",
  "man",
  "name",
  "place",
  "queen",
  "woman"
]);

const GREEK_MEANING_CUE =
  /(?:["“”]|\bmeans?\b|\bmeaning\b|\bpossibly\b|\bhebrew\b|\baramaic\b|\borigin\b|\bderived\b|\bdedicated\b)/iu;

export function parseStepCompiledNameMeanings(input: {
  greek: string;
  hebrew: string;
}): StepCompiledNameMeaning[] {
  const hebrew = parseStepCompiledEntries(input.hebrew)
    .map((entry) => {
      const sourceText = cleanSourceText(entry.fields.get("NameMeans") ?? "");
      if (!sourceText) return undefined;
      return nameMeaning(entry.stepCode, "hebrew", "NameMeans", sourceText);
    })
    .filter((value): value is StepCompiledNameMeaning => value !== undefined);

  const greek = parseStepCompiledEntries(input.greek)
    .map((entry) => {
      const sourceText = cleanSourceText(
        entry.fields.get("MounceShortDef") ?? ""
      );
      const entityType = (entry.fields.get("STEP_Type") ?? "").toLowerCase();
      if (
        !sourceText ||
        !GREEK_NAMED_ENTITY_TYPES.has(entityType) ||
        !GREEK_MEANING_CUE.test(sourceText)
      ) {
        return undefined;
      }
      return nameMeaning(entry.stepCode, "greek", "MounceShortDef", sourceText);
    })
    .filter((value): value is StepCompiledNameMeaning => value !== undefined);

  return [...greek, ...hebrew].sort((left, right) =>
    left.stepCode.localeCompare(right.stepCode, "en")
  );
}

export function stripNameMeaningHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/gu, "")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseStepCompiledEntries(content: string): StepCompiledEntry[] {
  const result: StepCompiledEntry[] = [];
  let current: StepCompiledEntry | undefined;
  for (const line of content.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const header = line.match(/^\$=([GH]\d{4,5}[A-Za-z]?)=/u);
    if (header) {
      if (current) result.push(current);
      current = { stepCode: header[1]!, fields: new Map() };
      continue;
    }
    if (!current) continue;
    const field = line.match(/^@([^=]+)=\s*(.*)$/u);
    if (field) current.fields.set(field[1]!, field[2]!.trim());
  }
  if (current) result.push(current);
  return result;
}

function nameMeaning(
  stepCode: string,
  lexicalLanguage: "greek" | "hebrew",
  sourceField: LexiconNameMeaningSourceField,
  sourceText: string
): StepCompiledNameMeaning {
  return {
    stepCode,
    lexicalLanguage,
    sourceField,
    sourceText,
    sourceTextSha256: createHash("sha256").update(sourceText).digest("hex")
  };
}

function cleanSourceText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}
