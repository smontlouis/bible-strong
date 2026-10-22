import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable } from 'react-native'
import Text from '~common/ui/Text'

/**
 * Under display modes out of reach offline: the way to keep their resources on the device.
 * The web keeps no Offline copy, so it shows nothing there.
 */
const OfflineCopiesLink = ({ onPress }: { onPress?: () => void }) => {
  const router = useRouter()
  const { t } = useTranslation()
  if (Platform.OS === 'web') return null

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        onPress?.()
        router.push('/downloads')
      }}
      style={({ pressed }) => ({
        alignSelf: 'center',
        minHeight: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text className="text-link font-bold text-[14px]">{t('bible.error.goToDownloads')}</Text>
    </Pressable>
  )
}

export default OfflineCopiesLink
