import {
  type LexiconGlossSupportAudit,
  type LexiconHeadwordComparison,
  type LexiconHeadwordMatch,
  type LexiconLanguage,
  type LexiconResourceAudit,
  type LexiconSourceAuditFinding,
  type LexiconSourceSelection,
  type LexiconV3ResourceWitness,
  type LexiconV3SourceAuditResult,
  type LexiconV3SourceEntry
} from "./contracts.js";
import { buildLexiconEntryIdentity } from "./identity.js";

const GREEK_SMOOTH_BREATHING = "\uE000";
const GREEK_ROUGH_BREATHING = "\uE001";
const GLOSS_STOPWORDS = new Set([
  "and",
  "are",
  "be",
  "being",
  "for",
  "from",
  "into",
  "not",
  "of",
  "one",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with"
]);

export interface CompareLexiconHeadwordOptions {
  language: LexiconLanguage;
  dStrong?: string;
}

export function auditLexiconV3Source(
  entry: LexiconV3SourceEntry,
  resourceWitnesses: readonly LexiconV3ResourceWitness[] = []
): LexiconV3SourceAuditResult {
  const identity = buildLexiconEntryIdentity(entry);
  const findings: LexiconSourceAuditFinding[] = [];
  const meaningCandidate = extractLexiconHeadword(
    entry.meaning,
    entry.language
  );
  const meaningHeadword = compareLexiconHeadword(
    entry.original,
    meaningCandidate,
    {
      language: entry.language,
      dStrong: `${entry.dStrong} ${entry.uStrong}`
    }
  );
  const contentTerms = extractEnglishGlossTerms(entry.gloss);
  const meaningSupportsGloss = contentSupportsGloss(
    entry.meaning,
    contentTerms
  );
  const resources = resourceWitnesses.map((resource) =>
    auditResource(entry, resource, contentTerms)
  );
  const supportingResources = uniqueSorted(
    resources
      .filter((resource) => resource.supportsGloss)
      .map((resource) => resource.resource.source)
  );
  const glossSupport: LexiconGlossSupportAudit = {
    contentTerms,
    meaningSupportsGloss,
    supportingResources
  };

  if (!entry.gloss.trim()) {
    findings.push({
      code: "missing-gloss",
      severity: "error",
      message: "The STEP entry has no English gloss."
    });
  }
  if (!stripLexiconHtml(entry.meaning)) {
    findings.push({
      code: "missing-meaning",
      severity: "error",
      message: "The STEP entry has no English meaning."
    });
  }

  addMeaningHeadwordFinding(meaningHeadword, findings);

  const meaningIsMismatch = meaningHeadword.match === "mismatch";
  for (const resource of resources) {
    if (resource.headword.match === "mismatch" && !meaningIsMismatch) {
      findings.push({
        code: "resource-headword-mismatch",
        severity: "warning",
        message: `${resource.resource.source} starts with a headword that does not match the STEP entry.`,
        evidence: {
          resourceHeadword: resource.headword.candidate,
          entryOriginal: entry.original,
          source: resource.resource.source,
          kind: resource.resource.kind
        }
      });
    }
  }

  const coherentResources = resources
    .filter((resource) => isCoherentRepairHeadword(resource.headword.match))
    .sort(compareRepairCandidates);
  const selectedResource = coherentResources[0];

  if (meaningIsMismatch && selectedResource) {
    findings.push({
      code: "resource-corroborates-entry",
      severity: "info",
      message: `${selectedResource.resource.source} has a headword coherent with the STEP entry and can be reviewed as a repair witness.`,
      evidence: {
        resourceHeadword: selectedResource.headword.candidate,
        source: selectedResource.resource.source,
        kind: selectedResource.resource.kind
      }
    });
    if (!meaningSupportsGloss && selectedResource.supportsGloss) {
      findings.push({
        code: "gloss-supported-by-resource-only",
        severity: "warning",
        message:
          "The English gloss is supported by the coherent resource, but not by the primary STEP meaning.",
        evidence: {
          gloss: entry.gloss,
          terms: contentTerms,
          source: selectedResource.resource.source
        }
      });
    }
  } else if (meaningIsMismatch) {
    findings.push({
      code: "no-coherent-resource",
      severity: "error",
      message:
        "No linked resource has a sufficiently coherent headword for an automatic repair candidate."
    });
  }

  const invalidSource = findings.some(
    (finding) =>
      finding.code === "missing-gloss" || finding.code === "missing-meaning"
  );
  const status = invalidSource
    ? "invalid_source"
    : meaningIsMismatch
      ? "source_issue"
      : "source_ok";
  const selection = selectSource(status, selectedResource);

  return {
    identity,
    status,
    requiresReview: status !== "source_ok",
    meaningHeadword,
    glossSupport,
    resources,
    findings,
    selection
  };
}

