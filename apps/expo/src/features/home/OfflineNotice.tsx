import React from 'react'
import useConnection from '~helpers/useConnection'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import IconTile from '~common/ui/IconTile'
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
    <Card className="flex-row items-center gap-[12px] px-[14px] py-[12px] mx-[20px] mb-[16px]">
      <IconTile tint="tertiary">
        <FeatherIcon size={18} name="wifi-off" color="tertiary" />
      </IconTile>
      <Box className="flex-[1]">
        <Text className="text-tertiary">{t('app.youAreOffline')}</Text>
      </Box>
    </Card>
  )
}

export default OfflineNotice
