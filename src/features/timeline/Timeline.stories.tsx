import React from 'react'
import { storiesOf } from '@storybook/react-native'

import { events as sections } from './events'
import SectionImage from './SectionImage'

const { events, ...shallowSection } = sections[3]

storiesOf('SectionImage', module).add('Default', () => (
  <SectionImage {...shallowSection} direction="next" />
))
