import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'
import Box from '~common/ui/Box'
import useLogin from '~helpers/useLogin'

import ProfileHeader from './components/ProfileHeader'
import ProfileStats from './components/ProfileStats'
import ProfileActions from './components/ProfileActions'

const ProfileScreen = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { isLogged } = useLogin()

  useEffect(() => {
    if (!isLogged) {
      router.replace('/login')
    }
  }, [isLogged, router])

  if (!isLogged) {
    return null
  }

  return (
    <Container>
      <Header hasBackButton title={t('profile.title')} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Box padding={20}>
          <ProfileHeader />
        </Box>
        <ProfileStats />
        <Box pt={20}>
          <ProfileActions />
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ProfileScreen
