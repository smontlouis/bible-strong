import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomaticCandidates,
  buildEntryResolver,
  linkDictionaryDefinition
} from "./dictionary-entry-links.mjs";

const entries = [
  { id: 1, word: "Aaron", definition: "" },
  { id: 2, word: "Hérodes (les)", definition: "" },
  { id: 3, word: "Grâce", definition: "" },
  { id: 4, word: "Devoir", definition: "" },
  { id: 5, word: "Temple (Hérode)", definition: "" }
];

test("retire les auto-liens et résout un ancien renvoi vers une destination unique", () => {
  const resolver = buildEntryResolver(entries, "westphal");
  const result = linkDictionaryDefinition({
    html: '<p><a class="word" href="Aaron">Aaron</a> rencontre <a class="word" href="Hérode">Hérode</a>.</p>',
    entry: entries[0],
    resolver,
    candidates: []
  });
  assert.equal(
    result.html,
    '<p>Aaron rencontre <a class="word" href="Hérodes (les)" data-entry-id="2" data-link-origin="source">Hérode</a>.</p>'
  );
  assert.equal(result.stats.selfLinksRemoved, 1);
  assert.equal(result.stats.sourceLinksRetained, 1);
});

test("déduplique les copies identiques et tolère une variante éditoriale unique", () => {
  const resolver = buildEntryResolver(
    [
      { id: 1, word: "Juda", definition: "même article" },
      { id: 2, word: "Juda", definition: "même article" },
      { id: 3, word: "Kémos", definition: "article" }
    ],
    "westphal"
  );
  assert.equal(resolver.resolve("Juda")?.id, 1);
  assert.equal(resolver.resolve("Kamos", { allowUniquePartial: true })?.id, 3);
});

test("préserve les destinations que seul un accent distingue", () => {
  const resolver = buildEntryResolver(
    [
      { id: 1, word: "Ragau", definition: "premier" },
      { id: 2, word: "Ragaü", definition: "second" }
    ],
    "westphal"
  );
  assert.equal(resolver.resolve("Ragau")?.id, 1);
  assert.equal(resolver.resolve("Ragaü")?.id, 2);
});

test("supprime un ancien lien sans destination vérifiable", () => {
  const resolver = buildEntryResolver(entries, "westphal");
  const result = linkDictionaryDefinition({
    html: '<p><a class="word" href="Inconnu">Inconnu</a></p>',
    entry: entries[0],
    resolver,
    candidates: []
  });
  assert.equal(result.html, "<p>Inconnu</p>");
  assert.equal(result.stats.unresolvedSourceLinksRemoved, 1);
});

test("génère au plus un lien exact par destination et préserve les ancres bibliques", () => {
  const resolver = buildEntryResolver(entries, "westphal");
  const result = linkDictionaryDefinition({
    html: '<p>Aaron et Aaron. <a class="verse bible-ref" href="bible://Exod.6.16">Exode 6.16</a><code>Aaron</code></p>',
    entry: entries[2],
    resolver,
    candidates: [{ surface: "Aaron", destination: entries[0] }]
  });
  assert.equal(
    result.html,
    '<p><a class="word" href="Aaron" data-entry-id="1" data-link-origin="generated">Aaron</a> et Aaron. <a class="verse bible-ref" href="bible://Exod.6.16">Exode 6.16</a><code>Aaron</code></p>'
  );
  assert.equal(result.stats.generatedLinks, 1);
});

test("ne transforme pas un mot courant dont l’entrée est en minuscules", () => {
  const resolver = buildEntryResolver(
    [{ id: 1, word: "juste", definition: "" }],
    "bost"
  );
  const candidates = buildAutomaticCandidates({
    work: "bost",
    language: "fr",
    resolver,
    namedSubjects: [],
    correspondenceIndex: {
      groups: [
        {
          members: [
            { work: "bost", id: 1, word: "juste" },
            { work: "westphal", id: 2, word: "Juste" }
          ]
        }
      ]
    }
  });
  assert.deepEqual(candidates, []);
});

