import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { Share } from 'react-native'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'

import { WebView } from 'react-native-webview'
import books from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import useHTMLView, { type HTMLViewLinkPayload } from '~helpers/useHTMLView'

import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import EntityChipList from '~common/EntityChipList'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getDefaultDictionaryWork } from '~features/resources/dictionaryAccess'
import { RootState } from '~redux/modules/reducer'
import { makeWordTagsSelector } from '~redux/selectors/bible'
import { historyAtom, unifiedTagsModalAtom } from '../../state/app'
import { DictionaryTab } from '../../state/tabs'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { createDictionaryEndpoint } from '~features/studyRelations/endpoints'
import type { RelationEndpoint } from '~redux/modules/user'
import AppScrollView from '~common/ui/ScrollView'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import {
  resourceFailureFromAccessError,
  resourceFailureFromAvailability,
} from '~features/resources/resourceFailure'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'

interface DictionaryDetailScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
  isFormSheet?: boolean
}

const DictionnaryDetailScreen = ({
  dictionaryAtom,
  isFormSheet = false,
}: DictionaryDetailScreenProps) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const [dictionaryTab, setDictionaryTab] = useAtom(dictionaryAtom)
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : !isInTab

  const {
    data: {
      word,
      entryId,
      correspondenceId,
      work: storedWork,
      resourceId,
      dictionaryTitle,
      language: storedLanguage,
    },
  } = dictionaryTab

  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const preferredDictionaryLanguage = useAtomValue(resourcesLanguageAtom).DICTIONNAIRE
  const dictionaryResourceLanguage = storedLanguage ?? preferredDictionaryLanguage
  const work = storedWork ?? getDefaultDictionaryWork(dictionaryResourceLanguage)
  const resolvedDictionaryTitle =
    dictionaryTitle ??
    (work === 'easton-webster'
      ? 'Easton’s Bible Dictionary & Webster’s 1828 Dictionary'
      : work === 'westphal'
        ? 'Dictionnaire encyclopédique de la Bible'
        : work)
  const offlineIdentity = resourceId
    ? ({
        kind: 'dictionary' as const,
        work,
        resourceId,
        language: dictionaryResourceLanguage,
      } as const)
    : ({
        kind: 'database' as const,
        databaseId: 'DICTIONNAIRE' as const,
        language: dictionaryResourceLanguage,
      } as const)
  const dictionaryAvailabilityQuery = useQuery({
    queryKey: ['dictionary-availability', work, dictionaryResourceLanguage, isConnected],
    queryFn: () =>
      resources.dictionary.getAvailability?.(dictionaryResourceLanguage, work) ??
      Promise.resolve({ status: 'available' as const }),
    networkMode: 'always',
    staleTime: Infinity,
  })
  const dictionaryQuery = useQuery({
    queryKey: ['dictionary-detail', work, dictionaryResourceLanguage, entryId, word],
    queryFn: async () =>
      word
        ? ((entryId
            ? await resources.dictionary.loadEntryById(
                entryId,
                dictionaryResourceLanguage,
                work
              )
            : await resources.dictionary.loadItem(word, dictionaryResourceLanguage, work)) ?? null)
        : null,
    enabled: !!word,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const dictionnaireItem = dictionaryQuery.data ?? null
  const correspondenceQuery = useQuery({
    queryKey: [
      'dictionary-correspondence',
      correspondenceId,
      word,
      preferredDictionaryLanguage,
      isConnected,
    ],
    queryFn: async () => {
      if (!word || !isConnected) return null
      const page = await resources.dictionary.searchDirectoryPage(
        word,
        { limit: 100 },
        preferredDictionaryLanguage
      )
      return (
        page.entries.find(item => item.correspondenceId === correspondenceId) ??
        page.entries.find(item =>
          item.sources.some(
            source =>
              source.resource.work === work &&
              source.resource.language === dictionaryResourceLanguage &&
              source.id === entryId
          )
        ) ??
        null
      )
    },
    enabled: !!word && isConnected,
    staleTime: Infinity,
    retry: false,
  })
  const correspondenceSources =
    correspondenceQuery.data?.sources.filter(
      source =>
        source.resource.work !== work ||
        source.resource.language !== dictionaryResourceLanguage ||
        source.id !== entryId
    ) ?? []
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const addHistory = useSetAtom(historyAtom)

  // Go back to list view (for tab context)
  const goBack = () => {
    if (isInTab) {
      setDictionaryTab(
        produce(draft => {
          draft.title = 'Dictionnaire'
          draft.data.word = undefined
        })
      )
    } else {
      router.back()
    }
  }

  const selectWordTags = makeWordTagsSelector()
  const tags = useSelector((state: RootState) => selectWordTags(state, word ?? ''))
  const openEntityRelations = useOpenEntityRelations()
  const dictionaryEndpoint: Extract<RelationEndpoint, { type: 'dictionary' }> | null = word
    ? createDictionaryEndpoint({ word, labelFallback: word })
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
    if (!word || !dictionnaireItem) return
    addHistory({
      word,
      type: 'word',
      date: Date.now(),
    })
  }, [addHistory, dictionnaireItem, word])

  const openLink = ({ href, type }: HTMLViewLinkPayload) => {
    if (href.startsWith('bible://')) {
      const route = getCommentaryBibleViewRoute(href.slice('bible://'.length))
      if (route) pushRouteOnce(route)
      else toast.error('Impossible de charger cette référence biblique.')
    } else if (type.includes('verse')) {
      try {
        const sanitizedHref = href.replace(String.fromCharCode(160), ' ')
        const book = books.find(b => sanitizedHref.includes(b.Nom))
        const splittedHref = sanitizedHref
          .replace(String.fromCharCode(160), ' ')
          .split(/\b\s+(?!$)/)
        const [chapter, verse] = splittedHref[splittedHref.length - 1].split('.')
        pushRouteOnce({
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
      pushRouteOnce({
        pathname: '/dictionnary-detail',
        params: {
          word: href,
          work,
          ...(resourceId ? { resourceId } : {}),
          dictionaryTitle: resolvedDictionaryTitle,
        },
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

  if (dictionaryAvailabilityQuery.data?.status === 'unavailable') {
    return (
      <ResourceUnavailableView
        identity={offlineIdentity}
        title={t('resource.dictionary.offlineCopyNeeded')}
        offlineTitle={t('resource.dictionary.temporarilyUnavailable')}
        fileSize={22}
        failure={resourceFailureFromAvailability(dictionaryAvailabilityQuery.data)}
        onRetry={() => {
          void dictionaryAvailabilityQuery.refetch()
          void dictionaryQuery.refetch()
        }}
      />
    )
  }

  if (dictionaryQuery.isPending) {
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

  if (dictionaryAvailabilityQuery.isError || dictionaryQuery.isError) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={goBack}
          title={t('Dictionnaire')}
        />
        <ResourceUnavailableView
          identity={offlineIdentity}
          title={t('resource.dictionary.temporarilyUnavailable')}
          fileSize={22}
          failure={resourceFailureFromAccessError(
            dictionaryQuery.error ?? dictionaryAvailabilityQuery.error
          )}
          onRetry={() => {
            void dictionaryAvailabilityQuery.refetch()
            void dictionaryQuery.refetch()
          }}
        />
      </FormSheetScreen>
    )
  }

  if (!dictionnaireItem) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={goBack}
          title={t('Dictionnaire')}
        />
        <Empty
          icon={require('~assets/images/empty-state-icons/inbox.svg')}
          message={t('Impossible de charger le dictionnaire...')}
        />
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        title={word}
        subTitle={resolvedDictionaryTitle}
        rightComponent={
          <MenuView
            actions={
              [
                { id: 'tags', title: t('Étiquettes'), image: 'tag' },
                { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
                dictionaryEndpoint
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
                    id: word,
                    title: word,
                    entity: 'words',
                  })
                  break
                case 'share':
                  shareDefinition()
                  break
                case 'relations':
                  if (dictionaryEndpoint) openEntityRelations(dictionaryEndpoint)
                  break
                case 'open-tab':
                  openInNewTab({
                    id: `dictionary-${generateUUID()}`,
                    title: t('tabs.new'),
                    isRemovable: true,
                    type: 'dictionary',
                    data: {
                      word,
                      entryId,
                      correspondenceId,
                      work,
                      resourceId,
                      dictionaryTitle: resolvedDictionaryTitle,
                      language: dictionaryResourceLanguage,
                      directory: dictionaryTab.data.directory,
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
      <AppScrollView>
        {correspondenceSources.length > 0 && (
          <Box px={20} pb={8} wrap row>
            {correspondenceSources.map(source => (
              <TouchableBox
                key={`${source.resource.work}:${source.resource.language}:${source.id}`}
                onPress={() =>
                  setDictionaryTab(current => ({
                    ...current,
                    title: source.word,
                    data: {
                      ...current.data,
                      word: source.word,
                      entryId: source.id,
                      correspondenceId: correspondenceQuery.data?.correspondenceId,
                      work: source.resource.work,
                      resourceId: source.resourceId,
                      dictionaryTitle: source.title,
                      language: source.resource.language,
                      directory: true,
                    },
                  }))
                }
                borderWidth={1}
                borderColor="border"
                borderRadius={14}
                px={8}
                py={4}
                mr={6}
                mb={6}
              >
                <Text fontSize={12} color="primary">
                  {source.abbreviation} · {source.word}
                </Text>
              </TouchableBox>
            ))}
          </Box>
        )}
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

export default DictionnaryDetailScreen
