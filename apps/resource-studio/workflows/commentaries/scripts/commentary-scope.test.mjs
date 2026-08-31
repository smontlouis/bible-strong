import assert from "node:assert/strict";
import test from "node:test";
import {
  entryCoversPassage,
  expandBarnesEntries,
  normalizeBarnesEntries,
  normalizeEntryScope,
  normalizeRepeatedSourceEntries,
  parseDeclaredRange
} from "./commentary-scope.mjs";

const entry = ({
  resourceId,
  passage = "1-1-3",
  html,
  translation = null,
  ...rest
}) => ({
  schemaVersion: 1,
  id: `${resourceId}:${passage}`,
  passage,
  resource: { id: resourceId },
  source: { language: "en", html, sha256: `sha:${html}` },
  translation,
  ...rest
});

test("reconnaît les plages déclarées propres aux corpus prioritaires", () => {
  assert.deepEqual(
    parseDeclaredRange(
      entry({ resourceId: "mhcc", html: "<strong>Verses 3-5</strong> Text" })
    ),
    { start: "1-1-3", end: "1-1-5" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "jfb",
        html: "<strong>Ge 1:3-5.</strong> The First Day"
      })
    ),
    { start: "1-1-3", end: "1-1-5" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "jfb",
        passage: "1-1-4",
        html: "<strong>CHAPTER 1 Ge 1:3-5.</strong> The First Day"
      })
    ),
    { start: "1-1-3", end: "1-1-5" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "jfb",
        passage: "1-1-6",
        html: "<strong>6-10.</strong> A section"
      })
    ),
    { start: "1-1-6", end: "1-1-10" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "kd",
        passage: "1-1-6",
        html: "<strong>Gen 1:6-8</strong> The second day"
      })
    ),
    { start: "1-1-6", end: "1-1-8" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "mhy-fr",
        html: "",
        translation: { html: "<p>La création de la lumière. (3-5)</p>" }
      })
    ),
    { start: "1-1-3", end: "1-1-5" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "bible-annotee",
        html: "",
        translation: { html: "<p>3-5. Le premier jour.</p>" }
      })
    ),
    { start: "1-1-3", end: "1-1-5" }
  );
  assert.deepEqual(
    parseDeclaredRange(
      entry({
        resourceId: "fourfold-gospel",
        passage: "44-2-6",
        html: "<p>#Ac 2:6-12| A section</p>"
      })
    ),
    { start: "44-2-6", end: "44-2-12" }
  );
});

test("refuse une plage dont le début ne correspond pas à l’ancre", () => {
  assert.equal(
    parseDeclaredRange(
      entry({ resourceId: "mhcc", html: "<strong>Verses 4-5</strong> Text" })
    ),
    null
  );
  assert.equal(
    parseDeclaredRange(
      entry({ resourceId: "jfb", html: "<strong>Ge 2:3-5.</strong> Text" })
    ),
    null
  );
});

test("normalise les fins structurées et les profils éditoriaux", () => {
  const structured = normalizeEntryScope(
    entry({
      resourceId: "aquifer-fr",
      passageEnd: "1-1-13",
      html: "<p>Text</p>"
    })
  );
  assert.deepEqual(structured.scope, {
    kind: "range",
    start: "1-1-3",
    end: "1-1-13",
    source: "structured-source",
    confidence: "exact"
  });

  const introduction = normalizeEntryScope(
    entry({
      resourceId: "bible-annotee",
      passage: "1-2-0",
      html: "<p>Intro</p>",
      editorialKind: "chapter-introduction"
    })
  );
  assert.equal(introduction.scope.kind, "chapter");
  const psalm = normalizeEntryScope(
    entry({
      resourceId: "treasury-david",
      passage: "19-23-1",
      html: "<p>Psalm</p>"
    })
  );
  assert.equal(psalm.scope.kind, "chapter");
  const homily = normalizeEntryScope(
    entry({ resourceId: "fre-chry", passage: "40-5-1", html: "<p>Homélie</p>" })
  );
  assert.equal(homily.scope.kind, "homily");
});

test("déduplique Barnes sans perdre les traductions propres aux ancres", () => {
  const source = "<p>Verses 3-5. The first day.</p>";
  const entries = [3, 4, 5].map((verse) =>
    entry({
      resourceId: "barnes",
      passage: `1-1-${verse}`,
      html: source,
      translation:
        verse === 4
          ? null
          : {
              language: "fr",
              html: `<p>Traduction ${verse}</p>`,
              sha256: `fr-${verse}`
            }
    })
  );
  entries.forEach((candidate) => {
    candidate.source.sha256 = "same-source";
  });
  const normalized = normalizeBarnesEntries(entries);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].passageEnd, "1-1-5");
  assert.equal(normalized[0].sourceAnchors.length, 3);
  assert.equal(normalized[0].translationVariants.length, 2);
  assert.equal(normalized[0].translationVariants[0].translation, null);
  assert.equal(normalized[0].deduplication.distinctTranslationCount, 3);

  const expanded = expandBarnesEntries(normalized);
  assert.deepEqual(
    expanded.map((candidate) => candidate.passage),
    ["1-1-3", "1-1-4", "1-1-5"]
  );
  assert.equal(expanded[1].translation, null);
  assert.equal(expanded[2].translation.sha256, "fr-5");
});

test("déduplique aussi une unité source répétée dans une autre ressource", () => {
  const entries = [48, 49].map((verse) =>
    entry({
      resourceId: "scofield",
      passage: `43-8-${verse}`,
      html: "<strong>devil</strong> demon."
    })
  );
  entries.forEach((candidate) => {
    candidate.source.sha256 = "same-scofield-source";
  });

  const normalized = normalizeRepeatedSourceEntries(entries);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].scope.start, "43-8-48");
  assert.equal(normalized[0].scope.end, "43-8-49");
  assert.equal(normalized[0].sourceAnchors.length, 2);
});

test("résout une plage depuis chacun des versets couverts sans étendre les homélies", () => {
  const ranged = normalizeEntryScope(
    entry({
      resourceId: "aquifer-fr",
      passageEnd: "1-1-5",
      html: "<p>Text</p>"
    })
  );
  assert.equal(entryCoversPassage(ranged, "1-1-4"), true);
  assert.equal(entryCoversPassage(ranged, "1-1-6"), false);
  const homily = normalizeEntryScope(
    entry({ resourceId: "fre-aug", html: "<p>Homélie</p>" })
  );
  assert.equal(entryCoversPassage(homily, "1-1-4"), false);
  const chapter = normalizeEntryScope(
    entry({
      resourceId: "treasury-david",
      passage: "19-23-1",
      html: "<p>Psalm</p>"
    })
  );
  assert.equal(entryCoversPassage(chapter, "19-23-4"), true);
});
