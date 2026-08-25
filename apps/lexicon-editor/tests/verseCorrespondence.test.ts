import assert from "node:assert/strict";
import test from "node:test";

import {
  detectVerseCorrespondence,
  validateVerseCorrespondenceManifest,
  VerseCorrespondenceValidationError,
  type VerseCorrespondenceBlock,
  type VerseCorrespondenceManifest,
  type VerseText
} from "../src/verseCorrespondence.js";
import {
  calibrateDetectedBookBlocks,
  detectorMaxIndexDrift
} from "../src/generateVerseCorrespondence.js";

test("expands detector drift for a shifted chapter without slowing identity books", () => {
  assert.equal(
    detectorMaxIndexDrift(["Gen.1.1", "Gen.1.2"], ["Gen.1.1", "Gen.1.2"]),
    4
  );
  assert.equal(
    detectorMaxIndexDrift(
      ["Neh.3.32", "Neh.4.1", "Neh.4.2"],
      [
        "Neh.3.32",
        "Neh.3.33",
        "Neh.3.34",
        "Neh.3.35",
        "Neh.3.36",
        "Neh.3.37",
        "Neh.3.38",
        "Neh.4.1",
        "Neh.4.2"
      ]
    ),
    9
  );
});

test("keeps enough detector drift for accumulated Psalm superscriptions", () => {
  const canonical = Array.from(
    { length: 74 },
    (_, index) => `Ps.1.${index + 1}`
  );
  const target = canonical.slice(0, 4).concat(canonical.slice(74 - 4));

  assert.equal(detectorMaxIndexDrift(target, canonical), 69);
});

test("includes a trailing verse-count delta in detector drift", () => {
  assert.equal(
    detectorMaxIndexDrift(
      ["Job.40.22", "Job.40.23", "Job.40.24"],
      [
        "Job.40.22",
        "Job.40.23",
        "Job.40.24",
        "Job.40.25",
        "Job.40.26",
        "Job.40.27",
        "Job.40.28",
        "Job.40.29",
        "Job.40.30",
        "Job.40.31",
        "Job.40.32"
      ]
    ),
    11
  );
});

test("detects an identity book and validates exact coverage", () => {
  const verses = [
    verse("Rom.1.1", "Paul, serviteur de Jésus-Christ"),
    verse("Rom.1.2", "promis auparavant par ses prophètes")
  ];
  const result = detect(verses, verses);

  assert.equal(result.status, "accepted");
  assert.deepEqual(result.manifest.blocks.map(compactBlock), [
    ["identity", ["Rom.1.1"], ["Rom.1.1"]],
    ["identity", ["Rom.1.2"], ["Rom.1.2"]]
  ]);
  assert.equal(result.score, 1);
});

test("detects the Rom 3 one-to-two merge followed by a shifted tail", () => {
  const canonical = [
    verse("Rom.3.21", "La justice de Dieu est manifestée sans la loi"),
    verse("Rom.3.22", "La justice de Dieu par la foi en Jésus-Christ"),
    verse("Rom.3.23", "Tous ont péché et sont privés de sa gloire"),
    verse("Rom.3.24", "Ils sont gratuitement justifiés par sa grâce"),
    verse("Rom.3.25", "Dieu l'a destiné comme victime propitiatoire")
  ];
  const target = [
    canonical[0]!,
    verse("Rom.3.22", `${canonical[1]!.text} ${canonical[2]!.text}`),
    verse("Rom.3.23", canonical[3]!.text),
    verse("Rom.3.24", canonical[4]!.text)
  ];
  const result = detect(target, canonical);

  assert.equal(result.status, "accepted", result.issues.join("\n"));
  assert.deepEqual(result.manifest.blocks.map(compactBlock), [
    ["identity", ["Rom.3.21"], ["Rom.3.21"]],
    ["merge", ["Rom.3.22"], ["Rom.3.22", "Rom.3.23"]],
    ["shift", ["Rom.3.23"], ["Rom.3.24"]],
    ["shift", ["Rom.3.24"], ["Rom.3.25"]]
  ]);
});

