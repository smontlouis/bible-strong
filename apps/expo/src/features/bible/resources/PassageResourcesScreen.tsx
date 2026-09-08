import { useImperativeHandle, useRef, useState } from 'react'
import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { SheetRef } from '~common/sheet'
import { versions } from '~helpers/bibleVersions'
import { getDefaultBibleTab, type VersionCode } from '~state/tabs'
import ResourcesContent from './ResourceModalContent'
import { resourceSidebarSources } from './resourceSidebarRegistry'
import { parseResourceSidebarParams } from './resourceSidebarParams'

export default function PassageResourcesScreen() {
  const params = useLocalSearchParams<{
    sourceId?: string
    resourceType?: string
    version?: string
    selectedVerses?: string
  }>()
  const router = useRouter()
  const { t } = useTranslation()
  const selection = parseResourceSidebarParams(params.resourceType, params.selectedVerses)
  const source = params.sourceId ? resourceSidebarSources.get(params.sourceId)?.current : undefined
  const version = (
    params.version && versions[params.version] ? params.version : 'LSG'
  ) as VersionCode
  const [fallbackAtom] = useState(() => {
    const bible = getDefaultBibleTab()
    return atom({
      ...bible,
      data: { ...bible.data, selectedVersion: version, selectedVerses: selection.selectedVerses },
    })
  })
  const ref = useRef<SheetRef>(null)
  useImperativeHandle(ref, () => {
    const close = () => router.back()
    return {
      present: () => {},
      presentAt: () => {},
      resizeTo: () => {},
      close,
      dismiss: close,
      forceClose: close,
    }
  })
  if (!Object.keys(selection.selectedVerses).length)
    return (
      <Box className="flex-1">
        <Header hasBackButton title={t('Ressources')} />
        <Text className="p-5">{t('Aucun verset sélectionné')}</Text>
      </Box>
    )
  return (
    <ResourcesContent
      inline
      resourceModalRef={ref}
      bibleAtom={source?.bibleAtom ?? fallbackAtom}
      resourceType={selection.resourceType}
      selectedVerses={selection.selectedVerses}
      selectedVersion={version}
      isSelectionMode={source?.isSelectionMode}
      onChangeResourceType={resourceType => {
        source?.onChangeResourceType(resourceType)
        router.setParams({ resourceType })
      }}
      onChangeVerse={verseKey => {
        source?.onChangeVerse?.(verseKey)
        router.setParams({ selectedVerses: JSON.stringify({ [verseKey]: true }) })
      }}
    />
  )
}
