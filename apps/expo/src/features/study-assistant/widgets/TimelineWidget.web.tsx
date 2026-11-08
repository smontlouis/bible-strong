import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TimelineWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { calculateLabel } from '~features/timeline/constants'
import { getEvents } from '~features/timeline/events'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { QuoteBlock, QuoteLoading, QuoteMore } from './QuoteBlock.web'
import { orderTimelineRows } from './timelineRows'

const SHOWN_EVENTS = 3

/** Events in order, each a date, a title and two lines; each opens its event. */
export default function TimelineWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const navigate = usePushRouteOnce()
  const [all, setAll] = useState(false)
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
  const events = query.data || []
  const shown = all ? events : events.slice(0, SHOWN_EVENTS)
  return (
    <QuoteBlock
      mark="timeline"
      foot={t('assistant.widgets.timelineFoot', { count: widget.events.length })}
    >
      {query.isPending && <QuoteLoading label={t('Chargement...')} />}
      {query.isError && (
        <p className="bs-quote-muted">{t('assistant.widgets.resourceUnavailable')}</p>
      )}
      {shown.length > 0 && (
        <ol className="bs-quote-events">
          {shown.map(event => (
            <li key={event.slug}>
              <button
                type="button"
                className="bs-quote-event"
                disabled={!event.detail}
                onClick={() =>
                  navigate({
                    pathname: '/event',
                    params: { slug: event.slug, language: widget.language },
                  })
                }
              >
                <span className="bs-quote-event-date">
                  {event.position
                    ? calculateLabel(event.position.start, event.position.end, widget.language)
                    : event.detail?.dates || t('assistant.widgets.unknownDate')}
                  {event.position?.approx ? ` · ${t('assistant.widgets.approximate')}` : ''}
                </span>
                <span className="bs-quote-event-title">
                  {event.detail?.title ||
                    (widget.language === 'en' ? event.meta?.titleEn : event.meta?.title) ||
                    t('assistant.widgets.resourceUnavailable')}
                </span>
                {!!event.detail?.description && (
                  <span className="bs-quote-event-text">{event.detail.description}</span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
      {events.length > shown.length && (
        <QuoteMore
          label={t('assistant.widgets.moreEvents', { count: events.length - shown.length })}
          onPress={() => setAll(true)}
        />
      )}
    </QuoteBlock>
  )
}
