import { Sheet, SheetView, type SheetRef } from '~common/sheet'
import { Image } from 'expo-image'
import React, { useState } from 'react'
import { ActivityIndicator, Platform } from 'react-native'
import Empty from '~common/Empty'
import { LinkBox } from '~common/Link'
import Loading from '~common/Loading'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
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
  modalRef: React.RefObject<SheetRef | null>
  imageUrls: ImageUrls | null
  verseOfTheDay: VerseOfTheDayData
}

const VerseImageModal = ({ modalRef, imageUrls, verseOfTheDay }: Props) => {
  const [shareIsLoading, setShareIsLoading] = useState(false)
  const { t } = useTranslation()
  const imageSize = wp(100, true) - 80

  const shareImage = async () => {
    if (shareIsLoading || !imageUrls?.large) return

    setShareIsLoading(true)
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ url: imageUrls.large })
        }
        setShareIsLoading(false)
        return
      }
      const [FileSystem, Sharing] = await Promise.all([
        import('expo-file-system/legacy'),
        import('expo-sharing'),
      ])
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
    <Sheet ref={modalRef}>
      <SheetView>
        <Box center p={20}>
          {renderContent()}
        </Box>
      </SheetView>
    </Sheet>
  )
}

export default VerseImageModal
