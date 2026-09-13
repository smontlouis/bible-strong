import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import React from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
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
import useLanguage from '~helpers/useLanguage'
import { useTranslation } from 'react-i18next'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
// TODO - SPLIT THIS :(

const ReferenceItem = ({ reference, version }: { reference: string; version: VersionCode }) => {
  const stylingTheme = useStylingTheme()

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
      <Box className="overflow-hidden border-continuous mb-[30px]">
        <Text
          className="text-[14px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
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

  const referencesQuery = useQuery({
    queryKey: resourceQueryKeys.bibleReferences(selectedVerse),
    queryFn: async () => (await resources.bibleReading.loadTresorReferences(selectedVerse)) ?? null,
  })
  const { isLoading, error, data } = referencesQuery

  if (availabilityQuery.data?.status === 'unavailable') {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'TRESOR', language: resourceLanguage }}
        title={t('resource.crossReferences.offlineCopyNeeded')}
        offlineTitle={t('resource.crossReferences.temporarilyUnavailable')}
        fileSize={10}
        size="small"
        mt={100}
        failure={resourceFailureFromAvailability(availabilityQuery.data)}
        onRetry={() => {
          void availabilityQuery.refetch()
          void referencesQuery.refetch()
        }}
      />
    )
  }

  if (availabilityQuery.isError || error) {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'TRESOR', language: resourceLanguage }}
        title={t('resource.crossReferences.temporarilyUnavailable')}
        fileSize={10}
        failure={resourceFailureFromAccessError(error ?? availabilityQuery.error)}
        size="small"
        mt={100}
        onRetry={() => {
          void availabilityQuery.refetch()
          void referencesQuery.refetch()
        }}
      />
    )
  }

  if (isLoading) {
    return (
      <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center min-h-[200px]">
        <ActivityIndicator color={theme.colors.grey} />
      </Box>
    )
  }

  if (!selectedVerse) {
    return null
  }

  if (!data) {
    return <Empty message={t('resource.crossReferences.noneForVerse')} />
  }

  return (
    <Box className="overflow-hidden border-continuous flex-[1] p-[20px]">
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
  const stylingTheme = useStylingTheme()

  if (!references.length) {
    return <Empty message="Aucune référence pour ce verset..." />
  }

  return (
    <ScrollView>
      {references.map((ref, i) => {
        const splittedRef = ref.split('-')
        if (splittedRef.length === 3 && Number(splittedRef[0]) > 0) {
          return <ReferenceItem key={ref + i} reference={ref} version={version} />
        }

        return (
          <Text
            className="text-[20px] mb-[5px] text-light-primary"
            key={ref}
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {splittedRef}
          </Text>
        )
      })}
    </ScrollView>
  )
}
