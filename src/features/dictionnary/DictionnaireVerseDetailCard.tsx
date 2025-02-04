import styled from '@emotion/native'
import React, { useEffect, useRef, useState } from 'react'
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { CarouselProvider } from '~helpers/CarouselContext'
import loadBible from '~helpers/loadBible'

import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { Verse } from '~common/types'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import captureError from '~helpers/captureError'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import loadDictionnaireWords from '~helpers/loadDictionnaireWords'
import { QueryStatus, useQuery } from '~helpers/react-query-lite'
import useLanguage from '~helpers/useLanguage'
import { wp } from '~helpers/utils'
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

const verseToDictionnary = async (
  { Livre, Chapitre, Verset }: Verse,
  dictionnaryWordsInVerse: string[],
  bible: any
): Promise<JSX.Element | JSX.Element[] | undefined> => {
  try {
    const verseText = bible[Livre]?.[Chapitre]?.[Verset]
    if (!dictionnaryWordsInVerse.length) {
      return <Paragraph>{verseText}</Paragraph>
    }

    // TODO: Find a better regexp
    const regExpString = `(${dictionnaryWordsInVerse.join('|')})\\W`
    const regExp = new RegExp(regExpString, 'gmi')
    const splittedVerseText = verseText.split(regExp)

    const formattedVerseText = splittedVerseText.map((item, i) => {
      if (dictionnaryWordsInVerse.includes(item.toLowerCase())) {
        return <DictionnaireVerseReference key={i} word={item} />
      }

      const words = item.split(' ')
      return (
        <React.Fragment key={i}>
          {words.map((w, j) => (
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
}: {
  verse: Verse
  wordsInVerse?: string[]
  status: QueryStatus
}) => {
  const [currentWord, setCurrentWord] = useState<string>()
  const [versesInCurrentChapter, setVersesInCurrentChapter] = useState(0)
  const [formattedText, setFormattedText] = useState<
    JSX.Element | JSX.Element[]
  >()
  const [boxHeight, setBoxHeight] = useState(0)

  const isFR = useLanguage()

  const { Livre, Chapitre, Verset } = verse

  useEffect(() => {
    ;(async () => {
      if (!wordsInVerse) {
        return
      }
      setCurrentWord(wordsInVerse[0])
      const bible = await loadBible(isFR ? 'LSG' : 'KJV')
      const verseToDictionnaryText = await verseToDictionnary(
        verse,
        wordsInVerse,
        bible
      )
      setFormattedText(verseToDictionnaryText)
      setVersesInCurrentChapter(Object.keys(bible[Livre][Chapitre]).length)
    })()
  }, [wordsInVerse, verse, isFR, Chapitre, Livre])

  const { error: wordsError, data: words } = useQuery({
    enabled: Boolean(wordsInVerse),
    queryKey: ['words', `${Livre}-${Chapitre}-${Verset}`],
    queryFn: () =>
      Promise.all(
        wordsInVerse!.map(async w => {
          const word = await loadDictionnaireItem(w)
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
  }
}

const StyledScrollView = styled.ScrollView(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
}))

const DictionnaireVerseDetailScreen = ({
  verse,
  updateVerse,
}: {
  verse: Verse
  updateVerse: (value: number) => void
}) => {
  const { t } = useTranslation()
  const carousel = useRef<ICarouselInstance>(null)
  const { Livre, Chapitre, Verset } = verse
  const navigation = useNavigation()
  const [boxHeight, setBoxHeight] = useState(0)

  const { status, error: dictionaryWordsError, data: wordsInVerse } = useQuery({
    queryKey: ['dictionaryWords', `${Livre}-${Chapitre}-${Verset}`],
    queryFn: () => loadDictionnaireWords(`${Livre}-${Chapitre}-${Verset}`),
  })

  const {
    wordsError,
    formattedText,
    words,
    currentWord,
    setCurrentWord,
    versesInCurrentChapter,
  } = useFormattedText({ verse, wordsInVerse, status })

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

  if (!formattedText || !wordsInVerse || !words) {
    return <Loading />
  }

  const currentWordIndex = wordsInVerse.findIndex(w => w === currentWord)

  return (
    <Box flex={1} onLayout={e => setBoxHeight(e.nativeEvent.layout.height)}>
      <Box maxHeight={boxHeight / 2} position="relative" zIndex={1}>
        <BottomSheetScrollView contentContainerStyle={{ paddingTop: 10 }}>
          <StyledVerse>
            <VersetWrapper>
              <NumberText>{verse.Verset}</NumberText>
            </VersetWrapper>
            <CarouselProvider
              value={{
                current: currentWord,
                setCurrent: setCurrentWord,
              }}
            >
              <VerseText>{formattedText}</VerseText>
            </CarouselProvider>
          </StyledVerse>
        </BottomSheetScrollView>
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
      <Box flex bg="lightGrey">
        {wordsInVerse.length ? (
          <Carousel
            ref={carousel}
            mode="horizontal-stack"
            scrollAnimationDuration={300}
            width={itemWidth}
            panGestureHandlerProps={{
              activeOffsetX: [-10, 10],
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
            }}
            defaultIndex={currentWordIndex === -1 ? 0 : currentWordIndex}
            data={words}
            renderItem={({ item, index }) => (
              <DictionnaireCard
                navigation={navigation}
                dictionnaireRef={item}
                index={index}
              />
            )}
            onSnapToItem={index => setCurrentWord(wordsInVerse[index])}
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
