import { stripTags, tokenizeText } from "./tokenize.js";

export type CarrierKind = "word" | "phrase" | "empty";

/**
 * One Strong occurrence and its French carrier. Word indexes are zero-based.
 * Empty placements are anchored immediately after `insertAfterWordIndex` (-1
 * means before the first word).
 */
export interface CarrierPlacement {
  strong: string;
  kind: CarrierKind;
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
  confidence?: number;
  source?: string;
}

/** Parse the gold markup into word, phrase, and empty Strong occurrences. */
export function extractGoldCarrierPlacements(
  taggedText: string
): CarrierPlacement[] {
  const placements: CarrierPlacement[] = [];
  const wordTagPattern = /<w\b([^>]*)>([\s\S]*?)<\/w>/giu;
  const plainText = stripTags(taggedText);
  const wordRanges = getWordRanges(plainText);
  let taggedCursor = 0;
  let plainOffset = 0;

  for (const match of taggedText.matchAll(wordTagPattern)) {
    const matchIndex = match.index ?? 0;
    plainOffset += stripTags(taggedText.slice(taggedCursor, matchIndex)).length;

    const strong = parseStrongAttribute(match[1] ?? "");
    const innerText = stripTags(match[2] ?? "");
    const carrierStart = plainOffset;
    const carrierEnd = carrierStart + innerText.length;
    const coveredWordIndexes = wordRanges.flatMap((range, wordIndex) =>
      rangesOverlap(carrierStart, carrierEnd, range.start, range.end)
        ? [wordIndex]
        : []
    );

    for (const strongCode of strong) {
      if (coveredWordIndexes.length === 0) {
        placements.push({
          strong: strongCode,
          kind: "empty",
          insertAfterWordIndex: findPrecedingWordIndex(wordRanges, carrierStart)
        });
      } else {
        const startWordIndex = coveredWordIndexes[0]!;
        const endWordIndex = coveredWordIndexes.at(-1)!;
        placements.push({
          strong: strongCode,
          kind: startWordIndex === endWordIndex ? "word" : "phrase",
          startWordIndex,
          endWordIndex
        });
      }
    }

    plainOffset = carrierEnd;
    taggedCursor = matchIndex + match[0].length;
  }

  return placements;
}

function getWordRanges(text: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let offset = 0;

  for (const segment of tokenizeText(text)) {
    const start = offset;
    offset += segment.text.length;
    if (segment.kind === "word") ranges.push({ start, end: offset });
  }

  return ranges;
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function findPrecedingWordIndex(
  ranges: Array<{ start: number; end: number }>,
  offset: number
): number {
  let preceding = -1;
  for (let index = 0; index < ranges.length; index += 1) {
    if (ranges[index]!.end > offset) break;
    preceding = index;
  }
  return preceding;
}

function parseStrongAttribute(attributes: string): string[] {
  const match = attributes.match(/\bstrong=(["'])(.*?)\1/i);
  return (match?.[2] ?? "")
    .split(/\s+/)
    .map((strong) => strong.trim())
    .filter(Boolean);
}
