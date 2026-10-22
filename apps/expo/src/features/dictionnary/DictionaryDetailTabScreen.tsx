import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import { dictionaryContext } from '~features/study-assistant/resourceContext'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import { goBackOrHome } from '~navigation/goBackOrHome'
import { twMerge } from '~common/ui/classNames'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React, { useEffect, useEffectEvent, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { useSelector } from 'react-redux'
import truncHTML from 'trunc-html'
import books from '~assets/bible_versions/books-desc'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import IconTile from '~common/ui/IconTile'
import { STUDY_COLUMN_MAX_WIDTH, StudySection } from '~common/ui/StudySection'
import DictionnaryIcon from '~common/DictionnaryIcon'
import { resolveUniverseColors } from '~themes/universeColors'
import { resolveFontFamily } from '~themes/styleValues'
import Text from '~common/ui/Text'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Empty from '~common/Empty'
import { type HTMLViewLinkPayload } from '~common/htmlContentTypes'
import { useRouter } from 'expo-router'
import { produce } from 'immer'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'
import EntityChipList from '~common/EntityChipList'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import {
  resourceShareMenuActions,
  runResourceShareAction,
  type ResourceShare,
} from '~features/share/resourceShare'
import { getPublicSiteUrl } from '~helpers/publicSiteLinks'
import { buildPublicDictionaryPath } from './publicDictionaryRoutes'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  getDefaultDictionaryWork,
  type DictionaryEntry,
} from '~features/resources/dictionaryAccess'
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
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { findDirectoryItemForArticle } from './dictionaryExperience'
import { createDictionaryInternalLinkRoute } from './dictionaryInternalNavigation'
interface DictionaryDetailScreenProps {
  dictionaryAtom: PrimitiveAtom<DictionaryTab>
  isFormSheet?: boolean
  onEntryResolved?: (
    entry: DictionaryEntry,
    context: { work: string; language: 'fr' | 'en' }
  ) => void
}

/** Dictionary words and sources are stored in lower case: the page sets them as names. */
const capitalizeFirst = (value = '') => value.charAt(0).toLocaleUpperCase() + value.slice(1)

