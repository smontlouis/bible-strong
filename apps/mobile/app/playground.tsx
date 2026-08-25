import { Redirect } from 'expo-router'

import PlaygroundScreen from '~features/playground/PlaygroundScreen'

const PlaygroundRoute = () => {
  if (!__DEV__) return <Redirect href="/" />

  return <PlaygroundScreen />
}

export default PlaygroundRoute
