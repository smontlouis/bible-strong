import React from 'react'
import ScrollView from './ScrollView'
import Box from '~common/ui/Box'
import { useTimeline } from './timeline.hooks'
import TimelineEvent from './TimelineEvent'
import {
  TimelineSection as TimelineSectionProps,
  ShallowTimelineSection,
  TimelineEvent as TimelineEventProps,
} from './types'
import CurrentYear from './CurrentYear'
import PrevSectionImage from './PrevSectionImage'
import NextSectionImage from './NextSectionImage'
import { Value, useCode, debug } from 'react-native-reanimated'
import TimelineHeader from './TimelineHeader'
import Line from './Line'
import Datebar from './Datebar'
import CurrentSectionImage from './CurrentSectionImage'
import { Modalize } from 'react-native-modalize'
import SectionDetailsModal from './SectionDetailsModal'
import EventDetailsModal from './EventDetailsModal'
import { useValues } from 'react-native-redash'
import SearchInTimelineModal from './SearchInTimelineModal'
import algoliasearch from 'algoliasearch/lite'
import { InstantSearch } from 'react-instantsearch-native'
import { algoliaConfig } from '../../../config'
import useLanguage from '~helpers/useLanguage'
import { useTranslation } from 'react-i18next'
const searchClient = algoliasearch(
  algoliaConfig.applicationId,
  algoliaConfig.apiKey
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
  const [isReady] = useValues([0], [isCurrent])
  const modalRef = React.useRef<Modalize>(null)
  const eventModalRef = React.useRef<Modalize>(null)
  const searchModalRef = React.useRef<Modalize>(null)

  const [event, setEvent] = React.useState<Partial<TimelineEventProps>>(null)

  const onTimelineDetailsOpen = () => {
    modalRef.current?.open()
  }

  const {
    x,
    y,
    lineX,
    year,
    width,
    height,
    yearsToPx,
    calculateEventWidth,
  } = useTimeline({
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
      {!isLast && (
        <NextSectionImage x={x} width={width} nextEvent={nextEvent} />
      )}
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
        translateX={x}
        translateY={y}
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
      <InstantSearch
        indexName={isFR ? 'bible-timeline' : 'bible-timeline-en'}
        searchClient={searchClient}
      >
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
