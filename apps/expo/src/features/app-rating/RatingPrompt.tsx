import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetView, type SheetRef } from '~common/sheet'
import Lottie from 'lottie-react-native'
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
      detached={true}
      cornerRadius={30}
    >
      <SheetView>
        <Box className="overflow-hidden border-continuous p-[20px] pt-[30px] pb-[30px]">
          <Box className="overflow-hidden border-continuous h-[80px] items-center justify-center">
            <Lottie
              autoPlay
              loop={false}
              style={{ width: 230, height: 230 }}
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/images/rating.lottie')}
            />
          </Box>
          <Paragraph className="text-center font-bold" fontFamily="text">
            {t('rating.title')}
          </Paragraph>
          <Paragraph
            className="text-center mt-[5px] mb-[20px] mx-[5px]"
            scale={-1}
            fontFamily="text"
          >
            {t('rating.subtitle')}
          </Paragraph>
          <Button fullWidth onPress={handleAccept}>
            {t('rating.accept')}
          </Button>
          <Box className="overflow-hidden border-continuous mt-[10px]">
            <Button fullWidth reverse onPress={handleRemindLater}>
              {t('rating.later')}
            </Button>
          </Box>
          <Box className="overflow-hidden border-continuous items-center justify-center mt-[15px]">
            <TouchableOpacity accessibilityRole="button" onPress={handleDecline}>
              <Paragraph
                className="text-grey"
                scale={-3}
                style={{ textDecorationLine: 'underline' }}
              >
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
