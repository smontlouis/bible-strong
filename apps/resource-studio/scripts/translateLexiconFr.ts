import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
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

type FrenchHint = {
  lsg: string;
  definition: string;
};

type TranslationCandidate = {
  id: number;
  strong: string;
  glossFr: string;
  meaningFr: string;
  notesFr: string;
  confidence: number;
  warnings: string[];
  lockedTermsApplied: string[];
};

type ReviewResult = {
  verdict: "accepted" | "review_needed";
  score: number;
  issues: string[];
  correctedGlossFr?: string;
  correctedMeaningFr?: string;
  comment?: string;
};

type OutputRecord = {
  stepEntryId: number;
  targetLanguage: "fr";
  status: "accepted" | "review_needed" | "invalid";
  source: {
    language: StepEntry["language"];
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
    gloss: string;
    meaningHash: string;
  };
  translation: TranslationCandidate;
  validation: {
    score: number;
    maxScore: number;
    issues: string[];
  };
  review?: ReviewResult;
  model: string;
  reviewModel?: string;
  usage: {
    translationInputTokens: number;
    translationOutputTokens: number;
    reviewInputTokens: number;
    reviewOutputTokens: number;
    estimatedCostUsd: number;
    latencyMs: number;
  };
  generatedAt: string;
};

type GatewayResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_LEGACY_FR_DB = "data/dictionaries/strong_fr.sqlite";
const DEFAULT_OUT = "outputs/lexicon-fr/strong_lexicon_fr.candidates.jsonl";
const DEFAULT_REPORT = "reports/lexicon-fr-translation-pipeline.md";
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const DEFAULT_REVIEW_MODEL = "anthropic/claude-haiku-4.5";

const LOCKED_TERMS = [
  {
    match: ["H2526"],
    require: ["Cham"],
    forbid: ["jambon"],
    note: "Ham/H2526 est un nom propre biblique: Cham, jamais jambon."
  },
  {
    match: ["H1285", "covenant"],
    require: ["alliance"],
    forbid: [],
    note: "covenant = alliance."
  },
  {
    match: ["H3722", "atonement", "to atone"],
    require: ["expiation", "expier"],
    forbid: [],
    note: "atonement/to atone = expiation/expier; propitiation si le contexte le demande."
  },
  {
    match: ["G2435", "propitiation"],
    require: ["propiti", "expiat"],
    forbid: [],
    note: "G2435 = propitiatoire/expiatoire/propitiation selon le contexte."
  },
  {
    match: ["G3056", "logos", "λόγος", "λόγος"],
    require: ["parole", "mot", "discours", "raison", "Verbe"],
    forbid: ["logo"],
    note: "logos = parole/mot/discours/raison/Verbe selon le contexte, jamais logo."
  },
  {
    match: ["G5485", "grace"],
    require: ["grâce", "faveur"],
    forbid: [],
    note: "charis/grace = grâce/faveur/reconnaissance selon le contexte."
  },
  {
    match: ["H7307", "G4151", "ruach", "pneuma", "spirit"],
    require: ["esprit", "souffle", "vent"],
    forbid: [],
    note: "ruach/pneuma/spirit = esprit/souffle/vent selon le contexte."
  },
  {
    match: ["H3068", "H3069", "Jehovah"],
    require: ["Éternel", "Seigneur", "YHWH", "Yahvé"],
    forbid: [],
    note: "H3068 = nom divin; en français préférer Éternel/Seigneur/YHWH selon usage."
  },
  {
    match: ["righteousness"],
    require: ["justice", "droiture"],
    forbid: [],
    note: "righteousness = justice/droiture selon le contexte."
  }
];

const COMMON_ENGLISH_LEAKS = [
  "covenant",
  "righteousness",
  "atonement",
  "mercy seat",
  "beginning",
  "breath",
  "spirit",
  "word",
  "lord"
];

