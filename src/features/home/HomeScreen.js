import React from 'react'
import { ScrollView } from 'react-native'

import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Login from '~common/Login'
import useLogin from '~helpers/useLogin'

import VerseOfTheDay from './VerseOfTheDay'
import StrongOfTheDay from './StrongOfTheDay'
import WordOfTheDay from './WordOfTheDay'
import UserWidget from './UserWidget'

const DLScreen = () => {
  const { isLogged, user } = useLogin()
  return (
    <Container>
      <ScrollView>
        <Box padding={20} paddingBottom={0}>
          {isLogged ? (
            <UserWidget user={user} />
          ) : (
            <Box>
              <Text title fontSize={30} flex>
                Bienvenue.
              </Text>
              <Paragraph marginTop={20}>
                Connectez-vous pour profiter de toutes les fonctionnalités de la Bible Strong !
              </Paragraph>
              <Login />
            </Box>
          )}
        </Box>
        <VerseOfTheDay />
        <Box padding={20}>
          <Text title fontSize={20} flex>
            {'Mot grec aléatoire'}
          </Text>
          <Box marginTop={10} />
          <StrongOfTheDay type="grec" />
          <Box marginTop={20} />
          <Text title fontSize={20} flex>
            {'Mot hébreu aléatoire'}
          </Text>
          <Box marginTop={10} />
          <StrongOfTheDay type="hebreu" color1="rgba(248,131,121,1)" color2="rgba(255,77,93,1)" />
          <Box marginTop={20} />
          <Text title fontSize={20} flex>
            {'Mot du dictionnaire aléatoire'}
          </Text>
          <Box marginTop={10} />
          <WordOfTheDay color1="rgba(255,197,61,0.7)" color2="rgb(255,188,0)" />
        </Box>
      </ScrollView>
    </Container>
  )
}
export default DLScreen
