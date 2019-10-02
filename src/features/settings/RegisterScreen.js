import React, { useState } from 'react'
import { ScrollView } from 'react-native'
import { withTheme } from 'emotion-theming'
import * as Icon from '@expo/vector-icons'

import FireAuth from '~helpers/FireAuth'
import Button from '~common/ui/Button'
import TextInput from '~common/ui/TextInput'
import Spacer from '~common/ui/Spacer'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Header from '~common/Header'

const LoginScreen = ({ theme }) => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setLoading] = useState(false)

  const onRegister = async () => {
    setLoading(true)
    const isStillLoading = await FireAuth.register(username, email, password)
    setLoading(isStillLoading)
  }

  return (
    <Container>
      <Header hasBackButton title="Créer un compte" />
      <ScrollView>
        <Box padding={20}>
          <TextInput
            placeholder="Nom"
            leftIcon={<Icon.Feather name="user" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setUsername}
          />
          <Spacer />
          <TextInput
            placeholder="Email"
            leftIcon={<Icon.Feather name="mail" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setEmail}
          />
          <Spacer />
          <TextInput
            placeholder="Mot de passe"
            leftIcon={<Icon.Feather name="lock" size={20} color={theme.colors.darkGrey} />}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Spacer size={2} />
          <Button title="Créer mon compte" onPress={onRegister} isLoading={isLoading} />
        </Box>
      </ScrollView>
    </Container>
  )
}
export default withTheme(LoginScreen)
