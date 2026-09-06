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
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={dismiss}
        pointerEvents="box-none"
        style={{ flex: 1 }}
      >
        <Box
          className="overflow-hidden border-continuous absolute left-[20px] right-[20px] bg-reverse rounded-[12px] p-[18px]"
          style={{
            top: Math.max(16, top - 12),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.22,
            shadowRadius: 18,
            elevation: 24,
          }}
        >
          <Box className="overflow-hidden border-continuous flex-row items-start gap-[12px]">
            <Box
              className="overflow-hidden border-continuous rounded-[20px] items-center justify-center bg-quart shrink-[0]"
              style={[{ width: 36, height: 36 }, { borderRadius: 18 }]}
            >
              <FeatherIcon name="alert-triangle" size={19} color="reverse" />
            </Box>
            <Box className="overflow-hidden border-continuous flex-[1] gap-[6px]">
              <Text className="text-[17px] font-bold">{t('tips.androidWebView.title')}</Text>
              <Text className="text-[14px] leading-[20px] text-tertiary">
                {t('tips.bible-dom-wrapper-android')}
              </Text>
            </Box>
            <TouchableOpacity
              accessibilityLabel={t('Fermer')}
              accessibilityRole="button"
              hitSlop={12}
              onPress={dismiss}
            >
              <FeatherIcon name="x" size={22} color="tertiary" />
            </TouchableOpacity>
          </Box>
          <Box className="overflow-hidden border-continuous mt-[18px] items-end">
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
