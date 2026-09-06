import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import Lottie from 'lottie-react-native'
import React from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
const LinkBox = (props: React.ComponentProps<typeof Box> & React.ComponentProps<typeof Link>) => (
  <Box
    as={Link}
    {...props}
    className={twMerge(
      'overflow-hidden border-continuous',
      twMerge('overflow-hidden border-continuous', props.className)
    )}
  />
)

const color1 = '#E0EAFC'
const color2 = '#CFDEF3'

const DonationWidget = () => {
  const stylingTheme = useStylingTheme()

  const lang = useLanguage()
  const { t } = useTranslation()
  return (
    <Box className="overflow-hidden border-continuous bg-light-grey px-[20px] pt-[20px] pb-[20px]">
      <LinkBox
        className="p-[20px] h-[130px] relative rounded-[30px] bg-primary items-center justify-center overflow-visible"
        href={`https://bible-strong.app/${lang === 'fr' ? 'fr/' : ''}give`}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Box className="overflow-hidden border-continuous absolute left-[0px] right-[0px] top-[0px] h-[130px] rounded-[30px]">
          <LinearGradient start={[0.1, 0.2]} style={{ height: 130 }} colors={[color1, color2]} />
        </Box>
        <Lottie
          autoPlay
          style={{
            position: 'absolute',
            top: -100,
            left: -100,
            width: 300,
            height: 300,
          }}
          source={require('../../assets/images/donation.json')}
        />
        <Box className="overflow-hidden border-continuous pl-[60px]">
          <Text
            className="text-[20px] text-[black]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('donation.title')}
          </Text>
          <Text className="mt-[5px] text-[16px] text-[black]">{t('donation.description')}</Text>
        </Box>
      </LinkBox>
    </Box>
  )
}

export default DonationWidget
