import React from 'react'
import { useSelector } from 'react-redux'
import Container from '~common/ui/Container'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import Empty from '~common/Empty'

import VersesList from './VersesList'

const HighlightsScreen = () => {
  const verseIds = useSelector(state => state.user.bible.highlights)
  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [selectedChip, setSelectedChip] = React.useState(null)

  const filteredHighlights = Object.keys(verseIds)
    .filter(vId =>
      selectedChip ? verseIds[vId].tags && verseIds[vId].tags[selectedChip.id] : true
    )
    .reduce((acc, curr) => ({ ...acc, [curr]: verseIds[curr] }), {})

  return (
    <Container>
      <TagsHeader
        title="Surbrillances"
        setIsOpen={setTagsIsOpen}
        isOpen={isTagsOpen}
        selectedChip={selectedChip}
        hasBackButton
      />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={chip => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      {Object.keys(filteredHighlights).length ? (
        <VersesList verseIds={filteredHighlights} />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message="Vous n'avez pas encore rien surligné..."
        />
      )}
    </Container>
  )
}

export default HighlightsScreen
