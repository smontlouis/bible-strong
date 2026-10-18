import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TimelineWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { calculateLabel } from '~features/timeline/constants'
import { getEvents } from '~features/timeline/events'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { orderTimelineRows } from './timelineRows'
import WidgetFrame, {
  WidgetLoading,
  WidgetNotice,
  WidgetOpenButton,
  WidgetUnavailable,
} from './WidgetFrame'

function Events({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation(),
    resources = useResourceAccess(),
    navigate = usePushRouteOnce()
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
  if (query.isPending) return <WidgetLoading />
  if (query.isError) return <WidgetUnavailable onRetry={() => void query.refetch()} />
  return (
    <>
      <WidgetNotice>{t('assistant.widgets.timelineNotice')}</WidgetNotice>
      <Box className="border-border ml-[5px] mt-3 border-l pl-4">
        {query.data.map(event => (
          <Box key={event.slug} className="pb-4">
            <Box className="bg-primary absolute left-[-21px] top-[5px] h-[9px] w-[9px] rounded-full" />
            <Text className="text-grey text-[12px] font-semibold">
              {event.position
                ? calculateLabel(event.position.start, event.position.end, widget.language)
                : event.detail?.dates || t('assistant.widgets.unknownDate')}
              {event.position?.approx ? ` · ${t('assistant.widgets.approximate')}` : ''}
            </Text>
            <Text className="text-[15px] font-bold">
              {event.detail?.title ||
                (widget.language === 'en' ? event.meta?.titleEn : event.meta?.title) ||
                t('assistant.widgets.resourceUnavailable')}
            </Text>
            {!event.position && (
              <Text className="text-grey text-[12px]">{t('assistant.widgets.unknownOrder')}</Text>
            )}
            <Text className="mt-1 text-[14px] leading-[22px]" numberOfLines={6}>
              {event.detail?.description || t('assistant.widgets.resourceUnavailable')}
            </Text>
            {event.detail && (
              <HStack className="pt-1">
                <WidgetOpenButton
                  label={t('assistant.widgets.openEvent')}
                  onPress={() =>
                    navigate({
                      pathname: '/event',
                      params: { slug: event.slug, language: widget.language },
                    })
                  }
                />
              </HStack>
            )}
          </Box>
        ))}
      </Box>
    </>
  )
}

export default function TimelineWidget({ widget }: { widget: Descriptor }) {
  const { t } = useTranslation()
  return (
    <WidgetFrame icon="clock" title={widget.title} eyebrow={t('assistant.widgets.timeline')}>
      <Box className="px-3 py-[10px]">
        <Events widget={widget} />
      </Box>
    </WidgetFrame>
  )
}
