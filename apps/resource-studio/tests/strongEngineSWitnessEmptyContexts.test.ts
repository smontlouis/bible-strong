import assert from "node:assert/strict";
import test from "node:test";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import { assertResolutionKeptReader } from "../src/strongAutonomous.js";
import {
  emptyResolutionReaderChanges,
  resolveCanonicalVerse
} from "../src/strongCanonicalResolution.js";
import { extractGoldCarrierPlacements } from "../src/strongCarriers.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import type {
  StrongLedger,
  StrongLedgerAnnotation,
  StrongLedgerMetrics,
  StrongLedgerVerse
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import type { ResolutionCarrier } from "../src/strongResolution.js";
import {
  proposeWitnessEmpties,
  resolveDossier,
  type ResolutionDossier
} from "../src/strongResolutionWorkflow.js";
import {
  buildWitnessRenderingLexicon,
  overriddenWords,
  proposeWitnessEmptyContexts,
  WITNESS_EMPTY_OVERRIDES_CARRIER
} from "../src/strongWitnessEmptyContexts.js";
import { stripTags, tokenizeText } from "../src/tokenize.js";

const words = (text: string) =>
  tokenizeText(text)
    .filter((t) => t.kind === "word")
    .map((t) => t.text);

const witness = (name: string, ref: string, tagged: string) => {
  const text = stripTags(tagged);
  return {
    name,
    family: name === "Sg1910" ? "Sg1910" : "Darby-family",
    ref,
    text,
    words: words(text),
    placements: extractGoldCarrierPlacements(tagged).map((p, i) => ({
      ...p,
      id: `${name}:${i}`
    }))
  };
};

const corpus = (ref: string) => (ref.startsWith("Gen.") ? "TAHOT" : "TAGNT");
const occurrence = (ref: string, position: number) =>
  `${corpus(ref)}.${ref}.${position}.N.main:0`;

const unit = (
  ref: string,
  position: number,
  strong: string,
  morphology = "N-NSF"
): ResolutionDossier["units"][number] => ({
  unit: {
    id: `${corpus(ref)}.${ref}.${position}.N`,
    occurrenceIds: [occurrence(ref, position)],
    strong: [strong],
    readingUnresolved: false,
    sourceEvidenceSha256: "fixture"
  },
  surface: "",
  gloss: "",
  morphology,
  sourceFile: "fixture",
  sourceLine: position
});

const carrier = (
  ref: string,
  position: number,
  strong: string,
  word: number
): ResolutionCarrier => ({
  id: `${strong}@${position}`,
  strong,
  originalOccurrenceId: occurrence(ref, position),
  kind: "word",
  startWordIndex: word,
  endWordIndex: word
});

const dossier = (
  ref: string,
  text: string,
  units: ResolutionDossier["units"],
  placements: ResolutionCarrier[],
  witnesses: ResolutionDossier["witnesses"]
): ResolutionDossier => ({
  edition: "SG21",
  ref,
  split: "authoring",
  text,
  words: words(text),
  units,
  placements,
  witnesses
});

test("the witnesses' renderings of each Strong are counted over the Bible", () => {
  const lexicon = buildWitnessRenderingLexicon([
    '<w strong="G3767">alors</w> il <w strong="G3767 G1161">Alors</w> <w strong="G3767"></w>',
    '<w strong="G3767">en effet</w> <w strong="G3767">,</w>'
  ]);
  assert.equal(lexicon.get("G3767")?.get("alors"), 2);
  assert.equal(lexicon.get("G3767")?.get("en effet"), 1);
  assert.equal(lexicon.get("G1161")?.get("alors"), 1);
  // Empty and punctuation tags are not renderings.
  assert.equal(lexicon.get("G3767")?.size, 2);
});

// Matt.10.28: « faire périr ◎ l'âme et le corps » (καὶ ψυχὴν καὶ σῶμα).
const soulAndBody = (carriedEt: boolean) => {
  const ref = "Matt.10.28";
  return dossier(
    ref,
    "faire périr l'âme et le corps",
    [
      unit(ref, 3, "G0622", "V-AAN"),
      unit(ref, 4, "G2532", "CONJ"),
      unit(ref, 5, "G5590"),
      unit(ref, 6, "G2532", "CONJ"),
      unit(ref, 7, "G4983")
    ],
    [
      carrier(ref, 3, "G0622", 1),
      carrier(ref, 5, "G5590", 2),
      ...(carriedEt ? [carrier(ref, 6, "G2532", 3)] : []),
      carrier(ref, 7, "G4983", 5)
    ],
    [
      witness(
        "Sg1910",
        ref,
        'faire <w strong="G0622" pos="3">périr</w> <w strong="G2532" pos="4"></w><w strong="G5590" pos="5">l’âme</w> <w strong="G2532" pos="6">et</w> le <w strong="G4983" pos="7">corps</w>'
      ),
      witness(
        "Darby",
        ref,
        'faire <w strong="G0622" pos="3">périr</w> <w strong="G2532" pos="4">et</w> <w strong="G5590" pos="5">l’âme</w> <w strong="G2532" pos="6">et</w> le <w strong="G4983" pos="7">corps</w>'
      )
    ]
  );
};

