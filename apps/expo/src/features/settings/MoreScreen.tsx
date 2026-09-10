import { goBackOrHome } from '~navigation/goBackOrHome'
import { resolveUniverseColors } from '~themes/universeColors'
import { useResponsiveWorkspace } from '~features/app-switcher/utils/useResponsiveWorkspace'
import { getRemoteConfig, getValue } from '@react-native-firebase/remote-config'
import { Image } from 'expo-image'
import * as Updates from 'expo-updates'
import { useSetAtom } from 'jotai/react'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { memo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, Platform } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import DictionnaryIcon from '~common/DictionnaryIcon'
import Header from '~common/Header'
import LexiqueIcon from '~common/LexiqueIcon'
import Link, { LinkProps } from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import { type SheetRef } from '~common/sheet'
import Box, { SafeAreaBox } from '~common/ui/Box'
import CardLinkItem from '~common/ui/CardLinkItem'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import IconCircle from '~common/ui/IconCircle'
import ScrollView from '~common/ui/ScrollView'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import Text from '~common/ui/Text'
import UserAvatar from '~common/ui/UserAvatar'
import DeleteAccountModal from '~features/profile/components/DeleteAccountModal'
import extractFirstName from '~helpers/extractFirstName'
import { nukeApp } from '~helpers/nukeApp'
import { toast } from '~helpers/toast'
import useLanguage from '~helpers/useLanguage'
import useLogin from '~helpers/useLogin'
import { changelogModalAtom } from '~state/app'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import app from '../../../package.json'

import { useRouter } from 'expo-router'
import { MainStackProps } from '~navigation/type'

