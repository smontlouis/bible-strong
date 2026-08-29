import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { writeJsonFileImmutable } from "./immutableFile.js";

export interface ApprovalDecision extends Record<string, unknown> {
  bible: string;
  ref: string;
  strong: string[];
  target?: "word" | "empty" | "phrase";
  replace?: {
    target: "word" | "empty" | "phrase";
    wordIndex?: number;
    startWordIndex?: number;
    endWordIndex?: number;
  };
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  normalized: string;
  normalizedPhrase?: string | string[] | null;
  confidence: number;
  source: string;
  reason: string;
}

interface ApprovalSource {
  label: string;
  path: string;
  sha256: string;
  decisionCount: number;
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing-argument:${name}`);
  return value;
}

function repeatedArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1] as string);
    }
  }
  return values;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function approvalDecisionKey(decision: ApprovalDecision): string {
  return JSON.stringify([
    decision.bible ?? null,
    decision.ref ?? null,
    decision.strong ?? null,
    decision.target ?? null,
    decision.wordIndex ?? null,
    decision.startWordIndex ?? null,
    decision.endWordIndex ?? null,
    decision.normalized ?? decision.normalizedPhrase ?? null
  ]);
}

export function dedupeApprovalDecisions(
  groups: Array<{ label: string; decisions: ApprovalDecision[] }>
): {
  decisions: ApprovalDecision[];
  duplicates: Array<{ key: string; keptSource: string; skippedSource: string }>;
} {
  const decisions: ApprovalDecision[] = [];
  const duplicates: Array<{
    key: string;
    keptSource: string;
    skippedSource: string;
  }> = [];
  const seen = new Map<string, string>();
  for (const group of groups) {
    for (const decision of group.decisions) {
      const key = approvalDecisionKey(decision);
      const keptSource = seen.get(key);
      if (keptSource) {
        duplicates.push({ key, keptSource, skippedSource: group.label });
        continue;
      }
      seen.set(key, group.label);
      decisions.push(decision);
    }
  }
  return { decisions, duplicates };
}

function parseSourceSpec(spec: string): { label: string; sourcePath: string } {
  const separator = spec.indexOf("=");
  if (separator <= 0 || separator === spec.length - 1) {
    throw new Error(`invalid-source:${spec}`);
  }
  return {
    label: spec.slice(0, separator),
    sourcePath: spec.slice(separator + 1)
  };
}

function extractDecisions(value: unknown): ApprovalDecision[] {
  if (Array.isArray(value)) return value as ApprovalDecision[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { decisions?: unknown }).decisions)
  ) {
    return (value as { decisions: ApprovalDecision[] }).decisions;
  }
  throw new Error("approval-source-missing-decisions");
}

async function main(): Promise<void> {
  const outputPath = requiredArg("--output");
  if (existsSync(outputPath)) {
    throw new Error(`approval-bundle-already-exists:${outputPath}`);
  }
  const specs = repeatedArgs("--source");
  if (specs.length === 0) throw new Error("missing-argument:--source");

  const labels = new Set<string>();
  const sources: ApprovalSource[] = [];
  const groups: Array<{ label: string; decisions: ApprovalDecision[] }> = [];
  for (const spec of specs) {
    const { label, sourcePath } = parseSourceSpec(spec);
    if (labels.has(label)) throw new Error(`duplicate-source-label:${label}`);
    labels.add(label);
    const raw = await readFile(sourcePath, "utf8");
    const decisions = extractDecisions(JSON.parse(raw));
    sources.push({
      label,
      path: sourcePath,
      sha256: sha256(raw),
      decisionCount: decisions.length
    });
    groups.push({ label, decisions });
  }

  const { decisions, duplicates } = dedupeApprovalDecisions(groups);
  const sourceDecisionCount = groups.reduce(
    (sum, group) => sum + group.decisions.length,
    0
  );
  const bundle = {
    generatedAt: new Date().toISOString(),
    bible: requiredArg("--bible"),
    status: "awaiting-explicit-human-durable-approval",
    internalOnly: true,
    aiGatewayCalls: 0,
    sourceDecisionCount,
    decisionCount: decisions.length,
    duplicateCount: duplicates.length,
    sources,
    duplicates,
    sha256: sha256(JSON.stringify(decisions)),
    decisions
  };
  await writeJsonFileImmutable(outputPath, bundle);
  process.stdout.write(
    `${JSON.stringify({ output: path.resolve(outputPath), ...bundle, decisions: undefined }, null, 2)}\n`
  );
}

if (process.argv[1]?.endsWith("semanticRefillApprovalBundle.ts")) {
  await main();
}
