import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdaptiveUnitTranslationBatches,
  buildAdaptiveUnitReviewBatches,
  buildPartialRecoveryBatch,
  buildSkippedReviewResults,
  LSJ_PROTECTED_MICROSEGMENT_TARGET_BYTES,
  LSJ_SEGMENT_TARGET_BYTES,
  protectHtmlTagsForAgent,
  reassembleLsjTranslationSegments,
  restoreHtmlTagsFromAgent,
  salvageValidReviewResults,
  salvageValidTranslationResults,
  splitLsjHtmlForTranslation,
  validateLsjTranslation
} from "../scripts/runFrenchLsjRevision.js";

test("records a deterministic accept decision when the semantic reviewer is skipped", () => {
  assert.deepEqual(buildSkippedReviewResults(["G0001", "G0002"]), [
    {
      key: "G0001",
      verdict: "accept",
      correctedContentHtmlFr: null,
      reasons: [
        "Révision sémantique lourde ignorée à la demande de l'utilisateur ; traduction conservée après validation déterministe."
      ],
      confidence: 1
    },
    {
      key: "G0002",
      verdict: "accept",
      correctedContentHtmlFr: null,
      reasons: [
        "Révision sémantique lourde ignorée à la demande de l'utilisateur ; traduction conservée après validation déterministe."
      ],
      confidence: 1
    }
  ]);
});

test("uses small segments only for final protected-token recovery", () => {
  assert.equal(LSJ_SEGMENT_TARGET_BYTES, 12_000);
  assert.equal(LSJ_PROTECTED_MICROSEGMENT_TARGET_BYTES, 2_000);
  const source = `${"<b> λόγος</b> [Refs (NT.Matt.18.23)] explanatory text. ".repeat(180)}`;
  const segments = splitLsjHtmlForTranslation(
    source,
    LSJ_PROTECTED_MICROSEGMENT_TARGET_BYTES
  );

  assert.ok(segments.length > 1);
  assert.equal(segments.map((segment) => segment.sourceHtml).join(""), source);
  for (const segment of segments) {
    assert.ok(Buffer.byteLength(segment.sourceHtml) <= 2_200);
  }
});

test("protects every STEP tag with an ordered opaque token and restores it exactly", () => {
  const source =
    "<b>pails</b> or <b>buckets</b><br /><Level3><b>2</b></Level3>";
  const protection = protectHtmlTagsForAgent(source);
  assert.equal(protection.tokens.length, 9);
  const translated = protection.protectedHtml
    .replace("pails", "seaux")
    .replace("buckets", "baquets");
  assert.equal(
    restoreHtmlTagsFromAgent(source, translated),
    "<b>seaux</b> or <b>baquets</b><br /><Level3><b>2</b></Level3>"
  );
  assert.throws(
    () =>
      restoreHtmlTagsFromAgent(
        source,
        translated.replace("⟦STEP_HTML_0002⟧", "")
      ),
    /token-sequence/u
  );
});

test("protects reference-block brackets so nested STEP topology is restored exactly", () => {
  const source =
    "word [Refs 8th c.BC+ (author [previous work] 3.14)] <b>sense</b>";
  const protection = protectHtmlTagsForAgent(source);
  assert.equal(protection.tokens.length, 7);
  const translated = protection.protectedHtml
    .replace("word", "mot")
    .replace("previous work", "ouvrage précédent")
    .replace("sense", "sens");
  const restored = restoreHtmlTagsFromAgent(source, translated);
  assert.equal(
    restored,
    "mot [Refs 8th c.BC+ (author [ouvrage précédent] 3.14)] <b>sens</b>"
  );
  assert.equal(validateLsjTranslation(source, restored).valid, true);
});

