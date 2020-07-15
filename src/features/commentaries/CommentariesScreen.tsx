import React, { useEffect, useState } from 'react'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import { useTranslation } from 'react-i18next'
import { NavigationStackProp } from 'react-navigation-stack'
import { firebaseDb } from '~helpers/firebase'
import { Status } from '~common/types'
import to from 'await-to-js'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import ScrollView from '~common/ui/ScrollView'
import Paragraph from '~common/ui/Paragraph'
import { Comments } from './types'
import Comment from './Comment'
import useBibleVerses, { verseStringToObject } from '~helpers/useBibleVerses'

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

const useComments = (verse: string) => {
  const [status, setStatus] = useState<Status>('Idle')
  const [data, setData] = useState<Comments>()
  const [error, setError] = useState<Error>()

  useEffect(() => {
    ;(async () => {
      const [err, res] = await to(fetchComments(verse))
      setStatus('Pending')
      if (err) {
        setError(err)
        setStatus('Rejected')
        return
      }

      setData(res)
      setStatus('Resolved')
    })()
  }, [verse])

  return { status, data, error }
}

const CommentariesScreen = ({ navigation }: Props) => {
  const { t } = useTranslation()
  const verse = navigation.getParam('verse', null)
  const { status, data } = useComments(verse)
  const { current: verseFormatted } = React.useRef(verseStringToObject([verse]))
  const [verseText] = useBibleVerses(verseFormatted)
  console.log(verseText)

  return (
    <Container>
      <Header hasBackButton title={t('Commentaires')} />
      {status === 'Pending' ? (
        <Loading />
      ) : status === 'Rejected' ? (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Une erreur est survenue')}
        />
      ) : (
        <>
          <ScrollView>
            <Paragraph>{verseText?.Texte}</Paragraph>
            {data?.comments.map((comment, i) => {
              return <Comment {...comment} key={i} />
            })}
          </ScrollView>
        </>
      )}
    </Container>
  )
}

export default CommentariesScreen
