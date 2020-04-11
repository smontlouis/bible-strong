import React from 'react'
import {
  ScrollView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { withTheme } from 'emotion-theming'
import { useSelector } from 'react-redux'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import Paragraph from '~common/ui/Paragraph'
import Button from '~common/ui/Button'
import useLogin from '~helpers/useLogin'
import extractFirstName from '~helpers/extractFirstName'
import extractInitials from '~helpers/extractInitials'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import { MaterialIcon } from '~common/ui/Icon'
import LexiqueIcon from '~common/LexiqueIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import NaveIcon from '~common/NaveIcon'

import OfflineNotice from './OfflineNotice'

const Container = styled.View(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  paddingTop: getBottomSpace() + Platform.OS === 'ios' ? 20 : 45,
  paddingBottom: 0,
}))

const ProfileImage = styled.Image(({ theme }) => ({
  width: 50,
  height: 50,
  borderRadius: 10,
  backgroundColor: theme.colors.tertiary,
  alignItems: 'center',
  justifyContent: 'center',
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
  backgroundColor: 'white',
  position: 'relative',
}))

const GenerateImageContainer = ProfileImage.withComponent(Box)

const GenerateImage = ({ name }) => (
  <GenerateImageContainer>
    <Text color="reverse" bold fontSize={24}>
      {extractInitials(name)}
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
  overflow: 'visible',
}))

const ChipIcon = styled(Icon.Feather)(({ theme, color }) => ({
  color: theme.colors[color] || theme.colors.grey,
  marginRight: 5,
}))

const UserWidget = ({ theme }) => {
  const { isLogged, user } = useLogin()
  const isLoading = useSelector(state => state.user.isLoading)
  const { highlights, notes, studies, tags } = useSelector(
    ({ user: { bible } }) => ({
      highlights: Object.keys(bible.highlights).length,
      notes: Object.keys(bible.notes).length,
      studies: Object.keys(bible.studies).length,
      tags: Object.keys(bible.tags).length,
    })
  )

  if (!isLogged) {
    return (
      <Container>
        <Box paddingHorizontal={25}>
          <Text title fontSize={25} flex>
            Bienvenue
          </Text>
          <Paragraph marginTop={20} marginBottom={20}>
            Connectez-vous pour profiter de toutes les fonctionnalités de la
            Bible Strong !
          </Paragraph>
          <Button
            route="Login"
            rightIcon={
              <Icon.Feather
                name="arrow-right"
                size={20}
                color={theme.colors.reverse}
                style={{ marginLeft: 10 }}
              />
            }
          >
            Je me connecte
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <Box flex paddingHorizontal={20} overflow="visible">
        <OfflineNotice />

        <Box row alignItems="center" marginBottom={20} overflow="visible">
          <Box flex>
            <Text title fontSize={30}>
              {`Bonjour ${extractFirstName(user.displayName)},`}
            </Text>
          </Box>
          <ProfileContainer>
            {user.photoURL ? (
              <ProfileImage source={{ uri: user.photoURL }} />
            ) : (
              <GenerateImage name={user.displayName} />
            )}
            {isLoading && (
              <Box
                backgroundColor="rgba(255,255,255,0.8)"
                center
                style={StyleSheet.absoluteFillObject}
              >
                <ActivityIndicator color="black" />
              </Box>
            )}
          </ProfileContainer>
        </Box>

        {!user.emailVerified && (
          <Box marginTop={10}>
            <Text color="quart">
              Un email vous a été envoyé, merci de vérifier votre adresse.
            </Text>
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
          overflow: 'visible',
        }}
      >
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
      <Box row padding={20}>
        <Box flex={2}>
          <Button
            route="Lexique"
            leftIcon={
              <LexiqueIcon
                color="white"
                style={{ marginRight: 10 }}
                size={25}
              />
            }
          >
            Lexique
          </Button>
        </Box>
        <Box width={20} />
        <Box flex={3}>
          <Button
            secondary
            route="Dictionnaire"
            leftIcon={
              <DictionnaireIcon
                secondary
                color="white"
                style={{ marginRight: 10 }}
                size={25}
              />
            }
          >
            Dictionnaire
          </Button>
        </Box>
      </Box>
      <Box row padding={20} paddingBottom={0} paddingTop={0}>
        <Box flex={4}>
          <Button
            fullWidth
            color={theme.colors.quint}
            route="Nave"
            leftIcon={
              <NaveIcon
                secondary
                color="white"
                style={{ marginRight: 10 }}
                size={25}
              />
            }
          >
            Thèmes
          </Button>
        </Box>
        <Box width={20} />
        <Box flex={3}>
          <Button
            fullWidth
            color={theme.colors.primary}
            route="MyPlanList"
            leftIcon={
              <MaterialIcon
                name="playlist-add-check"
                color="white"
                size={30}
                style={{ marginRight: 10 }}
              />
            }
          >
            Plans
          </Button>
        </Box>
      </Box>
    </Container>
  )
}

export default withTheme(UserWidget)