export const LinkItem = (
  componentProps: Omit<
    UIComponentProps<typeof Link>,
    keyof LinkProps<keyof MainStackProps> | 'theme'
  > &
    Omit<LinkProps<keyof MainStackProps>, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('flex-row items-center px-[20px] py-[15px]', className)
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const shareMessage = () => {
  const appUrl =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
      : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
  return `Bible Strong App ${appUrl}`
}

const Infos = memo(() => {
  return (
    <Box className="overflow-hidden border-continuous flex-row justify-end px-[16px] py-[8px]">
      <Text className="text-grey text-[9px]">
        Version: {app.version} {Platform.Version}
      </Text>
    </Box>
  )
})

type MoreProps = {
  closeMenu: () => void
  inWorkspace?: boolean
}

export const More = ({ closeMenu, inWorkspace = false }: MoreProps) => {
  const router = useRouter()
  const { isLogged, user, logout } = useLogin()
  const theme = useTheme()
  const deleteAccountModalRef = useRef<SheetRef>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const openChangelogModal = useSetAtom(changelogModalAtom)

  const lang = useLanguage()
  const { t } = useTranslation()

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment vous déconnecter ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      { text: t('Oui'), onPress: () => logout(), style: 'destructive' },
    ])
  }

  const checkForUpdate = async () => {
    if (isCheckingUpdate) return
    setIsCheckingUpdate(true)
    try {
      const result = await Updates.checkForUpdateAsync()
      if (result.isAvailable) {
        toast.info(t('app.updateAvailable'))
        await Updates.fetchUpdateAsync()
        toast.success(t('app.updateReady'))
      } else {
        toast.info(t('app.noUpdateAvailable'))
      }
    } catch (error) {
      console.log(error)
      toast.error(t('app.updateError'))
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const appleIsReviewing =
    Platform.OS === 'web' ? false : getValue(getRemoteConfig(), 'apple_reviewing').asBoolean()

  const promptNuke = () => {
    Alert.alert(
      '☢️ Nuke app',
      'Reset TOTAL : MMKV, Firebase auth, databases, fichiers… puis reload. Continuer ?',
      [
        { text: 'Annuler', onPress: () => null, style: 'cancel' },
        { text: 'Nuke', onPress: () => nukeApp(), style: 'destructive' },
      ]
    )
  }

  return (
    <SafeAreaBox className="border-continuous overflow-hidden border-l-[1px] border-border bg-light-grey">
      <Header
        title={t(inWorkspace ? 'settings.settings' : 'Plus')}
        onCustomBackPress={closeMenu}
        hasBackButton={!inWorkspace}
      />
      <ScrollView
        backgroundColor="lightGrey"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 20,
          backgroundColor: theme.colors.lightGrey,
        }}
      >
        <SectionCard className="mt-[8px]">
          <SectionCardHeader>
            <FeatherIcon name="user" size={16} color="grey" />
            <Text
              className="ml-[8px] text-[12px] text-grey font-bold"
              style={{ textTransform: 'uppercase' }}
            >
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
                <Text className="flex-[1] text-[15px]">{extractFirstName(user.displayName)}</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>

              <CardLinkItem onPress={promptLogout} isLast>
                <IconCircle bg="rgba(239, 68, 68, 0.1)">
                  <FeatherIcon name="log-out" size={20} color="quart" />
                </IconCircle>
                <Text className="text-quart text-[15px]">{t('Se déconnecter')}</Text>
              </CardLinkItem>
            </>
          ) : (
            <CardLinkItem route="Login" isLast>
              <IconCircle bg="lightPrimary">
                <FeatherIcon name="log-in" size={20} color="primary" />
              </IconCircle>
              <Text className="text-primary text-[15px]">{t('Se connecter')}</Text>
            </CardLinkItem>
          )}
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="book" size={16} color="grey" />
            <Text className="ml-[8px] text-[12px] text-grey" style={{ textTransform: 'uppercase' }}>
              {t('settings.resources')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem route="History">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="clock" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('history.title')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Lexique">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'strong').background}>
              <LexiqueIcon size={20} />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'strong').foreground }}
            >
              {t('Lexique')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Dictionnaire">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'dictionary').background}>
              <DictionnaryIcon size={20} />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'dictionary').foreground }}
            >
              {t('Dictionnaire')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Nave">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'nave').background}>
              <NaveIcon size={20} />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'nave').foreground }}
            >
              {t('Bible Thématique Nave')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="CommentaryLibrary">
            <IconCircle bg={resolveUniverseColors(theme.colors, 'commentary').background}>
              <Image
                source={require('~assets/images/tab-icons/comment.svg')}
                style={{ width: 20, height: 20 }}
                tintColor={resolveUniverseColors(theme.colors, 'commentary').foreground}
                contentFit="contain"
              />
            </IconCircle>
            <Text
              className="flex-[1] text-[15px]"
              style={{ color: resolveUniverseColors(theme.colors, 'commentary').foreground }}
            >
              {t('Commentaires')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Plans" isLast>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <MaterialIcon name="playlist-add-check" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Plans')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="settings" size={16} color="grey" />
            <Text
              className="ml-[8px] text-[12px] text-grey font-bold"
              style={{ textTransform: 'uppercase' }}
            >
              {t('settings.settings')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem route="ResourceLanguage">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <MaterialIcon name="language" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Changer la langue')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="Theme">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="sun" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('settings.theme')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="BibleDefaults">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="book-open" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('bibleDefaults.title')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          {Platform.OS !== 'web' && (
            <>
              <CardLinkItem route="Downloads">
                <IconCircle bg="rgba(107, 114, 128, 0.1)">
                  <Box className="overflow-hidden border-continuous">
                    <FeatherIcon name="download" size={20} color="grey" />
                  </Box>
                </IconCircle>
                <Text className="flex-[1] text-[15px]">{t('Gestion des téléchargements')}</Text>
                <FeatherIcon name="chevron-right" size={20} color="grey" />
              </CardLinkItem>
              <CardLinkItem onPress={checkForUpdate} isLast>
                <IconCircle bg="rgba(107, 114, 128, 0.1)">
                  {isCheckingUpdate ? (
                    <ActivityIndicator size="small" color={theme.colors.grey} />
                  ) : (
                    <FeatherIcon name="refresh-cw" size={20} color="grey" />
                  )}
                </IconCircle>
                <Text className="flex-[1] text-[15px]">{t('app.checkForUpdates')}</Text>
              </CardLinkItem>
            </>
          )}
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="help-circle" size={16} color="grey" />
            <Text
              className="ml-[8px] text-[12px] text-grey font-bold"
              style={{ textTransform: 'uppercase' }}
            >
              {t('settings.help')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem onPress={() => openChangelogModal(true)}>
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="terminal" size={20} color="quint" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Changelog')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem route="FAQ">
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="help-circle" size={20} color="quint" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Foire aux questions')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem href="mailto:stephane@lestudio316.com" isLast>
            <IconCircle bg="rgba(147, 51, 234, 0.1)">
              <FeatherIcon name="send" size={20} color="quint" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Contacter le développeur')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="globe" size={16} color="grey" />
            <Text
              className="ml-[8px] text-[12px] text-grey font-bold"
              style={{ textTransform: 'uppercase' }}
            >
              {t('settings.community')}
            </Text>
          </SectionCardHeader>
          <CardLinkItem href="https://www.facebook.com/fr.bible.strong">
            <IconCircle bg="rgba(59, 89, 152, 0.1)">
              <FeatherIcon name="facebook" size={20} color="primary" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('Nous suivre sur facebook')}</Text>
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
            <Text className="flex-[1] text-[15px]">{t("Noter l'application")}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
          <CardLinkItem share={shareMessage()}>
            <IconCircle bg="rgba(16, 185, 129, 0.1)">
              <FeatherIcon name="share-2" size={20} color="success" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t("Partager l'application")}</Text>
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
              <Text className="flex-[1] text-[15px]">{t('Contribuer')}</Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </CardLinkItem>
          )}
          <CardLinkItem href="https://github.com/smontlouis/bible-strong" isLast>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="github" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">Github</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        </SectionCard>

        <Box className="overflow-hidden border-continuous px-[20px] py-[8px]">
          <LinkItem
            style={{ paddingVertical: 10, paddingHorizontal: 0 }}
            href={
              lang === 'fr'
                ? 'https://bible-strong.app/politique-de-confidentialite'
                : 'https://bible-strong.app/privacy-policy'
            }
          >
            <Text className="text-[14px] text-grey">{t('Politique de confidentialité')}</Text>
          </LinkItem>
          <LinkItem
            style={{ paddingVertical: 10, paddingHorizontal: 0 }}
            href={
              lang === 'fr' ? 'https://bible-strong.app/eula' : 'https://bible-strong.app/eula-en'
            }
          >
            <Text className="text-[14px] text-grey">{t("Conditions d'utilisation")}</Text>
          </LinkItem>
          {isLogged && (
            <LinkItem
              style={{ paddingVertical: 10, paddingHorizontal: 0 }}
              onPress={() => deleteAccountModalRef.current?.present()}
            >
              <Text className="text-[14px] text-grey">{t('app.deleteAccount')}</Text>
            </LinkItem>
          )}
        </Box>

        {__DEV__ && Platform.OS !== 'web' && (
          <SectionCard>
            <SectionCardHeader>
              <FeatherIcon name="alert-triangle" size={16} color="quart" />
              <Text
                className="ml-[8px] text-[12px] text-quart font-bold"
                style={{ textTransform: 'uppercase' }}
              >
                Dev
              </Text>
            </SectionCardHeader>
            <CardLinkItem
              onPress={() =>
                router.push({ pathname: '/playground', params: { playground: 'avatar' } })
              }
            >
              <IconCircle bg="rgba(89, 131, 240, 0.12)">
                <FeatherIcon name="smile" size={20} color="primary" />
              </IconCircle>
              <Text className="flex-[1] text-primary text-[15px]">Playground · Avatar</Text>
              <FeatherIcon name="chevron-right" size={20} color="grey" />
            </CardLinkItem>
            <CardLinkItem onPress={promptNuke} isLast>
              <IconCircle bg="rgba(239, 68, 68, 0.1)">
                <FeatherIcon name="trash-2" size={20} color="quart" />
              </IconCircle>
              <Text className="text-quart text-[15px]">Nuke app (reset total)</Text>
            </CardLinkItem>
          </SectionCard>
        )}

        <Infos />
      </ScrollView>
      {isLogged && <DeleteAccountModal modalRef={deleteAccountModalRef} />}
    </SafeAreaBox>
  )
}

const MoreScreen = () => {
  const router = useRouter()
  const closeMenu = () => goBackOrHome(router)

  const isWide = useResponsiveWorkspace()
  return <More closeMenu={closeMenu} inWorkspace={isWide} />
}

export default memo(MoreScreen)
