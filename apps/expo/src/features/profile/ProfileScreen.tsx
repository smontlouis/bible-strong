import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import Container from '~common/ui/Container'
import Header from '~common/Header'
import ScrollView from '~common/ui/ScrollView'
import Box, { usePageBottomInset } from '~common/ui/Box'
import useLogin from '~helpers/useLogin'
import ProfileHeader from './components/ProfileHeader'
import ProfileStats from './components/ProfileStats'
import ProfileActions from './components/ProfileActions'
const ProfileScreen = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { isLogged } = useLogin()
  const bottomInset = usePageBottomInset()

  useEffect(() => {
    if (!isLogged) {
      router.replace('/login')
    }
  }, [isLogged, router])

  if (!isLogged) {
    return null
  }

  return (
    <Container className="bg-canvas">
      <Header hasBackButton title={t('profile.title')} />
      <ScrollView
        backgroundColor="canvas"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 + bottomInset }}
      >
        <Box className="web:w-full web:max-w-[500px] web:self-center">
          <Box className="px-[24px] mb-[28px]">
            <ProfileHeader />
          </Box>
          <ProfileStats />
          <ProfileActions />
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ProfileScreen
