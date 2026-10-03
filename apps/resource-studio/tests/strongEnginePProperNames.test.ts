import assert from "node:assert/strict";
import test from "node:test";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import {
  applyProperNameVariants,
  foldName,
  nameKey,
  parseProperNameLexicon,
  properNameVariantsPass,
  proposeProperNameVariants,
  proposeSonsOfNameGentilics,
  relationsOf,
  witnessNameTags,
  type ProperNameUnit,
  type ProperNameVerse
} from "../src/properNameVariants.js";
import { resolveCanonicalVerse } from "../src/strongCanonicalResolution.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import type { StrongLedgerAnnotation } from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";

// TBESH-shaped fixture lines: Strong, description, uStrong, lemma,
// transliteration, type, gloss, definition.
const lexicon = parseProperNameLexicon([
  [
    "H7744\tH7744 =\tH7744\tשׁוּחַ\tshu.ach\tN:N-M-P\tShuah\tfixture",
    "H4317\tH4317G =\tH4317G\tמִיכָאֵל\tmi.kha.el\tN:N-M-P\tMichael\tfixture",
    "H3878\tH3878G =\tH3878G\tלֵוִי\tle.vi\tN:N-M-P\tLevi\tfixture",
    "H3478\tH3478 =\tH3478\tיִשְׂרָאֵל\tyis.ra.el\tN:N-M-P\tIsrael\tfixture",
    "H2850\tH2850 =\tH2850\tחִתִּי\tchit.ti\tN:N--PG\tHittite\tfixture",
    "H1121\tH1121A =\tH1121A\tבֵּן\tben\tH:N-M\tson\tfixture",
    "H2875\tH2875 =\tH2875\tגֹּמֶר\tgo.mer\tN:N-M-P\tGomer\tfixture",
    "H7793\tH7793 =\tH7793\tשׁוּר\tshur\tN:N--L\tShur\tfixture",
    "H3667a\tH3667A =\tH3667A\tכְּנַעַן\tke.na.an\tN:N--L\tCanaan\tfixture",
    "H0894\tH0894 =\tH0894\tבָּבֶל\tba.vel\tN:N--L\tBabylon\tfixture",
    "H3778\tH3778G =\tH3778G\tכַּשְׂדִּים\tkas.dim\tN:N--LG\tChaldea\tfixture",
    "H3881\tH3881 =\tH3881\t-\tle.vi\tN:N--PG\tLevite\tfixture",
    "H1166\tH1166G = a Name of\tH3389\t-\tba.al\tN:N-F-P\tMarried\tfixture",
    "H1166\tH1166I =\tH1166I\t-\tba.al\tH:V\trule: to marry\tfixture",
    "G2383\tG2383 =\tG2383\t-\tIaeiros\tN:N-M-P\tJairus\tfixture"
  ].join("\n")
]);

const unit = (
  ref: string,
  position: number,
  strong: string,
  options: { sourceStrong?: string; readingUnresolved?: boolean } = {}
): ProperNameUnit => ({
  id: `TAHOT.${ref}.${position}.L`,
  occurrenceIds: [`TAHOT.${ref}.${position}.L.main:0`],
  strong: [strong],
  readingUnresolved: options.readingUnresolved ?? false,
  ...(options.sourceStrong ? { sourceStrong: options.sourceStrong } : {})
});

const witness = (name: string, ref: string, tagged: string) => {
  const [bookId, chapter, verse] = ref.split(".");
  return {
    name,
    verse: {
      row: {
        bookId: bookId!,
        chapter: Number(chapter),
        verse: Number(verse),
        text: tagged
      },
      tokens: parseStrongTokens(tagged)
    }
  };
};

