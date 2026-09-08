import { SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import { Image } from 'expo-image'
import React, { useState } from 'react'
import { ActivityIndicator, Platform, useWindowDimensions } from 'react-native'
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
  const { width } = useWindowDimensions()
  const imageSize =
    Platform.OS === 'web' ? Math.max(0, Math.min(440, width - 88)) : wp(100, true) - 80

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
        <Box className="overflow-hidden border-continuous h-[100px] items-center justify-center">
          <Loading />
        </Box>
      )
    }

    if (imageUrls.error) {
      return (
        <Box className="overflow-hidden border-continuous h-[100px] items-center justify-center">
          <Empty message="Impossible de charger l'image..." />
        </Box>
      )
    }

    return (
      <Box className="overflow-hidden border-continuous relative">
        <Image
          accessibilityLabel={t('accessibility.verseImage', { reference: verseOfTheDay.v })}
          accessible
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
          className="w-[44px] h-[44px] absolute bottom-[10px] left-[10px] bg-reverse items-center justify-center rounded-[20px]"
          accessibilityLabel={t('accessibility.shareVerseImage')}
          accessibilityState={{ busy: shareIsLoading, disabled: shareIsLoading }}
          disabled={shareIsLoading}
          onPress={shareImage}
          style={[{ opacity: shareIsLoading ? 0.6 : 1 }, [{ opacity: shareIsLoading ? 0.6 : 0.6 }]]}
        >
          {shareIsLoading ? (
            <ActivityIndicator accessible={false} size={14} />
          ) : (
            <FeatherIcon name="share-2" size={16} />
          )}
        </LinkBox>
        <Box className="overflow-hidden border-continuous absolute bottom-[0px] right-[0px] bg-[rgba(255,255,255,0.3)] p-[4px] rounded-[4px]">
          <Text className="text-[8px] text-default">copyright bible.com</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Sheet modalTitle={t('accessibility.createVerseImage')} ref={modalRef}>
      <SheetView>
        <Box className="overflow-hidden border-continuous items-center justify-center p-[20px]">
          {renderContent()}
        </Box>
      </SheetView>
    </Sheet>
  )
}

export default VerseImageModal