function parseArgs(): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(rawKey, inlineValue);
      continue;
    }
    const next = process.argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(rawKey, "true");
    } else {
      args.set(rawKey, next);
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
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

function readEntries(dbPath: string): StepEntry[] {
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `select id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
       from StepEntries
       order by language, baseCode, eStrong, dStrong, uStrong`
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 120 }
  );
  return JSON.parse(raw) as StepEntry[];
}

function baseStrong(entry: StepEntry): string {
  const match = /^([GH])(\d{3,5})/.exec(entry.eStrong);
  if (!match) return entry.eStrong;
  return `${match[1]}${match[2].padStart(4, "0")}`;
}

function readLegacyFrenchHints(path: string): Map<string, FrenchHint> {
  const hints = new Map<string, FrenchHint>();
  if (!existsSync(path)) return hints;
  const query = `
    select 'H' || printf('%04d', Code) as strong, LSG as lsg, Definition as definition from Hebreu where Code > 0
    union all
    select 'G' || printf('%04d', Code) as strong, LSG as lsg, Definition as definition from Grec where Code > 0
  `;
  const raw = execFileSync("sqlite3", ["-json", path, query], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80
  });
  for (const row of JSON.parse(raw) as Array<{
    strong: string;
    lsg: string;
    definition: string;
  }>) {
    hints.set(row.strong, {
      lsg: stripHtml(row.lsg ?? ""),
      definition: stripHtml(row.definition ?? "")
        .replace(/\b[GH]\d{3,5}[A-Za-z]?\b/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 900)
    });
  }
  return hints;
}

function readExistingIds(path: string): Set<number> {
  const ids = new Set<number>();
  if (!existsSync(path)) return ids;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as { stepEntryId?: number };
      if (record.stepEntryId) ids.add(record.stepEntryId);
    } catch {
      // Keep going: a partial final line can happen if a previous run was interrupted.
    }
  }
  return ids;
}

