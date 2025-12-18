import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { WebView } from 'react-native-webview'
import books from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Text from '~common/ui/Text'
import useHTMLView from '~helpers/useHTMLView'

import { StackActions } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import DetailedHeader from '~common/DetailedHeader'
import PopOverMenu from '~common/PopOverMenu'
import Snackbar from '~common/SnackBar'
import TagList from '~common/TagList'
import MenuOption from '~common/ui/MenuOption'
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import { timeout } from '~helpers/timeout'
import { MainStackProps } from '~navigation/type'
import { RootState } from '~redux/modules/reducer'
import { historyAtom, multipleTagsModalAtom } from '../../state/app'
import { DictionaryTab } from '../../state/tabs'

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface DictionaryDetailScreenProps {
  navigation: StackNavigationProp<MainStackProps, 'DictionnaryDetail'>
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
}

const DictionnaryDetailScreen = ({ navigation, dictionaryAtom }: DictionaryDetailScreenProps) => {
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)

  const {
    hasBackButton,
    data: { word },
  } = dictionaryTab

  const dispatch = useDispatch()
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const [dictionnaireItem, setDictionnaireItem] = useState<any>(null)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const addHistory = useSetAtom(historyAtom)

  const tags = useSelector(
    // @ts-ignore
    (state: RootState) => state.user.bible.words[word]?.tags,
    shallowEqual
  )

  const setTitle = (title: string) =>
    setDictionaryTab(
      // @ts-ignore
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

      addHistory({
        word,
        type: 'word',
        date: Date.now(),
      })
    })
  }, [word])

  const openLink = ({ href, content, type }: any) => {
    if (type === 'verse') {
      try {
        const sanitizedHref = href.replace(String.fromCharCode(160), ' ')
        const book = books.find(b => sanitizedHref.includes(b.Nom))
        const splittedHref = sanitizedHref
          .replace(String.fromCharCode(160), ' ')
          .split(/\b\s+(?!$)/)
        const [chapter, verse] = splittedHref[splittedHref.length - 1].split('.')
        navigation.navigate('BibleView', {
          isReadOnly: true,
          book,
          chapter: parseInt(chapter, 10),
          verse: parseInt(verse, 10),
        })
      } catch (e) {
        Snackbar.show('Impossible de charger ce mot.')
      }
    } else {
      navigation.dispatch(StackActions.push('DictionnaryDetail', { word: href }))
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink })

  const shareDefinition = async () => {
    try {
      // @ts-ignore
      const message = `${word} \n\n${truncHTML(dictionnaireItem.definition, 4000)
        .text.replace(/&#/g, '\\')
        .replace(/\\x([0-9A-F]+);/gi, function () {
          // @ts-ignore
          return String.fromCharCode(parseInt(arguments[1], 16))
        })} \n\nLa suite sur https://bible-strong.app`
      await timeout(400)
      Share.share({ message })
    } catch (e) {
      Snackbar.show('Erreur lors du partage.')
      console.log(e)
    }
  }

  return (
    <Container>
      <DetailedHeader
        hasBackButton={hasBackButton}
        title={word}
        borderColor="secondary"
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() =>
                    setMultipleTagsItem({
                      id: word,
                      title: word,
                      entity: 'words',
                    })
                  }
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="tag" size={15} />
                    <Text marginLeft={10}>{t('Étiquettes')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={shareDefinition}>
                  <Box row alignItems="center">
                    <FeatherIcon name="share-2" size={15} />
                    <Text marginLeft={10}>{t('Partager')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `dictionary-${Date.now()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'dictionary',
                      data: {
                        word,
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
      {tags && (
        <Box mt={10} px={20}>
          {/* @ts-ignore */}
          <TagList tags={tags} limit={undefined} />
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
          <WebView {...webviewProps(dictionnaireItem.definition.replace(/\n/gi, ''))} />
        )}
      </Box>
    </Container>
  )
}

export default waitForDictionnaireDB()(DictionnaryDetailScreen)
