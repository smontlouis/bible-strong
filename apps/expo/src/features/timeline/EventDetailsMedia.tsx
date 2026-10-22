import { Image } from 'expo-image'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Carousel } from 'react-native-reanimated-carousel'
import { configureCarouselPan } from '~helpers/configureCarouselPan'
import Link from '~common/Link'
import Box, { VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { StudySection } from '~common/ui/StudySection'
import { radii } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import { useQuery } from '@tanstack/react-query'
import { useLayoutSize } from '~helpers/useLayoutSize'
import EventDetailVerse from './EventDetailVerse'
import { timelineEventsQueryOptions } from './timelineEventsQuery'
import { getTimelineImageUri } from './timelineImage'
import { TimelineEvent, TimelineEventDetail } from './types'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const Media = ({
  images,
  scriptures,
  related,
  onOpenEvent,
}: Pick<TimelineEventDetail, 'images' | 'scriptures' | 'videos' | 'related'> & {
  onOpenEvent?: (event: TimelineEvent) => void
}) => {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const { ref, size, onLayout } = useLayoutSize()
  const sliderWidth = size.width
  const imageWidth = Math.max(0, sliderWidth * 0.8)

  const { data: events } = useQuery(timelineEventsQueryOptions)

  const flattenedEvents = events?.reduce((acc: TimelineEvent[], curr, sectionIndex) => {
    return [...acc, ...curr.events.map(event => ({ ...event, sectionIndex }))]
  }, [])

  return (
    <VStack ref={ref} onLayout={onLayout}>
      {!!scriptures?.length && (
        <StudySection title={t('Versets')} surface="rows">
          {/* An event can cite the same passage twice. */}
          {scriptures.map((scripture, index) => (
            <EventDetailVerse key={`${index}:${scripture}`} verses={scripture} />
          ))}
        </StudySection>
      )}
      {!!images?.length && (
        <StudySection title={t('Images')} surface="none">
          {/* The carousel runs to the edges of the page, its images take a card's corners. */}
          <Carousel
            loop
            itemSize={imageWidth + 20}
            data={images}
            contentContainerStyle={{
              alignItems: 'center',
              justifyContent: 'center',
            }}
            renderItem={({ item }: { item: TimelineEventDetail['images'][0] }) => (
              <Box className="overflow-hidden border-continuous">
                <Image
                  draggable={false}
                  style={{ width: imageWidth, height: imageWidth, borderRadius: radii.card }}
                  source={{ uri: getTimelineImageUri(item.file, 'original') }}
                  contentFit="contain"
                />
                <Text className="mt-[10px] text-center text-[13px] text-grey">{item.caption}</Text>
              </Box>
            )}
            onConfigurePanGesture={configureCarouselPan([-10, 10])}
            style={{
              width: sliderWidth,
              height: imageWidth + 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </StudySection>
      )}
      {!!related?.length && (
        <StudySection title={t('timeline.event.related')} surface="rows">
          {related.map(r => (
            <Link
              key={r.slug}
              onPress={() => {
                const foundEvent = flattenedEvents?.find(ev => ev.slug === r.slug)
                if (foundEvent && onOpenEvent) {
                  onOpenEvent(foundEvent)
                } else if (foundEvent) {
                  pushRouteOnce({
                    pathname: '/event',
                    params: { slug: foundEvent.slug },
                  })
                } else {
                  console.log("[Timeline] Can't open this event.")
                }
              }}
            >
              <Box className="overflow-hidden border-continuous px-[16px] py-[12px] flex-row items-center gap-[12px]">
                <Text className="flex-[1] text-[15px]">{r.title}</Text>
                <FeatherIcon name="chevron-right" size={18} color="grey" />
              </Box>
            </Link>
          ))}
        </StudySection>
      )}
    </VStack>
  )
}

export default Media
