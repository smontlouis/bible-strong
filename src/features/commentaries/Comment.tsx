import * as Sentry from '@sentry/react-native'
import to from 'await-to-js'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Share } from 'react-native'
import * as Animatable from 'react-native-animatable'
import FastImage from 'react-native-fast-image'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import truncHTML from 'trunc-html'
import books, { bookMappingComments } from '~assets/bible_versions/books-desc-2'
import Link, { LinkBox } from '~common/Link'
import Snackbar from '~common/SnackBar'
import StylizedHTMLView from '~common/StylizedHTMLView'
import { Status } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useFireStorage } from '~features/plans/plan.hooks'
import { firebaseDb } from '~helpers/firebase'
import useLanguage from '~helpers/useLanguage'
import { deepl } from '../../../config'
import { Comment as CommentProps, EGWComment } from './types'

const findBookNumber = (bookName: string) => {
  bookName = bookMappingComments[bookName] || bookName
  const bookNumber = books.find(b => b[1] === bookName)?.[0]
  return bookNumber || ''
}
// @ts-ignore
const AFeatherIcon = Animatable.createAnimatableComponent(FeatherIcon)

interface Props {
  navigation: NavigationStackProp<any, any>
  comment: CommentProps | EGWComment
}

const useFrenchTranslation = (id: string) => {
  const [status, setStatus] = useState<Status>('Idle')
  const [contentFR, setContentFR] = useState('')
  const { t } = useTranslation()

  const startTranslation = async (text: string) => {
    try {
      setStatus('Pending')

      const commentRef = await firebaseDb
        .collection('commentaries-FR')
        .doc(id.toString())
        .get()

      if (commentRef.exists) {
        setContentFR(commentRef.data()!.content)
        setStatus('Resolved')
        return
      }

      const data = `auth_key=${deepl.auth_key}&text=${encodeURIComponent(
        text
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
        console.log('Error', err)
        return
      }

      const result = await res?.json()

      if (result.message === 'Quota Exceeded') {
        Snackbar.show(t('comment.quotaExceeded'))
      }

      await firebaseDb
        .collection('commentaries-FR')
        .doc(id.toString())
        .set({ content: result.translations[0].text })

      setContentFR(result.translations[0].text)
      setStatus('Resolved')
      Snackbar.show(t('comment.thanksTranslation'))
    } catch (e) {
      setStatus('Rejected')
    }
  }

  return { status, contentFR, startTranslation }
}

const Comment = ({ comment, navigation }: Props) => {
  const { resource, content, href, id } = comment
  const [isCollapsed, setCollapsed] = React.useState(true)
  const cacheImage = useFireStorage(resource.logo)
  const { t } = useTranslation()
  const isFR = useLanguage()

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

      navigation.navigate({
        routeName: 'BibleView',
        params: {
          isReadOnly: true,
          book: Number(book),
          chapter: Number(chapter),
          verse: Number(verse),
        },
        key: `bible-view-${book}-${chapter}-${verse}`,
      })
    }
  }

  const shareDefinition = () => {
    try {
      const message = `${resource.author}
${resource.name}

${truncHTML(content, 10000).text}

https://bible-strong.app
      `
      Share.share({ message })
    } catch (e) {
      Snackbar.show('Erreur lors du partage.')
      console.log(e)
      Sentry.captureException(e)
    }
  }

  const { status, contentFR, startTranslation } = useFrenchTranslation(id)

  return (
    <Box m={20} marginBottom={0} p={20} rounded lightShadow bg="reverse">
      <LinkBox row onPress={() => setCollapsed(s => !s)}>
        <Box center width={40} height={40} borderRadius={20}>
          <FastImage
            style={{ width: 40, height: 40 }}
            source={{
              uri: cacheImage,
            }}
          />
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
            // @ts-ignore
            <AFeatherIcon
              color="grey"
              duration={500}
              name="chevron-down"
              size={17}
              animation={{
                from: {
                  rotate: isCollapsed ? '180deg' : '0deg',
                },
                to: {
                  rotate: !isCollapsed ? '180deg' : '0deg',
                },
              }}
            />
          )}
        </Box>
        <LinkBox width={30} center onPress={shareDefinition}>
          <FeatherIcon color="grey" name="share-2" size={17} />
        </LinkBox>
      </LinkBox>
      <Box overflow="hidden" mt={10}>
        <Box height={isCollapsed ? 100 : undefined}>
          <StylizedHTMLView
            value={contentFR || content}
            onLinkPress={openLink}
          />
          {href && (
            <Box my={20}>
              <Link href={`https://m.egwwritings.org${href}`}>
                <Text
                  color="primary"
                  fontSize={18}
                  style={{ textDecorationLine: 'underline' }}
                >
                  {t('Lire dans le contexte')}
                </Text>
              </Link>
            </Box>
          )}
        </Box>
        <Box row center>
          {isFR && !contentFR && (
            <Box center style={{ marginRight: 'auto' }}>
              <Button
                reverse
                small
                onPress={() =>
                  status !== 'Pending' && startTranslation(content)
                }
              >
                {status === 'Pending' ? 'Traduction...' : 'Traduire'}
              </Button>
            </Box>
          )}
          <LinkBox center height={40} onPress={() => setCollapsed(s => !s)}>
            {/* @ts-ignore */}
            <AFeatherIcon
              color="grey"
              duration={500}
              name="chevron-down"
              size={20}
              animation={{
                from: {
                  rotate: isCollapsed ? '180deg' : '0deg',
                },
                to: {
                  rotate: !isCollapsed ? '180deg' : '0deg',
                },
              }}
            />
          </LinkBox>
        </Box>
      </Box>
    </Box>
  )
}

export default withNavigation(Comment)
