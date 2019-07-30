import React from 'react'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import FloatingButton from '~common/ui/FloatingButton'
import TagsModal from '~common/TagsModal'

import StudiesHeader from './StudiesHeader'

const StudiesScreen = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedChip, setSelectedChip] = React.useState(null)

  const onClosed = () => setIsOpen(false)
  const onSelectedChip = (chip) => setSelectedChip(chip)

  return (

    <Container>
      <StudiesHeader
        setIsOpen={setIsOpen}
        isOpen={isOpen}
        selectedChip={selectedChip}
      />
      <TagsModal
        isVisible={isOpen}
        onClosed={onClosed}
        onSelected={onSelectedChip}
        selectedChip={selectedChip}
      />
      <Box flex>

        <FloatingButton label='Nouvelle étude' icon='edit-2' route='EditStudy' />
      </Box>
    </Container>
  )
}

export default StudiesScreen
