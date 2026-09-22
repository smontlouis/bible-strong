import { expect, it } from 'vitest'
import { currentActivity } from './avatar-activity'
import { parseClientMessage } from './multiplayer-protocol'

it('maps visible content to one activity and clears it on close', () => {
  const state = { ready: true, menuOpen: false, profileOpen: false, opened: null, storyOpen: false, guestbookOpen: false, gamesOpen: false }
  expect(currentActivity(state)).toBeNull()
  expect(currentActivity({ ...state, menuOpen: true })).toBe('menu')
  expect(currentActivity({ ...state, opened: { id: 'themes' } })).toBe('exploration')
  expect(currentActivity({ ...state, storyOpen: true })).toBe('book')
  expect(currentActivity({ ...state, guestbookOpen: true })).toBe('board')
  expect(currentActivity({ ...state, gamesOpen: true })).toBe('game')
  expect(currentActivity({ ...state, ready: false, profileOpen: true })).toBeNull()
})
it('rejects arbitrary activity payloads', () => {
  expect(parseClientMessage(JSON.stringify({ type: 'activity', activity: 'game' }))).toEqual({ type: 'activity', activity: 'game' })
  expect(parseClientMessage(JSON.stringify({ type: 'activity', activity: null }))).toEqual({ type: 'activity', activity: null })
  expect(parseClientMessage(JSON.stringify({ type: 'activity', activity: 'private-content' }))).toBeNull()
})
