export type TflsjAvailability = "lsj_article" | "abbott_smith_fallback";

/**
 * TFLSJ has no dedicated availability column. STEP encodes the source state in
 * a trailing provenance note, so normalize that note once at ingestion and
 * expose a structural state to the rest of the pipeline.
 */
export function classifyTflsjAvailability(
  sourceContentHtml: string
): TflsjAvailability {
  return containsLsjAbsenceMarker(sourceContentHtml)
    ? "abbott_smith_fallback"
    : "lsj_article";
}

export function containsLsjAbsenceMarker(value: string): boolean {
  const normalized = normalizeMarkerText(value);
  return LSJ_ABSENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

const LSJ_ABSENCE_PATTERNS = [
  /\blsj (?:has|contains?) no entr(?:y|ies)\b/u,
  /\blsj (?:does not|doesnt) (?:have|contain) (?:an|any) entr(?:y|ies)\b/u,
  /\bno (?:real )?lsj entr(?:y|ies)\b/u,
  /\ble lsj ne (?:contient|comporte|possede|presente) aucune? entree\b/u,
  /\ble lsj n a (?:pas d|aucune) entree\b/u
];

function normalizeMarkerText(value: string): string {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&(?:apos|#39);/giu, "'")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[’']/gu, " ")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
