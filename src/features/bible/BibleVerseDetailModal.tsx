import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { withNavigation } from 'react-navigation'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import { Verse } from '~common/types'
import formatVerseContent from '~helpers/formatVerseContent'
import { useModalize } from '~helpers/useModalize'
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
  const { t } = useTranslation()
  const { ref, open, close } = useModalize()

  useEffect(() => {
    if (verse) {
      open()
    }
  }, [verse, open])

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
      ref={ref}
      HeaderComponent={
        <ModalHeader
          title={title}
          subTitle={t('Lexique hébreu & grec')}
          onClose={close}
        />
      }
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
