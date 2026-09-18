import { useSetAtom } from 'jotai'
import { ArrowUpRightIcon } from 'lucide-react'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { PassageWidget } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { buildCanonicalStrongVerseRuns } from '~helpers/canonicalStrongVerse'
import verseToReference from '~helpers/verseToReference'
import WidgetFrame from './WidgetFrame.web'
import StrongWidget from './StrongWidget.web'
export default function VerseAnalysisWidget({ widget }: { widget: PassageWidget }) {
  const { t, i18n } = useTranslation(),
    resources = useResourceAccess(),
    p = widget.passages[0]
  const [selected, setSelected] = useState<number | null>(null)
  const [identityIndex, setIdentityIndex] = useState(0)
  const query = useQuery({
    queryKey: ['assistant-word-analysis', p.version, p.book, p.chapter, p.start],
    queryFn: async () => {
      const result = await resources.strongBible.loadVerse({
        currentVersionId: p.version,
        defaultVersionId: p.version === 'KJV' ? 'KJV' : 'LSG',
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
  const setPreview = useSetAtom(previewHistoryAtom),
    navigate = usePushRouteOnce()
  const label = verseToReference({ bookNum: p.book, chapterNum: p.chapter, verses: [p.start] }),
    version = query.data?.provenance.versionId || p.version
  const openPassage = () =>
    navigate({
      pathname: '/bible-view',
      params: {
        book: String(p.book),
        chapter: String(p.chapter),
        verse: String(p.start),
        focusVerses: JSON.stringify([p.start]),
        version,
        contextDisplayMode: 'focused',
      },
    })
  const runs = query.data
    ? buildCanonicalStrongVerseRuns(query.data.verse.Texte, query.data.verse.StrongSpans)
    : []
  const run = selected === null ? undefined : runs[selected]
  const identity = run?.kind === 'strong' ? run.identities[identityIndex] : undefined
  const codes =
    run?.kind === 'strong' && identity
      ? [
          ...new Set(
            run.morphologies
              ?.filter(m => m.identity.code === identity.code && m.identity.kind === identity.kind)
              .flatMap(m => m.codes) || []
          ),
        ]
      : []
  const morphology = useQuery({
    queryKey: ['assistant-word-morphology', codes, i18n.language],
    queryFn: () =>
      resources.strongLexicon.loadMorphologies(codes, i18n.language.startsWith('en') ? 'en' : 'fr'),
    enabled: codes.length > 0,
    staleTime: 300000,
  })
  return (
    <div className="bs-widget-analysis-group">
      <WidgetFrame title={widget.title} eyebrow={t('assistant.widgets.wordAnalysis')}>
        <div className="bs-widget-word-analysis">
          <header>
            <button
              type="button"
              className="bs-widget-reference"
              onClick={() =>
                setPreview([
                  {
                    kind: 'bible',
                    title: label,
                    version,
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
            <span>{version}</span>
            <button
              type="button"
              className="bs-widget-icon"
              aria-label={t('assistant.widgets.open', { reference: label })}
              onClick={openPassage}
            >
              <ArrowUpRightIcon size={16} />
            </button>
          </header>
          {query.isPending ? (
            <p role="status">{t('Chargement...')}</p>
          ) : query.isError ? (
            <div>
              <p>{t('assistant.widgets.resourceUnavailable')}</p>
              <button type="button" onClick={() => void query.refetch()}>
                {t('assistant.errors.retry')}
              </button>
            </div>
          ) : (
            <>
              <p className="bs-widget-word-text">
                {runs.map((r, index) =>
                  r.kind === 'text' ? (
                    <span key={index}>{r.text}</span>
                  ) : (
                    <button
                      type="button"
                      key={index}
                      aria-pressed={selected === index}
                      onClick={() => {
                        setSelected(index)
                        setIdentityIndex(0)
                      }}
                    >
                      {r.word || t('assistant.widgets.untranslated')}
                    </button>
                  )
                )}
              </p>
              <p className="bs-widget-word-hint">{t('assistant.widgets.chooseWord')}</p>
              {run?.kind === 'strong' && (
                <div className="bs-widget-word-details">
                  <strong>{run.word || t('assistant.widgets.untranslated')}</strong>
                  <div>
                    {run.identities.map((i, index) => (
                      <button
                        type="button"
                        key={`${i.kind}:${i.code}`}
                        aria-pressed={index === identityIndex}
                        onClick={() => setIdentityIndex(index)}
                      >
                        <code>{i.code}</code>
                      </button>
                    ))}
                  </div>
                  {codes.length > 0 ? (
                    <>
                      <small>{t('assistant.widgets.morphology')}</small>
                      {morphology.isPending ? (
                        <p>{t('Chargement...')}</p>
                      ) : morphology.isError ? (
                        <p>{t('assistant.widgets.resourceUnavailable')}</p>
                      ) : (
                        codes.map(code => {
                          const m = morphology.data?.find(item => item.code === code)
                          return (
                            <p key={code}>
                              <code>{code}</code>{' '}
                              {m?.meaning || t('assistant.widgets.resourceUnavailable')}
                              {m?.description ? ` · ${m.description}` : ''}
                            </p>
                          )
                        })
                      )}
                    </>
                  ) : (
                    <p>{t('assistant.widgets.noMorphology')}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </WidgetFrame>
      {identity && (
        <StrongWidget
          widget={{
            id: widget.id,
            kind: 'strong_entry',
            title: identity.code,
            reference: identity.code,
            identityKind: identity.kind,
            language: i18n.language.startsWith('en') ? 'en' : 'fr',
            scope: 'precise_identity',
          }}
        />
      )}
    </div>
  )
}
