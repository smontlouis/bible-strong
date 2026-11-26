import { usePathname } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useEffect, useLayoutEffect } from 'react'

import { getIncomingLinkAtLoad, incomingLinkPendingAtom } from './IncomingLinkGate'
import { useOpenTargetInTab } from './utils/useOpenTargetInTab'

// If the address did not empty in this time, the route shows after all.
const PENDING_FALLBACK_MS = 2000

// One page load has one Incoming link, even if the runtime mounts again.
let incomingLinkOpened = false

/**
 * Opens the Incoming link in a Tab and empties the address, as a browser opens a link in a
 * tab of its own (ADR-0108). A Tab that already shows the same thing is selected instead.
 */
const IncomingLinkTab = () => {
  const pathname = usePathname()
  const settle = useSetAtom(incomingLinkPendingAtom)
  const openInTab = useOpenTargetInTab()

  useLayoutEffect(() => {
    const incomingLink = getIncomingLinkAtLoad()
    if (!incomingLink || incomingLinkOpened) return
    incomingLinkOpened = true
    openInTab(incomingLink, 'replace')
    // Once per page load: the route this effect replaces is the one the page opened on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!getIncomingLinkAtLoad()) return
    if (pathname === '/') {
      settle()
      return
    }
    const timer = setTimeout(settle, PENDING_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [pathname, settle])

  return null
}

export default IncomingLinkTab
