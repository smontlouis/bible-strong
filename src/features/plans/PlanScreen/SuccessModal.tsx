import Lottie from 'lottie-react-native'
import React from 'react'

import { Sheet, type SheetRef } from '~common/sheet'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'

interface Props {
  modalRef: React.RefObject<SheetRef | null>
  isPlanCompleted: boolean
  onClose?: () => void
}

const SuccessModal = ({ modalRef, isPlanCompleted, onClose }: Props) => {
  const { t } = useTranslation()

  const handleClose = () => {
    modalRef?.current?.dismiss()
    onClose?.()
  }

  return (
    <Sheet ref={modalRef} onDismiss={onClose} dismissible={false} backgroundColor="transparent">
      <Box flex={1} justifyContent="flex-end" paddingVertical={40} paddingHorizontal={20}>
        <Box center>
          <Lottie
            autoPlay
            style={{
              width: '100%',
              height: 280,
            }}
            source={
              isPlanCompleted
                ? require('../../../assets/images/crown.json')
                : require('../../../assets/images/medal.json')
            }
          />
        </Box>
        <Box backgroundColor="reverse" lightShadow borderRadius={30} marginBottom={30} padding={20}>
          {isPlanCompleted ? (
            <>
              <Paragraph fontFamily="text" textAlign="center" bold>
                {t('Félicitations')} !!
              </Paragraph>
              <Paragraph scale={-1} fontFamily="text" textAlign="center">
                {t('Vous avez complété ce plan')} !
              </Paragraph>
            </>
          ) : (
            <>
              <Paragraph fontFamily="text" textAlign="center" bold>
                {t('Félicitations')} !
              </Paragraph>
              <Paragraph scale={-1} fontFamily="text" textAlign="center">
                {t('Vous venez de finir votre lecture.')}
              </Paragraph>
            </>
          )}
        </Box>
        <Button fullWidth onPress={handleClose}>
          {t('Continuer')}
        </Button>
      </Box>
    </Sheet>
  )
}

export default SuccessModal
