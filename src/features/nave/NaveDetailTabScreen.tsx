import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Share } from 'react-native'
import * as Icon from '@expo/vector-icons'
import truncHTML from 'trunc-html'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import * as Sentry from '@sentry/react-native'
import { WebView } from 'react-native-webview'

import Back from '~common/Back'
import Link from '~common/Link'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import { setHistory } from '~redux/modules/user'
import { MAX_WIDTH } from '~helpers/useDimensions'
import styled from '@emotion/native'
import waitForDatabase from '~common/waitForNaveDB'
import loadNaveItem from '~helpers/loadNaveItem'
import Snackbar from '~common/SnackBar'
import MultipleTagsModal from '~common/MultipleTagsModal'
import TagList from '~common/TagList'
import useHTMLView from '~helpers/useHTMLView'
import { NavigationStackProp } from 'react-navigation-stack'
import { NavigationParams } from 'react-navigation'
import { RootState } from '~redux/modules/reducer'
import { PrimitiveAtom, useAtom } from 'jotai'
import { NaveTab } from '~state/tabs'
import produce from 'immer'

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

const TitleBorder = styled.View(({ theme }) => ({
  marginTop: 10,
  width: 35,
  height: 3,
  backgroundColor: theme.colors.quint,
}))

interface NaveDetailScreenProps {
  navigation: NavigationStackProp
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveDetailScreen = ({ navigation, naveAtom }: NaveDetailScreenProps) => {
  const [naveTab, setNaveTab] = useAtom(naveAtom)

  const {
    hasBackButton,
    data: { name_lower, name },
  } = naveTab

  const dispatch = useDispatch()
  const [naveItem, setNaveItem] = useState(null)

  const [multipleTagsItem, setMultipleTagsItem] = useState(false)
  const tags = useSelector(
    (state: RootState) => state.user.bible.naves[name_lower]?.tags,
    shallowEqual
  )

  const setTitle = (title: string) =>
    setNaveTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(naveItem?.name || name)
  }, [naveItem?.name, name])

  useEffect(() => {
    loadNaveItem(name_lower).then(result => {
      setNaveItem(result)
      dispatch(
        setHistory({
          name: result.name,
          name_lower: result.name_lower,
          type: 'nave',
        })
      )
    })
  }, [dispatch, name, name_lower])

  const openLink = ({ href }) => {
    const [type, item] = href.split('=')

    if (type === 'v') {
      try {
        const [book, chapter, verses] = item.split('-')
        const [verse] = verses ? verses.split(',') : []
        navigation.navigate('BibleView', {
          isReadOnly: true,
          book: Number(book),
          chapter: Number(chapter),
          verse: Number(verse),
          focusVerses: verses?.split(',').map(Number),
        })
      } catch (e) {
        console.log(e)
        Snackbar.show('Impossible de charger ce verset.')
        Sentry.captureMessage(
          `Something went wrong with verse ${href} in ${name}`
        )
      }
    }

    if (type === 'w') {
      navigation.navigate({
        routeName: 'NaveDetail',
        params: {
          name_lower: item,
        },
        key: name_lower,
      })
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink })

  const shareDefinition = () => {
    try {
      const message = `${name} \n\n${truncHTML(naveItem.description, 4000)
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

  const onClosed = useCallback(() => setMultipleTagsItem(false), [])

  return (
    <Container>
      <Box
        px={20}
        pt={20}
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
          <Box flex marginTop={-5}>
            <Text title fontSize={22}>
              {naveItem?.name || name}
            </Text>
            {naveItem?.name_lower && (
              <Text color="grey" fontSize={12}>
                ({naveItem.name_lower})
              </Text>
            )}
            <TitleBorder />
          </Box>
          <Link
            onPress={() =>
              setMultipleTagsItem({
                id: naveItem.name_lower,
                title: naveItem.name,
                entity: 'naves',
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
        {naveItem?.description && (
          <WebView {...webviewProps(naveItem.description)} />
        )}
      </Box>
      <MultipleTagsModal multiple item={multipleTagsItem} onClosed={onClosed} />
    </Container>
  )
}

export default waitForDatabase(NaveDetailScreen)
