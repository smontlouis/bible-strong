import { useQuery } from '@tanstack/react-query'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import React, { useEffect, useRef, useState } from 'react'
import { Alert, Share } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import Text from '~common/ui/Text'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type {
  StrongLexiconEntry,
  StrongLexiconEntityRelation,
} from '~features/resources/strongLexiconAccess'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { createStrongEndpoint } from '~features/studyRelations/endpoints'
import type { StrongReference, Verse } from '~common/types'
import { createStrongLexiconModuleDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import generateUUID from '~helpers/generateUUID'
import type { StrongIdentity, StrongIdentityKind } from '~helpers/strongIdentities'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import {
  isStrongCapableBibleVersion,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { getBook } from '~helpers/bibleBookCatalog'
import verseToReference from '~helpers/verseToReference'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import { historyAtom, unifiedTagsModalAtom } from '~state/app'
import type { StrongTab } from '../../state/tabs'
import StrongConcordancePage from './StrongConcordancePage'
import StrongDetailMainPage from './StrongDetailMainPage'
import type { StrongDetailPage, StrongDetailRouteContext } from './strongDetailRoutes'
import { createStrongDetailRoute } from './strongDetailRoutes'
import StrongDictionaryPage from './StrongDictionaryPage'
import StrongEntityPage from './StrongEntityPage'
import StrongRelatedPage from './StrongRelatedPage'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'
import { getBibleViewRouteForStrongOsisReference } from './strongReferenceNavigation'

interface StrongDetailScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
  isFormSheet?: boolean
  initialPage?: StrongDetailPage
}

type StrongNavigationNode = {
  page: StrongDetailPage
  context: StrongDetailRouteContext
  entityKey?: string
}

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()

const inferIdentityKind = (code: string): StrongIdentityKind =>
  /^[HG]\d+[A-Z]+$/iu.test(code) ? 'dstrong' : 'strong'

const normalizeIdentity = ({
  identityKind,
  identityCode,
  reference,
  strongReference,
  book,
}: StrongDetailRouteContext): StrongIdentity | undefined => {
  const rawCode = identityCode || reference || strongReference?.Code
  if (!rawCode) return undefined
  const normalized = String(rawCode).trim().toUpperCase()
  const prefixed = /^[HG]/u.test(normalized)
    ? normalized
    : `${(book ?? 1) <= 39 ? 'H' : 'G'}${String(Number(normalized)).padStart(4, '0')}`
  return {
    kind: identityKind ?? inferIdentityKind(prefixed),
    code: prefixed,
  }
}

const toLegacyStrongReference = (entry: StrongLexiconEntry): StrongReference => ({
  Hebreu: entry.language === 'hebrew' ? entry.original : '',
  Grec: entry.language === 'greek' ? entry.original : '',
  Mot: entry.gloss,
  Code: String(entry.baseCode),
  Phonetique: entry.transliteration,
  Definition: entry.definitionHtml ?? '',
  Type: entry.morphology?.meaning ?? '',
  LSG: '',
  Origine: '',
  date: '',
  book: entry.language === 'hebrew' ? '1' : '40',
})

const StrongDetailScreen = ({
  strongAtom,
  isFormSheet = false,
  initialPage = 'index',
}: StrongDetailScreenProps) => {
  const pushRouteOnce = usePushRouteOnce()
  const [strongTab, setStrongTab] = useAtom(strongAtom)
  const [navigationStack, setNavigationStack] = useState<StrongNavigationNode[]>([
    {
      page: initialPage,
      context: strongTab.data,
    },
  ])
  const activeNode = navigationStack.at(-1)!
  const activeContext = activeNode.context
  const identity = normalizeIdentity(activeContext)
  const navigationKey = identity ? `${identity.kind}:${identity.code}` : 'unknown'
  const [lemmaSelection, setLemmaSelection] = useState<{
    navigationKey: string
    lemmaId?: number
  }>({ navigationKey })
  const selectedLemmaId =
    lemmaSelection.navigationKey === navigationKey ? lemmaSelection.lemmaId : undefined
  const resources = useResourceAccess()
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const {
    language: resourceLanguage,
    menuTitle: strongLanguageMenuTitle,
    toggleLanguage: toggleStrongLanguage,
  } = useStrongLexiconLanguage()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const addHistory = useSetAtom(historyAtom)
  const openEntityRelations = useOpenEntityRelations()
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const historyDataUpdatedAtRef = useRef(0)
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
  const readingFontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const coreDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' })
  )
  const coreAvailability = useQuery({
    queryKey: ['strong-lexicon', 'availability', 'core'],
    queryFn: () => resources.strongLexicon.getModuleAvailability('core'),
    networkMode: 'always',
  })
  const entryQuery = useQuery({
    queryKey: ['strong-lexicon', 'entry', resourceLanguage, identity],
    queryFn: () => resources.strongLexicon.loadEntry(identity!, resourceLanguage),
    enabled: Boolean(identity && coreAvailability.data?.status === 'available'),
    networkMode: 'always',
  })
  const entry = entryQuery.data
  const legacyEntry = entry ? toLegacyStrongReference(entry) : undefined
  const currentStrongBibleVersionId: StrongBibleVersionId =
    activeContext.bibleVersion && isStrongCapableBibleVersion(activeContext.bibleVersion)
      ? activeContext.bibleVersion
      : activeContext.strongBibleVersionId &&
          isStrongCapableBibleVersion(activeContext.strongBibleVersionId)
        ? activeContext.strongBibleVersionId
        : defaultStrongBibleVersionId
  const concordanceQuery = useQuery({
    queryKey: [
      'strong-detail',
      'concordance-preview',
      currentStrongBibleVersionId,
      entry?.selectedIdentity,
      selectedLemmaId,
    ],
    queryFn: async () => {
      const request = {
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.selectedIdentity.code,
        limit: 3,
        offset: 0,
        allBooks: true,
        lexemeId: selectedLemmaId,
      }
      const [versesResult, countsResult] = await Promise.all([
        resources.strongBible.loadFoundVersesByBook(request),
        resources.strongBible.loadCountsByBook(request),
      ])
      return {
        verses: versesResult.status === 'available' ? versesResult.verses : [],
        count:
          countsResult.status === 'available'
            ? countsResult.counts.reduce(
                (total, current) => total + Number(current.versesCountByBook),
                0
              )
            : 0,
        version:
          versesResult.status === 'available'
            ? versesResult.provenance.versionId
            : countsResult.status === 'available'
              ? countsResult.provenance.versionId
              : currentStrongBibleVersionId,
      }
    },
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const lemmaStatsQuery = useQuery({
    queryKey: [
      'strong-detail',
      'lemma-stats',
      currentStrongBibleVersionId,
      entry?.selectedIdentity,
    ],
    queryFn: () =>
      resources.strongBible.loadLemmaStats({
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book: entry?.language === 'hebrew' ? 1 : 40,
        reference: entry!.selectedIdentity.code,
      }),
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const contextVerseQuery = useQuery({
    queryKey: [
      'strong-detail',
      'verse-context',
      activeContext.bibleVersion,
      activeContext.book,
      activeContext.bibleChapter,
      activeContext.bibleVerse,
    ],
    queryFn: () =>
      resources.strongBible.loadVerse({
        currentVersionId: currentStrongBibleVersionId,
        defaultVersionId: defaultStrongBibleVersionId,
        book: activeContext.book!,
        chapter: activeContext.bibleChapter!,
        verse: activeContext.bibleVerse!,
      }),
    enabled: Boolean(
      activeContext.bibleVersion &&
      activeContext.book &&
      activeContext.bibleChapter &&
      activeContext.bibleVerse
    ),
    networkMode: 'always',
  })
  const contextMorphologiesQuery = useQuery({
    queryKey: [
      'strong-detail',
      'context-morphologies',
      resourceLanguage,
      activeContext.morphologyCodes,
    ],
    queryFn: () =>
      resources.strongLexicon.loadMorphologies(
        activeContext.morphologyCodes ?? [],
        resourceLanguage
      ),
    enabled: Boolean(
      activeContext.morphologyCodes?.length && coreAvailability.data?.status === 'available'
    ),
    networkMode: 'always',
  })
  const directEntityQuery = useQuery({
    queryKey: ['strong-lexicon', 'entity', resourceLanguage, activeNode.entityKey],
    queryFn: () => resources.strongLexicon.loadEntity(activeNode.entityKey!, resourceLanguage),
    enabled: Boolean(
      activeNode.page === 'entity' &&
      activeNode.entityKey &&
      activeNode.entityKey !== entry?.entity?.uniqueName
    ),
    networkMode: 'always',
  })
  const activeEntity = activeNode.entityKey
    ? activeNode.entityKey === entry?.entity?.uniqueName
      ? entry.entity
      : directEntityQuery.data
    : entry?.entity
  const code = entry ? String(entry.baseCode) : ''
  const strongEndpoint = entry
    ? createStrongEndpoint({
        language: entry.language,
        code,
        labelFallback: entry.gloss,
        originalWord: entry.original,
      })
    : null

  useEffect(() => {
    if (!entry || historyDataUpdatedAtRef.current === entryQuery.dataUpdatedAt) return
    historyDataUpdatedAtRef.current = entryQuery.dataUpdatedAt
    addHistory({
      ...toLegacyStrongReference(entry),
      book: entry.language === 'hebrew' ? 1 : 40,
      date: Date.now(),
      type: 'strong',
    })
  }, [addHistory, entry, entryQuery.dataUpdatedAt])

  useEffect(() => {
    if (!entry) return
    setStrongTab(
      produce(draft => {
        draft.title = `${entry.stepCode} · ${entry.gloss}`
      })
    )
  }, [entry, setStrongTab])

  const openPage = (
    page: Exclude<StrongDetailPage, 'index'>,
    options: { entityKey?: string } = {}
  ) => {
    if (isInTab) {
      setNavigationStack(stack => [...stack, { page, context: activeContext, ...options }])
      return
    }
    pushRouteOnce(
      createStrongDetailRoute(page, activeContext, {
        ...options,
      })
    )
  }

  const openStrong = (stepCode: string) => {
    const context: StrongDetailRouteContext = {
      book: stepCode.startsWith('G') ? 40 : 1,
      identityKind: 'dstrong',
      identityCode: stepCode,
      reference: stepCode,
      strongBibleVersionId: activeContext.strongBibleVersionId,
      bibleVersion: activeContext.bibleVersion,
    }
    if (isInTab) {
      setNavigationStack(stack => [...stack, { page: 'index', context }])
      return
    }
    pushRouteOnce(createStrongDetailRoute('index', context))
  }

  const goBackInTab = () => {
    if (navigationStack.length > 1) {
      setNavigationStack(stack => stack.slice(0, -1))
      return
    }
    if (activeNode.page !== 'index') {
      setNavigationStack([{ page: 'index', context: activeContext }])
      return
    }
    setStrongTab(
      produce(draft => {
        draft.title = t('Lexique')
        draft.data = {}
      })
    )
  }

  const openBibleReference = (osis: string) => {
    const route = getBibleViewRouteForStrongOsisReference(osis)
    if (route) pushRouteOnce(route)
  }

  const openConcordanceVerse = (verse: Verse, version?: string) => {
    const bookNumber = Number(verse.Livre)
    const verseNumber = Number(verse.Verset)
    const resolvedVersion = version ?? concordanceQuery.data?.version
    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify(getBook(bookNumber)),
        chapter: String(verse.Chapitre),
        verse: String(verseNumber),
        focusVerses: JSON.stringify([verseNumber]),
        version: resolvedVersion,
        strongMode: 'visible',
      },
    })
  }

  const openEntityRelation = (relation: StrongLexiconEntityRelation) => {
    if (!relation.targetUniqueName) return
    openPage('entity', { entityKey: relation.targetUniqueName })
  }

  const requestCoreDownload = () => {
    Alert.alert(
      t('Télécharger le lexique Strong ?'),
      t(
        'Le lexique principal est nécessaire pour afficher les définitions, la morphologie et les mots liés.'
      ),
      [
        { text: t('Annuler'), style: 'cancel' },
        {
          text: t('Télécharger'),
          onPress: () => downloadManager.enqueue([createStrongLexiconModuleDownloadItem('core')]),
        },
      ]
    )
  }

  const shareEntry = () => {
    if (!entry) return
    const lines = [
      `${entry.stepCode} — ${entry.gloss}`,
      `${entry.original} · ${entry.transliteration}`,
      entry.definitionHtml ? stripHtml(entry.definitionHtml) : '',
      'https://bible-strong.app',
    ].filter(Boolean)
    Share.share({ message: lines.join('\n\n') })
  }

  const openTags = () => {
    if (!entry) return
    setUnifiedTagsModal({
      mode: 'select',
      id: code,
      title: entry.gloss,
      entity: entry.language === 'greek' ? 'strongsGrec' : 'strongsHebreu',
    })
  }

  const openStrongInNewTab = () => {
    if (!entry) return
    openInNewTab({
      id: `strong-${generateUUID()}`,
      title: entry.gloss,
      isRemovable: true,
      type: 'strong',
      data: {
        ...activeContext,
        book: entry.language === 'hebrew' ? 1 : 40,
        reference: entry.stepCode,
        identityKind: 'dstrong',
        identityCode: entry.stepCode,
      },
    })
  }

  const coreDownloading =
    coreDownload?.status === 'queued' ||
    coreDownload?.status === 'downloading' ||
    coreDownload?.status === 'inserting'
  const hasMainBackButton = isFormSheet ? canGoBackInStack : !isInTab
  const hasBackButton = activeNode.page !== 'index' || hasMainBackButton

  if (coreAvailability.isPending || (coreAvailability.data?.status === 'available' && !entry)) {
    if (entryQuery.isError) {
      return (
        <FormSheetScreen isFormSheet={isFormSheet}>
          <Header
            hasBackButton={hasBackButton}
            onCustomBackPress={isInTab ? goBackInTab : undefined}
            title={t('Lexique')}
          />
          <Empty
            source={require('~assets/images/empty.json')}
            message={t("Cette entrée Strong n'a pas pu être chargée.")}
          />
        </FormSheetScreen>
      )
    }
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={isInTab ? goBackInTab : undefined}
          title={t('Lexique')}
        />
        <Loading message={t('Chargement...')} />
      </FormSheetScreen>
    )
  }

  if (coreAvailability.data?.status !== 'available') {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={isInTab ? goBackInTab : undefined}
          title={t('Lexique')}
        />
        <VStack flex px={20} center gap={16}>
          <FeatherIcon name="book-open" size={34} color="default" />
          <Text bold fontSize={20} textAlign="center">
            {t('Le nouveau lexique Strong est requis')}
          </Text>
          <Text color="tertiary" textAlign="center">
            {t(
              'Téléchargez le module principal pour accéder aux définitions, à la morphologie et aux relations lexicales.'
            )}
          </Text>
          <Button onPress={requestCoreDownload} disabled={coreDownloading}>
            {coreDownloading ? t('Téléchargement...') : t('Télécharger')}
          </Button>
        </VStack>
      </FormSheetScreen>
    )
  }

  if (!entry || !legacyEntry) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header
          hasBackButton={hasBackButton}
          onCustomBackPress={isInTab ? goBackInTab : undefined}
          title={t('Lexique')}
        />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Aucune entrée lexicale trouvée pour {{code}}.', {
            code: identity?.code ?? '',
          })}
        />
      </FormSheetScreen>
    )
  }

  const pageTitles: Record<StrongDetailPage, string> = {
    index: t('strongDetail.title'),
    entity: activeEntity?.name ?? t('strongDetail.entity.title'),
    dictionary: t('strongLexicon.greekDictionary'),
    related: t('strongDetail.related.title'),
    concordance: t('Concordance'),
  }
  const contextVerse =
    contextVerseQuery.data?.status === 'available' ? contextVerseQuery.data.verse : undefined
  const contextReference =
    activeContext.book && activeContext.bibleChapter && activeContext.bibleVerse
      ? verseToReference({
          bookNum: activeContext.book,
          chapterNum: activeContext.bibleChapter,
          verses: [activeContext.bibleVerse],
        })
      : undefined
  const lemmaStats = lemmaStatsQuery.data?.status === 'available' ? lemmaStatsQuery.data.lemmas : []
  const menu = (
    <MenuView
      actions={
        [
          { id: 'language', title: strongLanguageMenuTitle, image: 'globe' },
          { id: 'tags', title: t('Étiquettes'), image: 'tag' },
          strongEndpoint
            ? {
                id: 'relations',
                title: t('Éditer les relations'),
                image: 'arrow.triangle.merge',
              }
            : null,
          { id: 'share', title: t('Partager'), image: 'square.and.arrow.up' },
          {
            id: 'open-tab',
            title: t('tab.openInNewTab'),
            image: 'arrow.up.forward.square',
          },
        ].filter(Boolean) as MenuAction[]
      }
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event === 'language') toggleStrongLanguage()
        if (nativeEvent.event === 'tags') openTags()
        if (nativeEvent.event === 'relations' && strongEndpoint) {
          openEntityRelations(strongEndpoint)
        }
        if (nativeEvent.event === 'share') shareEntry()
        if (nativeEvent.event === 'open-tab') openStrongInNewTab()
      }}
    >
      <Box row center height={60} width={60}>
        <FeatherIcon name="more-vertical" size={18} />
      </Box>
    </MenuView>
  )

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        onCustomBackPress={isInTab ? goBackInTab : undefined}
        title={pageTitles[activeNode.page]}
        fontSize={activeNode.page === 'index' ? 19 : undefined}
        subTitle={
          activeNode.page === 'index'
            ? `${t(entry.language === 'greek' ? 'Grec' : 'Hébreu')} · ${entry.stepCode}`
            : undefined
        }
        rightComponent={menu}
      />

      {activeNode.page === 'index' && (
        <StrongDetailMainPage
          entry={entry}
          legacyEntry={legacyEntry}
          contextVerse={contextVerse}
          contextReference={contextReference}
          contextVersion={
            contextVerseQuery.data?.status === 'available'
              ? contextVerseQuery.data.provenance.versionId
              : activeContext.bibleVersion
          }
          clickedWord={activeContext.clickedWord}
          contextMorphologies={contextMorphologiesQuery.data}
          resourcesAvailability={entry.modules.resources}
          entitiesAvailability={entry.modules.entities}
          concordanceCount={concordanceQuery.data?.count ?? 0}
          concordanceVersion={concordanceQuery.data?.version ?? currentStrongBibleVersionId}
          concordanceVerses={concordanceQuery.data?.verses ?? []}
          concordanceLoading={concordanceQuery.isPending}
          lemmaStats={lemmaStats}
          selectedLemmaId={selectedLemmaId}
          readingFontFamily={readingFontFamily}
          onSelectLemma={lemmaId => setLemmaSelection({ navigationKey, lemmaId })}
          onOpenPage={page =>
            openPage(page, page === 'entity' ? { entityKey: entry.entity?.uniqueName } : {})
          }
          onOpenStrong={openStrong}
          onOpenBibleReference={openBibleReference}
          onOpenConcordanceVerse={openConcordanceVerse}
          onOpenEntityRelation={openEntityRelation}
        />
      )}
      {activeNode.page === 'entity' && (
        <StrongEntityPage
          entity={activeEntity}
          availability={entry.modules.entities}
          loading={directEntityQuery.isPending && !activeEntity}
          onOpenBibleReference={openBibleReference}
          onOpenStrong={openStrong}
          onOpenEntityRelation={openEntityRelation}
        />
      )}
      {activeNode.page === 'dictionary' && (
        <StrongDictionaryPage
          entry={entry}
          availability={entry.modules.resources}
          onOpenBibleReference={openBibleReference}
          onOpenStrong={openStrong}
        />
      )}
      {activeNode.page === 'related' && (
        <StrongRelatedPage entry={entry} onOpenStrong={openStrong} />
      )}
      {activeNode.page === 'concordance' && (
        <StrongConcordancePage
          entry={entry}
          legacyEntry={legacyEntry}
          currentVersionId={currentStrongBibleVersionId}
          defaultVersionId={defaultStrongBibleVersionId}
          onOpenVerse={openConcordanceVerse}
        />
      )}
    </FormSheetScreen>
  )
}

export default StrongDetailScreen
