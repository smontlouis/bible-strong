import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PassageWidget } from '@bible-strong/ai-contract/contract'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import CanonicalStrongVerseText from '~features/bible/CanonicalStrongVerseText'
import StrongCard from '~features/bible/StrongCard'
import {
  getStrongWordOccurrences,
  type StrongWordOccurrence,
} from '~features/bible/strongResourceCardContext'
import { StrongResourceScrollProvider } from '~features/bible/StrongResourceScrollContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resolveStrongNavigationVersionId } from '~helpers/strongBiblePublications'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import { useTheme } from '~themes/ThemeProvider'
import WidgetFrame, {
  WidgetIconButton,
  WidgetLoading,
  WidgetNotice,
  WidgetUnavailable,
} from './WidgetFrame'

function WordEntry({
  occurrence,
  passage,
  language,
}: {
  occurrence: StrongWordOccurrence
  passage: PassageWidget['passages'][number]
  language: 'fr' | 'en'
}) {
  const resources = useResourceAccess(),
    theme = useTheme()
  const query = useQuery({
    queryKey: [
      'assistant-widget-lexicon',
      occurrence.identity.code,
      occurrence.identity.kind,
      language,
    ],
    queryFn: () => resources.strongLexicon.loadEntry(occurrence.identity, language),
    staleTime: 300000,
  })
  if (query.isPending) return <WidgetLoading />
  if (query.isError || !query.data)
    return <WidgetUnavailable onRetry={() => void query.refetch()} />
  return (
    <StrongCard
      theme={theme}
      book={String(passage.book)}
      strongEntry={query.data}
      strongVerseContext={{
        book: passage.book,
        bibleChapter: passage.chapter,
        bibleVerse: passage.start,
        bibleVersion: passage.version,
        strongBibleVersionId: resolveStrongNavigationVersionId(passage.version),
        clickedWord: occurrence.clickedWord,
        morphologyCodes: occurrence.morphologyCodes,
      }}
    />
  )
}

export default function VerseAnalysisWidget({ widget }: { widget: PassageWidget }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce(),
    target = widget.passages[0]
  const language = useResourcesLanguageValue().STRONG
  const [verse, setVerse] = useState(target.start)
  const [selected, setSelected] = useState<number | null>(null)
  const p = { ...target, start: verse, end: verse }
  const query = useQuery({
    queryKey: ['assistant-word-analysis', p.version, p.book, p.chapter, p.start],
    queryFn: async () => {
      const result = await resources.strongBible.loadVerse({
        currentVersionId: p.version,
        defaultVersionId: resolveStrongNavigationVersionId(p.version) || 'LSG',
        book: p.book,
        chapter: p.chapter,
        verse: p.start,
      })
      if (result.status !== 'available' || result.provenance.versionId !== p.version)
        throw new Error('UNAVAILABLE')
      return result
    },
    staleTime: 300000,
  })
  const occurrences = query.data ? getStrongWordOccurrences(query.data.verse) : []
  const occurrence = selected === null ? undefined : occurrences[selected]
  const label = verseToReference({ bookNum: p.book, chapterNum: p.chapter, verses: [p.start] })
  const openPassage = () =>
    navigate({
      pathname: '/bible-view',
      params: {
        book: String(p.book),
        chapter: String(p.chapter),
        verse: String(p.start),
        focusVerses: JSON.stringify([p.start]),
        version: p.version,
        contextDisplayMode: 'focused',
      },
    })
  return (
    <WidgetFrame
      title={occurrence ? occurrence.clickedWord || occurrence.identity.code : widget.title}
      eyebrow={t(occurrence ? 'assistant.widgets.strong' : 'assistant.widgets.wordAnalysis')}
      icon="type"
      leading={
        occurrence ? (
          <WidgetIconButton
            icon="arrow-left"
            label={t('assistant.widgets.backToVerse')}
            onPress={() => setSelected(null)}
          />
        ) : undefined
      }
    >
      <Box className="px-3 py-[10px]">
        {!occurrence && (
          <HStack className="items-center gap-2 pb-1">
            <TouchableBox accessibilityRole="button" onPress={openPassage} className="shrink">
              <Text className="text-link text-[14px] font-semibold" numberOfLines={1}>
                {label}
              </Text>
            </TouchableBox>
            <Text className="text-grey text-[12px]">{p.version}</Text>
            <Box className="flex-1" />
            {target.start < target.end && (
              <HStack accessibilityLabel={t('assistant.widgets.verseNavigation')}>
                <WidgetIconButton
                  icon="chevron-left"
                  label={t('assistant.widgets.previousVerse')}
                  disabled={verse === target.start}
                  onPress={() => {
                    setSelected(null)
                    setVerse(current => Math.max(target.start, current - 1))
                  }}
                />
                <WidgetIconButton
                  icon="chevron-right"
                  label={t('assistant.widgets.nextVerse')}
                  disabled={verse === target.end}
                  onPress={() => {
                    setSelected(null)
                    setVerse(current => Math.min(target.end, current + 1))
                  }}
                />
              </HStack>
            )}
            <WidgetIconButton
              icon="arrow-up-right"
              label={t('assistant.widgets.open', { reference: label })}
              onPress={openPassage}
            />
          </HStack>
        )}
        {occurrence ? (
          <WordEntry occurrence={occurrence} passage={p} language={language} />
        ) : query.isPending ? (
          <WidgetLoading />
        ) : query.isError ? (
          <WidgetUnavailable onRetry={() => void query.refetch()} />
        ) : (
          <>
            <StrongResourceScrollProvider
              value={{
                currentTarget: null,
                registerStrongWordLayout: () => {},
                scrollToStrongCard: (_reference, index) => setSelected(index),
              }}
            >
              <HStack className="flex-wrap items-start">
                <CanonicalStrongVerseText
                  verse={query.data.verse}
                  small
                  textStyle={{ fontSize: 15, lineHeight: 26 }}
                />
              </HStack>
            </StrongResourceScrollProvider>
            <Box className="pt-2">
              <WidgetNotice>{t('assistant.widgets.chooseWord')}</WidgetNotice>
            </Box>
          </>
        )}
      </Box>
    </WidgetFrame>
  )
}