async function getModelInfo(apiKey: string): Promise<Map<string, ModelInfo>> {
  const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error(`models-http-${response.status}`);
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
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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

function sourceContainsTerm(sourceText: string, term: string): boolean {
  if (/^[GH]\d{3,5}[A-Za-z]?$/.test(term)) {
    return sourceText.includes(normalize(term));
  }
  return containsWholeTerm(sourceText, term);
}

function meaningHash(entry: StepEntry): string {
  return createHash("sha256")
    .update(`${entry.gloss}\n${entry.meaning}`)
    .digest("hex");
}

function riskScore(entry: StepEntry): number {
  const text = normalize(`${entry.gloss} ${stripHtml(entry.meaning)}`);
  let score = 0;
  if (/^[A-Z][a-z]+$/.test(entry.gloss)) score += 6;
  if (entry.morph.includes("N:N")) score += 4;
  if (entry.gloss.includes(":") || entry.gloss.includes("/")) score += 4;
  if (stripHtml(entry.meaning).length > 900) score += 3;
  for (const term of [
    "god",
    "christ",
    "lord",
    "jehovah",
    "spirit",
    "soul",
    "sin",
    "atonement",
    "propitiation",
    "covenant",
    "righteousness",
    "law",
    "sacrifice",
    "holy",
    "unclean",
    "mercy",
    "name"
  ]) {
    if (text.includes(term)) score += 2;
  }
  for (const locked of LOCKED_TERMS) {
    if (locked.match.some((term) => sourceContainsTerm(text, term))) score += 4;
    if (locked.match.includes(entry.eStrong)) score += 5;
  }
  return score;
}

function selectEntries(options: {
  entries: StepEntry[];
  existingIds: Set<number>;
  limit: number;
  offset: number;
  riskSample: boolean;
  uniqueEStrong: boolean;
  ids?: Set<number>;
}): StepEntry[] {
  const pending = options.entries.filter((entry) => {
    if (options.ids && !options.ids.has(entry.id)) return false;
    return !options.existingIds.has(entry.id);
  });
  const selected = options.riskSample
    ? pending.sort((a, b) => riskScore(b) - riskScore(a) || a.id - b.id)
    : pending;
  const diversified = options.uniqueEStrong
    ? selected.filter((entry, index, all) => {
        return (
          all.findIndex((other) => other.eStrong === entry.eStrong) === index
        );
      })
    : selected;
  return diversified.slice(options.offset, options.offset + options.limit);
}

function applicableGlossary(entries: StepEntry[]): string[] {
  const notes = new Set<string>();
  for (const entry of entries) {
    const text = normalize(
      `${entry.eStrong} ${entry.original} ${entry.transliteration} ${entry.gloss}`
    );
    for (const locked of LOCKED_TERMS) {
      if (locked.match.some((term) => sourceContainsTerm(text, term))) {
        notes.add(locked.note);
      }
    }
  }
  return [...notes];
}

function buildTranslationPrompt(
  entries: StepEntry[],
  frenchHints: Map<string, FrenchHint>
): string {
  return JSON.stringify({
    task: "Traduis en francais des entrees de dictionnaire biblique Strong. Le style doit etre precis, lexicographique, sobre, naturel en francais, et techniquement fiable pour une app Bible.",
    hardRules: [
      "Retourne exactement un item par entree recue.",
      "Conserve exactement id et strong.",
      "Ne traduis jamais les codes Strong, les formes originales grecques/hebraiques, ni les transliterations.",
      "Ne laisse pas de traduction anglaise brute quand un equivalent francais existe.",
      "Pour un nom propre biblique, utilise la forme francaise biblique courante si elle existe.",
      "Si un sens est incertain, traduis prudemment et ajoute un warning.",
      "N'invente pas de sens absent de la source.",
      "Ne mentionne aucun code Strong absent de l'entree source. Si la source indique un Strong suffixe comme H2608T, ne le remplace pas par H2608a.",
      "Ne cree pas de notes etymologiques avec des codes racines si ces codes ne sont pas explicitement dans la source.",
      "Meme si la source est tres courte, meaningFr doit etre une definition explicative francaise suffisante, pas seulement une repetition du glossFr.",
      "Ne reduis pas une entree longue a une seule phrase. Preserve les listes numerotees et les sous-sens importants.",
      "Quand une entree de nom propre contient une description specifique avant le signe § puis une definition generale apres §, traduis les deux parties.",
      "Pour les listes longues de personnes/homonymes, garde la structure numerotee; tu peux raccourcir les formulations mais pas supprimer les personnes majeures."
    ],
    lockedTerminology: applicableGlossary(entries),
    frenchHintsPolicy:
      "Les indices francais viennent d'un ancien dictionnaire local. Utilise-les pour stabiliser les formes francaises courantes, mais ne les copie pas aveuglement et ne les prefere jamais a la source STEP quand il y a conflit.",
    outputSchema: {
      items: [
        {
          id: 14417,
          strong: "H2526",
          glossFr: "Cham",
          meaningFr:
            "Définition française complète, structurée, avec listes numérotées si la source en contient.",
          notesFr: "Notes lexicales ou contextuelles utiles.",
          confidence: 0.92,
          warnings: ["raison si doute, sinon []"],
          lockedTermsApplied: ["Ham/H2526 -> Cham"]
        }
      ]
    },
    expectedIds: entries.map((entry) => entry.id),
    entries: entries.map((entry) => ({
      id: entry.id,
      language: entry.language,
      strong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph,
      glossEn: entry.gloss,
      meaningEn: stripHtml(entry.meaning).slice(0, 7000),
      frenchHint: frenchHints.get(baseStrong(entry)) ?? null
    }))
  });
}

function buildReviewPrompt(
  entry: StepEntry,
  candidate: TranslationCandidate,
  frenchHints: Map<string, FrenchHint>
): string {
  return JSON.stringify({
    task: "Audite une traduction francaise de dictionnaire biblique Strong. Tu dois etre strict: noms propres, terminologie theologique, exactitude lexicale, francais naturel, absence d'anglais residuel.",
    outputSchema: {
      verdict: "accepted ou review_needed",
      score: 0.0,
      issues: ["liste courte"],
      correctedGlossFr: "si correction utile",
      correctedMeaningFr: "si correction utile",
      comment: "court commentaire"
    },
    auditRules: [
      "Les entrees STEP peuvent etre des sous-entrees desambiguisees: eStrong identique mais dStrong/uStrong differents.",
      "Ne reproche pas au candidat de ne pas fusionner toutes les sous-entrees du meme eStrong si la source fournie ne les liste pas.",
      "Si la source fournie contient une liste numerotee ou une section apres §, verifie qu'elle est preservee en francais.",
      "Si le candidat mentionne un code Strong absent de la source fournie, signale-le.",
      "Accepte une traduction compacte si elle garde toutes les informations importantes de la source fournie."
    ],
    lockedTerminology: applicableGlossary([entry]),
    frenchHint: frenchHints.get(baseStrong(entry)) ?? null,
    source: {
      id: entry.id,
      language: entry.language,
      strong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph,
      glossEn: entry.gloss,
      meaningEn: stripHtml(entry.meaning).slice(0, 8000)
    },
    candidate
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

async function callGateway(options: {
  apiKey: string;
  model: string;
  modelInfo?: ModelInfo;
  system: string;
  user: string;
  timeoutMs: number;
}): Promise<GatewayResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const start = performance.now();
  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user }
        ]
      })
    }
  ).finally(() => clearTimeout(timeout));

  const latencyMs = Math.round(performance.now() - start);
  if (!response.ok) {
    throw new Error(
      `ai-gateway-http-${response.status}:${(await response.text()).slice(0, 300)}`
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
  const inputTokens =
    json.usage?.prompt_tokens ?? json.usage?.promptTokens ?? 0;
  const outputTokens =
    json.usage?.completion_tokens ?? json.usage?.completionTokens ?? 0;
  const estimatedCostUsd =
    inputTokens * (options.modelInfo?.inputCostPerToken ?? 0) +
    outputTokens * (options.modelInfo?.outputCostPerToken ?? 0);

  return {
    text: json.choices?.[0]?.message?.content ?? "",
    inputTokens,
    outputTokens,
    latencyMs,
    estimatedCostUsd
  };
}

function parseTranslationItems(text: string): TranslationCandidate[] {
  const parsed = JSON.parse(extractJson(text)) as {
    items?: TranslationCandidate[];
  };
  return (parsed.items ?? []).map(normalizeCandidate);
}

function coerceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(coerceText).filter(Boolean).join(" ");
  if (value == null) return "";
  return String(value);
}

