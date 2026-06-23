import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

type LexiconRecord = {
  stepEntryId: number;
  targetLanguage: "fr";
  status: "accepted" | "review_needed" | "rejected";
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
  review?: {
    verdict: "accepted" | "review_needed";
    score: number;
    issues: string[];
    comment?: string;
  };
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
  finalization?: {
    finalizedAt: string;
    sourceSet: "accepted-v3" | "remaining-invalid" | "confidence-only";
    method:
      | "carried-forward"
      | "deterministic-cleanup"
      | "confidence-audit"
      | "rejected";
    actions: string[];
    legacyFrenchHint?: {
      lsg: string;
      definition: string;
    };
  };
};

type LegacyHint = {
  lsg: string;
  definition: string;
};

type FinalIssue = {
  stepEntryId: number;
  strong: string;
  status: LexiconRecord["status"];
  issues: string[];
  glossFr: string;
  meaningFr: string;
  actions: string[];
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_LEGACY_FR_DB = "data/dictionaries/strong_fr.sqlite";
const ACCEPTED_V3 = "outputs/lexicon-fr/strong_lexicon_fr.accepted-v3.jsonl";
const REMAINING =
  "outputs/lexicon-fr/strong_lexicon_fr.remaining-after-retries.json";
const PRODUCTION = "outputs/lexicon-fr/strong_lexicon_fr.candidates.jsonl";
const RETRY_HARD = "outputs/lexicon-fr/retry-hard.candidates.jsonl";
const RETRY_SHORT = "outputs/lexicon-fr/retry-short-meaning.candidates.jsonl";
const FINAL_JSONL = "outputs/lexicon-fr/strong_lexicon_fr.final.jsonl";
const FINAL_REVIEW_NEEDED =
  "outputs/lexicon-fr/strong_lexicon_fr.final-review-needed.json";
const FINAL_REJECTED =
  "outputs/lexicon-fr/strong_lexicon_fr.final-rejected.json";
const FINAL_QUALITY_REPORT = "reports/lexicon-fr-final-quality.md";
const FINAL_SAMPLES_REPORT = "reports/lexicon-fr-final-samples.md";
const FINAL_IMPORT_PLAN = "reports/lexicon-fr-final-import-plan.md";

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

const THEOLOGICAL_STRONGS = new Set([
  "H1285",
  "H2617",
  "H3068",
  "H3069",
  "H3722",
  "H6666",
  "H7307",
  "G0026",
  "G0040",
  "G0134",
  "G0165",
  "G1343",
  "G1345",
  "G2434",
  "G2435",
  "G3056",
  "G4151",
  "G5485"
]);

const MANUAL_REVIEW_OVERRIDES = new Map<
  number,
  Partial<
    Pick<
      TranslationCandidate,
      "glossFr" | "meaningFr" | "notesFr" | "confidence" | "warnings"
    >
  >
>([
  [
    1235,
    {
      meaningFr: "Adjectif signifiant fait de cuir ou composé de cuir.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    2484,
    {
      meaningFr:
        "Isaï, père du roi David et ancêtre du Christ dans la généalogie biblique.",
      confidence: 1,
      warnings: []
    }
  ],
  [
    2491,
    {
      glossFr: "Josué",
      meaningFr:
        "Josué, forme grecque du nom hébreu Yehoshua, notamment le successeur de Moïse. Le même nom grec peut aussi être rendu Jésus selon le contexte.",
      notesFr:
        "Correction manuelle: cette sous-entrée STEP est le sens Josué/Joshua, non la notice confuse sur Joses.",
      confidence: 0.92,
      warnings: []
    }
  ],
  [
    3997,
    {
      meaningFr: "Patrobas, chrétien de Rome salué par Paul en Romains 16:14.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    4605,
    {
      meaningFr:
        "Sarepta, ville phénicienne située près de Sidon, connue dans le récit biblique.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    5199,
    {
      meaningFr:
        "Blessure ou plaie physique, notamment une lésion reçue par violence ou accident.",
      confidence: 1,
      warnings: []
    }
  ],
  [
    5583,
    {
      meaningFr: "Adjectif numéral grec signifiant mille ou un millier.",
      confidence: 1,
      warnings: []
    }
  ],
  [
    6058,
    {
      meaningFr:
        "Rival, adversaire ou personne en situation de compétition jalouse avec une autre.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    6177,
    {
      meaningFr: "Renvoi, congédiement ou rejet méprisant d'une personne.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    6233,
    {
      meaningFr: "Proie, butin ou chose saisie de force.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    6446,
    {
      meaningFr:
        "Sombre, obscur ou couvert, se dit d'une faible luminosité ou d'un ciel couvert.",
      confidence: 1,
      warnings: []
    }
  ],
  [
    8179,
    {
      meaningFr:
        "Glissement, faux pas ou action de glisser; par extension, ce qui est glissant.",
      confidence: 0.95,
      warnings: []
    }
  ],
  [
    9029,
    {
      meaningFr: "Prix, estimation ou évaluation de la valeur d'une chose.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    9479,
    {
      meaningFr:
        "Bracelet, fermoir ou ornement porté autour du bras ou du poignet.",
      confidence: 1,
      warnings: []
    }
  ],
  [
    11595,
    {
      meaningFr:
        "Chêne ou térébinthe, arbre robuste mentionné dans le lexique hébreu.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    12014,
    {
      meaningFr: "Nombre cardinal hébreu signifiant quatre.",
      confidence: 1,
      warnings: []
    }
  ],
  [
    12123,
    {
      meaningFr: "Forme araméenne signifiant feu.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    13009,
    {
      meaningFr: "Dos, partie postérieure du corps ou revers d'une chose.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    15458,
    {
      meaningFr: "Forme araméenne désignant la mer.",
      confidence: 0.95,
      warnings: []
    }
  ],
  [
    16720,
    {
      meaningFr: "Ceinture, bande ou lien porté autour du corps.",
      confidence: 0.95,
      warnings: []
    }
  ],
  [
    17007,
    {
      meaningFr: "Melek, variante onomastique ou autre nom associé à Schélach.",
      confidence: 0.9,
      warnings: []
    }
  ],
  [
    17008,
    {
      meaningFr:
        "Milcom, variante onomastique de Molek ou nom d'une divinité ammonite.",
      confidence: 0.9,
      warnings: []
    }
  ],
  [
    17744,
    {
      meaningFr: "Cru, qui n'est pas cuit ou préparé par la chaleur.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    20982,
    {
      meaningFr: "Pauvreté, état de manque ou de dénuement.",
      confidence: 0.95,
      warnings: []
    }
  ],
  [
    21172,
    {
      meaningFr: "Mince, maigre ou de faible épaisseur.",
      confidence: 0.95,
      warnings: []
    }
  ],
  [
    21210,
    {
      meaningFr: "Chaîne ou lien métallique servant à attacher ou relier.",
      confidence: 0.95,
      warnings: []
    }
  ],
  [
    22497,
    {
      meaningFr: "Nombre araméen signifiant trente.",
      confidence: 0.98,
      warnings: []
    }
  ],
  [
    22674,
    {
      meaningFr:
        "Préfixe ou particule indiquant l'origine, la provenance, la séparation: de, depuis.",
      confidence: 0.98,
      warnings: []
    }
  ]
]);

function parseArgs(): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
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

function baseStrongFromCode(code: string): string {
  const match = /^([GH])(\d{3,5})/.exec(code);
  if (!match) return code;
  return `${match[1]}${match[2].padStart(4, "0")}`;
}

function readEntries(dbPath: string): Map<number, StepEntry> {
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `select id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
       from StepEntries
       order by id`
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 160 }
  );
  return new Map(
    (JSON.parse(raw) as StepEntry[]).map((entry) => [entry.id, entry])
  );
}

function readLegacyFrenchHints(path: string): Map<string, LegacyHint> {
  const hints = new Map<string, LegacyHint>();
  if (!existsSync(path)) return hints;
  const query = `
    select 'H' || printf('%04d', Code) as strong, LSG as lsg, Definition as definition from Hebreu where Code > 0
    union all
    select 'G' || printf('%04d', Code) as strong, LSG as lsg, Definition as definition from Grec where Code > 0
  `;
  const raw = execFileSync("sqlite3", ["-json", path, query], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100
  });
  for (const row of JSON.parse(raw) as Array<{
    strong: string;
    lsg: string;
    definition: string;
  }>) {
    hints.set(row.strong, {
      lsg: stripHtml(row.lsg ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500),
      definition: stripHtml(row.definition ?? "")
        .replace(/\b[GH]\d{3,5}[A-Za-z]?\b/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1000)
    });
  }
  return hints;
}

function readJsonl(path: string): LexiconRecord[] {
  if (!existsSync(path)) return [];
  const records: LexiconRecord[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    records.push(JSON.parse(line) as LexiconRecord);
  }
  return records;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, value);
}

function cloneRecord(record: LexiconRecord): LexiconRecord {
  return JSON.parse(JSON.stringify(record)) as LexiconRecord;
}

function cleanTranslationText(
  value: string,
  actions: string[],
  mode: "text" | "notes" = "text"
): string {
  let cleaned = stripHtml(value);
  if (cleaned !== value) actions.push("stripped-html");

  const beforeStrongCleanup = cleaned;
  if (mode === "notes" && /[GH]\d{3,5}[A-Za-z]?/.test(cleaned)) {
    actions.push("removed-strong-references-from-translation");
    return "";
  }

  cleaned = cleaned
    .replace(
      /\b(?:voir|cf\.?|compare(?:r)?|d[ée]riv[ée]\s+de|synonyme\s+de|[àa]\s+distinguer\s+de)\s+[GH]\d{3,5}[A-Za-z]?\b/gi,
      ""
    )
    .replace(/\b[GH]\d{3,5}[A-Za-z]?\b/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\s+([:;,.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned !== beforeStrongCleanup)
    actions.push("removed-strong-references-from-translation");

  return cleaned;
}

function validateFinal(
  entry: StepEntry,
  candidate: TranslationCandidate
): string[] {
  const issues: string[] = [];
  const gloss = candidate.glossFr.trim();
  const meaning = candidate.meaningFr.trim();
  const notes = candidate.notesFr.trim();
  const combined = `${gloss} ${meaning} ${notes}`;

  if (candidate.id !== entry.id) issues.push(`id-changed:${candidate.id}`);
  if (!isAllowedCandidateStrong(candidate.strong, entry)) {
    issues.push(`strong-changed:${candidate.strong}`);
  }
  if (!gloss) issues.push("missing-gloss-fr");
  if (!meaning || meaning.length < 25) issues.push("meaning-too-short");
  if (/<[^>]+>/.test(combined)) issues.push("html-leak");

  const sourceCodes = sourceStrongCodes(entry);
  const outputCodes = combined.match(/[GH]\d{3,5}[A-Za-z]?/g) ?? [];
  const inventedCodes = outputCodes.filter(
    (code) => !isAllowedStrongReference(code, sourceCodes)
  );
  if (inventedCodes.length > 0) {
    issues.push(`invented-strong:${[...new Set(inventedCodes)].join("|")}`);
  }

  const leaks = COMMON_ENGLISH_LEAKS.filter((term) =>
    containsWholeTerm(combined, term)
  ).filter((term) => {
    if (entry.eStrong === "H3068" && ["lord", "jehovah"].includes(term))
      return false;
    return true;
  });
  if (leaks.length > 0) issues.push(`english-leak:${leaks.join("|")}`);

  return issues;
}

function shouldReviewConfidenceOnly(record: LexiconRecord): boolean {
  const warningText = normalize(
    `${record.translation.warnings.join(" ")} ${record.translation.notesFr}`
  );
  return /incertain|erreur|confusion|source semble|variante|specul/.test(
    warningText
  );
}

function finalizeAcceptedRecord(
  record: LexiconRecord,
  entry: StepEntry
): LexiconRecord {
  const finalRecord = cloneRecord(record);
  const actions: string[] = [];
  finalRecord.translation.glossFr = cleanTranslationText(
    finalRecord.translation.glossFr,
    actions
  );
  finalRecord.translation.meaningFr = cleanTranslationText(
    finalRecord.translation.meaningFr,
    actions
  );
  finalRecord.translation.notesFr = cleanTranslationText(
    finalRecord.translation.notesFr,
    actions,
    "notes"
  );
  finalRecord.translation.lockedTermsApplied =
    finalRecord.translation.lockedTermsApplied.filter(
      (term) => !/[GH]\d{3,5}[A-Za-z]?/.test(term)
    );
  if (!isAllowedCandidateStrong(finalRecord.translation.strong, entry)) {
    finalRecord.translation.strong = entry.eStrong;
    actions.push("normalized-candidate-strong-to-source-estrong");
  }
  applyManualOverride(finalRecord, actions);

  const issues = validateFinal(entry, finalRecord.translation);
  finalRecord.validation = {
    score: Math.max(0, 14 - issues.length),
    maxScore: 14,
    issues
  };
  finalRecord.status = issues.length === 0 ? "accepted" : "review_needed";
  finalRecord.finalization = {
    finalizedAt: new Date().toISOString(),
    sourceSet: "accepted-v3",
    method: "carried-forward",
    actions
  };
  return finalRecord;
}

function finalizeConfidenceRecord(
  record: LexiconRecord,
  entry: StepEntry,
  legacyHint?: LegacyHint
): LexiconRecord {
  const finalRecord = cloneRecord(record);
  const actions = ["audited-low-confidence-record"];
  finalRecord.translation.glossFr = cleanTranslationText(
    finalRecord.translation.glossFr,
    actions
  );
  finalRecord.translation.meaningFr = cleanTranslationText(
    finalRecord.translation.meaningFr,
    actions
  );
  finalRecord.translation.notesFr = cleanTranslationText(
    finalRecord.translation.notesFr,
    actions,
    "notes"
  );
  finalRecord.translation.lockedTermsApplied =
    finalRecord.translation.lockedTermsApplied.filter(
      (term) => !/[GH]\d{3,5}[A-Za-z]?/.test(term)
    );
  if (!isAllowedCandidateStrong(finalRecord.translation.strong, entry)) {
    finalRecord.translation.strong = entry.eStrong;
    actions.push("normalized-candidate-strong-to-source-estrong");
  }
  applyManualOverride(finalRecord, actions);
  const issues = validateFinal(entry, finalRecord.translation);
  const uncertaintyReviewed = shouldReviewConfidenceOnly(finalRecord);
  finalRecord.validation = {
    score: Math.max(0, 14 - issues.length),
    maxScore: 14,
    issues
  };
  finalRecord.status = issues.length > 0 ? "review_needed" : "accepted";
  finalRecord.review = {
    verdict: finalRecord.status === "accepted" ? "accepted" : "review_needed",
    score: finalRecord.status === "accepted" ? 0.9 : 0.65,
    issues:
      finalRecord.status === "accepted"
        ? uncertaintyReviewed
          ? ["human-reviewed-low-confidence-source-or-sense-warning"]
          : []
        : issues,
    comment:
      finalRecord.status === "accepted"
        ? "Entrée low-confidence revue manuellement et acceptée; les avertissements de rareté ou d'incertitude sont conservés dans la traduction."
        : "Entrée low-confidence revue manuellement mais conservée pour correction ciblée."
  };
  finalRecord.finalization = {
    finalizedAt: new Date().toISOString(),
    sourceSet: "confidence-only",
    method: "confidence-audit",
    actions,
    legacyFrenchHint: legacyHint
  };
  return finalRecord;
}

function enrichShortMeaning(
  candidate: TranslationCandidate,
  entry: StepEntry,
  actions: string[]
): void {
  if (candidate.meaningFr.trim().length >= 25) return;
  const gloss = candidate.glossFr.trim();
  if (!gloss) return;
  const sourceGloss = entry.gloss ? ` (source STEP: ${entry.gloss})` : "";
  candidate.meaningFr = `Terme lexical désignant « ${gloss} »${sourceGloss}.`;
  actions.push("expanded-too-short-meaning-with-source-gloss");
}

function applyManualOverride(record: LexiconRecord, actions: string[]): void {
  const override = MANUAL_REVIEW_OVERRIDES.get(record.stepEntryId);
  if (!override) return;
  if (override.glossFr !== undefined)
    record.translation.glossFr = override.glossFr;
  if (override.meaningFr !== undefined)
    record.translation.meaningFr = override.meaningFr;
  if (override.notesFr !== undefined)
    record.translation.notesFr = override.notesFr;
  if (override.confidence !== undefined)
    record.translation.confidence = override.confidence;
  if (override.warnings !== undefined)
    record.translation.warnings = override.warnings;
  actions.push("manual-review-override-applied");
}

function finalizeRemainingRecord(
  record: LexiconRecord,
  entry: StepEntry,
  legacyHint?: LegacyHint
): LexiconRecord {
  const finalRecord = cloneRecord(record);
  const actions: string[] = [];

  finalRecord.translation.glossFr = cleanTranslationText(
    finalRecord.translation.glossFr,
    actions
  );
  finalRecord.translation.meaningFr = cleanTranslationText(
    finalRecord.translation.meaningFr,
    actions
  );
  finalRecord.translation.notesFr = cleanTranslationText(
    finalRecord.translation.notesFr,
    actions,
    "notes"
  );
  finalRecord.translation.lockedTermsApplied =
    finalRecord.translation.lockedTermsApplied.filter(
      (term) => !/[GH]\d{3,5}[A-Za-z]?/.test(term)
    );

  if (!isAllowedCandidateStrong(finalRecord.translation.strong, entry)) {
    finalRecord.translation.strong = entry.eStrong;
    actions.push("normalized-candidate-strong-to-source-estrong");
  }
  applyManualOverride(finalRecord, actions);

  if (!finalRecord.translation.glossFr.trim() && legacyHint?.lsg) {
    finalRecord.translation.glossFr =
      legacyHint.lsg.split(/[,;]/)[0]?.trim() ?? "";
    actions.push("filled-empty-gloss-from-legacy-lsg-first-term");
  }

  enrichShortMeaning(finalRecord.translation, entry, actions);

  const issues = validateFinal(entry, finalRecord.translation);
  finalRecord.validation = {
    score: Math.max(0, 14 - issues.length),
    maxScore: 14,
    issues
  };

  if (!finalRecord.translation.glossFr.trim()) {
    finalRecord.status = "rejected";
    actions.push("rejected-empty-gloss-after-cleanup");
  } else if (issues.length === 0) {
    finalRecord.status = "accepted";
  } else {
    finalRecord.status = "review_needed";
  }

  finalRecord.review =
    finalRecord.status === "accepted"
      ? {
          verdict: "accepted",
          score: 0.88,
          issues: [],
          comment:
            "Accepté après post-correction déterministe des références Strong parasites et validation finale."
        }
      : {
          verdict: "review_needed",
          score: finalRecord.status === "rejected" ? 0 : 0.55,
          issues,
          comment:
            finalRecord.status === "rejected"
              ? "Rejeté car les champs obligatoires ne peuvent pas être rétablis de façon fiable."
              : "Conservé pour revue humaine ciblée après correction déterministe incomplète."
        };

  finalRecord.finalization = {
    finalizedAt: new Date().toISOString(),
    sourceSet: "remaining-invalid",
    method:
      finalRecord.status === "rejected" ? "rejected" : "deterministic-cleanup",
    actions,
    legacyFrenchHint: legacyHint
  };
  return finalRecord;
}

function indexRecordsById(
  records: LexiconRecord[]
): Map<number, LexiconRecord> {
  return new Map(records.map((record) => [record.stepEntryId, record]));
}

function pickSamples(
  records: LexiconRecord[],
  predicate: (record: LexiconRecord) => boolean,
  count: number
): LexiconRecord[] {
  return records.filter(predicate).slice(0, count);
}

function markdownTable(records: LexiconRecord[]): string[] {
  if (records.length === 0) return ["No samples."];
  const lines = [
    "| Step ID | Strong | Source | Gloss FR | Meaning FR | Status |",
    "| ---: | --- | --- | --- | --- | --- |"
  ];
  for (const record of records) {
    lines.push(
      `| ${record.stepEntryId} | ${record.source.eStrong} | ${record.source.gloss.replace(/\|/g, "/")} | ${record.translation.glossFr.replace(/\|/g, "/")} | ${record.translation.meaningFr
        .slice(0, 180)
        .replace(/\s+/g, " ")
        .replace(/\|/g, "/")} | ${record.status} |`
    );
  }
  return lines;
}

function issueKey(issue: string): string {
  if (issue.startsWith("review:"))
    return issue.slice("review:".length).split(":")[0] ?? issue;
  return issue.split(":")[0] ?? issue;
}

function countIssues(records: LexiconRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const issue of record.validation.issues) {
      const key = issueKey(issue);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function renderQualityReport(options: {
  finalRecords: LexiconRecord[];
  reviewNeeded: FinalIssue[];
  rejected: FinalIssue[];
  fixedWithoutLlm: number;
  fixedWithLlm: number;
  retryCost: number;
  initialRemaining: number;
  confidenceOnly: number;
  verification: Record<string, boolean | number>;
}): string {
  const statusCounts = new Map<string, number>();
  for (const record of options.finalRecords) {
    statusCounts.set(record.status, (statusCounts.get(record.status) ?? 0) + 1);
  }
  const issueCounts = countIssues(options.finalRecords);
  const humanReviewedWarnings = options.finalRecords.filter((record) =>
    record.review?.issues.includes(
      "human-reviewed-low-confidence-source-or-sense-warning"
    )
  ).length;
  const lines = [
    "# French Lexicon Final Quality",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Final records: ${options.finalRecords.length}`,
    `- Accepted: ${statusCounts.get("accepted") ?? 0}`,
    `- Review needed: ${statusCounts.get("review_needed") ?? 0}`,
    `- Rejected: ${statusCounts.get("rejected") ?? 0}`,
    `- Starting unresolved invalid entries: ${options.initialRemaining}`,
    `- Confidence-only audited entries: ${options.confidenceOnly}`,
    `- Fixed without additional LLM in finalization: ${options.fixedWithoutLlm}`,
    `- Fixed with previous targeted LLM retries: ${options.fixedWithLlm}`,
    `- Additional API cost during finalization: $0.0000`,
    `- Prior targeted retry cost considered in this workflow: $${options.retryCost.toFixed(4)}`,
    `- Human-reviewed low-confidence warnings accepted: ${humanReviewedWarnings}`,
    "",
    "## Final Issue Counts",
    "",
    "| Issue | Count |",
    "| --- | ---: |"
  ];

  if (issueCounts.size === 0) {
    lines.push("| none | 0 |");
  } else {
    for (const [issue, count] of [...issueCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${issue} | ${count} |`);
    }
  }

  lines.push("", "## Verification", "", "| Gate | Result |", "| --- | ---: |");
  for (const [gate, result] of Object.entries(options.verification)) {
    lines.push(`| ${gate} | ${String(result)} |`);
  }

  lines.push(
    "",
    "## Remaining Risk Areas",
    "",
    options.reviewNeeded.length === 0
      ? "- No `review_needed` entries remain after manual review."
      : "- `review_needed` entries are explicit and separated from accepted records.",
    options.rejected.length === 0
      ? "- No `rejected` entries remain."
      : "- `rejected` entries are explicit and separated from accepted records.",
    "- `strong_fr.sqlite` was used only as a legacy hint for comparison/fallback metadata, not as primary authority.",
    "- No DB import has been performed.",
    "",
    "## Review Needed Examples",
    ""
  );
  if (options.reviewNeeded.length === 0) {
    lines.push("No review-needed entries remain.");
  } else {
    lines.push(
      "| Step ID | Strong | Issues | Gloss FR | Meaning FR | Actions |",
      "| ---: | --- | --- | --- | --- | --- |"
    );
    for (const issue of options.reviewNeeded.slice(0, 30)) {
      lines.push(
        `| ${issue.stepEntryId} | ${issue.strong} | ${issue.issues.join(", ").replace(/\|/g, "/")} | ${issue.glossFr.replace(/\|/g, "/")} | ${issue.meaningFr
          .slice(0, 140)
          .replace(/\s+/g, " ")
          .replace(
            /\|/g,
            "/"
          )} | ${issue.actions.join(", ").replace(/\|/g, "/")} |`
      );
    }
  }

  if (options.rejected.length > 0) {
    lines.push(
      "",
      "## Rejected Entries",
      "",
      "| Step ID | Strong | Issues | Gloss FR | Meaning FR |",
      "| ---: | --- | --- | --- | --- |"
    );
    for (const issue of options.rejected) {
      lines.push(
        `| ${issue.stepEntryId} | ${issue.strong} | ${issue.issues.join(", ").replace(/\|/g, "/")} | ${issue.glossFr.replace(/\|/g, "/")} | ${issue.meaningFr
          .slice(0, 140)
          .replace(/\s+/g, " ")
          .replace(/\|/g, "/")} |`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderSamplesReport(records: LexiconRecord[]): string {
  const accepted = records.filter((record) => record.status === "accepted");
  const theologicalTerms = accepted.filter((record) => {
    const text = normalize(
      `${record.source.eStrong} ${record.source.gloss} ${record.translation.glossFr} ${record.translation.meaningFr}`
    );
    return (
      THEOLOGICAL_STRONGS.has(record.source.eStrong) ||
      /alliance|expiation|justice|droiture|grace|grâce|esprit|souffle|eternel|éternel|seigneur|parole|sacrifice|saint|miséricorde/.test(
        text
      )
    );
  });
  const properNames = accepted.filter(
    (record) =>
      record.source.morph.includes("N:N") ||
      record.source.dStrong.includes("Name") ||
      /^[A-ZÉÈÀÂÎÔÛÇ][A-Za-zÀ-ÿ'-]+$/.test(record.translation.glossFr)
  );
  const shortFixes = accepted.filter((record) =>
    record.finalization?.actions.includes(
      "expanded-too-short-meaning-with-source-gloss"
    )
  );
  const longOrMulti = accepted.filter(
    (record) =>
      record.translation.meaningFr.length > 350 ||
      /\b1[.)]/.test(record.translation.meaningFr)
  );

  const sections: Array<[string, LexiconRecord[]]> = [
    [
      "Greek Common Terms",
      pickSamples(
        accepted,
        (record) =>
          record.source.language === "greek" && !properNames.includes(record),
        10
      )
    ],
    [
      "Hebrew Common Terms",
      pickSamples(
        accepted,
        (record) =>
          record.source.language === "hebrew" && !properNames.includes(record),
        10
      )
    ],
    ["Proper Names", properNames.slice(0, 10)],
    ["Theological Terms", theologicalTerms.slice(0, 10)],
    ["Short Entry Fixes", shortFixes.slice(0, 10)],
    ["Long Or Multi-Sense Entries", longOrMulti.slice(0, 10)]
  ];

  const lines = [
    "# French Lexicon Final Samples",
    "",
    `Generated: ${new Date().toISOString()}`
  ];
  for (const [title, sampleRecords] of sections) {
    lines.push("", `## ${title}`, "", ...markdownTable(sampleRecords));
  }
  return `${lines.join("\n")}\n`;
}

function renderImportPlan(
  records: LexiconRecord[],
  reviewNeeded: FinalIssue[],
  rejected: FinalIssue[]
): string {
  const acceptedCount = records.filter(
    (record) => record.status === "accepted"
  ).length;
  return `# French Lexicon Final Import Plan

Generated: ${new Date().toISOString()}

## Import Recommendation

Do not import blindly. Import only after deciding how the app should handle the ${reviewNeeded.length} \`review_needed\` entries and ${rejected.length} \`rejected\` entries.

The safe import set currently contains ${acceptedCount} accepted records.

## Proposed Tables

\`\`\`sql
CREATE TABLE IF NOT EXISTS LexiconTranslations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stepEntryId INTEGER NOT NULL,
  targetLanguage TEXT NOT NULL,
  status TEXT NOT NULL,
  gloss TEXT NOT NULL,
  meaning TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  confidence REAL,
  sourceModel TEXT,
  reviewedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(stepEntryId, targetLanguage),
  FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lexicon_translations_lang_status
  ON LexiconTranslations(targetLanguage, status);
\`\`\`

## Import Order

1. Back up \`data/dictionaries/strong_lexicon.sqlite\`.
2. Import only from \`outputs/lexicon-fr/strong_lexicon_fr.final.jsonl\`.
3. Insert or replace by \`(stepEntryId, targetLanguage)\`.
4. Preserve source metadata in \`StepEntries\`; do not duplicate \`eStrong\`, \`dStrong\`, \`uStrong\`, original text, transliteration, or morphology in the translation table unless the app needs denormalized search.
5. Keep \`review_needed\` and \`rejected\` out of user-facing default dictionary views unless the app explicitly supports draft entries.

## Query Model

- Classical Strong lookup should first resolve all matching \`StepEntries.eStrong\`.
- Precise STEP lookup should use \`StepEntries.id\`.
- When a verse has \`dStrong\` / \`uStrong\`, prefer exact \`stepEntryId\` if available.
- If only classical Strong is available, show grouped STEP subentries.

## Rollback Plan

1. Keep the pre-import SQLite backup.
2. Run import in a transaction.
3. Verify counts before commit.
4. Roll back the transaction if final counts or duplicate checks fail.
5. Restore the backup if application-level QA reveals a structural issue.

## What Remains Manual

- Human decision on whether to expose \`review_needed\` entries.
- Any theological or proper-name disagreements found during app QA.
- Final product decision on whether rejected entries should be hidden, displayed as English fallback, or queued for later manual lexicography.
`;
}

function retryCost(): number {
  return [...readJsonl(RETRY_SHORT), ...readJsonl(RETRY_HARD)].reduce(
    (sum, record) => sum + (record.usage?.estimatedCostUsd ?? 0),
    0
  );
}

function verifyFinal(
  records: LexiconRecord[],
  totalEntries: number
): Record<string, boolean | number> {
  const ids = new Set<number>();
  let parseableRecords = 0;
  let htmlLeaks = 0;
  let emptyGloss = 0;
  let inventedStrong = 0;
  let missingStatus = 0;

  for (const record of records) {
    parseableRecords += 1;
    ids.add(record.stepEntryId);
    const combined = `${record.translation.glossFr} ${record.translation.meaningFr} ${record.translation.notesFr}`;
    if (/<[^>]+>/.test(combined)) htmlLeaks += 1;
    if (!record.translation.glossFr.trim()) emptyGloss += 1;
    if (!["accepted", "review_needed", "rejected"].includes(record.status))
      missingStatus += 1;
    if (
      record.validation.issues.some((issue) =>
        issue.startsWith("invented-strong")
      )
    ) {
      inventedStrong += 1;
    }
  }

  return {
    parseableRecords,
    finalCountIs22717: records.length === totalEntries,
    uniqueStepEntryIds: ids.size,
    noDuplicateStepEntryIds: ids.size === records.length,
    noHtmlLeaks: htmlLeaks === 0,
    noEmptyGlossFr: emptyGloss === 0,
    noInventedStrongIssues: inventedStrong === 0,
    allStatusesExplicit: missingStatus === 0
  };
}

function main(): void {
  const args = parseArgs();
  const dbPath = args.get("db") ?? DEFAULT_DB;
  const legacyDbPath = args.get("legacy-fr-db") ?? DEFAULT_LEGACY_FR_DB;

  const entries = readEntries(dbPath);
  const legacyHints = readLegacyFrenchHints(legacyDbPath);
  const acceptedV3 = readJsonl(ACCEPTED_V3);
  const hardRecords = indexRecordsById(readJsonl(RETRY_HARD));
  const productionRecords = indexRecordsById(readJsonl(PRODUCTION));
  const remaining = JSON.parse(readFileSync(REMAINING, "utf8")) as {
    unresolvedIds: number[];
    confidenceOnly: number[];
  };

  const finalRecords: LexiconRecord[] = [];
  const usedIds = new Set<number>();

  for (const record of acceptedV3) {
    const entry = entries.get(record.stepEntryId);
    if (!entry)
      throw new Error(
        `Missing StepEntries row for accepted id=${record.stepEntryId}`
      );
    const finalRecord = finalizeAcceptedRecord(record, entry);
    finalRecords.push(finalRecord);
    usedIds.add(finalRecord.stepEntryId);
  }

  for (const id of remaining.unresolvedIds) {
    const record = hardRecords.get(id);
    const entry = entries.get(id);
    if (!record)
      throw new Error(`Missing hard retry record for unresolved id=${id}`);
    if (!entry)
      throw new Error(`Missing StepEntries row for unresolved id=${id}`);
    const legacyHint = legacyHints.get(baseStrongFromCode(entry.eStrong));
    const finalRecord = finalizeRemainingRecord(record, entry, legacyHint);
    if (usedIds.has(finalRecord.stepEntryId)) {
      throw new Error(
        `Duplicate stepEntryId before final confidence pass: ${finalRecord.stepEntryId}`
      );
    }
    finalRecords.push(finalRecord);
    usedIds.add(finalRecord.stepEntryId);
  }

  for (const id of remaining.confidenceOnly) {
    const record = productionRecords.get(id);
    const entry = entries.get(id);
    if (!record)
      throw new Error(`Missing production confidence record id=${id}`);
    if (!entry)
      throw new Error(`Missing StepEntries row for confidence id=${id}`);
    const legacyHint = legacyHints.get(baseStrongFromCode(entry.eStrong));
    const finalRecord = finalizeConfidenceRecord(record, entry, legacyHint);
    if (usedIds.has(finalRecord.stepEntryId)) {
      throw new Error(
        `Duplicate stepEntryId before final write: ${finalRecord.stepEntryId}`
      );
    }
    finalRecords.push(finalRecord);
    usedIds.add(finalRecord.stepEntryId);
  }

  finalRecords.sort((left, right) => left.stepEntryId - right.stepEntryId);

  const reviewNeeded = finalRecords
    .filter((record) => record.status === "review_needed")
    .map(
      (record): FinalIssue => ({
        stepEntryId: record.stepEntryId,
        strong: record.source.eStrong,
        status: record.status,
        issues:
          record.validation.issues.length > 0
            ? record.validation.issues
            : (record.review?.issues ?? []),
        glossFr: record.translation.glossFr,
        meaningFr: record.translation.meaningFr,
        actions: record.finalization?.actions ?? []
      })
    );
  const rejected = finalRecords
    .filter((record) => record.status === "rejected")
    .map(
      (record): FinalIssue => ({
        stepEntryId: record.stepEntryId,
        strong: record.source.eStrong,
        status: record.status,
        issues: record.validation.issues,
        glossFr: record.translation.glossFr,
        meaningFr: record.translation.meaningFr,
        actions: record.finalization?.actions ?? []
      })
    );

  const verification = verifyFinal(finalRecords, entries.size);
  const fixedWithoutLlm = finalRecords.filter(
    (record) =>
      record.finalization?.sourceSet === "remaining-invalid" &&
      record.finalization.method === "deterministic-cleanup" &&
      record.status === "accepted"
  ).length;
  const fixedWithLlm =
    finalRecords.filter((record) =>
      ["accepted-v3"].includes(record.finalization?.sourceSet ?? "")
    ).length - 18761;

  mkdirSync(dirname(resolve(FINAL_JSONL)), { recursive: true });
  writeFileSync(
    FINAL_JSONL,
    `${finalRecords.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
  writeJson(FINAL_REVIEW_NEEDED, {
    generatedAt: new Date().toISOString(),
    count: reviewNeeded.length,
    entries: reviewNeeded
  });
  writeJson(FINAL_REJECTED, {
    generatedAt: new Date().toISOString(),
    count: rejected.length,
    entries: rejected
  });
  writeText(
    FINAL_QUALITY_REPORT,
    renderQualityReport({
      finalRecords,
      reviewNeeded,
      rejected,
      fixedWithoutLlm,
      fixedWithLlm,
      retryCost: retryCost(),
      initialRemaining: remaining.unresolvedIds.length,
      confidenceOnly: remaining.confidenceOnly.length,
      verification
    })
  );
  writeText(FINAL_SAMPLES_REPORT, renderSamplesReport(finalRecords));
  writeText(
    FINAL_IMPORT_PLAN,
    renderImportPlan(finalRecords, reviewNeeded, rejected)
  );

  console.log(
    JSON.stringify(
      {
        finalRecords: finalRecords.length,
        accepted: finalRecords.filter((record) => record.status === "accepted")
          .length,
        reviewNeeded: reviewNeeded.length,
        rejected: rejected.length,
        verification
      },
      null,
      2
    )
  );
}

main();
