#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SDABC_TRANSLATION_BATCH_SCHEMA,
  SDABC_CODEX_RUN_SCHEMA,
  SDABC_TRANSLATION_PLAN_SCHEMA,
  SDABC_TRANSLATOR,
  batchSegmentBindings,
  canonicalJson,
  responseJsonSchema,
  sha256,
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
const DISABLED_FEATURES = [
  "apps",
  "browser_use",
  "browser_use_external",
  "code_mode",
  "code_mode_host",
  "computer_use",
  "goals",
  "hooks",
  "image_generation",
  "in_app_browser",
  "multi_agent",
  "plugins",
  "shell_snapshot",
  "shell_tool",
  "skill_mcp_dependency_install",
  "standalone_web_search",
  "tool_suggest",
  "unified_exec",
  "workspace_dependencies"
];

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

export const sdabcCodexExecArgs = ({ schemaPath, responsePath, cwd }) => [
  "exec",
  "--ignore-user-config",
  "--ignore-rules",
  "--ephemeral",
  "-m",
  SDABC_TRANSLATOR.model,
  "-c",
  `model_reasoning_effort=${JSON.stringify(SDABC_TRANSLATOR.reasoningEffort)}`,
  ...DISABLED_FEATURES.flatMap((feature) => ["--disable", feature]),
  "--skip-git-repo-check",
  "-s",
  "read-only",
  "--json",
  "--output-schema",
  path.resolve(schemaPath),
  "-o",
  path.resolve(responsePath),
  "-C",
  path.resolve(cwd),
  "-"
];

export const buildSdabcTranslationPrompt = (
  batch
) => `Tu traduis en français les seuls segments textuels fournis ci-dessous.

Règles scellées :
- Réponds uniquement avec l'objet JSON conforme au schéma.
- Rends un objet translations contenant exactement chaque clé ordinale fournie. Chaque valeur contient sourceText, recopié strictement à l'identique, et text, sa traduction française.
- Pour chaque clé, lis et recopie d'abord son propre sourceText avant d'écrire text. La traduction de text doit correspondre exclusivement au sourceText présent dans le même objet.
- Traduis chaque segment dans sa propre clé : ne déplace, ne fusionne et ne répartis jamais du texte entre deux clés.
- Si un sourceText commence ou finit au milieu d'une phrase, traduis uniquement ce fragment et laisse sa traduction commencer ou finir au même endroit ; ne complète jamais le fragment avec le contenu d'une clé voisine.
- La liste est plate : traite chaque paire clé/sourceText indépendamment, même lorsque deux fragments voisins semblent former une phrase continue.
- Ne produis que les textes traduits. Les identités réelles et les hashes ne te sont pas confiés.
- Le champ text contient du texte brut français : aucun HTML, aucun Markdown, aucun placeholder.
- Préserve le sens, les nombres et la ponctuation utile. N'ajoute ni commentaire ni information.
- La structure HTML, les attributs, les références OSIS, les citations source et les identités sont hors de ton contrôle et seront réassemblés séparément.
- N'utilise aucune source externe et ne modifie aucun fichier.

Lot ${batch.batchId} :
${JSON.stringify({
  segments: batchSegmentBindings(batch).map((binding) => ({
    key: binding.key,
    sourceText: binding.segment.sourceText
  }))
})}`;

