import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  formatPassageMediaDuration,
  type ResolvedPassageMediaLibraryItem,
} from '~features/bible/passageMedia'
type Props = {
  item: ResolvedPassageMediaLibraryItem
  episodeNumber: number
  thumbnailWidth: number
  onPress: () => void
}

const PassageMediaLibraryCard = ({ item, episodeNumber, thumbnailWidth, onPress }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()

  return (
    <TouchableBox
      className="overflow-hidden border-continuous flex-row items-center gap-[14px] mb-[16px]"
      accessibilityRole="button"
      accessibilityLabel={item.title}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <Box
        className="border-continuous overflow-visible rounded-[12px]"
        style={{
          width: thumbnailWidth,
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Box
          className="border-continuous overflow-visible rounded-[12px] border-[1px] border-border bg-light-grey"
          style={{ aspectRatio: 16 / 9 }}
        >
          <Image
            source={{ uri: item.thumbnailUrl }}
            placeholder={{ blurhash: item.blurHash }}
            placeholderContentFit="cover"
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={180}
            style={{ width: '100%', height: '100%', borderRadius: 12 }}
          />
        </Box>
      </Box>
      <VStack className="overflow-hidden border-continuous flex-[1] gap-[4px] py-[2px]">
        <Text className="font-bold text-primary text-[12px] leading-[15px]">
          {t('passageMediaLibrary.episode', { number: episodeNumber })}
        </Text>
        <Text
          className="text-[16px] leading-[20px]"
          numberOfLines={2}
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {item.title}
        </Text>
        <Text
          className="text-grey text-[12px] leading-[16px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
        >
          {formatPassageMediaDuration(item.durationSeconds)}
        </Text>
      </VStack>
    </TouchableBox>
  )
}

export default PassageMediaLibraryCard
