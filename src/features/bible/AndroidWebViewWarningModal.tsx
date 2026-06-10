import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Modal, TouchableOpacity, View } from 'react-native'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { dismissTipAtom, useTip } from '~features/tips/atom'

const TIP_ID = 'bible-dom-wrapper-android'

const AndroidWebViewWarningModal = ({ top }: { top: number }) => {
  const { t } = useTranslation()
  const isDismissed = useTip(TIP_ID)
  const dismissTip = useSetAtom(dismissTipAtom)

  if (isDismissed) return null

  const dismiss = () => dismissTip(TIP_ID)

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View pointerEvents="box-none" style={{ flex: 1 }}>
        <Box
          position="absolute"
          left={20}
          right={20}
          top={Math.max(16, top - 12)}
          bg="reverse"
          borderRadius={12}
          p={18}
          shadow={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.22,
            shadowRadius: 18,
            elevation: 24,
          }}
        >
          <Box row alignItems="flex-start" gap={12}>
            <Box size={36} rounded center bg="quart" flexShrink={0} style={{ borderRadius: 18 }}>
              <FeatherIcon name="alert-triangle" size={19} color="reverse" />
            </Box>
            <Box flex={1} gap={6}>
              <Text fontSize={17} bold>
                {t('tips.androidWebView.title')}
              </Text>
              <Text fontSize={14} lineHeight={20} color="tertiary">
                {t('tips.bible-dom-wrapper-android')}
              </Text>
            </Box>
            <TouchableOpacity hitSlop={12} onPress={dismiss}>
              <FeatherIcon name="x" size={22} color="tertiary" />
            </TouchableOpacity>
          </Box>
          <Box mt={18} alignItems="flex-end">
            <Button small onPress={dismiss}>
              {t('tips.androidWebView.understand')}
            </Button>
          </Box>
        </Box>
      </View>
    </Modal>
  )
}

export default AndroidWebViewWarningModal
