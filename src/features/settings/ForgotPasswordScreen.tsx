import React, { useState } from 'react'
import { withTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import FireAuth from '~helpers/FireAuth'
import Button from '~common/ui/Button'
import ScrollView from '~common/ui/ScrollView'
import TextInput from '~common/ui/TextInput'
import Spacer from '~common/ui/Spacer'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Header from '~common/Header'
import { toast } from 'sonner-native'
import { useTranslation } from 'react-i18next'

const ForgotPasswordScreen = ({ theme }: { theme: any }) => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setLoading] = useState(false)
  const { t } = useTranslation()

  const onResetPassword = async () => {
    if (!email) {
      toast.error(t('Veuillez remplir les champs'))
      return
    }
    setLoading(true)
    await FireAuth.resetPassword(email)
    setLoading(false)
    router.back()
  }

  return (
    <Container>
      <Header hasBackButton title={t('forgotPassword.title')} />
      <ScrollView>
        <Box padding={20}>
          <Text color="grey">{t('forgotPassword.description')}</Text>
          <Spacer size={2} />
          <TextInput
            placeholder="Email"
            leftIcon={<Icon.Feather name="mail" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setEmail}
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Spacer size={2} />
          <Button onPress={onResetPassword} isLoading={isLoading}>
            {t('forgotPassword.send')}
          </Button>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default withTheme(ForgotPasswordScreen)
