import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React, { useEffect, useRef } from 'react'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Login from './Login'
import { SheetScrollView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import { useTranslation } from 'react-i18next'
import Text from '~common/ui/Text'
import Back from './Back'
import { FeatherIcon } from './ui/Icon'
// More like StudiesLoginModal

const LoginModal = ({ isVisible }: { isVisible: boolean }) => {
  const stylingTheme = useStylingTheme()

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
    <Sheet modalTitle={t('Études bibliques')} ref={ref} snapPoints={[1]} dismissible={false}>
      <SheetScrollView contentContainerStyle={{ padding: 20 }}>
        <Box className="overflow-hidden border-continuous flex-row items-center mb-[30px]">
          <Back style={{ marginRight: 15 }}>
            <FeatherIcon name="arrow-left" size={25} />
          </Back>
          <Text
            className="text-[30px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('Études bibliques')}
          </Text>
        </Box>
        <Paragraph scaleLineHeight={-2}>
          {t('Rédigez vos études, sauvegardez-les dans le cloud.')}
        </Paragraph>
        <Paragraph className="mt-[10px] mb-[20px]" scaleLineHeight={-2}>
          {t('Rejoignez la communauté !')}
        </Paragraph>
        <Login />
      </SheetScrollView>
    </Sheet>
  )
}

export default LoginModal
