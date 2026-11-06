import { RETRY_BIBLE_RESOURCE } from '../dispatch'
import {
  decodeBibleDOMBridgeAction,
  getStringPayload,
  getToastPayload,
  routeBibleDOMBridgeAction,
} from '../bibleDomBridgeCommands'

describe('Bible DOM bridge', () => {
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

  it('rejects unknown commands at the boundary', () => {
    expect(decodeBibleDOMBridgeAction({ type: 'EXECUTE_ARBITRARY_CODE' })).toBeUndefined()
  })

  it('routes a recognized command through the injected native handler', async () => {
    const handle = jest.fn(async () => undefined)
    const action = { type: RETRY_BIBLE_RESOURCE }

    await expect(routeBibleDOMBridgeAction(action, { handle })).resolves.toBe('handled')
    expect(handle).toHaveBeenCalledWith(action)
  })
})
