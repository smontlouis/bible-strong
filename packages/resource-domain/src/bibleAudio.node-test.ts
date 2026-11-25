import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  chapterHasMusic,
  getBibleAudioUrl,
  getChapterPlace,
  getChapterScene,
  getVersionRecordings,
  parseBibleAudioCatalog,
  recordingCoversBook,
  type BibleAudioRecording,
} from './bibleAudio'

const reading = { fr: 'Lecture', en: 'Reading' }

const recording = (overrides: Partial<BibleAudioRecording> = {}): BibleAudioRecording => ({
  id: 'lsg-reading',
  version: 'LSG',
  name: reading,
  kind: 'reading',
  sources: [{ url: 'https://example.org/{book:2}_{chapter:3}.mp3' }],
  ...overrides,
})

describe('parseBibleAudioCatalog', () => {
  it('keeps the well-formed recordings and leaves out the others', () => {
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [
        recording(),
        { ...recording({ id: 'no-sources' }), sources: [] },
        { ...recording({ id: 'plain-http' }), sources: [{ url: 'http://example.org/{chapter}' }] },
        {
          ...recording({ id: 'no-code-list' }),
          sources: [{ url: 'https://x.org/{bookCode}/{chapter}' }],
        },
        { ...recording({ id: 'unknown-kind' }), kind: 'podcast' },
        recording({ id: 'lsg-reading', version: 'KJV' }),
      ],
    })
    assert.deepEqual(
      catalog?.recordings.map(entry => `${entry.id}:${entry.version}`),
      ['lsg-reading:LSG']
    )
  })

  it('refuses what is not a catalog of this version', () => {
    assert.equal(parseBibleAudioCatalog({ version: 2, recordings: [] }), undefined)
    assert.equal(parseBibleAudioCatalog([]), undefined)
  })
})

describe('attribution', () => {
  const attribution = {
    label: { fr: 'Voix : tresorsonore.com', en: 'Voice: tresorsonore.com' },
    url: 'https://www.tresorsonore.com',
    logo: 'https://media.example.org/logo.png',
  }

  it('keeps the mention a publisher asks for', () => {
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [recording({ attribution })],
    })
    assert.deepEqual(catalog?.recordings[0]?.attribution, attribution)
  })

  it('leaves out a recording whose mention cannot be shown', () => {
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [
        recording({ id: 'no-link', attribution: { ...attribution, url: 'tresorsonore.com' } }),
        recording({ id: 'plain-logo', attribution: { ...attribution, logo: 'http://x.org/a.png' } }),
        { ...recording({ id: 'no-label' }), attribution: { url: attribution.url } },
      ],
    })
    assert.deepEqual(catalog?.recordings, [])
  })
})

describe('music', () => {
  it('reads the music of a recording, in all its chapters or some', () => {
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [
        recording({ id: 'musical', music: 'all' }),
        recording({ id: 'mixed', music: ['40:3', '41:1'] }),
        { ...recording({ id: 'bad-mark' }), music: ['Matthew 3'] },
      ],
    })
    const [musical, mixed] = catalog?.recordings ?? []
    assert.deepEqual(
      catalog?.recordings.map(entry => entry.id),
      ['musical', 'mixed']
    )
    assert.equal(chapterHasMusic(musical!, 1, 1), true)
    assert.equal(chapterHasMusic(mixed!, 40, 3), true)
    assert.equal(chapterHasMusic(mixed!, 40, 4), false)
    assert.equal(chapterHasMusic(recording(), 40, 3), false)
  })

  it('keeps the well-formed background music, once each', () => {
    const piano = {
      id: 'piano',
      name: { fr: 'Piano', en: 'Piano' },
      url: 'https://media.example.org/piano.mp3',
    }
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [],
      music: [piano, { ...piano, name: { fr: 'Autre', en: 'Other' } }, { ...piano, id: 'x', url: 'http://a' }],
    })
    assert.deepEqual(catalog?.music, [piano])
  })
})

describe('getBibleAudioUrl', () => {
  it('pads the numbers to the width asked', () => {
    assert.equal(getBibleAudioUrl(recording(), 1, 7), 'https://example.org/01_007.mp3')
  })

  it('takes the first source naming the book, else the default', () => {
    const lsg = recording({
      sources: [
        { books: [19], url: 'https://a.org/{book:2}_{chapter:2}.mp3' },
        { url: 'https://b.org/{book:2}_{chapter:2}.mp3' },
      ],
    })
    assert.equal(getBibleAudioUrl(lsg, 19, 23), 'https://a.org/19_23.mp3')
    assert.equal(getBibleAudioUrl(lsg, 1, 1), 'https://b.org/01_01.mp3')
  })

  it('counts a book of the New Testament from Matthew', () => {
    const niv = recording({
      sources: [{ url: 'https://c.org/{testament}/{testamentBook:2}_{chapter:3}.mp3' }],
    })
    assert.equal(getBibleAudioUrl(niv, 43, 3), 'https://c.org/nt/04_003.mp3')
    assert.equal(getBibleAudioUrl(niv, 19, 119), 'https://c.org/at/19_119.mp3')
  })

  it('writes the publisher’s code of the book', () => {
    const esv = recording({
      bookCodes: ['ge', 'ex'],
      sources: [{ url: 'https://d.org/{book:2}_{bookCode}_{chapter:3}.mp3' }],
    })
    assert.equal(getBibleAudioUrl(esv, 2, 20), 'https://d.org/02_ex_020.mp3')
    assert.equal(getBibleAudioUrl(esv, 3, 1), undefined)
  })

  it('gives nothing for a book the recording does not cover', () => {
    const gospels = recording({ books: [40, 41, 42, 43] })
    assert.equal(recordingCoversBook(gospels, 1), false)
    assert.equal(getBibleAudioUrl(gospels, 1, 1), undefined)
    assert.equal(getBibleAudioUrl(gospels, 43, 1), 'https://example.org/43_001.mp3')
  })
})

describe('getVersionRecordings', () => {
  it('lists the recordings of a version in the catalog’s order', () => {
    const catalog = {
      version: 1 as const,
      recordings: [
        recording({ id: 'lsg-a' }),
        recording({ id: 'kjv-a', version: 'KJV' }),
        recording({ id: 'lsg-drama', kind: 'drama' }),
      ],
    }
    assert.deepEqual(
      getVersionRecordings(catalog, 'LSG').map(entry => entry.id),
      ['lsg-a', 'lsg-drama']
    )
  })
})

describe('places of the chapters', () => {
  it('keeps the well-formed places and reads one by book and chapter', () => {
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [],
      places: { '1:2': 'Eden@Gen.2.8-Jol', 'Gen 3': 'Eden@Gen.2.8-Jol', '2:19': 42 },
    })
    assert.deepEqual(catalog?.places, { '1:2': 'Eden@Gen.2.8-Jol' })
    assert.equal(catalog && getChapterPlace(catalog, 1, 2), 'Eden@Gen.2.8-Jol')
    assert.equal(catalog && getChapterPlace(catalog, 1, 1), undefined)
  })
})

describe('scenes of the chapters', () => {
  it('keeps the slugs of the scenes and reads one by book and chapter', () => {
    const catalog = parseBibleAudioCatalog({
      version: 1,
      recordings: [],
      scenes: { '1:7': 'flood', '1:8': 'Not A Slug' },
    })
    assert.deepEqual(catalog?.scenes, { '1:7': 'flood' })
    assert.equal(catalog && getChapterScene(catalog, 1, 7), 'flood')
  })
})
