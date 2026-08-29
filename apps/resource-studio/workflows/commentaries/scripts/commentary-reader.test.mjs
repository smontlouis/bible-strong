import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeDocument, decodeValue, sha256 } from './firestore.mjs'
import { inspectTranslation, plainText, probableLanguage } from './quality.mjs'
import { CROSSWIRE_RESOURCES, normalizeSourceMarkup, parseImp, selectRashiEditions } from './wave-sources.mjs'
import { applyPublishedTranslations } from './published-translations.mjs'

test('decode les valeurs Firestore utilisées par l’exporteur', () => {
  assert.deepEqual(
    decodeValue({ mapValue: { fields: { code: { stringValue: 'acbc' }, active: { booleanValue: true } } } }),
    { code: 'acbc', active: true }
  )
  assert.deepEqual(
    decodeDocument({
      name: 'projects/example/databases/(default)/documents/comments/42',
      fields: { id: { integerValue: '42' }, content: { stringValue: '<p>Texte</p>' } },
    }),
    { documentId: '42', id: 42, content: '<p>Texte</p>' }
  )
})

test('normalise le texte HTML et ses entités', () => {
  assert.equal(plainText('<p>Grâce &amp; vérité&nbsp;!</p>'), 'Grâce & vérité !')
})

test('distingue un texte français et un texte anglais', () => {
  assert.equal(probableLanguage('<p>Dieu est avec nous et le Seigneur nous conduit dans cette voie.</p>'), 'fr')
  assert.equal(probableLanguage('<p>The Lord is with us and God is in this place.</p>'), 'en')
})

test('signale une traduction identique, anglaise ou dangereuse', () => {
  const source = '<p>The Lord is with us and God is in this place.</p>'
  const identical = inspectTranslation({ sourceHtml: source, translationHtml: source })
  assert.ok(identical.issues.includes('identical-to-source'))
  assert.ok(identical.issues.includes('probably-english'))

  const dangerous = inspectTranslation({
    sourceHtml: source,
    translationHtml: '<p>Dieu est avec nous.</p><script>alert(1)</script>',
  })
  assert.ok(dangerous.issues.includes('dangerous-html'))
  assert.equal(dangerous.translationSha256, sha256('<p>Dieu est avec nous.</p><script>alert(1)</script>'))
})

test('convertit un export IMP CrossWire sans perdre le passage', () => {
  const resource = CROSSWIRE_RESOURCES.find(candidate => candidate.id === 'mhcc')
  const entries = parseImp('$$$Genesis 1:1\n<hi type="bold">Verses 1-2</hi> Text <reference osisRef="John.1.1">Jn 1:1</reference>\n', resource)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].passage, '1-1-1')
  assert.match(entries[0].source.html, /<strong>Verses 1-2<\/strong>/)
  assert.match(entries[0].source.html, /class="ref"/)
  assert.match(entries[0].source.html, /data-osis="John\.1\.1"/)
})

test('écarte les marqueurs vides des modules CrossWire', () => {
  const resource = CROSSWIRE_RESOURCES.find(candidate => candidate.id === 'fre-aug')
  assert.deepEqual(parseImp('$$$Sirach 1:1\n[]\n', resource), [])
})

test('conserve le HTML éditorial utile et supprime les jalons OSIS', () => {
  const normalized = normalizeSourceMarkup('<milestone type="x"/><div sID="a" type="x-p"/><title>Heading</title><div eID="a" type="x-p"/>')
  assert.equal(normalized, '<h4>Heading</h4>')
})

test('sélectionne une édition Rachi explicite plutôt qu’un assemblage merged', () => {
  const books = []
  for (const title of [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
    'I Samuel', 'II Samuel', 'I Kings', 'II Kings', 'I Chronicles', 'II Chronicles', 'Ezra',
    'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Songs',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
    'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  ]) {
    books.push({
      title: `Rashi on ${title}`,
      language: 'English',
      categories: ['Tanakh'],
      versionTitle: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'].includes(title)
        ? 'Rashi Chumash, Metsudah Publications, 2009'
        : title === 'Joshua'
          ? 'The Book of Joshua, Metsudah Publications, 1997'
          : ['Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings'].includes(title)
            ? 'The Metsudah Tanach series, Lakewood, N.J'
            : 'The Judaica Press complete Tanach with Rashi, translated by A. J. Rosenberg',
      json_url: `https://example.test/${title}`,
    })
    books.push({ title: `Rashi on ${title}`, language: 'English', categories: ['Tanakh'], versionTitle: 'merged' })
  }
  const editions = selectRashiEditions(books)
  assert.equal(editions.length, 39)
  assert.ok(editions.every(edition => edition.versionTitle !== 'merged'))
})

test('applique une traduction publiée seulement à la révision source correspondante', () => {
  const source = {
    id: '42',
    source: { sha256: 'source-v1' },
    translation: null,
  }
  const translations = new Map([['42', {
    id: '42',
    sourceSha256: 'source-v1',
    translatedHtml: '<p>Texte français.</p>',
    translator: { model: 'gpt-5.6-luna', reasoningEffort: 'xhigh' },
    batchId: 'acbc-0001',
  }]])
  const [translated] = applyPublishedTranslations('acbc', [source], translations)
  assert.equal(translated.translation.provenance, 'gpt-5.6-luna (xhigh); lot acbc-0001')
  assert.equal('status' in translated.translation, false)
  assert.equal(translated.translation.html, '<p>Texte français.</p>')

  translations.get('42').sourceSha256 = 'source-v2'
  assert.throws(() => applyPublishedTranslations('acbc', [source], translations), /source a changé/)
})

test('refuse d’écraser une traduction historique', () => {
  const source = {
    id: '42',
    source: { sha256: 'source-v1' },
    translation: { language: 'fr', html: '<p>Déjà traduit.</p>' },
  }
  const translations = new Map([['42', {
    sourceSha256: 'source-v1',
    translatedHtml: '<p>Nouveau texte.</p>',
    translator: { model: 'gpt-5.6-luna', reasoningEffort: 'xhigh' },
    batchId: 'acbc-0001',
  }]])
  assert.throws(() => applyPublishedTranslations('acbc', [source], translations), /Refus d’écraser/)
})