const shuach = (
  words: string[],
  options: { repeated?: boolean; occupied?: number[] } = {}
): ProperNameVerse => ({
  words,
  units: [
    unit("Gen.25.2", 4, "H2175"),
    unit("Gen.25.2", 14, "H7744"),
    ...(options.repeated ? [unit("Gen.25.2", 16, "H7744")] : [])
  ],
  carriers: [
    {
      strong: "H2175",
      startWordIndex: 3,
      endWordIndex: 3,
      originalOccurrenceId: "TAHOT.Gen.25.2.4.L.main:0"
    },
    ...(options.occupied ?? []).map((wordIndex) => ({
      strong: "H9999",
      startWordIndex: wordIndex,
      endWordIndex: wordIndex
    }))
  ],
  tags: witnessNameTags([
    witness(
      "Sg1910",
      "Gen.25.2",
      'Elle lui enfanta <w strong="H2175" pos="4">Zimran</w> et <w strong="H7744" pos="14">Schuach</w>.'
    ),
    witness(
      "Darby",
      "Gen.25.2",
      'elle lui enfanta <w strong="H2175" pos="4">Zimran</w>, et <w strong="H7744" pos="14">Shuakh</w>.'
    )
  ])
});

test("a name keeps its spelling key across French transliterations", () => {
  assert.equal(nameKey("Schuach"), nameKey("Shuakh"));
  assert.equal(nameKey("Shuach"), nameKey("Schuach"));
  assert.equal(nameKey("Rabschaké"), nameKey("Rabshaké"));
  assert.notEqual(nameKey("Michel"), nameKey("Micaël"));
  assert.equal(foldName("d'Israël"), "israel");
  assert.equal(foldName("Lorsqu'Ephraïm"), "ephraim");
  // « Heth » keeps two letters: too short to name anything by its key.
  assert.equal(nameKey("Heth"), "et");
});

test("an unplaced name goes to the only free target word spelling it otherwise", () => {
  const words = ["Elle", "lui", "donna", "Zimran", "et", "Shuach"];
  const [proposal, ...rest] = proposeProperNameVariants(shuach(words), lexicon);
  assert.equal(rest.length, 0);
  assert.equal(proposal!.sourceUnitId, "TAHOT.Gen.25.2.14.L");
  assert.equal(proposal!.wordIndex, 5);
  assert.equal(proposal!.relation, "name-key");
  assert.deepEqual(proposal!.evidence, ["Sg1910=Schuach", "Darby=Shuakh"]);
  // A repeated name is never paired by guess.
  assert.deepEqual(
    proposeProperNameVariants(shuach(words, { repeated: true }), lexicon),
    []
  );
  // A word already carrying a number is not free.
  assert.deepEqual(
    proposeProperNameVariants(shuach(words, { occupied: [5] }), lexicon),
    []
  );
  // Two possible words: nothing is chosen.
  assert.deepEqual(
    proposeProperNameVariants(
      shuach(["Elle", "lui", "donna", "Zimran", "Shuach", "et", "Shuah"]),
      lexicon
    ),
    []
  );
});

test("a sentence-initial function word is never a name", () => {
  const shur = (words: string[]): ProperNameVerse => ({
    words,
    units: [unit("Gen.16.7", 12, "H7793")],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Gen.16.7",
        'sur le chemin de <w strong="H7793" pos="12">Schur</w>'
      )
    ])
  });
  // « Schur » and « Sur » share a key; « Sur » opens the sentence.
  assert.deepEqual(
    proposeProperNameVariants(shur(["Sur", "le", "chemin"]), lexicon),
    []
  );
  assert.deepEqual(
    proposeProperNameVariants(
      shur(["sur", "le", "chemin", "de", "Shur"]),
      lexicon
    ).map((proposal) => proposal.wordIndex),
    [4]
  );
});

test("a name also matches a STEP gloss, a near spelling and a gentilic", () => {
  const michel: ProperNameVerse = {
    words: ["Mais", "Michel", "est", "venu"],
    units: [unit("Dan.10.13", 9, "H4317")],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Darby",
        "Dan.10.13",
        'et voici, <w strong="H4317" pos="9">Micaël</w>, est venu'
      )
    ])
  };
  const [near] = proposeProperNameVariants(michel, lexicon);
  assert.equal(near!.wordIndex, 1);
  assert.equal(near!.relation, "name-near-key");
  assert.deepEqual(near!.evidence, ["Darby=Micaël", "step-gloss=Michael"]);

  const levites: ProperNameVerse = {
    words: ["Tous", "les", "Lévites", "se", "rassemblèrent"],
    units: [unit("Exod.32.26", 20, "H3878")],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Exod.32.26",
        'Tous les enfants de <w strong="H3878" pos="20">Lévi</w> s’assemblèrent'
      )
    ])
  };
  const [gentilic] = proposeProperNameVariants(levites, lexicon);
  assert.equal(gentilic!.wordIndex, 2);
  assert.equal(gentilic!.relation, "name-gentilic");

  // A target word the witnesses use for another number is that number's.
  const hittites: ProperNameVerse = {
    words: ["les", "Hittites", "et", "les", "Gomer"],
    units: [unit("Gen.15.20", 2, "H2850")],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Gen.15.20",
        'les <w strong="H2850" pos="2">Héthiens</w>, les <w strong="H2875" pos="4">Hittites</w>'
      )
    ])
  };
  assert.deepEqual(proposeProperNameVariants(hittites, lexicon), []);
});

