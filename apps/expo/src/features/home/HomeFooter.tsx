import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinkBox } from '~common/Link'
import Border from '~common/ui/Border'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'

/**
 * The end of the home. Touch layouts only leave room for the close button that floats over it;
 * the wide Web home adds the app download as a link under a hairline. Follow and FAQ are rows of
 * « Aller plus loin ».
 */
const HomeFooter = () => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isWide = useResponsiveWorkspace()

  if (Platform.OS === 'web' && isWide)
    return (
      <Box className="mx-[20px]">
        <Border />
        <HStack className="items-center pt-[16px] pb-[32px]">
          <LinkBox
            href="https://bible-strong.app"
            className="self-start flex-row items-center gap-[7px] py-[7px]"
          >
            <Text className="text-link text-[13px] font-bold shrink">
              {t('home.desktop.downloadApp')}
            </Text>
            <FeatherIcon name="arrow-up-right" size={14} color="primary" />
          </LinkBox>
        </HStack>
      </Box>
    )

  return <Box style={{ height: insets.bottom + 100 }} />
}

export default HomeFooter
