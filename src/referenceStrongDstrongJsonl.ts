import { createHash } from "node:crypto";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";

import {
  normalizeClassicalStrong,
  type StepOriginalIndex,
  type StepStrongCandidates
} from "./stepOriginals.js";
import type { StepLexicalIdentityIndex } from "./stepLexicalIdentity.js";
import type { ReferenceStrongJsonlRecord } from "./referenceStrongJsonl.js";

export const REFERENCE_STRONG_DSTRONG_JSONL_SCHEMA_VERSION = 1;

export interface DstrongEnrichmentMetrics {
  ambiguousTokenCount: number;
  distinguishedStrongCount: number;
  enrichedTagCount: number;
  extendedStrongCount: number;
  missingVerseTokenCount: number;
  occurrenceOrderTokenCount: number;
  resolvedTokenCount: number;
  taggedTokenCount: number;
  unchangedClassicalStrongCount: number;
  uniqueCandidateTokenCount: number;
  unresolvedTokenCount: number;
  unifiedStrongCount: number;
  verseCount: number;
}

export interface ReferenceStrongDstrongJsonlResult {
  artifactSha256: string;
  metrics: DstrongEnrichmentMetrics;
  outputPath: string;
  sizeBytes: number;
  sourceSha256: string;
  version: string;
}

interface StrongResolution {
  sourceStrong: string;
  stepStrong?: string;
  status: "resolved" | "ambiguous" | "unresolved" | "missing-verse";
  method?: "unique-candidate" | "occurrence-order";
}

