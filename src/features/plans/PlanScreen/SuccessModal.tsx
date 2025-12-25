import Lottie from 'lottie-react-native'
import React from 'react'

import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Paragraph from '~common/ui/Paragraph'
import { renderBackdrop } from '~helpers/bottomSheetHelpers'
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types'

interface Props {
  modalRef: React.RefObject<BottomSheetMethods | null>
  isPlanCompleted: boolean
}

const SuccessModal = ({ modalRef, isPlanCompleted }: Props) => {
  const { t } = useTranslation()
  return (
    <BottomSheet
      ref={modalRef}
      index={-1}
      handleIndicatorStyle={{
        opacity: 0,
      }}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: 'transparent',
      }}
    >
      <BottomSheetScrollView scrollEnabled={false}>
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
          <Box
            backgroundColor="reverse"
            lightShadow
            borderRadius={30}
            marginBottom={30}
            padding={20}
          >
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
          <Button fullWidth onPress={() => modalRef?.current?.close()}>
            {t('Continuer')}
          </Button>
        </Box>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default SuccessModal
