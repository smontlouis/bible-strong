import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { WebView } from 'react-native-webview'
import books from '~assets/bible_versions/books-desc'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Text from '~common/ui/Text'
import useHTMLView from '~helpers/useHTMLView'

import { useRouter } from 'expo-router'
import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import DetailedHeader from '~common/DetailedHeader'
import PopOverMenu from '~common/PopOverMenu'
import { toast } from 'sonner-native'
import TagList from '~common/TagList'
import MenuOption from '~common/ui/MenuOption'
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import loadDictionnaireItem from '~helpers/loadDictionnaireItem'
import { timeout } from '~helpers/timeout'
import { RootState } from '~redux/modules/reducer'
import { makeWordTagsSelector } from '~redux/selectors/bible'
import { historyAtom, multipleTagsModalAtom } from '../../state/app'
import { DictionaryTab } from '../../state/tabs'

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface DictionaryDetailScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
}

const DictionnaryDetailScreen = ({ dictionaryAtom }: DictionaryDetailScreenProps) => {
  const router = useRouter()
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)
  const { isInTab } = useTabContext()

  const {
    hasBackButton,
    data: { word },
  } = dictionaryTab

  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const [dictionnaireItem, setDictionnaireItem] = useState<any>(null)
  const setMultipleTagsItem = useSetAtom(multipleTagsModalAtom)
  const addHistory = useSetAtom(historyAtom)

  // Go back to list view (for tab context)
  const goBack = useCallback(() => {
    if (isInTab) {
      setDictionaryTab(
        produce(draft => {
          draft.title = 'Dictionnaire'
          draft.data = {}
        })
      )
    } else {
      router.back()
    }
  }, [isInTab, setDictionaryTab, router])

  const selectWordTags = useMemo(() => makeWordTagsSelector(), [])
  const tags = useSelector((state: RootState) => selectWordTags(state, word ?? ''))

  const setTitle = (title: string) =>
    setDictionaryTab(
      // @ts-ignore
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    if (word) {
      setTitle(word)
    }
  }, [word])

  useEffect(() => {
    if (!word) return
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
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: JSON.stringify(book),
            chapter: String(parseInt(chapter, 10)),
            verse: String(parseInt(verse, 10)),
          },
        })
      } catch (e) {
        toast.error('Impossible de charger ce mot.')
      }
    } else {
      if (isInTab) {
        // In tab context, update the tab data instead of navigating
        setDictionaryTab(
          produce(draft => {
            draft.data.word = href
          })
        )
      } else {
        router.push({
          pathname: '/dictionnary-detail',
          params: { word: href },
        })
      }
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
      toast.error('Erreur lors du partage.')
      console.log('[Dictionary] Share error:', e)
    }
  }

  // Guard: word should always be defined when this screen is rendered
  // (DictionaryTabScreen only renders this when word is defined)
  if (!word) {
    return null
  }

  if (!dictionnaireItem) {
    return (
      <Container>
        <Header hasBackButton={!isInTab} onCustomBackPress={goBack} title={t('Dictionnaire')} />
        <Loading message={t('Chargement...')} />
      </Container>
    )
  }

  return (
    <Container>
      <DetailedHeader
        hasBackButton={!isInTab}
        onCustomBackPress={goBack}
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
