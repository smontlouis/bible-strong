/**
 * Strong identifiers that the reusable witnesses (LSG, Darby, DarbyR, from
 * Concordance.bible) give to a source word where STEP gives another one.
 *
 * A witness tag names its source word (`pos`, the STEP word number). When the
 * tag's Strong is not one of the STEP identifiers of that word, the pair
 * (STEP identifier → witness identifier) is counted. A pair becomes a family
 * when it is a numbering convention rather than a variant reading or a slip:
 * the witnesses use it in several verses, the STEP lexicon relates the two
 * identifiers, and they almost never name two different words of one verse
 * (εἶδον: G6063 or G1492 for STEP, G1492 or G3708 for Concordance).
 *
 *   yarn exec tsx scripts/strong-identifier-families/derive.ts [--write]
 */
import { writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { format, resolveConfig } from "prettier";
import { readStepOriginalTokens } from "../../src/stepOriginals.js";
import { parseStrongTokens, readStrongCsv } from "../../src/strongCsv.js";
import { normalizeOriginalStrong } from "../../src/originalSource.js";

const STEP_FILES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
];
const WITNESSES = ["Sg1910", "Darby", "DarbyR"] as const;
const LEXICON = "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const OUTPUT = "src/strongIdentifierFamilies.ts";

/** Selection: a convention, not a variant reading or an annotation slip. */
export const FAMILY_RULE = {
  /** Distinct verses where the witnesses use the other identifier. */
  minVerses: 5,
  /** Share of the witness tags on such STEP words that use it. */
  minShare: 0.02,
  /** Share of the verses holding either identifier where both name separate words. */
  maxCooccurrence: 0.05
} as const;

export interface FamilyCandidate {
  step: string;
  witness: string;
  tags: number;
  verses: number;
  share: number;
  /** STEP lexicon relation between the two identifiers, if any. */
  relation: string | null;
  cooccurrence: number;
}

const baseCode = (code: string) =>
  (code.match(/^([GH])0*(\d+)/u) ?? [])
    .slice(1, 3)
    .map((part, index) => (index ? part.padStart(4, "0") : part))
    .join("");

/** Identifier pairs that the STEP lexicon relates (same entry, form, derivation). */
function lexiconRelations(): Map<string, Map<string, string>> {
  const db = new DatabaseSync(LEXICON, { readOnly: true });
  const related = new Map<string, Map<string, string>>();
  const relate = (left: string, right: string, kind: string) => {
    for (const [from, to] of [
      [left, right],
      [right, left]
    ] as const) {
      if (!from || !to || from === to) continue;
      const map = related.get(from) ?? new Map<string, string>();
      if (!map.has(to)) map.set(to, kind);
      related.set(from, map);
    }
  };
  const unified = new Map<string, Set<string>>();
  for (const row of db
    .prepare("select eStrong, uStrong from StepEntries")
    .all() as Array<{ eStrong: string; uStrong: string }>) {
    const group = unified.get(baseCode(row.uStrong)) ?? new Set<string>();
    group.add(baseCode(row.eStrong));
    group.add(baseCode(row.uStrong));
    unified.set(baseCode(row.uStrong), group);
  }
  for (const group of unified.values())
    for (const left of group)
      for (const right of group) relate(left, right, "same-ustrong");
  for (const row of db
    .prepare(
      "select f.eStrong as e, r.toStepCode as t, r.groupKind as g, r.relationKind as k from LexiconRelations r join StepEntries f on f.id = r.fromStepEntryId where r.groupKind in ('identity', 'family')"
    )
    .all() as Array<{ e: string; t: string; g: string; k: string }>)
    relate(baseCode(row.e), baseCode(row.t), `${row.g}:${row.k}`);
  db.close();
  return related;
}

