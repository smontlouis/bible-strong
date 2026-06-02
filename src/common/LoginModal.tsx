import React, { useEffect, useRef } from 'react'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Login from './Login'

import { Sheet, SheetScrollView, type SheetRef } from '~common/sheet'
import { useTranslation } from 'react-i18next'
import Text from '~common/ui/Text'
import Back from './Back'
import { FeatherIcon } from './ui/Icon'

// More like StudiesLoginModal

const LoginModal = ({ isVisible }: { isVisible: boolean }) => {
  const { t } = useTranslation()
  const ref = useRef<SheetRef>(null)

  useEffect(() => {
    if (isVisible) {
      ref.current?.present()
    } else {
      ref.current?.dismiss()
    }
  }, [isVisible])

  return (
    <Sheet ref={ref} snapPoints={[1]} backdrop>
      <SheetScrollView contentContainerStyle={{ padding: 20 }}>
        <Box row alignItems="center" marginBottom={30}>
          <Back style={{ marginRight: 15 }}>
            <FeatherIcon name="arrow-left" size={25} />
          </Back>
          <Text title fontSize={30}>
            {t('Études bibliques')}
          </Text>
        </Box>
        <Paragraph scaleLineHeight={-2}>
          {t('Rédigez vos études, sauvegardez-les dans le cloud.')}
        </Paragraph>
        <Paragraph scaleLineHeight={-2} marginTop={10} marginBottom={20}>
          {t('Rejoignez la communauté !')}
        </Paragraph>
        <Login />
      </SheetScrollView>
    </Sheet>
  )
}

export default LoginModal
