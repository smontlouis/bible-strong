import { useAtomValue } from 'jotai/react'
import { atom, getDefaultStore } from 'jotai/vanilla'

/**
 * Who sees the study assistant and Premium, which open together. Two Firebase Remote Config keys
 * decide it, so that opening, closing or adding a tester needs no build:
 * - `assistant_open`: every signed-in account sees them;
 * - `beta_uids`: comma-separated Firebase uids that see them while it is closed.
 * It only shows or hides them; the services authorize on their own.
 */
export const ASSISTANT_OPEN_KEY = 'assistant_open'
export const BETA_UIDS_KEY = 'beta_uids'

export type AssistantOpening = { open: boolean; betaUids: ReadonlySet<string> }

/** What holds until Remote Config answers, and on a device it never reaches. */
export const closedOpening: AssistantOpening = { open: false, betaUids: new Set() }

export const remoteConfigDefaults = { [ASSISTANT_OPEN_KEY]: false, [BETA_UIDS_KEY]: '' }

/** A change in the console reaches a running app at once; a start asks again after an hour. */
export const REMOTE_CONFIG_FETCH_INTERVAL_MS = 60 * 60 * 1000

export const parseBetaUids = (value?: string) =>
  new Set(
    String(value || '')
      .split(',')
      .map(uid => uid.trim())
      .filter(uid => /^[A-Za-z0-9]{20,128}$/.test(uid))
  )

export const hasOpeningAccess = (opening: AssistantOpening, uid?: string | null) =>
  Boolean(uid && (opening.open || opening.betaUids.has(uid)))

export const assistantOpeningAtom = atom<AssistantOpening>(closedOpening)

export const publishAssistantOpening = (values: { open: boolean; betaUids?: string }) =>
  getDefaultStore().set(assistantOpeningAtom, {
    open: values.open,
    betaUids: parseBetaUids(values.betaUids),
  })

export const useAssistantOpening = () => useAtomValue(assistantOpeningAtom)
