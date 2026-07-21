import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildConsensusCarrierTerms,
  composeFrenchModelIdentity,
  evaluateFrenchAutoEligibility,
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchCarrierDecision,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  type FrenchValidationResult,
  validateFrenchProposal
} from "../src/lexiconV3/frenchValidation.js";
import {
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "../src/lexiconV3/frenchPackets.js";

type RunStatus =
  | "auto_validated"
  | "review_needed"
  | "blocked_source_issue"
  | "failed";

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

interface ModelResult {
  text: string;
  model: string;
  proof: ModelExecutionProof;
  usage: ModelUsage;
}

export interface ModelExecutionProof {
  requestedModel: string;
  actualModel: string | null;
  provider: string | null;
  identity: string | null;
  verified: boolean;
}

interface ArbiterPayload {
  verdict: "accept" | "review_needed";
  reasons: string[];
  glossFr: string;
  meaningFr: string;
  meaningHtmlFr: string;
  notesFr: string;
  carrierTermsFr: string[];
  confidence: number;
}

export interface FrenchRunRecord {
  schemaVersion: "lexicon-v3-french-review@2";
  entryKey: string;
  packetHash: string;
  englishHash: string;
  generationConfigHash: string;
  status: RunStatus;
  models: { proposerA: string; proposerB: string; arbiter: string };
  modelProofs?: {
    proposerA: ModelExecutionProof;
    proposerB: ModelExecutionProof;
    arbiter: ModelExecutionProof;
  };
  proposalA?: FrenchLexiconProposal;
  proposalB?: FrenchLexiconProposal;
  validationA?: FrenchValidationResult;
  validationB?: FrenchValidationResult;
  arbiter?: {
    verdict: ArbiterPayload["verdict"];
    reasons: string[];
    proposal: FrenchLexiconProposal;
    validation: FrenchValidationResult;
  };
  carrierTerms: FrenchCarrierDecision[];
  issues: string[];
  usage: {
    proposerA: ModelUsage;
    proposerB: ModelUsage;
    arbiter: ModelUsage;
  };
  artifactHash: string;
  generatedAt: string;
}

const DEFAULT_INPUT = "outputs/lexicon-v3/french-packets.jsonl";
const DEFAULT_PACKET_SUMMARY = "outputs/lexicon-v3/french-packets.summary.json";
const DEFAULT_OUTPUT = "outputs/lexicon-v3/french-review.jsonl";
const DEFAULT_SUMMARY = "outputs/lexicon-v3/french-review-summary.json";
const DEFAULT_REPORT = "reports/lexicon-v3-french-review.md";
const DEFAULT_MODEL_A = "openai/gpt-5.4-mini";
const DEFAULT_MODEL_B = "google/gemini-3.5-flash";
const DEFAULT_ARBITER = "openai/gpt-5.5";
const MAX_UNAPPROVED_MODEL_CALLS = 300;
// This version covers the complete generation contract, including the
// three-model carrier consensus policy, so resume cannot reuse records built
// under the former two-proposer carrier rule.
const FRENCH_GENERATION_PROMPT_VERSION = "lexicon-v3-french-prompts@3";

const ENGLISH_STATUSES = [
  "validated",
  "human_validated",
  "review_needed",
  "source_issue"
] as const;
const RUN_STATUSES = [
  "auto_validated",
  "review_needed",
  "blocked_source_issue",
  "failed"
] as const;

type EnglishStatus = (typeof ENGLISH_STATUSES)[number];

export interface FrenchPacketInputAttestation {
  packets: LexiconV3FrenchPacket[];
  inputDigest: string;
}

export interface FrenchPacketSummaryAttestation {
  path: string;
  digest: string;
}

export interface FrenchRunSummary {
  schemaVersion: "lexicon-v3-french-run-summary@3";
  generatedAt: string;
  dryRun: boolean;
  input: string;
  inputDigest: string;
  packetSummary: string | null;
  packetSummaryDigest: string | null;
  output: string;
  outputDigest: string | null;
  inputPackets: number;
  plannedPackets: number;
  writtenRecords: number;
  plannedModelCalls: number;
  estimatedMinimumInputTokens: number;
  selection: {
    only: string[];
    offset: number;
    limit: number | null;
    inputPackets: number;
    selectedPackets: number;
  };
  coverage: {
    selectedPackets: number;
    eligibleForModels: number;
    blockedByEnglishReview: number;
    blockedBySourceIssue: number;
    completedBeforeRun: number;
    plannedPackets: number;
    recordsForSelection: number;
    successfulRecordsForSelection: number;
    missingOrFailedRecords: number;
  };
  statusCounts: {
    inputEnglish: Record<EnglishStatus, number>;
    selectedEnglish: Record<EnglishStatus, number>;
    outputRecords: Record<RunStatus, number>;
  };
  statuses: Record<RunStatus, number>;
  models: { proposerA: string; proposerB: string; arbiter: string };
  generation: {
    promptVersion: typeof FRENCH_GENERATION_PROMPT_VERSION;
    configHash: string;
    reasoning: { proposerA: string; proposerB: string; arbiter: string };
  };
  totalUsage: ModelUsage;
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dryRun === "true";
  const inputPath = resolve(args.input ?? DEFAULT_INPUT);
  const packetSummaryPath = args.packetSummary
    ? resolve(args.packetSummary)
    : dryRun
      ? null
      : resolve(DEFAULT_PACKET_SUMMARY);
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const summaryPath = resolve(args.summary ?? DEFAULT_SUMMARY);
  const reportPath = resolve(args.report ?? DEFAULT_REPORT);
  const journalPath = `${outputPath}.journal`;
  const resume = args.resume === "true";
  const modelA = args.modelA ?? DEFAULT_MODEL_A;
  const modelB = args.modelB ?? DEFAULT_MODEL_B;
  const arbiterModel = args.arbiter ?? DEFAULT_ARBITER;
  const reasoningA = args.reasoningA ?? "medium";
  const reasoningB = args.reasoningB ?? "low";
  const reasoningArbiter = args.reasoningArbiter ?? "medium";
  const generationConfigHash = frenchGenerationConfigHash({
    modelA,
    modelB,
    arbiterModel,
    reasoningA,
    reasoningB,
    reasoningArbiter
  });
  const concurrency = boundedInteger(args.concurrency, 1, 8) ?? 2;
  const timeoutMs = boundedInteger(args.timeoutMs, 1_000, 600_000) ?? 180_000;
  const maxModelCalls =
    args.maxModelCalls === undefined
      ? null
      : boundedInteger(args.maxModelCalls, 1, 1_000_000);
  if (args.maxModelCalls !== undefined && maxModelCalls === null) {
    throw new Error(`invalid-max-model-calls:${args.maxModelCalls}`);
  }
  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;

  if (normalizeModel(modelA) === normalizeModel(modelB)) {
    throw new Error("proposer-models-must-be-distinct");
  }
  if (!existsSync(inputPath)) throw new Error(`missing-input:${inputPath}`);

  // This preflight deliberately completes before any model call. A malformed,
  // stale, or duplicated packet near the end of the file therefore cannot
  // leave a partially paid run behind.
  const input = readAndValidateFrenchPackets(inputPath);
  const packetSummaryAttestation = packetSummaryPath
    ? validateFrenchPacketBuildAttestation({
        summaryPath: packetSummaryPath,
        inputPath,
        inputDigest: input.inputDigest,
        inputPackets: input.packets.length,
        requireReviewedAuthoring: !dryRun
      })
    : null;
  if (!dryRun && !packetSummaryAttestation) {
    throw new Error("missing-packet-summary");
  }

  const packets = selectPackets(input.packets, args);
  const retainedRecords = resume
    ? compactFrenchRunRecords([
        ...readRunRecords(outputPath),
        ...readRunRecords(journalPath)
      ])
    : [];
  const recordsByEntry = new Map(
    retainedRecords.map((record) => [record.entryKey, record])
  );
  const completed = new Set(
    retainedRecords
      .filter(
        (record) =>
          record.status !== "failed" &&
          record.generationConfigHash === generationConfigHash
      )
      .map((record) => `${record.entryKey}:${record.packetHash}`)
  );
  const planned = packets.filter(
    (packet) => !completed.has(`${packet.entryKey}:${packet.packetHash}`)
  );
  const plannedModelCalls = planned.filter(isModelEligiblePacket).length * 3;
  assertFrenchModelCallBudget({
    dryRun,
    plannedModelCalls,
    maxModelCalls
  });
  if (!dryRun && planned.some(isModelEligiblePacket) && !apiKey) {
    throw new Error("missing-ai-gateway-key");
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(summaryPath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  if (!resume && !dryRun) {
    rmSync(outputPath, { force: true });
    rmSync(journalPath, { force: true });
  }

  if (dryRun) {
    const summary = buildSummary({
      inputPath,
      inputDigest: input.inputDigest,
      packetSummary: packetSummaryAttestation,
      outputPath,
      outputDigest: null,
      inputPackets: input.packets,
      selectedPackets: packets,
      planned,
      records: retainedRecords,
      dryRun,
      modelA,
      modelB,
      arbiterModel,
      args
    });
    writeJson(summaryPath, summary);
    writeFileSync(reportPath, renderReport(summary), "utf8");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const runApiKey = apiKey ?? "";
  for (let offset = 0; offset < planned.length; offset += concurrency) {
    const batch = planned.slice(offset, offset + concurrency);
    const records = await Promise.all(
      batch.map((packet) =>
        processPacket(packet, {
          apiKey: runApiKey,
          modelA,
          modelB,
          arbiterModel,
          timeoutMs,
          reasoningA,
          reasoningB,
          reasoningArbiter
        }).catch((error: unknown) =>
          failedRecord(
            packet,
            modelA,
            modelB,
            arbiterModel,
            generationConfigHash,
            error
          )
        )
      )
    );
    for (const record of records) {
      recordsByEntry.set(record.entryKey, record);
      appendFileSync(journalPath, `${JSON.stringify(record)}\n`, "utf8");
      console.log(
        `${record.status} ${record.entryKey} progress=${Math.min(offset + batch.length, planned.length)}/${planned.length} issues=${record.issues.join(",") || "none"}`
      );
    }
  }

  const records = compactFrenchRunRecords([...recordsByEntry.values()]);
  writeRunRecordsAtomic(outputPath, records);
  rmSync(journalPath, { force: true });
  const summary = buildSummary({
    inputPath,
    inputDigest: input.inputDigest,
    packetSummary: packetSummaryAttestation,
    outputPath,
    outputDigest: sha256FileSync(outputPath),
    inputPackets: input.packets,
    selectedPackets: packets,
    planned,
    records,
    dryRun,
    modelA,
    modelB,
    arbiterModel,
    args
  });
  writeJson(summaryPath, summary);
  writeFileSync(reportPath, renderReport(summary), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

export function assertFrenchModelCallBudget(options: {
  dryRun: boolean;
  plannedModelCalls: number;
  maxModelCalls: number | null;
}): void {
  if (options.dryRun) return;
  if (
    options.maxModelCalls !== null &&
    options.plannedModelCalls > options.maxModelCalls
  ) {
    throw new Error(
      `model-call-budget-exceeded:planned=${options.plannedModelCalls}:max=${options.maxModelCalls}`
    );
  }
  if (
    options.maxModelCalls === null &&
    options.plannedModelCalls > MAX_UNAPPROVED_MODEL_CALLS
  ) {
    throw new Error(
      `model-call-budget-approval-required:planned=${options.plannedModelCalls}:pass--max-model-calls=${options.plannedModelCalls}`
    );
  }
}

export function frenchGenerationConfigHash(options: {
  modelA: string;
  modelB: string;
  arbiterModel: string;
  reasoningA: string;
  reasoningB: string;
  reasoningArbiter: string;
}): string {
  return sha256Bytes(
    JSON.stringify({
      promptVersion: FRENCH_GENERATION_PROMPT_VERSION,
      models: {
        proposerA: normalizeModel(options.modelA),
        proposerB: normalizeModel(options.modelB),
        arbiter: normalizeModel(options.arbiterModel)
      },
      reasoning: {
        proposerA: options.reasoningA.trim().toLowerCase(),
        proposerB: options.reasoningB.trim().toLowerCase(),
        arbiter: options.reasoningArbiter.trim().toLowerCase()
      }
    })
  );
}

export async function processPacket(
  packet: LexiconV3FrenchPacket,
  options: {
    apiKey: string;
    modelA: string;
    modelB: string;
    arbiterModel: string;
    timeoutMs: number;
    reasoningA: string;
    reasoningB: string;
    reasoningArbiter: string;
    gateway?: typeof callGateway;
  }
): Promise<FrenchRunRecord> {
  const generationConfigHash = frenchGenerationConfigHash(options);
  const packetIssues = validateFrenchPacket(packet);
  const emptyUsage = { inputTokens: 0, outputTokens: 0 };
  const englishStatus = packet.english.status;
  const modelEligible =
    englishStatus === "validated" || englishStatus === "human_validated";
  if (packetIssues.length > 0 || !modelEligible) {
    const status: RunStatus =
      packetIssues.length > 0
        ? "failed"
        : englishStatus === "source_issue"
          ? "blocked_source_issue"
          : englishStatus === "review_needed"
            ? "review_needed"
            : "failed";
    const blockingIssues =
      packetIssues.length > 0
        ? packetIssues
        : englishStatus === "source_issue"
          ? ["blocked-by-english-source"]
          : englishStatus === "review_needed"
            ? ["blocked-by-english-review-needed"]
            : ["unsupported-english-status"];
    return finalizeRecord({
      entryKey: packet.entryKey,
      packetHash: packet.packetHash,
      englishHash: packet.english.contentHash,
      generationConfigHash,
      status,
      models: {
        proposerA: options.modelA,
        proposerB: options.modelB,
        arbiter: options.arbiterModel
      },
      modelProofs: {
        proposerA: unverifiedModelProof(options.modelA),
        proposerB: unverifiedModelProof(options.modelB),
        arbiter: unverifiedModelProof(options.arbiterModel)
      },
      carrierTerms: [],
      issues: blockingIssues,
      usage: {
        proposerA: emptyUsage,
        proposerB: emptyUsage,
        arbiter: emptyUsage
      }
    });
  }

  const gateway = options.gateway ?? callGateway;
  const [rawA, rawB] = await Promise.all([
    gateway({
      apiKey: options.apiKey,
      model: options.modelA,
      timeoutMs: options.timeoutMs,
      reasoningEffort: options.reasoningA,
      system: proposerSystemPrompt(),
      user: proposerPrompt(packet)
    }),
    gateway({
      apiKey: options.apiKey,
      model: options.modelB,
      timeoutMs: options.timeoutMs,
      reasoningEffort: options.reasoningB,
      system: proposerSystemPrompt(),
      user: proposerPrompt(packet)
    })
  ]);
  const proposalA = parseProposal(rawA.text, packet, rawA.model);
  const proposalB = parseProposal(rawB.text, packet, rawB.model);
  const context = validationContext(packet);
  const validationA = validateFrenchProposal(proposalA, context);
  const validationB = validateFrenchProposal(proposalB, context);

  const rawArbiter = await gateway({
    apiKey: options.apiKey,
    model: options.arbiterModel,
    timeoutMs: options.timeoutMs,
    reasoningEffort: options.reasoningArbiter,
    system: arbiterSystemPrompt(),
    user: arbiterPrompt(packet, proposalA, proposalB, validationA, validationB)
  });
  const arbiterPayload = parseArbiter(rawArbiter.text);
  const arbiterProposal = normalizeProposal(
    arbiterPayload,
    packet,
    rawArbiter.model
  );
  const arbiterValidation = validateFrenchProposal(arbiterProposal, context);
  const carrierTerms = buildConsensusCarrierTerms(
    proposalA,
    proposalB,
    arbiterProposal,
    context
  );
  const autoEligibility = evaluateFrenchAutoEligibility({
    proposalA,
    proposalB,
    arbiterProposal,
    validationA,
    validationB,
    arbiterValidation,
    models: {
      proposerA: rawA.model,
      proposerB: rawB.model,
      arbiter: rawArbiter.model
    },
    modelProofs: {
      proposerA: rawA.proof,
      proposerB: rawB.proof,
      arbiter: rawArbiter.proof
    },
    arbiterVerdict: arbiterPayload.verdict,
    arbiterReasons: arbiterPayload.reasons,
    englishStatus: packet.english.status
  });
  const issues = [
    ...validationA.issues.map((issue) => `a:${issue.code}`),
    ...validationB.issues.map((issue) => `b:${issue.code}`),
    ...arbiterValidation.issues.map((issue) => `arbiter:${issue.code}`),
    ...autoEligibility.reasons,
    ...arbiterPayload.reasons.map((reason) => `arbiter:${reason}`)
  ];

  return finalizeRecord({
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash,
    status: autoEligibility.eligible ? "auto_validated" : "review_needed",
    models: {
      proposerA: rawA.model,
      proposerB: rawB.model,
      arbiter: rawArbiter.model
    },
    modelProofs: {
      proposerA: rawA.proof,
      proposerB: rawB.proof,
      arbiter: rawArbiter.proof
    },
    proposalA,
    proposalB,
    validationA,
    validationB,
    arbiter: {
      verdict: arbiterPayload.verdict,
      reasons: arbiterPayload.reasons,
      proposal: arbiterProposal,
      validation: arbiterValidation
    },
    carrierTerms,
    issues: [...new Set(issues)],
    usage: {
      proposerA: rawA.usage,
      proposerB: rawB.usage,
      arbiter: rawArbiter.usage
    }
  });
}

function proposerSystemPrompt(): string {
  return [
    "Tu es lexicographe biblique francophone, compétent en grec et hébreu.",
    "Produis une traduction française précise et naturelle à partir du contenu anglais consolidé et des témoins fournis.",
    "Le gloss est une vedette lexicale: verbe à l'infinitif, nom/adjectif sous forme lexicale, jamais une traduction mot à mot aveugle.",
    "Les anciennes traductions françaises sont des témoins non fiables, pas une autorité.",
    "N'invente aucune référence, aucun code Strong, aucune étymologie et aucun personnage.",
    "Préserve dans meaningFr et meaningHtmlFr chaque code Strong et forme grecque/hébraïque de protectedContent, ainsi que les mêmes livre, chapitre et verset pour chaque référence; le nom français du livre est permis.",
    "meaningFr et le texte visible de meaningHtmlFr doivent contenir exactement les mêmes mots dans le même ordre; place la ponctuation à l'intérieur des balises.",
    "Dans meaningHtmlFr, utilise uniquement des balises simples sans attribut, de préférence <p> et <strong>; n'écris jamais de balise dans meaningFr.",
    "Réponds uniquement en JSON avec glossFr, meaningFr, meaningHtmlFr, notesFr, carrierTermsFr et confidence.",
    "carrierTermsFr ne contient que des mots français visibles directement soutenus par la concordance fournie; sinon []."
  ].join(" ");
}

function arbiterSystemPrompt(): string {
  return [
    "Tu arbitres deux traductions françaises indépendantes d'une notice lexicale biblique.",
    "Cherche activement faux amis, contresens, omissions, français artificiel, graphies bibliques incohérentes et inventions.",
    "Tu peux retenir la meilleure proposition ou produire une correction strictement fondée sur le paquet.",
    "meaningFr et le texte visible de meaningHtmlFr doivent contenir exactement les mêmes mots dans le même ordre; le HTML ne contient aucun attribut.",
    "Réponds uniquement en JSON avec verdict, reasons, glossFr, meaningFr, meaningHtmlFr, notesFr, carrierTermsFr et confidence.",
    "verdict vaut accept uniquement si la notice est publiable sans révision humaine; dans ce cas reasons doit être []."
  ].join(" ");
}

function proposerPrompt(packet: LexiconV3FrenchPacket): string {
  return JSON.stringify({
    task: "Traduire et éditer cette entrée STEP consolidée en français.",
    identity: packet.identity,
    english: {
      ...packet.english,
      meaning: packet.english.meaning.slice(0, 16_000),
      meaningHtml: packet.english.meaningHtml.slice(0, 20_000)
    },
    evidence: {
      occurrenceGlosses: packet.evidence.occurrenceGlosses,
      concordanceForms: packet.evidence.concordanceForms,
      legacy: packet.evidence.legacy,
      existingFrench: packet.evidence.existingFrench,
      resourceFrench: packet.evidence.resourceFrench.map((resource) => ({
        ...resource,
        meaning: resource.meaning.slice(0, 8_000),
        meaningHtml: resource.meaningHtml.slice(0, 10_000)
      }))
    },
    protectedContent: packet.protectedContent
  });
}

function arbiterPrompt(
  packet: LexiconV3FrenchPacket,
  proposalA: FrenchLexiconProposal,
  proposalB: FrenchLexiconProposal,
  validationA: FrenchValidationResult,
  validationB: FrenchValidationResult
): string {
  return JSON.stringify({
    task: "Arbitrer les deux propositions à partir des seules preuves du paquet.",
    packet: JSON.parse(proposerPrompt(packet)) as unknown,
    proposalA,
    validationA,
    proposalB,
    validationB
  });
}

export async function callGateway(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  reasoningEffort: string;
  system: string;
  user: string;
}): Promise<ModelResult> {
  const request = async (optional: {
    responseFormat: boolean;
    reasoningEffort: boolean;
  }): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    return await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        ...(optional.reasoningEffort
          ? { reasoning_effort: options.reasoningEffort }
          : {}),
        ...(optional.responseFormat
          ? { response_format: { type: "json_object" } }
          : {}),
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user }
        ]
      })
    }).finally(() => clearTimeout(timeout));
  };

  const optional = { responseFormat: true, reasoningEffort: true };
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await request(optional);
    if (response.ok) break;
    const errorBody = await response.text();
    if (
      response.status === 400 &&
      optional.responseFormat &&
      /response_format/iu.test(errorBody)
    ) {
      optional.responseFormat = false;
      continue;
    }
    if (
      response.status === 400 &&
      optional.reasoningEffort &&
      /reasoning_effort/iu.test(errorBody)
    ) {
      optional.reasoningEffort = false;
      continue;
    }
    throw new Error(
      `ai-gateway-http-${response.status}:${errorBody.slice(0, 400)}`
    );
  }
  if (!response?.ok) {
    throw new Error(
      `ai-gateway-http-${response?.status ?? "missing"}:optional-parameter-retries-exhausted`
    );
  }
  const json = (await response.json()) as {
    model?: string;
    provider?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      promptTokens?: number;
      completionTokens?: number;
    };
  };
  const actualModel = textValue(json.model) || null;
  const modelProvider = actualModel?.includes("/")
    ? actualModel.slice(0, actualModel.indexOf("/")).trim()
    : null;
  const provider =
    textValue(json.provider) ||
    response.headers.get("x-ai-gateway-provider")?.trim() ||
    response.headers.get("ai-gateway-provider")?.trim() ||
    modelProvider ||
    null;
  const identity =
    actualModel && provider
      ? composeFrenchModelIdentity(provider, actualModel)
      : null;
  const proof: ModelExecutionProof = {
    requestedModel: options.model,
    actualModel,
    provider,
    identity,
    verified: Boolean(identity)
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    model: identity ?? "",
    proof,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? json.usage?.promptTokens ?? 0,
      outputTokens:
        json.usage?.completion_tokens ?? json.usage?.completionTokens ?? 0
    }
  };
}

