import { Platform, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import ModalRouteFrame from '~navigation/ModalRouteFrame'
import StrobiAvatar from './StrobiAvatar'

/**
 * Strobi for a visitor (2026-11-15): what it does, and the way to sign in. Nothing is read or
 * sent before; once signed in, this page becomes the conversation.
 */
export default function AssistantGuestScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <ModalRouteFrame>
      <Box className="bg-reverse flex-1">
        <HStack
          className="border-separator bg-reverse min-h-[50px] items-center pl-3 pr-2"
          style={{
            borderBottomWidth: StyleSheet.hairlineWidth,
            // iOS: room for the sheet's grabber. Android: a page under the status bar.
            paddingTop: Platform.OS === 'android' ? insets.top : 12,
            paddingBottom: 2,
          }}
        >
          {Platform.OS === 'android' && (
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={t('assistant.modal.close')}
              onPress={() => router.back()}
              className="h-[44px] w-[40px] items-center justify-center"
            >
              <FeatherIcon name="arrow-left" size={20} />
            </TouchableBox>
          )}
          <Text accessibilityRole="header" className="flex-1 pl-1 text-[16px] font-bold">
            {t('strobi.settings.title')}
          </Text>
        </HStack>
        {/* In a sheet, iOS stretches a scroll view that is the screen's child over the header. */}
        <Box className="flex-1 overflow-hidden">
          <ScrollView
            backgroundColor="reverse"
            contentContainerStyle={{ padding: 24, paddingBottom: 24 + insets.bottom }}
          >
            <Box className="items-center pt-6">
              <StrobiAvatar animation="happy" size={112} settleAfterMs={4000} pettable />
            </Box>
            <Text className="mt-6 text-center text-[24px] font-bold">
              {t('assistant.guest.title')}
            </Text>
            <Text className="text-grey mt-3 text-center text-[15px] leading-[22px]">
              {t('assistant.guest.pitch')}
            </Text>
            <Box className="mt-8 gap-3">
              <Button fullWidth onPress={() => router.push('/login')}>
                {t('Se connecter')}
              </Button>
              <Button fullWidth reverse onPress={() => router.push('/register')}>
                {t('Créer un compte')}
              </Button>
            </Box>
          </ScrollView>
        </Box>
      </Box>
    </ModalRouteFrame>
  )
}
