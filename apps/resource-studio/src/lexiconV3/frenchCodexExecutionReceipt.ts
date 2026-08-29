import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";

export const FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION =
  "lexicon-v3-french-codex-execution-receipt@1" as const;
export const FRENCH_INTERNAL_PINNED_CODEX_VERSION =
  "codex-cli 0.144.0-alpha.4" as const;
export const FRENCH_INTERNAL_PINNED_CODEX_SHA256 =
  "e48ce8a0455b97ba25aa6b373f694ad7788f960c4bfc311f68b6d5bf7121f2f4" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const THREAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface FrenchCodexExecutionCapabilities {
  localTools: "disabled";
  networkDataTools: "disabled";
  shell: "disabled";
  eventPolicy: "agent-message-only";
  sealedWorkingDirectory: string;
  disabledFeaturesHash: string;
  environmentPolicyHash: string;
}

/**
 * Content-addressed proof for one sealed Codex execution and one resulting
 * entry artifact. `TRole` is intentionally generic so pilot-only agents can
 * reuse the proof format without widening the four publication roles.
 */
export interface FrenchCodexExecutionReceipt<TRole extends string = string> {
  schemaVersion: typeof FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION;
  role: TRole;
  entryKey: string;
  batchId: string;
  namespace: string;
  manifestHash: string;
  selectionHash: string;
  inputHash: string;
  artifactHash: string;
  agentId: string;
  taskName: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  executorPolicyVersion: string;
  executor: {
    path: string;
    version: typeof FRENCH_INTERNAL_PINNED_CODEX_VERSION;
    sha256: typeof FRENCH_INTERNAL_PINNED_CODEX_SHA256;
  };
  capabilities: FrenchCodexExecutionCapabilities;
  sourcePaths: Record<string, string>;
  sourceHashes: Record<string, string>;
  resultPaths: Record<string, string>;
  resultHashes: Record<string, string>;
  startedAt: string;
  completedAt: string;
  runHash: string;
  receiptHash: string;
}

/** Stable JSON shared by every content-addressed French execution proof. */
export function canonicalFrenchInternalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("non-finite-number-in-french-internal-artifact");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalFrenchInternalJson).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new Error("unsupported-french-internal-artifact-value");
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalFrenchInternalJson(object[key])}`
    )
    .join(",")}}`;
}

export function hashFrenchInternalJson(value: unknown): string {
  return createHash("sha256")
    .update(canonicalFrenchInternalJson(value))
    .digest("hex");
}

export function frenchCodexExecutionReceiptHash<TRole extends string>(
  receipt:
    | Omit<FrenchCodexExecutionReceipt<TRole>, "receiptHash">
    | FrenchCodexExecutionReceipt<TRole>
): string {
  const { receiptHash: _receiptHash, ...content } =
    receipt as FrenchCodexExecutionReceipt<TRole>;
  void _receiptHash;
  return hashFrenchInternalJson(content);
}

export function finalizeFrenchCodexExecutionReceipt<TRole extends string>(
  receipt: Omit<FrenchCodexExecutionReceipt<TRole>, "receiptHash">
): FrenchCodexExecutionReceipt<TRole> {
  return {
    ...receipt,
    receiptHash: frenchCodexExecutionReceiptHash(receipt)
  };
}

