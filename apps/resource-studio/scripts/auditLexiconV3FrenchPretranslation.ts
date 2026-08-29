import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { once } from "node:events";

import {
  auditFrenchPretranslationPacket,
  frenchPretranslationFamilyKey,
  frenchPretranslationStepFamilyMember,
  FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION,
  FRENCH_PRETRANSLATION_POLICY_VERSION,
  type FrenchPretranslationStepFamilyMember,
  type FrenchPretranslationGateStatus
} from "../src/lexiconV3/frenchPretranslationQuality.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";

const DEFAULT_INPUT = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_OUTPUT =
  "outputs/lexicon-v3/fr-internal/pretranslation-quality.jsonl";
const DEFAULT_SUMMARY =
  "outputs/lexicon-v3/fr-internal/pretranslation-quality.summary.json";
const DEFAULT_REPORT = "reports/lexicon-v3-french-pretranslation-quality.md";

export type FrenchPretranslationFailOn =
  | "source_issue"
  | "review_needed"
  | "none";

export interface FrenchPretranslationAuditOptions {
  input: string;
  output: string;
  summaryJson: string;
  report: string;
  failOn: FrenchPretranslationFailOn;
  generatedAt?: string;
}

export interface FrenchPretranslationAuditSummary {
  schemaVersion: "lexicon-v3-french-pretranslation-summary@1";
  policyVersion: typeof FRENCH_PRETRANSLATION_POLICY_VERSION;
  auditRecordSchemaVersion: typeof FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION;
  generatedAt: string;
  failOn: FrenchPretranslationFailOn;
  gatePassed: boolean;
  counts: {
    entries: number;
    ready: number;
    review_needed: number;
    source_issue: number;
    translationAllowed: number;
    autoPublicationAllowed: number;
  };
  issueCounts: Record<string, number>;
  samples: Record<Exclude<FrenchPretranslationGateStatus, "ready">, string[]>;
  source: { path: string; sha256: string };
  artifact: { path: string; sha256: string };
  reportPath: string;
}

