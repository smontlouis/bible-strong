import { useEffect, useEffectEvent } from 'react'
import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai'
import { assistantOpenRequestAtom } from './assistantSheetContext'

/** On native the assistant is a sheet: a link to this route opens it over the previous screen. */
export default function StudyAssistantScreen() {
  const router = useRouter()
  const requestOpen = useSetAtom(assistantOpenRequestAtom)
  const openOverPreviousScreen = useEffectEvent(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
    requestOpen(count => count + 1)
  })
  useEffect(() => {
    openOverPreviousScreen()
  }, [])
  return null
}
