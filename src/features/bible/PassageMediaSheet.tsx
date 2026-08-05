import { Image } from 'expo-image'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, type ResolvedPassageMedia } from './passageMedia'

type PassageMediaSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
  items: ResolvedPassageMedia[]
  onClose: () => void
}

const PassageMediaSheet = ({ sheetRef, items, onClose }: PassageMediaSheetProps) => {
  const { t } = useTranslation()
  const countLabel = t('bible.passageMedia.videoCount', { count: items.length })

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      snapPoints={[0.55]}
      header={<SheetHeader title={t('bible.passageMedia.title')} subTitle={countLabel} />}
    >
      <SheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <VStack>
          {items.map((item, index) => (
            <Box
              key={item.editionId}
              py={16}
              borderBottomWidth={index === items.length - 1 ? 0 : 1}
              borderColor="border"
            >
              <HStack gap={14} alignItems="center">
                <Image
                  source={item.thumbnailUrl}
                  accessibilityLabel={item.title}
                  contentFit="cover"
                  transition={150}
                  style={{ width: 128, height: 72, borderRadius: 10 }}
                />
                <VStack flex={1} gap={7}>
                  <Text fontSize={16} lineHeight={21} bold numberOfLines={3}>
                    {item.title}
                  </Text>
                  <HStack alignItems="center" gap={5}>
                    <FeatherIcon name="clock" size={13} color="grey" />
                    <Text fontSize={13} color="grey">
                      {formatPassageMediaDuration(item.durationSeconds)}
                    </Text>
                    <Text fontSize={13} color="grey">
                      ·
                    </Text>
                    <Text fontSize={13} color="grey" numberOfLines={1}>
                      {item.attributionLabel}
                    </Text>
                  </HStack>
                </VStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      </SheetScrollView>
    </Sheet>
  )
}

export default PassageMediaSheet
