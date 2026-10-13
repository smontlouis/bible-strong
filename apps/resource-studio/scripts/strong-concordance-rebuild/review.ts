/**
 * Evaluator-side evidence packets for the assisted review of disagreements.
 * The packets stay under the ignored outputs directory: they quote target text.
 */
import { readFile } from "node:fs/promises";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { parseStrongTokens } from "../../src/strongCsv.js";
import type { PredictionRun } from "./predict.js";
import { stratifiedSample } from "./report.js";
import type { OccurrenceRecord } from "./score.js";

const STEP_FILES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
];

/** STEP rows indexed by `Book.C.V#NN` with the OSIS book used by the ledger. */
export async function stepRows(): Promise<Map<string, string>> {
  const { parseStepReference } = await import("../../src/stepReference.js");
  const rows = new Map<string, string>();
  for (const file of STEP_FILES) {
    for (const line of (await readFile(file, "utf8")).split(/\r?\n/u)) {
      const parsed = parseStepReference(line.split("\t")[0] ?? "");
      if (!parsed) continue;
      const key = `${parsed.key}#${parsed.tokenIndex}`;
      if (!rows.has(key))
        rows.set(key, line.split("\t").slice(0, 6).join(" | "));
    }
  }
  return rows;
}

export async function buildReviewPackets(options: {
  run: PredictionRun;
  records: OccurrenceRecord[];
  seed: string;
  perCategory: number;
}) {
  const sample = stratifiedSample(
    options.records,
    options.seed,
    options.perCategory
  );
  const verses = new Map(
    options.run.verses.map((verse) => [verse.canonicalRefs[0]!, verse])
  );
  const step = await stepRows();
  const witnesses: Record<string, Map<string, string>> = {};
  for (const witness of ["Sg1910", "Darby", "DarbyR"])
    witnesses[witness] = new Map(
      (await readStrongCsv(`data/strongs/${witness}.csv`)).map((row) => [
        `${row.bookId}.${row.chapter}.${row.verse}`,
        withoutPublisherNotes(row.text)
      ])
    );
  return sample.map((record, index) => {
    const verse = verses.get(record.ref)!;
    const unit = verse.decisions.find((decision) => {
      const parts = decision.sourceUnitId.split(".");
      return (
        Number(parts[4]) === record.position &&
        (record.goldStrong ? decision.strong.includes(record.goldStrong) : true)
      );
    });
    const stepKey = unit
      ? `${unit.sourceUnitId.split(".").slice(1, 4).join(".")}#${unit.sourceUnitId.split(".")[4]}`
      : `${record.ref}#${record.position}`;
    const strong = record.goldStrong ?? record.predictedStrong[0];
    return {
      id: `R${String(index + 1).padStart(3, "0")}`,
      category: record.category,
      outcome: record.outcome,
      ref: record.ref,
      position: record.position,
      strong,
      words: verse.tokens
        .map((token, wordIndex) => `${wordIndex}:${token}`)
        .join(" "),
      gold: {
        kind: record.goldKind,
        tokens: record.goldTokens.map((i) => verse.tokens[i]),
        anchorAfter: record.goldAnchor
      },
      predicted: {
        state: record.predictedState,
        tokens: record.predictedTokens.map((i) => verse.tokens[i]),
        anchorAfter: record.predictedAnchor,
        assurance: record.predictedAssurance,
        source: record.predictedSource,
        strong: record.predictedStrong
      },
      step: step.get(stepKey) ?? null,
      witnesses: Object.fromEntries(
        Object.entries(witnesses).map(([name, map]) => {
          const tagged = map.get(record.ref) ?? "";
          const carriers = parseStrongTokens(tagged)
            .filter((token) => strong && token.strong.includes(strong))
            .map((token) => token.text || "∅");
          return [name, carriers];
        })
      ),
      difficulty: record.difficulty,
      judgement: null as null | {
        verdict:
          | "reference"
          | "prediction"
          | "both-defensible"
          | "neither"
          | "undecidable";
        rationale: string;
        assurance: "assistant-reviewed-exposed";
      }
    };
  });
}
