import { createHash } from "node:crypto";
import type { OriginalStrongOccurrence } from "../../src/completeAlignment.js";
import type { CarrierPlacement } from "../../src/evaluateStrongGold.js";
import type { LexicalCandidateItem } from "../../src/lexicalCandidateReport.js";

export const GOLDS = ["Sg1910", "Darby", "DarbyR"] as const;
export const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export const chapter = (ref: string) => ref.split(".").slice(0, 2).join(".");
export const split = (ref: string): "calibration" | "test" =>
  parseInt(sha(`alignment-v1:${chapter(ref)}`).slice(0, 8), 16) % 2
    ? "test"
    : "calibration";
export interface EvalVerse {
  ref: string;
  split: "calibration" | "test";
  text: string;
  words: string[];
  normalized: string[];
  source: OriginalStrongOccurrence[];
  strong: string[];
  surface: string[];
}
export interface BaselineVerse {
  ref: string;
  placements: Array<
    CarrierPlacement & { id: string; originalOccurrenceId?: string }
  >;
  original: string[];
  items: LexicalCandidateItem[];
}
export const carrierKey = (p: CarrierPlacement) =>
  p.kind === "empty"
    ? `${p.strong}:empty:${p.insertAfterWordIndex}`
    : `${p.strong}:${p.startWordIndex}:${p.endWordIndex}`;
export const spanKey = (start: number, end = start) => `${start}:${end}`;
export function candidateSpan(c: LexicalCandidateItem["candidates"][number]) {
  return spanKey(
    c.startWordIndex ?? c.wordIndex,
    c.endWordIndex ?? c.wordIndex
  );
}
