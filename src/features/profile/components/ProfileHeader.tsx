import styled from '@emotion/native'
import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { BottomSheetModal } from '@gorhom/bottom-sheet'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import RenameModal from '~common/RenameModal'
import useLogin from '~helpers/useLogin'
import FireAuth from '~helpers/FireAuth'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import { onUserUpdateProfile } from '~redux/modules/user'
import ProfileAvatar from './ProfileAvatar'
import SubscriptionBadge from './SubscriptionBadge'
import EmailVerificationModal from './EmailVerificationModal'

const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'google.com':
      return { icon: 'logo-google' as const, color: '#4285F4' }
    case 'apple.com':
      return { icon: 'logo-apple' as const, color: '#000000' }
    case 'password':
    default:
      return { icon: 'mail' as const, color: '#6B7280' }
  }
}

const formatMemberSince = (dateString: string | null, locale: string): string | null => {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
    })
  } catch {
    return null
  }
}

const ProfileHeader = () => {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const { user } = useLogin()

  const renameModalRef = useRef<BottomSheetModal>(null)
  const emailVerificationModalRef = useRef<BottomSheetModal>(null)

  const showEmailNotVerified = user.provider === 'password' && !user.emailVerified
  const providerInfo = getProviderIcon(user.provider)
  const memberSince = formatMemberSince(user.createdAt, i18n.language)

  const handleSaveName = async (newName: string) => {
    const success = await FireAuth.updateDisplayName(newName)
    if (success) {
      dispatch(onUserUpdateProfile({ displayName: newName }))
    }
  }

  return (
    <VStack gap={20}>
      <Box center>
        <ProfileAvatar />
      </Box>

      <VStack gap={10} center>
        <HStack alignItems="center" gap={10}>
          <Text title fontSize={24}>
            {user.displayName || t('profile.noName')}
          </Text>
          <EditButton onPress={() => renameModalRef.current?.present()}>
            <FeatherIcon name="edit-2" size={18} color="grey" />
          </EditButton>
        </HStack>

        <HStack alignItems="center" gap={6}>
          <IonIcon name={providerInfo.icon} size={18} color={providerInfo.color} />
          <Text color="grey" fontSize={14}>
            {user.email}
          </Text>
          {showEmailNotVerified && (
            <WarningButton onPress={() => emailVerificationModalRef.current?.present()}>
              <FeatherIcon name="alert-circle" size={16} color="quart" />
            </WarningButton>
          )}
        </HStack>

        <SubscriptionBadge />

        {memberSince && (
          <Text color="grey" fontSize={12}>
            {t('profile.memberSince', { date: memberSince })}
          </Text>
        )}
      </VStack>

      <RenameModal
        bottomSheetRef={renameModalRef}
        title={t('profile.editName')}
        placeholder={t('profile.enterName')}
        initialValue={user.displayName}
        onSave={handleSaveName}
      />

      <EmailVerificationModal modalRef={emailVerificationModalRef} />
    </VStack>
  )
}

const EditButton = styled.TouchableOpacity({
  padding: 5,
})

const WarningButton = styled.TouchableOpacity({
  padding: 2,
})

export default ProfileHeader
