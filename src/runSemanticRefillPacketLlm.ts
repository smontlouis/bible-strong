import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import {
  buildSemanticRefillLlmRequest,
  ensureCandidateChoices,
  parseSemanticRefillLlmResponse,
  SEMANTIC_REFILL_LLM_SYSTEM_PROMPT,
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";

export interface AgentPacketFile {
  bible: string;
  scope: string;
  promptPolicy?: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

export interface AgentReviewFile {
  bible: string;
  books: string[];
  scope: string;
  generatedAt: string;
  sourcePacket: string;
  model: string;
  rawContent: string;
  contract: {
    version: 2;
    schemaName: string;
    candidateCount: number;
  };
  parseError?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  decisions: SemanticRefillLlmRawDecision[];
}

export async function runPacketLlm(options: {
  inputPath: string;
  outputPath: string;
  model: string;
}): Promise<AgentReviewFile> {
  const parsedPacket = JSON.parse(
    await readFile(options.inputPath, "utf8")
  ) as AgentPacketFile;
  const packet: AgentPacketFile = {
    ...parsedPacket,
    candidates: parsedPacket.candidates.map(ensureCandidateChoices)
  };
  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("missing-ai-gateway-key");

  const response = await callGateway({
    apiKey,
    model: options.model,
    packet
  });
  const decisions = parseGatewayDecisions(response.content, packet);
  const request = buildSemanticRefillLlmRequest({
    batch: packet,
    model: options.model
  });
  const review: AgentReviewFile = {
    bible: packet.bible,
    books: inferBooks(packet),
    scope: packet.scope,
    generatedAt: new Date().toISOString(),
    sourcePacket: options.inputPath,
    model: options.model,
    rawContent: response.content,
    contract: {
      version: 2,
      schemaName: request.responseSchema.name,
      candidateCount: packet.candidates.length
    },
    parseError: decisions.parseError,
    usage: response.usage,
    decisions: decisions.decisions
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(review, null, 2)}\n`,
    "utf8"
  );
  return review;
}

async function callGateway(options: {
  apiKey: string;
  model: string;
  packet: AgentPacketFile;
}): Promise<{
  content: string;
  usage?: AgentReviewFile["usage"];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number.parseInt(process.env.AI_GATEWAY_TIMEOUT_MS ?? "120000", 10)
  );

  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        buildGatewayRequestBody({
          model: options.model,
          packet: options.packet
        })
      )
    }
  ).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(
      `ai-gateway-http-${response.status}:${(await response.text()).slice(0, 240)}`
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  return {
    content: json.choices?.[0]?.message?.content ?? "{}",
    usage: {
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      totalTokens: json.usage?.total_tokens
    }
  };
}

export function buildGatewayRequestBody(options: {
  model: string;
  packet: AgentPacketFile;
}): {
  model: string;
  temperature: 0;
  messages: Array<{ role: "system" | "user"; content: string }>;
  response_format: {
    type: "json_schema";
    json_schema: ReturnType<
      typeof buildSemanticRefillLlmRequest
    >["responseSchema"];
  };
} {
  const packet = {
    ...options.packet,
    candidates: options.packet.candidates.map(ensureCandidateChoices)
  };
  const request = buildSemanticRefillLlmRequest({
    batch: packet,
    model: options.model
  });
  const messages = request.messages.map((message, index) =>
    index === 0
      ? {
          ...message,
          content:
            options.packet.promptPolicy ?? SEMANTIC_REFILL_LLM_SYSTEM_PROMPT
        }
      : message
  );
  return {
    model: request.model,
    temperature: request.temperature,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: request.responseSchema
    }
  };
}

export function parseGatewayDecisions(
  content: string,
  packet: AgentPacketFile
): {
  decisions: SemanticRefillLlmRawDecision[];
  parseError?: string;
} {
  try {
    const parsed = JSON.parse(content) as unknown;
    return {
      decisions: parseSemanticRefillLlmResponse(parsed, {
        bible: packet.bible,
        scope: packet.scope,
        candidates: packet.candidates.map(ensureCandidateChoices)
      })
    };
  } catch (error) {
    return {
      decisions: [],
      parseError: error instanceof Error ? error.message : "unknown-parse-error"
    };
  }
}

function inferBooks(packet: AgentPacketFile): string[] {
  return [
    ...new Set(
      packet.candidates
        .map((candidate) => candidate.ref.split(".")[0])
        .filter((book): book is string => !!book)
    )
  ];
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function readStringArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: string
): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

export function packetReviewModelSlug(model: string): string {
  const safeModel = model
    .trim()
    .replace(/[^0-9A-Za-z]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 48);
  const hash = createHash("sha256")
    .update(model.trim().toLowerCase())
    .digest("hex")
    .slice(0, 10);
  return `${safeModel || "model"}-${hash}`;
}

export function defaultOutputPath(inputPath: string, model: string): string {
  const safeModel = packetReviewModelSlug(model);
  return path.join(path.dirname(inputPath), `llm-review-${safeModel}.json`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = readStringArg(
    args,
    "input",
    "outputs/gap-review/nbs/agent-packets/agent-packet-nbs-Gen.1.json"
  );
  const model = readStringArg(
    args,
    "model",
    process.env.AI_GATEWAY_MODEL ?? "deepseek/deepseek-v4-flash"
  );
  const outputPath = readStringArg(
    args,
    "output",
    defaultOutputPath(inputPath, model)
  );
  const review = await runPacketLlm({ inputPath, outputPath, model });
  console.log(
    JSON.stringify(
      {
        output: outputPath,
        bible: review.bible,
        scope: review.scope,
        model: review.model,
        decisions: review.decisions.length,
        parseError: review.parseError,
        usage: review.usage
      },
      null,
      2
    )
  );
}

if (process.argv[1]?.endsWith("runSemanticRefillPacketLlm.ts")) {
  await main();
}
