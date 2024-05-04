import BottomSheet from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useMemo } from 'react'
import Carousel from 'react-native-reanimated-carousel'
import useLanguage from '~helpers/useLanguage'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import waitForTimeline from '~common/waitForTimeline'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import { wp } from '~helpers/utils'
import { calculateLabel } from './constants'
import {
  TimelineEvent,
  TimelineEventDetail,
  TimelineEvent as TimelineEventProps,
} from './types'
// import EventDetailsTab from './EventDetailsTab'
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

const Description = ({
  description,
  article,
}: Partial<TimelineEventDetail>) => {
  return (
    <Box px={20}>
      <Paragraph fontFamily="title" mb={10}>
        Description
      </Paragraph>
      <Paragraph fontWeight="bold" scale={-1}>
        {description}
      </Paragraph>
      <Paragraph marginTop={20} scale={-1}>
        {article}
      </Paragraph>
    </Box>
  )
}

const Media = ({
  images,
  scriptures,
  videos,
  related,
}: Pick<
  TimelineEventDetail,
  'images' | 'scriptures' | 'videos' | 'related'
>) => {
  const { t } = useTranslation()
  const eventModalRef = React.useRef<BottomSheet>(null)
  const [event, setEvent] = React.useState<Partial<TimelineEventProps>>(null)

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
            renderItem={({
              item,
            }: {
              item: TimelineEventDetail['images'][0]
            }) => (
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
            panGestureHandlerProps={{
              activeOffsetX: [-10, 10],
            }}
            style={{
              width: sliderWidth,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            width={imageWidth + 20}
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
                const foundEvent = flattenedEvents?.find(
                  ev => ev.slug === r.slug
                )
                if (foundEvent) {
                  setEvent(foundEvent)
                  eventModalRef.current?.expand()
                } else {
                  console.log("Can't open this event.")
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
          <Portal>
            <EventDetailsModal modalRef={eventModalRef} event={event} />
          </Portal>
        </Box>
      )}
    </Box>
  )
}

const EventDetails = waitForTimeline(
  ({
    slug,
    image,
    title,
    titleEn,
    start,
    end,
  }: Pick<
    TimelineEventProps,
    'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'
  >) => {
    const isFR = useLanguage()
    const date = calculateLabel(start, end)
    const event = useMemo(() => {
      return (bibleMemoize.timeline as TimelineEventDetail[]).find(
        e => e.slug === slug
      )
    }, [slug])

    if (!event) {
      return null
    }

    return (
      <Box py={40}>
        {image && (
          <Box center my={30}>
            <Image
              style={{ width: 150, height: 150, borderRadius: 10 }}
              source={{
                uri: image,
              }}
            />
          </Box>
        )}
        <Box mb={30} px={20}>
          <Paragraph textAlign="center" fontFamily="title" scale={3} flex>
            {isFR ? title : titleEn}
          </Paragraph>
          <Paragraph
            color="grey"
            scale={-2}
            textAlign="center"
            fontFamily="text"
          >
            {date}
          </Paragraph>
        </Box>
        <Description {...event} />
        <Media {...event} />
      </Box>
    )
  }
)

export default EventDetails
