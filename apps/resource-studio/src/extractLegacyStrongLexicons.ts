import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { extractPrimaryDStrong } from "./lexiconV3/identity.js";

type Language = "greek" | "hebrew";
type LegacyEntry = {
  Code: number;
  Mot: string;
  Phonetique: string;
  Original: string;
  Origine: string;
  Type: string;
  LSG: string;
  Definition: string;
};
type StepEntry = {
  id: number;
  language: Language;
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
};

const sources = {
  fr: "https://storage.googleapis.com/bible-strong-app.appspot.com/databases/strong.sqlite",
  en: "https://storage.googleapis.com/bible-strong-app.appspot.com/databases/en/strong.sqlite"
};
const sha256 = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const classicCode = (language: Language, code: number) =>
  `${language === "greek" ? "G" : "H"}${String(code).padStart(4, "0")}`;
const isLexicalCode = (language: Language, code: number) =>
  Number.isSafeInteger(code) &&
  code > 0 &&
  code <= (language === "greek" ? 5624 : 8674);

/** Use the resolved STEP entry's family, never its uStrong alias or related senses. */
export function getLegacyStrongFamily(entry: StepEntry): string {
  if (entry.language !== "greek" && entry.language !== "hebrew") {
    throw new Error(`Unknown lexical language: ${entry.language}`);
  }
  const code = classicCode(entry.language, entry.baseCode);
  const primary = extractPrimaryDStrong(entry.dStrong);
  const normalizeFamily = (value: string | null) => {
    const match = value?.match(/^([GH])(\d+)[A-Za-z]?(?:_[A-Za-z])?$/u);
    return match
      ? `${match[1]}${String(Number(match[2])).padStart(4, "0")}`
      : null;
  };
  if (
    !Number.isSafeInteger(entry.baseCode) ||
    entry.baseCode <= 0 ||
    normalizeFamily(entry.eStrong) !== code ||
    !normalizeFamily(primary)
  ) {
    throw new Error(`Inconsistent STEP family: ${JSON.stringify(entry)}`);
  }
  return code;
}

