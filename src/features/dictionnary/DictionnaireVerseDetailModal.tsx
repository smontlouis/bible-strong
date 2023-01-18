import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { withNavigation } from 'react-navigation'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import { Verse } from '~common/types'
import formatVerseContent from '~helpers/formatVerseContent'
import { useModalize } from '~helpers/useModalize'
import DictionnaireVerseDetailCard from './DictionnaireVerseDetailCard'

const DictionnaireVerseDetailModal = ({
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
      HeaderComponent={
        <ModalHeader
          title={title}
          subTitle={t('Dictionnaire')}
          onClose={close}
        />
      }
      ref={ref}
      onClose={onClose}
      modalRef={ref}
    >
      {!!verse && (
        <DictionnaireVerseDetailCard verse={verse} updateVerse={updateVerse} />
      )}
    </Modal.Body>
  )
}

export default withNavigation(DictionnaireVerseDetailModal)
