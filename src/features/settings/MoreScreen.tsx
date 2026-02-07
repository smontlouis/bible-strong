import styled from '@emotion/native'
import { getRemoteConfig, getValue } from '@react-native-firebase/remote-config'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import { useSelector } from 'react-redux'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Header from '~common/Header'
import LexiqueIcon from '~common/LexiqueIcon'
import Link, { LinkProps } from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import Box, { SafeAreaBox } from '~common/ui/Box'
import CardLinkItem from '~common/ui/CardLinkItem'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import IconCircle from '~common/ui/IconCircle'
import PulsingDot from '~common/ui/PulsingDot'
import ScrollView from '~common/ui/ScrollView'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import Text from '~common/ui/Text'
import UserAvatar from '~common/ui/UserAvatar'
import extractFirstName from '~helpers/extractFirstName'
import useLanguage from '~helpers/useLanguage'
import useLogin from '~helpers/useLogin'
import { RootState } from '~redux/modules/reducer'
import app from '../../../package.json'

import { useRouter } from 'expo-router'
import { useTheme } from '@emotion/react'

export const LinkItem = styled(Link)<LinkProps<keyof MainStackProps>>(() => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 15,
}))

const ProfileContainer = styled.View(({ theme }) => ({
  width: 50,
  height: 50,
  borderRadius: 25,
  shadowColor: theme.colors.primary,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 1,
  backgroundColor: 'white',
  position: 'relative',
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
}))

const shareMessage = () => {
  const appUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
      : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
  return `Bible Strong App ${appUrl}`
}

const Infos = memo(() => {
  return (
    <Box row justifyContent="flex-end" px={16} py={8}>
      <Text color="grey" fontSize={9}>
        Version: {app.version} {Platform.Version}
      </Text>
    </Box>
  )
})

type MoreProps = {
  closeMenu: () => void
}

