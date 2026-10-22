import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { naveContext } from '~features/study-assistant/resourceContext'
import { goBackOrHome } from '~navigation/goBackOrHome'
import React, { useCallback, useEffect, useEffectEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import NaveIcon from '~common/NaveIcon'
import { toast } from '~helpers/toast'
import EntityChipList from '~common/EntityChipList'
import Box, { HStack, VStack } from '~common/ui/Box'
import IconTile from '~common/ui/IconTile'
import Text from '~common/ui/Text'
import { STUDY_COLUMN_MAX_WIDTH, StudySection } from '~common/ui/StudySection'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import { resolveFontFamily } from '~themes/styleValues'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import {
  resourceShareMenuActions,
  runResourceShareAction,
  type ResourceShare,
} from '~features/share/resourceShare'
import { getPublicSiteUrl } from '~helpers/publicSiteLinks'
import { buildPublicNavePath } from './publicNaveRoutes'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { type HTMLViewLinkPayload } from '~common/htmlContentTypes'
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
import { localQueryOptions } from '~helpers/queryOptions'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
interface NaveDetailScreenProps {
  naveAtom: PrimitiveAtom<NaveTab>
  isFormSheet?: boolean
}

const NaveDetailScreen = ({ naveAtom, isFormSheet = false }: NaveDetailScreenProps) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const [naveTab, setNaveTab] = useAtom(naveAtom)
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : !isInTab

  const {
    data: { name_lower, name },
  } = naveTab

  const addHistory = useSetAtom(historyAtom)
  const preferredNaveLanguage = useAtomValue(resourcesLanguageAtom).NAVE
  const routeParams = useLocalSearchParams<{ language?: string }>()
  const requestedLanguage = isInTab ? naveTab.data.language : routeParams.language
  const naveResourceLanguage =
    requestedLanguage === 'fr' || requestedLanguage === 'en'
      ? requestedLanguage
      : preferredNaveLanguage

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
      goBackOrHome(router)
    }
  }, [isInTab, setNaveTab, router])

  const naveAvailabilityQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.offlineDatabaseAvailability('NAVE', naveResourceLanguage),
      isConnected,
    ],
    queryFn: () =>
      resources.nave.getAvailability?.(naveResourceLanguage) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const naveQuery = useQuery({
    queryKey: ['nave-detail', naveResourceLanguage, name_lower, isConnected],
    queryFn: async () =>
      name_lower
        ? ((await resources.nave.loadItem(name_lower, naveResourceLanguage)) ?? null)
        : null,
    enabled: !!name_lower,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const naveItem = naveQuery.data ?? null
  useAssistantResourceContext(
    isInTab ? `tab:${naveTab.id}` : 'panel',
    naveContext({
      name: naveItem?.name || name,
      name_lower: naveItem?.normalizedName || name_lower,
      language: naveResourceLanguage,
    })
  )
  const { t } = useTranslation()
  const stylingTheme = useStylingTheme()
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

  const setTitle = useEffectEvent((title: string) =>
    setNaveTab(
      produce(draft => {
        draft.title = title
      })
    )
  )

  useEffect(() => {
    setTitle(naveItem?.name || name || '')
  }, [naveItem?.name, name])

  useEffect(() => {
    if (!naveItem) return
    addHistory({
      name: naveItem.name,
      name_lower: naveItem.normalizedName,
      type: 'nave',
      date: Date.now(),
    })
  }, [addHistory, naveItem])

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
          language: naveResourceLanguage,
          name_lower: item,
          name: item,
        },
      })
    }
  }

  const share: ResourceShare | undefined = naveItem
    ? {
        url: getPublicSiteUrl(() =>
          buildPublicNavePath({ language: naveResourceLanguage, topic: naveItem.normalizedName })
        ),
        title: naveItem.name || name,
        text: () =>
          `${naveItem.name || name}\n\n${truncHTML(naveItem.description, 4000)
            .text.replace(/&#/g, '\\')
            .replace(/\\x([0-9A-F]+);/gi, (_, hex: string) => {
              return String.fromCharCode(parseInt(hex, 16))
            })}`,
      }
    : undefined

  // Guard: name_lower should always be defined when this screen is rendered
  // (NaveTabScreen only renders this when name_lower is defined)
  if (!name_lower) {
    return null
  }

  if (naveAvailabilityQuery.data?.status === 'unavailable') {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
        title={t('resource.nave.offlineCopyNeeded')}
        offlineTitle={t('resource.nave.temporarilyUnavailable')}
        fileSize={7}
        failure={resourceFailureFromAvailability(naveAvailabilityQuery.data)}
        onRetry={() => {
          void naveAvailabilityQuery.refetch()
          void naveQuery.refetch()
        }}
      />
    )
  }

  // A form sheet has no container of its own: the box inside carries the ground there.
  const screen = (content: React.ReactNode) => (
    <FormSheetScreen className="bg-canvas" isFormSheet={isFormSheet}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">{content}</Box>
    </FormSheetScreen>
  )
  const backHeader = (
    <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title={t('Thématique Nave')} />
  )

  if (naveQuery.isPending) {
    return screen(
      <>
        {backHeader}
        <Loading message={t('Chargement...')} />
      </>
    )
  }

  if (naveAvailabilityQuery.isError || naveQuery.isError) {
    return screen(
      <>
        {backHeader}
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: naveResourceLanguage }}
          title={t('resource.nave.temporarilyUnavailable')}
          fileSize={7}
          failure={resourceFailureFromAccessError(naveQuery.error ?? naveAvailabilityQuery.error)}
          onRetry={() => {
            void naveAvailabilityQuery.refetch()
            void naveQuery.refetch()
          }}
        />
      </>
    )
  }

  if (!naveItem) {
    return screen(
      <>
        {backHeader}
        <Empty
          icon={require('~assets/images/empty-state-icons/inbox.svg')}
          message={t('Impossible de charger la nave...')}
        />
      </>
    )
  }

  const naveUniverse = resolveUniverseColors(stylingTheme.colors, 'nave')

  return screen(
    <>
      <Header
        hasBackButton={hasBackButton}
        title={t('Thématique Nave')}
        rightComponent={
          <MenuView
            tabActions
            actions={
              [
                { id: 'tags', title: t('Étiquettes'), image: 'tag' },
                ...resourceShareMenuActions(t, share),
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
              if (runResourceShareAction(nativeEvent.event, share)) return
              switch (nativeEvent.event) {
                case 'tags':
                  setUnifiedTagsModal({
                    mode: 'select',
                    id: naveItem.normalizedName,
                    title: naveItem.name,
                    entity: 'naves',
                  })
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
                      language: naveResourceLanguage,
                      name: name || naveItem.name,
                      name_lower,
                    },
                  })
                  break
              }
            }}
          >
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        }
      />
      <ScrollView
        backgroundColor="canvas"
        contentContainerStyle={{ maxWidth: STUDY_COLUMN_MAX_WIDTH + 40, paddingHorizontal: 20 }}
      >
        <VStack className="gap-[10px] pt-[2px] pb-[4px]">
          {(tags || relationCount > 0) && (
            <EntityChipList
              tags={tags}
              relationCount={relationCount}
              onRelationPress={() => naveEndpoint && openEntityRelations(naveEndpoint)}
            />
          )}
          <HStack className="items-center gap-[10px]">
            <IconTile bg={naveUniverse.background}>
              <NaveIcon size={18} color={naveUniverse.foreground} />
            </IconTile>
            <Text className="text-[15px] text-grey">{t('nave.topic.kind')}</Text>
          </HStack>
          <Text
            className="text-[34px] leading-[42px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {naveItem.name || name}
          </Text>
        </VStack>
        {naveItem.description ? (
          <StudySection title={t('Références')}>
            <SwitchableHTMLView
              selectable
              previewSource={{ kind: 'nave', language: naveResourceLanguage }}
              value={naveItem.description}
              onLinkClicked={openLink}
            />
          </StudySection>
        ) : null}
      </ScrollView>
    </>
  )
}

export default NaveDetailScreen
