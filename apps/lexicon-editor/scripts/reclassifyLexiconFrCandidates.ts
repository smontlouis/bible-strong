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
  review?: {
    verdict: "accepted" | "review_needed";
    score: number;
    issues: string[];
  };
  usage: {
    estimatedCostUsd: number;
  };
};

type Validation = OutputRecord["validation"];

type BucketName =
  | "acceptedAlready"
  | "acceptedAfterValidatorFix"
  | "shortMeaningOnly"
  | "confidenceOnly"
  | "lockedTerminology"
  | "strongProblems"
  | "missingGloss"
  | "otherRetry";

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_INPUT = "outputs/lexicon-fr/strong_lexicon_fr.candidates.jsonl";
const DEFAULT_REPORT = "reports/lexicon-fr-reclassification.md";
const DEFAULT_JSON =
  "outputs/lexicon-fr/strong_lexicon_fr.reclassification.json";
const DEFAULT_ACCEPTED_OUT =
  "outputs/lexicon-fr/strong_lexicon_fr.accepted-v1.jsonl";
const DEFAULT_RETRY_IDS_OUT =
  "outputs/lexicon-fr/strong_lexicon_fr.retry-ids.json";

const LOCKED_TERMS = [
  {
    match: ["H2526"],
    require: ["Cham"],
    forbid: ["jambon"]
  },
  {
    match: ["H1285", "covenant"],
    require: ["alliance"],
    forbid: []
  },
  {
    match: ["H3722", "atonement", "to atone"],
    require: ["expiation", "expier"],
    forbid: []
  },
  {
    match: ["G2435", "propitiation"],
    require: ["propiti", "expiat"],
    forbid: []
  },
  {
    match: ["G3056", "logos", "λόγος", "λόγος"],
    require: ["parole", "mot", "discours", "raison", "Verbe"],
    forbid: ["logo"]
  },
  {
    match: ["G5485", "grace"],
    require: ["grâce", "faveur"],
    forbid: []
  },
  {
    match: ["H7307", "G4151", "ruach", "pneuma", "spirit"],
    require: ["esprit", "souffle", "vent"],
    forbid: []
  },
  {
    match: ["H3068", "H3069", "Jehovah"],
    require: ["Éternel", "Seigneur", "YHWH", "Yahvé"],
    forbid: []
  },
  {
    match: ["righteousness"],
    require: ["justice", "droiture"],
    forbid: []
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

function sourceContainsTerm(sourceText: string, term: string): boolean {
  if (/^[GH]\d{3,5}[A-Za-z]?$/.test(term)) {
    return sourceText.includes(normalize(term));
  }
  return containsWholeTerm(sourceText, term);
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

function validateCandidate(
  entry: StepEntry,
  candidate: TranslationCandidate
): Validation {
  const issues: string[] = [];
  let score = 0;
  const maxScore = 14;

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

  return { score: Math.min(score, maxScore), maxScore, issues };
}

function readEntries(dbPath: string): Map<number, StepEntry> {
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `select id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
       from StepEntries`
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 120 }
  );
  return new Map(
    (JSON.parse(raw) as StepEntry[]).map((entry) => [entry.id, entry])
  );
}

function readRecords(path: string): OutputRecord[] {
  const records: OutputRecord[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    records.push(JSON.parse(line) as OutputRecord);
  }
  return records;
}

function issueKey(issue: string): string {
  return issue.split(":")[0] ?? issue;
}

function bucketFor(record: OutputRecord, validation: Validation): BucketName {
  if (record.status === "accepted") return "acceptedAlready";
  if (validation.issues.length === 0 && validation.score >= 12) {
    return "acceptedAfterValidatorFix";
  }

  const keys = new Set(validation.issues.map(issueKey));
  if (keys.size === 1 && keys.has("meaning-too-short"))
    return "shortMeaningOnly";
  if (keys.size === 1 && keys.has("low-confidence")) return "confidenceOnly";
  if (keys.has("locked-term-missing") || keys.has("forbidden-term")) {
    return "lockedTerminology";
  }
  if (keys.has("strong-changed") || keys.has("invented-strong"))
    return "strongProblems";
  if (keys.has("missing-gloss-fr")) return "missingGloss";
  return "otherRetry";
}

function pushExample(
  examples: Partial<Record<BucketName, OutputRecord[]>>,
  bucket: BucketName,
  record: OutputRecord
): void {
  const current = examples[bucket] ?? [];
  if (current.length >= 8) return;
  examples[bucket] = [...current, record];
}

function renderReport(options: {
  records: OutputRecord[];
  newValidations: Map<number, Validation>;
  buckets: Record<BucketName, number[]>;
  examples: Partial<Record<BucketName, OutputRecord[]>>;
  oldIssueCounts: Map<string, number>;
  newIssueCounts: Map<string, number>;
}): string {
  const lines = [
    "# French Lexicon Reclassification",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- Records: ${options.records.length}`,
    `- Already accepted: ${options.buckets.acceptedAlready.length}`,
    `- Invalid/review records rechecked: ${
      options.records.length - options.buckets.acceptedAlready.length
    }`,
    `- Accepted after validator fix: ${options.buckets.acceptedAfterValidatorFix.length}`,
    `- Short meaning only: ${options.buckets.shortMeaningOnly.length}`,
    `- Confidence only: ${options.buckets.confidenceOnly.length}`,
    `- Locked terminology: ${options.buckets.lockedTerminology.length}`,
    `- Strong problems: ${options.buckets.strongProblems.length}`,
    `- Missing gloss: ${options.buckets.missingGloss.length}`,
    `- Other retry: ${options.buckets.otherRetry.length}`,
    "",
    "## Issue Counts Before/After",
    "",
    "| Issue | Before | After |",
    "| --- | ---: | ---: |"
  ];

  const issues = new Set([
    ...options.oldIssueCounts.keys(),
    ...options.newIssueCounts.keys()
  ]);
  for (const issue of [...issues].sort()) {
    lines.push(
      `| ${issue} | ${options.oldIssueCounts.get(issue) ?? 0} | ${
        options.newIssueCounts.get(issue) ?? 0
      } |`
    );
  }

  lines.push("", "## Retry Plan", "");
  lines.push(
    "1. Accept/rewrite metadata for `acceptedAfterValidatorFix` without calling the LLM again.",
    "2. Retry `shortMeaningOnly` with a narrow prompt that expands the French definition from the existing source.",
    "3. Send `strongProblems`, `lockedTerminology`, and `missingGloss` through a stricter retry prompt; review only entries that fail again.",
    "4. Treat `confidenceOnly` as review candidates, not translation failures."
  );

  const bucketLabels: Record<BucketName, string> = {
    acceptedAlready: "Already Accepted",
    acceptedAfterValidatorFix: "Accepted After Validator Fix",
    shortMeaningOnly: "Short Meaning Only",
    confidenceOnly: "Confidence Only",
    lockedTerminology: "Locked Terminology",
    strongProblems: "Strong Problems",
    missingGloss: "Missing Gloss",
    otherRetry: "Other Retry"
  };

  for (const bucket of Object.keys(bucketLabels) as BucketName[]) {
    const examples = options.examples[bucket] ?? [];
    if (examples.length === 0 || bucket === "acceptedAlready") continue;
    lines.push("", `## ${bucketLabels[bucket]} Examples`, "");
    lines.push(
      "| Step ID | Strong | Old issues | New issues | Gloss FR | Meaning FR |"
    );
    lines.push("| ---: | --- | --- | --- | --- | --- |");
    for (const record of examples) {
      const validation = options.newValidations.get(record.stepEntryId);
      lines.push(
        `| ${record.stepEntryId} | ${record.source.eStrong} | ${record.validation.issues
          .join(", ")
          .replace(/\|/g, "/")} | ${(validation?.issues ?? [])
          .join(", ")
          .replace(
            /\|/g,
            "/"
          )} | ${record.translation.glossFr.replace(/\|/g, "/")} | ${record.translation.meaningFr
          .slice(0, 140)
          .replace(/\s+/g, " ")
          .replace(/\|/g, "/")} |`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function main(): void {
  const args = parseArgs();
  const dbPath = args.get("db") ?? DEFAULT_DB;
  const inputPath = args.get("in") ?? DEFAULT_INPUT;
  const reportPath = args.get("report") ?? DEFAULT_REPORT;
  const jsonPath = args.get("json") ?? DEFAULT_JSON;
  const acceptedOutPath = args.get("accepted-out") ?? DEFAULT_ACCEPTED_OUT;
  const retryIdsPath = args.get("retry-ids") ?? DEFAULT_RETRY_IDS_OUT;

  if (!existsSync(inputPath)) throw new Error(`missing input: ${inputPath}`);

  const entries = readEntries(dbPath);
  const records = readRecords(inputPath);
  const buckets: Record<BucketName, number[]> = {
    acceptedAlready: [],
    acceptedAfterValidatorFix: [],
    shortMeaningOnly: [],
    confidenceOnly: [],
    lockedTerminology: [],
    strongProblems: [],
    missingGloss: [],
    otherRetry: []
  };
  const examples: Partial<Record<BucketName, OutputRecord[]>> = {};
  const oldIssueCounts = new Map<string, number>();
  const newIssueCounts = new Map<string, number>();
  const newValidations = new Map<number, Validation>();
  const acceptedRecords: OutputRecord[] = [];

  for (const record of records) {
    for (const issue of record.validation.issues) {
      const key = issueKey(issue);
      oldIssueCounts.set(key, (oldIssueCounts.get(key) ?? 0) + 1);
    }

    const entry = entries.get(record.stepEntryId);
    if (!entry)
      throw new Error(`missing StepEntries row for id=${record.stepEntryId}`);

    const validation = validateCandidate(entry, record.translation);
    newValidations.set(record.stepEntryId, validation);
    for (const issue of validation.issues) {
      const key = issueKey(issue);
      newIssueCounts.set(key, (newIssueCounts.get(key) ?? 0) + 1);
    }

    const bucket = bucketFor(record, validation);
    buckets[bucket].push(record.stepEntryId);
    pushExample(examples, bucket, record);

    if (
      bucket === "acceptedAlready" ||
      bucket === "acceptedAfterValidatorFix"
    ) {
      acceptedRecords.push({
        ...record,
        status: "accepted",
        validation
      });
    }
  }

  const json = {
    generatedAt: new Date().toISOString(),
    input: inputPath,
    db: dbPath,
    counts: Object.fromEntries(
      Object.entries(buckets).map(([bucket, ids]) => [bucket, ids.length])
    ),
    oldIssueCounts: Object.fromEntries(oldIssueCounts),
    newIssueCounts: Object.fromEntries(newIssueCounts),
    buckets
  };

  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  mkdirSync(dirname(resolve(jsonPath)), { recursive: true });
  mkdirSync(dirname(resolve(acceptedOutPath)), { recursive: true });
  mkdirSync(dirname(resolve(retryIdsPath)), { recursive: true });
  writeFileSync(
    reportPath,
    renderReport({
      records,
      newValidations,
      buckets,
      examples,
      oldIssueCounts,
      newIssueCounts
    })
  );
  writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  writeFileSync(
    acceptedOutPath,
    `${acceptedRecords.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
  writeFileSync(
    retryIdsPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: inputPath,
        shortMeaningOnly: buckets.shortMeaningOnly,
        confidenceOnly: buckets.confidenceOnly,
        lockedTerminology: buckets.lockedTerminology,
        strongProblems: buckets.strongProblems,
        missingGloss: buckets.missingGloss,
        otherRetry: buckets.otherRetry,
        allRetry: [
          ...buckets.shortMeaningOnly,
          ...buckets.lockedTerminology,
          ...buckets.strongProblems,
          ...buckets.missingGloss,
          ...buckets.otherRetry
        ]
      },
      null,
      2
    )}\n`
  );
  console.log(`Wrote ${reportPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${acceptedOutPath}`);
  console.log(`Wrote ${retryIdsPath}`);
}

main();
