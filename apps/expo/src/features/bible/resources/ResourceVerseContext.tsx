import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Animated, {
  LinearTransition,
  useReducedMotion,
  withTiming,
  type EntryAnimationsValues,
  type ExitAnimationsValues,
} from 'react-native-reanimated'

import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import type { Verse } from '~common/types'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import { createOfflineCopyDownloadItem } from '~helpers/downloadItemFactory'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import { localQueryOptions, staticResourceQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'

import BibleVerseDetailFooter from '../BibleVerseDetailFooter'
import ResourceUnavailableView from '../../resources/ResourceUnavailableView'
import { useResourceAccess } from '../../resources/resourceAccess'
import { useResolvedBibleVerses, verseStringToObject } from '../../resources/useBibleVerses'

const CONTENT_TRANSITION_DURATION = 180
const CONTENT_LAYOUT_TRANSITION = LinearTransition.duration(220)

const enterNextVerse = (_values: EntryAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 10 }] },
    animations: {
      opacity: withTiming(1, { duration: CONTENT_TRANSITION_DURATION }),
      transform: [{ translateX: withTiming(0, { duration: CONTENT_TRANSITION_DURATION }) }],
    },
  }
}

const exitNextVerse = (_values: ExitAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: CONTENT_TRANSITION_DURATION - 40 }),
      transform: [{ translateX: withTiming(-8, { duration: CONTENT_TRANSITION_DURATION - 40 }) }],
    },
  }
}

const enterPreviousVerse = (_values: EntryAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateX: -10 }] },
    animations: {
      opacity: withTiming(1, { duration: CONTENT_TRANSITION_DURATION }),
      transform: [{ translateX: withTiming(0, { duration: CONTENT_TRANSITION_DURATION }) }],
    },
  }
}

const exitPreviousVerse = (_values: ExitAnimationsValues) => {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: CONTENT_TRANSITION_DURATION - 40 }),
      transform: [{ translateX: withTiming(8, { duration: CONTENT_TRANSITION_DURATION - 40 }) }],
    },
  }
}

export type ResourceVerseContextData = {
  verseText?: Verse
  versesInCurrentChapter?: number | null
  requestedVersion: string
  unavailableBibleVersion: string | null
  bibleTemporarilyUnavailable?: boolean
  retryBible: () => void
}

export const useResourceVerseContext = (
  verse: string,
  preferredVersion?: string
): ResourceVerseContextData => {
  const defaultVersion = useDefaultBibleVersion()
  const requestedVersion = preferredVersion || defaultVersion
  const resources = useResourceAccess()
  const verseFormatted = verseStringToObject([verse])
  const resolution = useResolvedBibleVerses(verseFormatted, preferredVersion)
  const [verseText] = resolution.verses
  const [book, chapter] = verse.split('-').map(Number)
  const { data: coverage } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(requestedVersion),
    queryFn: () => resources.bibleContent.loadCoverage(requestedVersion),
    enabled: Number.isSafeInteger(book) && Number.isSafeInteger(chapter),
    ...staticResourceQueryOptions,
    ...localQueryOptions,
  })
  const versesInCurrentChapter =
    getChapterVerseCountFromCoverage(coverage, book, chapter) ||
    countLsgChapters[`${book}-${chapter}`]

  return {
    verseText,
    versesInCurrentChapter,
    requestedVersion,
    unavailableBibleVersion:
      verse && !resolution.isLoading && resolution.recoveries?.includes('acquire-offline-copy')
        ? requestedVersion
        : null,
    bibleTemporarilyUnavailable: resolution.recoveries?.includes('retry'),
    retryBible: resolution.retry,
  }
}

const VerseTextSkeleton = ({ accessibilityLabel }: { accessibilityLabel: string }) => (
  <Box
    minHeight={72}
    pt={3}
    gap={10}
    accessibilityRole="progressbar"
    accessibilityLabel={accessibilityLabel}
  >
    <Box height={13} width="92%" borderRadius={5} bg="lightGrey" />
    <Box height={13} width="78%" borderRadius={5} bg="lightGrey" />
    <Box height={13} width="56%" borderRadius={5} bg="lightGrey" />
  </Box>
)

type Props = ResourceVerseContextData & {
  verse: string
  navigationDirection?: -1 | 1
  updateVerse: (direction: -1 | 1) => void
}

const ResourceVerseContext = ({
  verse,
  verseText,
  versesInCurrentChapter,
  requestedVersion,
  unavailableBibleVersion,
  bibleTemporarilyUnavailable,
  retryBible,
  navigationDirection = 1,
  updateVerse,
}: Props) => {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const verseNumber = verseText?.Verset ?? verse.split('-')[2]

  return (
    <Box background paddingTop={10} borderBottomLeftRadius={30} borderBottomRightRadius={30}>
      <Animated.View layout={reduceMotion ? undefined : CONTENT_LAYOUT_TRANSITION}>
        <Animated.View
          key={verse}
          entering={
            reduceMotion
              ? undefined
              : navigationDirection === 1
                ? enterNextVerse
                : enterPreviousVerse
          }
          exiting={
            reduceMotion ? undefined : navigationDirection === 1 ? exitNextVerse : exitPreviousVerse
          }
        >
          <Box row pr={10} pb={10}>
            <Box width={25} mr={5} mt={10} alignItems="flex-end">
              <Text mt={0} fontSize={9} mr={3}>
                {verseNumber}
              </Text>
            </Box>
            <Box flex>
              {unavailableBibleVersion ? (
                <ResourceUnavailableView
                  identity={{ kind: 'bible', versionId: unavailableBibleVersion }}
                  title={t('resource.bible.referenceUnavailable', {
                    version: unavailableBibleVersion,
                  })}
                  fileSize={Math.max(
                    1,
                    Math.round(
                      createOfflineCopyDownloadItem({
                        kind: 'bible',
                        versionId: unavailableBibleVersion,
                      }).estimatedSize / 1_000_000
                    )
                  )}
                  failure={{
                    cause: 'offline-copy-required',
                    recoveries: ['acquire-offline-copy'],
                  }}
                  size="small"
                />
              ) : bibleTemporarilyUnavailable ? (
                <ResourceUnavailableView
                  title={t('resource.bible.referenceUnavailable', { version: requestedVersion })}
                  failure={{ cause: 'temporary-unavailable', recoveries: ['retry'] }}
                  size="small"
                  onRetry={retryBible}
                />
              ) : !verseText ? (
                <VerseTextSkeleton accessibilityLabel={t('Chargement...')} />
              ) : (
                <Paragraph>{verseText.Texte.replace(/\n/gi, '')}</Paragraph>
              )}
            </Box>
          </Box>
        </Animated.View>
      </Animated.View>
      <BibleVerseDetailFooter
        verseNumber={verseNumber}
        goToNextVerse={() => updateVerse(1)}
        goToPrevVerse={() => updateVerse(-1)}
        versesInCurrentChapter={versesInCurrentChapter}
      />
    </Box>
  )
}

export default ResourceVerseContext
