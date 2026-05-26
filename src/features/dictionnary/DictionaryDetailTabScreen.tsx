import React, { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { WebView } from 'react-native-webview'
import books from '~assets/bible_versions/books-desc'
import { ActionMenuOption } from '~common/ActionMenu'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import Header from '~common/Header'
import Loading from '~common/Loading'
import useHTMLView, { type HTMLViewLinkPayload } from '~helpers/useHTMLView'

import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import PopOverMenu from '~common/PopOverMenu'
import { toast } from '~helpers/toast'
import EntityChipList from '~common/EntityChipList'
import waitForDictionnaireDB from '~common/waitForDictionnaireDB'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import loadDictionnaireItem, { type DictionaryItem } from '~helpers/loadDictionnaireItem'
import { RootState } from '~redux/modules/reducer'
import { makeWordTagsSelector } from '~redux/selectors/bible'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import { DictionaryTab } from '../../state/tabs'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import type { RelationEndpoint } from '~redux/modules/user'
import AppScrollView from '~common/ui/ScrollView'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

interface DictionaryDetailScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
  isFormSheet?: boolean
}

const DictionnaryDetailScreen = ({
  dictionaryAtom,
  isFormSheet = false,
}: DictionaryDetailScreenProps) => {
  const router = useRouter()
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : !isInTab

  const {
    data: { word },
  } = dictionaryTab

  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const [dictionnaireItem, setDictionnaireItem] = useState<DictionaryItem | null>(null)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
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

  const selectWordTags = makeWordTagsSelector()
  const tags = useSelector((state: RootState) => selectWordTags(state, word ?? ''))
  const openEntityRelations = useOpenEntityRelations()
  const dictionaryEndpoint: Extract<RelationEndpoint, { type: 'dictionary' }> | null = word
    ? {
        type: 'dictionary',
        word,
        label: word,
      }
    : null
  const relationCount = useRelationCount(dictionaryEndpoint)

  const setTitle = (title: string) =>
    setDictionaryTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    if (word) {
      setTitle(word)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word])

  const openLink = ({ href, type }: HTMLViewLinkPayload) => {
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
            contextDisplayMode: 'focused',
            book: JSON.stringify(book),
            chapter: String(parseInt(chapter, 10)),
            verse: String(parseInt(verse, 10)),
          },
        })
      } catch {
        toast.error('Impossible de charger ce mot.')
      }
    } else {
      router.push({
        pathname: '/dictionnary-detail',
        params: { word: href },
      })
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink, autoHeight: true })

  const shareDefinition = async () => {
    if (!dictionnaireItem) return

    try {
      const message = `${word} \n\n${truncHTML(dictionnaireItem.definition, 4000)
        .text.replace(/&#/g, '\\')
        .replace(/\\x([0-9A-F]+);/gi, (_, hex: string) => {
          return String.fromCharCode(parseInt(hex, 16))
        })} \n\nLa suite sur https://bible-strong.app`
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
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={goBack}
          title={t('Dictionnaire')}
        />
        <Loading message={t('Chargement...')} />
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={word}
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <ActionMenuOption
                  icon="tag"
                  label={t('Étiquettes')}
                  onSelect={() =>
                    setUnifiedTagsModal({
                      mode: 'select',
                      id: word,
                      title: word,
                      entity: 'words',
                    })
                  }
                />
                <ActionMenuOption
                  icon="share-2"
                  label={t('Partager')}
                  onSelect={shareDefinition}
                  closeBeforeSelect
                />
                <ActionMenuOption
                  icon="git-merge"
                  label={t('Éditer les relations')}
                  onSelect={() => dictionaryEndpoint && openEntityRelations(dictionaryEndpoint)}
                />
                <ActionMenuOption
                  icon="external-link"
                  label={t('tab.openInNewTab')}
                  onSelect={() => {
                    openInNewTab({
                      id: `dictionary-${generateUUID()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'dictionary',
                      data: {
                        word,
                      },
                    })
                  }}
                />
              </>
            }
          />
        }
      />
      <AppScrollView>
        {(tags || relationCount > 0) && (
          <Box px={20}>
            <EntityChipList
              tags={tags}
              relationCount={relationCount}
              onRelationPress={() => dictionaryEndpoint && openEntityRelations(dictionaryEndpoint)}
            />
          </Box>
        )}
        {dictionnaireItem?.definition && (
          <WebView {...webviewProps(dictionnaireItem.definition.replace(/\n/gi, ''))} />
        )}
      </AppScrollView>
    </FormSheetScreen>
  )
}

export default waitForDictionnaireDB()(DictionnaryDetailScreen)