export async function runFrenchPretranslationAudit(
  options: FrenchPretranslationAuditOptions
): Promise<FrenchPretranslationAuditSummary> {
  const input = resolve(options.input);
  const output = resolve(options.output);
  const summaryJson = resolve(options.summaryJson);
  const report = resolve(options.report);
  const temporaryOutput = `${output}.tmp-${process.pid}`;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const familyIndex = await readStepFamilyIndex(input);
  const counts = {
    entries: 0,
    ready: 0,
    review_needed: 0,
    source_issue: 0,
    translationAllowed: 0,
    autoPublicationAllowed: 0
  };
  const issueCounts = new Map<string, number>();
  const samples: FrenchPretranslationAuditSummary["samples"] = {
    review_needed: [],
    source_issue: []
  };

  await mkdir(dirname(output), { recursive: true });
  await mkdir(dirname(summaryJson), { recursive: true });
  await mkdir(dirname(report), { recursive: true });
  await rm(temporaryOutput, { force: true });
  const writer = createWriteStream(temporaryOutput, { encoding: "utf8" });
  const artifactHash = createHash("sha256");
  const seen = new Set<string>();

  try {
    const lines = createInterface({
      input: createReadStream(input, { encoding: "utf8" }),
      crlfDelay: Infinity
    });
    for await (const line of lines) {
      if (!line.trim()) continue;
      let packet: LexiconV3FrenchPacket;
      try {
        packet = JSON.parse(line) as LexiconV3FrenchPacket;
      } catch {
        throw new Error(
          `french-pretranslation-invalid-json:${counts.entries + 1}`
        );
      }
      if (seen.has(packet.entryKey)) {
        throw new Error(
          `french-pretranslation-duplicate-entry:${packet.entryKey}`
        );
      }
      seen.add(packet.entryKey);
      const audit = auditFrenchPretranslationPacket(packet, {
        familyMembers: familyIndex.get(frenchPretranslationFamilyKey(packet))
      });
      const encoded = `${JSON.stringify(audit)}\n`;
      if (!writer.write(encoded)) await once(writer, "drain");
      artifactHash.update(encoded);

      counts.entries += 1;
      counts[audit.gateStatus] += 1;
      if (audit.translationAllowed) counts.translationAllowed += 1;
      if (audit.autoPublicationAllowed) counts.autoPublicationAllowed += 1;
      if (
        audit.gateStatus !== "ready" &&
        samples[audit.gateStatus].length < 50
      ) {
        samples[audit.gateStatus].push(audit.entryKey);
      }
      for (const issue of audit.issues) {
        issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
      }
    }
    if (counts.entries === 0) {
      throw new Error("french-pretranslation-empty-input");
    }
    writer.end();
    await once(writer, "finish");
    await rename(temporaryOutput, output);
  } catch (error) {
    writer.on("error", () => undefined);
    writer.destroy();
    await rm(temporaryOutput, { force: true });
    throw error;
  }

  const gatePassed = frenchPretranslationGatePassed(counts, options.failOn);
  const summary: FrenchPretranslationAuditSummary = {
    schemaVersion: "lexicon-v3-french-pretranslation-summary@1",
    policyVersion: FRENCH_PRETRANSLATION_POLICY_VERSION,
    auditRecordSchemaVersion: FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION,
    generatedAt,
    failOn: options.failOn,
    gatePassed,
    counts,
    issueCounts: Object.fromEntries(
      [...issueCounts].sort(([left], [right]) => left.localeCompare(right))
    ),
    samples,
    source: { path: input, sha256: await sha256File(input) },
    artifact: { path: output, sha256: artifactHash.digest("hex") },
    reportPath: report
  };
  await writeFile(summaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(report, renderFrenchPretranslationReport(summary), "utf8");
  return summary;
}

export function frenchPretranslationGatePassed(
  counts: Pick<
    FrenchPretranslationAuditSummary["counts"],
    "review_needed" | "source_issue"
  >,
  failOn: FrenchPretranslationFailOn
): boolean {
  if (failOn === "none") return true;
  if (failOn === "source_issue") return counts.source_issue === 0;
  return counts.source_issue === 0 && counts.review_needed === 0;
}

export function renderFrenchPretranslationReport(
  summary: FrenchPretranslationAuditSummary
): string {
  const issueRows = Object.entries(summary.issueCounts)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .map(([code, count]) => `| \`${code}\` | ${count} |`)
    .join("\n");
  return `# French pretranslation quality gate

Generated: ${summary.generatedAt}

- Gate: **${summary.gatePassed ? "PASS" : "FAIL"}** (fail on \`${summary.failOn}\`)
- Entries: ${summary.counts.entries}
- Ready: ${summary.counts.ready}
- Review needed: ${summary.counts.review_needed}
- Source issues blocking translation: ${summary.counts.source_issue}
- Translation allowed: ${summary.counts.translationAllowed}
- Automatic publication allowed: ${summary.counts.autoPublicationAllowed}
- Source SHA-256: \`${summary.source.sha256}\`
- Audit SHA-256: \`${summary.artifact.sha256}\`

The gate never rewrites STEP or English content. It records an additional status
for the exact \`eStrong\` / \`dStrong\` / \`uStrong\` identity and blocks
translation only when the source is mechanically incomplete or invalid.

## Issues

| Code | Count |
|---|---:|
${issueRows || "| _none_ | 0 |"}

## Samples

- Source issues: ${summary.samples.source_issue.join(", ") || "none"}
- Review needed: ${summary.samples.review_needed.join(", ") || "none"}
`;
}

export function parseFrenchPretranslationAuditArgs(
  args: readonly string[]
): FrenchPretranslationAuditOptions {
  const values = new Map<string, string>();
  const allowed = new Set([
    "input",
    "output",
    "summary-json",
    "report",
    "fail-on",
    "generated-at"
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const raw = args[index];
    if (!raw?.startsWith("--")) {
      throw new Error(`french-pretranslation-unexpected-argument:${raw}`);
    }
    const [key, inline] = raw.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-pretranslation-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-pretranslation-duplicate-option:${key}`);
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) {
        throw new Error(`french-pretranslation-missing-value:${key}`);
      }
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`french-pretranslation-missing-value:${key}`);
    }
  }
  const failOn = values.get("fail-on") ?? "source_issue";
  if (
    !(["source_issue", "review_needed", "none"] as const).includes(
      failOn as FrenchPretranslationFailOn
    )
  ) {
    throw new Error(`french-pretranslation-invalid-fail-on:${failOn}`);
  }
  return {
    input: values.get("input") ?? DEFAULT_INPUT,
    output: values.get("output") ?? DEFAULT_OUTPUT,
    summaryJson: values.get("summary-json") ?? DEFAULT_SUMMARY,
    report: values.get("report") ?? DEFAULT_REPORT,
    failOn: failOn as FrenchPretranslationFailOn,
    ...(values.get("generated-at")
      ? { generatedAt: values.get("generated-at") }
      : {})
  };
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function readStepFamilyIndex(
  path: string
): Promise<Map<string, FrenchPretranslationStepFamilyMember[]>> {
  const index = new Map<string, FrenchPretranslationStepFamilyMember[]>();
  const lines = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    lineNumber += 1;
    let packet: LexiconV3FrenchPacket;
    try {
      packet = JSON.parse(line) as LexiconV3FrenchPacket;
    } catch {
      throw new Error(`french-pretranslation-invalid-json:${lineNumber}`);
    }
    const key = frenchPretranslationFamilyKey(packet);
    const members = index.get(key) ?? [];
    members.push(frenchPretranslationStepFamilyMember(packet));
    index.set(key, members);
  }
  for (const members of index.values()) {
    members.sort(
      (left, right) =>
        left.stepEntryId - right.stepEntryId ||
        left.entryKey.localeCompare(right.entryKey)
    );
  }
  return index;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    const summary = await runFrenchPretranslationAudit(
      parseFrenchPretranslationAuditArgs(process.argv.slice(2))
    );
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (!summary.gatePassed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