export const parseCodexEvents = (stdout, responseText) => {
  let threadId = null;
  let usage = null;
  let state = "thread";
  const messages = [];
  for (const [index, line] of stdout.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error(`sdabc-codex-event-json:${index + 1}`);
    }
    if (
      event.type === "thread.started" &&
      state === "thread" &&
      typeof event.thread_id === "string"
    ) {
      threadId = event.thread_id;
      state = "turn";
    } else if (
      event.type === "item.completed" &&
      state === "turn" &&
      event.item?.type === "error" &&
      event.item.message ===
        "Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`."
    ) {
      // Expected preflight notice for this deliberately tool-less translation runtime.
    } else if (event.type === "turn.started" && state === "turn")
      state = "message";
    else if (
      event.type === "item.completed" &&
      ["message", "messages"].includes(state) &&
      event.item?.type === "agent_message" &&
      typeof event.item.text === "string"
    ) {
      messages.push(event.item.text);
      state = "messages";
    } else if (event.type === "turn.completed" && state === "messages") {
      usage = event.usage ?? null;
      state = "complete";
    } else throw new Error(`sdabc-codex-event-forbidden:${String(event.type)}`);
  }
  if (
    state !== "complete" ||
    !threadId ||
    !messages.length ||
    canonicalJson(JSON.parse(messages.at(-1))) !==
      canonicalJson(JSON.parse(responseText))
  ) {
    throw new Error("sdabc-codex-event-response-mismatch");
  }
  return { threadId, usage };
};

const sealedEnvironment = (codexHome) => ({
  HOME: path.resolve(codexHome),
  CODEX_HOME: path.resolve(codexHome),
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  SHELL: "/bin/zsh",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  TERM: "dumb",
  NO_COLOR: "1",
  USER: process.env.USER ?? "codex",
  LOGNAME: process.env.LOGNAME ?? process.env.USER ?? "codex",
  TMPDIR: process.env.TMPDIR ?? "/tmp"
});

export const executeBatch = async ({
  binary,
  codexHome,
  schemaPath,
  responsePath,
  batch,
  timeoutMs
}) => {
  const cwd = path.dirname(responsePath);
  await mkdir(cwd, { recursive: true });
  const temporaryResponse = `${responsePath}.tmp-model-${process.pid}-${Date.now()}`;
  const child = spawn(
    binary,
    sdabcCodexExecArgs({ schemaPath, responsePath: temporaryResponse, cwd }),
    {
      cwd,
      env: sealedEnvironment(codexHome),
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (value) => {
    stdout += value;
  });
  child.stderr.on("data", (value) => {
    stderr += value;
  });
  child.stdin.end(buildSdabcTranslationPrompt(batch));
  let timedOut = false;
  const exitCode = await new Promise((resolve, reject) => {
    let killTimer;
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch {}
      killTimer = setTimeout(() => {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {}
      }, 2_000);
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      resolve(code ?? -1);
    });
  });
  if (timedOut || exitCode !== 0 || !existsSync(temporaryResponse)) {
    await rm(temporaryResponse, { force: true });
    throw new Error(
      timedOut
        ? `sdabc-codex-timeout:${batch.batchId}`
        : `sdabc-codex-exit:${batch.batchId}:${exitCode}:${stderr.slice(-500)}`
    );
  }
  const responseText = await readFile(temporaryResponse, "utf8");
  await rm(temporaryResponse, { force: true });
  try {
    const response = JSON.parse(responseText);
    validateBatchResponse(batch, response);
    const events = parseCodexEvents(stdout, responseText);
    return {
      response,
      responseText: `${responseText.trim()}\n`,
      stdout,
      stderr,
      ...events
    };
  } catch (error) {
    const diagnosticRoot = path.join(cwd, "rejected-attempts");
    const attemptId = `${Date.now()}-${process.pid}`;
    await Promise.all([
      atomicWrite(
        path.join(diagnosticRoot, `${attemptId}.response.json`),
        responseText
      ),
      atomicWrite(
        path.join(diagnosticRoot, `${attemptId}.events.jsonl`),
        stdout
      ),
      atomicWrite(path.join(diagnosticRoot, `${attemptId}.stderr.log`), stderr)
    ]);
    throw new Error(
      `${error.message}; diagnostic=${path.join(diagnosticRoot, attemptId)}`
    );
  }
};

