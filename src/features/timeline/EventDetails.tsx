import React from 'react'
import FastImage from 'react-native-fast-image'
import Carousel from 'react-native-snap-carousel'
import {
  TabView,
  SceneRendererProps,
  NavigationState,
} from 'react-native-tab-view'
import { Portal } from 'react-native-paper'

import bibleMemoize from '~helpers/bibleStupidMemoize'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import waitForDatabase from '~common/waitForTimeline'
import { calculateLabel } from './constants'
import {
  TimelineEventDetail,
  TimelineEvent as TimelineEventProps,
} from './types'
import { wp, maxWidth } from '~helpers/utils'
import EventDetailsTab from './EventDetailsTab'
import EventDetailVerse from './EventDetailVerse'
import EventDetailsModal from './EventDetailsModal'
import { Modalize } from 'react-native-modalize'
import Link from '~common/Link'
import { flattenedEvents } from './events'
import { FeatherIcon } from '~common/ui/Icon'

const imageWidth = wp(80) > 600 ? 600 : wp(80)
const sliderWidth = maxWidth(wp(100), 600)

const Description = ({
  description,
  article,
}: Partial<TimelineEventDetail>) => {
  return (
    <Box px={20}>
      <Paragraph fontWeight="bold" scale={-1} mt={30}>
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
  const eventModalRef = React.useRef<Modalize>(null)
  const [event, setEvent] = React.useState<Partial<TimelineEventProps>>(null)
  return (
    <Box py={20}>
      {!!scriptures?.length && (
        <Box px={20}>
          <Paragraph fontFamily="title" mb={20}>
            Versets
          </Paragraph>
          {scriptures.map(scripture => (
            <Box mb={20} key={scripture}>
              <EventDetailVerse verses={scripture} />
            </Box>
          ))}
        </Box>
      )}
      {!!images?.length && (
        <Box py={20} bg="rgb(18,45,66)">
          <Paragraph fontFamily="title" mb={20} px={20} color="white">
            Images
          </Paragraph>
          <Carousel
            data={images}
            renderItem={({
              item,
            }: {
              item: TimelineEventDetail['images'][0]
            }) => (
              <Box>
                <FastImage
                  style={{ width: imageWidth, height: imageWidth }}
                  source={{
                    uri: `http://timeline.biblehistory.com/media/images/original/${item.file}`,
                  }}
                  resizeMode={FastImage.resizeMode.contain}
                />
                <Paragraph mt={15} scale={-3} textAlign="center" color="white">
                  {item.caption}
                </Paragraph>
              </Box>
            )}
            sliderWidth={sliderWidth}
            itemWidth={imageWidth}
          />
        </Box>
      )}
      {!!related?.length && (
        <Box p={20}>
          <Paragraph fontFamily="title" mb={20}>
            Évenements associés
          </Paragraph>
          {related.map(r => (
            <Link
              onPress={() => {
                const foundEvent = flattenedEvents.find(
                  ev => ev.slug === r.slug
                )
                if (foundEvent) {
                  setEvent(foundEvent)
                  eventModalRef.current?.open()
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

const EventDetails = waitForDatabase(
  ({
    slug,
    image,
    title,
    start,
    end,
  }: Pick<
    TimelineEventProps,
    'slug' | 'image' | 'title' | 'start' | 'end'
  >) => {
    const date = calculateLabel(start, end)
    const { current: event } = React.useRef(
      (bibleMemoize.timeline as TimelineEventDetail[]).find(
        e => e.slug === slug
      )
    )
    const [index, setIndex] = React.useState(0)
    const { current: routes } = React.useRef([
      { key: 'description', title: 'Article' },
      { key: 'media', title: 'En savoir plus' },
    ])

    if (!event) {
      return null
    }

    console.log(event)

    const renderScene = ({
      route,
    }: SceneRendererProps & {
      route: {
        key: string
        title: string
      }
    }) => {
      switch (route.key) {
        case 'description':
          return <Description {...event} />
        case 'media':
          return <Media {...event} key={route.key} />
        default:
          return null
      }
    }

    return (
      <Box py={40}>
        {image && (
          <Box center my={30}>
            <FastImage
              style={{ width: 150, height: 150, borderRadius: 10 }}
              source={{
                uri: image,
              }}
            />
          </Box>
        )}
        <Box mb={30} px={20}>
          <Paragraph textAlign="center" fontFamily="title" scale={3} flex>
            {title}
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
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          renderTabBar={(
            props: SceneRendererProps & {
              navigationState: NavigationState<{
                key: string
                title: string
              }>
            }
          ) => <EventDetailsTab setIndex={setIndex} {...props} />}
          onIndexChange={setIndex}
          initialLayout={{ width: wp(100) }}
        />
      </Box>
    )
  }
)

export default EventDetails
