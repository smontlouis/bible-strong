import { useTheme } from '@emotion/react'
import React from 'react'
import { Modalize } from 'react-native-modalize'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Theme } from '~themes'
import EventDetails from './EventDetails'
import { TimelineEvent as TimelineEventProps } from './types'

interface Props {
  modalRef: React.RefObject<Modalize>
  event: Partial<TimelineEventProps>
}

const EventDetailsModal = ({
  modalRef,

  event,
}: Props) => {
  const theme: Theme = useTheme()

  return (
    <Modalize
      ref={modalRef}
      modalTopOffset={useSafeAreaInsets().top}
      modalStyle={{
        backgroundColor: theme.colors.lightGrey,
        maxWidth: 600,
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <EventDetails {...event} />
    </Modalize>
  )
}

export default EventDetailsModal
