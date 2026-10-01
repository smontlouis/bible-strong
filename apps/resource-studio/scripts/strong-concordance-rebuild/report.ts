/**
 * Evaluator-side aggregation of score reports into comparison tables, and the
 * deterministic, stratified disagreement sample used for the assisted review.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { OccurrenceRecord, ScoreReport } from "./score.js";
import { sha256 } from "./shared.js";

export async function readReports(root: string): Promise<ScoreReport[]> {
  const reports: ScoreReport[] = [];
  for (const entry of (await readdir(root)).sort()) {
    try {
      reports.push(
        JSON.parse(
          await readFile(path.join(root, entry, "report.json"), "utf8")
        ) as ScoreReport
      );
    } catch {
      // A directory without a finished report is ignored.
    }
  }
  return reports;
}

export interface SummaryRow {
  runId: string;
  edition: string;
  scenario: string;
  split: string;
  policy: string;
  profile: string;
  verses: number;
  nonComparable: number;
  carrierExactP: number;
  carrierExactR: number;
  carrierExactF1: number;
  carrierOverlapF1: number;
  visibilityF1: number;
  emptyCarrierExactF1: number;
  absoluteOccurrenceError: number;
  occurrenceVisibleP?: number;
  occurrenceVisibleR?: number;
  occurrenceVisibleF1?: number;
  emptyClassificationP?: number;
  emptyClassificationR?: number;
  emptyAnchorExactRate?: number;
  repeatedIdentityRate?: number;
  unresolvedRate: number;
  fullyAccountedRate: number;
  fullyAgreeingRate?: number;
}

export function summaryRow(report: ScoreReport): SummaryRow {
  const [, , , policyPart = "initial", profilePart] = report.runId.split("__");
  const occurrences = report.occurrences?.all;
  return {
    runId: report.runId,
    edition: report.edition,
    scenario: report.scenario,
    split: report.split,
    policy: policyPart,
    profile: profilePart?.replace(/^profile-/u, "") ?? "edition",
    verses: report.comparableVerses,
    nonComparable: report.nonComparable.length,
    carrierExactP: report.carrier.all.carrierExact.precision,
    carrierExactR: report.carrier.all.carrierExact.recall,
    carrierExactF1: report.carrier.all.carrierExact.f1,
    carrierOverlapF1: report.carrier.all.carrierOverlap.f1,
    visibilityF1: report.carrier.all.visibilityClassification.f1,
    emptyCarrierExactF1: report.carrier.all.emptyCarrierExact.f1,
    absoluteOccurrenceError: report.carrier.all.absoluteOccurrenceError,
    occurrenceVisibleP: occurrences?.visiblePrecisionExact,
    occurrenceVisibleR: occurrences?.visibleRecallExact,
    occurrenceVisibleF1: occurrences?.visibleF1Exact,
    emptyClassificationP: occurrences?.emptyClassificationPrecision,
    emptyClassificationR: occurrences?.emptyClassificationRecall,
    emptyAnchorExactRate: occurrences?.emptyAnchorExactRate,
    repeatedIdentityRate: report.occurrences?.identity.rate,
    unresolvedRate: report.accounting.units
      ? Math.round(
          (report.accounting.unresolvedUnits / report.accounting.units) * 10000
        ) / 10000
      : 0,
    fullyAccountedRate: report.accounting.fullyAccountedRate,
    fullyAgreeingRate: report.occurrences
      ? report.accounting.fullyAgreeingRate
      : undefined
  };
}

const format = (value: number | undefined) =>
  value === undefined ? "—" : value.toFixed(4).replace(".", ",");

export function markdownTable(rows: SummaryRow[]): string {
  const header =
    "| Édition | Scénario | Moteur | Profil | Versets | F1 exact | P exact | R exact | F1 chevauch. | Occ. P | Occ. R | Vides R | Ancrage | Incertitude | Versets comptabilisés |";
  const rule = "|" + " --- |".repeat(15);
  const lines = rows.map(
    (row) =>
      `| ${row.edition} | ${row.scenario} | ${row.policy} | ${row.profile} | ${row.verses} | ${format(row.carrierExactF1)} | ${format(row.carrierExactP)} | ${format(row.carrierExactR)} | ${format(row.carrierOverlapF1)} | ${format(row.occurrenceVisibleP)} | ${format(row.occurrenceVisibleR)} | ${format(row.emptyClassificationR)} | ${format(row.emptyAnchorExactRate)} | ${format(row.unresolvedRate)} | ${format(row.fullyAccountedRate)} |`
  );
  return [header, rule, ...lines].join("\n");
}

/** Protocol categories for one occurrence-level disagreement. */
export type DisagreementCategory =
  | "mauvais-porteur"
  | "mauvaise-occurrence-repetee"
  | "expression"
  | "vide-injustifie"
  | "porteur-sur-mot-non-traduit"
  | "ancrage"
  | "variante-source"
  | "decoupage"
  | "convention-editoriale"
  | "abstention";

export function disagreementCategory(
  record: OccurrenceRecord
): DisagreementCategory | null {
  switch (record.outcome) {
    case "visible-exact":
    case "empty-anchor-exact":
      return null;
    case "visible-overlap":
      return "expression";
    case "visible-swapped-occurrence":
      return "mauvaise-occurrence-repetee";
    case "visible-wrong-carrier":
      return record.difficulty.includes("repeated-strong")
        ? "mauvaise-occurrence-repetee"
        : "mauvais-porteur";
    case "gold-visible-pred-empty":
      return "vide-injustifie";
    case "gold-empty-pred-visible":
      return record.difficulty.includes("punctuation-carrier")
        ? "convention-editoriale"
        : "porteur-sur-mot-non-traduit";
    case "empty-anchor-different":
      return "ancrage";
    case "source-strong-differs":
    case "gold-occurrence-without-source-unit":
      return "variante-source";
    case "gold-silent-pred-visible":
    case "gold-silent-pred-empty":
      return "convention-editoriale";
    case "gold-visible-pred-unresolved":
    case "gold-empty-pred-unresolved":
      return "abstention";
    case "gold-silent-pred-unresolved":
      return null;
  }
}

/**
 * Deterministic stratified sample: within each category, records are ranked by
 * sha256(seed|ref|position|outcome) and the first `perCategory` are kept.
 */
export function stratifiedSample(
  records: OccurrenceRecord[],
  seed: string,
  perCategory: number
): Array<OccurrenceRecord & { category: DisagreementCategory }> {
  const byCategory = new Map<DisagreementCategory, OccurrenceRecord[]>();
  for (const record of records) {
    const category = disagreementCategory(record);
    if (!category) continue;
    byCategory.set(category, [...(byCategory.get(category) ?? []), record]);
  }
  const sample: Array<OccurrenceRecord & { category: DisagreementCategory }> =
    [];
  for (const [category, values] of [...byCategory].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const ranked = [...values].sort((left, right) =>
      sha256(
        `${seed}|${left.ref}|${left.position}|${left.outcome}|${left.goldStrong}`
      ).localeCompare(
        sha256(
          `${seed}|${right.ref}|${right.position}|${right.outcome}|${right.goldStrong}`
        )
      )
    );
    for (const record of ranked.slice(0, perCategory))
      sample.push({ ...record, category });
  }
  return sample;
}

export function categoryCounts(
  records: OccurrenceRecord[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const category = disagreementCategory(record);
    if (category) counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}
