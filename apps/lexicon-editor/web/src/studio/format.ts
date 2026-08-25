export function pct(value: number | undefined, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${((value ?? 0) * 100).toFixed(digits)} %`;
}

export function ratio(numerator = 0, denominator = 0) {
  return `${numerator.toLocaleString("fr-FR")} / ${denominator.toLocaleString("fr-FR")}`;
}

export function strongColor(source: string, placement: string) {
  if (placement === "empty" || placement === "technical") return "empty";
  if (source === "semantic-lexicon") return "lexical";
  if (source === "original-complete") return "step";
  if (source === "reference-backed-original") return "original";
  if (source === "phrase-transfer") return "phrase";
  if (source === "curated-override" || source === "llm-review") return "reviewed";
  return "witness";
}