function normalizeCandidate(
  candidate: TranslationCandidate
): TranslationCandidate {
  return {
    id: Number(candidate.id),
    strong: coerceText(candidate.strong),
    glossFr: coerceText(candidate.glossFr),
    meaningFr: coerceText(candidate.meaningFr),
    notesFr: coerceText(candidate.notesFr),
    confidence:
      typeof candidate.confidence === "number"
        ? candidate.confidence
        : Number(candidate.confidence) || 0,
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.map(coerceText)
      : coerceText(candidate.warnings)
        ? [coerceText(candidate.warnings)]
        : [],
    lockedTermsApplied: Array.isArray(candidate.lockedTermsApplied)
      ? candidate.lockedTermsApplied.map(coerceText)
      : coerceText(candidate.lockedTermsApplied)
        ? [coerceText(candidate.lockedTermsApplied)]
        : []
  };
}

function parseReview(text: string): ReviewResult {
  const parsed = JSON.parse(extractJson(text)) as Partial<ReviewResult>;
  return {
    verdict: parsed.verdict === "accepted" ? "accepted" : "review_needed",
    score: typeof parsed.score === "number" ? parsed.score : 0,
    issues: Array.isArray(parsed.issues) ? parsed.issues : ["invalid-review"],
    correctedGlossFr: parsed.correctedGlossFr,
    correctedMeaningFr: parsed.correctedMeaningFr,
    comment: parsed.comment
  };
}

