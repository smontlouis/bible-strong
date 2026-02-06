import React, { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { WebView } from 'react-native-webview'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { useRouter } from 'expo-router'
import produce from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import DetailedHeader from '~common/DetailedHeader'
import Header from '~common/Header'
import Loading from '~common/Loading'
import PopOverMenu from '~common/PopOverMenu'
import { toast } from '~helpers/toast'
import TagList from '~common/TagList'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import waitForNaveDB from '~common/waitForNaveDB'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import loadNaveItem from '~helpers/loadNaveItem'
import useHTMLView from '~helpers/useHTMLView'
import { RootState } from '~redux/modules/reducer'
import { makeNaveTagsSelector } from '~redux/selectors/bible'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import { NaveTab } from '../../state/tabs'

interface NaveDetailScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveDetailScreen = ({ naveAtom }: NaveDetailScreenProps) => {
  const router = useRouter()
  const [naveTab, setNaveTab] = useAtom(naveAtom)
  const { isInTab } = useTabContext()

  const {
    hasBackButton,
    data: { name_lower, name },
  } = naveTab

  const addHistory = useSetAtom(historyAtom)

  // Go back to list view (for tab context)
  const goBack = useCallback(() => {
    if (isInTab) {
      setNaveTab(
        produce(draft => {
          draft.title = 'Thèmes Nave'
          draft.data = {}
        })
      )
    } else {
      router.back()
    }
  }, [isInTab, setNaveTab, router])

  const [naveItem, setNaveItem] = useState<any>(null)
  const { t } = useTranslation()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const selectNaveTags = makeNaveTagsSelector()
  const tags = useSelector((state: RootState) => selectNaveTags(state, name_lower ?? ''))
  const openInNewTab = useOpenInNewTab()

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
    if (!name_lower) return
    loadNaveItem(name_lower).then(result => {
      setNaveItem(result)
      addHistory({
        name: result.name,
        name_lower: result.name_lower,
        type: 'nave',
        date: Date.now(),
      })
    })
  }, [name, name_lower])

  const openLink = ({ href }: any) => {
    const [type, item] = href.split('=')

    if (type === 'v') {
      try {
        const [book, chapter, verses] = item.split('-')
        const [verse] = verses ? verses.split(',') : []
        router.push({
          pathname: '/bible-view',
          params: {
            isReadOnly: 'true',
            book: String(book),
            chapter: String(chapter),
            verse: String(verse),
            focusVerses: JSON.stringify(verses?.split(',').map(Number)),
          },
        })
      } catch (e) {
        console.log('[Nave] Error loading verse:', e)
        toast.error('Impossible de charger ce verset.')
      }
    }

    if (type === 'w') {
      if (isInTab) {
        // In tab context, update the tab data instead of navigating
        setNaveTab(
          produce(draft => {
            draft.data.name_lower = item
            draft.data.name = item
          })
        )
      } else {
        router.push({
          pathname: '/nave-detail',
          params: {
            name_lower: item,
            name: item,
          },
        })
      }
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink })

  const shareDefinition = async () => {
    try {
      const message = `${name} \n\n${truncHTML(naveItem.description, 4000)
        .text.replace(/&#/g, '\\')
        // @ts-ignore
        .replace(/\\x([0-9A-F]+);/gi, function () {
          return String.fromCharCode(parseInt(arguments[1], 16))
        })} \n\nLa suite sur https://bible-strong.app`
      Share.share({ message })
    } catch (e) {
      toast.error('Erreur lors du partage.')
      console.log('[Nave] Share error:', e)
    }
  }

  // Guard: name_lower should always be defined when this screen is rendered
  // (NaveTabScreen only renders this when name_lower is defined)
  if (!name_lower) {
    return null
  }

  if (!naveItem) {
    return (
      <Container>
        <Header hasBackButton={!isInTab} onCustomBackPress={goBack} title="Thèmes Nave" />
        <Loading message={t('Chargement...')} />
      </Container>
    )
  }

  return (
    <Container>
      <DetailedHeader
        hasBackButton={!isInTab}
        title={naveItem?.name || name}
        subtitle={naveItem?.name_lower}
        borderColor="quint"
        rightComponent={
          <PopOverMenu
            popover={
              <>
                <MenuOption
                  onSelect={() =>
                    setUnifiedTagsModal({
                      mode: 'select',
                      id: naveItem.name_lower,
                      title: naveItem.name,
                      entity: 'naves',
                    })
                  }
                >
                  <Box row alignItems="center">
                    <FeatherIcon name="tag" size={15} />
                    <Text marginLeft={10}>{t('Étiquettes')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption onSelect={shareDefinition} closeBeforeSelect>
                  <Box row alignItems="center">
                    <FeatherIcon name="share-2" size={15} />
                    <Text marginLeft={10}>{t('Partager')}</Text>
                  </Box>
                </MenuOption>
                <MenuOption
                  onSelect={() => {
                    openInNewTab({
                      id: `nave-${generateUUID()}`,
                      title: t('tabs.new'),
                      isRemovable: true,
                      type: 'nave',
                      data: {
                        name,
                        name_lower,
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
          // @ts-ignore
          <WebView {...webviewProps(naveItem.description)} />
        )}
      </Box>
    </Container>
  )
}

export default waitForNaveDB()(NaveDetailScreen)
