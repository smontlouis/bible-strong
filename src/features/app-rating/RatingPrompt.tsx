import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetView, type SheetRef } from '~common/sheet'
import Lottie from 'lottie-react-native'
import { useTheme } from '@emotion/react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import { useAppRating } from './useAppRating'

interface Props {
  modalRef: React.RefObject<SheetRef | null>
  onClose: () => void
}

const RatingPrompt = ({ modalRef, onClose }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { acceptRating, remindLater, declineRating } = useAppRating()

  const handleAccept = () => {
    onClose()
    setTimeout(() => {
      acceptRating()
    }, 300)
  }

  const handleRemindLater = () => {
    remindLater()
    onClose()
  }

  const handleDecline = () => {
    declineRating()
    onClose()
  }

  return (
    <Sheet
      ref={modalRef}
      detachedOffset={insets.bottom + 50}
      dismissible={false}
      backdrop
      detached={true}
      grabber={false}
      cornerRadius={30}
      backgroundColor={theme.colors.reverse}
    >
      <SheetView>
        <Box padding={20} paddingTop={30} paddingBottom={30}>
          <Box height={80} alignItems="center" justifyContent="center">
            <Lottie
              autoPlay
              loop={false}
              style={{ width: 230, height: 230 }}
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/images/rating.lottie')}
            />
          </Box>
          <Paragraph fontFamily="text" textAlign="center" bold>
            {t('rating.title')}
          </Paragraph>
          <Paragraph scale={-1} fontFamily="text" textAlign="center" mt={5} mb={20} mx={5}>
            {t('rating.subtitle')}
          </Paragraph>
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
              <Paragraph scale={-3} color="grey" style={{ textDecorationLine: 'underline' }}>
                {t('rating.decline')}
              </Paragraph>
            </TouchableOpacity>
          </Box>
        </Box>
      </SheetView>
    </Sheet>
  )
}

export default RatingPrompt
