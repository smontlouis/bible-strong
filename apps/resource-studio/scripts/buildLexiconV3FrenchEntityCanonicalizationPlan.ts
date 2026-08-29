import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { pathToFileURL } from "node:url";

import {
  buildFrenchEntityCanonicalizationPlan,
  canonicalFrenchEntityJson,
  FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS,
  type FrenchEntityCanonicalizationPlan,
  type FrenchEntityRegistrySourceRecord
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import { type LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";

const DEFAULT_ENTITY_REGISTRY =
  "outputs/lexicon-v3/french-editorial/entity-registry.jsonl";
const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_OUTPUT =
  "outputs/lexicon-v3/french-entities/entity-canonicalization-plan.json";

export interface FrenchEntityCanonicalizationPlanCliOptions {
  entityRegistry: string;
  packets: string;
  output: string;
  generatedAt?: string;
  /** This command deliberately has no model execution or publication mode. */
  planOnly: true;
}

export function parseFrenchEntityCanonicalizationPlanArgs(
  args: readonly string[]
): FrenchEntityCanonicalizationPlanCliOptions {
  const allowed = new Set([
    "entity-registry",
    "packets",
    "output",
    "generated-at",
    "plan-only"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new Error(
        `french-entity-canonicalization-unexpected-argument:${argument}`
      );
    }
    const [key, inline] = argument.slice(2).split("=", 2);
    if (!allowed.has(key)) {
      throw new Error(`french-entity-canonicalization-unknown-option:${key}`);
    }
    if (values.has(key)) {
      throw new Error(`french-entity-canonicalization-duplicate-option:${key}`);
    }
    if (key === "plan-only") {
      if (inline !== undefined) {
        values.set(key, inline);
      } else {
        const next = args[index + 1];
        if (next === "true" || next === "false") {
          values.set(key, next);
          index += 1;
        } else {
          values.set(key, "true");
        }
      }
      continue;
    }
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) {
        throw new Error(
          `french-entity-canonicalization-missing-option-value:${key}`
        );
      }
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(
        `french-entity-canonicalization-missing-option-value:${key}`
      );
    }
  }
  if (values.get("plan-only") === "false") {
    throw new Error("french-entity-canonicalization-non-plan-mode-unsupported");
  }
  if (values.has("plan-only") && values.get("plan-only") !== "true") {
    throw new Error("french-entity-canonicalization-invalid-plan-only");
  }
  const generatedAt = values.get("generated-at");
  return {
    entityRegistry: resolve(
      values.get("entity-registry") ?? DEFAULT_ENTITY_REGISTRY
    ),
    packets: resolve(values.get("packets") ?? DEFAULT_PACKETS),
    output: resolve(values.get("output") ?? DEFAULT_OUTPUT),
    ...(generatedAt ? { generatedAt } : {}),
    planOnly: true
  };
}

export async function runFrenchEntityCanonicalizationPlanCli(
  options: FrenchEntityCanonicalizationPlanCliOptions
): Promise<FrenchEntityCanonicalizationPlan> {
  const entityRegistryPath = resolve(options.entityRegistry);
  const packetsPath = resolve(options.packets);
  const outputPath = resolve(options.output);
  if (
    entityRegistryPath === packetsPath ||
    entityRegistryPath === outputPath ||
    packetsPath === outputPath
  ) {
    throw new Error("french-entity-canonicalization-path-collision");
  }
  const [entityRegistry, packets] = await Promise.all([
    readJsonlWithDigest<FrenchEntityRegistrySourceRecord>(entityRegistryPath),
    readJsonlWithDigest<LexiconV3FrenchPacket>(packetsPath)
  ]);
  const plan = buildFrenchEntityCanonicalizationPlan({
    entityRegistry: entityRegistry.records,
    packets: packets.records,
    sourceDigests: {
      entityRegistry: entityRegistry.digest,
      packets: packets.digest
    },
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
    expectations: FRENCH_ENTITY_CANONICALIZATION_DEFAULT_EXPECTATIONS
  });
  await writeAtomic(outputPath, `${canonicalFrenchEntityJson(plan)}\n`);
  process.stdout.write(
    `${JSON.stringify(
      {
        planOnly: true,
        output: outputPath,
        counts: plan.counts,
        sourceLineage: plan.sourceLineage,
        planHash: plan.planHash
      },
      null,
      2
    )}\n`
  );
  return plan;
}

async function readJsonlWithDigest<T>(
  path: string
): Promise<{ records: T[]; digest: string }> {
  const stream = createReadStream(path);
  const decoder = new StringDecoder("utf8");
  const hash = createHash("sha256");
  const records: T[] = [];
  let buffer = "";
  let lineNumber = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    buffer += decoder.write(bytes);
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).replace(/\r$/u, "");
      buffer = buffer.slice(newline + 1);
      lineNumber += 1;
      records.push(parseJsonLine<T>(line, path, lineNumber));
    }
  }
  buffer += decoder.end();
  if (buffer.length > 0) {
    lineNumber += 1;
    records.push(
      parseJsonLine<T>(buffer.replace(/\r$/u, ""), path, lineNumber)
    );
  }
  if (records.length === 0) {
    throw new Error(`french-entity-canonicalization-empty-jsonl:${path}`);
  }
  return { records, digest: hash.digest("hex") };
}

function parseJsonLine<T>(line: string, path: string, lineNumber: number): T {
  if (!line.trim()) {
    throw new Error(
      `french-entity-canonicalization-blank-jsonl-line:${path}:${lineNumber}`
    );
  }
  try {
    return JSON.parse(line) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `french-entity-canonicalization-invalid-jsonl:${path}:${lineNumber}:${message}`
    );
  }
}

async function writeAtomic(path: string, body: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, body, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  runFrenchEntityCanonicalizationPlanCli(
    parseFrenchEntityCanonicalizationPlanArgs(process.argv.slice(2))
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${basename(
        process.argv[1] ?? "buildLexiconV3FrenchEntityCanonicalizationPlan"
      )}: ${message}\n`
    );
    process.exitCode = 1;
  });
}
