import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { getAuth } from '@react-native-firebase/auth'
import { StackNavigationProp } from '@react-navigation/stack'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import CardLinkItem from '~common/ui/CardLinkItem'
import { FeatherIcon } from '~common/ui/Icon'
import IconCircle from '~common/ui/IconCircle'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import useLogin from '~helpers/useLogin'
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
    <Box>
      <SectionCard>
        <SectionCardHeader>
          <FeatherIcon name="settings" size={16} color="grey" />
          <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
            {t('profile.accountSettings')}
          </Text>
        </SectionCardHeader>

        {isEmailProvider && (
          <CardLinkItem onPress={() => passwordModalRef.current?.present()}>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="lock" size={20} color="grey" />
            </IconCircle>
            <Text flex fontSize={15}>
              {t('profile.changePassword')}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        )}

        <CardLinkItem route="Backup">
          <IconCircle bg="rgba(107, 114, 128, 0.1)">
            <FeatherIcon name="database" size={20} color="grey" />
          </IconCircle>
          <Text flex fontSize={15}>
            {t('backup.title')}
          </Text>
          <FeatherIcon name="chevron-right" size={20} color="grey" />
        </CardLinkItem>

        <CardLinkItem onPress={promptLogout}>
          <IconCircle bg="rgba(239, 68, 68, 0.1)">
            <FeatherIcon name="log-out" size={20} color="quart" />
          </IconCircle>
          <Text flex fontSize={15} color="quart">
            {t('Se déconnecter')}
          </Text>
        </CardLinkItem>

        <CardLinkItem onPress={promptDelete} isLast>
          <IconCircle bg="rgba(239, 68, 68, 0.1)">
            <FeatherIcon name="trash-2" size={20} color="quart" />
          </IconCircle>
          <Text flex fontSize={15} color="quart">
            {t('app.deleteAccount')}
          </Text>
        </CardLinkItem>
      </SectionCard>

      <ChangePasswordModal modalRef={passwordModalRef} />
    </Box>
  )
}

export default ProfileActions
