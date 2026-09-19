import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BookOpenIcon, ArrowUpRightIcon, PlayIcon } from 'lucide-react'
import type { BookWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getBook } from '~helpers/bibleBookCatalog'
import { getPassageMediaForBook, formatPassageMediaDuration } from '~features/bible/passageMedia'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { VersionCode } from '~state/tabs'
import WidgetFrame from './WidgetFrame.web'
export default function BookWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce(),
    book = getBook(widget.book)
  const [limit, setLimit] = useState(8)
  const media = getPassageMediaForBook(widget.book, widget.language)
  const query = useQuery({
    queryKey: ['assistant-book-outline', widget.version],
    queryFn: () => resources.bibleReading.loadPericope(widget.version as VersionCode),
    staleTime: 300000,
  })
  const headings = Object.entries(query.data?.[String(widget.book)] || {})
    .flatMap(([chapter, verses]) =>
      Object.entries(verses).flatMap(([verse, levels]) =>
        Object.values(levels)
          .filter((text): text is string => typeof text === 'string' && Boolean(text.trim()))
          .map(text => ({ chapter: Number(chapter), verse: Number(verse) || 1, text }))
      )
    )
    .filter(
      h =>
        Number.isInteger(h.chapter) &&
        h.chapter >= 1 &&
        h.chapter <= (book?.Chapitres || 0) &&
        Number.isInteger(h.verse) &&
        h.verse >= 1 &&
        h.verse <= 176
    )
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t('assistant.widgets.bookOverview')}
      icon={<BookOpenIcon size={17} />}
    >
      <div className="bs-widget-book">
        <div className="bs-widget-book-heading">
          <strong>{book?.Nom}</strong>
          <span>{t('assistant.widgets.chapterCount', { count: book?.Chapitres || 0 })}</span>
        </div>
        {media.length > 0 ? (
          <div className="bs-widget-book-media">
            {media.map(item => (
              <button
                key={item.workId}
                type="button"
                onClick={() =>
                  navigate({
                    pathname: '/passage-media-player',
                    params: { workId: item.workId, language: widget.language },
                  })
                }
              >
                <PlayIcon size={18} />
                <span>
                  {item.title}
                  <small>
                    {item.attributionLabel} · {formatPassageMediaDuration(item.durationSeconds)}
                  </small>
                </span>
                <ArrowUpRightIcon size={15} />
              </button>
            ))}
          </div>
        ) : (
          <p className="bs-widget-notice">{t('assistant.widgets.noPanorama')}</p>
        )}
        <h4>
          {t('assistant.widgets.bookOutline')} · {widget.version}
        </h4>
        {query.isPending ? (
          <p role="status">{t('Chargement...')}</p>
        ) : query.isError ? (
          <div className="bs-widget-unavailable">
            <p>{t('assistant.widgets.resourceUnavailable')}</p>
            <button type="button" onClick={() => void query.refetch()}>
              {t('assistant.errors.retry')}
            </button>
          </div>
        ) : headings.length ? (
          <ol className="bs-widget-outline">
            {headings.slice(0, limit).map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() =>
                    navigate({
                      pathname: '/bible-view',
                      params: {
                        book: String(widget.book),
                        chapter: String(h.chapter),
                        verse: String(h.verse),
                        version: widget.version,
                      },
                    })
                  }
                >
                  <small>
                    {h.chapter}:{h.verse}
                  </small>
                  {h.text}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="bs-widget-notice">{t('assistant.widgets.noOutline')}</p>
        )}
        {headings.length > limit && (
          <button
            type="button"
            className="bs-widget-load-more"
            onClick={() => setLimit(n => n + 12)}
          >
            {t('assistant.widgets.more')}
          </button>
        )}
        <details className="bs-widget-chapters">
          <summary>{t('assistant.widgets.chapters')}</summary>
          <div>
            {Array.from({ length: book?.Chapitres || 0 }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${book?.Nom} ${i + 1}`}
                onClick={() =>
                  navigate({
                    pathname: '/bible-view',
                    params: {
                      book: String(widget.book),
                      chapter: String(i + 1),
                      version: widget.version,
                    },
                  })
                }
              >
                {i + 1}
              </button>
            ))}
          </div>
        </details>
      </div>
    </WidgetFrame>
  )
}
