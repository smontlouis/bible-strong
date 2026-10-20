import type { PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinkBox, type LinkProps } from '~common/Link'
import Border from '~common/ui/Border'
import Box, { HStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import type { MainStackProps } from '~navigation/type'

const FooterLink = ({ children, ...props }: PropsWithChildren<LinkProps<keyof MainStackProps>>) => (
  <LinkBox {...props} className="self-start flex-row items-center gap-[7px] py-[7px]">
    <Text className="text-primary text-[13px] font-bold shrink">{children}</Text>
    <FeatherIcon name="arrow-up-right" size={14} color="primary" />
  </LinkBox>
)

/**
 * Follow and FAQ. Touch layouts keep the two buttons on a surface band, its top corners at the
 * hub's large radius, that also leaves room for the close button; the wide Web home lists them
 * as links under a hairline, with the app download.
 */
const HomeFooter = () => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isWide = useResponsiveWorkspace()

  if (Platform.OS === 'web' && isWide)
    return (
      <Box className="mx-[20px]">
        <Border />
        <HStack className="items-center flex-wrap gap-[24px] pt-[16px] pb-[32px]">
          <FooterLink href="https://www.facebook.com/fr.bible.strong">{t('Suivre')}</FooterLink>
          <FooterLink route="FAQ">{t('FAQ')}</FooterLink>
          <FooterLink href="https://bible-strong.app">{t('home.desktop.downloadApp')}</FooterLink>
        </HStack>
      </Box>
    )

  return (
    <Box className="overflow-hidden border-continuous">
      <Box
        className="overflow-hidden border-continuous bg-surface flex-row px-[20px] pt-[20px] rounded-t-[24px]"
        style={{ paddingBottom: insets.bottom + 100 }}
      >
        <Box className="overflow-hidden border-continuous flex-[1]">
          <Button
            color="#3b5998"
            onPress={() => Linking.openURL('https://www.facebook.com/fr.bible.strong')}
            leftIcon={
              <FeatherIcon name="facebook" size={20} color="white" style={{ marginRight: 10 }} />
            }
          >
            {t('Suivre')}
          </Button>
        </Box>
        <Box className="overflow-hidden border-continuous w-[20px]" />
        <Box className="overflow-hidden border-continuous flex-[1]">
          <Button
            success
            route="FAQ"
            leftIcon={
              <FeatherIcon name="help-circle" size={20} color="white" style={{ marginRight: 10 }} />
            }
          >
            {t('FAQ')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default HomeFooter
