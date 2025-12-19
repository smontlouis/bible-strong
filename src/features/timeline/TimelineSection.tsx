import BottomSheet, { BottomSheetModal } from '@gorhom/bottom-sheet'
import algoliasearch from 'algoliasearch/lite'
import React from 'react'
import { InstantSearch } from 'react-instantsearch-native'
import { useSharedValue } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import useLanguage from '~helpers/useLanguage'
import CurrentSectionImage from './CurrentSectionImage'
import CurrentYear from './CurrentYear'
import Datebar from './Datebar'
import EventDetailsModal from './EventDetailsModal'
import Line from './Line'
import NextSectionImage from './NextSectionImage'
import PrevSectionImage from './PrevSectionImage'
import ScrollView from './ScrollView'
import SearchInTimelineModal from './SearchInTimelineModal'
import SectionDetailsModal from './SectionDetailsModal'
import TimelineEvent from './TimelineEvent'
import TimelineHeader from './TimelineHeader'
import { useTimeline } from './timeline.hooks'
import {
  ShallowTimelineSection,
  TimelineEvent as TimelineEventProps,
  TimelineSection as TimelineSectionProps,
} from './types'
const searchClient = algoliasearch(
  process.env.EXPO_PUBLIC_ALGOLIA_APP_ID || '',
  process.env.EXPO_PUBLIC_ALGOLIA_API_KEY || ''
)

interface Props extends TimelineSectionProps {
  onPrev: () => void
  onNext: () => void
  isCurrent: boolean
  isFirst?: boolean
  isLast?: boolean
  entrance: 0 | 1
  prevEvent: ShallowTimelineSection
  nextEvent: ShallowTimelineSection
}

const Timeline = ({
  events,
  startYear,
  endYear,
  interval,
  id,
  image,
  description,
  descriptionEn,
  title,
  titleEn,
  sectionTitle,
  sectionTitleEn,
  subTitle,
  subTitleEn,
  color,
  onPrev,
  onNext,
  isCurrent,
  isFirst,
  isLast,
  entrance,
  prevEvent,
  nextEvent,
}: Props) => {
  const isFR = useLanguage()
  const isReady = useSharedValue(0)
  const modalRef = React.useRef<BottomSheet>(null)
  const eventModalRef = React.useRef<BottomSheetModal>(null)
  const searchModalRef = React.useRef<BottomSheet>(null)

  const [event, setEvent] = React.useState<Partial<TimelineEventProps> | null>(null)

  const onTimelineDetailsOpen = () => {
    modalRef.current?.expand()
  }

  const { x, y, lineX, year, width, height, yearsToPx, calculateEventWidth } = useTimeline({
    startYear,
    endYear,
    interval,
  })

  if (!isCurrent) {
    return null
  }

  return (
    <Box flex pos="absolute" left={0} bottom={0} right={0} top={0}>
      <TimelineHeader
        hasBackButton
        title={title}
        titleEn={titleEn}
        onPress={onTimelineDetailsOpen}
        searchModalRef={searchModalRef}
      />

      {!isFirst && <PrevSectionImage x={x} prevEvent={prevEvent} />}
      {!isLast && <NextSectionImage x={x} width={width} nextEvent={nextEvent} />}
      <CurrentSectionImage
        isReady={isReady}
        currentEvent={{
          id,
          image,
          color,
          description,
          descriptionEn,
          title,
          titleEn,
          sectionTitle,
          sectionTitleEn,
          subTitle,
          subTitleEn,
          startYear,
          endYear,
          interval,
        }}
      />
      <ScrollView
        x={x}
        y={y}
        width={width}
        height={height}
        onPrev={onPrev}
        onNext={onNext}
        isFirst={isFirst}
        isLast={isLast}
        isReady={isReady}
        entrance={entrance}
      >
        <Box width={width} height={height} lightShadow>
          <Box pos="relative" width={width} height={height} bg="lightGrey">
            {events.map((event, i) => (
              <TimelineEvent
                x={x}
                key={i}
                yearsToPx={yearsToPx}
                calculateEventWidth={calculateEventWidth}
                eventModalRef={eventModalRef}
                setEvent={setEvent}
                {...event}
              />
            ))}
          </Box>
        </Box>
      </ScrollView>
      <Datebar
        x={x}
        width={width}
        startYear={startYear}
        endYear={endYear}
        interval={interval}
        color={color}
      />
      <Line lineX={lineX} color={color} />
      <CurrentYear
        year={year}
        x={x}
        width={width}
        lineX={lineX}
        color={color}
        onPrev={onPrev}
        onNext={onNext}
        prevColor={prevEvent?.color}
        nextColor={nextEvent?.color}
      />
      <SectionDetailsModal
        modalRef={modalRef}
        {...{
          id,
          image,
          color,
          description,
          descriptionEn,
          title,
          titleEn,
          sectionTitle,
          sectionTitleEn,
          subTitle,
          subTitleEn,
          startYear,
          endYear,
          interval,
        }}
      />
      {/* @ts-ignore */}
      <InstantSearch
        indexName={isFR ? 'bible-timeline' : 'bible-timeline-en'}
        searchClient={searchClient}
      >
        {/* @ts-ignore */}
        <SearchInTimelineModal
          modalRef={searchModalRef}
          eventModalRef={eventModalRef}
          setEvent={setEvent}
        />
      </InstantSearch>
      <EventDetailsModal modalRef={eventModalRef} event={event} />
    </Box>
  )
}
export default Timeline