test("a nearby rendering contradicts only when its words are free", () => {
  const d = soulAndBody(true);
  // G vetoes: Darby's « et » sits near the place.
  assert.deepEqual(proposeWitnessEmpties(d), []);
  assert.deepEqual(proposeWitnessEmptyContexts(d, new Set()), [
    {
      sourceUnitId: "TAGNT.Matt.10.28.4.N",
      insertAfterWordIndex: 1,
      witnesses: ["Sg1910"],
      families: ["Sg1910"],
      method: "witness-empty-context:rendering-carried-elsewhere"
    }
  ]);
  // A free « et » could be this καί: the word stays open.
  assert.deepEqual(
    proposeWitnessEmptyContexts(soulAndBody(false), new Set()),
    []
  );
});

// Matt.14.18: ὁ δὲ εἶπεν· Φέρετέ μοι ὧδε αὐτούς.
const bringThem = (target: string, morphology = "CONJ", extraVerse = false) => {
  const ref = "Matt.14.18";
  const w = words(target);
  const said = w.findIndex((t) => t === "dit");
  return dossier(
    ref,
    target,
    [
      unit(ref, 1, "G3588", "T-NSM"),
      unit(ref, 2, "G1161", morphology),
      unit(ref, 3, "G2036", "V-2AAI-3S"),
      unit(ref, 4, "G5342", "V-PAM-2P"),
      ...(extraVerse ? [unit("Matt.14.19", 1, "G2532", "CONJ")] : [])
    ],
    [
      carrier(ref, 3, "G2036", said),
      carrier(
        ref,
        4,
        "G5342",
        w.findIndex((t) => /^Apportez/u.test(t))
      )
    ],
    [
      witness(
        "Sg1910",
        ref,
        '<w strong="G1161" pos="2"></w>Il <w strong="G2036" pos="3">dit</w> : <w strong="G5342" pos="4">Apportez</w>-les-moi.'
      ),
      witness(
        "Darby",
        ref,
        '<w strong="G1161" pos="2">Et</w> il <w strong="G2036" pos="3">dit</w> : <w strong="G5342" pos="4">Apportez</w>-les-moi ici.'
      )
    ]
  );
};

test("a conjunction left out before the verse is out of a target opening without a connective", () => {
  const [proposal] = proposeWitnessEmptyContexts(
    bringThem("Apportez-les-moi ici, leur dit Jésus."),
    new Set()
  );
  assert.equal(proposal?.insertAfterWordIndex, -1);
  assert.equal(proposal?.method, "witness-empty-context:verse-start");
  assert.deepEqual(proposal?.witnesses, ["Sg1910"]);
  // The target writes a connective: it may carry the conjunction.
  for (const target of [
    "Et il dit : Apportez-les-moi ici.",
    "Pierre et Jean, il dit : Apportez-les-moi ici.",
    "De plus il dit : Apportez-les-moi ici.",
    "En effet il dit : Apportez-les-moi ici."
  ])
    assert.deepEqual(
      proposeWitnessEmptyContexts(bringThem(target), new Set()),
      [],
      target
    );
  // Conjunctions only, and only when the verse is the witness's verse.
  assert.deepEqual(
    proposeWitnessEmptyContexts(
      bringThem("Apportez-les-moi ici, leur dit Jésus.", "ADV"),
      new Set()
    ),
    []
  );
  assert.deepEqual(
    proposeWitnessEmptyContexts(
      bringThem("Apportez-les-moi ici, leur dit Jésus.", "CONJ", true),
      new Set()
    ),
    []
  );
});

test("« de plus » carried by another source word does not render the conjunction", () => {
  const d = bringThem("De plus il dit : Apportez-les-moi ici.");
  d.units.push(unit("Matt.14.18", 5, "G3441", "ADV"));
  d.placements.push({
    ...carrier("Matt.14.18", 5, "G3441", 0),
    kind: "phrase",
    endWordIndex: 1
  });
  assert.equal(
    proposeWitnessEmptyContexts(d, new Set())[0]?.insertAfterWordIndex,
    -1
  );
});

