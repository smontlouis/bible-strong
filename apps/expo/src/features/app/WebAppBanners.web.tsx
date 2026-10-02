import { Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { useNativeAppPrompt } from './useNativeAppPrompt.web'
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate.web'

type WebBannerProps = {
  message: string
  actionLabel: string
  onAction: () => void
  onClose: () => void
}

const WebBanner = ({ message, actionLabel, onAction, onClose }: WebBannerProps) => {
  const { t } = useTranslation()
  return (
    <HStack
      role="status"
      className="w-full max-w-[420px] items-center gap-3 rounded-2xl border border-border bg-reverse py-2.5 pl-4 pr-2"
      style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)' }}
    >
      <Text className="flex-1 text-[14px] text-default">{message}</Text>
      <Button small onPress={onAction}>
        {actionLabel}
      </Button>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Fermer')}
        hitSlop={8}
        onPress={onClose}
        className="p-1.5"
      >
        <FeatherIcon name="x" size={18} color="tertiary" />
      </Pressable>
    </HStack>
  )
}

// Bottom banners of the web app: a waiting deployment and, on phones and tablets, the native
// apps. Dedicated banners because sonner-native toasts swallow their action on web.
const WebAppBanners = () => {
  const { t } = useTranslation()
  const update = useServiceWorkerUpdate()
  const nativeApp = useNativeAppPrompt()

  if (!update.updateWaiting && !nativeApp.visible) return null

  return (
    <Box pointerEvents="box-none" className="absolute bottom-4 left-0 right-0 items-center px-4">
      <Box className="w-full max-w-[420px] gap-2">
        {update.updateWaiting && (
          <WebBanner
            message={t('app.webUpdateAvailable')}
            actionLabel={t('app.webUpdateReload')}
            onAction={update.applyUpdate}
            onClose={update.dismissUpdate}
          />
        )}
        {nativeApp.visible && (
          <WebBanner
            message={t('app.nativeAppPrompt')}
            actionLabel={t('app.nativeAppPromptAction')}
            onAction={nativeApp.openStore}
            onClose={nativeApp.dismiss}
          />
        )}
      </Box>
    </Box>
  )
}

export default WebAppBanners
