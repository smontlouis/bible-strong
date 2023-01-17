import React from 'react'
import { Modalize } from 'react-native-modalize'
import { withNavigation } from 'react-navigation'
import Modal from '~common/Modal'
import BibleVerseDetailCard from './BibleVerseDetailCard'

const BibleVerseDetailModal = ({
  selectedVerse,
  onClosed,
}: {
  selectedVerse: string | null
  onClosed: () => void
}) => {
  const ref = React.useRef<Modalize>(null)

  return (
    <Modal.Body
      isOpen={!!selectedVerse}
      onClose={onClosed}
      adjustToContentHeight
      modalRef={ref}
    >
      <BibleVerseDetailCard {...{ selectedVerse, onClosed }} />
    </Modal.Body>
  )
}

export default withNavigation(BibleVerseDetailModal)