/**
 * Extract the first original-language word from the first bold headword.
 * Returning null is intentionally conservative: later Greek/Hebrew quotations
 * are not assumed to be the entry's headword.
 */
export function extractLexiconHeadword(
  html: string,
  language: LexiconLanguage
): string | null {
  const bold = /<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(html)?.[2];
  if (!bold) return null;
  return extractScriptWords(decodeHtml(stripTags(bold)), language)[0] ?? null;
}

export function extractOriginalHeadwords(
  original: string,
  language: LexiconLanguage
): string[] {
  return uniqueInOrder(extractScriptWords(original, language));
}

export function compareLexiconHeadword(
  original: string,
  candidate: string | null,
  options?: CompareLexiconHeadwordOptions
): LexiconHeadwordComparison {
  const language =
    options?.language ?? inferHeadwordLanguage(original, candidate);
  const originals = extractOriginalHeadwords(original, language);
  if (!candidate || originals.length === 0) {
    return {
      candidate,
      originals,
      match: "unavailable",
      matches: null,
      matchedOriginal: null,
      reason: candidate
        ? "No original-language headword could be extracted from the entry."
        : "No leading bold original-language headword was found."
    };
  }

  for (const sourceHeadword of originals) {
    if (
      normalizeLexiconHeadword(sourceHeadword, language) ===
      normalizeLexiconHeadword(candidate, language)
    ) {
      return comparison(candidate, originals, "exact", sourceHeadword);
    }
  }

  for (const sourceHeadword of originals) {
    if (isMorphologicalVariant(sourceHeadword, candidate, language)) {
      return comparison(
        candidate,
        originals,
        "morphological_variant",
        sourceHeadword
      );
    }
  }

  for (const sourceHeadword of originals) {
    if (isOrthographicVariant(sourceHeadword, candidate, language)) {
      return comparison(
        candidate,
        originals,
        "orthographic_variant",
        sourceHeadword
      );
    }
  }

  if (hasExplicitLexicalRelation(options?.dStrong ?? "")) {
    return {
      candidate,
      originals,
      match: "explicit_relation",
      matches: true,
      matchedOriginal: null,
      reason:
        "dStrong explicitly identifies this entry as a form, meaning, name, or other derivative of another lexeme."
    };
  }

  return {
    candidate,
    originals,
    match: "mismatch",
    matches: false,
    matchedOriginal: null,
    reason:
      "The leading meaning headword is neither the entry headword nor a conservative orthographic or inflectional variant."
  };
}

export function normalizeLexiconHeadword(
  value: string,
  language: LexiconLanguage
): string {
  let normalized = value.normalize("NFD").toLowerCase();
  if (language === "greek") {
    normalized = normalized
      .replace(/\u0313/g, GREEK_SMOOTH_BREATHING)
      .replace(/\u0314/g, GREEK_ROUGH_BREATHING)
      .replace(/ς/g, "σ");
  }
  return normalized
    .replace(/\p{Mark}/gu, "")
    .replace(
      language === "greek"
        ? new RegExp(
            `[^\\p{Script=Greek}${GREEK_SMOOTH_BREATHING}${GREEK_ROUGH_BREATHING}]`,
            "gu"
          )
        : /[^\p{Script=Hebrew}]/gu,
      ""
    );
}

function auditResource(
  entry: LexiconV3SourceEntry,
  resource: LexiconV3ResourceWitness,
  glossTerms: string[]
): LexiconResourceAudit {
  const candidate = extractLexiconHeadword(
    resource.contentHtml,
    entry.language
  );
  return {
    resource,
    headword: compareLexiconHeadword(entry.original, candidate, {
      language: entry.language,
      dStrong: `${entry.dStrong} ${entry.uStrong}`
    }),
    supportsGloss: contentSupportsGloss(resource.contentHtml, glossTerms)
  };
}

