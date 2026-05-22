import React, { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { WebView } from 'react-native-webview'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import DetailedHeader from '~common/DetailedHeader'
import Header from '~common/Header'
import Loading from '~common/Loading'
import PopOverMenu from '~common/PopOverMenu'
import { toast } from '~helpers/toast'
import EntityChipList from '~common/EntityChipList'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import waitForNaveDB from '~common/waitForNaveDB'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import loadNaveItem, { type NaveItemRow } from '~helpers/loadNaveItem'
import useHTMLView, { type HTMLViewLinkPayload } from '~helpers/useHTMLView'
import { RootState } from '~redux/modules/reducer'
import { makeNaveTagsSelector } from '~redux/selectors/bible'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import { NaveTab } from '../../state/tabs'
import EntityRelationsModal from '~features/studyRelations/EntityRelationsModal'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import type { RelationEndpoint } from '~redux/modules/user'

interface NaveDetailScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
}

const NaveDetailScreen = ({ naveAtom }: NaveDetailScreenProps) => {
  const router = useRouter()
  const [naveTab, setNaveTab] = useAtom(naveAtom)
  const { isInTab } = useTabContext()

  const {
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

  const [naveItem, setNaveItem] = useState<NaveItemRow | null>(null)
  const { t } = useTranslation()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const selectNaveTags = makeNaveTagsSelector()
  const tags = useSelector((state: RootState) => selectNaveTags(state, name_lower ?? ''))
  const openInNewTab = useOpenInNewTab()
  const relationListModal = useBottomSheetModal()
  const naveEndpoint: Extract<RelationEndpoint, { type: 'nave' }> | null =
    name_lower && naveItem
      ? {
          type: 'nave',
          nameLower: name_lower,
          label: naveItem.name || name || name_lower,
        }
      : null
  const relationCount = useRelationCount(naveEndpoint)

  const setTitle = (title: string) =>
    setNaveTab(
      produce(draft => {
        draft.title = title
      })
    )

  useEffect(() => {
    setTitle(naveItem?.name || name || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naveItem?.name, name])

  useEffect(() => {
    if (!name_lower) return
    loadNaveItem(name_lower).then(result => {
      if (!result || 'error' in result) return
      setNaveItem(result)
      addHistory({
        name: result.name,
        name_lower: result.name_lower,
        type: 'nave',
        date: Date.now(),
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, name_lower])

  const openLink = ({ href }: HTMLViewLinkPayload) => {
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
    if (!naveItem) return

    try {
      const message = `${name} \n\n${truncHTML(naveItem.description, 4000)
        .text.replace(/&#/g, '\\')
        .replace(/\\x([0-9A-F]+);/gi, (_, hex: string) => {
          return String.fromCharCode(parseInt(hex, 16))
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
        title={naveItem.name || name || ''}
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
                <MenuOption onSelect={() => relationListModal.open()}>
                  <Box row alignItems="center">
                    <FeatherIcon name="git-merge" size={15} />
                    <Text marginLeft={10}>{t('Éditer les relations')}</Text>
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
                        name: name || naveItem.name,
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
      {(tags || relationCount > 0) && (
        <Box mt={10} px={20}>
          <EntityChipList
            tags={tags}
            relationCount={relationCount}
            onRelationPress={() => relationListModal.open()}
          />
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
        {naveItem?.description && <WebView {...webviewProps(naveItem.description)} />}
      </Box>
      <EntityRelationsModal ref={relationListModal.getRef()} endpoint={naveEndpoint} />
    </Container>
  )
}

export default waitForNaveDB()(NaveDetailScreen)
