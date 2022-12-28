import React from 'react'
import { Modalize } from 'react-native-modalize'
import { useTheme } from '@emotion/react'

import { Theme } from '~themes'
import { TimelineEvent as TimelineEventProps } from './types'
import EventDetails from './EventDetails'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'

interface Props {
  modalRef: React.RefObject<Modalize>
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
      modalTopOffset={getStatusBarHeight()}
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
