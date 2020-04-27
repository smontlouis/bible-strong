import React from 'react'
import { storiesOf } from '@storybook/react-native'

import { events as sections } from './events'
import TimelineScreen from './TimelineScreen'
import SectionImage from './SectionImage'

const { events, ...shallowSection } = sections[3]

storiesOf('PlanScreen', module).add('Default', () => <TimelineScreen />)
storiesOf('SectionImage', module).add('Default', () => (
  <SectionImage {...shallowSection} direction="next" />
))
