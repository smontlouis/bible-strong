import React, { useState, useEffect, useRef } from 'react'
import Carousel from 'react-native-snap-carousel'
import styled from '~styled'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'

import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { CarouselProvider } from '~helpers/CarouselContext'
import loadBible from '~helpers/loadBible'
import formatVerseContent from '~helpers/formatVerseContent'
import LexiqueIcon from '~common/LexiqueIcon'
import Container from '~common/ui/Container'
import RoundedCorner from '~common/ui/RoundedCorner'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Link from '~common/Link'
import Empty from '~common/Empty'

import captureError from '~helpers/captureError'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import loadDictionnaireWords from '~helpers/loadDictionnaireWords'
import DictionnaireVerseReference from './DictionnaireVerseReference'
import DictionnaireCard from './DictionnaireCard'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { viewportWidth, wp } from '~helpers/utils'
import { Status } from '~common/types'
import useLanguage from '~helpers/useLanguage'
import { useTranslation } from 'react-i18next'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const sliderWidth = viewportWidth
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

interface Verse {
  Livre: string
  Chapitre: string
  Verset: number
}

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

const useLoadWords = (ref: string) => {
  const [wordsInVerse, setWordsInVerse] = useState([])
  const [status, setStatus] = useState<Status>('Idle')

  useEffect(() => {
    ;(async () => {
      setStatus('Pending')
      const w = await loadDictionnaireWords(ref)
      setStatus('Resolved')
      setWordsInVerse(w)
    })()
  }, [ref])

  return {
    wordsInVerse,
    status,
  }
}

const useFormattedText = (
  status: Status,
  wordsInVerse: string[],
  verse: Verse,
  Livre: string,
  Chapitre: string
) => {
  const [error, setError] = useState(false)
  const [currentWord, setCurrentWord] = useState<string>()
  const [versesInCurrentChapter, setVersesInCurrentChapter] = useState(0)
  const [formattedText, setFormattedText] = useState<
    JSX.Element | JSX.Element[]
  >()
  const [words, setWords] = useState([])
  const isFR = useLanguage()

  useEffect(() => {
    ;(async () => {
      if (status !== 'Resolved') {
        return
      }

      if (!wordsInVerse) {
        setError(true)
        return
      }

      const bible = await loadBible(isFR ? 'LSG' : 'KJV')
      const verseToDictionnaryText = await verseToDictionnary(
        verse,
        wordsInVerse,
        bible
      )
      setFormattedText(verseToDictionnaryText)
      setVersesInCurrentChapter(Object.keys(bible[Livre][Chapitre]).length)

      const loadAsyncWords = async () => {
        const w = await Promise.all(
          wordsInVerse.map(async w => {
            const word = await loadDictionnaireItem(w)
            return word
          })
        )

        setWords(w)
        setCurrentWord(wordsInVerse[0])
      }

      if (wordsInVerse.length) {
        loadAsyncWords()
      }
    })()
  }, [wordsInVerse, verse, status, isFR, Chapitre, Livre])

  return {
    error,
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

const DictionnaireVerseDetailScreen = ({ navigation }) => {
  const { t } = useTranslation()
  const carousel = useRef()
  const [verse, setVerse] = useState<Verse>(navigation.state.params.verse)
  const { Livre, Chapitre, Verset } = verse
  const { title: headerTitle } = formatVerseContent([verse])

  const { wordsInVerse, status } = useLoadWords(
    `${Livre}-${Chapitre}-${Verset}`
  )
  const {
    error,
    formattedText,
    words,
    currentWord,
    setCurrentWord,
    versesInCurrentChapter,
  } = useFormattedText(status, wordsInVerse, verse, Livre, Chapitre)

  const updateVerse = (value: number) => {
    setVerse(verse => ({
      ...verse,
      Verset: Number(verse.Verset) + value,
    }))
  }

  if (error) {
    return (
      <Container>
        <Header hasBackButton title={t('Désolé...')} />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Impossible de charger le dictionnaire pour ce verset...')}
        />
      </Container>
    )
  }

  if (!formattedText) {
    return <Loading />
  }

  return (
    <StyledScrollView
      contentContainerStyle={{ paddingBottom: 20 }}
      scrollIndicatorInsets={{ right: 1 }}
    >
      <Box flex paddingTop={getStatusBarHeight()}>
        <Header
          background
          hasBackButton
          title={`${headerTitle} ${
            headerTitle.length < 20 ? t('- Dict. LSG') : ''
          }`}
          rightComponent={
            <Link route="BibleVerseDetail" params={{ verse }} replace padding>
              <LexiqueIcon />
            </Link>
          }
        />
        <Box flex>
          <Box background paddingTop={10}>
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
            <BibleVerseDetailFooter
              verseNumber={Verset}
              versesInCurrentChapter={versesInCurrentChapter}
              goToNextVerse={() => updateVerse(+1)}
              goToPrevVerse={() => updateVerse(-1)}
            />
          </Box>
          <Box grey>
            <RoundedCorner />
          </Box>
          <Box flex grey>
            {wordsInVerse.length ? (
              <Carousel
                firstItem={wordsInVerse.findIndex(w => w === currentWord)}
                ref={carousel}
                data={words}
                renderItem={({ item, index }) => (
                  <DictionnaireCard
                    navigation={navigation}
                    dictionnaireRef={item}
                    index={index}
                  />
                )}
                activeSlideAlignment="start"
                sliderWidth={sliderWidth}
                itemWidth={itemWidth}
                inactiveSlideScale={1}
                inactiveSlideOpacity={0.3}
                containerCustomStyle={{
                  marginTop: 15,
                  paddingLeft: 20,
                  overflow: 'visible',
                  flex: 1,
                }}
                onSnapToItem={index => setCurrentWord(wordsInVerse[index])}
                contentContainerCustomStyle={{}}
                useScrollView={false}
                initialNumToRender={2}
              />
            ) : (
              <Empty
                source={require('~assets/images/empty.json')}
                message="Pas de mot pour ce verset..."
              />
            )}
          </Box>
        </Box>
      </Box>
    </StyledScrollView>
  )
}

export default waitForDictionnaireDB(DictionnaireVerseDetailScreen)
