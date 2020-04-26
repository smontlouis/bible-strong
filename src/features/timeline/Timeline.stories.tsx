import React from 'react'
import { storiesOf } from '@storybook/react-native'

import { events } from './events'
import TimelineSection from './TimelineSection'
import TimelineScreen from './TimelineScreen'

const event = events[0]

storiesOf('PlanScreen', module).add('Default', () => <TimelineScreen />)
storiesOf('Plan', module).add('Default', () => <TimelineSection {...event} />)