function addMeaningHeadwordFinding(
  comparisonResult: LexiconHeadwordComparison,
  findings: LexiconSourceAuditFinding[]
): void {
  if (comparisonResult.match === "mismatch") {
    findings.push({
      code: "meaning-headword-mismatch",
      severity: "error",
      message:
        "The leading headword in the STEP meaning does not match the entry's original headword.",
      evidence: {
        meaningHeadword: comparisonResult.candidate,
        originalHeadwords: comparisonResult.originals
      }
    });
  } else if (comparisonResult.match === "explicit_relation") {
    findings.push({
      code: "meaning-headword-derived",
      severity: "info",
      message:
        "The different meaning headword is allowed by an explicit dStrong lexical relation."
    });
  } else if (
    comparisonResult.match === "orthographic_variant" ||
    comparisonResult.match === "morphological_variant"
  ) {
    findings.push({
      code: "meaning-headword-variant",
      severity: "info",
      message:
        "The meaning headword is a conservative spelling or inflectional variant of the entry headword.",
      evidence: { match: comparisonResult.match }
    });
  }
}

function comparison(
  candidate: string,
  originals: string[],
  match: Exclude<LexiconHeadwordMatch, "mismatch" | "unavailable">,
  matchedOriginal: string
): LexiconHeadwordComparison {
  const reasons: Record<typeof match, string> = {
    exact: "The normalized headwords are identical.",
    orthographic_variant:
      "The headwords differ only by a conservative spelling or diacritic variant.",
    morphological_variant:
      "The headwords differ only by a short inflectional ending.",
    explicit_relation: "The headwords are linked by dStrong."
  };
  return {
    candidate,
    originals,
    match,
    matches: true,
    matchedOriginal,
    reason: reasons[match]
  };
}

function inferHeadwordLanguage(
  original: string,
  candidate: string | null
): LexiconLanguage {
  const combined = `${original} ${candidate ?? ""}`;
  if (/\p{Script=Hebrew}/u.test(combined)) return "hebrew";
  return "greek";
}

function isOrthographicVariant(
  left: string,
  right: string,
  language: LexiconLanguage
): boolean {
  const normalizedLeft = normalizeLexiconHeadword(left, language);
  const normalizedRight = normalizeLexiconHeadword(right, language);
  if (!normalizedLeft || !normalizedRight) return false;
  if (hasConflictingGreekBreathing(normalizedLeft, normalizedRight)) {
    return false;
  }
  const plainLeft = withoutBreathing(normalizedLeft);
  const plainRight = withoutBreathing(normalizedRight);
  if (plainLeft === plainRight) return true;
  return (
    Math.min(plainLeft.length, plainRight.length) >= 4 &&
    levenshteinDistance(plainLeft, plainRight) <= 1
  );
}

function isMorphologicalVariant(
  left: string,
  right: string,
  language: LexiconLanguage
): boolean {
  const normalizedLeft = normalizeLexiconHeadword(left, language);
  const normalizedRight = normalizeLexiconHeadword(right, language);
  if (!normalizedLeft || !normalizedRight) return false;
  if (hasConflictingGreekBreathing(normalizedLeft, normalizedRight)) {
    return false;
  }
  const plainLeft = withoutBreathing(normalizedLeft);
  const plainRight = withoutBreathing(normalizedRight);
  if (
    language === "greek" &&
    hasGreekDerivationalSuffixCollision(plainLeft, plainRight)
  ) {
    return false;
  }
  const shortest = Math.min(plainLeft.length, plainRight.length);
  if (shortest < 4 || Math.abs(plainLeft.length - plainRight.length) > 2) {
    return false;
  }
  return commonPrefixLength(plainLeft, plainRight) >= Math.max(3, shortest - 2);
}

/**
 * A comparative adjective in -τερος and a derived noun in -τεριον are
 * different lexemes, not two inflections of one headword. The conservative
 * prefix heuristic otherwise confuses πρεσβύτερος with πρεσβυτέριον.
 */
