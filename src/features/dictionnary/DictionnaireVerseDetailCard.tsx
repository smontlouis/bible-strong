import styled from '@emotion/native'
import { useAtomValue } from 'jotai'
import React, { useRef, useState } from 'react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import { CarouselProvider } from '~helpers/CarouselContext'

import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import { Verse } from '~common/types'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { useResourceAccess } from '~features/resources/resourceAccess'
import captureError from '~helpers/captureError'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import type { DictionaryEntry } from '~features/resources/dictionaryAccess'
import { useQuery } from '@tanstack/react-query'
import { useLayoutSize } from '~helpers/useLayoutSize'
import { wp } from '~helpers/utils'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { useDownloadQueue, useDownloadItemStatus } from '~helpers/useDownloadQueue'
import DictionnaireCard from './DictionnaireCard'
import DictionnaireVerseReference from './DictionnaireVerseReference'
import { localQueryOptions } from '~helpers/queryOptions'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { bibleChapterQueryOptions } from '~features/resources/resourceQueries'
import OfflineResourceRecovery from '~features/resources/OfflineResourceRecovery'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { ResourceAccessError } from '~features/resources/resourceAccessError'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const itemWidth = slideWidth + itemHorizontalMargin * 2

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row',
}))

const VersetWrapper = styled.View(() => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end',
}))

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3,
})

const StyledVerse = styled.View(() => ({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row',
}))

type BibleChapterText = Record<
  string | number,
  Record<string | number, Record<string | number, string>>
>

const verseToDictionnary = (
  { Livre, Chapitre, Verset }: Verse,
  dictionnaryWordsInVerse: string[],
  bible: BibleChapterText
): JSX.Element | JSX.Element[] | undefined => {
  try {
    const verseText = bible[Livre]?.[Chapitre]?.[Verset]
    if (!verseText) {
      return <Paragraph />
    }

    if (!dictionnaryWordsInVerse.length) {
      return <Paragraph>{verseText}</Paragraph>
    }

    // TODO: Find a better regexp
    const regExpString = `(${dictionnaryWordsInVerse.join('|')})\\W`
    const regExp = new RegExp(regExpString, 'gmi')
    const splittedVerseText = verseText.split(regExp)

    const formattedVerseText = splittedVerseText.map((item: string, i: number) => {
      if (dictionnaryWordsInVerse.includes(item.toLowerCase())) {
        return <DictionnaireVerseReference key={i} word={item} />
      }

      const words = item.split(' ')
      return (
        <React.Fragment key={i}>
          {words.map((w: string, j: number) => (
            <Paragraph key={j}>{w} </Paragraph>
          ))}
        </React.Fragment>
      )
    })

    return formattedVerseText
  } catch (e) {
    captureError(e, 'Impossible de charger le dictionnaire.')
  }
}

const useFormattedText = ({
  verse,
  wordsInVerse,
  resourceLang,
}: {
  verse: Verse
  wordsInVerse?: string[]
  resourceLang: string
}) => {
  const resources = useResourceAccess()
  const [selectedWord, setSelectedWord] = useState<string>()

  const { Livre, Chapitre, Verset } = verse
  const defaultVersion = getDefaultBibleVersion(resourceLang)
  const chapterRequest = {
    version: defaultVersion,
    book: Number(Livre),
    chapter: Number(Chapitre),
  }
  const chapterQuery = useQuery({
    ...bibleChapterQueryOptions(chapterRequest, resources),
    enabled: !!wordsInVerse,
  })

  const { error: wordsError, data: words } = useQuery<(DictionaryEntry | undefined)[]>({
    enabled: Boolean(wordsInVerse),
    queryKey: ['words', `${Livre}-${Chapitre}-${Verset}`, resourceLang],
    queryFn: () =>
      Promise.all(
        (wordsInVerse ?? []).map(async w => {
          const word = await resources.dictionary.loadItem(w)
          return word
        })
      ),
    ...localQueryOptions,
  })
  const currentWord =
    selectedWord && wordsInVerse?.includes(selectedWord) ? selectedWord : wordsInVerse?.[0]
  const chapterResult = chapterQuery.data
  const chapterVerses = chapterResult?.success ? chapterResult.data.verses : []
  const bible = {
    [Livre]: {
      [Chapitre]: Object.fromEntries(chapterVerses.map(v => [v.Verset, v.Texte])),
    },
  }
  const verseText = bible[Livre]?.[Chapitre]?.[Verset]
  const requiredBibleVersion =
    chapterResult &&
    !chapterResult.success &&
    chapterResult.error.recoveries?.includes('acquire-offline-copy')
      ? defaultVersion
      : null
  const chapterDomainError =
    (chapterResult && !chapterResult.success && !requiredBibleVersion) ||
    (chapterResult?.success && !verseText)

  return {
    wordsError:
      wordsError ??
      chapterQuery.error ??
      (chapterDomainError ? new Error('CHAPTER_UNAVAILABLE') : null),
    formattedText: verseText ? verseToDictionnary(verse, wordsInVerse ?? [], bible) : undefined,
    words,
    currentWord,
    setCurrentWord: setSelectedWord,
    versesInCurrentChapter: chapterVerses.length,
    requiredBibleVersion,
  }
}

