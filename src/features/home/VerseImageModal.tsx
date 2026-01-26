import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import React, { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Empty from '~common/Empty'
import { LinkBox } from '~common/Link'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { wp } from '~helpers/utils'
import { toast } from '~helpers/toast'
import { useTranslation } from 'react-i18next'

interface ImageUrls {
  small?: string
  large?: string
  error?: boolean
}

interface VerseOfTheDayData {
  v: string
}

interface Props {
  modalRef: React.RefObject<BottomSheetModal | null>
  imageUrls: ImageUrls | null
  verseOfTheDay: VerseOfTheDayData
}

const VerseImageModal = ({ modalRef, imageUrls, verseOfTheDay }: Props) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [shareIsLoading, setShareIsLoading] = useState(false)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()
  const imageSize = wp(100, true) - 80

  const shareImage = async () => {
    if (shareIsLoading || !imageUrls?.large) return

    setShareIsLoading(true)
    try {
      const path = `${FileSystem.documentDirectory}${verseOfTheDay.v}.jpeg`
      const imageFile = await FileSystem.getInfoAsync(path)

      if (!imageFile.exists) {
        const { uri } = await FileSystem.downloadAsync(imageUrls.large, path)
        await Sharing.shareAsync(uri)
      } else {
        await Sharing.shareAsync(imageFile.uri)
      }
      setShareIsLoading(false)
    } catch (error) {
      console.error(error)
      setShareIsLoading(false)
      toast.error(t("Une erreur s'est produite"))
    }
  }

  const renderContent = () => {
    if (!imageUrls) {
      return (
        <Box height={100} center>
          <Loading />
        </Box>
      )
    }

    if (imageUrls.error) {
      return (
        <Box height={100} center>
          <Empty message="Impossible de charger l'image..." />
        </Box>
      )
    }

    return (
      <Box position="relative">
        <Image
          source={{ uri: imageUrls.large }}
          placeholder={{ uri: imageUrls.small }}
          style={{
            width: imageSize,
            height: imageSize,
            borderRadius: 12,
          }}
          contentFit="contain"
          transition={300}
        />
        <LinkBox
          position="absolute"
          bottom={10}
          left={10}
          width={36}
          height={36}
          onPress={shareImage}
          bg="reverse"
          center
          rounded
          opacity={0.6}
        >
          {shareIsLoading ? (
            <ActivityIndicator size={14} />
          ) : (
            <FeatherIcon name="share-2" size={16} />
          )}
        </LinkBox>
        <Box
          position="absolute"
          bottom={0}
          right={0}
          bg="rgba(255,255,255,0.3)"
          p={4}
          borderRadius={4}
        >
          <Text fontSize={8} color="default">
            copyright bible.com
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      detached
      bottomInset={insets.bottom + 46}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      key={key}
      {...bottomSheetStyles}
      style={{
        marginHorizontal: 20,
      }}
      backgroundStyle={{
        backgroundColor: theme.colors.lightGrey,
        borderRadius: 20,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.colors.default,
        opacity: 0.3,
        width: 40,
      }}
    >
      <BottomSheetView>
        <Box center p={20} pb={30}>
          {renderContent()}
        </Box>
      </BottomSheetView>
    </BottomSheetModal>
  )
}

export default VerseImageModal
