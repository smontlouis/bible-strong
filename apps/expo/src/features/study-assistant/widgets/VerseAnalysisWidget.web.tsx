import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
import { ArrowLeftIcon, ArrowUpRightIcon } from 'lucide-react'
import { Spinner } from '@heroui/react/spinner'
import type { PassageWidget } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'
import { resolveStrongNavigationVersionId } from '~helpers/strongBiblePublications'
import CanonicalStrongVerseText from '~features/bible/CanonicalStrongVerseText'
import StrongCard from '~features/bible/StrongCard'
import { StrongResourceScrollProvider } from '~features/bible/StrongResourceScrollContext'
import {
  getStrongWordOccurrences,
  type StrongWordOccurrence,
} from '~features/bible/strongResourceCardContext'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import verseToReference from '~helpers/verseToReference'
import WidgetFrame from './WidgetFrame.web'

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
    theme = useTheme(),
    { t } = useTranslation()
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
  if (query.isPending)
    return (
      <div className="bs-widget-centered-loading">
        <Spinner aria-label={t('Chargement...')} color="accent" size="md" />
      </div>
    )
  if (query.isError || !query.data)
    return (
      <div className="bs-widget-unavailable">
        <p>{t('assistant.widgets.resourceUnavailable')}</p>
        <button onClick={() => void query.refetch()}>{t('assistant.errors.retry')}</button>
      </div>
    )
  return (
    <div className="bs-widget-inline-strong">
      <StrongCard
        theme={{
          ...theme,
          fontFamily: {
            ...theme.fontFamily,
            paragraph: resolveFontFamily(theme.fontFamily.text) || 'sans-serif',
          },
        }}
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
    </div>
  )
}
export default function VerseAnalysisWidget({ widget }: { widget: PassageWidget }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    theme = useTheme(),
    p = widget.passages[0]
  const language = useResourcesLanguageValue().STRONG
  const [selected, setSelected] = useState<number | null>(null)
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
  const setPreview = useSetAtom(previewHistoryAtom),
    navigate = usePushRouteOnce()
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
      icon={
        occurrence ? (
          <button
            type="button"
            className="bs-widget-icon"
            aria-label={t('assistant.widgets.backToVerse')}
            title={t('assistant.widgets.backToVerse')}
            onClick={() => setSelected(null)}
          >
            <ArrowLeftIcon size={18} />
          </button>
        ) : undefined
      }
    >
      <div className={occurrence ? 'bs-widget-word-detail' : 'bs-widget-word-analysis'}>
        {!occurrence && (
          <header>
            <button
              type="button"
              className="bs-widget-reference"
              onClick={() =>
                setPreview([
                  {
                    kind: 'bible',
                    title: label,
                    version: p.version,
                    selections: [
                      { book: p.book, chapter: p.chapter, start: p.start, end: p.start },
                    ],
                    open: openPassage,
                  },
                ])
              }
            >
              {label}
            </button>
            <span>{p.version}</span>
            <button
              type="button"
              className="bs-widget-icon"
              aria-label={t('assistant.widgets.open', { reference: label })}
              onClick={openPassage}
            >
              <ArrowUpRightIcon size={16} />
            </button>
          </header>
        )}
        {occurrence ? (
          <WordEntry occurrence={occurrence} passage={p} language={language} />
        ) : query.isPending ? (
          <div className="bs-widget-centered-loading">
            <Spinner aria-label={t('Chargement...')} color="accent" size="md" />
          </div>
        ) : query.isError ? (
          <div className="bs-widget-unavailable">
            <p>{t('assistant.widgets.resourceUnavailable')}</p>
            <button onClick={() => void query.refetch()}>{t('assistant.errors.retry')}</button>
          </div>
        ) : (
          <>
            <StrongResourceScrollProvider
              value={{
                currentTarget: null,
                registerStrongWordLayout: () => {},
                scrollToStrongCard: (_reference, index) => setSelected(index),
              }}
            >
              <div className="bs-widget-canonical-words">
                <CanonicalStrongVerseText
                  verse={query.data.verse}
                  small
                  textStyle={{
                    fontFamily: resolveFontFamily(theme.fontFamily.text),
                    fontSize: 15,
                    lineHeight: 26,
                  }}
                />
              </div>
            </StrongResourceScrollProvider>
            <p className="bs-widget-word-hint">{t('assistant.widgets.chooseWord')}</p>
          </>
        )}
      </div>
    </WidgetFrame>
  )
}