test("a lower-case word is taken only as a gentilic, and never from another people", () => {
  const canaan = (words: string[]): ProperNameVerse => ({
    words,
    units: [unit("Gen.28.1", 14, "H3667")],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Gen.28.1",
        'une femme parmi les filles de <w strong="H3667" pos="14">Canaan</w>'
      )
    ])
  });
  const [adjective] = proposeProperNameVariants(
    canaan(["une", "femme", "cananéenne"]),
    lexicon
  );
  assert.equal(adjective!.wordIndex, 2);
  assert.equal(adjective!.relation, "name-gentilic");
  // The same spelling in lower case is not a name.
  assert.deepEqual(
    proposeProperNameVariants(canaan(["le", "pays", "kanaan"]), lexicon),
    []
  );

  const babylon = (withChaldeans: boolean): ProperNameVerse => ({
    words: ["les", "Babyloniens", "partirent"],
    units: [
      ...(withChaldeans ? [unit("Jer.41.3", 3, "H3778")] : []),
      unit("Jer.41.3", 5, "H0894")
    ],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Jer.41.3",
        'les <w strong="H3778" pos="3">Chaldéens</w> de <w strong="H0894" pos="5">Babylone</w>'
      )
    ])
  });
  assert.deepEqual(
    proposeProperNameVariants(babylon(false), lexicon).map(
      (proposal) => proposal.wordIndex
    ),
    [1]
  );
  // « Babyloniens » may render the Chaldeans still without a carrier.
  assert.deepEqual(proposeProperNameVariants(babylon(true), lexicon), []);
});

test("« sons of <name> » joins the gentilic word carrying the name", () => {
  const israelites = (
    words: string[],
    sons = '<w strong="H1121" pos="6">enfants</w> d’'
  ): ProperNameVerse => ({
    words,
    units: [unit("Exod.1.9", 6, "H1121"), unit("Exod.1.9", 7, "H3478")],
    carriers: [
      {
        strong: "H3478",
        startWordIndex: words.length - 1,
        endWordIndex: words.length - 1,
        originalOccurrenceId: "TAHOT.Exod.1.9.7.L.main:0"
      }
    ],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Exod.1.9",
        `Voilà les ${sons}<w strong="H3478" pos="7">Israël</w>`
      )
    ])
  });
  const [proposal] = proposeSonsOfNameGentilics(
    israelites(["Voici", "que", "les", "Israélites"]),
    lexicon
  );
  assert.equal(proposal!.sourceUnitId, "TAHOT.Exod.1.9.6.L");
  assert.equal(proposal!.wordIndex, 3);
  assert.equal(proposal!.method, "sons-of-name-gentilic");
  // The target keeps the name itself: « sons » is elsewhere.
  assert.deepEqual(
    proposeSonsOfNameGentilics(
      israelites(["les", "enfants", "d'Israël"]),
      lexicon
    ),
    []
  );
  // Without a witness tag for « sons », nothing is inferred.
  assert.deepEqual(
    proposeSonsOfNameGentilics(
      israelites(["Voici", "que", "les", "Israélites"], ""),
      lexicon
    ),
    []
  );
});