// Rom.13.12: ἡ νὺξ προέκοψεν, ἡ δὲ ἡμέρα ἤγγικεν.
const nightAndDay = (target: string, carriers: Record<number, number>) => {
  const ref = "Rom.13.12";
  return dossier(
    ref,
    target,
    [
      unit(ref, 2, "G3571"),
      unit(ref, 3, "G4298", "V-AAI-3S"),
      unit(ref, 4, "G3588", "T-NSF"),
      unit(ref, 5, "G1161", "CONJ"),
      unit(ref, 6, "G2250"),
      unit(ref, 7, "G1448", "V-RAI-3S")
    ],
    Object.entries({ G3571: 2, G4298: 3, G3588: 4, G2250: 6, G1448: 7 }).map(
      ([strong, position]) =>
        carrier(ref, position, strong, carriers[position]!)
    ),
    [
      witness(
        "Sg1910",
        ref,
        'La <w strong="G3571" pos="2">nuit</w> est <w strong="G4298" pos="3">avancée</w>, <w strong="G1161" pos="5"></w><w strong="G3588" pos="4">le</w> <w strong="G2250" pos="6">jour</w> <w strong="G1448" pos="7">approche</w>.'
      )
    ]
  );
};

test("a conjunction left out between two source words is out between our adjacent carriers", () => {
  const lexicon = buildWitnessRenderingLexicon([
    '<w strong="G1161">mais</w> <w strong="G1161">mais</w> <w strong="G1161">mais</w>'
  ]);
  const d = nightAndDay("La nuit est bien avancée, le jour approche.", {
    2: 1,
    3: 4,
    4: 5,
    6: 6,
    7: 7
  });
  // G finds no « est avancée » in the target.
  assert.deepEqual(proposeWitnessEmpties(d), []);
  const [proposal] = proposeWitnessEmptyContexts(d, new Set(), { lexicon });
  assert.equal(proposal?.insertAfterWordIndex, 4);
  assert.equal(proposal?.method, "witness-empty-context:adjacent-neighbours");
  // A word between our two carriers may be the conjunction.
  assert.deepEqual(
    proposeWitnessEmptyContexts(
      nightAndDay("La nuit est bien avancée, mais le jour approche.", {
        2: 1,
        3: 4,
        4: 6,
        6: 7,
        7: 8
      }),
      new Set(),
      { lexicon }
    ),
    []
  );
  // So may a free word nearby that the witnesses use for it.
  assert.deepEqual(
    proposeWitnessEmptyContexts(
      nightAndDay("La nuit mais avancée, le jour approche.", {
        2: 1,
        3: 3,
        4: 4,
        6: 5,
        7: 6
      }),
      new Set(),
      { lexicon }
    ),
    []
  );
});

// Gen.15.2: « Je m'en vais sans enfants, et ◎ l'héritier de mes biens… »
const heir = (options: {
  witnesses: Array<"Sg1910" | "Darby" | "DarbyR">;
  sibling?: boolean;
}) => {
  const ref = "Gen.15.2";
  const tagged = (name: string) =>
    witness(
      name,
      ref,
      'je m’en vais sans <w strong="H6185" pos="9">enfants</w>, et <w strong="H1121" pos="11"></w><w strong="H4943" pos="12">l’héritier</w> de ma maison'
    );
  const units = [unit(ref, 9, "H6185"), unit(ref, 11, "H1121")];
  if (options.sibling) units.push(unit(ref, 14, "H1121"));
  return dossier(
    ref,
    "Je m'en vais sans enfants, et l'héritier de mes biens",
    units,
    [
      carrier(ref, 9, "H6185", 4),
      // A learned carrier for בֵּן on « enfants ».
      { ...carrier(ref, 11, "H1121", 4), id: "learned" }
    ],
    options.witnesses.map(tagged)
  );
};

