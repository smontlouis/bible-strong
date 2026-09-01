#!/usr/bin/env node

import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectSdabcSegmentTranslation } from "./audit-sdabc-french-codex-translations.mjs";
import { executeBatch } from "./run-sdabc-french-codex-translations.mjs";
import {
  SDABC_CODEX_RUN_SCHEMA,
  SDABC_TRANSLATOR,
  batchSegmentBindings,
  canonicalJson,
  responseJsonSchema,
  sha256,
  sourceBindingMatches,
  translatedTextFor,
  validateBatchResponse
} from "./sdabc-french-translation-pipeline.mjs";
import {
  SDABC_CODEX_SHA256,
  ensureSdabcCodexBinary
} from "./sdabc-codex-runtime.mjs";

const workflowRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));
const fileSha256 = async (filePath) => sha256(await readFile(filePath));
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

const eventMetadata = (text) => {
  let threadId = null;
  let usage = null;
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") threadId = event.thread_id ?? null;
      if (event.type === "turn.completed") usage = event.usage ?? null;
    } catch {
      // The raw file hash still preserves an unparsable diagnostic faithfully.
    }
  }
  return { threadId, usage };
};

const virtualBatchFor = (batch, binding) => ({
  ...batch,
  batchId: `${batch.batchId}-${binding.key}`,
  sourceCharacters: binding.segment.sourceText.length,
  tasks: [
    {
      ...binding.task,
      sourceCharacters: binding.segment.sourceText.length,
      segments: [binding.segment]
    }
  ]
});

export const acceptedRejectedCandidates = async (batch, rejectedRoot) => {
  const bindings = batchSegmentBindings(batch);
  const candidates = new Map();
  if (!existsSync(rejectedRoot)) return candidates;
  const files = (await readdir(rejectedRoot))
    .filter((name) => name.endsWith(".response.json"))
    .sort();
  for (const responseName of files) {
    const stem = responseName.slice(0, -".response.json".length);
    let response;
    try {
      response = await readJson(path.join(rejectedRoot, responseName));
    } catch {
      continue;
    }
    for (const binding of bindings) {
      if (candidates.has(binding.key)) continue;
      const value = response?.translations?.[binding.key];
      if (
        typeof value?.text === "string" &&
        value.text.trim() &&
        sourceBindingMatches(binding.segment.sourceText, value.sourceText) &&
        inspectSdabcSegmentTranslation(
          binding.segment.sourceText,
          value.text
        ).length === 0
      ) {
        candidates.set(binding.key, { text: value.text, stem });
      }
    }
  }
  return candidates;
};

const rejectedComponent = async (rejectedRoot, stem, keys) => {
  const responsePath = path.join(rejectedRoot, `${stem}.response.json`);
  const eventsPath = path.join(rejectedRoot, `${stem}.events.jsonl`);
  const stderrPath = path.join(rejectedRoot, `${stem}.stderr.log`);
  const eventsText = await readFile(eventsPath, "utf8");
  return {
    kind: "rejected-attempt-reuse",
    keys,
    sourceFiles: {
      response: path.relative(workflowRoot, responsePath),
      events: path.relative(workflowRoot, eventsPath),
      stderr: path.relative(workflowRoot, stderrPath)
    },
    responseSha256: await fileSha256(responsePath),
    eventsSha256: sha256(eventsText),
    stderrSha256: await fileSha256(stderrPath),
    ...eventMetadata(eventsText)
  };
};

