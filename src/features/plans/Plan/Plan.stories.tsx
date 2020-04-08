import React from 'react'
import { storiesOf } from '@storybook/react-native'

import Plan from './Plan'

import { bibleProjectPlan as plan } from '../bible-project-plan'

storiesOf('Plan', module).add('Default', () => (
  <Plan
    id={plan.id}
    title={plan.title}
    author={plan.author}
    sections={plan.sections}
  />
))