function validateCandidate(
  entry: StepEntry,
  candidate: TranslationCandidate | undefined
): OutputRecord["validation"] {
  const issues: string[] = [];
  let score = 0;
  const maxScore = 14;

  if (!candidate) {
    return { score, maxScore, issues: ["missing-candidate"] };
  }

  if (candidate.id === entry.id) score += 2;
  else issues.push(`id-changed:${candidate.id}`);

  if (isAllowedCandidateStrong(candidate.strong, entry)) score += 2;
  else issues.push(`strong-changed:${candidate.strong}`);

  const gloss = candidate.glossFr?.trim() ?? "";
  const meaning = candidate.meaningFr?.trim() ?? "";
  const notes = candidate.notesFr?.trim() ?? "";
  const combined = `${gloss} ${meaning} ${notes}`;
  const normalized = normalize(combined);

  if (gloss.length >= 2) score += 1;
  else issues.push("missing-gloss-fr");

  if (meaning.length >= 25) score += 2;
  else issues.push("meaning-too-short");

  if (!/<[^>]+>/.test(combined)) score += 1;
  else issues.push("html-leak");

  const sourceText = normalize(
    `${entry.eStrong} ${entry.original} ${entry.transliteration} ${entry.gloss}`
  );
  for (const locked of LOCKED_TERMS) {
    const applies =
      locked.match.includes(entry.eStrong) ||
      locked.match.some((term) => sourceContainsTerm(sourceText, term));
    if (!applies) continue;

    const hasRequired = locked.require.some((term) =>
      normalized.includes(normalize(term))
    );
    if (hasRequired) score += 1;
    else issues.push(`locked-term-missing:${locked.require.join("|")}`);

    for (const forbidden of locked.forbid) {
      if (containsWholeTerm(combined, forbidden)) {
        issues.push(`forbidden-term:${forbidden}`);
      }
    }
  }

  const leaks = COMMON_ENGLISH_LEAKS.filter((term) =>
    containsWholeTerm(combined, term)
  ).filter((term) => {
    if (entry.eStrong === "H3068" && ["lord", "jehovah"].includes(term)) {
      return false;
    }
    return true;
  });
  if (leaks.length === 0) score += 2;
  else issues.push(`english-leak:${leaks.join("|")}`);

  if (
    typeof candidate.confidence === "number" &&
    candidate.confidence >= 0.82
  ) {
    score += 1;
  } else {
    issues.push(`low-confidence:${candidate.confidence ?? "missing"}`);
  }

  const sourceCodes = sourceStrongCodes(entry);
  const outputCodes = combined.match(/[GH]\d{4,5}[A-Za-z]?/g) ?? [];
  const inventedCodes = outputCodes.filter(
    (code) => !isAllowedStrongReference(code, sourceCodes)
  );
  if (inventedCodes.length === 0) score += 1;
  else issues.push(`invented-strong:${[...new Set(inventedCodes)].join("|")}`);

  score = Math.min(score, maxScore);
  return { score, maxScore, issues };
}

function splitStrongCode(
  code: string
): { prefix: string; number: string; suffix: string } | null {
  const match = /^([GH])(\d{3,5})([A-Za-z]?)$/.exec(code);
  if (!match) return null;
  return { prefix: match[1], number: match[2], suffix: match[3] };
}

function sameStrongBase(left: string, right: string): boolean {
  const parsedLeft = splitStrongCode(left);
  const parsedRight = splitStrongCode(right);
  return Boolean(
    parsedLeft &&
    parsedRight &&
    parsedLeft.prefix === parsedRight.prefix &&
    Number.parseInt(parsedLeft.number, 10) ===
      Number.parseInt(parsedRight.number, 10)
  );
}

function sourceStrongCodes(entry: StepEntry): Set<string> {
  const sourceCodes = new Set(
    stripHtml(entry.meaning).match(/[GH]\d{4,5}[A-Za-z]?/g) ?? []
  );
  sourceCodes.add(entry.eStrong);
  for (const code of `${entry.dStrong} ${entry.uStrong}`.match(
    /[GH]\d{3,5}[A-Za-z]?/g
  ) ?? []) {
    sourceCodes.add(code);
  }
  return sourceCodes;
}

