#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probableLanguage } from "./quality.mjs";
import {
  batchSegmentBindings,
  translatedTextFor,
  validateBatchResponse
} from "./sdabc-french-translation-pipeline.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));
const normalized = (value) =>
  String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const letterCount = (value) => (String(value).match(/\p{L}/gu) ?? []).length;
const referenceTokens = (value) =>
  (
    String(value).match(/\d+\s*:\s*\d+(?:\s*[-–]\s*\d+)?/gu) ?? []
  ).map((token) => token.replace(/\s+/gu, "").replace("–", "-"));
const containsMultiset = (expected, actual) => {
  const remaining = new Map();
  for (const value of actual) {
    remaining.set(value, (remaining.get(value) ?? 0) + 1);
  }
  return expected.every((value) => {
    const count = remaining.get(value) ?? 0;
    if (!count) return false;
    remaining.set(value, count - 1);
    return true;
  });
};
const hasStrongFrenchEvidence = (value) => {
  const text = String(value).toLocaleLowerCase("fr");
  const diacritics = text.match(/[àâçéèêëîïôùûüÿœæ]/gu) ?? [];
  const markers =
    text.match(
      /\b(?:au|aux|ce|ces|du|elle|elles|était|être|il|ils|la|le|les|nom|tu|un|verbe)\b/gu
    ) ?? [];
  return diacritics.length >= 2 || markers.length >= 3;
};
const isSdabcBibliographicCitation = (value) =>
  /Nichol, F\. D\. \(1978\)\. The Seventh-day Adventist Bible Commentary\s*:/u.test(
    String(value).trim()
  );

export const inspectSdabcSegmentTranslation = (sourceText, translatedText) => {
  if (
    normalized(sourceText) === normalized(translatedText) &&
    isSdabcBibliographicCitation(sourceText)
  ) {
    return [];
  }
  const sourceLetters = letterCount(sourceText);
  const translationLetters = letterCount(translatedText);
  const issues = [];
  if (
    sourceLetters >= 80 &&
    normalized(sourceText) === normalized(translatedText)
  ) {
    issues.push("identical-long-segment");
  }
  if (
    translationLetters >= 120 &&
    probableLanguage(translatedText) === "en" &&
    !hasStrongFrenchEvidence(translatedText)
  ) {
    issues.push("probably-english-long-segment");
  }
  if (sourceLetters >= 200 && translationLetters < sourceLetters * 0.35) {
    issues.push("suspiciously-short-translation");
  }
  if (sourceLetters >= 200 && translationLetters > sourceLetters * 1.8) {
    issues.push("suspiciously-long-translation");
  }
  const sourceReferences = referenceTokens(sourceText);
  if (
    sourceLetters <= 100 &&
    !/o’clock/iu.test(sourceText) &&
    sourceReferences.length &&
    !containsMultiset(sourceReferences, referenceTokens(translatedText))
  ) {
    issues.push("numeric-token-mismatch");
  }
  return issues;
};

export const auditSdabcRunDirectory = async ({
  planRoot,
  runsRoot,
  reportPath
}) => {
  const manifest = await readJson(path.join(planRoot, "manifest.json"));
  const issues = [];
  let segments = 0;
  for (const descriptor of manifest.batches) {
    const [batch, response] = await Promise.all([
      readJson(path.join(planRoot, "batches", `${descriptor.batchId}.json`)),
      readJson(path.join(runsRoot, descriptor.batchId, "response.json"))
    ]);
    validateBatchResponse(batch, response);
    const sources = batchSegmentBindings(batch);
    for (const source of sources) {
      segments += 1;
      const translatedText = translatedTextFor(response, source.key);
      for (const kind of inspectSdabcSegmentTranslation(
        source.segment.sourceText,
        translatedText
      )) {
        issues.push({
          kind,
          batchId: batch.batchId,
          entryId: source.task.entryId,
          segmentId: source.segment.id,
          sourceText: source.segment.sourceText,
          translatedText
        });
      }
    }
  }
  const report = {
    schemaVersion: "sdabc-french-translation-quality@1",
    manifestHash: manifest.manifestHash,
    batches: manifest.batches.length,
    segments,
    blockingIssues: issues.length,
    issues
  };
  if (reportPath) {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
};

const run = async () => {
  const local = path.join(workflowRoot, ".local");
  const options = {
    planRoot: path.join(local, "sdabc-french-translation-plan"),
    runsRoot: path.join(local, "sdabc-french-translation-runs"),
    reportPath: path.join(local, "sdabc-french-translation-quality.json")
  };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--plan")
      options.planRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--runs")
      options.runsRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--report")
      options.reportPath = path.resolve(argv[++index]);
    else throw new Error(`Argument inconnu : ${argv[index]}`);
  }
  const report = await auditSdabcRunDirectory(options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.blockingIssues) process.exitCode = 1;
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
