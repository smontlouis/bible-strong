import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import {
  getCuratedStrongOverrides,
  isLegacySingleModelAutoOverride,
  isUnverifiedSemanticRefillOverride,
  type CuratedStrongOverride
} from "./curatedStrongOverrides.js";
import { referenceKey } from "./strongCsv.js";
import { tokenizeText } from "./tokenize.js";

export interface OverrideAuditItem {
  bible: string;
  ref: string;
  source: string;
  strong: string[];
  target: string;
  targetValid: boolean;
  legacySingleModelAuto: boolean;
  unverifiedSemanticRefill: boolean;
  legacyUnfilteredConsensus: boolean;
  referenceStyleFallback: boolean;
  consensusTrace: boolean;
  suspiciousReason: boolean;
  reason: string;
}

export interface OverrideAuditReport {
  generatedAt: string;
  total: number;
  productionEligible: number;
  legacySingleModelAuto: number;
  unverifiedSemanticRefill: number;
  legacyUnfilteredConsensus: number;
  referenceStyleFallback: number;
  invalidTarget: number;
  invalidProductionTarget: number;
  invalidLegacyTarget: number;
  invalidUnverifiedSemanticRefillTarget: number;
  semanticRefillWithoutConsensusTrace: number;
  suspiciousReason: number;
  replacementCount: number;
  bySource: Record<string, number>;
  items: OverrideAuditItem[];
}

export async function auditCuratedStrongOverrides(
  options: { bible?: string } = {}
): Promise<OverrideAuditReport> {
  const overrides = getCuratedStrongOverrides({
    includeLegacySingleModelAuto: true
  }).filter((override) => !options.bible || override.bible === options.bible);
  const bibles = await loadBibles(new Set(overrides.map((item) => item.bible)));
  const items = overrides.map((override) => auditItem(override, bibles));
  const bySource: Record<string, number> = {};
  for (const override of overrides) {
    bySource[override.source] = (bySource[override.source] ?? 0) + 1;
  }
  return {
    generatedAt: new Date().toISOString(),
    total: overrides.length,
    productionEligible: items.filter(
      (item) =>
        item.targetValid &&
        !item.legacySingleModelAuto &&
        !item.unverifiedSemanticRefill
    ).length,
    legacySingleModelAuto: items.filter((item) => item.legacySingleModelAuto)
      .length,
    unverifiedSemanticRefill: items.filter(
      (item) => item.unverifiedSemanticRefill
    ).length,
    legacyUnfilteredConsensus: items.filter(
      (item) => item.legacyUnfilteredConsensus
    ).length,
    referenceStyleFallback: items.filter((item) => item.referenceStyleFallback)
      .length,
    invalidTarget: items.filter((item) => !item.targetValid).length,
    invalidProductionTarget: items.filter(
      (item) =>
        !item.targetValid &&
        !item.legacySingleModelAuto &&
        !item.unverifiedSemanticRefill
    ).length,
    invalidLegacyTarget: items.filter(
      (item) => !item.targetValid && item.legacySingleModelAuto
    ).length,
    invalidUnverifiedSemanticRefillTarget: items.filter(
      (item) => !item.targetValid && item.unverifiedSemanticRefill
    ).length,
    semanticRefillWithoutConsensusTrace: items.filter(
      (item) => item.source === "semantic-refill:llm" && !item.consensusTrace
    ).length,
    suspiciousReason: items.filter((item) => item.suspiciousReason).length,
    replacementCount: overrides.filter((item) => item.replace).length,
    bySource,
    items: items.filter(
      (item) =>
        item.legacySingleModelAuto ||
        item.unverifiedSemanticRefill ||
        !item.targetValid ||
        item.suspiciousReason ||
        (item.source === "semantic-refill:llm" && !item.consensusTrace)
    )
  };
}

function auditItem(
  override: CuratedStrongOverride,
  bibles: Map<string, Map<string, BibleVerse>>
): OverrideAuditItem {
  return {
    bible: override.bible,
    ref: override.ref,
    source: override.source,
    strong: override.strong,
    target: describeTarget(override),
    targetValid: targetIsValid(override, bibles.get(override.bible)),
    legacySingleModelAuto: isLegacySingleModelAutoOverride(override),
    unverifiedSemanticRefill: isUnverifiedSemanticRefillOverride(override),
    legacyUnfilteredConsensus: override.source === "semantic-refill:llm",
    referenceStyleFallback:
      override.source === "semantic-refill:llm-reference-style",
    consensusTrace: /consensus/iu.test(override.reason),
    suspiciousReason:
      /(?:annul|incorrect|ne correspond|mauvais|wrong|faux|rejet)/iu.test(
        override.reason
      ),
    reason: override.reason
  };
}

