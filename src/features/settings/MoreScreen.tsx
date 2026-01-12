import { Theme } from '@emotion/react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { getRemoteConfig, getValue } from '@react-native-firebase/remote-config'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native'
import * as Animatable from 'react-native-animatable'
import { useSelector } from 'react-redux'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Header from '~common/Header'
import LexiqueIcon from '~common/LexiqueIcon'
import Link, { LinkBox, LinkProps } from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import Box, { HStack, SafeAreaBox, VStack } from '~common/ui/Box'
import CardLinkItem from '~common/ui/CardLinkItem'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import IconCircle from '~common/ui/IconCircle'
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

export const LinkItem = styled(Link)<LinkProps<keyof MainStackProps>>(() => ({
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

const Chip = styled(Link)(({ theme }: { theme: Theme }) => ({
  borderRadius: 10,
  backgroundColor: theme.colors.lightGrey,
  paddingVertical: 10,
  paddingHorizontal: 10,
  shadowColor: 'rgb(89,131,240)',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 7,
  elevation: 1,
  overflow: 'visible',
  flex: 1,
}))

const ChipIcon = styled(Icon.Feather)(({ theme, color }: any) => ({
  // @ts-ignore
  color: theme.colors[color] || theme.colors.grey,
  marginRight: 5,
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

  const lang = useLanguage()
  const hasUpdate = useSelector((state: RootState) =>
    Object.values(state.user.needsUpdate).some(v => v)
  )
  const isLoading = useSelector((state: RootState) => state.user.isLoading)

  const highlights = useSelector(
    (state: RootState) => Object.keys(state.user.bible.highlights).length
  )
  const notes = useSelector((state: RootState) => Object.keys(state.user.bible.notes).length)
  const studies = useSelector((state: RootState) => Object.keys(state.user.bible.studies).length)
  const tags = useSelector((state: RootState) => Object.keys(state.user.bible.tags).length)
  const bookmarks = useSelector(
    (state: RootState) => Object.keys(state.user.bible.bookmarks || {}).length
  )
  const links = useSelector((state: RootState) => Object.keys(state.user.bible.links || {}).length)

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
        backgroundColor="lightGrey"
        contentContainerStyle={{
          paddingBottom: 20,
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
              <LinkBox route="Profile">
                <Box px={16} py={12} row alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center" gap={12}>
                    <ProfileContainer>
                      <UserAvatar
                        size={50}
                        photoURL={user.photoURL}
                        displayName={user.displayName}
                        email={user.email}
                      />
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
                    <Text title fontSize={18}>
                      {extractFirstName(user.displayName)}
                    </Text>
                  </HStack>
                  <Box bg="primary" borderRadius={20} px={10} py={5} row center>
                    <Text fontSize={12} color="reverse">
                      {t('profile.title')}
                    </Text>
                    <FeatherIcon name="arrow-right" size={14} color="reverse" />
                  </Box>
                </Box>
              </LinkBox>

              {/* Mon contenu - chips */}
              <Box px={12} py={12}>
                <VStack gap={10}>
                  <HStack gap={10}>
                    <Chip route="Highlights">
                      <Box row>
                        <ChipIcon name="edit-3" size={20} />
                        <Text bold fontSize={20}>
                          {highlights}
                        </Text>
                      </Box>
                      <Text fontSize={11} numberOfLines={1}>
                        {t('surbrillance', { count: highlights })}
                      </Text>
                    </Chip>
                    <Chip route="Bookmarks">
                      <Box row>
                        <ChipIcon name="bookmark" size={20} />
                        <Text bold fontSize={20}>
                          {bookmarks}
                        </Text>
                      </Box>
                      <Text fontSize={11} numberOfLines={1}>
                        {t('marque-page', { count: bookmarks })}
                      </Text>
                    </Chip>
                    <Chip route="BibleVerseNotes">
                      <Box row>
                        <ChipIcon name="file-text" size={20} />
                        <Text bold fontSize={20}>
                          {notes}
                        </Text>
                      </Box>
                      <Text fontSize={11} numberOfLines={1}>
                        {t('note', { count: notes })}
                      </Text>
                    </Chip>
                  </HStack>
                  <HStack gap={10}>
                    <Chip route="Studies">
                      <Box row>
                        <ChipIcon name="feather" size={20} />
                        <Text bold fontSize={20}>
                          {studies}
                        </Text>
                      </Box>
                      <Text fontSize={11} numberOfLines={1}>
                        {t('étude', { count: studies })}
                      </Text>
                    </Chip>
                    <Chip route="BibleVerseLinks">
                      <Box row>
                        <ChipIcon name="link" size={20} />
                        <Text bold fontSize={20}>
                          {links}
                        </Text>
                      </Box>
                      <Text fontSize={11} numberOfLines={1}>
                        {t('lien', { count: links })}
                      </Text>
                    </Chip>
                    <Chip route="Tags">
                      <Box row>
                        <ChipIcon name="tag" size={20} />
                        <Text bold fontSize={20}>
                          {tags}
                        </Text>
                      </Box>
                      <Text fontSize={11} numberOfLines={1}>
                        {t('étiquette', { count: tags })}
                      </Text>
                    </Chip>
                  </HStack>
                </VStack>
              </Box>

              {/* Logout */}
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
              <Text color="primary" bold fontSize={15}>
                {t('Se connecter')}
              </Text>
            </CardLinkItem>
          )}
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="book" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('settings.resources')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem route="Lexique">
            <IconCircle bg="rgba(59, 130, 246, 0.1)">
              <LexiqueIcon size={20} color="primary" />
            </IconCircle>
            <Text color="primary" bold fontSize={15}>
              {t('Lexique')}
            </Text>
          </CardLinkItem>
          <CardLinkItem route="Dictionnaire">
            <IconCircle bg="rgba(251, 191, 36, 0.1)">
              <DictionnaryIcon size={20} color="secondary" />
            </IconCircle>
            <Text color="secondary" bold fontSize={15}>
              {t('Dictionnaire')}
            </Text>
          </CardLinkItem>
          <CardLinkItem route="Nave">
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <NaveIcon size={20} color="quint" />
            </IconCircle>
            <Text color="quint" bold fontSize={15}>
              {t('Bible Thématique Nave')}
            </Text>
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
                {hasUpdate && (
                  <AnimatedCircle animation="pulse" easing="ease-out" iterationCount="infinite" />
                )}
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