test("protects the reference-block opener as one token so prose cannot enter before LXX", () => {
  const source = 'the [LXX+8th c.BC+ ("Eternal", LXX.Exo.3.14)]';
  const protection = protectHtmlTagsForAgent(source);
  const opener = protection.tokens.find((token) => token.tag === "[LXX");

  assert.ok(opener);
  assert.equal(protection.protectedHtml.includes("[LXX"), false);
  const translated = protection.protectedHtml.replace("the ", "l’Éternel ");
  const restored = restoreHtmlTagsFromAgent(source, translated);

  assert.equal(restored, 'l’Éternel [LXX+8th c.BC+ ("Eternal", LXX.Exo.3.14)]');
  assert.equal(validateLsjTranslation(source, restored).valid, true);
});

test("protects original scripts, Strong codes and citation anchors in the maximal fallback", () => {
  const source = "<b>λόγος</b> word G3056 [NT.John.1.1]";
  const protection = protectHtmlTagsForAgent(source);
  const translated = protection.protectedHtml.replace("word", "parole");
  assert.equal(
    restoreHtmlTagsFromAgent(source, translated),
    "<b>λόγος</b> parole G3056 [NT.John.1.1]"
  );
  assert.throws(
    () =>
      restoreHtmlTagsFromAgent(
        source,
        translated.replace("⟦STEP_HTML_0001⟧", "")
      ),
    /token-sequence/u
  );
});

test("protects STEP bibliographic shorthand from becoming invented numeric anchors", () => {
  const source = "[Refs (ll.12ff; p565; 18ff.)] word";
  const protection = protectHtmlTagsForAgent(source);
  const translated = protection.protectedHtml.replace("word", "mot");
  assert.equal(
    restoreHtmlTagsFromAgent(source, translated),
    "[Refs (ll.12ff; p565; 18ff.)] mot"
  );
  assert.equal(protection.protectedHtml.includes("12ff"), false);
  assert.equal(protection.protectedHtml.includes("p565"), false);
  assert.equal(protection.protectedHtml.includes("18ff"), false);
});

test("builds stable unit recovery batches without coupling sibling items", () => {
  const items = [
    { representative: { key: "G0001" }, payload: "one" },
    { representative: { key: "G0002" }, payload: "two" }
  ];

  const batches = buildAdaptiveUnitTranslationBatches("translate-00001", items);
  const reversed = buildAdaptiveUnitTranslationBatches(
    "translate-00001",
    [...items].reverse()
  );

  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch) => batch.items.map((item) => item.representative.key)),
    [["G0001"], ["G0002"]]
  );
  assert.equal(batches[0]!.id, reversed[1]!.id);
  assert.equal(batches[0]!.inputHash, reversed[1]!.inputHash);
  assert.notEqual(batches[0]!.inputHash, batches[1]!.inputHash);
});

test("builds stable reviewer unit batches without coupling sibling notices", () => {
  const items = [
    { group: { representative: { key: "G0001" } }, translation: "one" },
    { group: { representative: { key: "G0002" } }, translation: "two" }
  ];

  const batches = buildAdaptiveUnitReviewBatches("review-00001", items);

  assert.deepEqual(
    batches.map((batch) =>
      batch.items.map((item) => item.group.representative.key)
    ),
    [["G0001"], ["G0002"]]
  );
  assert.notEqual(batches[0]!.inputHash, batches[1]!.inputHash);
});

test("salvages valid reviews and isolates only invalid corrections", () => {
  const expected = [
    { key: "G0001", sourceHtml: "<b> λόγος</b> word G3056" },
    { key: "G0002", sourceHtml: "<b> θεός</b> god G2316" },
    { key: "G0003", sourceHtml: "<b> ἄγγελος</b> messenger G0032" }
  ];
  const salvaged = salvageValidReviewResults(
    {
      reviews: [
        {
          key: "G0001",
          verdict: "accept",
          correctedContentHtmlFr: null,
          reasons: ["Correct."],
          confidence: 0.95
        },
        {
          key: "G0002",
          verdict: "correct",
          correctedContentHtmlFr: "<b> θεός</b> Dieu G9999",
          reasons: ["Correction."],
          confidence: 0.9
        }
      ]
    },
    expected
  );

  assert.deepEqual(
    salvaged.results.map((result) => result.key),
    ["G0001"]
  );
  assert.deepEqual(salvaged.unresolvedKeys, ["G0002", "G0003"]);
  assert.ok(
    salvaged.issues.some((issue) =>
      issue.includes("reviewer-validation:G0002:strong-sequence-mismatch")
    )
  );
  assert.ok(salvaged.issues.includes("reviews-missing:G0003"));
});

