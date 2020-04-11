import React from 'react'
import { storiesOf } from '@storybook/react-native'

import PlanSectionList from './PlanSectionList'

import { bibleProjectPlan as plan } from '../bible-project-plan'

storiesOf('Plan', module).add('Default', () => (
  <PlanSectionList sections={plan.sections} />
))
