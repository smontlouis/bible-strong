export type TbeshMeaningClassification =
  | "both"
  | "specific_only"
  | "legacy_only"
  | "empty";

export interface TbeshMeaningSections {
  /** The source value, preserved byte-for-byte for provenance and replay. */
  rawHtml: string;
  /** Content before the first STEP section separator. */
  stepSpecificHtml: string;
  /** Content after the first STEP section separator. */
  legacyGeneralHtml: string;
  hasSectionSeparator: boolean;
  sectionSeparatorCount: number;
  classification: TbeshMeaningClassification;
}

const TBESH_SECTION_SEPARATOR_PATTERN = /§|&sect;/i;
const TBESH_SECTION_SEPARATOR_GLOBAL_PATTERN = /§|&sect;/gi;
const LEADING_BREAK_PATTERN = /^\s*<br\s*\/?\s*>/i;
const TRAILING_BREAK_PATTERN = /<br\s*\/?\s*>\s*$/i;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const HTML_TAG_PATTERN = /<[^>]*>/g;
const HTML_NON_BREAKING_SPACE_PATTERN = /&(?:nbsp|#0*160|#x0*a0);/gi;
const INVISIBLE_TEXT_PATTERN = /[\s\u200B-\u200D\u2060\uFEFF]/gu;

/** Returns true when the source contains a supported TBESH section marker. */
export function hasTbeshSectionSeparator(rawHtml: string): boolean {
  return TBESH_SECTION_SEPARATOR_PATTERN.test(rawHtml);
}

/** Counts supported markers without changing the source string. */
export function countTbeshSectionSeparators(rawHtml: string): number {
  return [...rawHtml.matchAll(TBESH_SECTION_SEPARATOR_GLOBAL_PATTERN)].length;
}

/**
 * Tests whether an HTML fragment contains visible lexical content. Empty tags,
 * comments, line breaks, non-breaking spaces and zero-width characters do not
 * count as content.
 */
export function hasMeaningfulTbeshHtml(html: string): boolean {
  return (
    html
      .replace(HTML_COMMENT_PATTERN, "")
      .replace(HTML_TAG_PATTERN, "")
      .replace(HTML_NON_BREAKING_SPACE_PATTERN, " ")
      .replace(INVISIBLE_TEXT_PATTERN, "").length > 0
  );
}

/** Classifies which of the two derived TBESH sections contain content. */
export function classifyTbeshMeaningSections(
  stepSpecificHtml: string,
  legacyGeneralHtml: string
): TbeshMeaningClassification {
  const hasSpecific = hasMeaningfulTbeshHtml(stepSpecificHtml);
  const hasLegacy = hasMeaningfulTbeshHtml(legacyGeneralHtml);

  if (hasSpecific && hasLegacy) return "both";
  if (hasSpecific) return "specific_only";
  if (hasLegacy) return "legacy_only";
  return "empty";
}

/**
 * Splits a TBESH meaning once, at its first literal `§` or HTML `&sect;`
 * marker. Only whitespace and simple `<br>` tags touching that boundary are
 * removed from the derived sections; `rawHtml` is never normalized.
 *
 * A meaning without a marker remains a STEP section because the source gives
 * us no evidence for assigning any part of it to legacy family context.
 */
export function parseTbeshMeaning(rawHtml: string): TbeshMeaningSections {
  const separator = TBESH_SECTION_SEPARATOR_PATTERN.exec(rawHtml);

  if (!separator || separator.index === undefined) {
    const stepSpecificHtml = rawHtml;
    const legacyGeneralHtml = "";
    return {
      rawHtml,
      stepSpecificHtml,
      legacyGeneralHtml,
      hasSectionSeparator: false,
      sectionSeparatorCount: 0,
      classification: classifyTbeshMeaningSections(
        stepSpecificHtml,
        legacyGeneralHtml
      )
    };
  }

  const stepSpecificHtml = trimTbeshBoundaryEnd(
    rawHtml.slice(0, separator.index)
  );
  const legacyGeneralHtml = trimTbeshBoundaryStart(
    rawHtml.slice(separator.index + separator[0].length)
  );

  return {
    rawHtml,
    stepSpecificHtml,
    legacyGeneralHtml,
    hasSectionSeparator: true,
    sectionSeparatorCount: countTbeshSectionSeparators(rawHtml),
    classification: classifyTbeshMeaningSections(
      stepSpecificHtml,
      legacyGeneralHtml
    )
  };
}

function trimTbeshBoundaryEnd(html: string): string {
  let result = html.trimEnd();
  while (TRAILING_BREAK_PATTERN.test(result)) {
    result = result.replace(TRAILING_BREAK_PATTERN, "").trimEnd();
  }
  return result;
}

function trimTbeshBoundaryStart(html: string): string {
  let result = html.trimStart();
  while (LEADING_BREAK_PATTERN.test(result)) {
    result = result.replace(LEADING_BREAK_PATTERN, "").trimStart();
  }
  return result;
}
