import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import React, { useRef, useState } from 'react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import type { DictionaryPassageDiscoveryEntry } from '~features/resources/dictionaryAccess'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { bibleChapterQueryOptions } from '~features/resources/resourceQueries'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { localQueryOptions } from '~helpers/queryOptions'
import { useLayoutSize } from '~helpers/useLayoutSize'
import { wp } from '~helpers/utils'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { Verse } from '~common/types'

import DictionnaireCard from './DictionnaireCard'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2

type LoadedPassageEntry = {
  anchor: DictionaryPassageDiscoveryEntry
  definition: string
}

const DictionnaireVerseDetailScreen = ({
  verse,
  updateVerse,
}: {
  verse: Verse
  updateVerse: (value: number) => void
}) => {
  const resources = useResourceAccess()
  const carousel = useRef<ICarouselInstance>(null)
  const [boxHeight, setBoxHeight] = useState(0)
  const {
    ref: carouselContainerRef,
    size: carouselContainerSize,
    onLayout: onCarouselContainerLayout,
  } = useLayoutSize()
  const { Livre, Chapitre, Verset } = verse
  const verseKey = `${Livre}-${Chapitre}-${Verset}`
  const resourceLang = useAtomValue(resourcesLanguageAtom).DICTIONNAIRE

  const anchorsQuery = useQuery({
    queryKey: ['dictionary-passage-entries', verseKey, resourceLang],
    queryFn: () => resources.dictionary.discoverPassageEntries(verseKey, resourceLang),
    ...localQueryOptions,
  })
  const definitionsQuery = useQuery({
    queryKey: [
      'dictionary-passage-definitions',
      verseKey,
      anchorsQuery.data?.map(anchor => `${anchor.resource.work}:${anchor.id}`).join(','),
    ],
    queryFn: async () => {
      const loaded = await Promise.all(
        (anchorsQuery.data ?? []).map(async anchor => {
          const entry = await resources.dictionary.loadEntryById(
            anchor.id,
            anchor.resource.language,
            anchor.resource.work
          )
          return entry ? { anchor, definition: entry.definition } : null
        })
      )
      return loaded.filter((entry): entry is LoadedPassageEntry => entry !== null)
    },
    enabled: anchorsQuery.isSuccess,
    ...localQueryOptions,
  })

  const chapterQuery = useQuery({
    ...bibleChapterQueryOptions(
      {
        version: getDefaultBibleVersion(resourceLang),
        book: Number(Livre),
        chapter: Number(Chapitre),
      },
      resources
    ),
  })
  const chapterResult = chapterQuery.data
  const versesInCurrentChapter = chapterResult?.success ? chapterResult.data.verses.length : null

  if (anchorsQuery.isPending || definitionsQuery.isPending) return <Loading />

  if (anchorsQuery.isError || definitionsQuery.isError) {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'DICTIONNAIRE', language: resourceLang }}
        title="Les dictionnaires sont temporairement indisponibles."
        fileSize={22}
        failure={resourceFailureFromAccessError(anchorsQuery.error ?? definitionsQuery.error)}
        size="small"
        mt={100}
        onRetry={() => {
          void anchorsQuery.refetch()
          void definitionsQuery.refetch()
        }}
      />
    )
  }

  const entries = definitionsQuery.data ?? []

  return (
    <Box flex={1} onLayout={event => setBoxHeight(event.nativeEvent.layout.height)}>
      <Box px={20} pt={16} pb={10} maxHeight={boxHeight / 3}>
        <Text title fontSize={18}>
          Entrées citées par ce verset
        </Text>
        <Text fontSize={12} color="tertiary" mt={4}>
          Les résultats viennent des références présentes dans les articles, indépendamment de la
          traduction biblique affichée.
        </Text>
        <BibleVerseDetailFooter
          verseNumber={Verset}
          versesInCurrentChapter={versesInCurrentChapter}
          goToNextVerse={() => updateVerse(+1)}
          goToPrevVerse={() => updateVerse(-1)}
        />
      </Box>
      <Box ref={carouselContainerRef} flex bg="lightGrey" onLayout={onCarouselContainerLayout}>
        {entries.length > 0 ? (
          <Carousel
            ref={carousel}
            mode="horizontal-stack"
            scrollAnimationDuration={300}
            itemWidth={itemWidth}
            itemHeight={carouselContainerSize.height}
            onConfigurePanGesture={gestureChain => gestureChain.activeOffsetX([-10, 10])}
            modeConfig={{
              opacityInterval: 0.8,
              scaleInterval: 0,
              stackInterval: itemWidth,
              rotateZDeg: 0,
            }}
            style={{ paddingLeft: 20, overflow: 'visible', flex: 1, width: '100%' }}
            data={entries}
            renderItem={({ item }) => (
              <DictionnaireCard
                dictionnaireRef={{ word: item.anchor.word, definition: item.definition }}
                sourceLabel={item.anchor.abbreviation}
                routeParams={{
                  entryId: item.anchor.id,
                  work: item.anchor.resource.work,
                  resourceId: item.anchor.resourceId,
                  dictionaryTitle: item.anchor.title,
                  language: item.anchor.resource.language,
                  correspondenceId: item.anchor.correspondenceId,
                }}
              />
            )}
          />
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Aucune entrée ne cite précisément ce verset."
          />
        )}
      </Box>
    </Box>
  )
}

export default DictionnaireVerseDetailScreen
