import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modalize } from 'react-native-modalize'
import { withNavigation } from 'react-navigation'
import Link from '~common/Link'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import CardWrapper from './NaveModalCard'

const NaveModal = ({ onClosed, selectedVerse }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { title } = formatVerseContent([selectedVerse])
  const ref = React.useRef<Modalize>(null)

  return (
    <Modal.Body
      isOpen={!!selectedVerse}
      onClose={onClosed}
      adjustToContentHeight
      modalRef={ref}
      HeaderComponent={
        <ModalHeader
          onClose={() => ref?.current?.close()}
          title={title}
          subTitle={t('Par thèmes')}
        />
      }
    >
      <CardWrapper {...{ theme, selectedVerse, onClosed }} />
    </Modal.Body>
  )
}

export default withNavigation(NaveModal)
