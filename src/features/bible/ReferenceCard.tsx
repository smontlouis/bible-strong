// TODO - SPLIT THIS :(

import React from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'

import { useTheme } from '@emotion/react'
import { useQuery } from '@tanstack/react-query'
import Empty from '~common/Empty'
import Link from '~common/Link'
import { VerseRefContent } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import getVersesContent from '~helpers/getVersesContent'
import type { TresorReferences } from '~features/resources/bibleReadingResourceAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { VersionCode } from '../../state/tabs'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'
import useLanguage from '~helpers/useLanguage'
import { ResourceAccessError } from '~features/resources/resourceAccessError'
import { useTranslation } from 'react-i18next'

const ReferenceItem = ({ reference, version }: { reference: string; version: VersionCode }) => {
  const resources = useResourceAccess()
  const { data: Verse } = useQuery<VerseRefContent>({
    queryKey: resourceQueryKeys.bibleVerseSelection(version, [reference]),
    queryFn: () =>
      getVersesContent({
        verses: reference,
        version,
        loadVerseTexts: (versionId, verseKeys) =>
          loadBibleVerseTexts(resources, versionId, verseKeys),
      }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  if (!Verse) {
    return null
  }

  const [book, chapter, verse] = reference.split('-').map(Number)

  return (
    <Link
      route="BibleView"
      params={{
        contextDisplayMode: 'focused',
        book,
        chapter,
        verse,
        focusVerses: [verse],
      }}
    >
      <Box marginBottom={30}>
        <Text title fontSize={14}>
          {Verse.title}
        </Text>
        <Paragraph scale={-2} scaleLineHeight={-1}>
          {Verse.content}
        </Paragraph>
      </Box>
    </Link>
  )
}

export const ReferenceCard = ({
  selectedVerse,
  version,
}: {
  selectedVerse: string
  version: VersionCode
}) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const resourceLanguage = useLanguage()
  const availabilityQuery = useQuery({
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('TRESOR', resourceLanguage),
    queryFn: () =>
      resources.bibleReading.getTresorAvailability?.(resourceLanguage) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { isLoading, error, data } = useQuery({
    queryKey: resourceQueryKeys.bibleReferences(selectedVerse),
    queryFn: async () => (await resources.bibleReading.loadTresorReferences(selectedVerse)) ?? null,
  })

  if (
    availabilityQuery.data?.status === 'unavailable' &&
    availabilityQuery.data.recoveries.includes('acquire-offline-copy')
  ) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'TRESOR', language: resourceLanguage }}
        title={t('resource.crossReferences.offlineCopyNeeded')}
        fileSize={10}
        size="small"
      />
    )
  }

  if (error instanceof ResourceAccessError && error.recoveries.includes('acquire-offline-copy')) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'TRESOR', language: resourceLanguage }}
        title={t('resource.crossReferences.offlineCopyInvalid')}
        fileSize={10}
        size="small"
      />
    )
  }

  if (error) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('Une erreur est survenue.')}
      />
    )
  }

  if (isLoading) {
    return (
      <Box flex center minH={200}>
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    )
  }

  if (!selectedVerse || !data) {
    return null
  }

  return (
    <Box flex padding={20}>
      <References references={data} version={version} />
    </Box>
  )
}

const References = ({
  references,
  version,
}: {
  references: TresorReferences
  version: VersionCode
}) => {
  if (!references.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message="Aucune référence pour ce verset..."
      />
    )
  }

  return (
    <ScrollView>
      {references.map((ref, i) => {
        const splittedRef = ref.split('-')
        if (splittedRef.length === 3 && Number(splittedRef[0]) > 0) {
          return <ReferenceItem key={ref + i} reference={ref} version={version} />
        }

        return (
          <Text title key={ref} fontSize={20} marginBottom={5} color="lightPrimary">
            {splittedRef}
          </Text>
        )
      })}
    </ScrollView>
  )
}
