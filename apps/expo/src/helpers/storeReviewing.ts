import { useAtomValue } from 'jotai/react'
import { atom, getDefaultStore } from 'jotai/vanilla'

/**
 * While the App Store or Google Play reviews a build, the stores' apps show no way to pay outside
 * them, such as donations to the site. The key kept its first name; it covers both stores.
 */
export const STORE_REVIEWING_KEY = 'apple_reviewing'

/** A fresh install hides them until Remote Config answers. */
export const STORE_REVIEWING_DEFAULT = true

const storeReviewingAtom = atom(STORE_REVIEWING_DEFAULT)

export const publishStoreReviewing = (reviewing: boolean) =>
  getDefaultStore().set(storeReviewingAtom, reviewing)

export const useStoreReviewing = () => useAtomValue(storeReviewingAtom)
