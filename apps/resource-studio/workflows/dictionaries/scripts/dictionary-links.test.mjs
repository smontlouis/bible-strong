import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expandOsisToVerseKeys,
  isCheckedBibleUri,
  normalizeDictionaryDefinition
} from "./dictionary-links.mjs";

const normalize = (html, language = "fr") =>
  normalizeDictionaryDefinition({ html, language });

describe("normalisation des liens bibliques des dictionnaires", () => {
  it("convertit et canonicalise les anciens liens de versets", () => {
    const result = normalize(
      '<p>Voir <a class="verse" href="Jean&nbsp;3.16">Jean 3.16</a>.</p>'
    );
    assert.equal(
      result.html,
      '<p>Voir <a class="verse bible-ref" href="bible://John.3.16" data-osis="John.3.16">Jean 3.16</a>.</p>'
    );
    assert.deepEqual(result.references, ["John.3.16"]);
    assert.equal(result.stats.existingLinksConverted, 1);
  });

  it("détecte les références françaises et anglaises dans le texte", () => {
    const french = normalize("<p>Comparer Genèse 1.1-3 et Jean 3:16.</p>");
    const english = normalize("See Matthew 5:1-4 and Romans 8:28.", "en");
    assert.match(french.html, /bible:\/\/Gen\.1\.1-Gen\.1\.3/u);
    assert.match(french.html, /bible:\/\/John\.3\.16/u);
    assert.match(english.html, /bible:\/\/Matt\.5\.1-Matt\.5\.4/u);
    assert.match(english.html, /bible:\/\/Rom\.8\.28/u);
  });

  it("préserve les liens de mots et retire les liens non validés", () => {
    const result = normalize(
      '<a class="word extra" href="Alliance">Alliance</a> — <a href="https://example.test">ailleurs</a> — <a href="bible://NotABook.3.2">invalide</a>'
    );
    assert.match(
      result.html,
      /^<a class="word" href="Alliance">Alliance<\/a>/u
    );
    assert.doesNotMatch(
      result.html,
      /example\.test|NotABook|<a[^>]*>ailleurs/u
    );
    assert.equal(result.stats.wordLinksRetained, 1);
    assert.equal(result.stats.invalidBibleLinksRemoved, 1);
  });

  it("évite les faux positifs courts et respecte les zones de code", () => {
    const result = normalize(
      "<p>Le verset 5, Jean et Job sont cités, mais sans référence.</p><code>Jean 3.16</code>"
    );
    assert.doesNotMatch(result.html, /bible:\/\//u);
  });

  it("ne transforme jamais un renvoi de mot homonyme d'un livre", () => {
    const result = normalize('<a class="word" href="Job">Job</a>');
    assert.equal(result.html, '<a class="word" href="Job">Job</a>');
    assert.deepEqual(result.references, []);
  });

  it("est idempotente et ne produit que des URI contrôlées", () => {
    const once = normalize("<p>Jean 3.16 et Romains 8.28.</p>");
    const twice = normalize(once.html);
    assert.equal(twice.html, once.html);
    for (const match of once.html.matchAll(/href="(bible:\/\/[^"]+)"/gu)) {
      assert.equal(isCheckedBibleUri(match[1]), true);
    }
  });

  it("déplie les plages OSIS vers les clés numériques de l'application", () => {
    assert.deepEqual(expandOsisToVerseKeys("John.3.16-John.3.18"), [
      "43-3-16",
      "43-3-17",
      "43-3-18"
    ]);
    assert.equal(expandOsisToVerseKeys("Gen.1", 20).length, 0);
  });
});