export function assertFrenchCodexExecutionReceipt<TRole extends string>(
  value: unknown,
  options: { expectedRole?: TRole } = {}
): asserts value is FrenchCodexExecutionReceipt<TRole> {
  if (!isObject(value)) throw new Error("french-codex-receipt-invalid");
  assertExactKeys(value, [
    "schemaVersion",
    "role",
    "entryKey",
    "batchId",
    "namespace",
    "manifestHash",
    "selectionHash",
    "inputHash",
    "artifactHash",
    "agentId",
    "taskName",
    "threadId",
    "model",
    "reasoningEffort",
    "executorPolicyVersion",
    "executor",
    "capabilities",
    "sourcePaths",
    "sourceHashes",
    "resultPaths",
    "resultHashes",
    "startedAt",
    "completedAt",
    "runHash",
    "receiptHash"
  ]);
  const receipt = value as unknown as FrenchCodexExecutionReceipt<TRole>;
  if (
    receipt.schemaVersion !==
      FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION ||
    typeof receipt.role !== "string" ||
    receipt.role.length === 0 ||
    (options.expectedRole !== undefined &&
      receipt.role !== options.expectedRole) ||
    !nonEmptyStrings([
      receipt.entryKey,
      receipt.batchId,
      receipt.namespace,
      receipt.agentId,
      receipt.taskName,
      receipt.model,
      receipt.reasoningEffort,
      receipt.executorPolicyVersion
    ]) ||
    !THREAD_ID_PATTERN.test(receipt.threadId) ||
    !sha256Strings([
      receipt.manifestHash,
      receipt.selectionHash,
      receipt.inputHash,
      receipt.artifactHash,
      receipt.runHash,
      receipt.receiptHash
    ]) ||
    !Number.isFinite(Date.parse(receipt.startedAt)) ||
    !Number.isFinite(Date.parse(receipt.completedAt)) ||
    Date.parse(receipt.startedAt) > Date.parse(receipt.completedAt) ||
    !isObject(receipt.executor) ||
    !nonEmptyStrings([receipt.executor.path]) ||
    receipt.executor.version !== FRENCH_INTERNAL_PINNED_CODEX_VERSION ||
    receipt.executor.sha256 !== FRENCH_INTERNAL_PINNED_CODEX_SHA256 ||
    !validCapabilities(receipt.capabilities) ||
    !validPathRecord(receipt.sourcePaths) ||
    !validHashRecord(receipt.sourceHashes) ||
    !validPathRecord(receipt.resultPaths) ||
    !validHashRecord(receipt.resultHashes) ||
    !validPathHashBinding(receipt.sourcePaths, receipt.sourceHashes) ||
    !validPathHashBinding(receipt.resultPaths, receipt.resultHashes) ||
    typeof receipt.sourcePaths.runPointer !== "string" ||
    typeof receipt.resultPaths.agentEvents !== "string" ||
    typeof receipt.resultPaths.structuredResponse !== "string" ||
    receipt.receiptHash !== frenchCodexExecutionReceiptHash(receipt)
  ) {
    throw new Error("french-codex-receipt-invalid");
  }
}

function validPathRecord(value: unknown): value is Record<string, string> {
  return (
    isObject(value) &&
    Object.keys(value).length > 0 &&
    Object.entries(value).every(
      ([key, path]) =>
        key.trim().length > 0 && typeof path === "string" && isAbsolute(path)
    )
  );
}

function validPathHashBinding(
  paths: Record<string, string>,
  hashes: Record<string, string>
): boolean {
  return Object.keys(paths).every((key) =>
    SHA256_PATTERN.test(hashes[key] ?? "")
  );
}

function validCapabilities(value: unknown): boolean {
  if (!isObject(value)) return false;
  try {
    assertExactKeys(value, [
      "localTools",
      "networkDataTools",
      "shell",
      "eventPolicy",
      "sealedWorkingDirectory",
      "disabledFeaturesHash",
      "environmentPolicyHash"
    ]);
  } catch {
    return false;
  }
  return (
    value.localTools === "disabled" &&
    value.networkDataTools === "disabled" &&
    value.shell === "disabled" &&
    value.eventPolicy === "agent-message-only" &&
    typeof value.sealedWorkingDirectory === "string" &&
    value.sealedWorkingDirectory.length > 0 &&
    typeof value.disabledFeaturesHash === "string" &&
    SHA256_PATTERN.test(value.disabledFeaturesHash) &&
    typeof value.environmentPolicyHash === "string" &&
    SHA256_PATTERN.test(value.environmentPolicyHash)
  );
}

function validHashRecord(value: unknown): value is Record<string, string> {
  return (
    isObject(value) &&
    Object.keys(value).length > 0 &&
    Object.values(value).every(
      (hash) => typeof hash === "string" && SHA256_PATTERN.test(hash)
    )
  );
}

function nonEmptyStrings(values: unknown[]): boolean {
  return values.every(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

function sha256Strings(values: unknown[]): boolean {
  return values.every(
    (value) => typeof value === "string" && SHA256_PATTERN.test(value)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[]
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) {
    throw new Error("french-codex-receipt-invalid-keys");
  }
}
