import React from 'react'
import { storiesOf } from '@storybook/react-native'

import { MyPlan } from '~common/types'
import Plan from './Plan'

import plan from './mock-plan'

storiesOf('Plan', module).add('Default', () => (
  <Plan
    id={plan.id}
    title={plan.title}
    author={plan.author}
    sections={plan.sections}
    status={plan.status}
    progress={plan.progress}
  />
))
