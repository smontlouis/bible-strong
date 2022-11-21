import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { withNavigation } from 'react-navigation'
import Link from '~common/Link'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import formatVerseContent from '~helpers/formatVerseContent'
import CardWrapper from './NaveModalCard'

const NaveModal = ({ onClosed, selectedVerse }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { title } = formatVerseContent([selectedVerse])

  return (
    <Modal.Menu
      isOpen={!!selectedVerse}
      onClose={onClosed}
      adjustToContentHeight
      HeaderComponent={
        <Box row height={60} alignItems="center">
          <Box flex paddingLeft={20}>
            <Text title fontSize={16} marginTop={10}>
              {title}
            </Text>
            <Text fontSize={13} color="grey">
              {t('Par thèmes')}
            </Text>
          </Box>
          <Link onPress={onClosed} padding>
            <FeatherIcon name="x" size={25} />
          </Link>
        </Box>
      }
    >
      <CardWrapper {...{ theme, selectedVerse, onClosed }} />
    </Modal.Menu>
  )
}

export default withNavigation(NaveModal)
