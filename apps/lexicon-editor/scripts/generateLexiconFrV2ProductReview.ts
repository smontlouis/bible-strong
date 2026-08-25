import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  buildProductReview,
  type ProductReviewEntry
} from "../src/lexiconProductReview.js";

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_FINAL_JSONL =
  "outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final.jsonl";
const DEFAULT_OUT_JSON =
  "outputs/lexicon-fr-v2/strong_lexicon_fr_v2.product-review.json";
const DEFAULT_REPORT = "reports/lexicon-fr-v2-product-review.md";
const DEFAULT_LIMIT = 200;

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = args.db ?? DEFAULT_DB;
  const finalJsonlPath = args.input ?? DEFAULT_FINAL_JSONL;
  const outJsonPath = args.outJson ?? DEFAULT_OUT_JSON;
  const reportPath = args.report ?? DEFAULT_REPORT;
  const limit = parseBoundedInteger(args.limit, 1, 1000) ?? DEFAULT_LIMIT;

  const review = buildProductReview({ dbPath, finalJsonlPath });
  const topEntries = review.entries.slice(0, limit);
  const payload = {
    ...review.summary,
    generatedAt: new Date().toISOString(),
    selectionLimit: limit,
    entries: topEntries
  };

  writeJson(outJsonPath, payload);
  writeText(reportPath, renderReport(review.entries, limit, outJsonPath));
  console.log(
    JSON.stringify(
      {
        totalEntries: review.summary.totalEntries,
        accepted: review.summary.accepted,
        reviewNeeded: review.summary.reviewNeeded,
        topRiskWritten: topEntries.length,
        manualFixCount: review.summary.manualFixCount,
        anomalyCount: review.summary.anomalyCount,
        outJsonPath,
        reportPath
      },
      null,
      2
    )
  );
}

function renderReport(
  entries: ProductReviewEntry[],
  limit: number,
  outJsonPath: string
): string {
  const topEntries = entries.slice(0, limit);
  const manualFixes = entries.filter((entry) =>
    entry.flags.includes("manual-fix")
  );
  const anomalies = entries.filter((entry) =>
    entry.flags.some((flag) =>
      [
        "ratio-low",
        "ratio-high",
        "residual-english",
        "suspicious-name"
      ].includes(flag)
    )
  );
  const critical = entries.filter((entry) =>
    entry.flags.includes("critical-strong")
  );

  return `# Lexicon FR V2 Product Review

Generated: ${new Date().toISOString()}

## Summary

- Source: \`outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final.jsonl\`
- Review JSON: \`${outJsonPath}\`
- Entries ranked: \`${entries.length}\`
- Top-risk selection: \`${topEntries.length}\`
- Critical Strong entries: \`${critical.length}\`
- Manual strict fixes: \`${manualFixes.length}\`
- Automatic anomaly flags: \`${anomalies.length}\`

## Review Method

Prioritize entries with theological importance, long source text, many references, manual repair history, abnormal FR/EN length ratio, suspicious residual English, or suspicious name translations.

The goal is not to reread every record. The goal is to catch systematic product-quality issues before DB import.

## Top Risk Entries

${renderRows(topEntries)}

## Manual Strict Fixes

${renderRows(manualFixes)}

## Anomaly Candidates

${renderRows(anomalies.slice(0, 100))}

## Viewer

Start the viewer and open:

\`\`\`bash
npm run viewer
\`\`\`

Then use:

\`\`\`txt
http://localhost:4173/viewer/lexicon-product-review.html
\`\`\`
`;
}

function renderRows(entries: ProductReviewEntry[]): string {
  if (entries.length === 0) return "No entries.\n";
  const rows = entries.map(
    (entry) =>
      `| ${entry.id} | ${entry.eStrong} | ${entry.language} | ${entry.score} | ${entry.sourceChars} | ${entry.sourceReferenceCount} | ${entry.lengthRatio.toFixed(2)} | ${entry.flags.join(", ") || "none"} | ${escapeTable(entry.glossFr || entry.glossEn)} |`
  );
  return [
    "| ID | Strong | Lang | Score | Source chars | Refs | Ratio | Flags | Gloss |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows,
    ""
  ].join("\n");
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    const key = rawKey.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[key] = nextValue;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function parseBoundedInteger(
  value: string | undefined,
  min: number,
  max: number
): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, value);
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

main();
