import React from 'react'

import TimelineItem from './TimelineItem'
import { events } from './events'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'

const TimelineHomeScreen = () => {
  return (
    <Container>
      <Header hasBackButton title="The Bible Timeline" />
      <ScrollView backgroundColor="lightGrey">
        {events.map((event, i) => (
          <TimelineItem goTo={i} key={event.id} {...event} />
        ))}
      </ScrollView>
    </Container>
  )
}

export default TimelineHomeScreen
