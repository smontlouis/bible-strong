import { calculateLabel } from '~features/timeline/constants'
import { orderTimelineRows } from './timelineRows'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRightIcon, ClockIcon } from 'lucide-react'
import type { TimelineWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { getEvents } from '~features/timeline/events'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import WidgetFrame, { useCloseExpandedWidget } from './WidgetFrame.web'
function Events({ widget, expanded = false }: { widget: Descriptor; expanded?: boolean }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce(),
    close = useCloseExpandedWidget()
  const query = useQuery({
    queryKey: ['assistant-timeline', widget.events, widget.language],
    queryFn: async () => {
      const [sections, details] = await Promise.all([
        getEvents().catch(() => []),
        Promise.all(widget.events.map(slug => resources.timeline.loadEvent(widget.language, slug))),
      ])
      return orderTimelineRows(
        details.map((detail, index) => {
          if (detail.status !== 'available')
            return {
              slug: widget.events[index],
              meta: sections.flatMap(s => s.events).find(e => e.slug === widget.events[index]),
            }
          const meta = sections.flatMap(s => s.events).find(e => e.slug === detail.detail.slug)
          return { slug: detail.detail.slug, detail: detail.detail, meta }
        })
      )
    },
    staleTime: 300000,
  })
  if (query.isPending)
    return (
      <p className="bs-widget-timeline-status" role="status">
        {t('Chargement...')}
      </p>
    )
  if (query.isError)
    return (
      <div className="bs-widget-timeline-status">
        <p>{t('assistant.widgets.resourceUnavailable')}</p>
        <button type="button" onClick={() => void query.refetch()}>
          {t('assistant.errors.retry')}
        </button>
      </div>
    )
  return (
    <>
      <p className="bs-widget-notice">{t('assistant.widgets.timelineNotice')}</p>
      <ol className={`bs-widget-timeline ${expanded ? 'bs-widget-timeline-wide' : ''}`}>
        {query.data.map(event => (
          <li key={event.slug}>
            <div className="bs-widget-time-dot" />
            <small>
              {event.position
                ? calculateLabel(event.position.start, event.position.end, widget.language)
                : event.detail?.dates || t('assistant.widgets.unknownDate')}
              {event.position?.approx ? ` · ${t('assistant.widgets.approximate')}` : ''}
            </small>
            <h4>
              {event.detail?.title ||
                (widget.language === 'en' ? event.meta?.titleEn : event.meta?.title) ||
                t('assistant.widgets.resourceUnavailable')}
            </h4>
            {!event.position && <small>{t('assistant.widgets.unknownOrder')}</small>}
            <p>{event.detail?.description || t('assistant.widgets.resourceUnavailable')}</p>
            {event.detail && (
              <button
                type="button"
                onClick={() => {
                  close()
                  navigate({
                    pathname: '/event',
                    params: { slug: event.slug, language: widget.language },
                  })
                }}
              >
                {t('assistant.widgets.openEvent')}
                <ArrowUpRightIcon size={14} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
export default function TimelineWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  return (
    <WidgetFrame
      icon={<ClockIcon size={17} />}
      title={widget.title}
      eyebrow={t('assistant.widgets.timeline')}
      expanded={<Events widget={widget} expanded />}
    >
      <Events widget={widget} />
    </WidgetFrame>
  )
}
