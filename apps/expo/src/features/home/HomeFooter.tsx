import type { PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinkBox, type LinkProps } from '~common/Link'
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
 * Follow and FAQ. Touch layouts keep the two buttons on a raised panel that also leaves room
 * for the close button; the wide Web home lists them as links, with the app download.
 */
const HomeFooter = () => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isWide = useResponsiveWorkspace()

  if (Platform.OS === 'web' && isWide)
    return (
      <HStack className="items-center flex-wrap gap-[24px] border-t border-border mx-[20px] pt-[16px] pb-[32px]">
        <FooterLink href="https://www.facebook.com/fr.bible.strong">{t('Suivre')}</FooterLink>
        <FooterLink route="FAQ">{t('FAQ')}</FooterLink>
        <FooterLink href="https://bible-strong.app">{t('home.desktop.downloadApp')}</FooterLink>
      </HStack>
    )

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey">
      <Box
        className="overflow-hidden border-continuous bg-reverse flex-row px-[20px] pt-[20px]"
        style={[
          { paddingBottom: insets.bottom + 100 },
          { borderTopLeftRadius: 30, borderTopRightRadius: 30 },
        ]}
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
            color="#2ecc71"
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