const DictionnaryDetailScreen = ({
  dictionaryAtom,
  isFormSheet = false,
  onEntryResolved,
}: DictionaryDetailScreenProps) => {
  const stylingTheme = useStylingTheme()

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
      entryId || word
        ? ((entryId
            ? await resources.dictionary.loadEntryById(entryId, dictionaryResourceLanguage, work)
            : await resources.dictionary.loadItem(word!, dictionaryResourceLanguage, work)) ?? null)
        : null,
    enabled: entryId !== undefined || !!word,
    staleTime: Infinity,
    ...localQueryOptions,
  })
  const dictionnaireItem = dictionaryQuery.data ?? null
  const resolvedEntryRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (dictionnaireItem) {
      const identity = `${dictionaryResourceLanguage}:${work}:${dictionnaireItem.id ?? ''}:${dictionnaireItem.word}`
      if (resolvedEntryRef.current !== identity) {
        resolvedEntryRef.current = identity
        onEntryResolved?.(dictionnaireItem, {
          work,
          language: dictionaryResourceLanguage,
        })
      }
    }
  }, [dictionnaireItem, dictionaryResourceLanguage, onEntryResolved, work])
  useAssistantResourceContext(
    isInTab ? `tab:${dictionaryTab.id}` : 'panel',
    dictionaryContext({
      word,
      work,
      dictionaryTitle: resolvedDictionaryTitle,
      entryId,
      language: dictionaryResourceLanguage,
    })
  )
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
        findDirectoryItemForArticle(page.entries, {
          correspondenceId,
          work,
          language: dictionaryResourceLanguage,
          entryId,
          word,
        }) ?? null
      )
    },
    enabled: !!word && isConnected,
    placeholderData: previousData => previousData,
    staleTime: Infinity,
    retry: false,
  })
  const normalizedCurrentWord = word?.trim().toLocaleLowerCase() ?? ''
  const correspondenceSources = correspondenceQuery.data?.sources ?? []
  const isCurrentSource = (source: (typeof correspondenceSources)[number]) =>
    source.resource.work === work &&
    source.resource.language === dictionaryResourceLanguage &&
    (entryId !== undefined
      ? source.id === entryId
      : source.word.trim().toLocaleLowerCase() === normalizedCurrentWord)
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
      goBackOrHome(router)
    }
  }

  const selectWordTags = makeWordTagsSelector()
  const tags = useSelector((state: RootState) => selectWordTags(state, word ?? ''))
  const openEntityRelations = useOpenEntityRelations()
  const dictionaryEndpoint: Extract<RelationEndpoint, { type: 'dictionary' }> | null = word
    ? createDictionaryEndpoint({ word, labelFallback: word })
    : null
  const relationCount = useRelationCount(dictionaryEndpoint)

  const setTitle = useEffectEvent((title: string) =>
    setDictionaryTab(
      produce(draft => {
        draft.title = title
      })
    )
  )

  useEffect(() => {
    if (word) {
      setTitle(word)
    }
  }, [word])

  useEffect(() => {
    if (!word || !dictionnaireItem) return
    addHistory({
      word,
      entryId,
      correspondenceId,
      work,
      resourceId,
      dictionaryTitle: resolvedDictionaryTitle,
      language: dictionaryResourceLanguage,
      type: 'word',
      date: Date.now(),
    })
  }, [
    addHistory,
    correspondenceId,
    dictionaryResourceLanguage,
    dictionnaireItem,
    entryId,
    resourceId,
    resolvedDictionaryTitle,
    word,
    work,
  ])

  const openLink = ({ href, type }: HTMLViewLinkPayload) => {
    if (href.startsWith('bible://')) {
      const route = getCommentaryBibleViewRoute(href.slice('bible://'.length))
      if (route) pushRouteOnce(route)
      else toast.error('Impossible de charger cette référence biblique.')
    } else if (href.startsWith('strong://')) {
      const code = href.slice('strong://'.length).trim().toUpperCase()
      if (/^[HG]\d+[A-Z]?$/u.test(code)) {
        pushRouteOnce(
          createStrongDetailRoute('index', {
            book: code.startsWith('G') ? 40 : 1,
            identityKind: 'dstrong',
            identityCode: code,
            reference: code,
          })
        )
      } else {
        toast.error('Impossible de charger cette entrée Strong.')
      }
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
      pushRouteOnce(
        createDictionaryInternalLinkRoute(href, {
          work,
          resourceId,
          dictionaryTitle: resolvedDictionaryTitle,
          language: dictionaryResourceLanguage,
        })
      )
    }
  }

  const share: ResourceShare | undefined = dictionnaireItem
    ? {
        url: getPublicSiteUrl(() =>
          buildPublicDictionaryPath({
            language: dictionaryResourceLanguage,
            work,
            entryId: dictionnaireItem.id ?? 0,
            word: dictionnaireItem.word,
          })
        ),
        title: word,
        text: () =>
          `${word}\n\n${truncHTML(dictionnaireItem.definition, 4000)
            .text.replace(/&#/g, '\\')
            .replace(/\\x([0-9A-F]+);/gi, (_, hex: string) => {
              return String.fromCharCode(parseInt(hex, 16))
            })}`,
      }
    : undefined

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

  // A form sheet has no container of its own: the box inside carries the ground there.
  const screen = (content: React.ReactNode) => (
    <FormSheetScreen className="bg-canvas" isFormSheet={isFormSheet}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">{content}</Box>
    </FormSheetScreen>
  )

  if (dictionaryAvailabilityQuery.isError || dictionaryQuery.isError) {
    return screen(
      <>
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
      </>
    )
  }

  if (!dictionnaireItem && !dictionaryQuery.isPending) {
    return screen(
      <>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={goBack}
          title={t('Dictionnaire')}
        />
        <Empty
          icon={require('~assets/images/empty-state-icons/inbox.svg')}
          message={t('Impossible de charger le dictionnaire...')}
        />
      </>
    )
  }

  const dictionaryUniverse = resolveUniverseColors(stylingTheme.colors, 'dictionary')

  return screen(
    <>
      <Header
        hasBackButton={hasBackButton}
        title={t('Dictionnaire')}
        subTitle={capitalizeFirst(resolvedDictionaryTitle)}
        rightComponent={
          <MenuView
            tabActions
            actions={
              [
                { id: 'tags', title: t('Étiquettes'), image: 'tag' },
                ...resourceShareMenuActions(t, share),
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
              if (runResourceShareAction(nativeEvent.event, share)) return
              switch (nativeEvent.event) {
                case 'tags':
                  setUnifiedTagsModal({
                    mode: 'select',
                    id: word,
                    title: word,
                    entity: 'words',
                  })
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
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[54px] w-[54px]">
              <FeatherIcon name="more-vertical" size={18} />
            </Box>
          </MenuView>
        }
      />
      <AppScrollView
        backgroundColor="canvas"
        contentContainerStyle={{ maxWidth: STUDY_COLUMN_MAX_WIDTH + 40, paddingHorizontal: 20 }}
      >
        <VStack className="gap-[10px] pt-[2px] pb-[4px]">
          {(tags || relationCount > 0) && (
            <EntityChipList
              tags={tags}
              relationCount={relationCount}
              onRelationPress={() => dictionaryEndpoint && openEntityRelations(dictionaryEndpoint)}
            />
          )}
          <HStack className="items-center gap-[10px]">
            <IconTile bg={dictionaryUniverse.background}>
              <DictionnaryIcon size={18} color={dictionaryUniverse.foreground} />
            </IconTile>
            <Text className="text-[15px] text-grey">
              {capitalizeFirst(resolvedDictionaryTitle)}
            </Text>
          </HStack>
          <Text
            className="text-[34px] leading-[42px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {capitalizeFirst(word)}
          </Text>
        </VStack>
        {correspondenceSources.length > 1 && (
          <StudySection
            title={t('Aussi dans {{count}} dictionnaires', {
              count: correspondenceSources.length,
            })}
            surface="none"
            className="mt-[20px]"
          >
            <HorizontalControlScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {correspondenceSources.map(source => {
                const selected = isCurrentSource(source)
                return (
                  <TouchableBox
                    className={twMerge(
                      'overflow-hidden border-continuous rounded-full px-[12px] py-[6px]',
                      selected ? 'bg-primary' : 'bg-surface'
                    )}
                    key={`${source.resource.work}:${source.resource.language}:${source.id}`}
                    disabled={selected}
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setDictionaryTab(
                        produce(draft => {
                          draft.title = source.word
                          draft.data.word = source.word
                          draft.data.entryId = source.id
                          draft.data.correspondenceId = correspondenceQuery.data?.correspondenceId
                          draft.data.work = source.resource.work
                          draft.data.resourceId = source.resourceId
                          draft.data.dictionaryTitle = source.title
                          draft.data.language = source.resource.language
                        })
                      )
                    }
                  >
                    <Text
                      className={twMerge('text-[13px]', selected && 'text-reverse font-semibold')}
                    >
                      {source.abbreviation}
                    </Text>
                  </TouchableBox>
                )
              })}
            </HorizontalControlScrollView>
          </StudySection>
        )}
        <StudySection title={t('Définition')}>
          {dictionaryQuery.isPending ? (
            <Loading message={t('Chargement...')} />
          ) : (
            dictionnaireItem?.definition && (
              <SwitchableHTMLView
                selectable
                previewSource={{
                  kind: 'dictionary',
                  work,
                  resourceId,
                  dictionaryTitle: resolvedDictionaryTitle,
                  language: dictionaryResourceLanguage,
                }}
                value={dictionnaireItem.definition.replace(/\n/gi, '')}
                onLinkClicked={openLink}
              />
            )
          )}
        </StudySection>
      </AppScrollView>
    </>
  )
}

export default DictionnaryDetailScreen