export async function writeReferenceStrongDstrongJsonl(options: {
  inputPath: string;
  identityIndex: StepLexicalIdentityIndex;
  outputPath: string;
  stepIndex: StepOriginalIndex;
}): Promise<ReferenceStrongDstrongJsonlResult> {
  const source = await readFile(options.inputPath, "utf8");
  const sourceLines = source.trimEnd().split("\n");
  const metrics = emptyMetrics();
  const outputRecords: ReferenceStrongJsonlRecord[] = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index];
    if (!line) continue;
    const record = JSON.parse(line) as ReferenceStrongJsonlRecord;
    assertReferenceRecord(record, index + 1);
    const result = enrichStrongTextWithDstrong({
      text: record.text,
      identityIndex: options.identityIndex,
      verseIndex: options.stepIndex.get(record.ref)
    });
    mergeMetrics(metrics, result.metrics);
    metrics.verseCount += 1;
    outputRecords.push({ ...record, text: result.text });
  }

  const temporaryPath = `${options.outputPath}.tmp`;
  await rm(temporaryPath, { force: true });
  try {
    await writeFile(
      temporaryPath,
      `${outputRecords.map((record) => JSON.stringify(record)).join("\n")}\n`,
      "utf8"
    );
    await verifyEnrichedRoundTrip({
      outputPath: temporaryPath,
      sourceLines,
      expectedRecords: outputRecords
    });
    await rename(temporaryPath, options.outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  const [artifactSha256, sourceSha256, outputStat] = await Promise.all([
    sha256File(options.outputPath),
    sha256File(options.inputPath),
    stat(options.outputPath)
  ]);

  return {
    artifactSha256,
    metrics,
    outputPath: options.outputPath,
    sizeBytes: outputStat.size,
    sourceSha256,
    version: outputRecords[0]?.version ?? ""
  };
}

export function enrichStrongTextWithDstrong(options: {
  text: string;
  identityIndex?: StepLexicalIdentityIndex;
  verseIndex: Map<string, StepStrongCandidates> | undefined;
}): { text: string; metrics: DstrongEnrichmentMetrics } {
  const metrics = emptyMetrics();
  const targetCounts = countTargetStrongOccurrences(options.text);
  const seen = new Map<string, number>();

  const text = options.text.replace(
    /<w\b([^>]*)>([\s\S]*?)<\/w>/giu,
    (match, rawAttributes, body) => {
      const attributes = String(rawAttributes);
      const strongValue = parseAttribute(attributes, "strong");
      if (!strongValue) return match;
      metrics.taggedTokenCount += 1;

      const resolutions = strongValue
        .split(/\s+/u)
        .filter(Boolean)
        .map((strong) =>
          resolveStrong({
            strong,
            verseIndex: options.verseIndex,
            targetCounts,
            seen
          })
        );

      recordTokenResolution(metrics, resolutions);
      const compact = compactStepIdentityAttributes(
        resolutions,
        options.identityIndex
      );
      if (
        compact.estrong.length === 0 &&
        compact.dstrong.length === 0 &&
        compact.ustrong.length === 0
      ) {
        return match;
      }

      metrics.enrichedTagCount += 1;
      metrics.extendedStrongCount += compact.estrong.length;
      metrics.distinguishedStrongCount += compact.dstrong.length;
      metrics.unifiedStrongCount += compact.ustrong.length;
      const cleanAttributes = stripStepIdentityAttributes(attributes).trimEnd();
      const identityAttributes = [
        renderCompactAttribute("estrong", compact.estrong),
        renderCompactAttribute("dstrong", compact.dstrong),
        renderCompactAttribute("ustrong", compact.ustrong)
      ]
        .filter(Boolean)
        .join("");
      return `<w${cleanAttributes}${identityAttributes}>${body}</w>`;
    }
  );

  return { text, metrics };
}

function resolveStrong(options: {
  strong: string;
  verseIndex: Map<string, StepStrongCandidates> | undefined;
  targetCounts: Map<string, number>;
  seen: Map<string, number>;
}): StrongResolution {
  const baseStrong = normalizeClassicalStrong(options.strong);
  if (!options.verseIndex) {
    return { sourceStrong: options.strong, status: "missing-verse" };
  }
  if (!baseStrong) {
    return { sourceStrong: options.strong, status: "unresolved" };
  }

  const candidate = options.verseIndex.get(baseStrong);
  if (!candidate || candidate.unique.size === 0) {
    return { sourceStrong: options.strong, status: "unresolved" };
  }

  const occurrenceIndex = options.seen.get(baseStrong) ?? 0;
  options.seen.set(baseStrong, occurrenceIndex + 1);
  const candidates = [...candidate.unique].sort();
  let stepStrong: string | undefined;
  let method: StrongResolution["method"];

  if (candidates.length === 1) {
    stepStrong = candidates[0];
    method = "unique-candidate";
  } else if (
    candidate.occurrences.length === options.targetCounts.get(baseStrong)
  ) {
    stepStrong = candidate.occurrences[occurrenceIndex];
    method = "occurrence-order";
  }

  if (!stepStrong || !method) {
    return { sourceStrong: options.strong, status: "ambiguous" };
  }
  return {
    sourceStrong: options.strong,
    status: "resolved",
    method,
    stepStrong
  };
}

function compactStepIdentityAttributes(
  resolutions: StrongResolution[],
  identityIndex: StepLexicalIdentityIndex | undefined
): { estrong: string[]; dstrong: string[]; ustrong: string[] } {
  const estrong: string[] = [];
  const dstrong: string[] = [];
  const ustrong: string[] = [];

  for (const resolution of resolutions) {
    if (!resolution.stepStrong) continue;
    const sourceStrong = normalizeStrongForComparison(resolution.sourceStrong);
    const identity = identityIndex?.get(resolution.stepStrong);
    const eStrong = identity?.eStrong ?? sourceStrong;

    if (eStrong && eStrong !== sourceStrong) estrong.push(eStrong);
    if (resolution.stepStrong !== (eStrong ?? sourceStrong)) {
      dstrong.push(resolution.stepStrong);
    }
    for (const unified of identity?.uStrong ?? []) {
      if (
        unified !== resolution.stepStrong &&
        unified !== eStrong &&
        unified !== sourceStrong
      ) {
        ustrong.push(unified);
      }
    }
  }

  return {
    estrong: unique(estrong),
    dstrong: unique(dstrong),
    ustrong: unique(ustrong)
  };
}

function recordTokenResolution(
  metrics: DstrongEnrichmentMetrics,
  resolutions: StrongResolution[]
): void {
  if (resolutions.some(({ status }) => status === "missing-verse")) {
    metrics.missingVerseTokenCount += 1;
  } else if (resolutions.some(({ status }) => status === "ambiguous")) {
    metrics.ambiguousTokenCount += 1;
  } else if (resolutions.some(({ status }) => status === "unresolved")) {
    metrics.unresolvedTokenCount += 1;
  } else {
    metrics.resolvedTokenCount += 1;
  }

  if (resolutions.some(({ method }) => method === "unique-candidate")) {
    metrics.uniqueCandidateTokenCount += 1;
  }
  if (resolutions.some(({ method }) => method === "occurrence-order")) {
    metrics.occurrenceOrderTokenCount += 1;
  }
  metrics.unchangedClassicalStrongCount += resolutions.filter(
    ({ status, stepStrong, sourceStrong }) =>
      status === "resolved" &&
      stepStrong === normalizeStrongForComparison(sourceStrong)
  ).length;
}

function countTargetStrongOccurrences(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/<w\b([^>]*)>[\s\S]*?<\/w>/giu)) {
    const strongValue = parseAttribute(match[1] ?? "", "strong");
    if (!strongValue) continue;
    for (const rawStrong of strongValue.split(/\s+/u).filter(Boolean)) {
      const baseStrong = normalizeClassicalStrong(rawStrong);
      if (!baseStrong) continue;
      counts.set(baseStrong, (counts.get(baseStrong) ?? 0) + 1);
    }
  }
  return counts;
}

function parseAttribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(
    new RegExp(`\\b${name}=(['"])([\\s\\S]*?)\\1`, "iu")
  );
  return match?.[2];
}

function stripStepIdentityAttributes(attributes: string): string {
  return attributes.replace(/\s+(?:e|d|u)strong=(['"])[\s\S]*?\1/giu, "");
}

function renderCompactAttribute(name: string, values: string[]): string {
  return values.length > 0
    ? ` ${name}="${escapeAttribute(values.join(" "))}"`
    : "";
}

function normalizeStrongForComparison(value: string): string | undefined {
  const canonical = normalizeClassicalStrong(value);
  const suffix = value
    .trim()
    .match(/^[HG]\d{1,5}([A-Za-z](?:_[A-Za-z])?)$/u)?.[1];
  return canonical ? `${canonical}${suffix ?? ""}` : undefined;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function emptyMetrics(): DstrongEnrichmentMetrics {
  return {
    ambiguousTokenCount: 0,
    distinguishedStrongCount: 0,
    enrichedTagCount: 0,
    extendedStrongCount: 0,
    missingVerseTokenCount: 0,
    occurrenceOrderTokenCount: 0,
    resolvedTokenCount: 0,
    taggedTokenCount: 0,
    unchangedClassicalStrongCount: 0,
    uniqueCandidateTokenCount: 0,
    unresolvedTokenCount: 0,
    unifiedStrongCount: 0,
    verseCount: 0
  };
}

function mergeMetrics(
  target: DstrongEnrichmentMetrics,
  source: DstrongEnrichmentMetrics
): void {
  for (const key of Object.keys(source) as Array<
    keyof DstrongEnrichmentMetrics
  >) {
    target[key] += source[key];
  }
}

function assertReferenceRecord(
  record: ReferenceStrongJsonlRecord,
  line: number
): void {
  if (
    !record ||
    typeof record.ref !== "string" ||
    typeof record.version !== "string" ||
    typeof record.text !== "string"
  ) {
    throw new Error(`Invalid reference Strong JSONL record at line ${line}`);
  }
}

async function verifyEnrichedRoundTrip(options: {
  outputPath: string;
  sourceLines: string[];
  expectedRecords: ReferenceStrongJsonlRecord[];
}): Promise<void> {
  const outputLines = (await readFile(options.outputPath, "utf8"))
    .trimEnd()
    .split("\n");
  if (outputLines.length !== options.expectedRecords.length) {
    throw new Error("D-Strong JSONL verse count changed during enrichment");
  }

  for (let index = 0; index < outputLines.length; index += 1) {
    const actual = JSON.parse(
      outputLines[index] ?? "null"
    ) as ReferenceStrongJsonlRecord;
    const expected = options.expectedRecords[index];
    const source = JSON.parse(
      options.sourceLines[index] ?? "null"
    ) as ReferenceStrongJsonlRecord;
    if (!expected || JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `D-Strong JSONL round-trip mismatch at line ${index + 1}`
      );
    }
    if (
      JSON.stringify({
        ...actual,
        text: stripAllStepIdentityAttributes(actual.text)
      }) !==
      JSON.stringify({
        ...source,
        text: stripAllStepIdentityAttributes(source.text)
      })
    ) {
      throw new Error(
        `D-Strong enrichment changed source data at line ${index + 1}`
      );
    }
    validateStepIdentityTags(actual.text, index + 1);
  }
}

function stripAllStepIdentityAttributes(text: string): string {
  return text.replace(/\s+(?:e|d|u)strong=(['"])[\s\S]*?\1/giu, "");
}

function validateStepIdentityTags(text: string, line: number): void {
  for (const match of text.matchAll(/<w\b([^>]*)>/giu)) {
    const attributes = match[1] ?? "";
    const strongValue = parseAttribute(attributes, "strong");
    for (const name of ["estrong", "dstrong", "ustrong"] as const) {
      const value = parseAttribute(attributes, name);
      if (!value) continue;
      if (!strongValue) {
        throw new Error(`${name} without strong at JSONL line ${line}`);
      }
      for (const code of value.split(/\s+/u).filter(Boolean)) {
        if (!normalizeClassicalStrong(code)) {
          throw new Error(`Invalid ${name} ${code} at JSONL line ${line}`);
        }
      }
    }
  }
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}