test("a carrier gives way when two witnesses only leave its word untranslated", () => {
  const d = heir({ witnesses: ["Sg1910", "DarbyR"] });
  const proposals = proposeWitnessEmptyContexts(d, new Set());
  assert.deepEqual(proposals, [
    {
      sourceUnitId: "TAHOT.Gen.15.2.11.N",
      insertAfterWordIndex: 5,
      witnesses: ["Sg1910", "DarbyR"],
      families: ["Darby-family", "Sg1910"],
      method: "witness-empty-overrides-carrier:same-context",
      overridesCarrier: true
    }
  ]);
  const resolved = resolveDossier(d, [], {
    applyExactWitness: false,
    applyAssistedReviews: false,
    applyWitnessEmpties: true,
    applyWitnessEmptyContexts: true
  });
  const decision = resolved.decisions.find(
    (r) => r.sourceUnitId === "TAHOT.Gen.15.2.11.N"
  );
  assert.equal(decision?.state, "empty");
  assert.equal(decision?.assurance, "witness-empty-transfer");
  assert.equal(
    decision?.reasons[0],
    "witness-empty-overrides-carrier:same-context:Sg1910+DarbyR"
  );
  assert(!resolved.placements.some((p) => p.id === "learned"));
  // One witness is not enough, and neither is a verse where another source
  // word has the same number (the carrier may be that word's).
  assert.deepEqual(
    proposeWitnessEmptyContexts(heir({ witnesses: ["Sg1910"] }), new Set()),
    []
  );
  assert.deepEqual(
    proposeWitnessEmptyContexts(
      heir({ witnesses: ["Sg1910", "DarbyR"], sibling: true }),
      new Set()
    ),
    []
  );
});

test("option S leaves the dossier untouched when it is off and G's own cases to G", () => {
  const d = soulAndBody(true);
  const off = resolveDossier(d, [], {
    applyExactWitness: false,
    applyAssistedReviews: false,
    applyWitnessEmpties: true
  });
  const on = resolveDossier(d, [], {
    applyExactWitness: false,
    applyAssistedReviews: false,
    applyWitnessEmpties: true,
    applyWitnessEmptyContexts: true
  });
  const unitId = "TAGNT.Matt.10.28.4.N";
  assert.equal(
    off.decisions.find((r) => r.sourceUnitId === unitId)?.state,
    "unresolved"
  );
  const decision = on.decisions.find((r) => r.sourceUnitId === unitId);
  assert.equal(decision?.state, "empty");
  assert.equal(
    decision?.reasons[0],
    "witness-empty-context:rendering-carried-elsewhere:Sg1910"
  );
  // Where G establishes the word, S proposes nothing more.
  const g = soulAndBody(true);
  g.witnesses = g.witnesses.filter((w) => w.name === "Sg1910");
  assert.equal(proposeWitnessEmpties(g).length, 1);
  assert.deepEqual(
    proposeWitnessEmptyContexts(
      g,
      new Set(proposeWitnessEmpties(g).map((p) => p.sourceUnitId))
    ),
    []
  );
});

/**
 * Gen.15.2 as the ledger resolves it: בֵּן has a learned reader carrier on
 * « biens », and two witnesses only leave it untranslated.
 */
function heirVerse() {
  const ref = "Gen.15.2";
  const rows = [
    "Gen.15.2#09=L\tעֲרִירִי\t\tchildless\t{H6185}\tHAamsa\t\t\t\t\t\t",
    "Gen.15.2#11=L\tבֶן\t\tson\t{H1121}\tHNcmsc\t\t\t\t\t\t"
  ].map((line, i) => parseSourceRow(line, "TAHOT fixture.txt", i + 1)!);
  const occurrences: OriginalStrongOccurrence[] = rows.map((row, i) => ({
    occurrenceId: `${row.id}.main:0`,
    tokenId: `${row.id}.main`,
    tokenIndex: i + 1,
    sourceIdentity: row.id,
    strong: row.primary[0]!,
    sourceStrong: row.primary[0]!,
    text: row.surface,
    gloss: row.gloss,
    lemma: row.surface,
    morph: i === 0 ? "HAamsa" : "HNcmsc",
    pos: ""
  }));
  const text = "Je m'en vais sans enfants, et l'héritier de mes biens";
  const tokens = words(text).map((word, wordIndex) => ({
    wordIndex,
    text: word,
    normalized: word.toLowerCase()
  }));
  const at = (word: string) => tokens.findIndex((t) => t.text === word);
  const annotation = (
    i: number,
    wordIndex: number,
    source: StrongLedgerAnnotation["source"]
  ): StrongLedgerAnnotation => ({
    id: `${ref}:${i}:${occurrences[i]!.strong}`,
    strong: occurrences[i]!.strong,
    visibility: "reader",
    placement: "word",
    source,
    confidence: 0.9,
    reason: "fixture",
    diagnostics: [source === "reference-transfer" ? "exact" : "learned"],
    wordIndex,
    originalOccurrenceId: occurrences[i]!.occurrenceId
  });
  const tagged =
    'je m’en vais sans <w strong="H6185" pos="9">enfants</w>, et <w strong="H1121" pos="11"></w><w strong="H4943" pos="12">l’héritier</w> de ma maison';
  const reference = (name: string) => ({
    name,
    family: name === "Sg1910" ? "Sg1910" : "Darby-family",
    verse: {
      row: { bookId: "Gen", chapter: 15, verse: 2, text: tagged },
      tokens: parseStrongTokens(tagged)
    }
  });
  const verse = {
    ref,
    text,
    tokens,
    annotations: [
      annotation(0, at("enfants"), "reference-transfer"),
      annotation(1, at("biens"), "reference-learned")
    ],
    inventories: {
      references: {},
      original: occurrences.map((o) => o.strong),
      reader: [],
      advanced: []
    }
  } as unknown as StrongLedgerVerse;
  return {
    bible: "s21",
    verse,
    input: {
      occurrences,
      references: [reference("Sg1910"), reference("DarbyR")],
      issues: []
    },
    sourceRows: new Map(rows.map((row) => [row.id, row])),
    lexicalItems: [],
    policy: { witnessEmpties: true, witnessEmptyContexts: true }
  };
}

