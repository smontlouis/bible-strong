import React, { useEffect, useState } from 'react'
import { Share } from 'react-native'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import truncHTML from 'trunc-html'
import { useDispatch, useSelector } from 'react-redux'
import * as Sentry from '@sentry/react-native'

import { WebView } from 'react-native-webview'
import Button from '~common/ui/Button'
import books from '~assets/bible_versions/books-desc'
import Back from '~common/Back'
import Link from '~common/Link'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import { MAX_WIDTH } from '~helpers/useDimensions'
import { setHistory } from '~redux/modules/user'
import useHTMLView from '~helpers/useHTMLView'

import waitForDatabase from '~common/waitForDictionnaireDB'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import Snackbar from '~common/SnackBar'
import MultipleTagsModal from '~common/MultipleTagsModal'
import TagList from '~common/TagList'
import { PrimitiveAtom, useAtom } from 'jotai'
import { DictionaryTab } from '~state/tabs'
import { NavigationStackProp } from 'react-navigation-stack'
import produce from 'immer'

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.secondary,
}))

interface DictionaryDetailScreenProps {
  navigation: NavigationStackProp
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
}

const DictionnaryDetailScreen = ({
  navigation,
  dictionaryAtom,
}: DictionaryDetailScreenProps) => {
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)

  const {
    hasBackButton,
    data: { word },
  } = dictionaryTab

  const dispatch = useDispatch()
  const [dictionnaireItem, setDictionnaireItem] = useState(null)
  const [multipleTagsItem, setMultipleTagsItem] = useState(false)
  const tags = useSelector(state => state.user.bible.words[word]?.tags)

  const setTitle = (title: string) =>
    setDictionaryTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(word)
  }, [word])

  useEffect(() => {
    loadDictionnaireItem(word).then(result => {
      setDictionnaireItem(result)

      dispatch(
        setHistory({
          word,
          type: 'word',
        })
      )
    })
  }, [dispatch, word])

  const openLink = ({ href, content, type }) => {
    if (type === 'verse') {
      try {
        const sanitizedHref = href.replace(String.fromCharCode(160), ' ')
        const book = books.find(b => sanitizedHref.includes(b.Nom))
        const splittedHref = sanitizedHref
          .replace(String.fromCharCode(160), ' ')
          .split(/\b\s+(?!$)/)
        const [chapter, verse] = splittedHref[splittedHref.length - 1].split(
          '.'
        )
        navigation.navigate('BibleView', {
          isReadOnly: true,
          book,
          chapter: parseInt(chapter, 10),
          verse: parseInt(verse, 10),
        })
      } catch (e) {
        Snackbar.show('Impossible de charger ce mot.')
        Sentry.captureMessage(
          `Something went wrong with verse ${href} in ${word} ${e}`
        )
      }
    } else {
      navigation.navigate({
        routeName: 'DictionnaryDetail',
        params: { word: href },
        key: href,
      })
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink })

  const shareDefinition = () => {
    try {
      const message = `${word} \n\n${truncHTML(
        dictionnaireItem.definition,
        4000
      )
        .text.replace(/&#/g, '\\')
        .replace(/\\x([0-9A-F]+);/gi, function() {
          return String.fromCharCode(parseInt(arguments[1], 16))
        })} \n\nLa suite sur https://bible-strong.app`

      Share.share({ message })
    } catch (e) {
      Snackbar.show('Erreur lors du partage.')
      console.log(e)
      Sentry.captureException(e)
    }
  }

  return (
    <Container>
      <Box
        padding={20}
        maxWidth={MAX_WIDTH}
        width="100%"
        marginLeft="auto"
        marginRight="auto"
      >
        <Box style={{ flexDirection: 'row' }}>
          {hasBackButton && (
            <Back>
              <Box paddingRight={20}>
                <FeatherIcon name={'arrow-left'} size={20} />
              </Box>
            </Back>
          )}
          <Box marginTop={-5} flex>
            <Text title fontSize={22}>
              {word}
            </Text>
            <TitleBorder />
          </Box>
          <Link
            onPress={() =>
              setMultipleTagsItem({
                id: word,
                title: word,
                entity: 'words',
              })
            }
          >
            <FeatherIcon
              style={{
                paddingTop: 10,
                paddingHorizontal: 5,
                marginRight: 10,
              }}
              name="tag"
              size={20}
            />
          </Link>
          <Link onPress={() => {}}>
            <FeatherIcon
              style={{ paddingTop: 10, paddingHorizontal: 5, marginRight: 10 }}
              name="share-2"
              size={20}
              onPress={shareDefinition}
            />
          </Link>
        </Box>
      </Box>
      {tags && (
        <Box mt={10} px={20}>
          <TagList tags={tags} />
        </Box>
      )}
      <Box
        mt={10}
        style={{
          overflow: 'hidden',
          flex: 1,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
        }}
      >
        {dictionnaireItem?.definition && (
          <WebView
            {...webviewProps(dictionnaireItem.definition.replace(/\n/gi, ''))}
          />
        )}
      </Box>
      <MultipleTagsModal
        multiple
        item={multipleTagsItem}
        onClosed={() => setMultipleTagsItem(false)}
      />
    </Container>
  )
}

export default waitForDatabase(DictionnaryDetailScreen)
