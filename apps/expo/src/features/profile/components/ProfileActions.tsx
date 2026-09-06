import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform } from 'react-native'
import { type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import CardLinkItem from '~common/ui/CardLinkItem'
import { FeatherIcon } from '~common/ui/Icon'
import IconCircle from '~common/ui/IconCircle'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import useLogin from '~helpers/useLogin'
import ChangePasswordModal from './ChangePasswordModal'
import DeleteAccountModal from './DeleteAccountModal'
const ProfileActions = () => {
  const { t } = useTranslation()
  const { user, logout } = useLogin()
  const passwordModalRef = useRef<SheetRef>(null)
  const deleteAccountModalRef = useRef<SheetRef>(null)

  const isEmailProvider = user.provider === 'password'

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Voulez-vous vraiment vous déconnecter ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      { text: t('Oui'), onPress: () => logout(), style: 'destructive' },
    ])
  }

  return (
    <Box className="overflow-hidden border-continuous">
      <SectionCard>
        <SectionCardHeader>
          <FeatherIcon name="settings" size={16} color="grey" />
          <Text
            className="ml-[8px] text-[12px] text-grey font-bold"
            style={{ textTransform: 'uppercase' }}
          >
            {t('profile.accountSettings')}
          </Text>
        </SectionCardHeader>

        {isEmailProvider && (
          <CardLinkItem onPress={() => passwordModalRef.current?.present()}>
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="lock" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('profile.changePassword')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        )}

        {Platform.OS !== 'web' && (
          <CardLinkItem route="Backup">
            <IconCircle bg="rgba(107, 114, 128, 0.1)">
              <FeatherIcon name="database" size={20} color="grey" />
            </IconCircle>
            <Text className="flex-[1] text-[15px]">{t('backup.title')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </CardLinkItem>
        )}

        <CardLinkItem onPress={promptLogout}>
          <IconCircle bg="rgba(239, 68, 68, 0.1)">
            <FeatherIcon name="log-out" size={20} color="quart" />
          </IconCircle>
          <Text className="flex-[1] text-[15px] text-quart">{t('Se déconnecter')}</Text>
        </CardLinkItem>

        <CardLinkItem onPress={() => deleteAccountModalRef.current?.present()} isLast>
          <IconCircle bg="rgba(239, 68, 68, 0.1)">
            <FeatherIcon name="trash-2" size={20} color="quart" />
          </IconCircle>
          <Text className="flex-[1] text-[15px] text-quart">{t('app.deleteAccount')}</Text>
        </CardLinkItem>
      </SectionCard>

      <ChangePasswordModal modalRef={passwordModalRef} />
      <DeleteAccountModal modalRef={deleteAccountModalRef} />
    </Box>
  )
}

export default ProfileActions
