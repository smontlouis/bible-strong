import React, { useCallback, useEffect, useState } from 'react'
import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { Share } from 'react-native'
import { WebView } from 'react-native-webview'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { toast } from '~helpers/toast'
import EntityChipList from '~common/EntityChipList'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
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
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { createNaveEndpoint } from '~features/studyRelations/endpoints'
import type { RelationEndpoint } from '~redux/modules/user'
import ScrollView from '~common/ui/ScrollView'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

interface NaveDetailScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
  isFormSheet?: boolean
}

const NaveDetailScreen = ({ naveAtom, isFormSheet = false }: NaveDetailScreenProps) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const [naveTab, setNaveTab] = useAtom(naveAtom)
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : !isInTab

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
  const openEntityRelations = useOpenEntityRelations()
  const naveEndpoint: Extract<RelationEndpoint, { type: 'nave' }> | null =
    name_lower && naveItem
      ? createNaveEndpoint({
          nameLower: name_lower,
          labelFallback: naveItem.name || name || name_lower,
        })
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
        pushRouteOnce({
          pathname: '/bible-view',
          params: {
            contextDisplayMode: 'focused',
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
      pushRouteOnce({
        pathname: '/nave-detail',
        params: {
          name_lower: item,
          name: item,
        },
      })
    }
  }

  const { webviewProps } = useHTMLView({ onLinkClicked: openLink, autoHeight: true })

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
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title="Thèmes Nave" />
        <Loading message={t('Chargement...')} />
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={naveItem.name || name || ''}
        subTitle={naveItem?.name_lower}
        rightComponent={
          <MenuView
            actions={
              [
                { id: 'tags', title: t('Étiquettes'), image: 'tag' },
                { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
                naveEndpoint
                  ? {
                      id: 'relations',
                      title: t('Éditer les relations'),
                      image: 'arrow.triangle.merge',
                    }
                  : null,
                {
                  id: 'open-tab',
                  title: t('tab.openInNewTab'),
                  image: 'arrow.up.forward.square',
                },
              ].filter(Boolean) as MenuAction[]
            }
            onPressAction={({ nativeEvent }) => {
              switch (nativeEvent.event) {
                case 'tags':
                  setUnifiedTagsModal({
                    mode: 'select',
                    id: naveItem.name_lower,
                    title: naveItem.name,
                    entity: 'naves',
                  })
                  break
                case 'share':
                  shareDefinition()
                  break
                case 'relations':
                  if (naveEndpoint) openEntityRelations(naveEndpoint)
                  break
                case 'open-tab':
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
                  break
              }
            }}
          >
            <Box row center height={60} width={60}>
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        }
      />
      <ScrollView>
        {(tags || relationCount > 0) && (
          <Box mt={0} px={20}>
            <EntityChipList
              tags={tags}
              relationCount={relationCount}
              onRelationPress={() => naveEndpoint && openEntityRelations(naveEndpoint)}
            />
          </Box>
        )}
        {naveItem?.description && <WebView {...webviewProps(naveItem.description)} />}
      </ScrollView>
    </FormSheetScreen>
  )
}

export default waitForNaveDB()(NaveDetailScreen)
