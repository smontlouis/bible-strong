import { useFocusEffect, useRouter } from 'expo-router'
import { View } from 'react-native'

const ExploreSheetBaseScreen = () => {
  const router = useRouter()

  useFocusEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (router.canGoBack()) {
        router.back()
      }
    })

    return () => cancelAnimationFrame(frame)
  })

  return <View style={{ flex: 1, backgroundColor: 'transparent' }} />
}

export default ExploreSheetBaseScreen
