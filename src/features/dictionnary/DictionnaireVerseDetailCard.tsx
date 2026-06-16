import styled from '@emotion/native'
import { useAtomValue } from 'jotai'
import React, { useEffect, useRef, useState } from 'react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { CarouselProvider } from '~helpers/CarouselContext'

import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import { installedVersionsSignalAtom } from '~state/app'
import { Verse } from '~common/types'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { useResourceAccess } from '~features/resources/resourceAccess'
import captureError from '~helpers/captureError'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import type { DictionaryItem } from '~features/resources/dictionaryAccess'
import { QueryStatus, useQuery } from '~helpers/react-query-lite'
import { useLayoutSize } from '~helpers/useLayoutSize'
import { wp } from '~helpers/utils'
import { getIfVersionNeedsDownload } from '~helpers/bibleVersions'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { useDownloadQueue, useDownloadItemStatus } from '~helpers/useDownloadQueue'
import DictionnaireCard from './DictionnaireCard'
import DictionnaireVerseReference from './DictionnaireVerseReference'

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

const verseToDictionnary = async (
  { Livre, Chapitre, Verset }: Verse,
  dictionnaryWordsInVerse: string[],
  bible: BibleChapterText
): Promise<JSX.Element | JSX.Element[] | undefined> => {
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
  status,
  resourceLang,
}: {
  verse: Verse
  wordsInVerse?: string[]
  status: QueryStatus
  resourceLang: string
}) => {
  const resources = useResourceAccess()
  const installedVersionsSignal = useAtomValue(installedVersionsSignalAtom)
  const [currentWord, setCurrentWord] = useState<string>()
  const [versesInCurrentChapter, setVersesInCurrentChapter] = useState(0)
  const [formattedText, setFormattedText] = useState<JSX.Element | JSX.Element[] | undefined>()
  const [requiredBibleVersion, setRequiredBibleVersion] = useState<string | null>(null)

  const { Livre, Chapitre, Verset } = verse

  useEffect(() => {
    ;(async () => {
      if (!wordsInVerse) {
        return
      }
      setRequiredBibleVersion(null)
      setCurrentWord(wordsInVerse[0])

      const defaultVersion = getDefaultBibleVersion(resourceLang)
      const chapterVerses = await resources.bibleContent.loadChapterVerses(
        defaultVersion,
        Number(Livre),
        Number(Chapitre)
      )
      const bible = {
        [Livre]: {
          [Chapitre]: Object.fromEntries(chapterVerses.map(v => [v.Verset, v.Texte])),
        },
      }
      const verseText = bible[Livre]?.[Chapitre]?.[Verset]
      if (!verseText && (await getIfVersionNeedsDownload(defaultVersion))) {
        setRequiredBibleVersion(defaultVersion)
        setFormattedText(undefined)
        setVersesInCurrentChapter(0)
        return
      }

      const verseToDictionnaryText = await verseToDictionnary(verse, wordsInVerse, bible)
      setFormattedText(verseToDictionnaryText)
      setVersesInCurrentChapter(Object.keys(bible[Livre][Chapitre]).length)
    })()
  }, [
    wordsInVerse,
    verse,
    resourceLang,
    Chapitre,
    Livre,
    Verset,
    resources.bibleContent,
    installedVersionsSignal,
  ])

  const { error: wordsError, data: words } = useQuery<(DictionaryItem | undefined)[]>({
    enabled: Boolean(wordsInVerse),
    queryKey: ['words', `${Livre}-${Chapitre}-${Verset}`, resourceLang],
    queryFn: () =>
      Promise.all(
        (wordsInVerse ?? []).map(async w => {
          const word = await resources.dictionary.loadItem(w)
          return word
        })
      ),
  })

  return {
    wordsError,
    formattedText,
    words,
    currentWord,
    setCurrentWord,
    versesInCurrentChapter,
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

  const {
    status,
    error: dictionaryWordsError,
    data: wordsInVerse,
  } = useQuery<string[]>({
    queryKey: ['dictionaryWords', `${Livre}-${Chapitre}-${Verset}`, resourceLang],
    queryFn: () => resources.dictionary.loadWordsForVerse(`${Livre}-${Chapitre}-${Verset}`),
  })

  const {
    wordsError,
    formattedText,
    words,
    currentWord,
    setCurrentWord,
    versesInCurrentChapter,
    requiredBibleVersion,
  } = useFormattedText({ verse, wordsInVerse, status, resourceLang })
  const requiredBibleDownloadStatus = useDownloadItemStatus(
    requiredBibleVersion ? `bible:${requiredBibleVersion}` : ''
  )

  const goToWord = (word: string) => {
    if (!wordsInVerse) return
    const index = wordsInVerse.findIndex((w: string) => w === word)
    if (index !== -1) {
      carousel.current?.scrollTo({ index, animated: true })
    }
    setCurrentWord(word)
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
    .filter((word): word is { wordKey: string; item: DictionaryItem } => Boolean(word))
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

export default waitForDictionnaireDB()(DictionnaireVerseDetailScreen)
