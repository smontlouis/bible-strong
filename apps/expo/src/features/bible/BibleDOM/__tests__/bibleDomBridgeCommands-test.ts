import { OPEN_BOOKMARK_MODAL, RETRY_BIBLE_RESOURCE } from '../dispatch'
import {
  decodeBibleDOMBridgeAction,
  getStringPayload,
  getStudyRelationsModalTarget,
  getToastPayload,
  getPayloadVersion,
  getVerseIdsPayload,
  routeBibleDOMBridgeAction,
} from '../bibleDomBridgeCommands'

describe('Bible DOM bridge', () => {
  it('reads the version a payload names in parallel reading', () => {
    expect(getPayloadVersion({ version: 'KJV' })).toBe('KJV')
    expect(getPayloadVersion({})).toBeUndefined()
  })

  it('parses primitive string payloads conservatively', () => {
    expect(getStringPayload('note-1')).toBe('note-1')
    expect(getStringPayload({ value: 'note-1' })).toBeUndefined()
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

  it('rejects unknown commands at the boundary', () => {
    expect(decodeBibleDOMBridgeAction({ type: 'EXECUTE_ARBITRARY_CODE' })).toBeUndefined()
  })

  it('blocks personal data commands before invoking native handlers', async () => {
    const handle = jest.fn(async () => undefined)

    await expect(
      routeBibleDOMBridgeAction(
        { type: OPEN_BOOKMARK_MODAL, payload: { id: 'bookmark-1' } },
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
        { type: OPEN_BOOKMARK_MODAL, payload: { id: 'bookmark-1', version: 'DBY' } },
        options
      )
    ).resolves.toBe('blocked')
    expect(handle).not.toHaveBeenCalled()

    const textColumnAction = {
      type: OPEN_BOOKMARK_MODAL,
      payload: { id: 'bookmark-1', version: 'LSG' },
    }
    await expect(routeBibleDOMBridgeAction(textColumnAction, options)).resolves.toBe('handled')
    expect(handle).toHaveBeenCalledWith(textColumnAction)
  })

  it('routes a recognized command through the injected native handler', async () => {
    const handle = jest.fn(async () => undefined)
    const action = { type: RETRY_BIBLE_RESOURCE }

    await expect(
      routeBibleDOMBridgeAction(action, { personalBibleDataEnabled: false, handle })
    ).resolves.toBe('handled')
    expect(handle).toHaveBeenCalledWith(action)
  })
})
