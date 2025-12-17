import React from 'react'

import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import EventDetails from './EventDetails'
import { TimelineEvent as TimelineEventProps } from './types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Props {
  modalRef: React.RefObject<BottomSheet>
  event: Partial<TimelineEventProps>
}

const EventDetailsModal = ({
  modalRef,

  event,
}: Props) => {
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
      <BottomSheetScrollView>
        <EventDetails {...event} />
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default EventDetailsModal