test("detects a long Job-style canonical merge when explicitly bounded", () => {
  const canonical = Array.from({ length: 9 }, (_, index) =>
    verse(
      index < 4 ? `Job.39.${index + 27}` : `Job.40.${index - 3}`,
      `fragment ${index + 1}`
    )
  );
  const target = [
    verse("Job.39.30", canonical.map((item) => item.text).join(" "))
  ];
  const result = detectVerseCorrespondence(detectorInput(target, canonical), {
    maxCanonicalSpan: 10,
    maxIndexDrift: 12
  });

  assert.equal(result.status, "accepted", result.issues.join("\n"));
  assert.deepEqual(result.manifest.blocks.map(compactBlock), [
    ["chapter-boundary", ["Job.39.30"], canonical.map((item) => item.ref)]
  ]);
});

test("prefers narrow Job-style shifts with the calibrated structural penalty", () => {
  const canonical = [
    verse(
      "Job.40.23",
      "Que le fleuve vienne à déborder et le Jourdain dans sa gueule"
    ),
    verse(
      "Job.40.24",
      "Est-ce à force ouverte qu'on pourra le saisir et lui percer le nez"
    ),
    verse(
      "Job.40.25",
      "Prendras-tu le crocodile à l'hameçon et sa langue avec une corde"
    )
  ];
  const target = [
    verse(
      "Job.40.18",
      "Il engloutit une rivière et le Jourdain se dégorgerait dans sa gueule"
    ),
    verse(
      "Job.40.19",
      "Il l'engloutit en le voyant et son nez passe au travers des empêchements"
    ),
    verse(
      "Job.40.20",
      "Enlèveras-tu le Léviathan avec l'hameçon et le tireras-tu par sa langue avec le cordeau"
    )
  ];
  const result = detectVerseCorrespondence(detectorInput(target, canonical), {
    minimumBlockScore: 0.24,
    structuralPenalty: 0.4
  });
  const best =
    result.status === "accepted"
      ? result.manifest.blocks
      : result.alternatives[0]!.blocks;

  assert.deepEqual(best.map(compactBlock), [
    ["shift", ["Job.40.18"], ["Job.40.23"]],
    ["shift", ["Job.40.19"], ["Job.40.24"]],
    ["shift", ["Job.40.20"], ["Job.40.25"]]
  ]);
});

test("calibrates the two known FMAR Job boundary sequences fail-closed", () => {
  const blocks: VerseCorrespondenceBlock[] = [
    {
      kind: "chapter-boundary",
      targetRefs: ["Job.39.29", "Job.39.30"],
      canonicalRefs: [
        "Job.39.26",
        "Job.39.27",
        "Job.39.28",
        "Job.39.29",
        "Job.39.30",
        "Job.40.1",
        "Job.40.2",
        "Job.40.3",
        "Job.40.4",
        "Job.40.5"
      ]
    },
    {
      kind: "split",
      targetRefs: ["Job.40.18", "Job.40.19"],
      canonicalRefs: ["Job.40.23"]
    },
    {
      kind: "merge",
      targetRefs: ["Job.40.20"],
      canonicalRefs: ["Job.40.24", "Job.40.25"]
    }
  ];
  const calibrated = calibrateDetectedBookBlocks({
    bible: "fmar",
    bookId: "Job",
    blocks
  });

  assert.deepEqual(calibrated.map(compactBlock), [
    ["shift", ["Job.39.29"], ["Job.39.26"]],
    [
      "chapter-boundary",
      ["Job.39.30"],
      [
        "Job.39.27",
        "Job.39.28",
        "Job.39.29",
        "Job.39.30",
        "Job.40.1",
        "Job.40.2",
        "Job.40.3",
        "Job.40.4",
        "Job.40.5"
      ]
    ],
    ["shift", ["Job.40.18"], ["Job.40.23"]],
    ["shift", ["Job.40.19"], ["Job.40.24"]],
    ["shift", ["Job.40.20"], ["Job.40.25"]]
  ]);
  assert.throws(
    () =>
      calibrateDetectedBookBlocks({
        bible: "fmar",
        bookId: "Job",
        blocks: blocks.slice(1)
      }),
    /missing-known-calibration-sequence/u
  );
});