test("the ledger pass turns the occurrence's own annotation into a reader carrier before resolution", () => {
  const sourceLine = (reading: string) =>
    `Gen.25.2#14=${reading}\tשֽׁוּחַ\tShu.ach\tShuah\t{H7744}\tHNpm\t\t\tH7744\t\t\t`;
  const row = parseSourceRow(sourceLine("L"), "TAHOT fixture.txt", 1)!;
  const occurrence: OriginalStrongOccurrence = {
    occurrenceId: `${row.id}.main:0`,
    tokenId: `${row.id}.main`,
    tokenIndex: 14,
    sourceIdentity: row.id,
    strong: "H7744",
    sourceStrong: "H7744",
    text: row.surface,
    gloss: row.gloss,
    lemma: row.surface,
    morph: "HNpm",
    pos: ""
  };
  const words = ["Elle", "lui", "donna", "Zimran", "et", "Shuach"];
  const make = () => ({
    bible: "s21",
    verse: {
      ref: "Gen.25.2",
      text: words.join(" "),
      tokens: words.map((text, wordIndex) => ({
        wordIndex,
        text,
        normalized: text.toLowerCase()
      })),
      annotations: [
        {
          id: "Gen.25.2:0:H7744",
          strong: "H7744",
          visibility: "advanced",
          placement: "empty",
          source: "original-complete",
          confidence: 0.4,
          reason: "fixture",
          diagnostics: ["original-empty"],
          insertAfterWordIndex: 4,
          originalOccurrenceId: occurrence.occurrenceId
        }
      ] as StrongLedgerAnnotation[]
    },
    input: {
      occurrences: [occurrence],
      references: [
        witness(
          "Sg1910",
          "Gen.25.2",
          'Elle lui enfanta Zimran et <w strong="H7744" pos="14">Schuach</w>.'
        )
      ],
      issues: []
    },
    sourceRows: new Map([[row.id, row]]),
    lexicalItems: []
  });
  const off = make();
  assert.equal(resolveCanonicalVerse(off).decisions[0]!.state, "unresolved");
  assert.equal(off.verse.annotations[0]!.visibility, "advanced");

  const on = make();
  const pass = (state: ReturnType<typeof make>) =>
    properNameVariantsPass({
      verses: [state.verse],
      inputOf: () => state.input,
      sourceRows: state.sourceRows,
      readingPolicy: {},
      lexicon
    });
  assert.deepEqual(
    pass(on).map((verse) => verse.ref),
    ["Gen.25.2"]
  );
  // The reader: who is shown, and on which word.
  const readerOf = (annotations: StrongLedgerAnnotation[]) =>
    JSON.stringify(
      annotations
        .filter((a) => a.visibility === "reader")
        .map((a) => [a.strong, a.placement, a.wordIndex, a.startWordIndex])
    );
  const readerBefore = readerOf(on.verse.annotations);
  const resolved = resolveCanonicalVerse(on);
  assert.equal(resolved.decisions[0]!.state, "visible");
  assert.deepEqual(resolved.decisions[0]!.targetWordIndices, [5]);
  // Occurrence resolution reads the reader; it does not change it.
  assert.equal(readerOf(on.verse.annotations), readerBefore);
  const carrier = on.verse.annotations[0]!;
  assert.equal(carrier.visibility, "reader");
  assert.equal(carrier.placement, "word");
  assert.equal(carrier.wordIndex, 5);
  assert.equal(carrier.source, "reference-transfer");
  assert.deepEqual(carrier.diagnostics.slice(0, 3), [
    "proper-name-variant",
    "name-key",
    "Sg1910=Schuach"
  ]);

  // Applying the pass directly reports what it placed.
  const again = make();
  const placed = applyProperNameVariants({
    verse: again.verse,
    units: [
      {
        id: row.id,
        occurrenceIds: [occurrence.occurrenceId],
        strong: ["H7744"],
        readingUnresolved: false,
        sourceEvidenceSha256: "fixture"
      }
    ],
    references: again.input.references,
    lexicon
  });
  assert.deepEqual(
    placed.map((proposal) => [proposal.strong, proposal.wordIndex]),
    [["H7744", 5]]
  );
  // A second run finds the word placed and does nothing.
  assert.deepEqual(pass(on), []);

  // An open reading (a Ketiv) is never placed.
  const ketiv = make();
  const ketivRow = parseSourceRow(sourceLine("K"), "TAHOT fixture.txt", 1)!;
  ketiv.sourceRows = new Map([[ketivRow.id, ketivRow]]);
  ketiv.input.occurrences = [
    {
      ...occurrence,
      occurrenceId: `${ketivRow.id}.main:0`,
      sourceIdentity: ketivRow.id
    }
  ];
  ketiv.verse.annotations[0]!.originalOccurrenceId = `${ketivRow.id}.main:0`;
  assert.deepEqual(pass(ketiv), []);
  assert.equal(ketiv.verse.annotations[0]!.visibility, "advanced");

  // Without witness text (a block spanning several verses) nothing is tried.
  const blind = make();
  blind.input.references = [];
  assert.deepEqual(pass(blind), []);
});

