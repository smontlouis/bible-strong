import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import { useSelector } from 'react-redux'

import VersesList from './VersesList'

const HighlightsScreen = () => {
  const verseIds = useSelector(state => state.user.bible.highlights)
  return (
    <Container>
      <Header hasBackButton title='Surbrillances' />
      <VersesList
        verseIds={verseIds}
      />
    </Container>
  )
}

export default HighlightsScreen
