import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  bibleComChapterUrl,
  parseProviderChapterHeadingNotes,
  type ProviderHeadingSegment
} from "./bibleSourcePatches.js";
import { providerAnswer } from "./bibleSourcePatchesCli.js";
import {
  hashHeadingText,
  type LegacyPericopeRepair,
  type LegacyPericopeRepairSet
} from "./legacyBiblePublication.js";
import {
  LEGACY_PERICOPE_REPAIRS_PATH,
  loadBiblePericope,
  loadBibleText,
  readLegacyPericopeRepairs
} from "./wordsOfJesusSources.js";

const PROVIDER_CACHE_DIR = "outputs/bible-sources/provider-cache/bible.com";

/**
 * The bible.com edition each historical pericope file was read from. FRC97 is
 * no longer served; its headings with notes are those of BFC, character for
 * character, and are read there.
 */
const PROVIDER_VERSIONS: Record<string, { id: number; name: string }> = {
  BDS: { id: 21, name: "BDS" },
  BFC: { id: 63, name: "BFC" },
  EASY: { id: 2079, name: "EASY" },
  FRC97: { id: 63, name: "BFC" },
  NET: { id: 107, name: "NET" },
  NFC: { id: 2367, name: "NFC" }
};

const USFM_BOOK_CODES = (
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB " +
  "PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP " +
  "HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI " +
  "2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split(" ");

/** NET opens each note with its kind: study, translator's, text-critical. */
const NET_NOTE_KIND = /^\s*(?:sn|tn|tc|map)\s+/u;

type LegacyPericope = Record<
  string,
  Record<string, Record<string, Record<string, string>>>
>;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * A pattern that reads `value` whatever its spacing and its apostrophes: an
 * edition may space its punctuation (`23 :`) or curl its apostrophes where
 * the provider does not.
 */
const looseText = (value: string) =>
  [...value.replace(/\s+/gu, "")]
    .map((character) =>
      character === "'" || character === "’" ? "['’]" : escapeRegExp(character)
    )
    .join("\\s*");

/** Matches `value` at `cursor` of `text`, or fails. Returns where it ends. */
const read = (text: string, cursor: number, value: string, key: string) => {
  const pattern = new RegExp(`\\s*${looseText(value)}`, "uy");
  pattern.lastIndex = cursor;
  if (!pattern.exec(text))
    throw new Error(`legacy-pericope-note-alignment:${key}:${cursor}`);
  return pattern.lastIndex;
};

const flatten = (segments: ProviderHeadingSegment[]) =>
  segments
    .map((segment) =>
      segment.kind === "text"
        ? segment.text
        : segment.label +
          segment.anchor +
          segment.parts.map((part) => part.text).join("")
    )
    .join("");

const collapse = (value: string) =>
  value.replace(/\s+/gu, "").replaceAll("’", "'");

/** The verse of the heading's chapter a note anchor names, if any. */
const anchoredVerse = (anchor: string, chapter: string) => {
  const match = /^\s*(\d+)[.:](\d+)/u.exec(anchor);
  return match && match[1] === chapter && Number(match[2]) > 0
    ? String(Number(match[2]))
    : undefined;
};

/**
 * Reads where the notes of one flattened heading start and end, from the
 * provider heading it was flattened from.
 */
function noteRepair(options: {
  text: string;
  segments: ProviderHeadingSegment[];
  ref: string;
  level: LegacyPericopeRepair["level"];
  provider: { url: string; sha256: string; name: string };
}): LegacyPericopeRepair {
  const { text, segments, ref } = options;
  const [, chapter, headingVerse] = ref.split("-") as [string, string, string];
  const key = `${ref}:${options.level}`;
  const remove: Array<[number, number]> = [];
  const notes: Array<{ at: [number, number]; verse: string }> = [];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.kind === "text") {
      if (segment.text.trim()) cursor = read(text, cursor, segment.text, key);
      continue;
    }
    // The label opens the note where the title stops, spaces kept on the title.
    while (/\s/u.test(text[cursor] ?? "")) cursor += 1;
    const start = cursor;
    cursor = read(text, cursor, segment.label, key);
    if (segment.anchor.trim()) cursor = read(text, cursor, segment.anchor, key);
    const verse = anchoredVerse(segment.anchor, chapter) ?? headingVerse;
    // A NET note may hold several notes, each opening with its kind.
    let note: { start: number; end: number } | undefined;
    for (const part of segment.parts) {
      if (!part.text.trim()) continue;
      const partStart = cursor;
      cursor = read(text, cursor, part.text, key);
      const opens = !note || NET_NOTE_KIND.test(part.text);
      if (opens) {
        if (note) notes.push({ at: [note.start, note.end], verse });
        const kind = NET_NOTE_KIND.exec(text.slice(partStart));
        note = { start: partStart + (kind?.[0].length ?? 0), end: cursor };
      } else if (note) note.end = cursor;
    }
    if (!note) throw new Error(`legacy-pericope-note-empty:${key}`);
    notes.push({ at: [note.start, note.end], verse });
    remove.push([start, cursor]);
  }
  if (text.slice(cursor).trim())
    throw new Error(`legacy-pericope-note-alignment:${key}:${cursor}`);
  return {
    op: "notes",
    ref,
    level: options.level,
    expect: hashHeadingText(text),
    remove,
    notes,
    provider: { url: options.provider.url, sha256: options.provider.sha256 },
    evidence: `The source flattened this heading with ${notes.length === 1 ? "its note" : `its ${notes.length} notes`} inline behind their label; bible.com ${options.provider.name} marks where each one starts and ends.`
  };
}

