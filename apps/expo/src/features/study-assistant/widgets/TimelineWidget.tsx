import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TimelineWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { calculateLabel } from '~features/timeline/constants'
import { getEvents } from '~features/timeline/events'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { QuoteBlock, QuoteMore } from './QuoteBlock'
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
      {query.isError && (
        <Text className="text-grey text-[15px]">{t('assistant.widgets.resourceUnavailable')}</Text>
      )}
      {shown.map((event, index) => (
        <TouchableBox
          key={event.slug}
          accessibilityRole="button"
          disabled={!event.detail}
          onPress={() =>
            navigate({
              pathname: '/event',
              params: { slug: event.slug, language: widget.language },
            })
          }
          className={index ? 'mt-3' : ''}
        >
          <Text className="text-grey text-[12px] font-semibold">
            {event.position
              ? calculateLabel(event.position.start, event.position.end, widget.language)
              : event.detail?.dates || t('assistant.widgets.unknownDate')}
            {event.position?.approx ? ` · ${t('assistant.widgets.approximate')}` : ''}
          </Text>
          <Text className="text-[15px] font-semibold">
            {event.detail?.title ||
              (widget.language === 'en' ? event.meta?.titleEn : event.meta?.title) ||
              t('assistant.widgets.resourceUnavailable')}
          </Text>
          {!!event.detail?.description && (
            <Text className="text-[14px] leading-[21px]" numberOfLines={2}>
              {event.detail.description}
            </Text>
          )}
        </TouchableBox>
      ))}
      {events.length > shown.length && (
        <QuoteMore
          label={t('assistant.widgets.moreEvents', { count: events.length - shown.length })}
          onPress={() => setAll(true)}
        />
      )}
    </QuoteBlock>
  )
}
