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
  const { t } = useTranslation()

  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityLabel={item.title}
      activeOpacity={0.82}
      row
      alignItems="center"
      gap={14}
      mb={16}
      onPress={onPress}
    >
      <Box width={thumbnailWidth} borderRadius={12} lightShadow overflow="visible">
        <Box
          borderRadius={12}
          borderWidth={1}
          borderColor="border"
          bg="lightGrey"
          overflow="hidden"
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
      <VStack flex gap={4} py={2}>
        <Text bold color="primary" fontSize={12} lineHeight={15}>
          {t('passageMediaLibrary.episode', { number: episodeNumber })}
        </Text>
        <Text title fontSize={16} lineHeight={20} numberOfLines={2}>
          {item.title}
        </Text>
        <Text text color="grey" fontSize={12} lineHeight={16}>
          {formatPassageMediaDuration(item.durationSeconds)}
        </Text>
      </VStack>
    </TouchableBox>
  )
}

export default PassageMediaLibraryCard