test("salvages valid notices and isolates only invalid or missing translations", () => {
  const expected = [
    { key: "G0001", sourceHtml: "<b> λόγος</b> word G3056" },
    { key: "G0002", sourceHtml: "<b> ἄγγελος</b> messenger G0032" },
    { key: "G0003", sourceHtml: "<b> θεός</b> god G2316" }
  ];
  const salvaged = salvageValidTranslationResults(
    {
      translations: [
        {
          key: "G0002",
          contentHtmlFr: "<b> ἄγγελος</b> messager G9999",
          changeSummary: ["Traduction."],
          confidence: 0.9
        },
        {
          key: "G0001",
          contentHtmlFr: "<b> λόγος</b> parole G3056",
          changeSummary: ["Traduction."],
          confidence: 0.95
        }
      ]
    },
    expected
  );

  assert.deepEqual(
    salvaged.results.map((result) => result.key),
    ["G0001"]
  );
  assert.deepEqual(salvaged.unresolvedKeys, ["G0002", "G0003"]);
  assert.ok(
    salvaged.issues.some((issue) =>
      issue.includes("translator-validation:G0002:strong-sequence-mismatch")
    )
  );
  assert.ok(salvaged.issues.includes("translations-missing:G0003"));
});

test("treats duplicate expected keys as unresolved instead of choosing one", () => {
  const sourceHtml = "<b> λόγος</b> word G3056";
  const translation = {
    key: "G0001",
    contentHtmlFr: "<b> λόγος</b> parole G3056",
    changeSummary: ["Traduction."],
    confidence: 0.95
  };

  const salvaged = salvageValidTranslationResults(
    { translations: [translation, { ...translation }] },
    [{ key: "G0001", sourceHtml }]
  );

  assert.deepEqual(salvaged.results, []);
  assert.deepEqual(salvaged.unresolvedKeys, ["G0001"]);
  assert.ok(salvaged.issues.includes("translations-duplicate:G0001"));
});

test("builds a stable partial recovery batch containing no healthy sibling", () => {
  const parent = {
    id: "translate-00081",
    items: [
      { representative: { key: "G0361" }, payload: "healthy" },
      { representative: { key: "G0362" }, payload: "invalid" },
      { representative: { key: "G0363" }, payload: "missing" }
    ],
    inputHash: "parent"
  };

  const first = buildPartialRecoveryBatch(
    parent,
    ["G0362", "G0363"],
    (item) => item.representative.key
  );
  const second = buildPartialRecoveryBatch(
    parent,
    ["G0362", "G0363"],
    (item) => item.representative.key
  );

  assert.deepEqual(
    first.items.map((item) => item.representative.key),
    ["G0362", "G0363"]
  );
  assert.equal(first.id, second.id);
  assert.equal(first.inputHash, second.inputHash);
});

test("accepts a French LSJ notice that preserves STEP markup and references", () => {
  const source =
    "<b> λόγος</b>, <br /> word [Refs (NT.Matt.18.23; “IG” 12.374.191)] <G3056>";
  const french =
    "<b> λόγος</b>, <br /> mot [Références (NT.Matt.18.23; “IG” 12.374.191)] <G3056>";

  const validation = validateLsjTranslation(source, french);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
});

