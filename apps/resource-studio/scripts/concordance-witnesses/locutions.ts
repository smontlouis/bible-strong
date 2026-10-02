/**
 * Concordance.bible exports a locution ("parce qu’", "de peur que") twice: the
 * CSV tags one word of it (its main word: « peur », « sommeil »), the OSIS tags
 * every word and groups them with `type="x-split-N"`. A witness carries the
 * whole locution when the CSV tag is widened over the other words of its OSIS
 * group, so that one `<w>` element spans the locution and still counts as one
 * occurrence.
 */

/** One OSIS word, or one locution group with all its words. */
interface OsisUnit {
  strongs: string;
  words: string[];
  /** Surface before / after each word inside the locution. */
  prefixes: string[];
  suffixes: string[];
  /** Consecutive words sharing the same Strong numbers. */
  contiguous: boolean;
}

const WORD = /<w\b([^>]*)>([\s\S]*?)<\/w>/gu;
const strip = (markup: string) =>
  markup.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const normalizeStrongs = (value: string) =>
  value
    .split(/\s+/u)
    .filter(Boolean)
    .map((code) => code.replace(/^strong:/u, "").toUpperCase())
    .join(" ");

/** OSIS units of one verse body, in text order, notes excluded. */
export function osisUnits(body: string): OsisUnit[] {
  const text = body.replace(/<note\b[\s\S]*?<\/note>/gu, "");
  const words = [...text.matchAll(WORD)].map((match) => ({
    strongs: normalizeStrongs(
      /lemma="([^"]*)"/u.exec(match[1] ?? "")?.[1] ?? ""
    ),
    text: strip(match[2] ?? "").trim(),
    group: /type="(x-split-\d+)"/u.exec(match[1] ?? "")?.[1],
    start: match.index,
    end: match.index + match[0].length
  }));
  const units: OsisUnit[] = [];
  const seen = new Set<string>();
  for (const [index, word] of words.entries()) {
    if (!word.group) {
      units.push({
        strongs: word.strongs,
        words: [word.text],
        prefixes: [""],
        suffixes: [""],
        contiguous: true
      });
      continue;
    }
    if (seen.has(word.group)) continue;
    seen.add(word.group);
    const members = words.filter((other) => other.group === word.group);
    const last = members.at(-1)!;
    // Consecutive tagged words with no other word in between (« ne … point »
    // is not a contiguous locution), all bearing the head's Strong numbers.
    const contiguous =
      words.indexOf(last) - index + 1 === members.length &&
      members.every((member) => member.strongs === word.strongs) &&
      members
        .slice(1)
        .every(
          (member, offset) =>
            !/[\p{L}\p{N}]/u.test(
              strip(text.slice(members[offset]!.end, member.start))
            )
        );
    units.push({
      strongs: word.strongs,
      words: members.map((member) => member.text),
      prefixes: members.map((member) =>
        strip(text.slice(word.start, member.start))
      ),
      suffixes: members.map((member) =>
        strip(text.slice(member.end, last.end))
      ),
      contiguous
    });
  }
  return units;
}

export interface LocutionExtension {
  text: string;
  extended: number;
  /** Groups left on one word (discontinuous or not found verbatim). */
  headOnly: number;
  mismatch?: string;
}

/**
 * Widens the CSV tags of a verse over their locutions. The verse is left
 * untouched when its tags do not align one to one with the OSIS units.
 */
export function extendLocutions(
  csvText: string,
  osisBody: string
): LocutionExtension {
  const units = osisUnits(osisBody);
  const groups = units.filter((unit) => unit.words.length > 1).length;
  const csv = [...csvText.matchAll(WORD)].map((match) => ({
    open: match[0].slice(0, match[0].length - (match[2] ?? "").length - 4),
    inner: match[2] ?? "",
    strongs: normalizeStrongs(
      /strong="([^"]*)"/u.exec(match[1] ?? "")?.[1] ?? ""
    ),
    text: strip(match[2] ?? "").trim(),
    start: match.index,
    end: match.index + match[0].length
  }));
  const unchanged = (mismatch: string): LocutionExtension => ({
    text: csvText,
    extended: 0,
    headOnly: groups,
    mismatch
  });
  if (units.length !== csv.length)
    return unchanged(`word-count:${csv.length}/${units.length}`);
  const members: number[] = [];
  for (const [index, unit] of units.entries()) {
    const word = csv[index]!;
    const member = unit.words.indexOf(word.text);
    if (unit.strongs !== word.strongs || member < 0)
      return unchanged(`word:${index}`);
    members.push(member);
  }
  let text = csvText;
  let extended = 0;
  // Right to left, so that earlier offsets stay valid.
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index]!;
    if (unit.words.length < 2 || !unit.contiguous) continue;
    const word = csv[index]!;
    const prefix = unit.prefixes[members[index]!]!;
    const suffix = unit.suffixes[members[index]!]!;
    const before = text.slice(word.start - prefix.length, word.start);
    const after = text.slice(word.end, word.end + suffix.length);
    if (before !== prefix || after !== suffix) continue;
    // `head` keeps the word the CSV tagged: it alone represents the
    // occurrence wherever words are counted or learned one by one.
    text =
      text.slice(0, word.start - prefix.length) +
      word.open.replace(/>$/u, ` head="${word.text}">`) +
      prefix +
      word.inner +
      suffix +
      "</w>" +
      text.slice(word.end + suffix.length);
    extended += 1;
  }
  return { text, extended, headOnly: groups - extended };
}
