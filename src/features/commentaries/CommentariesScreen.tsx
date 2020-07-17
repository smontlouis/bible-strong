import React, { useEffect, useState, useMemo } from 'react'
import Header from '~common/Header'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import { useTranslation } from 'react-i18next'
import { NavigationStackProp } from 'react-navigation-stack'
import { firebaseDb } from '~helpers/firebase'
import formatVerseContent from '~helpers/formatVerseContent'
import { Status } from '~common/types'
import to from 'await-to-js'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import { ScrollView } from 'react-native'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import styled from '~styled'
import { Comments, Comment as CommentType } from './types'
import Comment from './Comment'
import { LinkBox } from '~common/Link'
import RoundedCorner from '~common/ui/RoundedCorner'
import useBibleVerses, { verseStringToObject } from '~helpers/useBibleVerses'
import BibleVerseDetailFooter from '../bible/BibleVerseDetailFooter'
import loadCountVerses from '~helpers/loadCountVerses'

import { useTheme } from 'emotion-theming'
import { Theme } from '~themes'
import { ActivityIndicator } from 'react-native-paper'
import useLanguage from '~helpers/useLanguage'

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

const StyledVerse = styled.View({
  paddingLeft: 0,
  paddingRight: 10,
  flexDirection: 'row',
})

interface Props {
  navigation: NavigationStackProp<any>
}

const fetchComments = async (verse: string) => {
  const verseCommentRef = await firebaseDb
    .collection('verse-commentaries')
    .doc(verse)
    .get()

  if (!verseCommentRef.exists) {
    throw new Error('NOT_FOUND')
  }

  const verseComment = verseCommentRef.data()

  const snapshot = await firebaseDb
    .collection('verse-commentaries')
    .doc(verse)
    .collection('commentaries')
    .orderBy('order')
    .where('isSDA', '==', false)
    .get()

  const comments = snapshot.docs.map(x => x.data())

  return { ...verseComment, comments } as Comments
}

const fetchMoreComments = async (id: string, verse: string) => {
  const snapshot = await firebaseDb
    .collection('verse-commentaries')
    .doc(verse)
    .collection('commentaries')
    .orderBy('id')
    .startAfter(id)
    .limit(8)
    .get()

  const comments = snapshot.docs.map(x => x.data()) as CommentType[]

  return comments
}

const useComments = (verse: string) => {
  const [status, setStatus] = useState<Status>('Idle')
  const [moreStatus, setMoreStatus] = useState<Status>('Idle')
  const [data, setData] = useState<Comments>()
  const [error, setError] = useState<Error>()
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(3)

  const reset = () => {
    setCount(0)
    setPage(3)
    setMoreStatus('Idle')
    setStatus('Idle')
  }

  const loadMore = async (id: string) => {
    setMoreStatus('Pending')
    const comments = await fetchMoreComments(id, verse)

    setData(s => {
      return { ...s, comments: [...s!.comments, ...comments] } as Comments
    })
    setPage(s => s + comments.length)
    setMoreStatus('Resolved')
  }

  useEffect(() => {
    ;(async () => {
      reset()
      setStatus('Pending')
      const [err, res] = await to(fetchComments(verse))
      if (err) {
        setError(err)
        setStatus('Rejected')
        return
      }

      setData(res)
      setCount(res!.count)
      setStatus('Resolved')
    })()
  }, [verse])

  return { status, data, error, loadMore, canLoad: page < count, moreStatus }
}

const useVerseInCurrentChapter = (book: string, chapter: string) => {
  const [versesInCurrentChapter, setVersesInCurrentChapter] = React.useState<
    number
  >()
  const [error, setError] = React.useState()
  useEffect(() => {
    ;(async () => {
      const { versesInCurrentChapter, error } = await loadCountVerses(
        book,
        chapter
      )
      if (error) {
        setError(error)
        return
      }
      setVersesInCurrentChapter(versesInCurrentChapter)
    })()
  }, [book, chapter])
  return { versesInCurrentChapter, error }
}

const CommentariesScreen = ({ navigation }: Props) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const theme: Theme = useTheme()
  const [verse, setVerse] = React.useState<string>(
    navigation.getParam('verse', null)
  )
  const { status, data, loadMore, canLoad, moreStatus } = useComments(verse)
  const verseFormatted = useMemo(() => verseStringToObject([verse]), [verse])
  const { title: headerTitle } = verseFormatted
    ? formatVerseContent([verse])
    : t('Chargement')
  const [verseText] = useBibleVerses(verseFormatted)
  const { versesInCurrentChapter } = useVerseInCurrentChapter(
    verseText?.Livre,
    verseText?.Chapitre
  )
  const updateVerse = (value: -1 | 1) => {
    setVerse(s => {
      const [b, c, v] = s.split('-').map(Number)
      return `${b}-${c}-${v + value}`
    })
  }

  return (
    <>
      <Box background paddingTop={getStatusBarHeight()} />
      <Header background hasBackButton title={headerTitle} />
      <ScrollView
        style={{ backgroundColor: theme.colors.lightGrey }}
        contentContainerStyle={{ paddingBottom: 20 }}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <>
          <Box background paddingTop={10}>
            <StyledVerse>
              <VersetWrapper>
                <NumberText>{verseText?.Verset}</NumberText>
              </VersetWrapper>
              <Box flex>
                <Paragraph>{verseText?.Texte.replace(/\n/gi, '')}</Paragraph>
              </Box>
            </StyledVerse>
            <BibleVerseDetailFooter
              verseNumber={verseText?.Verset}
              goToNextVerse={() => updateVerse(+1)}
              goToPrevVerse={() => updateVerse(-1)}
              versesInCurrentChapter={versesInCurrentChapter}
            />
          </Box>
          <Box grey>
            <RoundedCorner />
          </Box>
          {status === 'Pending' || status === 'Idle' ? (
            <Box height={100} center>
              <Loading />
            </Box>
          ) : status === 'Rejected' ? (
            <Empty
              source={require('~assets/images/empty.json')}
              message={t(
                "Une erreur est survenue. Assurez-vous d'être connecté à Internet."
              )}
            />
          ) : (
            <>
              {isFR && (
                <Box
                  opacity={0.6}
                  mx={20}
                  mt={20}
                  p={20}
                  rounded
                  lightShadow
                  bg="reverse"
                >
                  <Text>
                    Les commentaires sont uniquement disponible en anglais.
                  </Text>
                </Box>
              )}
              {data?.comments.map((comment, i) => {
                return <Comment comment={comment} key={i} />
              })}
              {canLoad && (
                <LinkBox
                  m={20}
                  height={50}
                  rounded
                  lightShadow
                  bg="reverse"
                  center
                  opacity={moreStatus === 'Pending' ? 0.3 : 1}
                  onPress={() => {
                    if (moreStatus !== 'Pending') {
                      loadMore(data!.comments[data!.comments.length - 1].id)
                    }
                  }}
                >
                  {moreStatus === 'Pending' ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      <Text color="primary" fontSize={15}>
                        {t('Plus de résultats')}
                      </Text>
                      <Text fontSize={11} color="grey">
                        {t('(Contenu adventiste)')}
                      </Text>
                    </>
                  )}
                </LinkBox>
              )}
            </>
          )}
        </>
      </ScrollView>
    </>
  )
}

export default CommentariesScreen
