import * as Sentry from '@sentry/react-native'
import to from 'await-to-js'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai'
import React, { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Share } from 'react-native'
import { toast } from '~helpers/toast'
import { resourcesLanguageAtom } from 'src/state/resourcesLanguage'
import truncHTML from 'trunc-html'
import books, { bookMappingComments } from '~assets/bible_versions/books-desc-2'
import Link, { LinkBox } from '~common/Link'
import StylizedHTMLView from '~common/StylizedHTMLView'
import { Status } from '~common/types'
import Box, { AnimatedBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useFireStorage } from '~features/plans/plan.hooks'
import { firebaseDb } from '~helpers/firebase'
import { Comment as CommentProps, EGWComment } from './types'

const findBookNumber = (bookName: string) => {
  bookName = bookMappingComments[bookName] || bookName
  const bookNumber = books.find(b => b[1] === bookName)?.[0]
  return bookNumber || ''
}

interface Props {
  comment: CommentProps | EGWComment
}

// Hook for automatic translation based on selected language
const useCommentTranslation = (id: string, content: string) => {
  const [status, setStatus] = useState<Status>('Idle')
  const [translatedContent, setTranslatedContent] = useState('')
  const { t } = useTranslation()

  const resourcesLanguage = useAtomValue(resourcesLanguageAtom)
  const commentLang = resourcesLanguage.COMMENTARIES

  useEffect(() => {
    // If English is selected, no translation needed
    if (commentLang === 'en') {
      setTranslatedContent('')
      setStatus('Idle')
      return
    }

    // French is selected - load translation automatically
    const loadTranslation = async () => {
      setStatus('Pending')

      try {
        // Check cache first
        const commentRef = await firebaseDb.collection('commentaries-FR').doc(id.toString()).get()

        if (commentRef.exists()) {
          setTranslatedContent(commentRef.data()!.content)
          setStatus('Resolved')
          return
        }

        // Not in cache - translate via DeepL
        const data = `auth_key=${process.env.EXPO_PUBLIC_DEEPL_AUTH_KEY}&text=${encodeURIComponent(
          content
        )}&target_lang=FR&source_lang=EN&preserve_formatting=1&tag_handling=xml`

        const [err, res] = await to(
          fetch('https://api.deepl.com/v2/translate', {
            method: 'POST',
            body: data,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': data.length.toString(),
            },
          })
        )

        if (err) {
          console.log('[Commentaries] Error:', err)
          setStatus('Rejected')
          return
        }

        const result = await res?.json()

        if (result.message === 'Quota Exceeded') {
          toast.error(t('comment.quotaExceeded'))
          setStatus('Rejected')
          return
        }

        // Cache the translation
        await firebaseDb
          .collection('commentaries-FR')
          .doc(id.toString())
          .set({ content: result.translations[0].text })

        setTranslatedContent(result.translations[0].text)
        setStatus('Resolved')
      } catch (e) {
        console.log('[Commentaries] Translation error:', e)
        setStatus('Rejected')
      }
    }

    loadTranslation()
  }, [commentLang, id, content, t])

  return { status, translatedContent }
}

const fastImageStyle = { width: 40, height: 40 }

const Comment = ({ comment }: Props) => {
  const { resource, content, href, id } = comment
  const [isCollapsed, setCollapsed] = React.useState(true)
  const cacheImage = useFireStorage(resource.logo)
  const router = useRouter()
  const fastImageSource = useMemo(
    () => ({
      uri: cacheImage,
    }),
    [cacheImage]
  )
  const { t } = useTranslation()
  const { status, translatedContent } = useCommentTranslation(id, content)

  const openLink = (href: string, innerHTML: string, type: string) => {
    if (type.includes('egwlink_bible')) {
      Linking.openURL(`https://m.egwwritings.org${href}`)
    }
    if (type.includes('egw-ref') || type.includes('egwlink_book')) {
      Linking.openURL(href)
    }
    if (type === 'bible-ref') {
      let [book, numbers] = href.substr(1).split('_')
      book = findBookNumber(book.substr(0, 3).toUpperCase())
      const [chapter, verse] = numbers.split('.')

      router.push({
        pathname: '/bible-view',
        params: {
          isReadOnly: 'true',
          book: String(book),
          chapter: String(chapter),
          verse: String(verse),
        },
      })
    }
  }

  const shareDefinition = async () => {
    try {
      const message = `${resource.author}
${resource.name}

${truncHTML(translatedContent || content, 10000).text}

https://bible-strong.app
      `
      Share.share({ message })
    } catch (e) {
      toast.error('Erreur lors du partage.')
      console.log('[Commentaries] Share error:', e)
      Sentry.captureException(e)
    }
  }

  return (
    <Box m={20} marginBottom={0} p={20} rounded lightShadow bg="reverse">
      <LinkBox row onPress={() => setCollapsed(s => !s)}>
        <Box center width={40} height={40} borderRadius={20}>
          {cacheImage && <Image style={fastImageStyle} source={fastImageSource} />}
        </Box>
        <Box ml={10} flex>
          <Text title fontSize={20}>
            {resource.author === 'Ellen G. White' ? 'EGW' : resource.author}
          </Text>
          <Text color="grey" fontSize={14}>
            {resource.name}
          </Text>
        </Box>
        <Box width={30} center>
          {!isCollapsed && (
            <AnimatedBox
              width={17}
              height={17}
              center
              style={{
                transform: [{ rotate: '180deg' }],
              }}
            >
              <FeatherIcon color="grey" name="chevron-down" size={17} />
            </AnimatedBox>
          )}
        </Box>
        <LinkBox width={30} center onPress={shareDefinition}>
          <FeatherIcon color="grey" name="share-2" size={17} />
        </LinkBox>
      </LinkBox>
      <Box overflow="hidden" mt={10}>
        <Box height={isCollapsed ? 100 : undefined}>
          <StylizedHTMLView value={translatedContent || content} onLinkPress={openLink} />
          {href && (
            <Box my={20}>
              <Link href={`https://m.egwwritings.org${href}`}>
                <Text color="primary" fontSize={18} style={{ textDecorationLine: 'underline' }}>
                  {t('Lire dans le contexte')}
                </Text>
              </Link>
            </Box>
          )}
        </Box>
        <Box row center borderTopWidth={1} borderColor="border">
          {status === 'Pending' && (
            <Box center style={{ marginRight: 'auto' }}>
              <Text color="grey" fontSize={12}>
                {t('Traduction en cours...')}
              </Text>
            </Box>
          )}
          <LinkBox center height={40} onPress={() => setCollapsed(s => !s)}>
            <AnimatedBox
              width={17}
              height={17}
              center
              style={{
                transform: [{ rotate: isCollapsed ? '0deg' : '180deg' }],
                transitionProperty: 'transform',
                transitionDuration: 500,
              }}
            >
              <FeatherIcon color="grey" name="chevron-down" size={17} />
            </AnimatedBox>
          </LinkBox>
        </Box>
      </Box>
    </Box>
  )
}

export default memo(Comment)