function unverifiedModelProof(requestedModel: string): ModelExecutionProof {
  return {
    requestedModel,
    actualModel: null,
    provider: null,
    identity: null,
    verified: false
  };
}

function parseProposal(
  text: string,
  packet: LexiconV3FrenchPacket,
  model: string
): FrenchLexiconProposal {
  return normalizeProposal(parseJson(text), packet, model);
}

function normalizeProposal(
  value: Partial<ArbiterPayload>,
  packet: LexiconV3FrenchPacket,
  model: string
): FrenchLexiconProposal {
  const meaningFr = textValue(value.meaningFr);
  return {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    derivedFromEnglishHash: packet.english.contentHash,
    model,
    glossFr: textValue(value.glossFr),
    meaningSegmentsFr: [],
    entityMentionsFr: [],
    meaningFr,
    meaningHtmlFr:
      textValue(value.meaningHtmlFr) || `<p>${escapeHtml(meaningFr)}</p>`,
    notesFr: textValue(value.notesFr),
    carrierTermsFr: Array.isArray(value.carrierTermsFr)
      ? value.carrierTermsFr.map(textValue).filter(Boolean)
      : [],
    confidence: numericConfidence(value.confidence)
  };
}

function parseArbiter(text: string): ArbiterPayload {
  const value = parseJson(text) as Partial<ArbiterPayload>;
  return {
    verdict: value.verdict === "accept" ? "accept" : "review_needed",
    reasons: Array.isArray(value.reasons)
      ? value.reasons.map(textValue).filter(Boolean)
      : [],
    glossFr: textValue(value.glossFr),
    meaningFr: textValue(value.meaningFr),
    meaningHtmlFr: textValue(value.meaningHtmlFr),
    notesFr: textValue(value.notesFr),
    carrierTermsFr: Array.isArray(value.carrierTermsFr)
      ? value.carrierTermsFr.map(textValue).filter(Boolean)
      : [],
    confidence: numericConfidence(value.confidence)
  };
}

function parseJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(trimmed)?.[1]?.trim();
  const candidate = fenced ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model-output-missing-json");
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

function validationContext(
  packet: LexiconV3FrenchPacket
): FrenchValidationContext {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    legacyGloss: packet.evidence.legacy?.gloss,
    legacyMeaning: packet.evidence.legacy?.meaning,
    concordanceForms: packet.evidence.concordanceForms
  };
}

function failedRecord(
  packet: LexiconV3FrenchPacket,
  modelA: string,
  modelB: string,
  arbiter: string,
  generationConfigHash: string,
  error: unknown
): FrenchRunRecord {
  const empty = { inputTokens: 0, outputTokens: 0 };
  return finalizeRecord({
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    generationConfigHash,
    status: "failed",
    models: { proposerA: modelA, proposerB: modelB, arbiter },
    modelProofs: {
      proposerA: unverifiedModelProof(modelA),
      proposerB: unverifiedModelProof(modelB),
      arbiter: unverifiedModelProof(arbiter)
    },
    carrierTerms: [],
    issues: [error instanceof Error ? error.message : String(error)],
    usage: { proposerA: empty, proposerB: empty, arbiter: empty }
  });
}

function finalizeRecord(
  value: Omit<FrenchRunRecord, "schemaVersion" | "artifactHash" | "generatedAt">
): FrenchRunRecord {
  const generatedAt = new Date().toISOString();
  const content = {
    schemaVersion: "lexicon-v3-french-review@2" as const,
    ...value,
    generatedAt
  };
  return {
    ...content,
    artifactHash: createHash("sha256")
      .update(JSON.stringify(content))
      .digest("hex")
  };
}