export function extractLegacyStrongLexicons(options: {
  french: string;
  english: string;
  step: string;
  output: string;
}) {
  // Refuse existing outputs so originals and previous extractions cannot be overwritten.
  if (existsSync(options.output))
    throw new Error(`Output already exists: ${options.output}`);
  const stepDb = new DatabaseSync(options.step, { readOnly: true });
  let stepEntries: StepEntry[];
  try {
    stepEntries = stepDb
      .prepare(
        "SELECT id, language, baseCode, eStrong, dStrong, uStrong FROM StepEntries ORDER BY id"
      )
      .all() as StepEntry[];
    if (!stepEntries.length) throw new Error("Empty STEP lexicon");
    stepEntries.forEach(getLegacyStrongFamily);
  } finally {
    stepDb.close();
  }
  mkdirSync(options.output, { recursive: true });
  const summaries = [];
  for (const locale of ["fr", "en"] as const) {
    const sourcePath = locale === "fr" ? options.french : options.english;
    const source = new DatabaseSync(sourcePath, { readOnly: true });
    const outputPath = path.join(
      options.output,
      `strong-simple-${locale}.sqlite`
    );
    const output = new DatabaseSync(outputPath);
    const excluded: { language: Language; row: LegacyEntry; reason: string }[] =
      [];
    const available = new Set<string>();
    const missingDefinitions: string[] = [];
    const counts = { greek: 0, hebrew: 0 };
    const mappings = [];
    try {
      output.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE SimpleStrongEntries (
          classicStrong TEXT PRIMARY KEY,
          language TEXT NOT NULL CHECK(language IN ('greek', 'hebrew')),
          code INTEGER NOT NULL,
          word TEXT NOT NULL,
          pronunciation TEXT NOT NULL,
          original TEXT NOT NULL,
          originHtml TEXT NOT NULL,
          grammaticalType TEXT NOT NULL,
          translationSummary TEXT NOT NULL,
          definitionHtml TEXT NOT NULL,
          UNIQUE(language, code)
        );
        CREATE TABLE StepStrongLinks (
          stepEntryId INTEGER PRIMARY KEY,
          stepCode TEXT NOT NULL COLLATE BINARY,
          eStrong TEXT NOT NULL COLLATE BINARY,
          dStrong TEXT NOT NULL COLLATE BINARY,
          uStrong TEXT NOT NULL COLLATE BINARY,
          classicStrong TEXT NOT NULL REFERENCES SimpleStrongEntries(classicStrong)
        );
        CREATE INDEX StepStrongLinks_classicStrong ON StepStrongLinks(classicStrong);
        CREATE TABLE ExtractionMetadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        BEGIN;
      `);
      const insert = output.prepare(
        "INSERT INTO SimpleStrongEntries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const [table, language] of [
        ["Grec", "greek"],
        ["Hebreu", "hebrew"]
      ] as const) {
        const rows = source
          .prepare(
            `SELECT Code, Mot, Phonetique, ${table} AS Original, Origine, Type, LSG, Definition FROM ${table} ORDER BY Code`
          )
          .all() as LegacyEntry[];
        if (!rows.length)
          throw new Error(`Empty source table: ${locale}/${table}`);
        for (const row of rows) {
          if (!isLexicalCode(language, row.Code)) {
            excluded.push({
              language,
              row,
              reason: "non-classical-lexical-code"
            });
            continue;
          }
          const code = classicCode(language, row.Code);
          insert.run(
            code,
            language,
            row.Code,
            row.Mot,
            row.Phonetique,
            row.Original,
            row.Origine,
            row.Type,
            row.LSG,
            row.Definition
          );
          counts[language]++;
          if (row.Definition.trim()) available.add(code);
          else missingDefinitions.push(code);
        }
      }
      const link = output.prepare(
        "INSERT INTO StepStrongLinks VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const entry of stepEntries) {
        const classicStrong = getLegacyStrongFamily(entry);
        const stepCode = extractPrimaryDStrong(entry.dStrong)!;
        const status = !isLexicalCode(entry.language, entry.baseCode)
          ? "outside-classical-range"
          : available.has(classicStrong)
            ? "linked"
            : "missing-legacy-definition";
        mappings.push({
          ...entry,
          stepCode,
          classicStrong,
          status,
          primaryDStrongFamilyDiffers:
            stepCode.replace(/[A-Za-z](?:_[A-Za-z])?$/u, "") !== classicStrong
        });
        if (status === "linked") {
          link.run(
            entry.id,
            stepCode,
            entry.eStrong,
            entry.dStrong,
            entry.uStrong,
            classicStrong
          );
        }
      }
      const metadata = {
        schemaVersion: "1",
        locale,
        sourceUrl: sources[locale],
        sourceSha256: sha256(sourcePath),
        stepSourceSha256: sha256(options.step),
        mappingPolicy:
          "Resolved STEP language + baseCode, checked against eStrong; never strip dStrong suffixes to infer a family; classical lexical ranges only",
        contentPolicy:
          "Historical lexical fields preserved verbatim; no Bible tables; technical entries excluded and audited"
      };
      const insertMeta = output.prepare(
        "INSERT INTO ExtractionMetadata VALUES (?, ?)"
      );
      for (const [key, value] of Object.entries(metadata))
        insertMeta.run(key, value);
      output.exec("COMMIT; VACUUM;");
      const integrity = output.prepare("PRAGMA integrity_check").get();
      if (
        integrity?.integrity_check !== "ok" ||
        output.prepare("PRAGMA foreign_key_check").all().length
      ) {
        throw new Error(`Invalid extracted database: ${locale}`);
      }
      const linked = mappings.filter((row) => row.status === "linked");
      const linkedCodes = new Set(linked.map((row) => row.classicStrong));
      const summary = {
        ...metadata,
        counts,
        excludedTechnicalEntries: excluded.length,
        missingDefinitions,
        stepEntries: mappings.length,
        linkedStepEntries: linked.length,
        linkedSuffixedStepEntries: linked.filter((row) =>
          /[A-Za-z]$/u.test(row.stepCode)
        ).length,
        outsideClassicalRange: mappings.filter(
          (row) => row.status === "outside-classical-range"
        ).length,
        missingLegacyDefinition: mappings.filter(
          (row) => row.status === "missing-legacy-definition"
        ).length,
        exceptionalFamilyMappings: mappings.filter(
          (row) => row.primaryDStrongFamilyDiffers
        ),
        legacyEntriesWithoutStepMatch: [...available].filter(
          (code) => !linkedCodes.has(code)
        ),
        artifact: path.basename(outputPath),
        artifactSha256: sha256(outputPath)
      };
      writeFileSync(
        path.join(options.output, `mapping-${locale}.jsonl`),
        mappings.map((row) => JSON.stringify(row)).join("\n") + "\n"
      );
      writeFileSync(
        path.join(options.output, `excluded-${locale}.jsonl`),
        excluded.map((row) => JSON.stringify(row)).join("\n") +
          (excluded.length ? "\n" : "")
      );
      summaries.push(summary);
    } finally {
      source.close();
      output.close();
    }
  }
  const report = {
    schemaVersion: 1,
    stepSourcePath: path.resolve(options.step),
    summaries
  };
  writeFileSync(
    path.join(options.output, "report.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  return report;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [french, english, step, output] = process.argv.slice(2);
  if (!french || !english || !step || !output) {
    throw new Error(
      "Usage: tsx src/extractLegacyStrongLexicons.ts <strong-fr.sqlite> <strong-en.sqlite> <step-core.sqlite> <new-output-dir>"
    );
  }
  console.log(
    JSON.stringify(
      extractLegacyStrongLexicons({ french, english, step, output }),
      null,
      2
    )
  );
}
