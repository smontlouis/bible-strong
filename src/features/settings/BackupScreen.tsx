import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Link, { LinkProps } from '~common/Link'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { MainStackProps } from '~navigation/type'

const LinkItem = styled(Link)<LinkProps<keyof MainStackProps>>(({}) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 15,
}))

const StyledIcon = styled(Icon.Feather)(({ theme }: any) => ({
  color: theme.colors.grey,
  marginRight: 15,
}))

const BackupScreen = () => {
  const { t } = useTranslation()

  return (
    <Container>
      <Header hasBackButton title={t('backup.title')} />
      <ScrollView style={{ flex: 1 }}>
        <LinkItem route="ImportExport">
          <StyledIcon name="upload" size={25} />
          <Text fontSize={15}>{t('app.importexport')}</Text>
        </LinkItem>
        <LinkItem route="AutomaticBackups">
          <StyledIcon name="save" size={25} />
          <Text fontSize={15}>{t('backups.title')}</Text>
        </LinkItem>
      </ScrollView>
    </Container>
  )
}

export default BackupScreen