export function readAndValidateFrenchPackets(
  path: string
): FrenchPacketInputAttestation {
  const bytes = readFileSync(path);
  const lines = bytes.toString("utf8").split(/\r?\n/u);
  const packets: LexiconV3FrenchPacket[] = [];
  const errors: string[] = [];
  const seenEntryKeys = new Set<string>();
  const seenStepEntryIds = new Set<number>();
  const seenPacketHashes = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line?.trim()) continue;
    const lineNumber = index + 1;
    let packet: LexiconV3FrenchPacket;
    try {
      packet = JSON.parse(line) as LexiconV3FrenchPacket;
    } catch {
      errors.push(`invalid-json:${lineNumber}`);
      continue;
    }
    if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
      errors.push(`invalid-packet-object:${lineNumber}`);
      continue;
    }

    let packetIssues: string[];
    try {
      packetIssues = validateFrenchPacket(packet);
    } catch {
      packetIssues = ["invalid-packet-structure"];
    }
    const status = packet.english?.status as string | undefined;
    if (!ENGLISH_STATUSES.some((candidate) => candidate === status)) {
      packetIssues.push("invalid-english-status");
    }
    if (packetIssues.length > 0) {
      errors.push(
        `invalid-packet:${lineNumber}:${textValue(packet.entryKey) || "unknown"}:${packetIssues.join(",")}`
      );
    }

    const entryKey = textValue(packet.entryKey);
    if (entryKey && seenEntryKeys.has(entryKey)) {
      errors.push(`duplicate-entry-key:${lineNumber}:${entryKey}`);
    }
    if (entryKey) seenEntryKeys.add(entryKey);

    const stepEntryId = packet.identity?.stepEntryId;
    if (Number.isInteger(stepEntryId) && seenStepEntryIds.has(stepEntryId)) {
      errors.push(`duplicate-step-entry-id:${lineNumber}:${stepEntryId}`);
    }
    if (Number.isInteger(stepEntryId)) seenStepEntryIds.add(stepEntryId);

    const packetHash = textValue(packet.packetHash);
    if (packetHash && seenPacketHashes.has(packetHash)) {
      errors.push(`duplicate-packet-hash:${lineNumber}:${packetHash}`);
    }
    if (packetHash) seenPacketHashes.add(packetHash);
    packets.push(packet);
  }

  if (packets.length === 0) errors.push("empty-packet-input");
  if (errors.length > 0) {
    throw new Error(`invalid-french-packet-input:${errors.join(";")}`);
  }
  return {
    packets,
    inputDigest: sha256Bytes(bytes)
  };
}