const DictionnaireVerseDetailScreen = ({
  verse,
  updateVerse,
}: {
  verse: Verse
  updateVerse: (value: number) => void
}) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const carousel = useRef<ICarouselInstance>(null)
  const { Livre, Chapitre, Verset } = verse
  const [boxHeight, setBoxHeight] = useState(0)
  const {
    ref: carouselContainerRef,
    size: carouselContainerSize,
    onLayout: onCarouselContainerLayout,
  } = useLayoutSize()

  // Get resource language from Jotai for cache key invalidation
  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const resourceLang = resourcesLanguage.DICTIONNAIRE
  const { enqueue } = useDownloadQueue()
  const dictionaryAvailabilityQuery = useQuery({
    queryKey: resourceQueryKeys.offlineDatabaseAvailability('DICTIONNAIRE', resourceLang),
    queryFn: () =>
      resources.dictionary.getAvailability?.(resourceLang) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })

  const { error: dictionaryWordsError, data: wordsInVerse } = useQuery<string[]>({
    queryKey: ['dictionaryWords', `${Livre}-${Chapitre}-${Verset}`, resourceLang],
    queryFn: () => resources.dictionary.loadWordsForVerse(`${Livre}-${Chapitre}-${Verset}`),
    ...localQueryOptions,
  })

  const {
    wordsError,
    formattedText,
    words,
    currentWord,
    setCurrentWord,
    versesInCurrentChapter,
    requiredBibleVersion,
  } = useFormattedText({ verse, wordsInVerse, resourceLang })
  const requiredBibleDownloadStatus = useDownloadItemStatus(
    requiredBibleVersion
      ? createOfflineCopyId({ kind: 'bible', versionId: requiredBibleVersion })
      : undefined
  )

  const goToWord = (word: string) => {
    if (!wordsInVerse) return
    const index = wordsInVerse.findIndex((w: string) => w === word)
    if (index !== -1) {
      carousel.current?.scrollTo({ index, animated: true })
    }
    setCurrentWord(word)
  }

  if (
    dictionaryAvailabilityQuery.data?.status === 'unavailable' &&
    dictionaryAvailabilityQuery.data.recoveries.includes('acquire-offline-copy')
  ) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'DICTIONNAIRE', language: resourceLang }}
        title={t('La base de données dictionnaire est requise pour accéder à cette page.')}
        fileSize={22}
        size="small"
      />
    )
  }

  if (
    [dictionaryWordsError, wordsError].some(
      error =>
        error instanceof ResourceAccessError && error.recoveries.includes('acquire-offline-copy')
    )
  ) {
    return (
      <OfflineResourceRecovery
        identity={{ kind: 'database', databaseId: 'DICTIONNAIRE', language: resourceLang }}
        title={t('Votre dictionnaire doit être retéléchargé.')}
        fileSize={22}
        size="small"
      />
    )
  }

  if (dictionaryWordsError || wordsError) {
    return (
      <Container>
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Impossible de charger le dictionnaire pour ce verset...')}
        />
      </Container>
    )
  }

  if (requiredBibleVersion) {
    const isDownloading =
      requiredBibleDownloadStatus?.status === 'queued' ||
      requiredBibleDownloadStatus?.status === 'downloading' ||
      requiredBibleDownloadStatus?.status === 'inserting'

    return (
      <Container>
        <Box flex center px={30}>
          <Empty
            source={require('~assets/images/empty.json')}
            message={t('resourceLanguage.requiredBibleMissing', {
              version: requiredBibleVersion,
            })}
          />
          <Button
            onPress={() => enqueue([createBibleDownloadItem(requiredBibleVersion)])}
            isLoading={isDownloading}
          >
            {t('resourceLanguage.downloadRequiredBible', { version: requiredBibleVersion })}
          </Button>
        </Box>
      </Container>
    )
  }

  if (!formattedText || !wordsInVerse || !words) {
    return <Loading />
  }

  const loadedWords = words
    .map((word, index) => (word ? { wordKey: wordsInVerse[index], item: word } : null))
    .filter((word): word is { wordKey: string; item: DictionaryEntry } => Boolean(word))
  const currentLoadedWordIndex = loadedWords.findIndex(word => word.wordKey === currentWord)

  return (
    <Box flex={1} onLayout={e => setBoxHeight(e.nativeEvent.layout.height)}>
      <Box maxHeight={boxHeight / 2} position="relative" zIndex={1}>
        <ScrollView contentContainerStyle={{ paddingTop: 10 }}>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                current: currentWord ?? null,
                setCurrent: goToWord,
              }}
            >
              <VerseText>{formattedText}</VerseText>
            </CarouselProvider>
          </StyledVerse>
        </ScrollView>
        <BibleVerseDetailFooter
          verseNumber={Verset}
          versesInCurrentChapter={versesInCurrentChapter}
          goToNextVerse={() => updateVerse(+1)}
          goToPrevVerse={() => updateVerse(-1)}
        />
      </Box>
      <Box bg="lightGrey" mt={-30} position="relative" zIndex={0}>
        <RoundedCorner />
      </Box>
      <Box ref={carouselContainerRef} flex bg="lightGrey" onLayout={onCarouselContainerLayout}>
        {loadedWords.length ? (
          <Carousel
            ref={carousel}
            mode="horizontal-stack"
            scrollAnimationDuration={300}
            itemWidth={itemWidth}
            itemHeight={carouselContainerSize.height}
            onConfigurePanGesture={gestureChain => {
              gestureChain.activeOffsetX([-10, 10])
            }}
            modeConfig={{
              opacityInterval: 0.8,
              scaleInterval: 0,
              stackInterval: itemWidth,
              rotateZDeg: 0,
            }}
            style={{
              paddingLeft: 20,
              overflow: 'visible',
              flex: 1,
              width: '100%',
            }}
            defaultIndex={currentLoadedWordIndex === -1 ? 0 : currentLoadedWordIndex}
            data={loadedWords}
            renderItem={({ item }) => <DictionnaireCard dictionnaireRef={item.item} />}
            onSnapToItem={(index: number) => setCurrentWord(loadedWords[index]?.wordKey)}
          />
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message="Pas de mot pour ce verset..."
          />
        )}
      </Box>
    </Box>
  )
}

export default DictionnaireVerseDetailScreen
