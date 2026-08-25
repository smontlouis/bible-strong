import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

type StepEntry = {
  id: number;
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
};

type ModelInfo = {
  id: string;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
};

type TranslationItem = {
  id: number;
  strong: string;
  gloss: string;
  meaning: string;
  notes?: string;
  confidence?: number;
  warnings?: string[];
};

type BenchmarkResult = {
  model: string;
  ok: boolean;
  score: number;
  maxScore: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
  error?: string;
  items: Array<{
    id: number;
    strong: string;
    gloss: string;
    expected: string[];
    forbidden: string[];
    score: number;
    maxScore: number;
    issues: string[];
    output?: TranslationItem;
  }>;
};

const DEFAULT_MODELS = [
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-pro",
  "openai/gpt-5-mini",
  "google/gemini-3.1-flash-lite",
  "anthropic/claude-haiku-4.5"
];

const SAMPLE_IDS = [
  14417, // H2526 Ham/Cham
  15149, // H3068 LORD/YHWH
  12796, // H1285 covenant
  16151, // H3722a atone
  20057, // H6666 righteousness
  20879, // H7307 ruach
  20786, // H7225 beginning/best
  3168, // G3056 logos
  5561, // G5485 grace
  1385, // G1343 righteousness
  2502, // G2435 propitiation
  4186, // G4151 pneuma
  935, // G0907 baptize
  28 // G0026 agape
];

const EXPECTATIONS: Record<
  number,
  { expected: string[]; forbidden: string[] }
> = {
  28: { expected: ["amour"], forbidden: [] },
  935: { expected: ["bapt"], forbidden: [] },
  1385: { expected: ["justice", "droiture"], forbidden: [] },
  2502: {
    expected: ["propiti", "expiat", "propitiatoire"],
    forbidden: []
  },
  3168: {
    expected: ["parole", "mot", "discours", "raison", "verbe"],
    forbidden: ["logo"]
  },
  4186: { expected: ["esprit", "souffle", "vent"], forbidden: [] },
  5561: { expected: ["grace", "faveur"], forbidden: [] },
  12796: { expected: ["alliance"], forbidden: [] },
  14417: { expected: ["cham"], forbidden: ["jambon"] },
  15149: {
    expected: ["yhw", "yahv", "jehov", "eternel", "seigneur"],
    forbidden: []
  },
  16151: { expected: ["expi", "propiti", "aton"], forbidden: [] },
  20057: { expected: ["justice", "droiture"], forbidden: [] },
  20786: { expected: ["commencement", "debut", "premices"], forbidden: [] },
  20879: { expected: ["esprit", "souffle", "vent"], forbidden: [] }
};

function parseArgs(): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = process.argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
    } else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function getEntries(dbPath: string): StepEntry[] {
  const ids = SAMPLE_IDS.join(",");
  const query = `
    select id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
    from StepEntries
    where id in (${ids})
    order by id
  `;
  const raw = execFileSync("sqlite3", ["-json", dbPath, query], {
    encoding: "utf8"
  });
  return JSON.parse(raw) as StepEntry[];
}