export function validateFrenchPacketBuildAttestation(input: {
  summaryPath: string;
  inputPath: string;
  inputDigest: string;
  inputPackets: number;
  requireReviewedAuthoring?: boolean;
}): FrenchPacketSummaryAttestation {
  if (!existsSync(input.summaryPath)) {
    throw new Error(`missing-packet-summary:${resolve(input.summaryPath)}`);
  }
  const bytes = readFileSync(input.summaryPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("invalid-packet-summary-json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid-packet-summary-structure");
  }
  const summary = parsed as Record<string, unknown>;
  if (
    summary.schemaVersion !== "lexicon-v3-french-packet-build@1" &&
    summary.schemaVersion !== "lexicon-v3-french-packet-build@2"
  ) {
    throw new Error("invalid-packet-summary-schema");
  }
  if (
    input.requireReviewedAuthoring &&
    (summary.schemaVersion !== "lexicon-v3-french-packet-build@2" ||
      !summary.englishAuthoring ||
      typeof summary.englishAuthoring !== "object" ||
      Array.isArray(summary.englishAuthoring))
  ) {
    throw new Error("packet-summary-requires-reviewed-authoring");
  }
  if (summary.outputDigest !== input.inputDigest) {
    throw new Error("packet-summary-digest-mismatch");
  }
  if (summary.outputPackets !== input.inputPackets) {
    throw new Error("packet-summary-count-mismatch");
  }
  const sourcePaths = summary.sourcePaths;
  const attestedOutput =
    sourcePaths &&
    typeof sourcePaths === "object" &&
    !Array.isArray(sourcePaths)
      ? textValue((sourcePaths as Record<string, unknown>).output)
      : "";
  if (!attestedOutput || resolve(attestedOutput) !== resolve(input.inputPath)) {
    throw new Error("packet-summary-path-mismatch");
  }
  return {
    path: resolve(input.summaryPath),
    digest: sha256Bytes(bytes)
  };
}

