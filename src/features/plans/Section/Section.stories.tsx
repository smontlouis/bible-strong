import React from 'react'
import { storiesOf } from '@storybook/react-native'

import { MySection, SliceType } from '~common/types'
import Section from './Section'

const section: MySection = {
  id: 'my-section',
  title: 'My title',
  subTitle: 'My title',
  readingSlices: [
    {
      id: 'my-reading-slice',
      description: 'description',
      slices: [
        {
          id: 'my-video-slice',
          type: SliceType.Video,
          title: 'My Video Slice',
          description: 'My video slice description',
          url: 'https://stuff',
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
      ],
    },
    {
      id: 'my-reading-slice-2',
      description: 'description',
      slices: [
        {
          id: 'my-text-slice',
          type: SliceType.Text,
          title: 'My slice',
          description: 'My text slice description',
        },
        {
          id: 'my-chapter-slice',
          type: SliceType.Chapter,
          image: '',
          chapters: ['1-1', '1-2', '1-4'],
        },
        {
          id: 'my-chapter-slice-2',
          type: SliceType.Chapter,
          image: '',
          chapters: ['5-1', '5-3', '5-6'],
        },
      ],
    },
  ],
}

storiesOf('Section', module).add('Default', () => (
  <Section
    id={section.id}
    title={section.title}
    subTitle={section.subTitle}
    readingSlices={section.readingSlices}
  />
))
