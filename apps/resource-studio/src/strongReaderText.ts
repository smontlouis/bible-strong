/** Benchmark projection: remove publisher-note subtrees before stripping display markup. */
export function withoutPublisherNotes(input: string): string {
  let depth = 0,
    cursor = 0,
    output = "";
  for (const match of input.matchAll(/<\/?note\b[^>]*>/giu)) {
    if (depth === 0) output += input.slice(cursor, match.index);
    if (/^<\/note\b/iu.test(match[0])) {
      if (depth === 0) throw new Error("unmatched-note-close");
      depth--;
    } else if (!/\/\s*>$/u.test(match[0])) depth++;
    cursor = match.index! + match[0].length;
  }
  if (depth) throw new Error("unclosed-note");
  return output + input.slice(cursor);
}
