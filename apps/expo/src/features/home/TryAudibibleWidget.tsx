import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import React from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Image } from 'react-native'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
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

const color1 = '#010F1B'
const color2 = '#132E4D'

const TryAudibibleWidget = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  return (
    <Box className="overflow-hidden border-continuous bg-light-grey px-[20px] pb-[40px]">
      <LinkBox
        className="p-[20px] h-[100px] relative items-center bg-primary flex-row rounded-[20px] overflow-visible"
        href={`https://click.audibible.app/5nmN/stephane30`}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Box className="overflow-hidden border-continuous absolute left-[0px] right-[0px] top-[0px] h-[100px] rounded-[20px]">
          <LinearGradient start={[0.1, 0.2]} style={{ height: 100 }} colors={[color1, color2]} />
        </Box>
        <Image
          style={{
            width: 60,
            height: 60,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: 'white',
          }}
          source={require('../../assets/images/audibible-icon.png')}
        />
        <Box className="overflow-hidden border-continuous ml-[16px]">
          <Text
            className="text-[20px] text-[white]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('audibible.try')}
          </Text>
          <Text className="text-[16px] text-[white]">{t('audibible.description')}</Text>
        </Box>
      </LinkBox>
    </Box>
  )
}

export default TryAudibibleWidget
