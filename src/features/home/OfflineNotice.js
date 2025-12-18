import React from 'react'
import NetInfo from '@react-native-community/netinfo'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useTranslation } from 'react-i18next'

const OfflineNotice = () => {
  const [isConnected, setIsConnected] = React.useState(true)
  const { t } = useTranslation()

  React.useEffect(() => {
    const handleConnectivityChange = ({ isConnected }) => {
      console.log('[Home] Is connected:', isConnected)
      setIsConnected(isConnected)
    }

    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange)

    return () => {
      unsubscribe()
    }
  }, [])

  if (isConnected) {
    return null
  }

  return (
    <Box
      row
      padding={10}
      bg="reverse"
      lightShadow
      borderRadius={3}
      borderLeftWidth={4}
      borderLeftColor="rgb(255,188,0)"
      marginTop={10}
      marginBottom={20}
    >
      <FeatherIcon size={20} name="alert-triangle" color="secondary" />
      <Box marginLeft={10} paddingRight={10}>
        <Text bold>{t('app.youAreOffline')}</Text>
      </Box>
    </Box>
  )
}

export default OfflineNotice
