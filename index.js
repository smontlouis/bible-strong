Object.fromEntries =
  Object.fromEntries ||
  function(arr) {
    return arr.reduce(function(acc, curr) {
      acc[curr[0]] = curr[1]
      return acc
    }, {})
  }

import 'expo-asset'
import 'react-native-gesture-handler'
import { registerRootComponent } from 'expo'
import App from './App'
import TrackPlayer from 'react-native-track-player'
import { PlaybackService } from './playbackService'

TrackPlayer.registerPlaybackService(() => PlaybackService)

registerRootComponent(App)
