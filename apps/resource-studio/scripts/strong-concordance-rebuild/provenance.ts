/**
 * Evaluator-side provenance and editorial-proximity measurements. They describe
 * the references and the witnesses; they never feed the prediction step.
 */
import { readFile } from "node:fs/promises";
import { readBibleJson } from "../../src/bibleJson.js";
import {
  extractGoldCarrierPlacements,
  scoreCarrierAwareVerse
} from "../../src/evaluateStrongGold.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import { rawPathFor } from "./acquire.js";
import {
  alignTokenSequences,
  goldVerseFromConcordance,
  parseChapterForGold,
  wordTokens
} from "./gold.js";
import { goldPlacements, summarizeCarriers } from "./score.js";
import { ACQUISITION_ROOT, EDITIONS } from "./shared.js";

/** Current site annotations of a witness compared with the local CSV snapshot. */
export async function compareWitnessSnapshot(options: {
  witness: "Sg1910" | "Darby" | "DarbyR";
  chapters: string[];
  acquisitionRoot?: string;
}) {
  const csv = new Map(
    (await readStrongCsv(EDITIONS[options.witness].localText.path)).map(
      (row) => [
        `${row.bookId}.${row.chapter}.${row.verse}`,
        withoutPublisherNotes(row.text)
      ]
    )
  );
  const evaluations = [];
  const textDifferences: Array<{ ref: string; differences: unknown }> = [];
  let missing = 0;
  for (const chapter of options.chapters) {
    const html = await readFile(
      rawPathFor(
        options.acquisitionRoot ?? ACQUISITION_ROOT,
        options.witness,
        chapter
      ),
      "utf8"
    );
    for (const verse of parseChapterForGold(html, chapter).verses) {
      const ref = `${chapter}.${verse.verse}`;
      const tagged = csv.get(ref);
      if (tagged === undefined) {
        missing += 1;
        continue;
      }
      const gold = goldVerseFromConcordance({
        ref,
        verse,
        localText: stripTags(tagged)
      });
      if (gold.textDifferences.length)
        textDifferences.push({ ref, differences: gold.textDifferences });
      evaluations.push(
        scoreCarrierAwareVerse(
          ref,
          goldPlacements(gold),
          extractGoldCarrierPlacements(tagged)
        )
      );
    }
  }
  return {
    witness: options.witness,
    chapters: options.chapters,
    verses: evaluations.length,
    missingInCsv: missing,
    textDifferenceVerses: textDifferences.length,
    textDifferences: textDifferences.slice(0, 20),
    /** Site carriers scored against the CSV carriers (site = "predicted"). */
    siteVersusCsv: summarizeCarriers(evaluations)
  };
}

/** Token-level similarity of two verse texts (aligned share of both sides). */
export function textSimilarity(left: string, right: string): number {
  const a = wordTokens(left).map((token) => token.normalized);
  const b = wordTokens(right).map((token) => token.normalized);
  if (!a.length && !b.length) return 1;
  const aligned = alignTokenSequences(a, b).filter(
    (value) => value !== null
  ).length;
  return (2 * aligned) / (a.length + b.length);
}

/** Mean verse-level text similarity between editions over planned chapters. */
export async function editorialTextProximity(chapters: string[]) {
  const planned = new Set(chapters);
  const texts: Record<string, Map<string, string>> = {};
  for (const witness of ["Sg1910", "Darby", "DarbyR"] as const) {
    texts[witness] = new Map(
      (await readStrongCsv(EDITIONS[witness].localText.path))
        .filter((row) => planned.has(`${row.bookId}.${row.chapter}`))
        .map((row) => [
          `${row.bookId}.${row.chapter}.${row.verse}`,
          stripTags(withoutPublisherNotes(row.text))
        ])
    );
  }
  texts.SG21 = new Map(
    (await readBibleJson("data/bibles/bible-s21.json"))
      .filter((verse) => planned.has(`${verse.bookId}.${verse.chapter}`))
      .map((verse) => [
        `${verse.bookId}.${verse.chapter}.${verse.verse}`,
        verse.text
      ])
  );
  // NEG79 is compared on canonical refs through its identity-like blocks.
  const manifest = JSON.parse(
    await readFile("data/bibles/bible-neg79-verse-correspondence.json", "utf8")
  ) as { blocks: Array<{ targetRefs: string[]; canonicalRefs: string[] }> };
  const neg = new Map(
    (await readBibleJson("data/bibles/bible-neg79.json")).map((verse) => [
      `${verse.bookId}.${verse.chapter}.${verse.verse}`,
      verse.text
    ])
  );
  texts.NEG = new Map();
  for (const block of manifest.blocks)
    if (block.targetRefs.length === 1 && block.canonicalRefs.length === 1) {
      const canonical = block.canonicalRefs[0]!;
      const text = neg.get(block.targetRefs[0]!);
      if (
        planned.has(canonical.split(".").slice(0, 2).join(".")) &&
        text?.trim()
      )
        texts.NEG.set(canonical, text);
    }
  const pairs: Array<[string, string]> = [
    ["SG21", "Sg1910"],
    ["NEG", "Sg1910"],
    ["SG21", "NEG"],
    ["SG21", "Darby"],
    ["NEG", "Darby"],
    ["Darby", "DarbyR"],
    ["Sg1910", "Darby"]
  ];
  return pairs.map(([left, right]) => {
    const values: number[] = [];
    let identical = 0;
    for (const [ref, text] of texts[left]!) {
      const other = texts[right]!.get(ref);
      if (other === undefined) continue;
      const similarity = textSimilarity(text, other);
      values.push(similarity);
      if (similarity === 1) identical += 1;
    }
    return {
      pair: `${left}~${right}`,
      verses: values.length,
      meanTokenSimilarity:
        Math.round(
          (values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)) *
            10000
        ) / 10000,
      identicalVerses: identical
    };
  });
}

