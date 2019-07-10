import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import { ScrollView, Platform } from 'react-native'
import { withTheme } from 'emotion-theming'
import * as Icon from '@expo/vector-icons'
import styled from '@emotion/native'

import Link from '~common/Link'
import Text from '~common/ui/Text'

const LinkItem = styled(Link)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border
}))

const StyledIcon = styled(Icon.Feather)(({ theme, color }) => ({
  color: color || theme.colors.grey,
  marginRight: 15
}))

const shareMessage = () => {
  const appUrl = Platform.OS === 'ios' ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8' : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
  return `Bible Strong App ${appUrl}`
}

const ProfileScreen = ({ theme }) => (
  (
    <Container>
      <Header title='Plus' />
      <ScrollView>
        <LinkItem route={'Search'}>
          <StyledIcon name={'search'} size={30} />
          <Text bold fontSize={15}>Recherche</Text>
        </LinkItem>
        <LinkItem href='https://bible-strong.canny.io/fonctionnalites'>
          <StyledIcon name={'sun'} size={30} />
          <Text bold fontSize={15}>Idées de fonctionnalités</Text>
        </LinkItem>
        <LinkItem href='https://bible-strong.canny.io/bugs'>
          <StyledIcon name={'alert-circle'} size={30} />
          <Text bold fontSize={15}>Bugs</Text>
        </LinkItem>
        <LinkItem href={Platform.OS === 'ios' ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8' : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'}>
          <StyledIcon name={'star'} size={30} />
          <Text bold fontSize={15}>Noter l'application</Text>
        </LinkItem>
        <LinkItem share={shareMessage()}>
          <StyledIcon name={'share-2'} size={30} />
          <Text bold fontSize={15}>Partager l'application</Text>
        </LinkItem>
        <LinkItem href='mailto:s.montlouis.calixte@gmail.com'>
          <StyledIcon name={'send'} size={30} />
          <Text bold fontSize={15} >Contacter le développeur</Text>
        </LinkItem>
        <LinkItem href='https://fr.tipeee.com/smontlouis'>
          <StyledIcon name={'thumbs-up'} size={30} color={theme.colors.primary} />
          <Text bold fontSize={15} color='primary'>Soutenir le développeur</Text>
        </LinkItem>
      </ScrollView>
    </Container>
  )
)

export default withTheme(ProfileScreen)
