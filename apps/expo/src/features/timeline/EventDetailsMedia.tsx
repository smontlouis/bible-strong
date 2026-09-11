import { Image } from 'expo-image'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Carousel from 'react-native-reanimated-carousel'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { useQuery } from '@tanstack/react-query'
import { useLayoutSize } from '~helpers/useLayoutSize'
import EventDetailVerse from './EventDetailVerse'
import { getEvents } from './events'
import { TimelineEvent, TimelineEventDetail } from './types'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const Media = ({
  images,
  scriptures,
  videos,
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

  const { data: events } = useQuery({
    queryKey: ['timeline'],
    queryFn: getEvents,
  })

  const flattenedEvents = events?.reduce((acc: TimelineEvent[], curr, sectionIndex) => {
    return [...acc, ...curr.events.map(event => ({ ...event, sectionIndex }))]
  }, [])

  return (
    <Box ref={ref} onLayout={onLayout} className="overflow-hidden border-continuous py-[20px]">
      {!!scriptures?.length && (
        <Box className="overflow-hidden border-continuous px-[20px] mt-[20px]">
          <Paragraph className="mb-[10px]" fontFamily="title">
            {t('Versets')}
          </Paragraph>
          {scriptures.map(scripture => (
            <Box className="overflow-hidden border-continuous" key={scripture}>
              <EventDetailVerse verses={scripture} />
            </Box>
          ))}
        </Box>
      )}
      {!!images?.length && (
        <Box className="overflow-hidden border-continuous py-[20px] bg-[rgb(18,45,66)]">
          <Paragraph className="mb-[20px] px-[20px] text-[white]" fontFamily="title">
            {t('Images')}
          </Paragraph>
          <Carousel
            itemWidth={imageWidth + 20}
            itemHeight={imageWidth + 60}
            data={images}
            contentContainerStyle={{
              alignItems: 'center',
              justifyContent: 'center',
            }}
            renderItem={({ item }: { item: TimelineEventDetail['images'][0] }) => (
              <Box className="overflow-hidden border-continuous">
                <Image
                  draggable={false}
                  style={{ width: imageWidth, height: imageWidth }}
                  source={{
                    uri: `http://timeline.biblehistory.com/media/images/original/${item.file}`,
                  }}
                  contentFit="contain"
                />
                <Paragraph className="mt-[15px] text-center text-[white]" scale={-3}>
                  {item.caption}
                </Paragraph>
              </Box>
            )}
            onConfigurePanGesture={gestureChain => {
              gestureChain.activeOffsetX([-10, 10])
            }}
            style={{
              width: sliderWidth,
              height: imageWidth + 60,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </Box>
      )}
      {!!related?.length && (
        <Box className="overflow-hidden border-continuous p-[20px]">
          <Paragraph className="mb-[20px]" fontFamily="title">
            {t('Évenements associés')}
          </Paragraph>
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
              <Box
                className="overflow-hidden border-continuous bg-reverse p-[20px] rounded-[20px] mb-[20px] flex-row"
                style={{
                  shadowColor: 'rgb(89,131,240)',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 7,
                  elevation: 1,
                  overflow: 'visible',
                }}
              >
                <Paragraph className="flex-[1]" key={r.slug}>
                  {r.title}
                </Paragraph>
                <Box className="overflow-hidden border-continuous items-center flex-row">
                  <FeatherIcon name="chevron-right" size={22} color="primary" />
                </Box>
              </Box>
            </Link>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default Media
