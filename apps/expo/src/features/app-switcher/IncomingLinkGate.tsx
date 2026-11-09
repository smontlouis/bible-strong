import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import type { ReactNode } from 'react'

import { IS_BROWSER } from '~desktop/isDesktop'
import { parseIncomingLink, type IncomingLinkTarget } from './incomingLinks'

/**
 * The resource the browser opened the page on, when the page came from elsewhere: a link
 * followed from another site or a message, an address typed, a new browser tab. A reload or
 * a step through the history keeps its route, panel included (ADR-0108).
 */
const readIncomingLink = (): IncomingLinkTarget | undefined => {
  if (!IS_BROWSER || typeof performance === 'undefined') return undefined
  const [entry] = (performance.getEntriesByType?.('navigation') ??
    []) as PerformanceNavigationTiming[]
  return entry?.type === 'navigate' ? parseIncomingLink(entry.name) : undefined
}

let incomingLink: { target?: IncomingLinkTarget } | undefined

/** The Incoming link of this page load, read on first use: a page load has one at most. */
export const getIncomingLinkAtLoad = () => {
  incomingLink ??= { target: readIncomingLink() }
  return incomingLink.target
}

const incomingLinkSettledAtom = atom(false)

/**
 * From the page load until the Incoming link has left the address. Writing it, with no value,
 * says the address has moved on.
 */
export const incomingLinkPendingAtom = atom(
  get => !get(incomingLinkSettledAtom) && getIncomingLinkAtLoad() !== undefined,
  (_get, set) => set(incomingLinkSettledAtom, true)
)

/**
 * Keeps the screen of the Incoming link's route unmounted while it becomes a Tab: drawn, it
 * would show for an instant, and a route that corrects its own address (a Strong code without
 * its zeros, a book alias) would put itself back after the address was emptied.
 */
export const IncomingLinkGate = ({ children }: { children: ReactNode }) =>
  useAtomValue(incomingLinkPendingAtom) ? null : children