const archiveCurrentRun = async (batch, runRoot) => {
  const receiptPath = path.join(runRoot, "receipt.json");
  if (!existsSync(receiptPath)) return null;
  const responsePath = path.join(runRoot, "response.json");
  const receipt = await readJson(receiptPath);
  const response = await readJson(responsePath);
  validateBatchResponse(batch, response);
  const candidates = new Map();
  for (const binding of batchSegmentBindings(batch)) {
    const text = translatedTextFor(response, binding.key);
    if (
      inspectSdabcSegmentTranslation(binding.segment.sourceText, text).length ===
      0
    ) {
      candidates.set(binding.key, { text });
    }
  }
  const archiveRoot = path.join(
    runRoot,
    "components",
    `prior-run-${receipt.runHash.slice(0, 16)}`
  );
  await mkdir(archiveRoot, { recursive: true });
  const names = [
    "response.json",
    "response.schema.json",
    "events.jsonl",
    "stderr.log",
    "receipt.json"
  ];
  for (const name of names) {
    await rename(path.join(runRoot, name), path.join(archiveRoot, name));
  }
  return {
    candidates,
    component: {
      kind: "prior-complete-run-reuse",
      keys: [...candidates.keys()],
      sourceFiles: Object.fromEntries(
        names.map((name) => [name, path.relative(workflowRoot, path.join(archiveRoot, name))])
      ),
      responseSha256: receipt.responseSha256,
      responseSchemaSha256: receipt.responseSchemaSha256,
      eventsSha256: receipt.eventsSha256,
      stderrSha256: receipt.stderrSha256,
      receiptSha256: await fileSha256(path.join(archiveRoot, "receipt.json")),
      sourceRunHash: receipt.runHash,
      threadId: receipt.threadId,
      usage: receipt.usage ?? null
    }
  };
};

