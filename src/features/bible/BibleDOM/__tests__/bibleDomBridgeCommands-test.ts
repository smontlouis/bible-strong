import {
  getNoteNavigationPayload,
  getNumberPayload,
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
})
