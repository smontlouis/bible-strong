#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SDABC_CODEX_RUN_SCHEMA,
  SDABC_TRANSLATION_BATCH_SCHEMA,
  SDABC_TRANSLATION_PLAN_SCHEMA,
  SDABC_TRANSLATOR,
  assemblePlanResponses,
  canonicalJson,
  exactSourceResponseJsonSchema,
  legacyResponseJsonSchema,
  responseJsonSchema,
  sha256
} from "./sdabc-french-translation-pipeline.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));
const atomicWrite = async (filePath, text) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, filePath);
  } finally {
    await rm(temporary, { force: true });
  }
};

export const validateSdabcRunDirectory = async ({
  planRoot,
  runsRoot,
  outputPath
}) => {
  const manifest = await readJson(path.join(planRoot, "manifest.json"));
  const { manifestHash, ...manifestContent } = manifest;
  if (
    manifest.schemaVersion !== SDABC_TRANSLATION_PLAN_SCHEMA ||
    manifestHash !== sha256(canonicalJson(manifestContent))
  ) {
    throw new Error("sdabc-plan-manifest");
  }
  const batches = [];
  const responses = [];
  for (const descriptor of manifest.batches) {
    const batchPath = path.join(
      planRoot,
      "batches",
      `${descriptor.batchId}.json`
    );
    const responsePath = path.join(
      runsRoot,
      descriptor.batchId,
      "response.json"
    );
    const receiptPath = path.join(runsRoot, descriptor.batchId, "receipt.json");
    if (!existsSync(responsePath) || !existsSync(receiptPath))
      throw new Error(`sdabc-run-missing:${descriptor.batchId}`);
    const responseSchemaPath = path.join(
      runsRoot,
      descriptor.batchId,
      "response.schema.json"
    );
    const [batch, response, receipt, responseSchema] = await Promise.all([
      readJson(batchPath),
      readJson(responsePath),
      readJson(receiptPath),
      readJson(responseSchemaPath)
    ]);
    const { batchHash, ...batchContent } = batch;
    if (
      batch.schemaVersion !== SDABC_TRANSLATION_BATCH_SCHEMA ||
      batchHash !== descriptor.batchHash ||
      batchHash !== sha256(canonicalJson(batchContent))
    ) {
      throw new Error(`sdabc-run-batch:${descriptor.batchId}`);
    }
    const { runHash, ...receiptContent } = receipt;
    const responseSchemaCanonical = canonicalJson(responseSchema);
    if (
      ![
        canonicalJson(legacyResponseJsonSchema(batch)),
        canonicalJson(exactSourceResponseJsonSchema(batch)),
        canonicalJson(responseJsonSchema(batch))
      ].includes(responseSchemaCanonical) ||
      receipt.schemaVersion !== SDABC_CODEX_RUN_SCHEMA ||
      receipt.model !== SDABC_TRANSLATOR.model ||
      receipt.reasoningEffort !== SDABC_TRANSLATOR.reasoningEffort ||
      receipt.sandbox !== "read-only" ||
      !receipt.executor?.version ||
      !receipt.executor?.sha256 ||
      runHash !== sha256(canonicalJson(receiptContent)) ||
      receipt.manifestHash !== manifest.manifestHash ||
      receipt.batchHash !== descriptor.batchHash ||
      receipt.responseSha256 !== sha256(await readFile(responsePath)) ||
      receipt.responseSchemaSha256 !==
        sha256(await readFile(responseSchemaPath)) ||
      receipt.eventsSha256 !==
        sha256(
          await readFile(
            path.join(runsRoot, descriptor.batchId, "events.jsonl")
          )
        ) ||
      receipt.stderrSha256 !==
        sha256(
          await readFile(path.join(runsRoot, descriptor.batchId, "stderr.log"))
        )
    ) {
      throw new Error(`sdabc-run-receipt:${descriptor.batchId}`);
    }
    batches.push(batch);
    responses.push(response);
  }
  const translated = assemblePlanResponses(manifest, batches, responses);
  const mechanical = manifest.mechanical.map((value) => ({
    schemaVersion: "sdabc-french-translation-result@1",
    id: value.id,
    layer: value.layer,
    passage: value.passage,
    sourceSha256: value.sourceSha256,
    sourceContentHash: value.sourceContentHash,
    origin: { kind: "mechanical-copy", reason: value.reason },
    translation: {
      language: "fr",
      html: value.translatedHtml,
      sha256: sha256(value.translatedHtml)
    }
  }));
  const records = [...translated, ...mechanical].sort((a, b) =>
    a.id.localeCompare(b.id, "en", { numeric: true })
  );
  const text = `${records.map((value) => JSON.stringify(value)).join("\n")}\n`;
  await atomicWrite(outputPath, text);
  return {
    manifestHash: manifest.manifestHash,
    translations: translated.length,
    mechanical: mechanical.length,
    reviews: manifest.reviews.length,
    outputPath,
    outputSha256: sha256(text),
    logicalDigest: sha256(
      canonicalJson(
        records.map((value) => ({
          id: value.id,
          sourceContentHash: value.sourceContentHash,
          translationSha256: value.translation.sha256
        }))
      )
    )
  };
};

const run = async () => {
  const local = path.join(workflowRoot, ".local");
  const options = {
    planRoot: path.join(local, "sdabc-french-translation-plan"),
    runsRoot: path.join(local, "sdabc-french-translation-runs"),
    outputPath: path.join(local, "sdabc-french-translations.validated.jsonl")
  };
  for (let index = 0; index < process.argv.slice(2).length; index += 1) {
    const argv = process.argv.slice(2);
    if (argv[index] === "--plan")
      options.planRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--runs")
      options.runsRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--output")
      options.outputPath = path.resolve(argv[++index]);
    else throw new Error(`Argument inconnu : ${argv[index]}`);
  }
  process.stdout.write(
    `${JSON.stringify(await validateSdabcRunDirectory(options), null, 2)}\n`
  );
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
