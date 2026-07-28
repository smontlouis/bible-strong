import { useQuery } from '@tanstack/react-query'
import { produce } from 'immer'
import { useAtom, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import React, { useEffect, useRef, useState } from 'react'
import { Alert, Linking, Share, TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'

import Empty from '~common/Empty'
import EntityChipList from '~common/EntityChipList'
import Header from '~common/Header'
import Loading from '~common/Loading'
import StylizedHTMLView from '~common/StylizedHTMLView'
import Box, { HStack, VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import ConcordanceVerse from '~features/bible/ConcordanceVerse'
import ListenToStrong from '~features/bible/ListenStrong'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import { useTabContext } from '~features/app-switcher/context/TabContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import StrongLexiconModuleCard from './StrongLexiconModuleCard'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
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
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { RootState } from '~redux/modules/reducer'
import { makeStrongTagsSelector } from '~redux/selectors/bible'
import { historyAtom, unifiedTagsModalAtom } from '~state/app'
import type { StrongTab } from '../../state/tabs'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'
import { resolveRelatedStrongNavigation } from './strongDetailNavigation'

interface StrongDetailScreenProps {
  strongAtom: PrimitiveAtom<StrongTab>
  isFormSheet?: boolean
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
}: StrongTab['data']): StrongIdentity | undefined => {
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <VStack gap={8} mt={24}>
    <Text bold fontSize={17}>
      {title}
    </Text>
    {children}
  </VStack>
)

const StrongDetailScreen = ({ strongAtom, isFormSheet = false }: StrongDetailScreenProps) => {
  const router = useRouter()
  const pushRouteOnce = usePushRouteOnce()
  const [strongTab, setStrongTab] = useAtom(strongAtom)
  const [selectedLemmaId, setSelectedLemmaId] = useState<number>()
  const resources = useResourceAccess()
  const { isInTab } = useTabContext()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : !isInTab
  const {
    language: resourceLanguage,
    languageLabel: resourceLanguageLabel,
    menuTitle: strongLanguageMenuTitle,
    toggleLanguage: toggleStrongLanguage,
  } = useStrongLexiconLanguage()
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const addHistory = useSetAtom(historyAtom)
  const openEntityRelations = useOpenEntityRelations()
  const openInNewTab = useOpenInNewTab()
  const { t } = useTranslation()
  const historyDataUpdatedAtRef = useRef(0)
  const {
    strongBibleVersionId: requestedStrongBibleVersionId,
    bibleVersion,
    clickedWord,
    book: clickedBook,
    bibleChapter,
    bibleVerse,
  } = strongTab.data
  const identity = normalizeIdentity(strongTab.data)
  const defaultStrongBibleVersionId = useSelector(
    (state: RootState) => state.user.bible.settings.defaultStrongBibleVersionId ?? 'LSG'
  )
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
    bibleVersion && isStrongCapableBibleVersion(bibleVersion)
      ? bibleVersion
      : requestedStrongBibleVersionId && isStrongCapableBibleVersion(requestedStrongBibleVersionId)
        ? requestedStrongBibleVersionId
        : defaultStrongBibleVersionId
  const concordanceQuery = useQuery({
    queryKey: [
      'strong-lexicon',
      'concordance',
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
        limit: 20,
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
        identity:
          versesResult.status === 'available'
            ? versesResult.identity
            : countsResult.status === 'available'
              ? countsResult.identity
              : undefined,
      }
    },
    enabled: Boolean(entry),
    networkMode: 'always',
  })
  const lemmaStatsQuery = useQuery({
    queryKey: [
      'strong-lexicon',
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

  const code = entry ? String(entry.baseCode) : ''
  const selectStrongTags = makeStrongTagsSelector()
  const tags = useSelector((state: RootState) =>
    selectStrongTags(state, code, entry?.language === 'greek')
  )
  const strongEndpoint = entry
    ? createStrongEndpoint({
        language: entry.language,
        code,
        labelFallback: entry.gloss,
        originalWord: entry.original,
      })
    : null
  const relationCount = useRelationCount(strongEndpoint)

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

  const goBack = () => {
    if (isInTab) {
      setStrongTab(
        produce(draft => {
          draft.title = t('Lexique')
          draft.data = {}
        })
      )
    } else {
      router.back()
    }
  }

  const selectRelatedEntry = (stepCode: string) => {
    const navigation = resolveRelatedStrongNavigation({
      isInTab,
      stepCode,
      strongBibleVersionId: requestedStrongBibleVersionId,
      bibleVersion,
    })

    if (navigation.mode === 'update-tab') {
      setStrongTab(
        produce(draft => {
          draft.data.book = navigation.identity.book
          draft.data.identityKind = navigation.identity.identityKind
          draft.data.identityCode = navigation.identity.identityCode
          draft.data.reference = navigation.identity.reference
          draft.data.strongReference = undefined
          draft.data.clickedWord = undefined
          draft.data.bibleChapter = undefined
          draft.data.bibleVerse = undefined
        })
      )
      return
    }

    pushRouteOnce(navigation.route)
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

  const openConcordanceVerse = (verse: Verse) => {
    const bookNumber = Number(verse.Livre)
    const verseNumber = Number(verse.Verset)
    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify(getBook(bookNumber)),
        chapter: String(verse.Chapitre),
        verse: String(verseNumber),
        focusVerses: JSON.stringify([verseNumber]),
        version: concordanceQuery.data?.version,
        strongMode: 'visible',
      },
    })
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
        book: entry.language === 'hebrew' ? 1 : 40,
        reference: entry.stepCode,
        identityKind: 'dstrong',
        identityCode: entry.stepCode,
        bibleVersion,
      },
    })
  }

  const coreDownloading =
    coreDownload?.status === 'queued' ||
    coreDownload?.status === 'downloading' ||
    coreDownload?.status === 'inserting'
  if (coreAvailability.isPending || (coreAvailability.data?.status === 'available' && !entry)) {
    if (entryQuery.isError) {
      return (
        <FormSheetScreen isFormSheet={isFormSheet}>
          <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title={t('Lexique')} />
          <Empty
            source={require('~assets/images/empty.json')}
            message={t("Cette entrée Strong n'a pas pu être chargée.")}
          />
        </FormSheetScreen>
      )
    }
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title={t('Lexique')} />
        <Loading message={t('Chargement...')} />
      </FormSheetScreen>
    )
  }

  if (coreAvailability.data?.status !== 'available') {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title={t('Lexique')} />
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
        <Header hasBackButton={hasBackButton} onCustomBackPress={goBack} title={t('Lexique')} />
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Aucune entrée lexicale trouvée pour {{code}}.', {
            code: identity?.code ?? '',
          })}
        />
      </FormSheetScreen>
    )
  }

  const definitionFallback = t('strongLexicon.definitionUnavailable', {
    language: resourceLanguageLabel,
  })
  const relationGroups = [
    {
      id: 'subentry' as const,
      title: t('strongLexicon.otherMeanings'),
    },
    {
      id: 'identity' as const,
      title: t('strongLexicon.variants'),
    },
    {
      id: 'family' as const,
      title: t('strongLexicon.wordFamily'),
    },
  ]

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Header
        hasBackButton={hasBackButton}
        onCustomBackPress={goBack}
        title={entry.gloss}
        detail={`${entry.stepCode} · ${entry.transliteration}`}
        rightComponent={
          <MenuView
            actions={
              [
                {
                  id: 'language',
                  title: strongLanguageMenuTitle,
                  image: 'globe',
                },
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
              switch (nativeEvent.event) {
                case 'tags':
                  openTags()
                  break
                case 'share':
                  shareEntry()
                  break
                case 'relations':
                  if (strongEndpoint) openEntityRelations(strongEndpoint)
                  break
                case 'open-tab':
                  openStrongInNewTab()
                  break
                case 'language':
                  toggleStrongLanguage()
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
      <ScrollView style={{ paddingHorizontal: 20, flex: 1 }}>
        <VStack pb={40}>
          <VStack bg="lightGrey" borderRadius={14} px={14} py={13} gap={8}>
            {!!(bibleVersion || requestedStrongBibleVersionId) && (
              <HStack justifyContent="space-between" gap={12}>
                <Text color="tertiary">{t('Version')}</Text>
                <Text bold>{bibleVersion || requestedStrongBibleVersionId}</Text>
              </HStack>
            )}
            {!!clickedWord && (
              <HStack justifyContent="space-between" gap={12}>
                <Text color="tertiary">
                  {bibleChapter && bibleVerse
                    ? `${getBook(clickedBook ?? 0)?.Nom ?? ''} ${bibleChapter}:${bibleVerse}`.trim()
                    : t('strongLexicon.selectedWord')}
                </Text>
                <Text bold>{clickedWord}</Text>
              </HStack>
            )}
            <HStack justifyContent="space-between" gap={12}>
              <Text color="tertiary">{entry.selectedIdentity.kind}</Text>
              <Text bold>{entry.selectedIdentity.code}</Text>
            </HStack>
          </VStack>

          {(tags || relationCount > 0) && (
            <Box mt={14}>
              <EntityChipList
                tags={tags}
                relationCount={relationCount}
                onRelationPress={() => strongEndpoint && openEntityRelations(strongEndpoint)}
              />
            </Box>
          )}

          <Section title={t('strongLexicon.wordAndIdentity')}>
            <VStack gap={6}>
              <Text fontSize={27}>{entry.original}</Text>
              <Text fontSize={16} color="tertiary">
                {entry.transliteration}
                {entry.pronunciation ? ` · ${entry.pronunciation}` : ''}
              </Text>
              <HStack gap={8} wrap alignItems="center">
                <Box bg="lightPrimary" borderRadius={12} px={9} py={5}>
                  <Text bold>{entry.stepCode}</Text>
                </Box>
                {entry.classicStrong !== entry.stepCode && (
                  <Box bg="opacity5" borderRadius={12} px={9} py={5}>
                    <Text>{entry.classicStrong}</Text>
                  </Box>
                )}
                <ListenToStrong
                  type={entry.language === 'hebrew' ? 'hebreu' : 'grec'}
                  code={entry.baseCode}
                />
              </HStack>
            </VStack>
          </Section>

          <Section title={t('Définition')}>
            {entry.definitionHtml ? (
              <StylizedHTMLView value={entry.definitionHtml} />
            ) : (
              <Text color="tertiary">{definitionFallback}</Text>
            )}
          </Section>

          {entry.entity ? (
            <Section title={t('strongLexicon.biblicalContext')}>
              <VStack bg="lightGrey" borderRadius={14} px={14} py={14} gap={9}>
                <Text bold fontSize={19}>
                  {entry.entity.name}
                </Text>
                {!!entry.entity.description && <Text>{entry.entity.description}</Text>}
                {!!entry.entity.shortDescription && <Text>{entry.entity.shortDescription}</Text>}
                {!!entry.entity.summaryHtml && (
                  <StylizedHTMLView value={entry.entity.summaryHtml} />
                )}
                {!!entry.entity.brief && <Text>{entry.entity.brief}</Text>}
                {!!entry.entity.articleHtml && (
                  <StylizedHTMLView value={entry.entity.articleHtml} />
                )}
                {!!entry.entity.place && (
                  <VStack gap={6}>
                    <Text bold>{entry.entity.place.name}</Text>
                    {!!entry.entity.place.area && (
                      <Text color="tertiary">{entry.entity.place.area}</Text>
                    )}
                    {entry.entity.place.latitude != null &&
                      entry.entity.place.longitude != null && (
                        <Text color="tertiary" fontSize={12}>
                          {entry.entity.place.latitude}, {entry.entity.place.longitude}
                        </Text>
                      )}
                    <HStack gap={8} wrap>
                      {!!entry.entity.place.googleMapUrl && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(entry.entity!.place!.googleMapUrl!)}
                        >
                          <Text color="primary" fontSize={12}>
                            {t('Google Maps')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {!!entry.entity.place.palopenmapsUrl && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(entry.entity!.place!.palopenmapsUrl!)}
                        >
                          <Text color="primary" fontSize={12}>
                            {t('Carte biblique')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </HStack>
                  </VStack>
                )}
                {entry.entity.relations.map(relation => (
                  <Text key={`${relation.relation}:${relation.targetId}:${relation.targetName}`}>
                    <Text color="tertiary">{relation.relation}: </Text>
                    {relation.targetName}
                    {relation.certainty ? ` · ${relation.certainty}` : ''}
                  </Text>
                ))}
                {entry.entity.references.length > 0 && (
                  <Text color="tertiary" fontSize={12}>
                    {entry.entity.references.join(' · ')}
                    {entry.entity.hiddenReferenceCount > 0
                      ? ` · +${entry.entity.hiddenReferenceCount}`
                      : ''}
                  </Text>
                )}
              </VStack>
            </Section>
          ) : entry.modules.entities.status !== 'available' ? (
            <Section title={t('strongLexicon.biblicalContext')}>
              <StrongLexiconModuleCard
                moduleId="entities"
                availability={entry.modules.entities}
                title={t('strongLexicon.biblicalEntities')}
                description={t('strongLexicon.biblicalEntitiesDescription')}
              />
            </Section>
          ) : null}

          {!!entry.morphology && (
            <Section title={t('strongLexicon.grammar')}>
              <VStack gap={4}>
                <Text bold>{entry.morphology.meaning}</Text>
                {!!entry.morphology.description && (
                  <Text color="tertiary">{entry.morphology.description}</Text>
                )}
              </VStack>
            </Section>
          )}

          {relationGroups.map(group => {
            const relations = entry.relations.filter(relation => relation.group === group.id)
            if (!relations.length) return null
            return (
              <Section key={group.id} title={group.title}>
                <VStack gap={8}>
                  {relations.map(relation => (
                    <TouchableOpacity
                      key={`${relation.stepCode}:${relation.label}`}
                      onPress={() => selectRelatedEntry(relation.stepCode)}
                      activeOpacity={0.7}
                    >
                      <HStack
                        bg="lightGrey"
                        borderRadius={12}
                        px={12}
                        py={10}
                        alignItems="center"
                        gap={10}
                      >
                        <VStack flex gap={2}>
                          <Text bold>{relation.gloss || relation.transliteration}</Text>
                          <Text color="tertiary" fontSize={12}>
                            {relation.label} · {relation.stepCode}
                          </Text>
                        </VStack>
                        <Text fontSize={18}>{relation.original}</Text>
                        <FeatherIcon name="chevron-right" size={16} color="tertiary" />
                      </HStack>
                    </TouchableOpacity>
                  ))}
                </VStack>
              </Section>
            )
          })}

          {entry.resources.length > 0 ? (
            <Section title={t('strongLexicon.learnMore')}>
              <VStack gap={18}>
                {entry.resources.map(resource => (
                  <VStack key={resource.id} gap={6}>
                    <Text bold>{resource.title}</Text>
                    <StylizedHTMLView value={resource.contentHtml} />
                  </VStack>
                ))}
              </VStack>
            </Section>
          ) : entry.modules.resources.status !== 'available' ? (
            <Section title={t('strongLexicon.learnMore')}>
              <StrongLexiconModuleCard
                moduleId="resources"
                availability={entry.modules.resources}
                title={t('strongLexicon.greekDictionary')}
                description={t('strongLexicon.greekDictionaryDescription')}
              />
            </Section>
          ) : null}

          <Section title={t('strongLexicon.bibleOccurrences')}>
            {concordanceQuery.isPending ? (
              <Loading />
            ) : (
              <VStack gap={8}>
                <HStack alignItems="center" gap={8}>
                  <Box bg="lightPrimary" borderRadius={14} px={9} py={5}>
                    <Text>{concordanceQuery.data?.count ?? 0}</Text>
                  </Box>
                  <Text color="tertiary" fontSize={12}>
                    {t('Occurrences selon {{version}}', {
                      version: concordanceQuery.data?.version ?? currentStrongBibleVersionId,
                    })}
                  </Text>
                </HStack>
                {!!concordanceQuery.data?.identity && (
                  <Text color="tertiary" fontSize={11}>
                    {concordanceQuery.data.identity.kind} · {concordanceQuery.data.identity.code}
                  </Text>
                )}
                {lemmaStatsQuery.data?.status === 'available' &&
                  lemmaStatsQuery.data.lemmas.length > 0 && (
                    <VStack gap={7} mt={4}>
                      <Text color="tertiary" fontSize={12}>
                        {t('Filtrer par lemme')}
                      </Text>
                      <HStack gap={7} wrap>
                        <TouchableOpacity
                          onPress={() => setSelectedLemmaId(undefined)}
                          activeOpacity={0.7}
                        >
                          <Box
                            bg={selectedLemmaId == null ? 'primary' : 'lightGrey'}
                            borderRadius={16}
                            px={10}
                            py={7}
                          >
                            <Text
                              color={selectedLemmaId == null ? 'reverse' : 'default'}
                              fontSize={12}
                            >
                              {t('Tous')}
                            </Text>
                          </Box>
                        </TouchableOpacity>
                        {lemmaStatsQuery.data.lemmas.map(lemma => (
                          <TouchableOpacity
                            key={lemma.id}
                            onPress={() => setSelectedLemmaId(lemma.id)}
                            activeOpacity={0.7}
                          >
                            <Box
                              bg={selectedLemmaId === lemma.id ? 'primary' : 'lightGrey'}
                              borderRadius={16}
                              px={10}
                              py={7}
                            >
                              <Text
                                color={selectedLemmaId === lemma.id ? 'reverse' : 'default'}
                                fontSize={12}
                              >
                                {lemma.lemma} · {lemma.occurrenceCount}
                              </Text>
                            </Box>
                          </TouchableOpacity>
                        ))}
                      </HStack>
                    </VStack>
                  )}
                {concordanceQuery.data?.verses.map(verse => (
                  <ConcordanceVerse
                    key={`${verse.Livre}-${verse.Chapitre}-${verse.Verset}`}
                    onOpenVerse={openConcordanceVerse}
                    t={t}
                    concordanceFor={String(entry.baseCode)}
                    lexiconEntry={legacyEntry}
                    verse={verse}
                  />
                ))}
                {(concordanceQuery.data?.count ?? 0) >
                  (concordanceQuery.data?.verses.length ?? 0) && (
                  <TouchableOpacity
                    onPress={() =>
                      pushRouteOnce({
                        pathname: '/concordance-by-book',
                        params: {
                          book: String(entry.language === 'hebrew' ? 1 : 40),
                          strongReference: JSON.stringify({
                            ...legacyEntry,
                            Code: entry.selectedIdentity.code,
                            Mot: entry.gloss,
                          }),
                          strongBibleVersionId:
                            concordanceQuery.data?.version ?? currentStrongBibleVersionId,
                        },
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <HStack justifyContent="center" alignItems="center" gap={5} py={10}>
                      <Text color="primary" bold>
                        {t('strongLexicon.seeAllOccurrences')}
                      </Text>
                      <FeatherIcon name="chevron-right" size={16} color="primary" />
                    </HStack>
                  </TouchableOpacity>
                )}
              </VStack>
            )}
          </Section>
        </VStack>
      </ScrollView>
    </FormSheetScreen>
  )
}

export default StrongDetailScreen