export const More = ({ closeMenu }: MoreProps) => {
  const { isLogged, user, logout, promptDeleteAccount } = useLogin()
  const theme = useTheme()

  const lang = useLanguage()
  const hasUpdate = useSelector((state: RootState) =>
    Object.values(state.user.needsUpdate).some(v => v)
  )
  const isLoading = useSelector((state: RootState) => state.user.isLoading)

  const { t } = useTranslation()

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment vous déconnecter ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      { text: t('Oui'), onPress: () => logout(), style: 'destructive' },
    ])
  }

  const appleIsReviewing = getValue(getRemoteConfig(), 'apple_reviewing').asBoolean()

  return (
    <SafeAreaBox borderLeftWidth={1} borderColor="border" bg="lightGrey">
      <Header title={t('Plus')} onCustomBackPress={closeMenu} hasBackButton />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 20,
          backgroundColor: theme.colors.lightGrey,
        }}
      >
        <SectionCard mt={8}>
          <SectionCardHeader>
            <FeatherIcon name="user" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('settings.account')}
            </Text>
          </SectionCardHeader>
          {isLogged ? (
            <>
              {/* Profile header avec avatar */}
              <CardLinkItem route="Profile">
                <UserAvatar
                  size={36}
                  photoURL={user.photoURL}
                  displayName={user.displayName}
                  email={user.email}
                />
                <Text flex fontSize={15}>
                  {extractFirstName(user.displayName)}
                </Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>

              <CardLinkItem onPress={promptLogout} isLast>
                <IconCircle bg="rgba(239, 68, 68, 0.1)">
                  <FeatherIcon name="log-out" size={20} color="quart" />
                </IconCircle>
                <Text color="quart" fontSize={15}>
                  {t('Se déconnecter')}
                </Text>
              </CardLinkItem>
            </>
          ) : (
            <CardLinkItem route="Login" isLast>
              <IconCircle bg="lightPrimary">
                <FeatherIcon name="log-in" size={20} color="primary" />
              </IconCircle>
              <Text color="primary" fontSize={15}>
                {t('Se connecter')}
              </Text>
            </CardLinkItem>
          )}
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="book" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" style={{ textTransform: 'uppercase' }}>
              {t('settings.resources')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem route="Lexique">
            <IconCircle bg="rgba(59, 130, 246, 0.1)">
              <LexiqueIcon size={20} color="primary" />
            </IconCircle>
            <Text flex color="primary" fontSize={15}>
              {t('Lexique')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Dictionnaire">
            <IconCircle bg="rgba(251, 191, 36, 0.1)">
              <DictionnaryIcon size={20} color="secondary" />
            </IconCircle>
            <Text flex color="secondary" fontSize={15}>
              {t('Dictionnaire')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Nave">
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <NaveIcon size={20} color="quint" />
            </IconCircle>
            <Text flex color="quint" fontSize={15}>
              {t('Bible Thématique Nave')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Plans" isLast>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <MaterialIcon name="playlist-add-check" size={20} color="grey" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Plans')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="settings" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('settings.settings')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem route="ResourceLanguage">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <MaterialIcon name="language" size={20} color="grey" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Changer la langue')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Theme">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="sun" size={20} color="grey" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('settings.theme')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="BibleDefaults">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="book-open" size={20} color="grey" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('bibleDefaults.title')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Downloads" isLast>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <Box>
                {hasUpdate && <PulsingDot style={{ position: 'absolute', top: 0, right: 8 }} />}
                <FeatherIcon name="download" size={20} color="grey" />
              </Box>
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Gestion des téléchargements')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="help-circle" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('settings.help')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem route="Changelog">
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="terminal" size={20} color="quint" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Changelog')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="FAQ">
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="help-circle" size={20} color="quint" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Foire aux questions')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem href="mailto:stephane@lestudio316.com" isLast>
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="send" size={20} color="quint" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Contacter le développeur')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="globe" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('settings.community')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem href="https://www.facebook.com/fr.bible.strong">
            <IconCircle bg="rgba(59, 89, 152, 0.1)">
              <FeatherIcon name="facebook" size={20} color="primary" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('Nous suivre sur facebook')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem
            href={
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
                : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
            }
          >
            <IconCircle bg="rgba(251, 191, 36, 0.1)">
              <FeatherIcon name="star" size={20} color="secondary" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t("Noter l'application")}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem share={shareMessage()}>
            <IconCircle bg="rgba(16, 185, 129, 0.1)">
              <FeatherIcon name="share-2" size={20} color="success" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t("Partager l'application")}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          {!appleIsReviewing && (
            <CardLinkItem
              href={
                lang === 'fr' ? 'https://bible-strong.app/fr/give' : 'https://bible-strong.app/give'
              }
            >
              <IconCircle bg="rgba(236, 72, 153, 0.1)">
                <FeatherIcon name="heart" size={20} color="color2" />
              </IconCircle>
              <Text flex fontSize={15}>
                {t('Contribuer')}
              </Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </CardLinkItem>
          )}
          <CardLinkItem href="https://github.com/smontlouis/bible-strong" isLast>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="github" size={20} color="grey" />
            </IconCircle>
            <Text flex fontSize={15}>
              Github
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <Box px={20} py={8}>
          <LinkItem
            style={{ paddingVertical: 10, paddingHorizontal: 0 }}
            href={
              lang === 'fr'
                ? 'https://bible-strong.app/politique-de-confidentialite'
                : 'https://bible-strong.app/privacy-policy'
            }
          >
            <Text fontSize={14} color="grey">
              {t('Politique de confidentialité')}
            </Text>
          </LinkItem>
          <LinkItem
            style={{ paddingVertical: 10, paddingHorizontal: 0 }}
            href={
              lang === 'fr' ? 'https://bible-strong.app/eula' : 'https://bible-strong.app/eula-en'
            }
          >
            <Text fontSize={14} color="grey">
              {t("Conditions d'utilisation")}
            </Text>
          </LinkItem>
          {isLogged && (
            <LinkItem
              style={{ paddingVertical: 10, paddingHorizontal: 0 }}
              onPress={promptDeleteAccount}
            >
              <Text fontSize={14} color="grey">
                {t('app.deleteAccount')}
              </Text>
            </LinkItem>
          )}
        </Box>

        <Infos />
      </ScrollView>
    </SafeAreaBox>
  )
}

const MoreScreen = () => {
  const router = useRouter()
  const closeMenu = () => router.back()

  return <More closeMenu={closeMenu} />
}

export default memo(MoreScreen)
