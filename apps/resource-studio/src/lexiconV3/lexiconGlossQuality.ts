export type LexiconGlossLanguage = "en" | "fr";
export type LexiconGlossGateStatus = "review_needed" | "source_issue";

export interface LexiconGlossLintIssue {
  code: string;
  status: LexiconGlossGateStatus;
  message: string;
}

export interface LexiconGlossLintInput {
  language: LexiconGlossLanguage;
  gloss: string;
  morph?: string;
  /** Exact, independently replayed proof that terminal punctuation is lexical. */
  semanticTerminalPunctuation?: "!" | "?";
  /** The authoritative English gloss when linting its French translation. */
  counterpartGloss?: string;
}

const TRAILING_SEPARATOR = /[,;:]\s*$/u;
const TRAILING_OPEN_DELIMITER = /[([{«“]\s*$/u;
const TRAILING_ELLIPSIS = /(?:\.{3}|…+)\s*$/u;
const TERMINAL_SENTENCE_PUNCTUATION = /([.!?])\s*$/u;

const OBVIOUS_ENGLISH_FRAGMENT =
  /^(?:(?:a|an|the)\s+)?(?:form|variant|spelling|inflection)\s+of$/iu;
const OBVIOUS_FRENCH_FRAGMENT =
  /^(?:(?:un|une|la|le)\s+)?(?:forme|variante|orthographe|flexion)\s+(?:de|du|des)$/iu;
const DANGLING_ENGLISH_CONJUNCTION = /\b[\p{L}\p{N}]+\s+(?:and|or)\s*$/iu;
const DANGLING_FRENCH_CONJUNCTION = /\b[\p{L}\p{N}]+\s+(?:et|ou)\s*$/iu;

/**
 * Deterministic lexical-headword lint. Source issues are reserved for text
 * that is mechanically incomplete; stylistic punctuation only requests
 * review. The function never rewrites its input.
 */
export function lintLexiconGloss(
  input: LexiconGlossLintInput
): LexiconGlossLintIssue[] {
  const gloss = decodeGlossEntities(input.gloss.normalize("NFKC")).trim();
  const prefix = input.language === "en" ? "english" : "french";
  const issues: LexiconGlossLintIssue[] = [];

  if (!gloss) {
    issues.push({
      code: `${prefix}-gloss-empty`,
      status: "source_issue",
      message: "The lexical gloss is empty."
    });
    return issues;
  }

  if (/\/\s*$/u.test(gloss)) {
    issues.push({
      code: `${prefix}-gloss-trailing-slash`,
      status: "source_issue",
      message: "The lexical gloss ends with an unfinished slash alternative."
    });
  }

  if (TRAILING_SEPARATOR.test(gloss)) {
    issues.push({
      code: `${prefix}-gloss-dangling-separator`,
      status: "source_issue",
      message: "The lexical gloss ends with a separator and is incomplete."
    });
  }

  if (TRAILING_OPEN_DELIMITER.test(gloss)) {
    issues.push({
      code: `${prefix}-gloss-open-delimiter`,
      status: "source_issue",
      message: "The lexical gloss ends with an unmatched opening delimiter."
    });
  }

  const obviousFragment =
    input.language === "en"
      ? OBVIOUS_ENGLISH_FRAGMENT.test(gloss) ||
        DANGLING_ENGLISH_CONJUNCTION.test(gloss)
      : OBVIOUS_FRENCH_FRAGMENT.test(gloss) ||
        DANGLING_FRENCH_CONJUNCTION.test(gloss);
  if (obviousFragment) {
    issues.push({
      code: `${prefix}-gloss-obvious-fragment`,
      status: "source_issue",
      message: "The lexical gloss is a manifestly unfinished phrase."
    });
  }

  if (TRAILING_ELLIPSIS.test(gloss)) {
    issues.push({
      code: `${prefix}-gloss-terminal-ellipsis`,
      status: "review_needed",
      message: "The lexical gloss ends with an ellipsis and needs review."
    });
  }

  const punctuation = TERMINAL_SENTENCE_PUNCTUATION.exec(gloss)?.[1];
  if (
    punctuation &&
    !TRAILING_ELLIPSIS.test(gloss) &&
    !isSemanticallyPunctuatedLexeme(input, punctuation)
  ) {
    issues.push({
      code: `${prefix}-gloss-terminal-punctuation`,
      status: "review_needed",
      message: "A lexical gloss normally has no terminal sentence punctuation."
    });
  }

  return uniqueGlossIssues(issues);
}

function decodeGlossEntities(value: string): string {
  return value
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&(?:apos|#39);/giu, "'")
    .replace(/&nbsp;/giu, " ")
    .replace(/&#(\d+);/gu, (_match, decimal: string) =>
      String.fromCodePoint(Number(decimal))
    )
    .replace(/&#x([a-f0-9]+);/giu, (_match, hexadecimal: string) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16))
    );
}

function isSemanticallyPunctuatedLexeme(
  input: LexiconGlossLintInput,
  punctuation: string
): boolean {
  if (input.semanticTerminalPunctuation === punctuation) return true;
  const morph = input.morph ?? "";
  if (punctuation === "!" && /(?:^|:)(?:INJ|INTJ)(?:$|[-:+ ])/iu.test(morph)) {
    return true;
  }
  if (
    (punctuation === "?" || /\?!\s*$/u.test(input.gloss)) &&
    isInterrogativeMorph(morph)
  ) {
    return true;
  }
  if (input.language !== "fr") return false;
  const counterpart = input.counterpartGloss?.normalize("NFKC").trim() ?? "";
  return (
    counterpart.endsWith(punctuation) && lexicalWordCount(counterpart) <= 4
  );
}

function isInterrogativeMorph(morph: string): boolean {
  return /(?:^|:)(?:INTG|I|Q|PRT-I|ADV-I)(?:$|[-:+ ])/iu.test(morph);
}

function lexicalWordCount(value: string): number {
  return value.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

function uniqueGlossIssues(
  issues: readonly LexiconGlossLintIssue[]
): LexiconGlossLintIssue[] {
  const byCode = new Map<string, LexiconGlossLintIssue>();
  for (const issue of issues) byCode.set(issue.code, issue);
  return [...byCode.values()];
}
