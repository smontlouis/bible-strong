import React from 'react'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import { ScrollView } from 'react-native'
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

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.grey,
  marginRight: 15
}))

const ProfileScreen = () => (
  (
    <Container>
      <Header hasBackButton noBorder title='Plus' />
      <ScrollView>
        <LinkItem route={'Highlights'}>
          <StyledIcon name={'edit-3'} size={30} />
          <Text bold fontSize={15}>SURBRILLANCES</Text>
        </LinkItem>
        <LinkItem route={'BibleVerseNotes'}>
          <StyledIcon name={'file-text'} size={30} />
          <Text bold fontSize={15}>NOTES</Text>
        </LinkItem>
      </ScrollView>
    </Container>
  )
)

export default ProfileScreen
