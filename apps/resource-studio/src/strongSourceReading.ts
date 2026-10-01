import { normalizeStepStrongCode } from "./lexiconV3/identity.js";
import type { SourceRow } from "./strongSourceUnits.js";

export const SOURCE_READING_POLICY = "step-lexical-reading-v2";
export interface SourceReadingAssessment {
  policy: typeof SOURCE_READING_POLICY;
  rawReading: string;
  classification: "uniform" | "minor-same-lexeme" | "reading-dependent";
  lexicalReadingUnresolved: boolean;
  /** Recovering the lexical carrier does not adjudicate tense or manuscript choice. */
  grammarAndEditionChoice: "not-adjudicated";
  reasons: string[];
}

/** Interpret the frozen TAHOT/TAGNT legends, without discarding their variants.
 * OT lower-case bracket codes declare unchanged meaning. Greek lower-case codes
 * alone are insufficient: all described alternatives must retain the exact STEP
 * lexical identity and part of speech. Standalone alternative rows stay unresolved.
 */
export function assessSourceReading(
  row: SourceRow,
  morphology?: string
): SourceReadingAssessment {
  const result = (
    classification: SourceReadingAssessment["classification"],
    reasons: string[]
  ): SourceReadingAssessment => ({
    policy: SOURCE_READING_POLICY,
    rawReading: row.reading,
    classification,
    lexicalReadingUnresolved: classification === "reading-dependent",
    grammarAndEditionChoice: "not-adjudicated",
    reasons
  });
  const pending = (reason: string) => result("reading-dependent", [reason]);
  const variants = row.evidence.meaningVariants.trim();
  if (row.reading === (row.source === "TAHOT" ? "L" : "NKO"))
    return variants
      ? pending("variant-description-despite-uniform-label")
      : result("uniform", ["uniform-source-label"]);

  if (row.source === "TAHOT") {
    if (!/^L(?:\([abcdefhpsv](?:\+[abcdefhpsv])*\))+$/u.test(row.reading))
      return pending("not-leningrad-with-only-declared-minor-variants");
    if (variants) return pending("meaning-variant-conflicts-with-minor-flag");
    return result("minor-same-lexeme", [
      "TAHOT-lowercase-variants-declare-unchanged-meaning",
      "primary-L-reading-and-raw-variant-flags-retained"
    ]);
  }

  if (!/^N(?:[KO]|\([ko](?:\+[ko])*\))+$/u.test(row.reading))
    return pending("missing-primary-N-or-significant-or-standalone-reading");
  const labels = row.reading.replace(/[()+]/gu, "").toUpperCase().split("");
  if (labels.length !== 3 || [...labels].sort().join("") !== "KNO")
    return pending("not-all-three-edition-groups-represented-on-primary-row");
  if (row.primary.length !== 1)
    return pending("minor-row-has-multiple-primary-components");
  if (!variants)
    return result("minor-same-lexeme", [
      "TAGNT-only-minor-bracket-flags",
      "no-described-lexical-alternative",
      "grammar-and-edition-choice-not-inferred"
    ]);
  const parsed = [
    ...variants.matchAll(
      /\b(G\d{1,5}[A-Za-z]?(?:_[A-Za-z])?)=([A-Z][A-Z0-9-]*)/gu
    )
  ];
  const mentioned = [
    ...variants.matchAll(/\bG\d{1,5}[A-Za-z]?(?:_[A-Za-z])?/gu)
  ];
  if (!parsed.length || parsed.length !== mentioned.length)
    return pending("variant-description-not-fully-lexically-parsed");
  if (parsed.some((m) => normalizeStepStrongCode(m[1]) !== row.primary[0]))
    return pending("minor-description-changes-step-lexical-identity");
  const pos = morphology?.split("-")[0];
  if (!pos || parsed.some((m) => m[2].split("-")[0] !== pos))
    return pending("minor-description-changes-or-lacks-part-of-speech");
  return result("minor-same-lexeme", [
    "TAGNT-only-minor-bracket-flags",
    "every-described-alternative-keeps-exact-step-identity-and-pos",
    "morphological-variants-retained-without-edition-adjudication"
  ]);
}