test("STEP lexicon ids: eStrong letters fold into the base, extended ids do not, senses keep their type", () => {
  const parsed = parseProperNameLexicon([
    [
      "G2074\tG2074 = the Greek of\tH2696H\t-\tEsrom\tN:N-M-P\tHezron\tfixture",
      "G20746\tG20746 =\tG20746\t-\tMitra\t\tMitra\tfixture",
      "H1121a\tH1121A =\tH1121A\t-\tben\tH:N-M\tson: child\tfixture",
      "H1121b\tH1121B =\tH1121B\t-\tbe.no\tN:N-M-P\tBeno\tfixture",
      "H1121a\tH1121G = a Meaning of\tH1121A\t-\tben\tH:N-M\tson: people\tfixture"
    ].join("\n")
  ]);
  assert.deepEqual(parsed.get("G2074"), {
    type: "N:N-M-P",
    glosses: ["Hezron"]
  });
  assert.equal(parsed.has("G2074" + "6"), false);
  assert.equal(parsed.get("H1121")?.type, "H:N-M");
  assert.equal(parsed.get("H1121B")?.type, "N:N-M-P");
  assert.equal(parsed.get("H1121G")?.type, "H:N-M");

  // The source word's own sense decides whether it is a name.
  const married = (sourceStrong: string): ProperNameVerse => ({
    words: ["on", "te", "nommera", "Married"],
    units: [unit("Isa.62.4", 9, "H1166", { sourceStrong })],
    carriers: [],
    tags: []
  });
  assert.deepEqual(
    proposeProperNameVariants(married("H1166G"), lexicon).map(
      (proposal) => proposal.wordIndex
    ),
    [3]
  );
  assert.deepEqual(proposeProperNameVariants(married("H1166I"), lexicon), []);
});

test("two source words claiming one target word are both left uncertain", () => {
  const verse: ProperNameVerse = {
    words: ["Elle", "lui", "donna", "Zimran", "et", "Shuach"],
    units: [unit("Gen.25.2", 14, "H7744"), unit("Gen.25.2", 16, "H2875")],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Gen.25.2",
        '<w strong="H7744" pos="14">Schuach</w> <w strong="H2875" pos="16">Schuach</w>'
      )
    ])
  };
  assert.deepEqual(proposeProperNameVariants(verse, lexicon), []);
});

test("a word already accounted for, or an open reading, is left alone", () => {
  const words = ["Elle", "lui", "donna", "Zimran", "et", "Shuach"];
  // An editorial empty already places the source word.
  assert.deepEqual(
    proposeProperNameVariants(
      {
        ...shuach(words),
        readerOccurrences: new Map([["TAHOT.Gen.25.2.14.L.main:0", 1]])
      },
      lexicon
    ),
    []
  );
  const open = shuach(words);
  open.units = open.units.map((entry) => ({
    ...entry,
    readingUnresolved: entry.strong[0] === "H7744"
  }));
  assert.deepEqual(proposeProperNameVariants(open, lexicon), []);
});

test("a witness numbering the verse otherwise is read through its only tag of that number", () => {
  const verse = (tagged: string): ProperNameVerse => ({
    words: ["Elle", "lui", "donna", "Zimran", "et", "Shuach"],
    units: [unit("Gen.25.2", 14, "H7744")],
    carriers: [],
    tags: witnessNameTags([witness("Darby", "Gen.25.3", tagged)])
  });
  const [renumbered] = proposeProperNameVariants(
    verse('et <w strong="H7744" pos="9">Shuakh</w>'),
    {
      // Without the STEP gloss, only the witness can name the word.
      get: (key: string) =>
        key === "H7744" ? { type: "N:N-M-P", glosses: [] } : undefined
    } as unknown as typeof lexicon
  );
  assert.deepEqual(renumbered!.evidence, ["Darby=Shuakh"]);
  // Two tags of that number: neither is chosen.
  assert.deepEqual(
    proposeProperNameVariants(
      verse(
        '<w strong="H7744" pos="9">Shuakh</w> <w strong="H7744" pos="12">Shuakh</w>'
      ),
      {
        get: (key: string) =>
          key === "H7744" ? { type: "N:N-M-P", glosses: [] } : undefined
      } as unknown as typeof lexicon
    ),
    []
  );
});