test("a verse resolved again keeps S's override and its labels", () => {
  const f = heirVerse();
  const first = resolveCanonicalVerse(f);
  const son = (r: typeof first) =>
    r.decisions.find((d) => d.strong.includes("H1121"))!;
  assert.equal(son(first).state, "empty");
  assert.equal(son(first).assurance, "witness-empty-transfer");
  assert.deepEqual(son(first).reasons, [
    "witness-empty-overrides-carrier:same-context:Sg1910+DarbyR"
  ]);
  assert.equal(
    son(first).anchor?.method,
    "witness-empty-overrides-carrier:same-context"
  );
  const carrier = f.verse.annotations[1]!;
  assert.equal(carrier.visibility, "hidden");
  assert.ok(carrier.diagnostics.includes(WITNESS_EMPTY_OVERRIDES_CARRIER));
  // The words it tagged stay recorded.
  assert.deepEqual(overriddenWords(carrier.diagnostics), [carrier.wordIndex]);
  // Resolved again (as Q does), the carrier is hidden and G could take the
  // word: S's override and its labels stay.
  const annotations = structuredClone(f.verse.annotations);
  const second = resolveCanonicalVerse(f);
  assert.deepEqual(second.decisions, first.decisions);
  assert.deepEqual(f.verse.annotations, annotations);
});

test("the autonomous reader check accepts exactly the counted S overrides", () => {
  const f = heirVerse();
  const changes = emptyResolutionReaderChanges();
  resolveCanonicalVerse({ ...f, readerChanges: changes });
  assert.equal(changes.witnessEmptyHiddenCarriers, 1);
  // A second resolution hides nothing more.
  resolveCanonicalVerse({ ...f, readerChanges: changes });
  assert.equal(changes.witnessEmptyHiddenCarriers, 1);
  const metrics = (
    readerVisibleStrongCount: number,
    readerTaggedTokenCount: number
  ) =>
    ({
      verseCount: 1,
      wordCount: f.verse.tokens.length,
      readerVisibleStrongCount,
      readerTaggedTokenCount,
      readerOverBudgetStrongCount: 0
    }) as unknown as StrongLedgerMetrics;
  // « biens » loses its carrier: one reader Strong and one tagged word less.
  const ledger: Pick<
    StrongLedger,
    | "metrics"
    | "resolutionBaselineMetrics"
    | "lexicalGapFill"
    | "articleDeterminers"
    | "witnessEmptyContexts"
    | "verses"
  > = {
    verses: [f.verse],
    resolutionBaselineMetrics: metrics(2, 2),
    metrics: metrics(1, 1),
    witnessEmptyContexts: {
      hiddenCarriers: changes.witnessEmptyHiddenCarriers
    }
  };
  assert.doesNotThrow(() => assertResolutionKeptReader("s21", ledger));
  // Overrides the ledger does not report, or reports otherwise.
  for (const witnessEmptyContexts of [undefined, { hiddenCarriers: 2 }])
    assert.throws(
      () =>
        assertResolutionKeptReader("s21", { ...ledger, witnessEmptyContexts }),
      /reader-regression:s21:witness-empty-contexts/
    );
  // Any other change of the reader is still a regression.
  assert.throws(
    () =>
      assertResolutionKeptReader("s21", { ...ledger, metrics: metrics(1, 0) }),
    /reader-regression:s21:readerTaggedTokenCount/
  );
});
