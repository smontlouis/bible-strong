import { BottomSheetModal } from '@gorhom/bottom-sheet'
import React from 'react'
import Carousel from 'react-native-reanimated-carousel'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { wp } from '~helpers/utils'
import { TimelineEvent, TimelineEventDetail, TimelineEvent as TimelineEventProps } from './types'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import { useQuery } from '~helpers/react-query-lite'
import EventDetailVerse from './EventDetailVerse'
import EventDetailsModal from './EventDetailsModal'
import { getEvents } from './events'

const imageWidth = wp(80, true)
const sliderWidth = wp(100, true)

const Media = ({
  images,
  scriptures,
  videos,
  related,
}: Pick<TimelineEventDetail, 'images' | 'scriptures' | 'videos' | 'related'>) => {
  const { t } = useTranslation()
  const eventModalRef = React.useRef<BottomSheetModal>(null)
  const [event, setEvent] = React.useState<Partial<TimelineEventProps> | null>(null)

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
            data={images}
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
                  setEvent(foundEvent)
                  console.log('[Timeline] Opening event modal')
                  eventModalRef.current?.present()
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
          <EventDetailsModal modalRef={eventModalRef} event={event} />
        </Box>
      )}
    </Box>
  )
}

export default Media