export async function familyCandidates(): Promise<FamilyCandidate[]> {
  const bases = new Map<string, Set<string>>();
  const verses = new Map<string, Array<Set<string>>>();
  for (const file of STEP_FILES)
    for (const token of await readStepOriginalTokens(file)) {
      const codes = new Set(token.strongByBase.keys());
      for (const ref of [token.ref, ...token.alternateRefs]) {
        const key = `${ref}#${token.tokenIndex}`;
        if (!bases.has(key)) bases.set(key, codes);
      }
      verses.set(token.ref, [...(verses.get(token.ref) ?? []), codes]);
    }
  // Verses where both identifiers name different words, among those with either.
  const cooccurrence = (left: string, right: string) => {
    let both = 0;
    let either = 0;
    for (const words of verses.values()) {
      const hasLeft = words.some((w) => w.has(left) && !w.has(right));
      const hasRight = words.some((w) => w.has(right) && !w.has(left));
      if (hasLeft || hasRight) either += 1;
      if (hasLeft && hasRight) both += 1;
    }
    return either ? both / either : 0;
  };
  const relations = lexiconRelations();
  const tagsOnStep = new Map<string, number>();
  const pairs = new Map<string, { tags: number; verses: Set<string> }>();
  for (const witness of WITNESSES)
    for (const row of await readStrongCsv(`data/strongs/${witness}.csv`)) {
      const ref = `${row.bookId}.${row.chapter}.${row.verse}`;
      for (const token of parseStrongTokens(row.text)) {
        const positions = token.positions ?? [];
        if (!positions.length || positions.length !== token.strong.length)
          continue;
        token.strong.forEach((raw, index) => {
          const strong = normalizeOriginalStrong(raw);
          const step = bases.get(`${ref}#${positions[index]}`);
          if (!strong || !step) return;
          for (const code of step)
            tagsOnStep.set(code, (tagsOnStep.get(code) ?? 0) + 1);
          if (step.has(strong)) return;
          for (const code of step) {
            const key = `${code}>${strong}`;
            const pair = pairs.get(key) ?? { tags: 0, verses: new Set() };
            pair.tags += 1;
            pair.verses.add(ref);
            pairs.set(key, pair);
          }
        });
      }
    }
  return [...pairs]
    .filter(([, pair]) => pair.verses.size >= FAMILY_RULE.minVerses)
    .map(([key, pair]) => {
      const [step, witness] = key.split(">") as [string, string];
      const relation = relations.get(step)?.get(witness) ?? null;
      return {
        step,
        witness,
        tags: pair.tags,
        verses: pair.verses.size,
        share: pair.tags / (tagsOnStep.get(step) ?? pair.tags),
        relation,
        cooccurrence: relation ? cooccurrence(step, witness) : 1
      };
    })
    .sort((left, right) => right.tags - left.tags);
}

export const isFamily = (candidate: FamilyCandidate) =>
  candidate.step.slice(0, 1) === candidate.witness.slice(0, 1) &&
  candidate.verses >= FAMILY_RULE.minVerses &&
  candidate.share >= FAMILY_RULE.minShare &&
  candidate.relation !== null &&
  candidate.cooccurrence < FAMILY_RULE.maxCooccurrence;

if (process.argv[1]?.endsWith("derive.ts")) {
  const candidates = await familyCandidates();
  const families = candidates.filter(isFamily);
  for (const candidate of candidates.filter(
    (candidate) => candidate.relation !== null
  ))
    console.log(
      `${isFamily(candidate) ? "✓" : " "} ${candidate.step} → ${candidate.witness}  verses=${candidate.verses} share=${candidate.share.toFixed(3)} cooccurrence=${candidate.cooccurrence.toFixed(3)} ${candidate.relation}`
    );
  console.log(`${families.length} families`);
  if (process.argv.includes("--write")) {
    const aliases = new Map<string, string[]>();
    for (const family of families)
      aliases.set(family.step, [
        ...(aliases.get(family.step) ?? []),
        family.witness
      ]);
    const body = [...aliases]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([step, witness]) =>
          `  [${JSON.stringify(step)}, ${JSON.stringify(witness.sort())}]`
      )
      .join(",\n");
    const source = `/**
 * Strong identifiers that the reusable witnesses give to a source word that
 * STEP numbers otherwise (STEP identifier → witness identifiers). Generated
 * by scripts/strong-identifier-families/derive.ts: do not edit.
 */
export const STRONG_IDENTIFIER_ALIASES: ReadonlyMap<
  string,
  readonly string[]
> = new Map([
${body}
]);
`;
    await writeFile(
      OUTPUT,
      await format(source, {
        ...(await resolveConfig(OUTPUT)),
        filepath: OUTPUT
      })
    );
    console.log(`wrote ${OUTPUT}`);
  }
}
