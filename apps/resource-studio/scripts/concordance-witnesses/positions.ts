/**
 * Concordance.bible chapter pages give the source word position (BHS/NA word
 * number, STEP `#NN`) of every tagged word, which the CSV and OSIS exports
 * omit. Each `<w>` element of a witness CSV verse receives `pos="N"` (or
 * `pos="N+M"`) from the page word or words with the same text and Strong
 * numbers, found in order. An element that cannot be found keeps no position.
 */
import type { ConcordanceVerse } from "../strong-concordance-rebuild/concordanceHtml.js";

interface PageWord {
  text: string;
  strongs: string;
  positions: number[];
  untranslated: boolean;
}

const WORD = /<w\b([^>]*)>([\s\S]*?)<\/w>/gu;
/** Page words skipped at most between two tagged CSV words. */
const LOOKAHEAD = 8;
const comparable = (text: string) =>
  text
    .replace(/<[^>]+>/gu, "")
    .normalize("NFC")
    .replace(/[’']/gu, "'")
    .replace(/\s+/gu, "")
    .toLocaleLowerCase("fr-FR");
const strongSet = (codes: Array<string | null>) =>
  [...new Set(codes.filter((code): code is string => Boolean(code)))]
    .sort()
    .join(" ");

function pageWords(verse: ConcordanceVerse): PageWord[] {
  return verse.items.flatMap((item) => {
    if (item.kind !== "word") return [];
    const strongs = strongSet(
      item.positions.map((position) => position.strong)
    );
    if (!strongs) return [];
    return [
      {
        text: comparable(item.surface),
        strongs,
        positions: item.positions
          .filter((position) => Number.isInteger(position.position))
          .map((position) => position.position),
        untranslated: item.untranslated
      }
    ];
  });
}

export interface PositionAnnotation {
  text: string;
  annotated: number;
  unmatched: number;
}

export function annotatePositions(
  csvText: string,
  verse: ConcordanceVerse
): PositionAnnotation {
  const words = pageWords(verse);
  const edits: Array<{ at: number; positions: number[] }> = [];
  let cursor = 0;
  let unmatched = 0;
  for (const match of csvText.matchAll(WORD)) {
    const attributes = match[1] ?? "";
    const strongs = strongSet(
      (/\bstrong="([^"]*)"/u.exec(attributes)?.[1] ?? "").split(/\s+/u)
    );
    const inner = comparable(match[2] ?? "");
    let found: { end: number; positions: number[] } | undefined;
    for (
      let start = cursor;
      !found && start < Math.min(words.length, cursor + LOOKAHEAD);
      start += 1
    ) {
      const first = words[start]!;
      if (first.strongs !== strongs) continue;
      if (inner === "") {
        if (first.untranslated)
          found = { end: start + 1, positions: first.positions };
        continue;
      }
      // One page word, or the consecutive words of a whole locution.
      let text = "";
      for (let end = start; end < words.length; end += 1) {
        const word = words[end]!;
        if (word.strongs !== strongs || word.untranslated) break;
        text += word.text;
        if (text === inner) {
          found = {
            end: end + 1,
            positions: [
              ...new Set(
                words.slice(start, end + 1).flatMap((w) => w.positions)
              )
            ]
          };
          break;
        }
        if (!inner.startsWith(text)) break;
      }
    }
    if (!found || found.positions.length === 0) {
      unmatched += 1;
      continue;
    }
    cursor = found.end;
    // Insert before the closing `>` of the opening tag.
    edits.push({
      at: match.index + 2 + attributes.length,
      positions: found.positions
    });
  }
  let text = csvText;
  for (const edit of [...edits].reverse())
    text = `${text.slice(0, edit.at)} pos="${edit.positions.join("+")}"${text.slice(edit.at)}`;
  return { text, annotated: edits.length, unmatched };
}
