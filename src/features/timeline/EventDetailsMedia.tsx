import { Image } from 'expo-image'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Carousel from 'react-native-reanimated-carousel'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { useQuery } from '~helpers/react-query-lite'
import { wp } from '~helpers/utils'
import EventDetailVerse from './EventDetailVerse'
import { useEventDetailsModal } from './EventDetailsModalContext'
import { getEvents } from './events'
import { TimelineEvent, TimelineEventDetail } from './types'

const imageWidth = wp(80, true)
const sliderWidth = wp(100, true)

const Media = ({
  images,
  scriptures,
  videos,
  related,
}: Pick<TimelineEventDetail, 'images' | 'scriptures' | 'videos' | 'related'>) => {
  const { t } = useTranslation()
  const { openEvent } = useEventDetailsModal()

  const { data: events } = useQuery({
    queryKey: 'timeline',
    queryFn: getEvents,
  })

  const flattenedEvents = events?.reduce((acc: TimelineEvent[], curr) => {
    return [...acc, ...curr.events]
  }, [])

  return (
    <Box py={20}>
      {!!scriptures?.length && (
        <Box px={20} mt={20}>
          <Paragraph fontFamily="title" mb={10}>
            {t('Versets')}
          </Paragraph>
          {scriptures.map(scripture => (
            <Box key={scripture}>
              <EventDetailVerse verses={scripture} />
            </Box>
          ))}
        </Box>
      )}
      {!!images?.length && (
        <Box py={20} bg="rgb(18,45,66)" height={400}>
          <Paragraph fontFamily="title" mb={20} px={20} color="white">
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
              <Box>
                <Image
                  style={{ width: imageWidth, height: imageWidth }}
                  source={{
                    uri: `http://timeline.biblehistory.com/media/images/original/${item.file}`,
                  }}
                  contentFit="contain"
                />
                <Paragraph mt={15} scale={-3} textAlign="center" color="white">
                  {item.caption}
                </Paragraph>
              </Box>
            )}
            onConfigurePanGesture={gestureChain => {
              gestureChain.activeOffsetX([-10, 10])
            }}
            style={{
              width: sliderWidth,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            width={imageWidth + 20}
            height={imageWidth + 60}
          />
        </Box>
      )}
      {!!related?.length && (
        <Box p={20}>
          <Paragraph fontFamily="title" mb={20}>
            {t('Évenements associés')}
          </Paragraph>
          {related.map(r => (
            <Link
              key={r.slug}
              onPress={() => {
                const foundEvent = flattenedEvents?.find(ev => ev.slug === r.slug)
                if (foundEvent) {
                  openEvent(foundEvent)
                } else {
                  console.log("[Timeline] Can't open this event.")
                }
              }}
            >
              <Box lightShadow bg="reverse" p={20} rounded mb={20} row>
                <Paragraph flex key={r.slug}>
                  {r.title}
                </Paragraph>
                <Box alignItems="center" row>
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
