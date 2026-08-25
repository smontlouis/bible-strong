import React from 'react'
import useConnection from '~helpers/useConnection'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useTranslation } from 'react-i18next'

const OfflineNotice = () => {
  const isConnected = useConnection()
  const { t } = useTranslation()

  if (isConnected) {
    return null
  }

  return (
    <Box
      row
      alignItems="center"
      px={20}
      py={16}
      bg="reverse"
      borderRadius={28}
      mx={32}
      mt={10}
      mb={32}
    >
      <Box size={32} borderRadius={16} bg="lightGrey" center>
        <FeatherIcon size={17} name="wifi-off" color="tertiary" />
      </Box>
      <Box ml={10} flex>
        <Text color="tertiary">{t('app.youAreOffline')}</Text>
      </Box>
    </Box>
  )
}

export default OfflineNotice
