import {
  getCanonicalBibleNotePayload,
  getNoteNavigationPayload,
  getNumberPayload,
  getPassageMediaPayload,
  getStrongRelationSelectionPayload,
  getStringPayload,
  getStudyRelationsModalTarget,
  getToastPayload,
  getVerseIdsPayload,
} from '../bibleDomBridgeCommands'

describe('bibleDomBridgeCommands', () => {
  it('parses primitive string and number payloads conservatively', () => {
    expect(getStringPayload('note-1')).toBe('note-1')
    expect(getStringPayload({ value: 'note-1' })).toBeUndefined()
    expect(getNumberPayload(2)).toBe(2)
    expect(getNumberPayload('2')).toBeUndefined()
  })

  it('turns Strong relation endpoints into viewer Strong selections', () => {
    expect(
      getStrongRelationSelectionPayload({ type: 'strong', language: 'hebrew', code: '3068' }, 'DBY')
    ).toEqual({
      book: 1,
      reference: '3068',
      identities: [{ kind: 'strong', code: 'H3068' }],
      version: 'DBY',
    })
    expect(
      getStrongRelationSelectionPayload(
        { type: 'strong', language: 'unknown', code: '3068' },
        'DBY'
      )
    ).toBeUndefined()
  })

  it('parses toast payloads from object messages only', () => {
    expect(getToastPayload({ message: 'hello', type: 'warning' })).toEqual({
      message: 'hello',
      type: 'warning',
    })
    expect(getToastPayload('hello')).toEqual({})
  })

  it('keeps only string verse ids from bridge payloads', () => {
    expect(getVerseIdsPayload({ verseIds: ['1-1-1', 2, null, '1-1-2'] })).toEqual([
      '1-1-1',
      '1-1-2',
    ])
    expect(getVerseIdsPayload({ verseIds: '1-1-1' })).toEqual([])
  })

  it('parses study relation modal targets from strings or verse payloads', () => {
    expect(getStudyRelationsModalTarget('1-1-1')).toBe('1-1-1')
    expect(
      getStudyRelationsModalTarget({
        verseKey: '1-1-1',
        relationId: 'relation-1',
        verseIds: ['1-1-1', '1-1-2'],
      })
    ).toEqual({
      verseKey: '1-1-1',
      relationId: 'relation-1',
      verseIds: ['1-1-1', '1-1-2'],
    })
    expect(getStudyRelationsModalTarget({ relationId: 'relation-1' })).toBeUndefined()
  })

  it('parses note navigation payloads from legacy and structured commands', () => {
    expect(getNoteNavigationPayload('note-1')).toEqual({ noteId: 'note-1', verseIds: [] })
    expect(
      getNoteNavigationPayload({
        noteId: 'note-1',
        verseIds: ['1-1-1', 4, '1-1-2'],
      })
    ).toEqual({
      noteId: 'note-1',
      verseIds: ['1-1-1', '1-1-2'],
    })
    expect(getNoteNavigationPayload(null)).toEqual({ verseIds: [] })
  })

  it('accepts only complete canonical Bible note payloads from the DOM bridge', () => {
    expect(
      getCanonicalBibleNotePayload({
        offset: 36,
        order: 17,
        kind: 'note',
        markup: '<note n="a">le vide</note>',
      })
    ).toEqual({
      offset: 36,
      order: 17,
      kind: 'note',
      markup: '<note n="a">le vide</note>',
    })
    expect(
      getCanonicalBibleNotePayload({ kind: 'note', markup: 'missing offsets' })
    ).toBeUndefined()
  })

  it('accepts only complete passage media items from the DOM bridge', () => {
    const media = {
      workId: 'genesis-overview',
      editionId: 'genesis-overview:fr',
      attributionLabel: 'BibleProject',
      provider: 'youtube',
      providerId: 'video-1',
      sourceUrl: 'https://www.youtube.com/watch?v=video-1',
      thumbnailUrl: 'https://img.test/video-1.jpg',
      title: 'Genèse - Panorama',
      durationSeconds: 428,
    }

    expect(getPassageMediaPayload([media, { ...media, title: null }])).toEqual([media])
    expect(getPassageMediaPayload({ media })).toEqual([])
  })
})
