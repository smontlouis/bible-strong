import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@emotion/react'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import { renderBackdrop } from '~helpers/bottomSheetHelpers'
import { useAppRating } from './useAppRating'

interface Props {
  modalRef: React.RefObject<BottomSheetMethods | null>
}

const RatingPrompt = ({ modalRef }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { acceptRating, remindLater, declineRating } = useAppRating()

  const handleAccept = () => {
    modalRef.current?.close()
    // Small delay to let the modal close animation finish
    setTimeout(() => {
      acceptRating()
    }, 300)
  }

  const handleRemindLater = () => {
    remindLater()
    modalRef.current?.close()
  }

  const handleDecline = () => {
    declineRating()
    modalRef.current?.close()
  }

  return (
    <BottomSheet
      ref={modalRef}
      index={-1}
      handleIndicatorStyle={{ opacity: 0 }}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: 'transparent' }}
    >
      <BottomSheetScrollView scrollEnabled={false}>
        <Box flex={1} justifyContent="flex-end" paddingVertical={40} paddingHorizontal={20}>
          <Box center mb={20}>
            <Box
              center
              width={80}
              height={80}
              borderRadius={40}
              backgroundColor="reverse"
              lightShadow
            >
              <Feather name="star" size={40} color={theme.colors.secondary} />
            </Box>
          </Box>
          <Box
            backgroundColor="reverse"
            lightShadow
            borderRadius={30}
            marginBottom={20}
            padding={20}
          >
            <Paragraph fontFamily="text" textAlign="center" bold>
              {t('rating.title')}
            </Paragraph>
            <Paragraph scale={-1} fontFamily="text" textAlign="center" mt={5}>
              {t('rating.subtitle')}
            </Paragraph>
          </Box>
          <Button fullWidth onPress={handleAccept}>
            {t('rating.accept')}
          </Button>
          <Box mt={10}>
            <Button fullWidth reverse onPress={handleRemindLater}>
              {t('rating.later')}
            </Button>
          </Box>
          <Box center mt={15}>
            <TouchableOpacity onPress={handleDecline}>
              <Paragraph
                scale={-3}
                color="grey"
                style={{ textDecorationLine: 'underline' }}
              >
                {t('rating.decline')}
              </Paragraph>
            </TouchableOpacity>
          </Box>
        </Box>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default RatingPrompt
