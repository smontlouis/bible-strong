export type TextSegment =
  | {
      kind: "word";
      text: string;
      normalized: string;
    }
  | {
      kind: "text";
      text: string;
    };

const WORD_PATTERN =
  /[\p{L}\p{M}\p{N}]+(?:(?:[’']|[‐‑‒–—-])[\p{L}\p{M}\p{N}]+)*/gu;

const FRENCH_ELISIONS = new Set(["c", "d", "j", "l", "m", "n", "qu", "s", "t"]);

export function normalizeWord(input: string): string {
  const lowered = input
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[‐‑‒–—-]/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}'’-]+/gu, "");

  const elision = lowered.match(/^([a-z]+)[’'](.+)$/u);
  if (elision && FRENCH_ELISIONS.has(elision[1] ?? "")) {
    return elision[2] ?? lowered;
  }

  return lowered;
}

export function tokenizeText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    const index = match.index ?? 0;
    const word = match[0];

    if (index > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, index) });
    }

    segments.push({
      kind: "word",
      text: word,
      normalized: normalizeWord(word)
    });

    cursor = index + word.length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments;
}

export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
