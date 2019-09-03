import React, { useState, useEffect, useRef } from 'react'
import Carousel from 'react-native-snap-carousel'
import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'
import compose from 'recompose/compose'

import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { CarouselProvider } from '~helpers/CarouselContext'
import getBibleVerseText from '~helpers/getBibleVerseText'
import BibleLSG from '~assets/bible_versions/bible-lsg-1910.json'
import formatVerseContent from '~helpers/formatVerseContent'
import LexiqueIcon from '~common/LexiqueIcon'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Link from '~common/Link'
import Empty from '~common/Empty'

import dictionnaireWordsInBible from '~assets/bible_versions/dictionnaire-bible-lsg.json'
import captureError from '~helpers/captureError'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import DictionnaireVerseReference from './DictionnaireVerseReference'
import DictionnaireCard from './DictionnaireCard'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { viewportWidth, wp } from '~helpers/utils'

const slideWidth = wp(60)
const itemHorizontalMargin = wp(2)
const sliderWidth = viewportWidth
const itemWidth = slideWidth + itemHorizontalMargin * 2

const VerseText = styled.View(() => ({
  flex: 1,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  flexDirection: 'row'
}))

const VersetWrapper = styled.View(() => ({
  width: 25,
  marginRight: 5,
  borderRightWidth: 3,
  borderRightColor: 'transparent',
  alignItems: 'flex-end'
}))

const NumberText = styled(Paragraph)({
  marginTop: 0,
  fontSize: 9,
  justifyContent: 'flex-end',
  marginRight: 3
})

const StyledVerse = styled.View(() => ({
  paddingLeft: 0,
  paddingRight: 10,
  marginBottom: 5,
  flexDirection: 'row'
}))

const verseToDictionnary = ({ Livre, Chapitre, Verset }, dictionnaryWordsInVerse) => {
  try {
    const verseText = getBibleVerseText(BibleLSG, Livre, Chapitre, Verset)
    if (!dictionnaryWordsInVerse.length) {
      return <Paragraph>{verseText}</Paragraph>
    }

    // TODO: Find a better regexp
    const regExpString = `(${dictionnaryWordsInVerse.join('|')})\\W`
    const regExp = new RegExp(regExpString, 'gmi')
    const splittedVerseText = verseText.split(regExp)

    const formattedVerseText = splittedVerseText.map((item, i) => {
      if (dictionnaryWordsInVerse.includes(item)) {
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

const DictionnaireVerseDetailScreen = ({ theme, navigation }) => {
  const carousel = useRef()
  const [formattedText, setFormattedText] = useState('')
  const [words, setWords] = useState([])
  const [currentWord, setCurrentWord] = useState(null)
  const [verse, setVerse] = useState(navigation.state.params.verse)
  const { Livre, Chapitre, Verset } = verse
  const { title: headerTitle } = formatVerseContent([verse])
  const versesInCurrentChapter =
    BibleLSG[Livre] && BibleLSG[Livre][Chapitre] && Object.keys(BibleLSG[Livre][Chapitre]).length
  const dictionnaryWordsInVerse = getBibleVerseText(
    dictionnaireWordsInBible,
    Livre,
    Chapitre,
    Verset
  )

  const updateVerse = value => {
    setVerse(verse => ({
      ...verse,
      Verset: Number(verse.Verset) + value
    }))
  }

  useEffect(() => {
    const verseToDictionnaryText = verseToDictionnary(verse, dictionnaryWordsInVerse)
    setFormattedText(verseToDictionnaryText)

    const loadAsyncWords = async () => {
      const words = await Promise.all(
        dictionnaryWordsInVerse.map(async w => {
          const word = await loadDictionnaireItem(w)
          return word
        })
      )
      setWords(words)
      setCurrentWord(dictionnaryWordsInVerse[0])
    }

    if (dictionnaryWordsInVerse.length) {
      loadAsyncWords()
    }
  }, [Chapitre, Livre, dictionnaryWordsInVerse, verse])

  if (!formattedText) {
    return <Loading />
  }

  return (
    <Container>
      <Header
        noBorder
        hasBackButton
        title={`${headerTitle} ${headerTitle.length < 20 ? '- Dict. LSG' : ''}`}
        rightComponent={
          <Link route="BibleVerseDetail" params={{ verse }} replace>
            <Box marginRight={10}>
              <LexiqueIcon color={theme.colors.primary} />
            </Box>
          </Link>
        }
      />
      <Box paddingTop={6} flex>
        <StyledVerse>
          <VersetWrapper>
            <NumberText>{verse.Verset}</NumberText>
          </VersetWrapper>
          <CarouselProvider
            value={{
              current: currentWord,
              setCurrent: setCurrentWord
            }}>
            <VerseText>{formattedText}</VerseText>
          </CarouselProvider>
        </StyledVerse>
        <BibleVerseDetailFooter
          verseNumber={Verset}
          versesInCurrentChapter={versesInCurrentChapter}
          goToNextVerse={() => updateVerse(+1)}
          goToPrevVerse={() => updateVerse(-1)}
        />
        <Box flex>
          {dictionnaryWordsInVerse.length ? (
            <Carousel
              firstItem={dictionnaryWordsInVerse.findIndex(w => w === currentWord)}
              ref={carousel}
              data={words}
              renderItem={({ item, index }) => (
                <DictionnaireCard navigation={navigation} dictionnaireRef={item} index={index} />
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
                borderTopColor: theme.colors.border,
                borderTopWidth: 1
              }}
              onSnapToItem={index => setCurrentWord(dictionnaryWordsInVerse[index])}
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
    </Container>
  )
}

export default compose(
  withTheme,
  waitForDictionnaireDB
)(DictionnaireVerseDetailScreen)
