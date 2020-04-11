import React from 'react'
import { NavigationStackProp } from 'react-navigation-stack'

import Container from '~common/ui/Container'
import Header from '~common/Header'
import { ComputedReadingSlice, EntitySlice } from '~common/types'
import ScrollView from '~common/ui/ScrollView'
import Slice from './Slice'
import PauseText from './PauseText'
import chapterToReference from '~helpers/chapterToReference'
import verseToReference from '~helpers/verseToReference'
import Box from '~common/ui/Box'
import ReadButton from './ReadButton'

interface Props {
  navigation: NavigationStackProp<{ readingSlice: ComputedReadingSlice }>
}

const extractTitle = (slice: EntitySlice) => {
  switch (slice.type) {
    case 'Verse':
      return verseToReference(slice.verses, { isPlan: true })
    case 'Chapter':
      return chapterToReference(slice.chapters)
    default:
      return ''
  }
}

const PlanSliceScreen = ({ navigation }: Props) => {
  const {
    id,
    planId,
    slices,
  }: ComputedReadingSlice & { planId: string } = navigation.getParam(
    'readingSlice',
    {}
  )
  const mainSlice: EntitySlice | undefined = slices.find(
    s => s.type === 'Chapter' || s.type === 'Verse'
  )
  const title = mainSlice ? extractTitle(mainSlice) : ''
  return (
    <Container>
      <Header title={title} hasBackButton />
      <ScrollView>
        <PauseText>
          {
            'Prenez une grande inspiration,\n alors que vous vous apprêtez à passer du\n temps avec Dieu'
          }
        </PauseText>
        {slices.map(slice => (
          <Slice key={slice.id} {...slice} />
        ))}
        <Box height={80} center marginTop={30}>
          <ReadButton readingSliceId={id} planId={planId} />
        </Box>
      </ScrollView>
    </Container>
  )
}

export default PlanSliceScreen
