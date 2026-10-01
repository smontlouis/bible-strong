import type { FollowupPolicy } from "../../src/strongConcordanceFollowup.js";

export const FOLLOWUP_VARIANTS = [
  "legacy",
  "readings",
  "expressions",
  "links",
  "readings-expressions",
  "all",
  "edition-adapted",
  "display-adapted"
] as const;
export type FollowupVariant = (typeof FOLLOWUP_VARIANTS)[number];
export function followupPolicy(
  variant: string,
  edition: string
): FollowupPolicy {
  if (!(FOLLOWUP_VARIANTS as readonly string[]).includes(variant))
    throw new Error("unknown-followup-policy");
  return {
    minorReadings: [
      "readings",
      "readings-expressions",
      "all",
      "edition-adapted",
      "display-adapted"
    ].includes(variant),
    functionExpressions:
      variant === "display-adapted"
        ? ["SG21", "NEG"].includes(edition)
        : [
            "expressions",
            "readings-expressions",
            "all",
            "edition-adapted"
          ].includes(variant),
    articleLinks: [
      "links",
      "all",
      "edition-adapted",
      "display-adapted"
    ].includes(variant),
    minimumHeadFamilies:
      variant === "edition-adapted" && edition === "SG21" ? 2 : 1
  };
}
