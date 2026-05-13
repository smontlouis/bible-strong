import React from 'react'

import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import EventDetails from './EventDetails'
import { TimelineEvent as TimelineEventProps } from './types'

interface Props {
  modalRef: React.RefObject<BottomSheet | null>
  scrollViewRef: React.RefObject<BottomSheetScrollViewMethods | null>
  event: Partial<TimelineEventProps> | null
}

type EventDetailsProps = Pick<
  TimelineEventProps,
  'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'
>

const hasEventDetails = (event: Partial<TimelineEventProps> | null): event is EventDetailsProps =>
  Boolean(event?.slug && event.image && event.title && event.titleEn) &&
  event?.start !== undefined &&
  event.end !== undefined

const EventDetailsModal = ({ modalRef, scrollViewRef, event }: Props) => {
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  return (
    <BottomSheet
      ref={modalRef}
      index={-1}
      enablePanDownToClose
      snapPoints={['100%']}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      topInset={useSafeAreaInsets().top + 56}
      key={key}
      {...bottomSheetStyles}
    >
      <BottomSheetScrollView ref={scrollViewRef}>
        {hasEventDetails(event) && (
          <EventDetails
            slug={event.slug}
            image={event.image}
            title={event.title}
            titleEn={event.titleEn}
            start={event.start}
            end={event.end}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default EventDetailsModal