function selectPackets(
  packets: LexiconV3FrenchPacket[],
  args: Record<string, string>
): LexiconV3FrenchPacket[] {
  const only = new Set(
    (args.only ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const offset = boundedInteger(args.offset, 0, 1_000_000) ?? 0;
  const limit = boundedInteger(args.limit, 1, 1_000_000);
  const filtered = only.size
    ? packets.filter(
        (packet) =>
          only.has(packet.entryKey) || only.has(packet.identity.eStrong)
      )
    : packets;
  return filtered.slice(offset, limit ? offset + limit : undefined);
}

function readRunRecords(path: string): FrenchRunRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .flatMap((line, index) => {
      if (!line.trim()) return [];
      let record: FrenchRunRecord;
      try {
        record = JSON.parse(line) as FrenchRunRecord;
      } catch {
        throw new Error(`invalid-french-run-record-json:${path}:${index + 1}`);
      }
      verifyFrenchRunRecord(record, `${path}:${index + 1}`);
      return [record];
    });
}

export function verifyFrenchRunRecord(
  record: FrenchRunRecord,
  locator = record.entryKey
): void {
  if (record.schemaVersion !== "lexicon-v3-french-review@2") {
    throw new Error(`invalid-french-run-record-schema:${locator}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(record.generationConfigHash)) {
    throw new Error(`invalid-french-run-config-hash:${locator}`);
  }
  const content = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== "artifactHash")
  );
  if (sha256Bytes(JSON.stringify(content)) !== record.artifactHash) {
    throw new Error(`invalid-french-run-artifact-hash:${locator}`);
  }
}

export function compactFrenchRunRecords(
  records: FrenchRunRecord[]
): FrenchRunRecord[] {
  const latest = new Map<string, FrenchRunRecord>();
  for (const record of records) latest.set(record.entryKey, record);
  return [...latest.values()].sort((left, right) =>
    left.entryKey.localeCompare(right.entryKey)
  );
}

function writeRunRecordsAtomic(path: string, records: FrenchRunRecord[]): void {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  const compacted = compactFrenchRunRecords(records);
  writeFileSync(
    temporary,
    `${compacted.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );
  renameSync(temporary, path);
}

export function buildFrenchRunSummary(options: {
  inputPath: string;
  inputDigest: string;
  packetSummary: FrenchPacketSummaryAttestation | null;
  outputPath: string;
  outputDigest: string | null;
  inputPackets: LexiconV3FrenchPacket[];
  selectedPackets: LexiconV3FrenchPacket[];
  planned: LexiconV3FrenchPacket[];
  records: FrenchRunRecord[];
  dryRun: boolean;
  modelA: string;
  modelB: string;
  arbiterModel: string;
  args: Record<string, string>;
}): FrenchRunSummary {
  if (!options.dryRun && !options.outputDigest) {
    throw new Error("missing-output-digest");
  }
  const reasoning = {
    proposerA: options.args.reasoningA ?? "medium",
    proposerB: options.args.reasoningB ?? "low",
    arbiter: options.args.reasoningArbiter ?? "medium"
  };
  const generationConfigHash = frenchGenerationConfigHash({
    modelA: options.modelA,
    modelB: options.modelB,
    arbiterModel: options.arbiterModel,
    reasoningA: reasoning.proposerA,
    reasoningB: reasoning.proposerB,
    reasoningArbiter: reasoning.arbiter
  });
  const statuses = countRunStatuses(options.records);
  const selectedRecordByEntry = new Map(
    options.records.map((record) => [record.entryKey, record])
  );
  const recordsForSelection = options.selectedPackets.filter((packet) => {
    const record = selectedRecordByEntry.get(packet.entryKey);
    return (
      record?.packetHash === packet.packetHash &&
      record.generationConfigHash === generationConfigHash
    );
  }).length;
  const successfulRecordsForSelection = options.selectedPackets.filter(
    (packet) => {
      const record = selectedRecordByEntry.get(packet.entryKey);
      return (
        record?.packetHash === packet.packetHash &&
        record.generationConfigHash === generationConfigHash &&
        record.status !== "failed"
      );
    }
  ).length;
  const eligiblePlanned = options.planned.filter(isModelEligiblePacket);
  const only = (options.args.only ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
  const offset = boundedInteger(options.args.offset, 0, 1_000_000) ?? 0;
  const limit = boundedInteger(options.args.limit, 1, 1_000_000);

  return {
    schemaVersion: "lexicon-v3-french-run-summary@3",
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    input: options.inputPath,
    inputDigest: options.inputDigest,
    packetSummary: options.packetSummary?.path ?? null,
    packetSummaryDigest: options.packetSummary?.digest ?? null,
    output: options.outputPath,
    outputDigest: options.dryRun ? null : options.outputDigest,
    inputPackets: options.inputPackets.length,
    plannedPackets: options.planned.length,
    writtenRecords: options.records.length,
    plannedModelCalls: eligiblePlanned.length * 3,
    estimatedMinimumInputTokens: eligiblePlanned.reduce(
      (total, packet) =>
        total + Math.ceil(proposerPrompt(packet).length / 4) * 2,
      0
    ),
    selection: {
      only,
      offset,
      limit,
      inputPackets: options.inputPackets.length,
      selectedPackets: options.selectedPackets.length
    },
    coverage: {
      selectedPackets: options.selectedPackets.length,
      eligibleForModels: options.selectedPackets.filter(isModelEligiblePacket)
        .length,
      blockedByEnglishReview: options.selectedPackets.filter(
        (packet) => packet.english.status === "review_needed"
      ).length,
      blockedBySourceIssue: options.selectedPackets.filter(
        (packet) => packet.english.status === "source_issue"
      ).length,
      completedBeforeRun:
        options.selectedPackets.length - options.planned.length,
      plannedPackets: options.planned.length,
      recordsForSelection,
      successfulRecordsForSelection,
      missingOrFailedRecords:
        options.selectedPackets.length - successfulRecordsForSelection
    },
    statusCounts: {
      inputEnglish: countEnglishStatuses(options.inputPackets),
      selectedEnglish: countEnglishStatuses(options.selectedPackets),
      outputRecords: statuses
    },
    statuses,
    models: {
      proposerA: options.modelA,
      proposerB: options.modelB,
      arbiter: options.arbiterModel
    },
    generation: {
      promptVersion: FRENCH_GENERATION_PROMPT_VERSION,
      configHash: generationConfigHash,
      reasoning
    },
    totalUsage: options.records.reduce(
      (total, record) => ({
        inputTokens:
          total.inputTokens +
          record.usage.proposerA.inputTokens +
          record.usage.proposerB.inputTokens +
          record.usage.arbiter.inputTokens,
        outputTokens:
          total.outputTokens +
          record.usage.proposerA.outputTokens +
          record.usage.proposerB.outputTokens +
          record.usage.arbiter.outputTokens
      }),
      { inputTokens: 0, outputTokens: 0 }
    )
  };
}

const buildSummary = buildFrenchRunSummary;

function countEnglishStatuses(
  packets: readonly LexiconV3FrenchPacket[]
): Record<EnglishStatus, number> {
  const counts = Object.fromEntries(
    ENGLISH_STATUSES.map((status) => [status, 0])
  ) as Record<EnglishStatus, number>;
  for (const packet of packets) counts[packet.english.status] += 1;
  return counts;
}

function countRunStatuses(
  records: readonly FrenchRunRecord[]
): Record<RunStatus, number> {
  const counts = Object.fromEntries(
    RUN_STATUSES.map((status) => [status, 0])
  ) as Record<RunStatus, number>;
  for (const record of records) counts[record.status] += 1;
  return counts;
}

function isModelEligiblePacket(packet: LexiconV3FrenchPacket): boolean {
  return (
    packet.english.status === "validated" ||
    packet.english.status === "human_validated"
  );
}

function renderReport(summary: FrenchRunSummary): string {
  return `# Lexicon v3 French Review\n\nGenerated: ${String(summary.generatedAt)}\n\n- Dry run: \`${String(summary.dryRun)}\`\n- Input SHA-256: \`${String(summary.inputDigest)}\`\n- Output SHA-256: \`${String(summary.outputDigest)}\`\n- Input packets: \`${String(summary.inputPackets)}\`\n- Planned packets: \`${String(summary.plannedPackets)}\`\n- Written records: \`${String(summary.writtenRecords)}\`\n- Selection: \`${JSON.stringify(summary.selection)}\`\n- Coverage: \`${JSON.stringify(summary.coverage)}\`\n- Status counts: \`${JSON.stringify(summary.statusCounts)}\`\n- Models: \`${JSON.stringify(summary.models)}\`\n- Usage: \`${JSON.stringify(summary.totalUsage)}\`\n`;
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/gu, (_, letter: string) =>
      letter.toUpperCase()
    );
    const next = args[index + 1];
    if (inlineValue !== undefined) parsed[key] = inlineValue;
    else if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else parsed[key] = "true";
  }
  return parsed;
}

function boundedInteger(
  value: string | undefined,
  min: number,
  max: number
): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function loadDotEnv(): void {
  const path = resolve(".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match || process.env[match[1] ?? ""] !== undefined) continue;
    const key = match[1] ?? "";
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function normalizeModel(value: string): string {
  return value.trim().toLowerCase();
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numericConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256FileSync(path: string): string {
  return sha256Bytes(readFileSync(path));
}

function sha256Bytes(value: string | NodeJS.ArrayBufferView): string {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
