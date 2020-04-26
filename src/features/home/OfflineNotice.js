import React from 'react'
import NetInfo from '@react-native-community/netinfo'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'

const OfflineNotice = () => {
  const [isConnected, setIsConnected] = React.useState(true)

  React.useEffect(() => {
    const handleConnectivityChange = ({ isConnected }) => {
      console.log('Is connected: ', isConnected)
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
        <Text bold>Vous êtes hors-ligne</Text>
        <Text fontSize={12}>
          N'oubliez pas de sauvegarder vos données sur le cloud. La
          synchronisation s'effectue à chaque lancement de l'app.
        </Text>
      </Box>
    </Box>
  )
}

export default OfflineNotice
