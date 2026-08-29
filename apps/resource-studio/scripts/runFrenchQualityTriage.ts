import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

import {
  buildSealedFrenchCodexProposerEnvironment,
  frenchCodexProposerExecArgs,
  parseFrenchCodexAgentEvents
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import {
  assertFrenchCodexImmutableBinary,
  ensureFrenchCodexImmutableBinary,
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  prepareFrenchCodexImmutableExecution
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";

type Layer = "tipnr" | "lsj" | "core";
type Verdict = "keep" | "correct" | "escalate";

interface AuditIssue {
  code: string;
  severity: string;
  field: string;
  details?: Record<string, unknown>;
}

interface AuditRecord {
  layer: Layer;
  key: string;
  sourceId: number;
  stepCode: string | null;
  sourceHash: string;
  translationHash: string;
  issues: AuditIssue[];
  fields: Record<string, { source: string; translation: string }>;
}

interface TriageTask {
  key: string;
  sourceId: number;
  stepCode: string | null;
  sourceHash: string;
  translationHash: string;
  deterministicIssues: AuditIssue[];
  fields: Record<string, { english: string; french: string }>;
}

interface Decision {
  key: string;
  verdict: Verdict;
  issueCodes: string[];
  fields: string[];
  reasons: string[];
  confidence: number;
}

interface Batch {
  id: string;
  tasks: TriageTask[];
  inputHash: string;
}

const PROMPT_VERSION = "viewer-fr-quality-triage@1";
const PIPELINE_VERSION = "viewer-fr-quality-internal@1";
const ALLOWED_DETERMINISTIC_ISSUES: Record<Layer, Set<string>> = {
  tipnr: new Set([
    "missing-translation",
    "english-residue",
    "untranslated-prose",
    "missing-original-token",
    "linked-strong-label-not-french",
    "invalid-html-structure"
  ]),
  lsj: new Set([
    "missing-translation",
    "english-residue",
    "english-editorial-residue",
    "untranslated-prose",
    "missing-original-token",
    "html-tag-sequence-mismatch",
    "inconsistent-duplicate-source",
    "typography-artifact",
    "invalid-html-structure"
  ]),
  core: new Set([
    "missing-translation",
    "english-residue",
    "untranslated-prose",
    "missing-original-token",
    "invalid-html-structure"
  ])
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const layer = requiredLayer(args.layer);
  const recordsPath = resolve(
    args.records ?? "outputs/lexicon-fr-quality/audit/records.jsonl"
  );
  const outputRoot = resolve(
    args.output ?? `outputs/lexicon-fr-quality/triage/${layer}`
  );
  const codexBinary = resolve(
    args["codex-binary"] ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH
  );
  const codexHome = resolve(args["codex-home"] ?? "/Users/stephane/.codex");
  const model = args.model ?? "gpt-5.6-terra";
  const reasoning = args.reasoning ?? "low";
  const concurrency = integer(args.concurrency, 8);
  const maxAttempts = integer(args["max-attempts"], 4);
  const timeoutMs = integer(args["timeout-ms"], 1_200_000);
  if (!existsSync(recordsPath) || !existsSync(codexBinary)) {
    throw new Error("triage-source-or-runtime-missing");
  }
  ensureFrenchCodexImmutableBinary({ requestedPath: codexBinary });
  const runtime = assertFrenchCodexImmutableBinary(codexBinary);
  mkdirSync(outputRoot, { recursive: true });

  let records = (await readJsonl<AuditRecord>(recordsPath)).filter(
    (record) => record.layer === layer
  );
  if (layer === "lsj") records = dedupeLsj(records);
  const limit = args.limit === undefined ? null : integer(args.limit, 0);
  if (limit !== null) records = records.slice(0, limit);
  const tasks = records.map(toTask);
  installText(
    resolve(outputRoot, "tasks.jsonl"),
    tasks.map((task) => JSON.stringify(task)).join("\n") + "\n"
  );
  const batches = buildBatches(tasks, layer);
  const decisions = await runBatches({
    batches,
    layer,
    outputRoot,
    codexBinary,
    codexHome,
    runtime,
    model,
    reasoning,
    concurrency,
    maxAttempts,
    timeoutMs
  });
  const byKey = new Map(decisions.map((decision) => [decision.key, decision]));
  if (byKey.size !== tasks.length || tasks.some((task) => !byKey.has(task.key))) {
    throw new Error(`triage-coverage-mismatch:${byKey.size}:${tasks.length}`);
  }
  const ordered = tasks.map((task) => byKey.get(task.key)!);
  installText(
    resolve(outputRoot, "decisions.jsonl"),
    ordered.map((decision) => JSON.stringify(decision)).join("\n") + "\n"
  );
  const verdicts: Record<Verdict, number> = { keep: 0, correct: 0, escalate: 0 };
  for (const decision of ordered) verdicts[decision.verdict] += 1;
  const content = {
    schemaVersion: "viewer-fr-quality-triage-summary@1",
    pipelineVersion: PIPELINE_VERSION,
    promptVersion: PROMPT_VERSION,
    layer,
    status: "complete",
    entries: tasks.length,
    verdicts,
    sourceRecords: { path: recordsPath, sha256: sha256File(recordsPath) },
    tasksHash: sha256(tasks.map(stableJson).join("\n") + "\n"),
    decisionsHash: sha256(ordered.map(stableJson).join("\n") + "\n"),
    execution: {
      internalCodex: true,
      cel: "forbidden",
      aiGateway: "forbidden",
      model,
      reasoning,
      codexVersion: runtime.version,
      codexSha256: runtime.sha256
    }
  };
  const summary = { ...content, runHash: sha256(stableJson(content)) };
  installText(
    resolve(outputRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function toTask(record: AuditRecord): TriageTask {
  const allowed = ALLOWED_DETERMINISTIC_ISSUES[record.layer];
  return {
    key: record.key,
    sourceId: record.sourceId,
    stepCode: record.stepCode,
    sourceHash: record.sourceHash,
    translationHash: record.translationHash,
    deterministicIssues: record.issues.filter((issue) => allowed.has(issue.code)),
    fields: Object.fromEntries(
      Object.entries(record.fields).map(([field, pair]) => [
        field,
        { english: pair.source, french: pair.translation }
      ])
    )
  };
}

function dedupeLsj(records: AuditRecord[]): AuditRecord[] {
  const bySource = new Map<string, AuditRecord>();
  for (const record of records) {
    const prior = bySource.get(record.sourceHash);
    if (!prior || record.key.localeCompare(prior.key, "en") < 0) {
      bySource.set(record.sourceHash, record);
    }
  }
  return [...bySource.values()].sort((a, b) => a.key.localeCompare(b.key, "en"));
}

function buildBatches(tasks: TriageTask[], layer: Layer): Batch[] {
  const maxItems = layer === "core" ? 80 : layer === "tipnr" ? 35 : 18;
  const maxBytes = layer === "lsj" ? 170_000 : 220_000;
  const batches: Batch[] = [];
  let current: TriageTask[] = [];
  let bytes = 0;
  for (const task of tasks) {
    const size = Buffer.byteLength(JSON.stringify(task));
    if (current.length && (current.length >= maxItems || bytes + size > maxBytes)) {
      batches.push(makeBatch(batches.length + 1, current));
      current = [];
      bytes = 0;
    }
    current.push(task);
    bytes += size;
  }
  if (current.length) batches.push(makeBatch(batches.length + 1, current));
  return batches;
}

function makeBatch(serial: number, tasks: TriageTask[]): Batch {
  return {
    id: `triage-${String(serial).padStart(5, "0")}`,
    tasks,
    inputHash: sha256(tasks.map(stableJson).join("\n") + "\n")
  };
}

async function runBatches(input: {
  batches: Batch[];
  layer: Layer;
  outputRoot: string;
  codexBinary: string;
  codexHome: string;
  runtime: { version: string; sha256: string };
  model: string;
  reasoning: string;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
}): Promise<Decision[]> {
  const results = new Array<Decision[]>(input.batches.length);
  let cursor = 0;
  let completed = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= input.batches.length) return;
      const batch = input.batches[index]!;
      results[index] = await runBatch(input, batch);
      completed += 1;
      process.stdout.write(
        `${JSON.stringify({ event: "completed", layer: input.layer, batchId: batch.id, entries: batch.tasks.length, completed, total: input.batches.length })}\n`
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(input.concurrency, input.batches.length) }, worker)
  );
  return results.flat();
}

async function runBatch(
  options: Parameters<typeof runBatches>[0],
  batch: Batch
): Promise<Decision[]> {
  const directory = resolve(options.outputRoot, "agents", batch.id);
  mkdirSync(directory, { recursive: true });
  const prompt = buildPrompt(options.layer, batch.tasks);
  const schema = outputSchema(batch.tasks.length);
  const schemaPath = resolve(directory, "output.schema.json");
  const resultPath = resolve(directory, "result.json");
  const runPath = resolve(directory, "run.json");
  const schemaText = `${JSON.stringify(schema, null, 2)}\n`;
  installText(schemaPath, schemaText);
  const lineage = {
    inputHash: batch.inputHash,
    promptHash: sha256(prompt),
    schemaHash: sha256(schemaText),
    promptVersion: PROMPT_VERSION,
    model: options.model,
    reasoning: options.reasoning,
    runtimeSha256: options.runtime.sha256
  };
  if (existsSync(resultPath) && existsSync(runPath)) {
    const prior = JSON.parse(readFileSync(runPath, "utf8")) as Record<string, unknown>;
    if (
      Object.entries(lineage).every(([key, value]) => prior[key] === value) &&
      prior.responseHash === sha256File(resultPath)
    ) {
      return parseDecisions(JSON.parse(readFileSync(resultPath, "utf8")), batch.tasks);
    }
  }
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const execution = await executeAgent({
        codexBinary: options.codexBinary,
        codexHome: options.codexHome,
        directory,
        attempt,
        prompt,
        schemaPath,
        model: options.model,
        reasoning: options.reasoning,
        timeoutMs: options.timeoutMs
      });
      const raw = JSON.parse(execution.responseText) as unknown;
      const parsed = parseDecisions(raw, batch.tasks);
      installText(resultPath, `${JSON.stringify(raw, null, 2)}\n`);
      const run = {
        schemaVersion: "viewer-fr-quality-agent-run@1",
        stage: "triage",
        batchId: batch.id,
        ...lineage,
        responseHash: sha256File(resultPath),
        threadId: execution.threadId,
        usage: execution.usage,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt
      };
      installText(runPath, `${JSON.stringify(run, null, 2)}\n`);
      return parsed;
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({ event: "retry", batchId: batch.id, attempt, error: error instanceof Error ? error.message : String(error) })}\n`
      );
      if (attempt === options.maxAttempts) throw error;
    }
  }
  throw new Error(`triage-batch-failed:${batch.id}`);
}

async function executeAgent(input: {
  codexBinary: string;
  codexHome: string;
  directory: string;
  attempt: number;
  prompt: string;
  schemaPath: string;
  model: string;
  reasoning: string;
  timeoutMs: number;
}): Promise<{
  threadId: string;
  responseText: string;
  usage: unknown;
  startedAt: string;
  completedAt: string;
}> {
  const prefix = `attempt-${String(input.attempt).padStart(3, "0")}`;
  const responsePath = resolve(input.directory, `${prefix}-response.json`);
  const executable = prepareFrenchCodexImmutableExecution(input.codexBinary);
  rmSync(responsePath, { force: true });
  const startedAt = new Date().toISOString();
  const args = frenchCodexProposerExecArgs({
    model: input.model,
    reasoningEffort: input.reasoning,
    schemaPath: input.schemaPath,
    responsePath,
    cwd: input.directory
  });
  const child = spawn(executable.executionPath, args, {
    cwd: input.directory,
    env: buildSealedFrenchCodexProposerEnvironment(input.codexHome),
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => (stdout += chunk));
  child.stderr.on("data", (chunk: string) => (stderr += chunk));
  child.stdin.end(input.prompt);
  let timedOut = false;
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      signalGroup(child.pid, "SIGTERM");
      killTimer = setTimeout(() => signalGroup(child.pid, "SIGKILL"), 2_000);
    }, input.timeoutMs);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      resolveExit(code ?? -1);
    });
  }).finally(() => {
    try {
      executable.assertUnchanged();
    } finally {
      executable.dispose();
    }
  });
  const completedAt = new Date().toISOString();
  installText(resolve(input.directory, `${prefix}-events.jsonl`), stdout);
  installText(resolve(input.directory, `${prefix}-stderr.log`), stderr);
  if (timedOut || exitCode !== 0 || !existsSync(responsePath)) {
    throw new Error(
      timedOut ? `agent-timeout:${input.timeoutMs}` : `agent-exit:${exitCode}:${stderr.slice(-500)}`
    );
  }
  const responseText = readFileSync(responsePath, "utf8");
  const events = parseFrenchCodexAgentEvents(stdout, responseText);
  return {
    threadId: events.threadId,
    responseText,
    usage: events.usage,
    startedAt,
    completedAt
  };
}

function buildPrompt(layer: Layer, tasks: TriageTask[]): string {
  return `Tu es le réviseur-trieur d'une édition française de ressources lexicales bibliques. STEP anglais est l'unique autorité éditoriale. Tu dois seulement décider si la traduction française actuelle peut être conservée; ne la retraduis jamais dans cette étape.

Pour chaque tâche :
- keep : fidèle, complète, naturelle et publiable; aucun défaut réel.
- correct : au moins un champ nécessite une correction. Donne les noms exacts des champs et des codes courts parmi residual_english, artifact, omission, addition, polarity_or_modality, mistranslation, terminology, proper_name, grammar, typography, html_or_protected_token, consistency.
- escalate : ambiguïté réelle impossible à résoudre depuis la source STEP et les contraintes fournies.

Les diagnostics déterministes fournis sont des signaux contraignants lorsqu'ils sont exacts; vérifie-les dans les textes. Les noms propres, sigles, titres bibliographiques et termes grecs/hébreux ne sont pas de l'anglais résiduel. Ne challenge pas et n'enrichis pas STEP. Raisons très brèves, en français. confidence entre 0 et 1. Un résultat par key, aucune omission, aucun Markdown.

Couche : ${layer}
<tasks_jsonl>
${tasks.map((task) => JSON.stringify(task)).join("\n")}
</tasks_jsonl>`;
}

function outputSchema(count: number): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["decisions"],
    properties: {
      decisions: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "verdict", "issueCodes", "fields", "reasons", "confidence"],
          properties: {
            key: { type: "string" },
            verdict: { type: "string", enum: ["keep", "correct", "escalate"] },
            issueCodes: { type: "array", items: { type: "string" } },
            fields: { type: "array", items: { type: "string" } },
            reasons: { type: "array", items: { type: "string" } },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  };
}

function parseDecisions(raw: unknown, tasks: TriageTask[]): Decision[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("triage-invalid-root");
  const decisions = (raw as { decisions?: unknown }).decisions;
  if (!Array.isArray(decisions) || decisions.length !== tasks.length) {
    throw new Error("triage-invalid-count");
  }
  const taskByKey = new Map(tasks.map((task) => [task.key, task]));
  const seen = new Set<string>();
  const parsed = decisions.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("triage-invalid-decision");
    const decision = value as Decision;
    if (
      typeof decision.key !== "string" ||
      !taskByKey.has(decision.key) ||
      seen.has(decision.key) ||
      !["keep", "correct", "escalate"].includes(decision.verdict) ||
      !Array.isArray(decision.issueCodes) ||
      !Array.isArray(decision.fields) ||
      !Array.isArray(decision.reasons) ||
      typeof decision.confidence !== "number" ||
      decision.confidence < 0 ||
      decision.confidence > 1
    ) {
      throw new Error(`triage-invalid-decision:${decision.key ?? "unknown"}`);
    }
    const allowedFields = new Set(Object.keys(taskByKey.get(decision.key)!.fields));
    if (decision.fields.some((field) => !allowedFields.has(field))) {
      throw new Error(`triage-invalid-field:${decision.key}`);
    }
    if (decision.verdict === "keep" && (decision.issueCodes.length || decision.fields.length)) {
      throw new Error(`triage-invalid-keep:${decision.key}`);
    }
    seen.add(decision.key);
    return decision;
  });
  return tasks.map((task) => parsed.find((decision) => decision.key === task.key)!);
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const values: T[] = [];
  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of reader) if (line.trim()) values.push(JSON.parse(line) as T);
  return values;
}

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) throw new Error(`unexpected-argument:${value}`);
    const [key, inline] = value.slice(2).split("=", 2);
    result[key] = inline ?? values[++index] ?? "";
  }
  return result;
}

function requiredLayer(value: string | undefined): Layer {
  if (value !== "tipnr" && value !== "lsj" && value !== "core") {
    throw new Error("invalid-or-missing-layer");
  }
  return value;
}

function integer(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/u.test(value)) throw new Error(`invalid-integer:${value}`);
  return Number(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function installText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, value, "utf8");
  renameSync(temporary, path);
}

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

void main();
