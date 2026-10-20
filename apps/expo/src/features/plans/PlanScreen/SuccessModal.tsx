import Lottie from 'lottie-react-native'
import React from 'react'
import { SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
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
    <Sheet modalTitle={t('Félicitations')} ref={modalRef} onDismiss={onClose} dismissible={false}>
      <SheetView className="pt-[40px] pb-[10px] px-[20px]">
        <Box className="overflow-hidden border-continuous items-center justify-center">
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
        <Box className="overflow-hidden border-continuous bg-light-grey rounded-[12px] mb-[30px] p-[20px]">
          {isPlanCompleted ? (
            <>
              <Paragraph className="text-center font-bold" fontFamily="text">
                {t('Félicitations')} !!
              </Paragraph>
              <Paragraph className="text-center" scale={-1} fontFamily="text">
                {t('Vous avez complété ce plan')} !
              </Paragraph>
            </>
          ) : (
            <>
              <Paragraph className="text-center font-bold" fontFamily="text">
                {t('Félicitations')} !
              </Paragraph>
              <Paragraph className="text-center" scale={-1} fontFamily="text">
                {t('Vous venez de finir votre lecture.')}
              </Paragraph>
            </>
          )}
        </Box>
        <Button onPress={handleClose}>{t('Continuer')}</Button>
      </SheetView>
    </Sheet>
  )
}

export default SuccessModal
