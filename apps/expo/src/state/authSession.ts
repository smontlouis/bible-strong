import { atom, getDefaultStore } from 'jotai/vanilla'

/**
 * The account whose Firebase session was lost while the store still shows it: Firebase signed out
 * on its own (refresh token refused, account disabled). Not persisted: each launch finds it again.
 */
export const lostSessionUserIdAtom = atom<string | undefined>(undefined)

export const getLostSessionUserId = (): string | undefined =>
  getDefaultStore().get(lostSessionUserIdAtom)

export const setLostSessionUserId = (userId?: string): void => {
  getDefaultStore().set(lostSessionUserIdAtom, userId)
}
