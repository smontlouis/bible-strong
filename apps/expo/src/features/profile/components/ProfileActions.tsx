import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import ListSection, { ListRow } from '~common/ui/ListSection'
import useLogin from '~helpers/useLogin'
import ChangePasswordModal from './ChangePasswordModal'
import DeleteAccountModal from './DeleteAccountModal'
const ProfileActions = () => {
  const { t } = useTranslation()
  const { user, logout } = useLogin()
  const confirm = useConfirmDialog()
  const passwordModalRef = useRef<SheetRef>(null)
  const deleteAccountModalRef = useRef<SheetRef>(null)

  const isEmailProvider = user.provider === 'password'

  const promptLogout = async () => {
    const confirmed = await confirm({
      title: t('Attention'),
      message: t('Voulez-vous vraiment vous déconnecter ?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Se déconnecter'),
      destructive: true,
    })
    if (confirmed) await logout()
  }

  return (
    <Box>
      {(isEmailProvider || Platform.OS !== 'web') && (
        <ListSection title={t('profile.accountSettings')}>
          {isEmailProvider && (
            <ListRow
              onPress={() => passwordModalRef.current?.present()}
              icon={<FeatherIcon name="lock" size={18} color="grey" />}
              label={t('profile.changePassword')}
            />
          )}
          {Platform.OS !== 'web' && (
            <ListRow
              route="Backup"
              icon={<FeatherIcon name="database" size={18} color="grey" />}
              label={t('backup.title')}
            />
          )}
        </ListSection>
      )}

      <ListSection>
        <ListRow
          onPress={() => void promptLogout()}
          icon={<FeatherIcon name="log-out" size={18} color="quart" />}
          iconTint="quart"
          label={t('Se déconnecter')}
          destructive
          hasChevron={false}
        />
        <ListRow
          onPress={() => deleteAccountModalRef.current?.present()}
          icon={<FeatherIcon name="trash-2" size={18} color="quart" />}
          iconTint="quart"
          label={t('app.deleteAccount')}
          destructive
          hasChevron={false}
        />
      </ListSection>

      <ChangePasswordModal modalRef={passwordModalRef} />
      <DeleteAccountModal modalRef={deleteAccountModalRef} />
    </Box>
  )
}

export default ProfileActions
