import React from 'react'
import { storiesOf } from '@storybook/react-native'

import { MyPlan, SliceType } from '~common/types'
import Plan from './Plan'

const plan: MyPlan = {
  id: 'my-plan',
  title: 'My Plan',
  author: {
    id: 'my-user-id',
    displayName: 'Stéphane MLC',
    photoUrl: '',
  },
  sections: [
    {
      id: 'my-section',
      title: 'Création & Chute',
      subTitle: 'Genèse 1-11',
      readingSlices: [
        {
          id: 'my-reading-slice',
          description: 'description',
          isComplete: true,
          slices: [
            {
              id: 'my-video-slice',
              type: SliceType.Video,
              title: 'Genèse 1-11',
              description: 'My video slice description',
              url: 'https://stuff',
            },
            {
              id: 'my-verse-slice',
              type: SliceType.Chapter,
              chapters: ['1-1', '1-2', '1-3'],
            },
            {
              id: 'my-chapter-slice',
              type: SliceType.Chapter,
              image: '',
              chapters: ['19-1'],
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
        {
          id: 'my-reading-slice-3',
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
    },
  ],
}

storiesOf('Plan', module).add('Default', () => (
  <Plan
    id={plan.id}
    title={plan.title}
    author={plan.author}
    sections={plan.sections}
  />
))