export async function draftLegacyPericopeNoteRepairs(options: {
  root: string;
  versionIds: readonly string[];
  fetchMissing: boolean;
}) {
  const config = await readLegacyPericopeRepairs(options.root);
  const report: Record<
    string,
    { repaired: number; unmatched: string[]; unpublished: string[] }
  > = {};
  for (const versionId of options.versionIds) {
    const provider = PROVIDER_VERSIONS[versionId];
    if (!provider)
      throw new Error(`legacy-pericope-note-provider-unknown:${versionId}`);
    const loaded = await loadBiblePericope(versionId, { root: options.root });
    if (!loaded)
      throw new Error(`legacy-pericope-note-pericope-missing:${versionId}`);
    const pericope = loaded.pericope as LegacyPericope;
    const repairs: LegacyPericopeRepair[] = [];
    const unmatched: string[] = [];
    // A heading over a verse the Bible lacks is never published: no repair.
    const unpublished: string[] = [];
    const published = (await loadBibleText(versionId, { root: options.root }))
      .publication.verses;
    for (const [book, chapters] of Object.entries(pericope)) {
      for (const [chapter, verses] of Object.entries(chapters)) {
        const flattened = Object.entries(verses).flatMap(([verse, levels]) =>
          Object.entries(levels)
            .filter(
              ([, text]) => typeof text === "string" && text.includes("#")
            )
            .map(([level, text]) => ({ verse, level, text }))
        );
        if (flattened.length === 0) continue;
        const reference = `${USFM_BOOK_CODES[Number(book) - 1]}.${chapter}`;
        const body = await providerAnswer({
          cacheDir: path.join(options.root, PROVIDER_CACHE_DIR),
          versionId: provider.id,
          reference,
          fetchMissing: options.fetchMissing
        });
        const headings = parseProviderChapterHeadingNotes(
          (JSON.parse(body) as { content: string }).content
        );
        for (const { verse, level, text } of flattened) {
          const ref = `${book}-${chapter}-${verse}`;
          if (!published[book]?.[chapter]?.[verse]) {
            unpublished.push(`${ref}:${level}`);
            continue;
          }
          const segments = headings.find(
            (candidate) => collapse(flatten(candidate)) === collapse(text)
          );
          if (!segments) {
            unmatched.push(`${ref}:${level}`);
            continue;
          }
          repairs.push(
            noteRepair({
              text,
              segments,
              ref,
              level: level as LegacyPericopeRepair["level"],
              provider: {
                url: bibleComChapterUrl(provider.id, reference),
                sha256: createHash("sha256").update(body).digest("hex"),
                name: provider.name
              }
            })
          );
        }
      }
    }
    const existing: LegacyPericopeRepairSet | undefined =
      config.bibles[versionId];
    if (existing && existing.pericopeSha256 !== loaded.sha256)
      throw new Error(`legacy-pericope-repairs-source-mismatch:${versionId}`);
    config.bibles[versionId] = {
      pericopeSha256: loaded.sha256,
      repairs: [
        ...(existing?.repairs ?? []).filter((repair) => repair.op !== "notes"),
        ...repairs
      ]
    };
    report[versionId] = { repaired: repairs.length, unmatched, unpublished };
  }
  await writeFile(
    path.join(options.root, LEGACY_PERICOPE_REPAIRS_PATH),
    `${JSON.stringify(config, null, 2)}\n`
  );
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf("--version");
  const versionIds = (versionIndex >= 0 ? (args[versionIndex + 1] ?? "") : "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (versionIds.length === 0)
    throw new Error("legacy-pericope-note-version-required");
  const report = await draftLegacyPericopeNoteRepairs({
    root: process.cwd(),
    versionIds,
    fetchMissing: args.includes("--fetch")
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (Object.values(report).some((entry) => entry.unmatched.length > 0))
    process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
