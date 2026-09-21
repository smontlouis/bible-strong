import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'

import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import generateUUID from '~helpers/generateUUID'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { DictionaryTab } from '~state/tabs'
import DictionaryDetailTabScreen from './DictionaryDetailTabScreen'
import { buildPublicDictionaryPath, parsePublicDictionaryRoute } from './publicDictionaryRoutes'
import PublicPage from '~features/app/PublicPage'

export const PublicDictionaryRouteScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{
    language?: string | string[]
    work?: string | string[]
    entryId?: string | string[]
    slug?: string | string[]
  }>()
  const route = parsePublicDictionaryRoute(params)
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const [dictionaryAtom] = useState(() =>
    atom<DictionaryTab>({
      id: `dictionary-${generateUUID()}`,
      title: 'Dictionary',
      isRemovable: true,
      hasBackButton: true,
      type: 'dictionary',
      data: route
        ? { language: route.language, work: route.work, entryId: route.entryId, word: route.slug }
        : {},
    })
  )
  return route ? (
    <PublicPage title={route.slug.replaceAll('-', ' ')}>
      <DictionaryDetailTabScreen
        dictionaryAtom={dictionaryAtom}
        isFormSheet={IS_FORM_SHEET}
        onEntryResolved={(entry, context) => {
          const entryId = entry.id ?? (context.work === route.work ? route.entryId : undefined)
          if (!entryId) return
          const canonicalPath = buildPublicDictionaryPath({
            language: context.language,
            work: context.work,
            entryId,
            word: entry.word,
          })
          const currentPath = `/dictionary/${first(params.language)}/${first(params.work)}/${first(
            params.entryId
          )}/${first(params.slug)}`
          if (canonicalPath === currentPath) return
          router.replace(canonicalPath)
        }}
      />
    </PublicPage>
  ) : (
    <ResourceUnavailableView
      title="Article de dictionnaire introuvable"
      failure={{ cause: 'not-found', recoveries: [] }}
    />
  )
}
