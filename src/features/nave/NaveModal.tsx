import { useTheme } from '@emotion/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { withNavigation } from 'react-navigation'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import formatVerseContent from '~helpers/formatVerseContent'
import { useModalize } from '~helpers/useModalize'
import CardWrapper from './NaveModalCard'

const NaveModal = ({ onClosed, selectedVerse }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { title } = formatVerseContent([selectedVerse])
  const { ref, open, close } = useModalize()

  useEffect(() => {
    if (selectedVerse) {
      open()
    }
  }, [selectedVerse, open])

  return (
    <Modal.Body
      ref={ref}
      onClose={onClosed}
      adjustToContentHeight
      modalRef={ref}
      HeaderComponent={
        <ModalHeader onClose={close} title={title} subTitle={t('Par thèmes')} />
      }
    >
      <CardWrapper {...{ theme, selectedVerse, onClosed }} />
    </Modal.Body>
  )
}

export default withNavigation(NaveModal)
