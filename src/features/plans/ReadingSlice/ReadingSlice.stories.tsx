import React from 'react'

import { storiesOf } from '@storybook/react-native'
import { action } from '@storybook/addon-actions'
import { linkTo } from '@storybook/addon-links'

import ReadingSlice from './ReadingSlice'

storiesOf('Reading Slice', module).add('Default', () => <ReadingSlice />)