test("detects two target verses split from one canonical verse", () => {
  const canonical = [
    verse("Acts.1.1", "J'ai parlé de tout ce que Jésus commença de faire"),
    verse("Acts.1.2", "jusqu'au jour où il fut élevé au ciel")
  ];
  const target = [
    verse("Acts.1.1", "J'ai parlé de tout ce que Jésus"),
    verse("Acts.1.2", "commença de faire"),
    verse("Acts.1.3", canonical[1]!.text)
  ];
  const result = detect(target, canonical);

  assert.equal(result.status, "accepted", result.issues.join("\n"));
  assert.deepEqual(result.manifest.blocks.map(compactBlock), [
    ["split", ["Acts.1.1", "Acts.1.2"], ["Acts.1.1"]],
    ["shift", ["Acts.1.3"], ["Acts.1.2"]]
  ]);
});

test("detects a many-to-many resegmentation within one chapter", () => {
  const canonical = [
    verse(
      "Matt.10.5",
      "N'allez pas vers les nations ni dans les villes des Samaritains"
    ),
    verse(
      "Matt.10.6",
      "allez plutôt vers les brebis perdues de la maison d'Israël"
    )
  ];
  const target = [
    verse("Matt.10.5", "N'allez pas vers les nations"),
    verse(
      "Matt.10.6",
      "ni dans les villes des Samaritains allez plutôt vers les brebis perdues de la maison d'Israël"
    )
  ];
  const result = detect(target, canonical);

  assert.equal(result.status, "accepted", result.issues.join("\n"));
  assert.deepEqual(result.manifest.blocks.map(compactBlock), [
    ["resegment", ["Matt.10.5", "Matt.10.6"], ["Matt.10.5", "Matt.10.6"]]
  ]);
});

test("marks a mapping that moves material across a chapter boundary", () => {
  const canonical = [
    verse("Joel.2.32", "Quiconque invoquera le nom sera sauvé"),
    verse("Joel.3.1", "En ces jours-là je ramènerai les captifs")
  ];
  const target = [
    verse("Joel.3.1", canonical[0]!.text),
    verse("Joel.3.2", canonical[1]!.text)
  ];
  const result = detect(target, canonical);

  assert.equal(result.status, "accepted", result.issues.join("\n"));
  assert.deepEqual(
    result.manifest.blocks.map((block) => block.kind),
    ["chapter-boundary", "shift"]
  );
});

test("reports an equal-score ambiguity and emits no manifest", () => {
  const target = [verse("Rom.1.2", "même texte")];
  const canonical = [
    verse("Rom.1.1", "même texte"),
    verse("Rom.1.3", "même texte")
  ];
  const result = detectVerseCorrespondence(detectorInput(target, canonical), {
    maxTargetSpan: 1,
    maxCanonicalSpan: 1,
    maxOmittedSpan: 1,
    ambiguityMargin: 0.01
  });

  assert.equal(result.status, "ambiguous");
  assert.equal(result.margin, 0);
  assert.equal(result.manifest, undefined);
  assert.match(result.issues.join("\n"), /best-path margin/u);
  assert.equal(result.alternatives.length, 2);
});

test("validator fails closed on duplicate or uncovered canonical sources", () => {
  const manifest: VerseCorrespondenceManifest = {
    schemaVersion: 2,
    bible: "test",
    canonicalVersification: "osis",
    blocks: [
      {
        kind: "identity",
        targetRefs: ["Rom.1.1"],
        canonicalRefs: ["Rom.1.1"]
      },
      {
        kind: "shift",
        targetRefs: ["Rom.1.2"],
        canonicalRefs: ["Rom.1.1"]
      }
    ]
  };

  assert.throws(
    () =>
      validateVerseCorrespondenceManifest(manifest, {
        targetRefs: ["Rom.1.1", "Rom.1.2"],
        canonicalRefs: ["Rom.1.1", "Rom.1.2"]
      }),
    (error: unknown) => {
      assert.ok(error instanceof VerseCorrespondenceValidationError);
      assert.match(error.message, /duplicated/u);
      assert.match(error.message, /coverage differs/u);
      return true;
    }
  );
});