function isAllowedCandidateStrong(
  candidateStrong: string,
  entry: StepEntry
): boolean {
  const candidateCode = candidateStrong.trim();
  if (candidateCode === entry.eStrong) return true;
  if (!/^[GH]\d{3,5}[A-Za-z]?$/.test(candidateCode)) return false;

  const dStrongCodes = entry.dStrong.match(/[GH]\d{3,5}[A-Za-z]?/g) ?? [];
  return dStrongCodes.some(
    (sourceCode) =>
      sourceCode === candidateCode &&
      sameStrongBase(candidateCode, entry.eStrong)
  );
}

function isAllowedStrongReference(
  outputCode: string,
  sourceCodes: Set<string>
): boolean {
  if (sourceCodes.has(outputCode)) return true;
  const parsedOutput = splitStrongCode(outputCode);
  if (!parsedOutput || parsedOutput.suffix) return false;
  for (const sourceCode of sourceCodes) {
    const parsedSource = splitStrongCode(sourceCode);
    if (
      parsedSource &&
      parsedSource.prefix === parsedOutput.prefix &&
      parsedSource.number === parsedOutput.number
    ) {
      return true;
    }
  }
  return false;
}

function buildRecord(options: {
  entry: StepEntry;
  candidate: TranslationCandidate | undefined;
  validation: OutputRecord["validation"];
  review?: ReviewResult;
  model: string;
  reviewModel?: string;
  translationGateway: GatewayResult;
  reviewGateway?: GatewayResult;
}): OutputRecord {
  const candidate =
    options.candidate ??
    ({
      id: options.entry.id,
      strong: options.entry.eStrong,
      glossFr: "",
      meaningFr: "",
      notesFr: "",
      confidence: 0,
      warnings: ["missing candidate"],
      lockedTermsApplied: []
    } satisfies TranslationCandidate);

  const reviewNeedsWork = options.review?.verdict === "review_needed";
  const status =
    options.validation.issues.length > 0 || options.validation.score < 12
      ? "invalid"
      : reviewNeedsWork
        ? "review_needed"
        : "accepted";

  return {
    stepEntryId: options.entry.id,
    targetLanguage: "fr",
    status,
    source: {
      language: options.entry.language,
      eStrong: options.entry.eStrong,
      dStrong: options.entry.dStrong,
      uStrong: options.entry.uStrong,
      original: options.entry.original,
      transliteration: options.entry.transliteration,
      morph: options.entry.morph,
      gloss: options.entry.gloss,
      meaningHash: meaningHash(options.entry)
    },
    translation: candidate,
    validation: options.validation,
    review: options.review,
    model: options.model,
    reviewModel: options.reviewModel,
    usage: {
      translationInputTokens: options.translationGateway.inputTokens,
      translationOutputTokens: options.translationGateway.outputTokens,
      reviewInputTokens: options.reviewGateway?.inputTokens ?? 0,
      reviewOutputTokens: options.reviewGateway?.outputTokens ?? 0,
      estimatedCostUsd:
        options.translationGateway.estimatedCostUsd +
        (options.reviewGateway?.estimatedCostUsd ?? 0),
      latencyMs:
        options.translationGateway.latencyMs +
        (options.reviewGateway?.latencyMs ?? 0)
    },
    generatedAt: new Date().toISOString()
  };
}

function appendRecords(outPath: string, records: OutputRecord[]): void {
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  appendFileSync(
    outPath,
    records.map((record) => JSON.stringify(record)).join("\n") + "\n"
  );
}

function readOutputRecords(path: string): OutputRecord[] {
  if (!existsSync(path)) return [];
  const records: OutputRecord[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as OutputRecord);
    } catch {
      // Ignore partial lines.
    }
  }
  return records;
}

