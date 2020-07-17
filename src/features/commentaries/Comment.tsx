import React from 'react'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import FastImage from 'react-native-fast-image'
import { Linking, Share } from 'react-native'
import truncHTML from 'trunc-html'
import Snackbar from '~common/SnackBar'
import * as Animatable from 'react-native-animatable'
import Box from '~common/ui/Box'
import Link, { LinkBox } from '~common/Link'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import StylizedHTMLView from '~common/StylizedHTMLView'
import { Comment as CommentProps, EGWComment } from './types'
import { useFireStorage } from '~features/plans/plan.hooks'
import books, { bookMappingComments } from '~assets/bible_versions/books-desc-2'
import * as Sentry from '@sentry/react-native'
import { useTranslation } from 'react-i18next'

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

const Comment = ({ comment, navigation }: Props) => {
  const { resource, content, href } = comment
  const [isCollapsed, setCollapsed] = React.useState(true)
  const cacheImage = useFireStorage(resource.logo)
  const { t } = useTranslation()

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

      navigation.navigate('BibleView', {
        isReadOnly: true,
        book: Number(book),
        chapter: Number(chapter),
        verse: Number(verse),
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
            {resource.author}
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
          <StylizedHTMLView value={content} onLinkPress={openLink} />
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
  )
}

export default withNavigation(Comment)
