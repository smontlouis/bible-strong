import React from 'react'

import { storiesOf } from '@storybook/react-native'

import ReadingSlice from './ReadingSlice'

import { SliceType, MyEntitySlice } from '~common/types'

const slices: MyEntitySlice[] = [
  {
    id: 'my-video-slice',
    type: SliceType.Video,
    title: 'My Video Slice',
    description: 'My video slice description',
    url: 'https://stuff',
  },
  {
    id: 'my-text-slice',
    type: SliceType.Text,
    title: 'My slice',
    description: 'My text slice description',
  },
  {
    id: 'my-verse-slice',
    type: SliceType.Verse,
    verses: ['1-1-1', '1-1-2', '1-1-4'],
  },
  {
    id: 'my-chapter-slice',
    type: SliceType.Chapter,
    image: '',
    chapters: ['1-1', '1-2', '1-4'],
  },
]

storiesOf('Reading Slice', module)
  .add('List', () => (
    <>
      <ReadingSlice
        id="my-id"
        description="This is my slice"
        slices={slices.map(s => ({ ...s, isComplete: true }))}
      />
      <ReadingSlice id="my-id" description="This is my slice" slices={slices} />
    </>
  ))
  .add('Default', () => (
    <ReadingSlice id="my-id" description="This is my slice" slices={slices} />
  ))
  .add('Complete', () => (
    <ReadingSlice
      id="my-id"
      description="This is my slice"
      slices={slices.map(s => ({ ...s, isComplete: true }))}
    />
  ))