test("a Greek name and a lower-case gentilic read as a plural", () => {
  const jairus: ProperNameVerse = {
    words: ["un", "chef", "nommé", "Jaïrus"],
    units: [
      {
        id: "TAGNT.Mark.5.22.9.NKO",
        occurrenceIds: ["TAGNT.Mark.5.22.9.NKO.main:0"],
        strong: ["G2383"],
        readingUnresolved: false
      }
    ],
    carriers: [],
    tags: witnessNameTags([
      witness(
        "Darby",
        "Mark.5.22",
        'nommé <w strong="G2383" pos="9">Jaïrus</w>'
      )
    ])
  };
  assert.deepEqual(
    proposeProperNameVariants(jairus, lexicon).map((proposal) => [
      proposal.wordIndex,
      proposal.relation
    ]),
    [[3, "name-key"]]
  );

  // « lévites » is near « Levite », its plural and also its gentilic.
  assert.deepEqual(relationsOf("lévites", "Levite"), [
    "name-near-key",
    "name-plural",
    "name-gentilic"
  ]);
  const [lower] = proposeProperNameVariants(
    {
      words: ["les", "prêtres", "lévites"],
      units: [unit("Josh.3.3", 8, "H3881")],
      carriers: [],
      tags: []
    },
    lexicon
  );
  assert.equal(lower!.wordIndex, 2);
  assert.equal(lower!.relation, "name-gentilic");
});

test("« sons of » needs the witnesses' own « sons », away from the word, and only for Israel", () => {
  const israelites = (
    words: string[],
    sons: string,
    name: { strong: string; text: string } = { strong: "H3478", text: "Israël" }
  ): ProperNameVerse => ({
    words,
    units: [unit("Exod.1.9", 6, "H1121"), unit("Exod.1.9", 7, name.strong)],
    carriers: [
      {
        strong: name.strong,
        startWordIndex: words.length - 1,
        endWordIndex: words.length - 1,
        originalOccurrenceId: "TAHOT.Exod.1.9.7.L.main:0"
      }
    ],
    readerOccurrences: new Map([["TAHOT.Exod.1.9.7.L.main:0", 1]]),
    tags: witnessNameTags([
      witness(
        "Sg1910",
        "Exod.1.9",
        `Voilà ${sons}<w strong="${name.strong}" pos="7">${name.text}</w>`
      )
    ])
  });
  const sons = (text: string) => `<w strong="H1121" pos="6">${text}</w> d’`;
  // An article inside the witness's tag is not its « sons ».
  assert.deepEqual(
    proposeSonsOfNameGentilics(
      israelites(["Voici", "que", "les", "Israélites"], sons("les enfants")),
      lexicon
    ).map((proposal) => proposal.wordIndex),
    [3]
  );
  // The target keeps « enfants » three words before: « sons » is there.
  assert.deepEqual(
    proposeSonsOfNameGentilics(
      israelites(["les", "enfants", "des", "Israélites"], sons("enfants")),
      lexicon
    ),
    []
  );
  // An empty witness tag leaves « sons » untranslated: no evidence.
  assert.deepEqual(
    proposeSonsOfNameGentilics(
      israelites(["Voici", "que", "les", "Israélites"], sons("")),
      lexicon
    ),
    []
  );
  // Other peoples stay uncertain (« fils de Lévi » → « Lévites »).
  assert.deepEqual(
    proposeSonsOfNameGentilics(
      israelites(["Voici", "que", "les", "Lévites"], sons("enfants"), {
        strong: "H3878",
        text: "Lévi"
      }),
      lexicon
    ),
    []
  );
});
