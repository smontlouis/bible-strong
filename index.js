Object.fromEntries =
  Object.fromEntries ||
  function (arr) {
    return arr.reduce(function (acc, curr) {
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
import notifee, { EventType } from '@notifee/react-native'

TrackPlayer.registerPlaybackService(() => PlaybackService)

// Register background event handler for Notifee
// This prevents ANR when notifications fire while app is in background
// by handling events without spinning up the full React Native context
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Handle notification press in background
  if (type === EventType.PRESS) {
    // Notification was pressed - app will open and handle in foreground
    return
  }

  // Handle notification dismissed
  if (type === EventType.DISMISSED) {
    return
  }

  // For trigger notifications (like Verse of the Day), just acknowledge
  // The notification has already been displayed by the system
  return
})

registerRootComponent(App)
