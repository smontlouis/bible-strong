import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon, BookOpenIcon, VideoIcon, LibraryIcon } from 'lucide-react'
import type {
  FurtherResourcesWidget as Descriptor,
  ResourceSuggestion,
} from '@bible-strong/ai-contract/contract'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getPassageMediaById, formatPassageMediaDuration } from '~features/bible/passageMedia'
import WidgetFrame from './WidgetFrame.web'
export function suggestionRoute(item: ResourceSuggestion) {
  switch (item.kind) {
    case 'media':
      return {
        pathname: '/passage-media-player' as const,
        params: { workId: item.id, language: item.language },
      }
    case 'reading':
      return { pathname: '/plan' as const, params: { planId: item.id } }
    case 'dictionary':
      return {
        pathname: '/dictionnary-detail' as const,
        params: { work: item.work, entryId: item.id, word: item.word, language: item.language },
      }
    case 'commentary':
      return {
        pathname: '/commentary-chapter' as const,
        params: {
          projectionId: `${item.id}:${item.language}`,
          book: String(item.book),
          chapter: String(item.chapter),
        },
      }
    case 'nave':
      return {
        pathname: '/nave-detail' as const,
        params: { name: item.id, name_lower: item.id, language: item.language },
      }
  }
}
export default function FurtherResourcesWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    navigate = usePushRouteOnce()
  return (
    <WidgetFrame
      title={widget.title}
      eyebrow={t('assistant.widgets.furtherResources')}
      icon={<LibraryIcon size={17} />}
    >
      <p className="bs-widget-notice">{t('assistant.widgets.suggestionsNotice')}</p>
      {!!widget.unavailable?.length && (
        <p className="bs-widget-notice" role="status">
          {t('assistant.widgets.partialResources')}
        </p>
      )}
      {!widget.items.length ? (
        <p className="bs-widget-resource-empty">
          {t(
            widget.unavailable?.length
              ? 'assistant.widgets.resourceUnavailable'
              : 'assistant.widgets.noResources'
          )}
        </p>
      ) : (
        <ul className="bs-widget-resource-list">
          {widget.items.map((item, index) => {
            const media =
              item.kind === 'media' ? getPassageMediaById(item.id, item.language) : undefined
            return (
              <li key={`${item.kind}:${item.id}:${index}`}>
                <button
                  type="button"
                  disabled={item.kind === 'media' && !media}
                  onClick={() => navigate(suggestionRoute(item))}
                >
                  {item.kind === 'media' ? <VideoIcon size={18} /> : <BookOpenIcon size={18} />}
                  <span>
                    {media?.title || item.label}
                    <small>
                      {t(`assistant.widgets.resourceKind.${item.kind}`)} ·{' '}
                      {item.language.toUpperCase()}
                      {media ? ` · ${formatPassageMediaDuration(media.durationSeconds)}` : ''}
                      {item.kind === 'media' && !media
                        ? ` · ${t('assistant.widgets.resourceUnavailable')}`
                        : ''}
                    </small>
                  </span>
                  <ArrowUpRightIcon size={15} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetFrame>
  )
}
