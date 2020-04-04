import React, { useState } from 'react'
import { Platform, Alert, Linking } from 'react-native'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'
import { useSelector } from 'react-redux'
import * as Animatable from 'react-native-animatable'

import LexiqueIcon from '~common/LexiqueIcon'
import DictionnaireIcon from '~common/DictionnaryIcon'
import NaveIcon from '~common/NaveIcon'
import Container from '~common/ui/Container'
import Border from '~common/ui/Border'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import TagsEditModal from '~common/TagsEditModal'
import useLogin from '~helpers/useLogin'

import app from '../../../package.json'

const LinkItem = styled(Link)(({}) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 15,
}))

const Circle = styled.View(({ theme }) => ({
  position: 'absolute',
  width: 10,
  height: 10,
  borderRadius: 10,
  top: 0,
  right: 8,
  backgroundColor: theme.colors.success,
}))

const AnimatedCircle = Animatable.createAnimatableComponent(Circle)

const StyledIcon = styled(Icon.Feather)(({ theme, color }) => ({
  color: theme.colors[color] || theme.colors.grey,
  marginRight: 15,
}))

const shareMessage = () => {
  const appUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
      : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
  return `Bible Strong App ${appUrl}`
}

const MoreScreen = () => {
  const { isLogged, logout } = useLogin()
  const [isEditTagsOpen, setEditTagsOpen] = useState(false)
  const hasUpdate = useSelector(state =>
    Object.values(state.user.needsUpdate).some(v => v)
  )

  const promptLogout = () => {
    Alert.alert('Attention', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      { text: 'Oui', onPress: () => logout(), style: 'destructive' },
    ])
  }

  return (
    <Container>
      <Header title="Plus" />
      <ScrollView style={{ flex: 1 }}>
        <Box paddingVertical={10}>
          <LinkItem route="Lexique">
            <LexiqueIcon style={{ marginRight: 15 }} size={25} />
            <Text color="primary" bold fontSize={15}>
              Lexique
            </Text>
          </LinkItem>
          <LinkItem route="Dictionnaire">
            <DictionnaireIcon style={{ marginRight: 15 }} size={25} />
            <Text color="secondary" bold fontSize={15}>
              Dictionnaire
            </Text>
          </LinkItem>
          <LinkItem route="Nave">
            <NaveIcon style={{ marginRight: 15 }} size={25} />
            <Text color="quint" bold fontSize={15}>
              Bible Thématique Nave
            </Text>
          </LinkItem>
          <LinkItem route="Highlights">
            <StyledIcon name="edit-3" size={25} />
            <Text bold fontSize={15}>
              Surbrillances
            </Text>
          </LinkItem>
          <LinkItem route="BibleVerseNotes">
            <StyledIcon name="file-text" size={25} />
            <Text bold fontSize={15}>
              Notes
            </Text>
          </LinkItem>
          <LinkItem route="Tags">
            <StyledIcon name="tag" size={25} />
            <Text bold fontSize={15}>
              Étiquettes
            </Text>
          </LinkItem>
        </Box>
        <Border marginHorizontal={20} />
        <Box paddingVertical={10}>
          <LinkItem route="Downloads">
            <Box>
              {hasUpdate && (
                <AnimatedCircle
                  animation="pulse"
                  easing="ease-out"
                  iterationCount="infinite"
                />
              )}
              <StyledIcon name="download" size={25} />
            </Box>
            <Text fontSize={15}>Gestion des téléchargements</Text>
          </LinkItem>
          <LinkItem route="Changelog">
            <StyledIcon name="terminal" size={25} />
            <Text fontSize={15}>Changelog</Text>
          </LinkItem>
          <LinkItem route="FAQ">
            <StyledIcon name="help-circle" size={25} />
            <Text fontSize={15}>Foire aux questions</Text>
          </LinkItem>
          <LinkItem href="https://bible-strong.canny.io/fonctionnalites">
            <StyledIcon name="sun" size={25} />
            <Text fontSize={15}>Idées de fonctionnalités</Text>
          </LinkItem>
          <LinkItem href="https://bible-strong.canny.io/bugs">
            <StyledIcon name="alert-circle" size={25} />
            <Text fontSize={15}>Bugs</Text>
          </LinkItem>

          <LinkItem href="https://www.facebook.com/fr.bible.strong">
            <StyledIcon name="facebook" size={25} />
            <Text fontSize={15}>Nous suivre sur facebook</Text>
          </LinkItem>
          <LinkItem
            href={
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
                : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
            }
          >
            <StyledIcon name="star" size={25} />
            <Text fontSize={15}>Noter l'application</Text>
          </LinkItem>
          <LinkItem share={shareMessage()}>
            <StyledIcon name="share-2" size={25} />
            <Text fontSize={15}>Partager l'application</Text>
          </LinkItem>
          <LinkItem href="mailto:s.montlouis.calixte@gmail.com">
            <StyledIcon name="send" size={25} />
            <Text fontSize={15}>Contacter le développeur</Text>
          </LinkItem>
          <LinkItem
            {...(Platform.OS === 'android'
              ? {
                  route: 'Support',
                }
              : {
                  onPress: () =>
                    Linking.openURL('https://www.paypal.me/smontlouis'),
                })}
          >
            <StyledIcon name="thumbs-up" size={25} color="secondary" />
            <Text fontSize={15}>Soutenir le développeur</Text>
          </LinkItem>
          {!isLogged && (
            <LinkItem route="Login">
              <StyledIcon color="primary" name="log-in" size={25} />
              <Text color="primary" fontSize={15} bold>
                Se connecter
              </Text>
            </LinkItem>
          )}
          {isLogged && (
            <LinkItem onPress={promptLogout}>
              <StyledIcon color="quart" name="log-out" size={25} />
              <Text bold color="quart" fontSize={15}>
                Se déconnecter
              </Text>
            </LinkItem>
          )}
        </Box>
      </ScrollView>
      <Box position="absolute" bottom={30} right={10}>
        <Text color="grey" fontSize={12}>
          Version: {app.version}
        </Text>
      </Box>
      <TagsEditModal
        isVisible={isEditTagsOpen}
        onClosed={() => setEditTagsOpen(false)}
      />
    </Container>
  )
}
export default MoreScreen
