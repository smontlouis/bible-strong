import React from 'react'
import FastImage from 'react-native-fast-image'
import Carousel from 'react-native-snap-carousel'
import {
  TabView,
  SceneRendererProps,
  NavigationState,
} from 'react-native-tab-view'

import bibleMemoize from '~helpers/bibleStupidMemoize'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import waitForDatabase from '~common/waitForStrongDB'
import { calculateLabel } from './constants'
import {
  TimelineEventDetail,
  TimelineEvent as TimelineEventProps,
} from './types'
import { wp, maxWidth } from '~helpers/utils'
import EventDetailsTab from './EventDetailsTab'

const imageWidth = wp(80) > 600 ? 600 : wp(80)
const sliderWidth = maxWidth(wp(100), 600)

const Description = ({
  description,
  article,
}: Partial<TimelineEventDetail>) => (
  <Box px={20}>
    <Paragraph fontWeight="bold" scale={-1} mt={30}>
      {description}
    </Paragraph>
    <Paragraph marginTop={20} scale={-1}>
      {article}
    </Paragraph>
  </Box>
)

const Media = ({ images }: Partial<TimelineEventDetail>) => (
  <Box py={20}>
    <Carousel
      data={images}
      renderItem={({ item }: { item: TimelineEventDetail['images'][0] }) => (
        <Box>
          <FastImage
            style={{ width: imageWidth, height: imageWidth }}
            source={{
              uri: `http://timeline.biblehistory.com/media/images/original/${item.file}`,
            }}
            resizeMode={FastImage.resizeMode.contain}
          />
          <Paragraph mt={15} scale={-3} textAlign="center">
            {item.caption}
          </Paragraph>
        </Box>
      )}
      sliderWidth={sliderWidth}
      itemWidth={imageWidth}
    />
  </Box>
)

const EventDetails = waitForDatabase(
  ({ slug, image, title, start, end }: Partial<TimelineEventProps>) => {
    const date = calculateLabel(start, end)
    const { current: event } = React.useRef(
      (bibleMemoize['timeline'] as TimelineEventDetail[]).find(
        e => e.slug === slug
      )
    )
    const [index, setIndex] = React.useState(0)
    const { current: routes } = React.useRef([
      { key: 'description', title: 'Description' },
      { key: 'media', title: 'Images' },
    ])

    if (!event) {
      return null
    }

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
          return <Media {...event} />
        default:
          return null
      }
    }

    // console.log(event)

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
