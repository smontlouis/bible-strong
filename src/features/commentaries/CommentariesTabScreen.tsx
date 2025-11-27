import styled from '@emotion/native'
import to from 'await-to-js'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, ScrollView } from 'react-native'
import Empty from '~common/Empty'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Loading from '~common/Loading'
import { Status } from '~common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import RoundedCorner from '~common/ui/RoundedCorner'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import useBibleVerses, { verseStringToObject } from '~helpers/useBibleVerses'
import BibleVerseDetailFooter from '../bible/BibleVerseDetailFooter'
import Comment from './Comment'
import { Comment as CommentType, Comments } from './types'

import { useTheme } from '@emotion/react'
import produce from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import AdventistIcon from '~common/AdventistIcon'
import PopOverMenu from '~common/PopOverMenu'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import { HStack } from '~common/ui/Stack'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { firebaseDb } from '~helpers/firebase'
import memoize from '~helpers/memoize'
import useLanguage from '~helpers/useLanguage'
import { Theme } from '~themes'
import { CommentaryTab } from '../../state/tabs'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

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

const fetchComments = memoize(async (verse: string) => {
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

  const comments = snapshot.docs.map((x) => x.data())

  return { ...verseComment, comments } as Comments
})

const fetchMoreComments = memoize(async (verse: string, id?: string) => {
  const query = id
    ? firebaseDb
        .collection('verse-commentaries')
        .doc(verse)
        .collection('commentaries')
        .orderBy('id')
        .startAfter(id)
        .limit(8)
        .get()
    : firebaseDb
        .collection('verse-commentaries')
        .doc(verse)
        .collection('commentaries')
        .orderBy('id')
        .limit(8)
        .get()

  const snapshot = await query

  const comments = snapshot.docs.map((x) => x.data()) as CommentType[]

  return comments
})

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

  const loadMore = async (id?: string) => {
    setMoreStatus('Pending')
    const comments = await fetchMoreComments(verse, id)

    setData((s) => {
      return { ...s, comments: [...s!.comments, ...comments] } as Comments
    })
    setPage((s) => s + comments.length)
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
  const [versesInCurrentChapter, setVersesInCurrentChapter] =
    React.useState<number>()
  useEffect(() => {
    ;(async () => {
      const v = countLsgChapters[`${book}-${chapter}`]
      setVersesInCurrentChapter(v)
    })()
  }, [book, chapter])
  return { versesInCurrentChapter }
}

interface CommentariesScreenProps {
  hasHeader?: boolean
  commentaryAtom: PrimitiveAtom<CommentaryTab>
}

const CommentariesTabScreen = ({
  hasHeader = true,
  commentaryAtom,
}: CommentariesScreenProps) => {
  const { t } = useTranslation()
  const isFR = useLanguage()
  const theme: Theme = useTheme()

  const [commentaryTab, setCommentaryTab] = useAtom(commentaryAtom)

  const openInNewTab = useOpenInNewTab()

  const {
    hasBackButton,
    data: { verse },
  } = commentaryTab

  const setVerse = (v: string) =>
    setCommentaryTab(
      produce((draft) => {
        draft.data.verse = v
      })
    )

  const setTitle = (title: string) =>
    setCommentaryTab(
      produce((draft) => {
        draft.title = title
      })
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
    const [b, c, v] = verse.split('-').map(Number)
    setVerse(`${b}-${c}-${v + value}`)
  }

  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  useEffect(() => {
    setTitle(headerTitle)
  }, [headerTitle])

  return (
    <>
      {hasHeader && (
        <>
          <Box background paddingTop={insets.top} />
          <Header
            background
            hasBackButton={hasBackButton}
            title={headerTitle}
            rightComponent={
              <PopOverMenu
                popover={
                  <>
                    <MenuOption
                      onSelect={() => {
                        openInNewTab({
                          id: `commentary-${Date.now()}`,
                          title: t('tabs.new'),
                          isRemovable: true,
                          type: 'commentary',
                          data: {
                            verse,
                          },
                        })
                      }}
                    >
                      <Box row alignItems="center">
                        <FeatherIcon name="external-link" size={15} />
                        <Text marginLeft={10}>{t('tab.openInNewTab')}</Text>
                      </Box>
                    </MenuOption>
                  </>
                }
              />
            }
          />
        </>
      )}

      <ScrollView
        style={{ backgroundColor: theme.colors.lightGrey }}
        contentContainerStyle={{ paddingBottom: 20 + bottomBarHeight }}
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
          <Box bg="lightGrey">
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
                      loadMore(data?.comments[data?.comments.length - 1]?.id)
                    }
                  }}
                >
                  {moreStatus === 'Pending' ? (
                    <ActivityIndicator />
                  ) : (
                    <HStack row center>
                      <Text color="primary" fontSize={15}>
                        {t('Plus de résultats')}
                      </Text>
                      <AdventistIcon color="primary" />
                    </HStack>
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

export default CommentariesTabScreen
