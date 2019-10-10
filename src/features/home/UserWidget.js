import React from 'react'
import { ScrollView, Platform } from 'react-native'
import { useSelector } from 'react-redux'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import Paragraph from '~common/ui/Paragraph'
import Button from '~common/ui/Button'
import useLogin from '~helpers/useLogin'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import LexiqueIcon from '~common/LexiqueIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'

const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  paddingTop: getBottomSpace() + Platform.OS === 'ios' ? 20 : 45,
  paddingBottom: 0
}))

const ProfileImage = styled.Image(({ theme }) => ({
  width: 50,
  height: 50,
  borderRadius: 10,
  backgroundColor: theme.colors.tertiary,
  alignItems: 'center',
  justifyContent: 'center'
}))

const ProfileContainer = styled.View(({ theme }) => ({
  width: 50,
  height: 50,
  borderRadius: 10,
  shadowColor: theme.colors.primary,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 1,
  overflow: 'visible',
  backgroundColor: 'white'
}))

const GenerateImageContainer = ProfileImage.withComponent(Box)

const GenerateImage = ({ name }) => (
  <GenerateImageContainer>
    <Text color="reverse" bold fontSize={24}>
      {name
        .split(' ')
        .map(n => n.substring(0, 1))
        .slice(0, 2)}
    </Text>
  </GenerateImageContainer>
)

const getPluriel = (word, count) => `${word}${count > 1 ? 's' : ''}`

const Chip = styled(Link)(({ theme }) => ({
  borderRadius: 10,
  backgroundColor: theme.colors.reverse,
  paddingVertical: 10,
  paddingHorizontal: 13,
  marginRight: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.08,
  shadowRadius: 4,
  elevation: 1,
  overflow: 'visible'
}))

const ChipIcon = styled(Icon.Feather)(({ theme, color }) => ({
  color: theme.colors[color] || theme.colors.grey,
  marginRight: 5
}))

const UserWidget = () => {
  const { isLogged, user } = useLogin()
  const { highlights, notes, studies, tags } = useSelector(({ user: { bible } }) => ({
    highlights: Object.keys(bible.highlights).length,
    notes: Object.keys(bible.notes).length,
    studies: Object.keys(bible.studies).length,
    tags: Object.keys(bible.tags).length
  }))

  if (!isLogged) {
    return (
      <Container>
        <Box paddingHorizontal={25}>
          <Text title fontSize={25} flex>
            Bienvenue
          </Text>
          <Paragraph marginTop={20} marginBottom={20}>
            Connectez-vous pour profiter de toutes les fonctionnalités de la Bible Strong !
          </Paragraph>
          <Button
            route="Login"
            title="Je me connecte"
            rightIcon={
              <Icon.Feather name="arrow-right" size={20} color="white" style={{ marginLeft: 10 }} />
            }
          />
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Box flex paddingHorizontal={20} overflow="visible">
        <Box row alignItems="center" marginBottom={20} overflow="visible">
          <Box flex>
            <Text title fontSize={30}>
              {`Bonjour ${user.displayName.split(' ')[0]},`}
            </Text>
          </Box>
          <ProfileContainer>
            {user.photoURL ? (
              <ProfileImage source={{ uri: user.photoURL }} />
            ) : (
              <GenerateImage name={user.displayName} />
            )}
          </ProfileContainer>
        </Box>

        {!user.emailVerified && (
          <Box marginTop={10}>
            <Text color="quart">Un email vous a été envoyé, merci de vérifier votre adresse.</Text>
          </Box>
        )}
      </Box>
      <ScrollView
        horizontal
        style={{ maxHeight: 95, overflow: 'visible' }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: 'row',
          paddingHorizontal: 20,
          paddingVertical: 10,
          overflow: 'visible'
        }}>
        <Chip route="Highlights">
          <Box row marginBottom={5}>
            <ChipIcon name="edit-3" size={20} />
            <Text bold fontSize={20}>
              {highlights}
            </Text>
          </Box>
          <Text fontSize={12}>{getPluriel('surbrillance', highlights)}</Text>
        </Chip>
        <Chip route="BibleVerseNotes">
          <Box row marginBottom={5}>
            <ChipIcon name="file-text" size={20} />
            <Text bold fontSize={20}>
              {notes}
            </Text>
          </Box>
          <Text fontSize={12}>{getPluriel('note', notes)}</Text>
        </Chip>
        <Chip route="Studies">
          <Box row marginBottom={5}>
            <ChipIcon name="feather" size={20} />
            <Text bold fontSize={20}>
              {studies}
            </Text>
          </Box>
          <Text fontSize={12}>{getPluriel('étude', studies)}</Text>
        </Chip>
        <Chip route="Tags">
          <Box row marginBottom={5}>
            <ChipIcon name="tag" size={20} />
            <Text bold fontSize={20}>
              {tags}
            </Text>
          </Box>
          <Text fontSize={12}>{getPluriel('étiquette', tags)}</Text>
        </Chip>
      </ScrollView>
      <Box row margin={20} marginBottom={0}>
        <Box flex={2}>
          <Button
            route="Lexique"
            title="Lexique"
            leftIcon={<LexiqueIcon color="white" style={{ marginRight: 10 }} size={25} />}
          />
        </Box>
        <Box width={20} />
        <Box flex={3}>
          <Button
            secondary
            route="Dictionnaire"
            title="Dictionnaire"
            leftIcon={
              <DictionnaireIcon secondary color="white" style={{ marginRight: 10 }} size={25} />
            }
          />
        </Box>
      </Box>
    </Container>
  )
}

export default UserWidget