const runOne = async ({ options, manifest, descriptor, executor }) => {
  const batchPath = path.join(
    options.planRoot,
    "batches",
    `${descriptor.batchId}.json`
  );
  const batch = await readJson(batchPath);
  const { batchHash, ...batchContent } = batch;
  if (
    batch.schemaVersion !== SDABC_TRANSLATION_BATCH_SCHEMA ||
    batchHash !== descriptor.batchHash ||
    sha256(canonicalJson(batchContent)) !== batchHash
  ) {
    throw new Error(`sdabc-batch-hash:${descriptor.batchId}`);
  }
  const runRoot = path.join(options.outputRoot, descriptor.batchId);
  const responsePath = path.join(runRoot, "response.json");
  const eventsPath = path.join(runRoot, "events.jsonl");
  const stderrPath = path.join(runRoot, "stderr.log");
  const responseSchemaPath = path.join(runRoot, "response.schema.json");
  const receiptPath = path.join(runRoot, "receipt.json");
  const responseSchemaText = `${JSON.stringify(responseJsonSchema(batch), null, 2)}\n`;
  if (existsSync(receiptPath)) {
    const receipt = await readJson(receiptPath);
    const { runHash, ...receiptContent } = receipt;
    if (
      receipt.schemaVersion !== SDABC_CODEX_RUN_SCHEMA ||
      runHash !== sha256(canonicalJson(receiptContent)) ||
      receipt.manifestHash !== manifest.manifestHash ||
      receipt.batchHash !== batch.batchHash ||
      receipt.model !== SDABC_TRANSLATOR.model ||
      receipt.reasoningEffort !== SDABC_TRANSLATOR.reasoningEffort ||
      canonicalJson(receipt.executor) !== canonicalJson(options.binary) ||
      receipt.responseSchemaSha256 !== (await fileSha256(responseSchemaPath)) ||
      receipt.responseSha256 !== (await fileSha256(responsePath)) ||
      receipt.eventsSha256 !== (await fileSha256(eventsPath)) ||
      receipt.stderrSha256 !== (await fileSha256(stderrPath))
    ) {
      throw new Error(`sdabc-existing-run-stale:${batch.batchId}`);
    }
    validateBatchResponse(batch, await readJson(responsePath));
    return receipt;
  }
  await atomicWrite(responseSchemaPath, responseSchemaText);
  const startedAt = new Date().toISOString();
  const execution = await executor({
    binary: options.binary.path,
    codexHome: options.codexHome,
    schemaPath: responseSchemaPath,
    responsePath,
    batch,
    timeoutMs: options.timeoutMs
  });
  await atomicWrite(responsePath, execution.responseText);
  await atomicWrite(eventsPath, execution.stdout);
  await atomicWrite(stderrPath, execution.stderr);
  const content = {
    schemaVersion: SDABC_CODEX_RUN_SCHEMA,
    manifestHash: manifest.manifestHash,
    batchId: batch.batchId,
    batchHash: batch.batchHash,
    model: SDABC_TRANSLATOR.model,
    reasoningEffort: SDABC_TRANSLATOR.reasoningEffort,
    sandbox: "read-only",
    executor: options.binary,
    threadId: execution.threadId,
    startedAt,
    completedAt: new Date().toISOString(),
    responseSha256: await fileSha256(responsePath),
    responseSchemaSha256: await fileSha256(responseSchemaPath),
    eventsSha256: await fileSha256(eventsPath),
    stderrSha256: await fileSha256(stderrPath),
    usage: execution.usage
  };
  const receipt = { ...content, runHash: sha256(canonicalJson(content)) };
  await atomicWrite(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
};

export const runSdabcBatches = async (
  options,
  { executor = executeBatch } = {}
) => {
  const manifest = await readJson(path.join(options.planRoot, "manifest.json"));
  const { manifestHash, ...manifestContent } = manifest;
  if (
    manifest.schemaVersion !== SDABC_TRANSLATION_PLAN_SCHEMA ||
    manifestHash !== sha256(canonicalJson(manifestContent))
  )
    throw new Error("sdabc-manifest-hash");
  const selected = options.batchIds.length
    ? manifest.batches.filter((value) =>
        options.batchIds.includes(value.batchId)
      )
    : manifest.batches;
  if (
    options.batchIds.some(
      (id) => !selected.some((value) => value.batchId === id)
    )
  )
    throw new Error("sdabc-selected-batch-missing");
  const queue = [...selected];
  const completed = [];
  const failures = [];
  const worker = async () => {
    while (queue.length) {
      const descriptor = queue.shift();
      let lastError;
      for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
        try {
          completed.push(
            await runOne({ options, manifest, descriptor, executor })
          );
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError)
        failures.push({
          batchId: descriptor.batchId,
          error: lastError.message
        });
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(options.concurrency, selected.length) },
      worker
    )
  );
  const summary = {
    schemaVersion: "sdabc-french-codex-summary@1",
    manifestHash,
    selectedBatches: selected.length,
    completedBatches: completed.length,
    failures,
    model: SDABC_TRANSLATOR.model,
    reasoningEffort: SDABC_TRANSLATOR.reasoningEffort,
    runsDigest: sha256(
      canonicalJson(
        completed
          .map((run) => ({ batchId: run.batchId, runHash: run.runHash }))
          .sort((a, b) => a.batchId.localeCompare(b.batchId))
      )
    )
  };
  await atomicWrite(
    path.join(options.outputRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  if (failures.length)
    throw new Error(`sdabc-codex-incomplete:${failures.length}`);
  return summary;
};

const parseArguments = (argv) => {
  const local = path.join(workflowRoot, ".local");
  const options = {
    planRoot: path.join(local, "sdabc-french-translation-plan"),
    outputRoot: path.join(local, "sdabc-french-translation-runs"),
    codexHome: path.join(local, "sdabc-codex-home"),
    codexBinary: path.join(
      local,
      "sdabc-codex-runtime",
      `codex-${SDABC_CODEX_SHA256}`
    ),
    concurrency: 8,
    maxAttempts: 2,
    timeoutMs: 20 * 60 * 1000,
    batchIds: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--plan") options.planRoot = path.resolve(argv[++index]);
    else if (argument === "--output")
      options.outputRoot = path.resolve(argv[++index]);
    else if (argument === "--codex-home")
      options.codexHome = path.resolve(argv[++index]);
    else if (argument === "--codex-binary")
      options.codexBinary = path.resolve(argv[++index]);
    else if (argument === "--concurrency")
      options.concurrency = Number(argv[++index]);
    else if (argument === "--max-attempts")
      options.maxAttempts = Number(argv[++index]);
    else if (argument === "--timeout-ms")
      options.timeoutMs = Number(argv[++index]);
    else if (argument === "--batch") options.batchIds.push(argv[++index]);
    else if (argument === "--help") options.help = true;
    else throw new Error(`Argument inconnu : ${argument}`);
  }
  for (const [name, value] of [
    ["concurrency", options.concurrency],
    ["max-attempts", options.maxAttempts],
    ["timeout-ms", options.timeoutMs]
  ]) {
    if (!Number.isInteger(value) || value < 1)
      throw new Error(`Option invalide : ${name}`);
  }
  return options;
};

const run = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Usage: node run-sdabc-french-codex-translations.mjs [--plan dossier] [--output dossier] [--batch id] [--concurrency 8]\nModèle verrouillé: gpt-5.6-luna, reasoning high; sandbox read-only.\n"
    );
    return;
  }
  if (!existsSync(path.join(options.codexHome, "auth.json")))
    throw new Error(
      `Authentification Codex isolée absente : ${options.codexHome}/auth.json`
    );
  options.binary = ensureSdabcCodexBinary({ destination: options.codexBinary });
  process.stdout.write(
    `${JSON.stringify(await runSdabcBatches(options), null, 2)}\n`
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
