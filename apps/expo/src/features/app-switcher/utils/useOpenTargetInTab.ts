import { useRouter } from 'expo-router'
import { useSetAtom, useStore } from 'jotai/react'
import { useCallback } from 'react'

import useLogin from '~helpers/useLogin'
import { activeGroupAtom, tabGroupsAtom } from '~state/tabs'
import { markTabGroupChangedBeforeSync } from '~state/tabGroupsChangedBeforeSync'
import { addTabToGroupAtom, useSwitchGroup } from '~state/tabGroups'
import {
  createIncomingLinkTab,
  findTabWithSameContent,
  type IncomingLinkTarget,
} from '../incomingLinks'
import { useSlideNewTab } from './useSlideNewTab'

/**
 * Opens a resource in a Tab, as a browser opens a link in a tab of its own (ADR-0108): a Tab
 * that already shows the same thing is selected instead, else a new Tab joins the active group.
 * `replace` empties the address the page opened on; `dismiss` closes the screens above the tabs.
 */
export const useOpenTargetInTab = () => {
  const router = useRouter()
  const store = useStore()
  const addTab = useSetAtom(addTabToGroupAtom)
  const switchGroup = useSwitchGroup()
  const { triggerSlideNewTab } = useSlideNewTab()
  const { isLogged, user } = useLogin()

  return useCallback(
    (target: IncomingLinkTarget, navigation: 'replace' | 'dismiss' = 'dismiss') => {
      const tab = createIncomingLinkTab(target)
      const activeGroupId = store.get(activeGroupAtom).id
      const existing = findTabWithSameContent(store.get(tabGroupsAtom), activeGroupId, tab)
      const groupId = existing?.groupId ?? activeGroupId
      if (!existing) {
        addTab({ groupId, tab })
        // Before the tab sync of the account starts, it must send the group, not replace it.
        if (isLogged && user.id) markTabGroupChangedBeforeSync(user.id, groupId)
      }
      switchGroup(groupId)
      if (navigation === 'replace') router.replace('/')
      else router.dismissTo('/')
      triggerSlideNewTab(existing?.tabId ?? tab.id)
    },
    [addTab, isLogged, router, store, switchGroup, triggerSlideNewTab, user.id]
  )
}