function targetIsValid(
  override: CuratedStrongOverride,
  verses: Map<string, BibleVerse> | undefined
): boolean {
  const verse = verses?.get(override.ref);
  if (!verse) return false;
  const words = tokenizeText(verse.text).filter(
    (segment) => segment.kind === "word"
  );
  if ((override.target ?? "word") === "empty") {
    return override.wordIndex >= -1 && override.wordIndex < words.length;
  }
  if (override.target === "phrase") {
    const start = override.startWordIndex ?? override.wordIndex;
    const end = override.endWordIndex ?? override.wordIndex;
    const expected = override.normalizedPhrase ?? [];
    return (
      start >= 0 &&
      end >= start &&
      expected.length === end - start + 1 &&
      expected.every(
        (normalized, offset) => words[start + offset]?.normalized === normalized
      )
    );
  }
  return words[override.wordIndex]?.normalized === override.normalized;
}

function describeTarget(override: CuratedStrongOverride): string {
  if (override.target === "phrase") {
    return `phrase:${override.startWordIndex}-${override.endWordIndex}:${override.normalizedPhrase?.join(" ") ?? ""}`;
  }
  return `${override.target ?? "word"}:${override.wordIndex}:${override.normalized}`;
}

async function loadBibles(
  bibleIds: Set<string>
): Promise<Map<string, Map<string, BibleVerse>>> {
  const result = new Map<string, Map<string, BibleVerse>>();
  await Promise.all(
    [...bibleIds].map(async (bible) => {
      const biblePath = `data/bibles/bible-${bible}.json`;
      if (!existsSync(biblePath)) return;
      const verses = await readBibleJson(biblePath);
      result.set(
        bible,
        new Map(
          verses.map((verse) => [
            referenceKey(verse.bookId, verse.chapter, verse.verse),
            verse
          ])
        )
      );
    })
  );
  return result;
}

function markdown(report: OverrideAuditReport): string {
  const lines = [
    "# Curated Strong override audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- Total: ${report.total}`,
    `- Production eligible: ${report.productionEligible}`,
    `- Quarantined legacy single-model auto: ${report.legacySingleModelAuto}`,
    `- Quarantined unverified semantic refill: ${report.unverifiedSemanticRefill}`,
    `  - Legacy unversioned consensus: ${report.legacyUnfilteredConsensus}`,
    `  - Reference-style fallback: ${report.referenceStyleFallback}`,
    `- Invalid or drifted targets: ${report.invalidTarget}`,
    `  - Production-eligible: ${report.invalidProductionTarget}`,
    `  - Legacy single-model: ${report.invalidLegacyTarget}`,
    `  - Unverified semantic refill: ${report.invalidUnverifiedSemanticRefillTarget}`,
    `- Semantic-refill without consensus trace: ${report.semanticRefillWithoutConsensusTrace}`,
    `- Suspicious/contradictory reason text: ${report.suspiciousReason}`,
    `- Relocations: ${report.replacementCount}`,
    "",
    "Legacy single-model decisions, unversioned semantic-refill consensus, and reference-style fallbacks are excluded from production by default. Only the explicit `semantic-refill:llm-consensus-filtered` source can enter production automatically.",
    "",
    "## Flagged sample",
    "",
    "| Bible | Ref | Strong | Source | Target valid | Flags | Target |",
    "|---|---|---|---|---:|---|---|"
  ];
  for (const item of report.items.slice(0, 250)) {
    const flags = [
      item.legacySingleModelAuto ? "legacy-auto" : "",
      item.unverifiedSemanticRefill ? "unverified-semantic-refill" : "",
      item.legacyUnfilteredConsensus ? "legacy-unfiltered-consensus" : "",
      item.referenceStyleFallback ? "reference-style-fallback" : "",
      !item.targetValid ? "target-drift" : "",
      item.suspiciousReason ? "reason" : "",
      item.source === "semantic-refill:llm" && !item.consensusTrace
        ? "no-consensus-trace"
        : ""
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(
      `| ${item.bible} | ${item.ref} | ${item.strong.join(" ")} | ${item.source} | ${item.targetValid ? "yes" : "no"} | ${flags} | ${item.target.replaceAll("|", "\\|")} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const outputRoot = process.argv.includes("--output-root")
    ? (process.argv[process.argv.indexOf("--output-root") + 1] ?? "reports")
    : "reports";
  const bible = readOption("--bible");
  const report = await auditCuratedStrongOverrides({ bible });
  const suffix = bible ? `-${bible}` : "";
  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputRoot, `curated-strong-overrides-audit${suffix}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      path.join(outputRoot, `curated-strong-overrides-audit${suffix}.md`),
      markdown(report),
      "utf8"
    )
  ]);
  console.log(
    JSON.stringify(
      {
        total: report.total,
        productionEligible: report.productionEligible,
        legacySingleModelAuto: report.legacySingleModelAuto,
        unverifiedSemanticRefill: report.unverifiedSemanticRefill,
        legacyUnfilteredConsensus: report.legacyUnfilteredConsensus,
        referenceStyleFallback: report.referenceStyleFallback,
        invalidTarget: report.invalidTarget,
        invalidProductionTarget: report.invalidProductionTarget,
        invalidUnverifiedSemanticRefillTarget:
          report.invalidUnverifiedSemanticRefillTarget,
        semanticRefillWithoutConsensusTrace:
          report.semanticRefillWithoutConsensusTrace
      },
      null,
      2
    )
  );
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1]?.endsWith("auditCuratedStrongOverrides.ts")) {
  await main();
}
