import { createHash } from "node:crypto";
import type { CarrierPlacement } from "../../src/strongCarriers.js";
import { tokenizeText } from "../../src/tokenize.js";

export const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export const words = (text: string) =>
  tokenizeText(text).filter((t) => t.kind === "word");
export type Split = "development" | "test";
export interface Plan {
  baseCommit: string;
  editions: Record<string, string>;
  scenarios: Record<string, string[]>;
  chapters: Array<{ ref: string; split: Split; genre: string }>;
}
import type {
  ReconstructionPlacement,
  ReconstructionVerse
} from "../../src/strongConcordanceRefinement.js";
export type Placement = ReconstructionPlacement;
export type Prediction = ReconstructionVerse;
export interface GoldVerse {
  ref: string;
  text: string;
  placements: Placement[];
  diagnostics: string[];
}
export interface RawVerse {
  verse: number;
  rawText: string;
  tags: Array<{
    pa: string;
    ns: string;
    empty: boolean;
    start: number;
    end: number;
  }>;
}

/** Repeated HTML words with the same data-pa belong to ONE source occurrence.
 * Distinct ordinals sharing a Strong are never collapsed. Lemmas and data-loc
 * deliberately do not take part in masking, reconstruction or grouping.
 */
export function goldVerse(chapter: string, raw: RawVerse): GoldVerse {
  let offset = 0;
  const ranges = tokenizeText(raw.rawText).flatMap((t) => {
    const start = offset;
    offset += t.text.length;
    return t.kind === "word" ? [{ start, end: offset }] : [];
  });
  const groups = new Map<string, Placement>();
  const diagnostics: string[] = [];
  for (const tag of raw.tags) {
    const identifiers = [...tag.pa.matchAll(/(\d+)\/([hga])(\d+)/giu)]
      .map((m) => ({
        ordinal: Number(m[1]),
        strong: `${m[2].toUpperCase() === "A" ? "H" : m[2].toUpperCase()}${m[3].padStart(4, "0")}`
      }))
      .filter((m) => !m.strong.endsWith("0000"));
    if (tag.ns.trim() && !identifiers.length)
      throw new Error(
        `strong-without-occurrence-identity:${chapter}.${raw.verse}`
      );
    for (const { ordinal, strong } of identifiers) {
      const id = `${ordinal}/${strong}`;
      const indices = tag.empty
        ? []
        : ranges.flatMap((r, i) =>
            r.start < tag.end && tag.start < r.end ? [i] : []
          );
      const previous = groups.get(id);
      if (previous && (previous.kind === "empty") !== !indices.length)
        diagnostics.push(`mixed-empty-visible:${id}`);
      if (!indices.length) {
        const anchor = ranges.filter((r) => r.end <= tag.start).length - 1;
        if (
          previous?.kind === "empty" &&
          previous.insertAfterWordIndex !== anchor
        )
          diagnostics.push(`multiple-empty-anchors:${id}`);
        groups.set(id, {
          id,
          strong,
          kind: "empty",
          insertAfterWordIndex: anchor
        });
      } else {
        const merged = [
          ...new Set([...(previous?.targetWordIndices ?? []), ...indices])
        ].sort((a, b) => a - b);
        groups.set(id, {
          id,
          strong,
          kind: merged.length === 1 ? "word" : "phrase",
          startWordIndex: merged[0],
          endWordIndex: merged.at(-1),
          targetWordIndices: merged
        });
      }
    }
  }
  // Only whitespace and the display-only empty glyph are normalized. The same
  // text and tokenizer are used by predictor and evaluator, including elisions.
  const text = raw.rawText.replace(/\s+/gu, " ").trim();
  if (words(text).length !== ranges.length || /[<>◎]/u.test(text))
    throw new Error(`invalid-masked-text:${chapter}.${raw.verse}`);
  return {
    ref: `${chapter}.${raw.verse}`,
    text,
    placements: [...groups.values()],
    diagnostics
  };
}

export function indices(
  p: CarrierPlacement & { targetWordIndices?: number[] }
): number[] {
  if (p.kind === "empty") return [];
  return (
    p.targetWordIndices ??
    Array.from(
      { length: p.endWordIndex! - p.startWordIndex! + 1 },
      (_, i) => p.startWordIndex! + i
    )
  );
}
export function carrierKey(
  p: CarrierPlacement & { targetWordIndices?: number[] }
): string {
  return `${p.strong}:${p.kind === "empty" ? `empty:${p.insertAfterWordIndex}` : indices(p).join(",")}`;
}
