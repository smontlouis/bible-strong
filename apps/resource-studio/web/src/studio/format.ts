export function pct(value: number | undefined, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${((value ?? 0) * 100).toFixed(digits)} %`;
}

export function ratio(numerator = 0, denominator = 0) {
  return `${numerator.toLocaleString("fr-FR")} / ${denominator.toLocaleString("fr-FR")}`;
}