function hasGreekDerivationalSuffixCollision(
  left: string,
  right: string
): boolean {
  return (
    (left.endsWith("τεροσ") && right.endsWith("τεριον")) ||
    (right.endsWith("τεροσ") && left.endsWith("τεριον"))
  );
}

function hasConflictingGreekBreathing(left: string, right: string): boolean {
  const leftBreathing = breathingSignature(left);
  const rightBreathing = breathingSignature(right);
  return Boolean(
    leftBreathing && rightBreathing && leftBreathing !== rightBreathing
  );
}

function breathingSignature(value: string): string {
  return [...value]
    .filter(
      (character) =>
        character === GREEK_SMOOTH_BREATHING ||
        character === GREEK_ROUGH_BREATHING
    )
    .join("");
}

function withoutBreathing(value: string): string {
  return value.replace(
    new RegExp(`[${GREEK_SMOOTH_BREATHING}${GREEK_ROUGH_BREATHING}]`, "g"),
    ""
  );
}

function hasExplicitLexicalRelation(dStrong: string): boolean {
  const codes = dStrong.match(/\b[GH]\d{3,5}[A-Za-z]?(?:_[A-Za-z])?\b/gi) ?? [];
  if (codes.length < 2) return false;
  return /\b(?:form|meaning|part|name|group(?: member)?|reflexive|equivalent|variant|spelling|greek|hebrew|aramaic)\s+of\b/i.test(
    dStrong
  );
}

function isCoherentRepairHeadword(match: LexiconHeadwordMatch): boolean {
  return (
    match === "exact" ||
    match === "orthographic_variant" ||
    match === "morphological_variant"
  );
}

function compareRepairCandidates(
  left: LexiconResourceAudit,
  right: LexiconResourceAudit
): number {
  if (left.supportsGloss !== right.supportsGloss) {
    return left.supportsGloss ? -1 : 1;
  }
  const rank: Record<LexiconHeadwordMatch, number> = {
    exact: 0,
    orthographic_variant: 1,
    morphological_variant: 2,
    explicit_relation: 3,
    unavailable: 4,
    mismatch: 5
  };
  return (
    rank[left.headword.match] - rank[right.headword.match] ||
    left.resource.source.localeCompare(right.resource.source) ||
    left.resource.kind.localeCompare(right.resource.kind)
  );
}

function selectSource(
  status: LexiconV3SourceAuditResult["status"],
  selectedResource: LexiconResourceAudit | undefined
): LexiconSourceSelection {
  if (status === "source_ok") {
    return {
      strategy: "step_primary",
      source: "STEP",
      kind: "brief",
      automatic: true,
      reason: "No blocking deterministic inconsistency was found."
    };
  }
  if (status === "source_issue" && selectedResource) {
    return {
      strategy: "resource_repair_candidate",
      source: selectedResource.resource.source,
      kind: selectedResource.resource.kind,
      automatic: false,
      reason:
        "The resource is coherent with the entry, but must be reviewed before replacing the STEP meaning."
    };
  }
  return {
    strategy: "manual_review",
    source: null,
    kind: null,
    automatic: false,
    reason:
      status === "invalid_source"
        ? "A required primary source field is missing."
        : "No sufficiently coherent repair witness is available."
  };
}

function extractEnglishGlossTerms(gloss: string): string[] {
  const words = stripLexiconHtml(gloss)
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g);
  return uniqueInOrder(
    (words ?? []).filter(
      (word) => word.length >= 3 && !GLOSS_STOPWORDS.has(word)
    )
  );
}

function contentSupportsGloss(content: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const words = new Set(
    stripLexiconHtml(content)
      .normalize("NFD")
      .replace(/\p{Mark}/gu, "")
      .toLowerCase()
      .match(/[a-z]+(?:'[a-z]+)?/g) ?? []
  );
  return terms.some((term) => words.has(term));
}

function extractScriptWords(
  value: string,
  language: LexiconLanguage
): string[] {
  const pattern =
    language === "greek"
      ? /[\p{Script=Greek}][\p{Script=Greek}\p{Mark}'’ʼ.-]*/gu
      : /[\p{Script=Hebrew}][\p{Script=Hebrew}\p{Mark}"'׳״.-]*/gu;
  return value.match(pattern) ?? [];
}

function stripLexiconHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