test("rejects tag, original-token, Strong and reference drift", () => {
  const source =
    "<b> λόγος</b>, <br /> word [Refs (NT.Matt.18.23; 12.374.191)] G3056";
  const french =
    "<b> λόγος</b>, <br> mot [Références (NT.Matt.18.24; 12.374.192)] G3057";

  const validation = validateLsjTranslation(source, french);

  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("html-step-tag-sequence-mismatch"));
  assert.ok(validation.issues.includes("greek-hebrew-sequence-mismatch"));
  assert.ok(validation.issues.includes("strong-sequence-mismatch"));
  assert.ok(validation.issues.includes("reference-sequence-mismatch"));
});

test("permits an unchanged mechanical HTML defect inherited from STEP", () => {
  const source = "<Level1><b>A</b> source";
  const french = "<Level1><b>A</b> source française";

  const validation = validateLsjTranslation(source, french);

  assert.equal(validation.valid, true);
  assert.equal(validation.checks.tags, true);
  assert.equal(validation.checks.html, true);
});

test("permits inherited STEP typography artifacts but rejects new ones", () => {
  const source = "mot [[Refs (NT.Matt.1.1)]]";

  const inherited = validateLsjTranslation(
    source,
    "mot français [[Références (NT.Matt.1.1)]]"
  );
  const repaired = validateLsjTranslation(
    source,
    "mot français [Références (NT.Matt.1.1)]"
  );
  const introduced = validateLsjTranslation(
    "word [Refs (NT.Matt.1.1)]",
    "mot [[Références (NT.Matt.1.1)]]"
  );

  assert.equal(inherited.checks.typography, true);
  assert.equal(repaired.checks.typography, true);
  assert.equal(introduced.checks.typography, false);
});

test("splits long LSJ HTML deterministically without cutting tags or reference blocks", () => {
  const reference = "[Refs (NT.Matt.18.23; 12.374.191)]";
  const unit = `<b> λόγος</b> entry ${reference} <G3056> and more text. `;
  const source = unit.repeat(12);

  const first = splitLsjHtmlForTranslation(source, 180);
  const second = splitLsjHtmlForTranslation(source, 180);

  assert.ok(first.length > 1);
  assert.deepEqual(first, second);
  assert.equal(first.map((segment) => segment.sourceHtml).join(""), source);
  assert.equal(
    first
      .flatMap((segment) => segment.sourceHtml.match(/<[^<>]+>/gu) ?? [])
      .join("\n"),
    (source.match(/<[^<>]+>/gu) ?? []).join("\n")
  );
  assert.equal(
    first.reduce(
      (count, segment) =>
        count + segment.sourceHtml.split(reference).length - 1,
      0
    ),
    12
  );
  for (const segment of first) {
    assert.equal(
      segment.sourceHtml.includes("[Refs") &&
        !segment.sourceHtml.includes(")]"),
      false
    );
  }
});

test("reassembles validated translated segments and restores boundary whitespace", () => {
  const source = "<b> λόγος</b> entry one.  <br /> entry two G3056. ";
  const segments = splitLsjHtmlForTranslation(source, 30);
  const translated = segments.map((segment) =>
    segment.sourceHtml
      .replace(/entry/gu, "entrée")
      .replace(/one/gu, "une")
      .replace(/two/gu, "deux")
      .trim()
  );

  const contentHtmlFr = reassembleLsjTranslationSegments(
    source,
    segments,
    translated
  );

  assert.equal(validateLsjTranslation(source, contentHtmlFr).valid, true);
  assert.equal(contentHtmlFr.endsWith(" "), true);
  assert.match(contentHtmlFr, /entrée une/u);
  assert.match(contentHtmlFr, /entrée deux G3056/u);
});

test("rejects segmented reassembly when source segment provenance drifts", () => {
  const source = "first part second part";
  const segments = splitLsjHtmlForTranslation(source, 8);
  const drifted = segments.map((segment) => ({ ...segment }));
  drifted[0]!.sourceHtml = `x${drifted[0]!.sourceHtml}`;

  assert.throws(
    () =>
      reassembleLsjTranslationSegments(
        source,
        drifted,
        drifted.map((s) => s.sourceHtml)
      ),
    /lsj-segment-source-drift/u
  );
});
