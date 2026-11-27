import { useAtomValue } from 'jotai/react'
import { useEffect, useRef } from 'react'
import { tabGroupsAtom } from '~state/tabs'
import { requestFeatureOnboarding } from '../featureOnboardingRequests'
import { ONBOARDING_IDS } from '../onboardingConfig'

/**
 * The tabs are explained when the reader opens a second one, however it came: a long press in the
 * book selector, a link, the + of the tab view. Counted across the groups, so that moving from one
 * group to another changes nothing.
 */
export function useTabsOnboardingTrigger() {
  const groups = useAtomValue(tabGroupsAtom)
  const count = groups.reduce((total, group) => total + group.tabs.length, 0)
  const previous = useRef(count)

  useEffect(() => {
    const before = previous.current
    previous.current = count
    if (count > before && count >= 2) {
      requestFeatureOnboarding(ONBOARDING_IDS.TABS, { delayMs: 900 })
    }
  }, [count])
}
