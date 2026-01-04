import styled from '@emotion/native'
import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { getAuth } from '@react-native-firebase/auth'
import { StackNavigationProp } from '@react-navigation/stack'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import Link from '~common/Link'
import Box, { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'
import useLogin from '~helpers/useLogin'
import { firebaseDb, doc, deleteDoc } from '~helpers/firebase'
import { MainStackProps } from '~navigation/type'
import ChangePasswordModal from './ChangePasswordModal'

type ProfileActionsProps = {
  navigation: StackNavigationProp<MainStackProps>
}

const ProfileActions = ({ navigation }: ProfileActionsProps) => {
  const { t } = useTranslation()
  const { user, logout } = useLogin()
  const passwordModalRef = useRef<BottomSheetModal>(null)

  const isEmailProvider = user.provider === 'password'

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment vous déconnecter ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      { text: t('Oui'), onPress: () => logout(), style: 'destructive' },
    ])
  }

  const promptDelete = () => {
    Alert.alert(t('Attention'), t('app.deleteAccountBody'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: async () => {
          Alert.alert(t('Attention'), t('app.deleteAccountBodyConfirm'), [
            { text: t('Non'), onPress: () => null, style: 'cancel' },
            {
              text: t('Delete'),
              onPress: async () => {
                await deleteDoc(doc(firebaseDb, 'users', user.id))
                const authUser = getAuth().currentUser
                await authUser?.delete()
                logout()
              },
              style: 'destructive',
            },
          ])
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <VStack gap={5}>
      <Text bold fontSize={16} marginBottom={10}>
        {t('profile.accountSettings')}
      </Text>

      {isEmailProvider && (
        <ActionItem onPress={() => passwordModalRef.current?.present()}>
          <StyledIcon name="lock" size={22} />
          <Text fontSize={15}>{t('profile.changePassword')}</Text>
        </ActionItem>
      )}

      <ActionItem route="Backup">
        <StyledIcon name="database" size={22} />
        <Text fontSize={15}>{t('backup.title')}</Text>
      </ActionItem>

      <Border marginVertical={10} />

      <ActionItem onPress={promptLogout}>
        <StyledIcon name="log-out" size={22} color="quart" />
        <Text fontSize={15} color="quart" bold>
          {t('Se déconnecter')}
        </Text>
      </ActionItem>

      <ActionItem onPress={promptDelete}>
        <StyledIcon name="trash-2" size={22} color="quart" />
        <Text fontSize={15} color="quart">
          {t('app.deleteAccount')}
        </Text>
      </ActionItem>

      <ChangePasswordModal modalRef={passwordModalRef} />
    </VStack>
  )
}

const ActionItem = styled(Link)(({}: { theme?: any }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  paddingHorizontal: 5,
}))

const StyledIcon = styled(Icon.Feather)<{ color?: string }>(
  ({ theme, color }: { theme: any; color?: string }) => ({
    color: color ? (theme.colors as any)[color] : theme.colors.grey,
    marginRight: 15,
  })
)

export default ProfileActions