export const completePartitionedBatch = async ({
  batch,
  manifest,
  runRoot,
  binary,
  codexHome,
  timeoutMs = 20 * 60 * 1000,
  maxAttempts = 6,
  executor = executeBatch
}) => {
  const rejectedRoot = path.join(runRoot, "rejected-attempts");
  const bindings = batchSegmentBindings(batch);
  const components = [];
  const startedAt = new Date().toISOString();
  const prior = await archiveCurrentRun(batch, runRoot);
  const candidates = prior?.candidates ?? new Map();
  const priorKeys = new Set(candidates.keys());
  if (prior) components.push(prior.component);
  const rejectedCandidates = await acceptedRejectedCandidates(
    batch,
    rejectedRoot
  );
  for (const [key, candidate] of rejectedCandidates) {
    if (!candidates.has(key)) candidates.set(key, candidate);
  }
  const reusedByStem = new Map();
  for (const [key, candidate] of rejectedCandidates) {
    if (priorKeys.has(key) || !candidates.has(key)) continue;
    const keys = reusedByStem.get(candidate.stem) ?? [];
    keys.push(key);
    reusedByStem.set(candidate.stem, keys);
  }
  for (const [stem, keys] of reusedByStem) {
    components.push(await rejectedComponent(rejectedRoot, stem, keys));
  }

  for (const binding of bindings) {
    if (candidates.has(binding.key)) continue;
    const componentRoot = path.join(runRoot, "components", binding.key);
    const virtualBatch = virtualBatchFor(batch, binding);
    const schemaPath = path.join(componentRoot, "response.schema.json");
    const responsePath = path.join(componentRoot, "response.json");
    await atomicWrite(
      schemaPath,
      `${JSON.stringify(responseJsonSchema(virtualBatch), null, 2)}\n`
    );
    let execution;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        execution = await executor({
          binary: binary.path,
          codexHome,
          schemaPath,
          responsePath,
          batch: virtualBatch,
          timeoutMs
        });
        const text = execution.response.translations.s0001.text;
        const issues = inspectSdabcSegmentTranslation(
          binding.segment.sourceText,
          text
        );
        if (issues.length) throw new Error(`sdabc-segment-quality:${issues}`);
        candidates.set(binding.key, { text });
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!execution || !candidates.has(binding.key)) throw lastError;
    await Promise.all([
      atomicWrite(responsePath, execution.responseText),
      atomicWrite(path.join(componentRoot, "events.jsonl"), execution.stdout),
      atomicWrite(path.join(componentRoot, "stderr.log"), execution.stderr)
    ]);
    components.push({
      kind: "single-segment-run",
      keys: [binding.key],
      sourceFiles: {
        response: path.relative(workflowRoot, responsePath),
        events: path.relative(workflowRoot, path.join(componentRoot, "events.jsonl")),
        stderr: path.relative(workflowRoot, path.join(componentRoot, "stderr.log"))
      },
      responseSha256: await fileSha256(responsePath),
      eventsSha256: sha256(execution.stdout),
      stderrSha256: sha256(execution.stderr),
      threadId: execution.threadId,
      usage: execution.usage
    });
  }

  const response = {
    translations: Object.fromEntries(
      bindings.map((binding) => [
        binding.key,
        {
          sourceText: binding.segment.sourceText,
          text: candidates.get(binding.key).text
        }
      ])
    )
  };
  validateBatchResponse(batch, response);
  for (const binding of bindings) {
    const issues = inspectSdabcSegmentTranslation(
      binding.segment.sourceText,
      response.translations[binding.key].text
    );
    if (issues.length)
      throw new Error(`sdabc-batch-quality:${binding.key}:${issues.join(",")}`);
  }

  const responsePath = path.join(runRoot, "response.json");
  const schemaPath = path.join(runRoot, "response.schema.json");
  const eventsPath = path.join(runRoot, "events.jsonl");
  const stderrPath = path.join(runRoot, "stderr.log");
  const receiptPath = path.join(runRoot, "receipt.json");
  await atomicWrite(responsePath, `${JSON.stringify(response, null, 2)}\n`);
  await atomicWrite(
    schemaPath,
    `${JSON.stringify(responseJsonSchema(batch), null, 2)}\n`
  );
  await atomicWrite(
    eventsPath,
    `${JSON.stringify({
      type: "sdabc.partitioned_fallback",
      batchId: batch.batchId,
      components
    })}\n`
  );
  await atomicWrite(
    stderrPath,
    "Composite receipt: accepted source-bound model outputs were merged; see componentRuns.\n"
  );
  const primaryThread = components.find((value) => value.threadId)?.threadId;
  const content = {
    schemaVersion: SDABC_CODEX_RUN_SCHEMA,
    manifestHash: manifest.manifestHash,
    batchId: batch.batchId,
    batchHash: batch.batchHash,
    model: SDABC_TRANSLATOR.model,
    reasoningEffort: SDABC_TRANSLATOR.reasoningEffort,
    sandbox: "read-only",
    executor: binary,
    executionMode: "partitioned-fallback",
    threadId: primaryThread ?? `partitioned-fallback:${batch.batchId}`,
    startedAt,
    completedAt: new Date().toISOString(),
    responseSha256: await fileSha256(responsePath),
    responseSchemaSha256: await fileSha256(schemaPath),
    eventsSha256: await fileSha256(eventsPath),
    stderrSha256: await fileSha256(stderrPath),
    usage: null,
    componentRuns: components
  };
  const receipt = { ...content, runHash: sha256(canonicalJson(content)) };
  await atomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
};

const run = async () => {
  const localRoot = path.join(workflowRoot, ".local");
  const planRoot = path.join(localRoot, "sdabc-french-translation-plan");
  const runsRoot = path.join(localRoot, "sdabc-french-translation-runs");
  const codexHome = path.join(localRoot, "sdabc-codex-home");
  const binary = ensureSdabcCodexBinary({
    destination: path.join(
      localRoot,
      "sdabc-codex-runtime",
      `codex-${SDABC_CODEX_SHA256}`
    )
  });
  const batchIds = process.argv.slice(2);
  if (!batchIds.length) throw new Error("Fournir au moins un identifiant de lot");
  const manifest = await readJson(path.join(planRoot, "manifest.json"));
  const receipts = [];
  for (const batchId of batchIds) {
    const batch = await readJson(path.join(planRoot, "batches", `${batchId}.json`));
    receipts.push(
      await completePartitionedBatch({
        batch,
        manifest,
        runRoot: path.join(runsRoot, batchId),
        binary,
        codexHome
      })
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      receipts.map((receipt) => ({
        batchId: receipt.batchId,
        components: receipt.componentRuns.length,
        runHash: receipt.runHash
      })),
      null,
      2
    )}\n`
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
