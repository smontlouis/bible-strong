import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

const PassageMediaLibraryWidget = () => {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <Box bg="lightGrey" pt={20}>
      <TouchableBox
        accessibilityRole="button"
        accessibilityLabel={t('passageMediaLibrary.open')}
        activeOpacity={0.84}
        rounded
        lightShadow
        bg="reverse"
        height={136}
        row
        alignItems="center"
        onPress={() => router.push('/(library)/passage-media')}
      >
        <Box
          width="48%"
          height="100%"
          bg="lightGrey"
          borderTopLeftRadius={20}
          borderBottomLeftRadius={20}
          overflow="hidden"
        >
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
        <Box flex height="100%" px={16} pb={24} pt={30}>
          <Text title fontSize={20} numberOfLines={2}>
            {t('passageMediaLibrary.title')}
          </Text>
          <Box
            pos="absolute"
            right={14}
            bottom={12}
            size={34}
            borderRadius={18}
            bg="lightPrimary"
            center
          >
            <FeatherIcon color="primary" name="chevron-right" size={20} />
          </Box>
        </Box>
      </TouchableBox>
    </Box>
  )
}

export default PassageMediaLibraryWidget