test("validator accepts a source only when its omission is explicit", () => {
  const manifest: VerseCorrespondenceManifest = {
    schemaVersion: 2,
    bible: "test",
    canonicalVersification: "osis",
    blocks: [
      {
        kind: "identity",
        targetRefs: ["Rom.1.1"],
        canonicalRefs: ["Rom.1.1"]
      },
      {
        kind: "omitted",
        targetRefs: [],
        canonicalRefs: ["Rom.1.2"],
        reason: "Absent de la traduction cible."
      }
    ]
  };
  const scope = {
    targetRefs: ["Rom.1.1"],
    canonicalRefs: ["Rom.1.1", "Rom.1.2"]
  };

  assert.equal(validateVerseCorrespondenceManifest(manifest, scope), manifest);
  assert.throws(
    () =>
      validateVerseCorrespondenceManifest(
        { ...manifest, blocks: manifest.blocks.slice(0, 1) },
        scope
      ),
    VerseCorrespondenceValidationError
  );
});

test("validator accepts a frozen v2 detector manifest", () => {
  const manifest: VerseCorrespondenceManifest = {
    schemaVersion: 2,
    bible: "nvs78p",
    canonicalVersification: "osis",
    blocks: [
      {
        kind: "identity",
        targetRefs: ["Gen.1.1"],
        canonicalRefs: ["Gen.1.1"]
      }
    ],
    detection: {
      detector: "deterministic-book-alignment-v2",
      witnesses: ["Sg1910", "Darby"],
      score: 1,
      margin: 1
    }
  };

  assert.equal(
    validateVerseCorrespondenceManifest(manifest, {
      targetRefs: ["Gen.1.1"],
      canonicalRefs: ["Gen.1.1"]
    }),
    manifest
  );
});

test("detects a target-only verse as an explicit addition", () => {
  const target = [
    verse("Rom.1.1", "texte commun"),
    verse(
      "Rom.1.2",
      "supplément cible totalement indépendant long développé distinct étranger additionnel"
    ),
    verse("Rom.1.3", "suite commune")
  ];
  const canonical = [
    verse("Rom.1.1", "texte commun"),
    verse("Rom.1.3", "suite commune")
  ];
  const result = detectVerseCorrespondence(detectorInput(target, canonical), {
    ambiguityMargin: 0.01
  });

  assert.equal(result.status, "accepted", result.issues.join("\n"));
  assert.deepEqual(result.manifest.blocks.map(compactBlock), [
    ["identity", ["Rom.1.1"], ["Rom.1.1"]],
    ["added", ["Rom.1.2"], []],
    ["identity", ["Rom.1.3"], ["Rom.1.3"]]
  ]);
});

test("validator rejects a resegment block unless both sides are plural", () => {
  const manifest: VerseCorrespondenceManifest = {
    schemaVersion: 2,
    bible: "test",
    canonicalVersification: "osis",
    blocks: [
      {
        kind: "resegment",
        targetRefs: ["Rom.1.1"],
        canonicalRefs: ["Rom.1.1", "Rom.1.2"]
      }
    ]
  };

  assert.throws(
    () =>
      validateVerseCorrespondenceManifest(manifest, {
        targetRefs: ["Rom.1.1"],
        canonicalRefs: ["Rom.1.1", "Rom.1.2"]
      }),
    (error: unknown) => {
      assert.ok(error instanceof VerseCorrespondenceValidationError);
      assert.match(error.message, /resegment must map multiple targets/u);
      return true;
    }
  );
});

function detect(target: VerseText[], canonical: VerseText[]) {
  return detectVerseCorrespondence(detectorInput(target, canonical));
}

function detectorInput(target: VerseText[], canonical: VerseText[]) {
  return {
    bible: "test",
    canonicalVersification: "osis",
    targetVerses: target,
    canonicalWitnesses: [{ name: "witness", verses: canonical }]
  };
}

function verse(ref: string, text: string): VerseText {
  return { ref, text };
}

function compactBlock(
  block: VerseCorrespondenceBlock
): [string, string[], string[]] {
  return [block.kind, block.targetRefs, block.canonicalRefs];
}
