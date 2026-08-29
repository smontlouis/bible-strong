import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidCommentaryReference, normalizeCommentaryContent } from './commentary-links.mjs'

const normalize = (html, resourceId = 'acbc', language = 'en', passage = '1-1-1') =>
  normalizeCommentaryContent({ html, resourceId, language, passage })

test('convertit une destination fournisseur en référence OSIS sans conserver de lien', () => {
  const result = normalize('<p>See <a class="bible-ref" href="/John_3.16">John 3:16</a>.</p>')
  assert.equal(result.html, '<p>See <span class="bible-ref" data-reference-id="r1">John 3:16</span>.</p>')
  assert.deepEqual(result.references, [{
    id: 'r1', kind: 'bible', osis: 'John.3.16', label: 'John 3:16', source: 'provider-href', confidence: 'exact',
  }])
  assert.ok(result.references.every(isValidCommentaryReference))
  assert.doesNotMatch(result.html, /<a\b|href=/iu)
})

test('utilise ref.ly lorsque le libellé Aquifer dépend du contexte', () => {
  const result = normalize('<p>See <a href="https://ref.ly/Gen1:22-Gen1:25">1:22–25</a>.</p>', 'aquifer-fr')
  assert.equal(result.references[0].osis, 'Gen.1.22-Gen.1.25')
  assert.equal(result.references[0].source, 'provider-href')
})

test('normalise les identifiants MHY et les paramètres Calvin', () => {
  const mhy = normalize('<a href="REV2.7;22.2">Apocalypse 2.7 ; 22.2</a>', 'mhy-fr', 'fr', '66-2-7')
  assert.equal(mhy.references[0].osis, 'Rev.2.7,Rev.22.2')
  const calvin = normalize('<a href="?scrBook=Gen&amp;scrCh=12&amp;scrV=1#note">12:1</a>', 'calvin')
  assert.equal(calvin.references[0].osis, 'Gen.12.1')
})

test('préserve un osisRef CrossWire même si son libellé est relatif', () => {
  const result = normalize('<span class="ref" data-osis="John.3.16">16</span>', 'jfb', 'en', '43-3-15')
  assert.equal(result.references[0].osis, 'John.3.16')
  assert.equal(result.references[0].source, 'osis-attribute')
})

test('complète les références textuelles avec BCV au build', () => {
  const result = normalize('<p>Compare Romans 8:28 and <em>John 3:16</em>.</p>', 'mhc')
  assert.deepEqual(result.references.map(reference => reference.osis), ['Rom.8.28', 'John.3.16'])
  assert.ok(result.references.every(reference => reference.source === 'bcv-text'))
})

test('écarte les faux positifs français formés avec l’article Le', () => {
  const result = normalize('<p>Le verset 5 explique le passage.</p>', 'bible-annotee', 'fr')
  assert.deepEqual(result.references, [])
  assert.equal(result.html, '<p>Le verset 5 explique le passage.</p>')
})

test('écarte les articles numérotés et le verbe est des références françaises', () => {
  const result = normalize('<p>La 5e année, Le 17 partit et il est " 1 heure.</p>', 'barnes', 'fr', '30-1-1')
  assert.deepEqual(result.references, [])
  assert.equal(result.html, '<p>La 5e année, Le 17 partit et il est " 1 heure.</p>')
})

test('jette les publicités et conserve une source éditoriale hors du HTML', () => {
  const result = normalize([
    '<a href="http://www.compassion.com/sponsor_a_child/default.htm"></a>',
    '<a href="https://remacle.org/source">Dialogue avec Tryphon</a>',
    '<a name="old-anchor"></a>',
  ].join(''), 'aquifer-fr', 'fr')
  assert.equal(result.html, 'Dialogue avec Tryphon')
  assert.deepEqual(result.externalSources, [{
    label: 'Dialogue avec Tryphon', url: 'https://remacle.org/source', policy: 'metadata-only',
  }])
  assert.equal(result.stats.anchorsRemoved, 3)
})

test('ne reparcourt pas un contenu déjà normalisé', () => {
  const first = normalize('<p>John 3:16</p>', 'mhc')
  const second = normalizeCommentaryContent({
    html: first.html,
    resourceId: 'mhc',
    language: 'en',
    passage: '43-3-16',
    references: first.references,
    externalSources: first.externalSources,
  })
  assert.equal(second.html, first.html)
  assert.deepEqual(second.references, first.references)
})

test('répare un faux positif existant et annote une référence résiduelle', () => {
  const normalized = normalizeCommentaryContent({
    html: '<p>tel qu’il <span class="bible-ref" data-reference-id="r1">est " 1</span> Jean 3:2 heureux</p>',
    resourceId: 'barnes',
    language: 'fr',
    passage: '29-3-21',
    references: [{ id: 'r1', kind: 'bible', osis: 'Esth.1', label: 'est " 1', source: 'bcv-text', confidence: 'high' }],
  })
  assert.equal(normalized.html, '<p>tel qu’il est " <span class="bible-ref" data-reference-id="r1">1 Jean 3:2</span> heureux</p>')
  assert.deepEqual(normalized.references, [{
    id: 'r1', kind: 'bible', osis: '1John.3.2', label: '1 Jean 3:2', source: 'bcv-text', confidence: 'high',
  }])
})

test('retire une ancienne source externe fournisseur lors d’une relance', () => {
  const normalized = normalizeCommentaryContent({
    html: '<span class="bible-ref" data-reference-id="r1">Jean 3.16</span>',
    resourceId: 'aquifer-fr',
    language: 'fr',
    passage: '43-3-16',
    references: [{ id: 'r1', kind: 'bible', osis: 'John.3.16', label: 'Jean 3.16', source: 'provider-href', confidence: 'exact' }],
    externalSources: [{ label: 'Jean 3.16', url: 'https://ref.ly/John3:16', policy: 'metadata-only' }],
  })
  assert.deepEqual(normalized.externalSources, [])
})
