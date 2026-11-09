import { usePathname, useRouter } from 'expo-router'
import { useSetAtom, useStore } from 'jotai/react'
import { useEffect, useLayoutEffect } from 'react'

import useLogin from '~helpers/useLogin'
import { activeGroupAtom, tabGroupsAtom } from '~state/tabs'
import { markTabGroupChangedBeforeSync } from '~state/tabGroupsChangedBeforeSync'
import { addTabToGroupAtom, useSwitchGroup } from '~state/tabGroups'
import { getIncomingLinkAtLoad, incomingLinkPendingAtom } from './IncomingLinkGate'
import { createIncomingLinkTab, findTabWithSameContent } from './incomingLinks'
import { useSlideNewTab } from './utils/useSlideNewTab'

// If the address did not empty in this time, the route shows after all.
const PENDING_FALLBACK_MS = 2000

// One page load has one Incoming link, even if the runtime mounts again.
let incomingLinkOpened = false

/**
 * Opens the Incoming link in a Tab and empties the address, as a browser opens a link in a
 * tab of its own (ADR-0108). A Tab that already shows the same thing is selected instead.
 */
const IncomingLinkTab = () => {
  const router = useRouter()
  const pathname = usePathname()
  const store = useStore()
  const addTab = useSetAtom(addTabToGroupAtom)
  const settle = useSetAtom(incomingLinkPendingAtom)
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()
  const { isLogged, user } = useLogin()

  useLayoutEffect(() => {
    const incomingLink = getIncomingLinkAtLoad()
    if (!incomingLink || incomingLinkOpened) return
    incomingLinkOpened = true
    const tab = createIncomingLinkTab(incomingLink)
    const activeGroupId = store.get(activeGroupAtom).id
    const existing = findTabWithSameContent(store.get(tabGroupsAtom), activeGroupId, tab)
    const groupId = existing?.groupId ?? activeGroupId
    if (!existing) {
      addTab({ groupId, tab })
      // The tab sync of the account starts after this: it must send the group, not replace it.
      if (isLogged && user.id) markTabGroupChangedBeforeSync(user.id, groupId)
    }
    switchGroup(groupId)
    router.replace('/')
    triggerSlideNewTab(existing?.tabId ?? tab.id)
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
