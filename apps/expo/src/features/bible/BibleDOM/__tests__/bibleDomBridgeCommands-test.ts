import { NAVIGATE_TO_BIBLE_NOTE, NAVIGATE_TO_PERICOPE, TOGGLE_SELECTED_VERSE } from '../dispatch'
import {
  decodeBibleDOMBridgeAction,
  getCanonicalBibleNotePayload,
  getNoteNavigationPayload,
  getNumberPayload,
  getStrongRelationSelectionPayload,
  getStringPayload,
  getStudyRelationsModalTarget,
  getToastPayload,
  getPayloadVersion,
  getVerseIdsPayload,
  getVerseSelectionPayload,
  routeBibleDOMBridgeAction,
} from '../bibleDomBridgeCommands'

describe('Bible DOM bridge', () => {
  it('reads the verse a reader tapped, with its version in parallel reading', () => {
    expect(getVerseSelectionPayload('1-1-1')).toEqual({ verseKey: '1-1-1' })
    expect(getVerseSelectionPayload({ verseKey: '1-1-1', version: 'KJV' })).toEqual({
      verseKey: '1-1-1',
      version: 'KJV',
    })
    expect(getVerseSelectionPayload({ version: 'KJV' })).toBeUndefined()
    expect(getPayloadVersion({ version: 'KJV' })).toBe('KJV')
    expect(getPayloadVersion({})).toBeUndefined()
  })

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
    expect(
      getStudyRelationsModalTarget({
        endpoint: { type: 'annotation', annotationId: 'annotation-1' },
      })
    ).toMatchObject({
      endpoint: { type: 'annotation', annotationId: 'annotation-1' },
    })
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

  it('rejects unknown commands and malformed coordinates at the boundary', () => {
    expect(decodeBibleDOMBridgeAction({ type: 'EXECUTE_ARBITRARY_CODE' })).toBeUndefined()
    expect(
      decodeBibleDOMBridgeAction({ type: NAVIGATE_TO_PERICOPE, chapter: { unsafe: true } })
    ).toBeUndefined()
  })

  it('blocks personal data commands before invoking native handlers', async () => {
    const handle = jest.fn(async () => undefined)

    await expect(
      routeBibleDOMBridgeAction(
        { type: NAVIGATE_TO_BIBLE_NOTE, payload: 'note-1' },
        { personalBibleDataEnabled: false, handle }
      )
    ).resolves.toBe('blocked')
    expect(handle).not.toHaveBeenCalled()
  })

  it('blocks personal data commands aimed at a version shown only in an interlinear presentation', async () => {
    const handle = jest.fn(async () => undefined)
    const options = { personalBibleDataEnabled: true, interlinearReadingVersions: ['DBY'], handle }

    await expect(
      routeBibleDOMBridgeAction(
        { type: TOGGLE_SELECTED_VERSE, payload: { verseKey: '1-2-2', version: 'DBY' } },
        options
      )
    ).resolves.toBe('blocked')
    expect(handle).not.toHaveBeenCalled()

    const textColumnAction = {
      type: TOGGLE_SELECTED_VERSE,
      payload: { verseKey: '1-2-2', version: 'LSG' },
    }
    await expect(routeBibleDOMBridgeAction(textColumnAction, options)).resolves.toBe('handled')
    expect(handle).toHaveBeenCalledWith(textColumnAction)
  })

  it('routes a recognized reading command through the injected native handler', async () => {
    const handle = jest.fn(async () => undefined)
    const action = { type: NAVIGATE_TO_PERICOPE }

    await expect(
      routeBibleDOMBridgeAction(action, { personalBibleDataEnabled: false, handle })
    ).resolves.toBe('handled')
    expect(handle).toHaveBeenCalledWith(action)
  })
})