async function getModelInfo(apiKey: string): Promise<Map<string, ModelInfo>> {
  const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) {
    throw new Error(`models-http-${response.status}`);
  }
  const json = (await response.json()) as {
    data?: Array<{
      id: string;
      pricing?: { input?: string; output?: string };
      input?: string;
      output?: string;
    }>;
  };
  const result = new Map<string, ModelInfo>();
  for (const model of json.data ?? []) {
    result.set(model.id, {
      id: model.id,
      inputCostPerToken: Number(model.pricing?.input ?? model.input),
      outputCostPerToken: Number(model.pricing?.output ?? model.output)
    });
  }
  return result;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt(entries: StepEntry[]): string {
  const compactEntries = entries.map((entry) => ({
    id: entry.id,
    language: entry.language,
    strong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong,
    original: entry.original,
    transliteration: entry.transliteration,
    morph: entry.morph,
    gloss_en: entry.gloss,
    meaning_en: stripHtml(entry.meaning).slice(0, 1600)
  }));

  return JSON.stringify({
    task: "Traduis en francais des entrees de dictionnaire biblique Strong. La sortie doit etre concise, technique, exploitable en base de donnees, et ne jamais inventer d'information.",
    lockedTerminology: [
      "Ham/H2526 est un nom propre biblique: traduire par Cham, jamais par jambon.",
      "covenant = alliance.",
      "atonement/to atone = expiation/faire l'expiation, avec propitiation si le contexte le demande.",
      "righteousness = justice/droiture selon le contexte.",
      "logos = parole/mot/discours/raison/verbe selon le contexte, jamais logo.",
      "charis = grace/faveur/reconnaissance selon le contexte.",
      "ruach/pneuma = esprit/souffle/vent selon le contexte.",
      "G2435 peut etre propitiatoire/expiatoire/propitiation selon la phrase.",
      "Conserver les codes Strong, originaux et transliterations; ne pas les traduire."
    ],
    outputContract: {
      instruction:
        "Retourne exactement un item par entree recue. Ne retourne pas seulement l'exemple. Conserve exactement les memes id et strong.",
      expectedIds: compactEntries.map((entry) => entry.id),
      schema:
        '{"items":[{"id":14417,"strong":"H2526","gloss":"...","meaning":"...","notes":"...","confidence":0.0,"warnings":["..."]}]}'
    },
    entries: compactEntries
  });
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

async function callModel(options: {
  apiKey: string;
  model: string;
  entries: StepEntry[];
}): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Tu es un lexicographe biblique francophone specialise en grec, hebreu, Strong et terminologie theologique. Reponds uniquement en JSON valide."
          },
          { role: "user", content: buildPrompt(options.entries) }
        ]
      })
    }
  );
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
      promptTokens?: number;
      completionTokens?: number;
    };
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens ?? json.usage?.promptTokens ?? 0,
    outputTokens:
      json.usage?.completion_tokens ?? json.usage?.completionTokens ?? 0
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function containsWholeTerm(value: string, term: string): boolean {
  const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(
    normalize(value)
  );
}

function scoreItems(entries: StepEntry[], items: TranslationItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return entries.map((entry) => {
    const expectation = EXPECTATIONS[entry.id] ?? {
      expected: [],
      forbidden: []
    };
    const output = byId.get(entry.id);
    const issues: string[] = [];
    let score = 0;
    const maxScore = 10;

    if (!output) {
      return {
        id: entry.id,
        strong: entry.eStrong,
        gloss: entry.gloss,
        ...expectation,
        score,
        maxScore,
        issues: ["missing-output"]
      };
    }

    if (output.strong === entry.eStrong) {
      score += 2;
    } else {
      issues.push(`strong-changed:${output.strong}`);
    }

    const combined = normalize([output.gloss, output.meaning].join(" "));
    const hasExpected = expectation.expected.some((term) =>
      combined.includes(normalize(term))
    );
    const hasForbidden = expectation.forbidden.some((term) =>
      containsWholeTerm([output.gloss, output.meaning].join(" "), term)
    );

    if (hasExpected) {
      score += 4;
    } else if (expectation.expected.length > 0) {
      issues.push(`missing-expected:${expectation.expected.join("|")}`);
    }

    if (!hasForbidden) {
      score += 2;
    } else {
      issues.push(`forbidden-term:${expectation.forbidden.join("|")}`);
    }

    if (typeof output.confidence === "number") {
      score += 1;
    } else {
      issues.push("missing-confidence");
    }

    if (output.gloss?.trim() && output.meaning?.trim()) {
      score += 1;
    } else {
      issues.push("missing-gloss-or-meaning");
    }

    return {
      id: entry.id,
      strong: entry.eStrong,
      gloss: entry.gloss,
      ...expectation,
      score,
      maxScore,
      issues,
      output
    };
  });
}