function renderReport(records: OutputRecord[], selectedCount: number): string {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
  }
  const cost = records.reduce(
    (sum, record) => sum + record.usage.estimatedCostUsd,
    0
  );
  const latency = records.reduce(
    (sum, record) => sum + record.usage.latencyMs,
    0
  );
  const issueCounts = new Map<string, number>();
  for (const record of records) {
    for (const issue of [
      ...record.validation.issues,
      ...(record.review?.issues ?? []).map((issue) => `review:${issue}`)
    ]) {
      const key = issue.split(":")[0];
      issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
    }
  }

  const lines = [
    "# French Lexicon Translation Pipeline",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Records in output: ${records.length}`,
    `- Entries selected in latest run: ${selectedCount}`,
    `- Accepted: ${counts.get("accepted") ?? 0}`,
    `- Review needed: ${counts.get("review_needed") ?? 0}`,
    `- Invalid: ${counts.get("invalid") ?? 0}`,
    `- Estimated cost in output: $${cost.toFixed(4)}`,
    `- Accumulated latency: ${(latency / 1000).toFixed(1)}s`,
    "",
    "## Issue Counts",
    "",
    "| Issue | Count |",
    "| --- | ---: |"
  ];

  for (const [issue, count] of [...issueCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )) {
    lines.push(`| ${issue} | ${count} |`);
  }

  const problematic = records
    .filter((record) => record.status !== "accepted")
    .slice(0, 30);
  lines.push("", "## First Problems", "");
  if (problematic.length === 0) {
    lines.push("No problems in current output.");
  } else {
    lines.push(
      "| Strong | Source | Status | Issues | Candidate |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const record of problematic) {
      lines.push(
        `| ${record.source.eStrong} | ${record.source.gloss.replace(/\|/g, "/")} | ${record.status} | ${[
          ...record.validation.issues,
          ...(record.review?.issues ?? []).map((issue) => `review:${issue}`)
        ]
          .join(", ")
          .replace(
            /\|/g,
            "/"
          )} | ${record.translation.glossFr.replace(/\|/g, "/")} |`
      );
    }
  }

  lines.push("", "## Sample Accepted", "");
  lines.push(
    "| Strong | Source | French gloss | French meaning |",
    "| --- | --- | --- | --- |"
  );
  for (const record of records
    .filter((item) => item.status === "accepted")
    .slice(0, 20)) {
    lines.push(
      `| ${record.source.eStrong} | ${record.source.gloss.replace(/\|/g, "/")} | ${record.translation.glossFr.replace(/\|/g, "/")} | ${record.translation.meaningFr.slice(0, 180).replace(/\s+/g, " ").replace(/\|/g, "/")} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

async function reviewCandidate(options: {
  apiKey: string;
  entry: StepEntry;
  candidate: TranslationCandidate;
  model: string;
  modelInfo?: ModelInfo;
  timeoutMs: number;
  frenchHints: Map<string, FrenchHint>;
}): Promise<{ review: ReviewResult; gateway: GatewayResult }> {
  const gateway = await callGateway({
    apiKey: options.apiKey,
    model: options.model,
    modelInfo: options.modelInfo,
    timeoutMs: options.timeoutMs,
    system:
      "Tu es un reviseur de lexique biblique francophone. Tu dois auditer strictement, repondre uniquement en JSON valide, et ne jamais inventer.",
    user: buildReviewPrompt(
      options.entry,
      options.candidate,
      options.frenchHints
    )
  });
  return { review: parseReview(gateway.text), gateway };
}

async function translateBatch(options: {
  apiKey: string;
  entries: StepEntry[];
  model: string;
  modelInfo?: ModelInfo;
  reviewModel?: string;
  reviewModelInfo?: ModelInfo;
  review: boolean;
  timeoutMs: number;
  frenchHints: Map<string, FrenchHint>;
}): Promise<OutputRecord[]> {
  const translationGateway = await callGateway({
    apiKey: options.apiKey,
    model: options.model,
    modelInfo: options.modelInfo,
    timeoutMs: options.timeoutMs,
    system:
      "Tu es un lexicographe biblique francophone expert en grec, hebreu, Strong et terminologie theologique. Reponds uniquement en JSON valide.",
    user: buildTranslationPrompt(options.entries, options.frenchHints)
  });
  const candidates = parseTranslationItems(translationGateway.text);
  const byId = new Map(
    candidates.map((candidate) => [candidate.id, candidate])
  );
  const records: OutputRecord[] = [];

  for (const entry of options.entries) {
    const candidate = byId.get(entry.id);
    const validation = validateCandidate(entry, candidate);
    let review: ReviewResult | undefined;
    let reviewGateway: GatewayResult | undefined;

    if (options.review && candidate && options.reviewModel) {
      const shouldReview =
        validation.issues.length > 0 ||
        validation.score < 14 ||
        candidate.confidence < 0.9 ||
        riskScore(entry) >= 10;
      if (shouldReview) {
        const result = await reviewCandidate({
          apiKey: options.apiKey,
          entry,
          candidate,
          model: options.reviewModel,
          modelInfo: options.reviewModelInfo,
          timeoutMs: options.timeoutMs,
          frenchHints: options.frenchHints
        });
        review = result.review;
        reviewGateway = result.gateway;
      }
    }

    records.push(
      buildRecord({
        entry,
        candidate,
        validation,
        review,
        model: options.model,
        reviewModel: options.review ? options.reviewModel : undefined,
        translationGateway,
        reviewGateway
      })
    );
  }

  return records;
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs();
  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("missing AI_GATEWAY_KEY or AI_GATEWAY_API_KEY");

  const dbPath = args.get("db") ?? DEFAULT_DB;
  const legacyFrDbPath = args.get("legacy-fr-db") ?? DEFAULT_LEGACY_FR_DB;
  const outPath = args.get("out") ?? DEFAULT_OUT;
  const reportPath = args.get("report") ?? DEFAULT_REPORT;
  const model = args.get("model") ?? DEFAULT_MODEL;
  const review = args.get("review") === "true";
  const reviewModel = args.get("review-model") ?? DEFAULT_REVIEW_MODEL;
  const batchSize = Number.parseInt(args.get("batch-size") ?? "8", 10);
  const limit = Number.parseInt(args.get("limit") ?? "40", 10);
  const offset = Number.parseInt(args.get("offset") ?? "0", 10);
  const riskSample = args.get("risk-sample") !== "false";
  const uniqueEStrong = args.get("unique-estrong") === "true";
  const ids = args.get("ids")
    ? new Set(
        args
          .get("ids")
          ?.split(",")
          .map((id) => Number.parseInt(id.trim(), 10))
          .filter((id) => Number.isFinite(id))
      )
    : undefined;
  const timeoutMs = Number.parseInt(
    args.get("timeout-ms") ?? process.env.AI_GATEWAY_TIMEOUT_MS ?? "120000",
    10
  );

  const entries = readEntries(dbPath);
  const frenchHints = readLegacyFrenchHints(legacyFrDbPath);
  const existingIds = readExistingIds(outPath);
  const selected = selectEntries({
    entries,
    existingIds,
    limit,
    offset,
    riskSample,
    uniqueEStrong,
    ids
  });

  if (selected.length === 0) {
    console.log("No pending entries selected.");
    return;
  }

  const modelInfo = await getModelInfo(apiKey);
  console.log(
    `Selected ${selected.length} entries; model=${model}; review=${review ? reviewModel : "off"}; out=${outPath}`
  );

  for (let index = 0; index < selected.length; index += batchSize) {
    const batch = selected.slice(index, index + batchSize);
    console.log(
      `batch ${Math.floor(index / batchSize) + 1}/${Math.ceil(
        selected.length / batchSize
      )}: ${batch.map((entry) => entry.eStrong).join(", ")}`
    );
    const records = await translateBatch({
      apiKey,
      entries: batch,
      model,
      modelInfo: modelInfo.get(model),
      reviewModel,
      reviewModelInfo: modelInfo.get(reviewModel),
      review,
      timeoutMs,
      frenchHints
    });
    appendRecords(outPath, records);
  }

  const allRecords = readOutputRecords(outPath);
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  writeFileSync(reportPath, renderReport(allRecords, selected.length));
  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
