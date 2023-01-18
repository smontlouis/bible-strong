import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import sizeof from 'firestore-size'
import React, { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import * as Animatable from 'react-native-animatable'
import RNRestart from 'react-native-restart'
import { useDispatch, useSelector } from 'react-redux'
import DictionnaireIcon from '~common/DictionnaryIcon'
import Header from '~common/Header'
import LexiqueIcon from '~common/LexiqueIcon'
import Link from '~common/Link'
import NaveIcon from '~common/NaveIcon'
import SnackBar from '~common/SnackBar'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { deleteAllDatabases } from '~helpers/database'
import useLogin from '~helpers/useLogin'
import { resetCompareVersion } from '~redux/modules/user'

import { getBottomSpace } from 'react-native-iphone-x-helper'
import { shallowEqual } from 'recompose'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { firebaseDb } from '~helpers/firebase'
import { useIsPremium } from '~helpers/usePremium'
import { r } from '~redux/firestoreMiddleware'
import { RootState } from '~redux/modules/reducer'
import app from '../../../package.json'
import { useBibleTabActions, useGetDefaultBibleTabAtom } from '../../state/tabs'
import useLanguage from '~helpers/useLanguage'

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

type MoreScreenProps = {
  closeMenu: () => void
}

const MoreScreen = ({ closeMenu }: MoreScreenProps) => {
  const { isLogged, logout } = useLogin()
  const isPremium = useIsPremium()

  const dispatch = useDispatch()
  const isFR = useLanguage()
  const hasUpdate = useSelector((state: RootState) =>
    Object.values(state.user.needsUpdate).some(v => v)
  )
  const defaultBibleAtom = useGetDefaultBibleTabAtom()
  const [, actions] = useBibleTabActions(defaultBibleAtom)

  const [isSyncing, setIsSyncing] = useState(false)
  const { user, plan } = useSelector(
    (state: RootState) => ({
      user: state.user,
      plan: state.plan,
    }),
    shallowEqual
  )
  const userDoc = firebaseDb.collection('users').doc(user.id)

  const bibleJSON = useSelector((state: RootState) => state.user.bible)
  const { t, i18n } = useTranslation()

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment vous déconnecter ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      { text: t('Oui'), onPress: () => logout(), style: 'destructive' },
    ])
  }

  const sync = async () => {
    SnackBar.show(t('app.syncing'))
    setIsSyncing(true)
    const sanitizeUserBible = ({ changelog, studies, ...rest }) => rest
    await userDoc.update(
      r({
        bible: sanitizeUserBible(user.bible),
        plan: plan.ongoingPlans,
      })
    )
    console.log('User synced')

    const studies = user.bible.studies
    if (studies) {
      await Promise.all(
        Object.entries(studies).map(async ([studyId, study]) => {
          const studyDoc = firebaseDb.collection('studies').doc(studyId)
          await studyDoc.set(study, { merge: true })
        })
      )
      console.log('Studies synced')
    }
    SnackBar.show(t('app.synced'))
    setIsSyncing(false)
  }

  const confirmChangeLanguage = () => {
    Alert.alert(
      t('Attention'),
      t(
        'Vous êtes sur le point de changer de langue, les bases de données françaises seront supprimées.'
      ),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: async () => {
            const isFR = i18n.language === 'fr'
            await deleteAllDatabases()
            actions.setSelectedVersion(!isFR ? 'LSG' : 'KJV')
            dispatch(resetCompareVersion(!isFR ? 'LSG' : 'KJV'))

            i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr')

            setTimeout(() => {
              RNRestart.Restart()
            }, 1000)
          },
          style: 'destructive',
        },
      ]
    )
  }

  return (
    <Container borderLeftWidth={1} borderColor="border" pure>
      <Header title={t('Plus')} onCustomBackPress={closeMenu} hasBackButton />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: getBottomSpace() + TAB_ICON_SIZE + 20,
        }}
      >
        <Box paddingVertical={10}>
          <LinkItem route="Lexique">
            <LexiqueIcon style={{ marginRight: 15 }} size={25} />
            <Text color="primary" bold fontSize={15}>
              {t('Lexique')}
            </Text>
          </LinkItem>
          <LinkItem route="Dictionnaire">
            <DictionnaireIcon style={{ marginRight: 15 }} size={25} />
            <Text color="secondary" bold fontSize={15}>
              {t('Dictionnaire')}
            </Text>
          </LinkItem>
          <LinkItem route="Nave">
            <NaveIcon style={{ marginRight: 15 }} size={25} />
            <Text color="quint" bold fontSize={15}>
              {t('Bible Thématique Nave')}
            </Text>
          </LinkItem>
          <LinkItem route="Studies">
            <FeatherIcon name="feather" style={{ marginRight: 15 }} size={25} />
            <Text bold fontSize={15}>
              {t('Études')}
            </Text>
          </LinkItem>
          <LinkItem route="Plans">
            <MaterialIcon
              name="playlist-add-check"
              size={25}
              style={{ marginRight: 15 }}
            />
            <Text bold fontSize={15}>
              {t('Plans')}
            </Text>
          </LinkItem>
          <LinkItem route="Highlights">
            <StyledIcon name="edit-3" size={25} />
            <Text bold fontSize={15}>
              {t('Surbrillances')}
            </Text>
          </LinkItem>
          <LinkItem route="BibleVerseNotes">
            <StyledIcon name="file-text" size={25} />
            <Text bold fontSize={15}>
              {t('Notes')}
            </Text>
          </LinkItem>
          <LinkItem route="Tags">
            <StyledIcon name="tag" size={25} />
            <Text bold fontSize={15}>
              {t('Étiquettes')}
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
            <Text fontSize={15}>{t('Gestion des téléchargements')}</Text>
          </LinkItem>
          <LinkItem route="Changelog">
            <StyledIcon name="terminal" size={25} />
            <Text fontSize={15}>{t('Changelog')}</Text>
          </LinkItem>
          <LinkItem route="FAQ">
            <StyledIcon name="help-circle" size={25} />
            <Text fontSize={15}>{t('Foire aux questions')}</Text>
          </LinkItem>
          {isPremium && (
            <>
              <LinkItem href="https://bible-strong.canny.io/feature-requests">
                <StyledIcon name="sun" size={25} />
                <Text fontSize={15}>{t('app.featureIdeas')}</Text>
              </LinkItem>
              <LinkItem href="https://bible-strong.canny.io/bugs">
                <StyledIcon name="alert-circle" size={25} />
                <Text fontSize={15}>{t('app.bugs')}</Text>
              </LinkItem>
            </>
          )}
          <LinkItem href="https://www.facebook.com/fr.bible.strong">
            <StyledIcon name="facebook" size={25} />
            <Text fontSize={15}>{t('Nous suivre sur facebook')}</Text>
          </LinkItem>
          <LinkItem
            href={
              Platform.OS === 'ios'
                ? 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
                : 'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong'
            }
          >
            <StyledIcon name="star" size={25} />
            <Text fontSize={15}>{t("Noter l'application")}</Text>
          </LinkItem>
          <LinkItem share={shareMessage()}>
            <StyledIcon name="share-2" size={25} />
            <Text fontSize={15}>{t("Partager l'application")}</Text>
          </LinkItem>
          {isPremium && (
            <LinkItem href="mailto:s.montlouis.calixte+bible-strong@gmail.com">
              <StyledIcon name="send" size={25} />
              <Text fontSize={15}>{t('Contacter le développeur')}</Text>
            </LinkItem>
          )}
          <LinkItem onPress={confirmChangeLanguage}>
            <MaterialIcon
              name="language"
              size={25}
              style={{ marginRight: 15 }}
            />
            <Text fontSize={15}>
              {t('Changer la langue')} -{' '}
              <Text bold fontSize={15} color="primary">
                {i18n.language.toUpperCase()}
              </Text>
            </Text>
          </LinkItem>
          {/* <LinkItem
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
          </LinkItem> */}
          {isLogged && (
            <LinkItem onPress={isSyncing ? () => {} : sync}>
              <StyledIcon name="upload-cloud" size={25} />
              <Text fontSize={15} opacity={isSyncing ? 0.4 : 1}>
                {t('app.sync')}
              </Text>
            </LinkItem>
          )}
          {!isLogged && (
            <LinkItem route="Login">
              <StyledIcon color="primary" name="log-in" size={25} />
              <Text color="primary" fontSize={15} bold>
                {t('Se connecter')}
              </Text>
            </LinkItem>
          )}
          {isLogged && (
            <LinkItem onPress={promptLogout}>
              <StyledIcon color="quart" name="log-out" size={25} />
              <Text bold color="quart" fontSize={15}>
                {t('Se déconnecter')}
              </Text>
            </LinkItem>
          )}
        </Box>
        <Border marginHorizontal={20} />
        <Box paddingVertical={10}>
          <LinkItem
            style={{ paddingVertical: 10 }}
            href={
              isFR
                ? 'https://bible-strong.app/politique-de-confidentialite'
                : 'https://bible-strong.app/privacy-policy'
            }
          >
            <Text fontSize={15} color="grey">
              {t('Politique de confidentialité')}
            </Text>
          </LinkItem>
          <LinkItem
            style={{ paddingVertical: 10 }}
            href={
              isFR
                ? 'https://bible-strong.app/eula'
                : 'https://bible-strong.app/eula-en'
            }
          >
            <Text fontSize={15} color="grey">
              {t("Conditions d'utilisation")}
            </Text>
          </LinkItem>
        </Box>
        <Box row justifyContent="flex-end" px={10}>
          <Text color="grey" fontSize={9} marginRight={10}>
            {Math.trunc(sizeof(bibleJSON) / 1000)}kb/1Mb
          </Text>
          <Text color="grey" fontSize={9}>
            Version: {app.version}
          </Text>
        </Box>
      </ScrollView>
    </Container>
  )
}
export default memo(MoreScreen)
