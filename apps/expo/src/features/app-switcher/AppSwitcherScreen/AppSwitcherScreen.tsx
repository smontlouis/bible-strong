import { useFocusEffect, useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { activeTabIdAtom } from '~state/tabs'
import { useResponsiveWorkspace } from '../utils/useResponsiveWorkspace'
import CompactAppSwitcherScreen from './CompactAppSwitcherScreen'

export const TAB_PREVIEW_SCALE = 0.6

export default function AppSwitcherScreen() {
  const isWide = useResponsiveWorkspace()
  const activeTabId = useAtomValue(activeTabIdAtom)
  const router = useRouter()
  useFocusEffect(() => {
    if (isWide && !activeTabId) router.replace('/home')
  })
  return isWide ? null : <CompactAppSwitcherScreen />
}
