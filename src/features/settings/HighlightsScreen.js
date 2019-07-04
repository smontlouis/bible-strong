import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import Empty from '~common/Empty'
import { useSelector } from 'react-redux'

import VersesList from './VersesList'

const HighlightsScreen = () => {
  const verseIds = useSelector(state => state.user.bible.highlights)

  return (
    <Container>
      <Header title='Surbrillances' />
      {
        Object.keys(verseIds).length
          ? <VersesList
            verseIds={verseIds}
          />
          : <Empty
            source={require('~assets/images/empty.json')}
            message="Vous n'avez pas encore rien surligné..."
          />
      }

    </Container>
  )
}

export default HighlightsScreen
