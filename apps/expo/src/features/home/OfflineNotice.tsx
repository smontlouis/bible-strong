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
    <Box className="overflow-hidden border-continuous flex-row items-center px-[20px] py-[16px] bg-reverse rounded-[28px] mx-[32px] mt-[10px] mb-[32px]">
      <Box
        className="overflow-hidden border-continuous rounded-[16px] bg-light-grey items-center justify-center"
        style={{ width: 32, height: 32 }}
      >
        <FeatherIcon size={17} name="wifi-off" color="tertiary" />
      </Box>
      <Box className="overflow-hidden border-continuous ml-[10px] flex-[1]">
        <Text className="text-tertiary">{t('app.youAreOffline')}</Text>
      </Box>
    </Box>
  )
}

export default OfflineNotice