test("écarte Webster, les verbes risqués et les termes courts non attestés", () => {
  const resolver = buildEntryResolver(
    [
      { id: 1, word: "Aaron", definition: "Easton" },
      {
        id: 2,
        word: "Ball",
        definition: "<strong>Ball - (Webster&#39;s 1828 Dictionary)</strong>"
      },
      { id: 3, word: "Tell", definition: "Easton" },
      { id: 4, word: "Ur", definition: "Easton" }
    ],
    "easton-webster"
  );
  const candidates = buildAutomaticCandidates({
    work: "easton-webster",
    language: "en",
    resolver,
    namedSubjects: ["Aaron"],
    correspondenceIndex: {
      groups: [
        {
          members: [
            { work: "easton-webster", id: 1, word: "Aaron" },
            {
              work: "unfoldingword-translation-words",
              id: 10,
              word: "Aaron"
            }
          ]
        },
        {
          members: [
            { work: "easton-webster", id: 2, word: "Ball" },
            { work: "smith", id: 20, word: "Ball" }
          ]
        },
        {
          members: [
            { work: "easton-webster", id: 3, word: "Tell" },
            { work: "smith", id: 30, word: "Tell" }
          ]
        },
        {
          members: [
            { work: "easton-webster", id: 4, word: "Ur" },
            { work: "smith", id: 40, word: "Ur" }
          ]
        }
      ]
    }
  });
  assert.deepEqual(
    candidates.map((candidate) => candidate.surface),
    ["Aaron"]
  );
});

test("lie un renvoi See ambigu grâce au numéro de section", () => {
  const sectionedEntries = [
    {
      id: 1,
      word: "Kedesh (1)",
      definition: "<p>(1) Première.</p><p>(3) Kedesh-naphtali.</p>"
    },
    { id: 2, word: "Kedesh (2)", definition: "<p>Autre article.</p>" },
    { id: 3, word: "Kadesh in Galilee", definition: "" }
  ];
  const resolver = buildEntryResolver(sectionedEntries, "isbe");
  const result = linkDictionaryDefinition({
    html: "<p>See KEDESH, 3.</p>",
    entry: sectionedEntries[2],
    resolver,
    candidates: []
  });
  assert.equal(
    result.html,
    '<p>See <a class="word" href="Kedesh (1)" data-entry-id="1" data-link-origin="cue" data-entry-section="3">KEDESH</a>, 3.</p>'
  );
  assert.equal(result.stats.editorialCueLinks, 1);
});

test("lie les renvois éditoriaux français et les listes séparées par un point-virgule", () => {
  const cueEntries = [
    { id: 1, word: "Abija", definition: "" },
    { id: 2, word: "Fer", definition: "" },
    { id: 3, word: "Article", definition: "" }
  ];
  const resolver = buildEntryResolver(cueEntries, "bost");
  const result = linkDictionaryDefinition({
    html: "<p>Voir Abija; Fer. Voyez aussi Inconnu.</p>",
    entry: cueEntries[2],
    resolver,
    candidates: []
  });
  assert.equal(
    result.html,
    '<p>Voir <a class="word" href="Abija" data-entry-id="1" data-link-origin="cue">Abija</a>; <a class="word" href="Fer" data-entry-id="2" data-link-origin="cue">Fer</a>. Voyez aussi Inconnu.</p>'
  );
  assert.equal(result.stats.editorialCueLinks, 2);
});

test("ne lie pas un renvoi See sans destination de dictionnaire", () => {
  const resolver = buildEntryResolver(entries, "isbe");
  const result = linkDictionaryDefinition({
    html: "<p>See Delitzsch on Romans.</p>",
    entry: entries[0],
    resolver,
    candidates: []
  });
  assert.equal(result.html, "<p>See Delitzsch on Romans.</p>");
  assert.equal(result.stats.editorialCueLinks, 0);
});