/**
 * Share of reference carriers that a pure lexical transfer from one witness
 * could reproduce: same Strong on a witness word with the same normalized form.
 * Describes editorial proximity; computed on development chapters only.
 */
export async function referenceTransferability(options: {
  edition: "SG21" | "NEG";
  chapters: string[];
  acquisitionRoot?: string;
}) {
  const { concordanceReference } = await import("./score.js");
  const reference = await concordanceReference(
    options.edition,
    options.chapters,
    options.acquisitionRoot
  );
  const witnesses: Record<string, Map<string, string>> = {};
  for (const witness of ["Sg1910", "Darby", "DarbyR"] as const)
    witnesses[witness] = new Map(
      (await readStrongCsv(EDITIONS[witness].localText.path)).map((row) => [
        `${row.bookId}.${row.chapter}.${row.verse}`,
        withoutPublisherNotes(row.text)
      ])
    );
  const local =
    options.edition === "SG21"
      ? new Map(
          (await readBibleJson("data/bibles/bible-s21.json")).map((verse) => [
            `${verse.bookId}.${verse.chapter}.${verse.verse}`,
            verse.text
          ])
        )
      : new Map(
          (await readBibleJson("data/bibles/bible-neg79.json")).map((verse) => [
            `${verse.bookId}.${verse.chapter}.${verse.verse}`,
            verse.text
          ])
        );
  const result: Record<
    string,
    {
      visible: number;
      sameFormSameStrong: number;
      strongPresentInVerse: number;
    }
  > = {};
  for (const witness of Object.keys(witnesses))
    result[witness] = {
      visible: 0,
      sameFormSameStrong: 0,
      strongPresentInVerse: 0
    };
  let empties = 0;
  const emptyAgreement: Record<string, number> = {
    Sg1910: 0,
    Darby: 0,
    DarbyR: 0
  };
  for (const verse of reference.verses) {
    const text = local.get(verse.nativeRef ?? verse.ref) ?? "";
    const tokens = wordTokens(text);
    for (const [witness, map] of Object.entries(witnesses)) {
      const tagged = map.get(verse.ref);
      if (!tagged) continue;
      const witnessTokens = wordTokens(stripTags(tagged));
      const placements = extractGoldCarrierPlacements(tagged);
      const formsByStrong = new Map<string, Set<string>>();
      const emptyStrongs = new Set<string>();
      for (const placement of placements) {
        if (placement.kind === "empty") {
          emptyStrongs.add(placement.strong);
          continue;
        }
        const forms = formsByStrong.get(placement.strong) ?? new Set<string>();
        for (
          let index = placement.startWordIndex!;
          index <= placement.endWordIndex!;
          index += 1
        )
          forms.add(witnessTokens[index]?.normalized ?? "");
        formsByStrong.set(placement.strong, forms);
      }
      for (const occurrence of verse.gold.occurrences) {
        if (occurrence.kind === "empty") {
          if (witness === "Sg1910") empties += 1;
          if (emptyStrongs.has(occurrence.strong))
            emptyAgreement[witness]! += 1;
          continue;
        }
        result[witness]!.visible += 1;
        const forms = formsByStrong.get(occurrence.strong);
        if (forms || emptyStrongs.has(occurrence.strong))
          result[witness]!.strongPresentInVerse += 1;
        if (
          forms &&
          occurrence.tokenIndices.some((index) =>
            forms.has(tokens[index]?.normalized ?? "")
          )
        )
          result[witness]!.sameFormSameStrong += 1;
      }
    }
  }
  return {
    edition: options.edition,
    verses: reference.verses.length,
    visibleOccurrencesByWitness: result,
    referenceEmpties: empties,
    emptiesAlsoEmptyInWitness: emptyAgreement
  };
}
