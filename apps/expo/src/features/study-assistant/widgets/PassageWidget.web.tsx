import AssistantMarkdown from '../AssistantMarkdown.web'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSetAtom } from 'jotai'
import type { PassageTarget, PassageWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { previewHistoryAtom } from '~features/bibleReferencePreview/state'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import verseToReference from '~helpers/verseToReference'
import WidgetFrame, { useCloseExpandedWidget } from './WidgetFrame.web'
import { loadWidgetPassage } from './passageData'
import { getVersions, getBibleVersionVersificationId } from '~helpers/bibleVersions'
import { textDifferences } from './textDifferences'
const identity = (p: PassageTarget) => `${p.version}:${p.book}:${p.chapter}:${p.start}:${p.end}`
function PassageCard({
  passage,
  versions,
  onVersion,
  reference,
}: {
  passage: PassageTarget
  versions?: string[]
  onVersion?: (version: string) => void
  reference?: PassageTarget
}) {
  const closeExpanded = useCloseExpandedWidget()
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    setPreview = useSetAtom(previewHistoryAtom),
    navigate = usePushRouteOnce()
  const label = verseToReference({
    bookNum: passage.book,
    chapterNum: passage.chapter,
    verses: Array.from({ length: passage.end - passage.start + 1 }, (_, i) => passage.start + i),
  })
  const query = useQuery({
    queryKey: ['assistant-widget-passage', identity(passage)],
    queryFn: ({ signal }) => loadWidgetPassage(passage, resources.bibleContent, signal),
    staleTime: 300000,
  })
  const baseline = useQuery({
    queryKey: ['assistant-widget-passage', identity(reference || passage)],
    queryFn: ({ signal }) =>
      loadWidgetPassage(reference || passage, resources.bibleContent, signal),
    enabled: !!reference,
    staleTime: 300000,
  })
  const open = () => {
    closeExpanded()
    navigate({
      pathname: '/bible-view',
      params: {
        book: String(passage.book),
        chapter: String(passage.chapter),
        verse: String(passage.start),
        focusVerses: JSON.stringify(
          Array.from({ length: passage.end - passage.start + 1 }, (_, i) => passage.start + i)
        ),
        version: passage.version,
        contextDisplayMode: 'focused',
      },
    })
  }
  return (
    <article className="bs-widget-passage">
      <header>
        <button
          className="bs-widget-reference"
          type="button"
          onClick={() => {
            closeExpanded()
            setPreview([
              {
                kind: 'bible',
                title: label,
                version: passage.version,
                selections: [
                  {
                    book: passage.book,
                    chapter: passage.chapter,
                    start: passage.start,
                    end: passage.end,
                  },
                ],
                open,
              },
            ])
          }}
        >
          {label}
        </button>
        {onVersion ? (
          <select
            className="bs-widget-version-picker"
            aria-label={t('assistant.widgets.translationFor', {
              reference: label,
              version: passage.version,
            })}
            value={passage.version}
            onChange={event => onVersion(event.target.value)}
          >
            {versions?.map(version => (
              <option key={version} value={version}>
                {version} · {getVersions()[version]?.name || version}
              </option>
            ))}
          </select>
        ) : (
          <span className="bs-widget-version">{passage.version}</span>
        )}
        <button
          className="bs-widget-icon"
          type="button"
          aria-label={t('assistant.widgets.open', { reference: label })}
          onClick={open}
        >
          <ArrowUpRightIcon size={16} />
        </button>
      </header>
      {query.isPending ? (
        <div className="bs-widget-skeleton" role="status" aria-label={t('Chargement...')}>
          <span />
          <span />
          <span />
        </div>
      ) : query.isError ? (
        <div className="bs-widget-unavailable">
          <p>{t('assistant.widgets.unavailable')}</p>
          <button type="button" onClick={() => void query.refetch()}>
            {t('assistant.errors.retry')}
          </button>
        </div>
      ) : (
        <div className="bs-widget-verse-text">
          {query.data.map(verse => (
            <p key={verse.number}>
              <sup>{verse.number}</sup>
              {reference && baseline.data
                ? textDifferences(
                    verse.text,
                    baseline.data.find(item => item.number === verse.number)?.text || ''
                  ).map((part, i) =>
                    part.different ? <mark key={i}>{part.text}</mark> : part.text
                  )
                : verse.text}
            </p>
          ))}
        </div>
      )}
    </article>
  )
}
export default function PassageWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const [translationPassages, setTranslationPassages] = useState(widget.passages)
  const [differences, setDifferences] = useState(false)
  const translation = widget.kind === 'translation_comparison'
  const catalog = Object.values(getVersions()).filter(version => !version.hidden)
  const passages = translation ? translationPassages : widget.passages
  const body = () => (
    <>
      {translation && (
        <div className="bs-widget-translation-controls">
          <label>
            <input
              type="checkbox"
              checked={differences}
              onChange={event => setDifferences(event.target.checked)}
            />
            {t('assistant.widgets.highlightDifferences')}
          </label>
          <p>{t('assistant.widgets.differenceHint', { version: passages[0].version })}</p>
          {passages.some((p, i) => p.version !== widget.passages[i]?.version) && (
            <p>{t('assistant.widgets.translationChanged')}</p>
          )}
          {new Set(passages.map(p => getBibleVersionVersificationId(p.version))).size > 1 && (
            <p>{t('assistant.widgets.versificationHint')}</p>
          )}
        </div>
      )}
      <div className={`bs-widget-passages ${translation ? 'bs-widget-comparison' : ''}`}>
        {passages.map((passage, i) => (
          <PassageCard
            key={`${identity(passage)}:${i}`}
            passage={passage}
            versions={
              translation
                ? [
                    ...new Set([
                      passage.version,
                      ...catalog
                        .map(version => version.id)
                        .filter(
                          version =>
                            !passages.some((p, index) => index !== i && p.version === version)
                        ),
                    ]),
                  ]
                : undefined
            }
            onVersion={
              translation
                ? version =>
                    setTranslationPassages(previous =>
                      previous.map((p, index) => (index === i ? { ...p, version } : p))
                    )
                : undefined
            }
            reference={translation && differences && i > 0 ? passages[0] : undefined}
          />
        ))}
      </div>
      {widget.analysis && (
        <details className="bs-widget-analysis">
          <summary>{t('assistant.widgets.analysis')}</summary>
          <AssistantMarkdown text={widget.analysis} streaming={false} />
        </details>
      )}
    </>
  )
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t(`assistant.widgets.${translation ? widget.kind : 'passages'}`)}
      expanded={body()}
    >
      {body()}
    </WidgetFrame>
  )
}