async function benchmarkModel(options: {
  apiKey: string;
  model: string;
  modelInfo?: ModelInfo;
  entries: StepEntry[];
}): Promise<BenchmarkResult> {
  const start = performance.now();
  try {
    const response = await callModel(options);
    const latencyMs = Math.round(performance.now() - start);
    const parsed = JSON.parse(extractJson(response.text)) as {
      items?: TranslationItem[];
    };
    const scoredItems = scoreItems(options.entries, parsed.items ?? []);
    const score = scoredItems.reduce((sum, item) => sum + item.score, 0);
    const maxScore = scoredItems.reduce((sum, item) => sum + item.maxScore, 0);
    const estimatedCostUsd =
      options.modelInfo?.inputCostPerToken != null &&
      options.modelInfo?.outputCostPerToken != null
        ? response.inputTokens * options.modelInfo.inputCostPerToken +
          response.outputTokens * options.modelInfo.outputCostPerToken
        : undefined;

    return {
      model: options.model,
      ok: true,
      score,
      maxScore,
      latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      estimatedCostUsd,
      items: scoredItems
    };
  } catch (error) {
    return {
      model: options.model,
      ok: false,
      score: 0,
      maxScore: options.entries.length * 10,
      latencyMs: Math.round(performance.now() - start),
      inputTokens: 0,
      outputTokens: 0,
      error: error instanceof Error ? error.message : String(error),
      items: []
    };
  }
}

function formatMoney(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  if (value < 0.001) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(4)}`;
}

function renderReport(results: BenchmarkResult[]): string {
  const lines = [
    "# Lexicon Translation Benchmark",
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Model | Score | Latency | Input tokens | Output tokens | Estimated cost | Status |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |"
  ];
  for (const result of [...results].sort((a, b) => {
    const byScore = b.score / b.maxScore - a.score / a.maxScore;
    if (byScore !== 0) return byScore;
    return (a.estimatedCostUsd ?? 999) - (b.estimatedCostUsd ?? 999);
  })) {
    lines.push(
      `| ${result.model} | ${result.score}/${result.maxScore} | ${result.latencyMs}ms | ${result.inputTokens} | ${result.outputTokens} | ${formatMoney(result.estimatedCostUsd)} | ${
        result.ok ? "ok" : (result.error ?? "failed")
      } |`
    );
  }

  for (const result of results) {
    lines.push("", `## ${result.model}`, "");
    if (!result.ok) {
      lines.push(`Error: ${result.error ?? "unknown"}`);
      continue;
    }
    lines.push(
      "| Strong | Source gloss | Score | Issues | French gloss |",
      "| --- | --- | ---: | --- | --- |"
    );
    for (const item of result.items) {
      lines.push(
        `| ${item.strong} | ${item.gloss.replace(/\|/g, "/")} | ${item.score}/${item.maxScore} | ${
          item.issues.join(", ") || "-"
        } | ${(item.output?.gloss ?? "").replace(/\|/g, "/")} |`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs();
  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("missing AI_GATEWAY_KEY or AI_GATEWAY_API_KEY");

  const models = (args.get("models") ?? DEFAULT_MODELS.join(","))
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const dbPath = args.get("db") ?? "data/dictionaries/strong_lexicon.sqlite";
  const jsonOut =
    args.get("json-out") ?? "reports/lexicon-translation-benchmark.json";
  const mdOut =
    args.get("md-out") ?? "reports/lexicon-translation-benchmark.md";

  const entries = getEntries(dbPath);
  const modelInfo = await getModelInfo(apiKey);
  const results: BenchmarkResult[] = [];
  for (const model of models) {
    console.log(`benchmark ${model}...`);
    results.push(
      await benchmarkModel({
        apiKey,
        model,
        modelInfo: modelInfo.get(model),
        entries
      })
    );
  }

  mkdirSync(dirname(resolve(jsonOut)), { recursive: true });
  mkdirSync(dirname(resolve(mdOut)), { recursive: true });
  writeFileSync(jsonOut, `${JSON.stringify({ entries, results }, null, 2)}\n`);
  writeFileSync(mdOut, renderReport(results));

  console.log(renderReport(results).split("\n").slice(0, 16).join("\n"));
  console.log(`Wrote ${jsonOut}`);
  console.log(`Wrote ${mdOut}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
