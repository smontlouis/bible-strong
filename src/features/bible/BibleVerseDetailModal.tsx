import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modalize } from 'react-native-modalize'
import { withNavigation } from 'react-navigation'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import { Verse } from '~common/types'
import formatVerseContent from '~helpers/formatVerseContent'
import BibleVerseDetailCard from './BibleVerseDetailCard'

const BibleVerseDetailModal = ({
  verse,
  onChangeVerse,
  onClose,
}: {
  verse: Verse | null
  onChangeVerse: React.Dispatch<React.SetStateAction<Verse | null>>
  onClose: () => void
}) => {
  const ref = React.useRef<Modalize>(null)
  const { t } = useTranslation()
  const closeModal = () => {
    ref.current?.close()
  }

  const { title } = formatVerseContent([verse])

  const updateVerse = (value: number) => {
    onChangeVerse(v =>
      v
        ? {
            ...v,
            Verset: Number(v.Verset) + value,
          }
        : null
    )
  }
  return (
    <Modal.Body
      HeaderComponent={
        <ModalHeader
          title={title}
          subTitle={t('Lexique hébreu & grec')}
          onClose={closeModal}
        />
      }
      isOpen={!!verse}
      onClose={onClose}
      modalRef={ref}
    >
      {!!verse && (
        <BibleVerseDetailCard verse={verse} updateVerse={updateVerse} />
      )}
    </Modal.Body>
  )
}

export default withNavigation(BibleVerseDetailModal)
