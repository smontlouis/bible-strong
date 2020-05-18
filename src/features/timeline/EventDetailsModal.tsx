import React from 'react'
import { Modalize } from 'react-native-modalize'
import { useTheme } from 'emotion-theming'

import { Theme } from '~themes'
import { TimelineEvent as TimelineEventProps } from './types'
import EventDetails from './EventDetails'

interface Props {
  modalRef: React.RefObject<Modalize<any, any>>
  HeaderComponent?: React.ReactNode
  FooterComponent?: React.ReactNode
  event: Partial<TimelineEventProps>
}

const EventDetailsModal = ({
  modalRef,
  FooterComponent,
  HeaderComponent,
  event,
}: Props) => {
  const theme: Theme = useTheme()

  return (
    <Modalize
      ref={modalRef}
      handlePosition="inside"
      // snapPoint={400}
      modalStyle={{
        backgroundColor: theme.colors.lightGrey,
        maxWidth: 600,
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      FooterComponent={FooterComponent}
      HeaderComponent={HeaderComponent}
    >
      <EventDetails {...event} />
    </Modalize>
  )
}

export default EventDetailsModal
