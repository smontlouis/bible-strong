import { createHash } from "node:crypto";

import {
  STEP_GREEK_LEXICON_COMMIT,
  STEP_GREEK_LEXICON_SHA256,
  STEP_GREEK_LEXICON_URL
} from "./greekLexiconReorganization.js";

export {
  STEP_GREEK_LEXICON_COMMIT,
  STEP_GREEK_LEXICON_SHA256,
  STEP_GREEK_LEXICON_URL
};

export const STEP_HEBREW_LEXICON_COMMIT = STEP_GREEK_LEXICON_COMMIT;
export const STEP_HEBREW_LEXICON_SHA256 =
  "8e661400b891f7ffcc453eb3dbbdde12a2c83254694d5be6ff5ccf24eeae4e75" as const;
export const STEP_HEBREW_LEXICON_URL =
  `https://raw.githubusercontent.com/STEPBible/step/${STEP_HEBREW_LEXICON_COMMIT}/step-core-data/src/main/resources/com/tyndalehouse/step/core/data/create/lexicon/lexicon_hebrew.txt` as const;

export interface StepRelatedNumbersEntry {
  code: string;
  relatedCodes: readonly string[];
  sourceLine: number;
  fieldLine: number;
}

export function parseStepRelatedNumbers(
  content: string
): StepRelatedNumbersEntry[] {
  const entries: StepRelatedNumbersEntry[] = [];
  const lines = content.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  let current:
    | {
        code: string;
        sourceLine: number;
      }
    | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const header = line.match(/^\$=([GH]\d{4,5}[A-Za-z]?)=/u);
    if (header) {
      current = {
        code: header[1]!,
        sourceLine: index + 1
      };
      continue;
    }
    if (!current) continue;

    const field = line.match(/^@StepRelatedNos2=\s*(.*)$/u);
    if (!field) continue;
    const relatedCodes = uniquePreservingOrder(
      (field[1] ?? "")
        .split(/[,\s]+/u)
        .map((value) => value.trim())
        .filter(
          (value) =>
            /^[GH]\d{4,5}[A-Za-z]?$/u.test(value) && value !== current!.code
        )
    );
    entries.push({
      code: current.code,
      relatedCodes,
      sourceLine: current.sourceLine,
      fieldLine: index + 1
    });
  }

  return entries;
}

export function assertPinnedStepLexicon(
  content: string | Uint8Array,
  expectedSha256: string,
  label: string
): void {
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== expectedSha256) {
    throw new Error(
      `step-compiled-lexicon-sha256-mismatch:${label}:${actual}:${expectedSha256}`
    );
  }
}

function uniquePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
