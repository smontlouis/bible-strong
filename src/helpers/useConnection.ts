import { useEffect, useState } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

const useConnection = () => {
  const [isConnected, setIsConnected] = useState(true)

  useEffect(() => {
    const handleConnectivityChange = ({ isConnected: userIsConnected }: NetInfoState) => {
      console.log('[Connection] Is connected:', userIsConnected)
      // @ts-ignore
      setIsConnected(userIsConnected)
    }

    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange)

    return () => {
      unsubscribe()
    }
  }, [])

  return isConnected
}

export default useConnection
