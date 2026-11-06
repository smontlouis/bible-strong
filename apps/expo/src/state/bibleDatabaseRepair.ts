import { atom } from 'jotai/vanilla'

/**
 * The Bible database of the device is being rebuilt. There is one database for every Tab, so
 * every reader showing its error waits for the same repair.
 */
export const isRepairingBibleDatabaseAtom = atom(false)
