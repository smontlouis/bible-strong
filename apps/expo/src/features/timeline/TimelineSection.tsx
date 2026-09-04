import { type SheetRef } from '~common/sheet'
import React from 'react'
import { useSharedValue } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import useLanguage from '~helpers/useLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import CurrentSectionImage from './CurrentSectionImage'
import CurrentYear from './CurrentYear'
import Datebar from './Datebar'
import Line from './Line'
import NextSectionImage from './NextSectionImage'
import PrevSectionImage from './PrevSectionImage'
import ScrollView from './ScrollView'
import SectionDetailsModal from './SectionDetailsModal'
import TimelineEvent from './TimelineEvent'
import TimelineHeader from './TimelineHeader'
import { useTimeline } from './timeline.hooks'
import { ShallowTimelineSection, TimelineSection as TimelineSectionProps } from './types'
import { useTimelineDetails } from './TimelineResourceBoundary'
interface Props extends TimelineSectionProps {
  onPrev: () => void
  onNext: () => void
  onBackPress?: () => void
  hasBackButton?: boolean
  isFormSheet?: boolean
  isCurrent: boolean
  isFirst?: boolean
  isLast?: boolean
  entrance: 0 | 1
  prevEvent: ShallowTimelineSection
  nextEvent: ShallowTimelineSection
  sectionIndex?: number
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
  onBackPress,
  hasBackButton,
  isFormSheet = false,
  isCurrent,
  isFirst,
  isLast,
  entrance,
  prevEvent,
  nextEvent,
  sectionIndex,
}: Props) => {
  const isReady = useSharedValue(0)
  const modalRef = React.useRef<SheetRef>(null)
  const openInNewTab = useOpenInNewTab()
  const pushRouteOnce = usePushRouteOnce()
  const lang = useLanguage()

  const timeline = useTimelineDetails()
  const eventDetailSlugs = new Set(timeline.map(e => e.slug))

  const onTimelineDetailsOpen = () => {
    modalRef.current?.present()
  }

  const openSectionInNewTab = () => {
    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: getLegacyLocalizedField(lang, { fr: title, en: titleEn }),
      isRemovable: true,
      type: 'timeline',
      data: {
        sectionIndex,
      },
    })
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
        hasBackButton={hasBackButton}
        isFormSheet={isFormSheet}
        title={title}
        titleEn={titleEn}
        onPress={onTimelineDetailsOpen}
        onBackPress={onBackPress}
        onOpenInNewTab={openSectionInNewTab}
        onSearchPress={() => pushRouteOnce({ pathname: '/timeline-search' })}
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
            {events.map(event => (
              <TimelineEvent
                x={x}
                key={event.id}
                yearsToPx={yearsToPx}
                calculateEventWidth={calculateEventWidth}
                hasDetails={eventDetailSlugs ? eventDetailSlugs.has(event.slug) : true}
                sectionIndex={sectionIndex}
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
    </Box>
  )
}
export default Timeline
