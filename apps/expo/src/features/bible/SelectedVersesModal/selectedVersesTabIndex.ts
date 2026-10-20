import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

/** The tab of the selected verses' actions the reader left open, kept across launches. */
export const selectedVersesTabIndexAtom = atomWithAsyncStorage('selectedVersesTabIndex', 0)
