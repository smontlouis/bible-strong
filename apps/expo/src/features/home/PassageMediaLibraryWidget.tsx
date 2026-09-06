import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
const PassageMediaLibraryWidget = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const router = useRouter()

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey pt-[20px]">
      <TouchableBox
        className="overflow-hidden border-continuous rounded-[20px] bg-reverse h-[136px] flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={t('passageMediaLibrary.open')}
        activeOpacity={0.84}
        onPress={() => router.push('/(library)/passage-media')}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Box className="border-continuous overflow-visible w-[48%] h-[100%] bg-light-grey rounded-tl-[20px] rounded-bl-[20px]">
          <Image
            source={require('~assets/images/home/courses-videos.jpg')}
            contentFit="cover"
            contentPosition="center"
            style={{
              width: '100%',
              height: '100%',
              borderBottomLeftRadius: 20,
              borderTopLeftRadius: 20,
            }}
          />
        </Box>
        <Box className="overflow-hidden border-continuous flex-[1] h-[100%] px-[16px] pb-[24px] pt-[30px]">
          <Text
            className="text-[20px]"
            numberOfLines={2}
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('passageMediaLibrary.title')}
          </Text>
          <Box
            className="overflow-hidden border-continuous absolute right-[14px] bottom-[12px] rounded-[18px] bg-light-primary items-center justify-center"
            style={{ width: 34, height: 34 }}
          >
            <FeatherIcon color="primary" name="chevron-right" size={20} />
          </Box>
        </Box>
      </TouchableBox>
    </Box>
  )
}

export default PassageMediaLibraryWidget
