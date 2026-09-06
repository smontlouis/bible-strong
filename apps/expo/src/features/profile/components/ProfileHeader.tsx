import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { useDispatch } from 'react-redux'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { type SheetRef } from '~common/sheet'
import type { Theme as AppTheme } from '~themes'

import RenameModal from '~common/RenameModal'
import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'
import useLogin from '~helpers/useLogin'
import { onUserUpdateProfile } from '~redux/modules/user'
import EmailVerificationModal from './EmailVerificationModal'
import ProfileAvatar from './ProfileAvatar'

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
  const stylingTheme = useStylingTheme()

  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const { user } = useLogin()

  const renameModalRef = useRef<SheetRef>(null)
  const emailVerificationModalRef = useRef<SheetRef>(null)

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
    <VStack className="overflow-hidden border-continuous gap-[20px]">
      <Box className="overflow-hidden border-continuous items-center justify-center">
        <ProfileAvatar />
      </Box>

      <VStack className="overflow-hidden border-continuous gap-[10px] items-center justify-center">
        <HStack className="overflow-hidden border-continuous items-center gap-[10px]">
          <Text
            className="text-[24px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {user.displayName || t('profile.noName')}
          </Text>
          <EditButton onPress={() => renameModalRef.current?.present()}>
            <FeatherIcon name="edit-2" size={18} color="grey" />
          </EditButton>
        </HStack>

        <HStack className="overflow-hidden border-continuous items-center gap-[6px]">
          <IonIcon name={providerInfo.icon} size={18} color={providerInfo.color} />
          <Text className="text-grey text-[14px]">{user.email}</Text>
          {showEmailNotVerified && (
            <WarningButton onPress={() => emailVerificationModalRef.current?.present()}>
              <FeatherIcon name="alert-circle" size={16} color="quart" />
            </WarningButton>
          )}
        </HStack>

        {/* <SubscriptionBadge /> */}

        {memberSince && (
          <Text className="text-grey text-[12px]">
            {t('profile.memberSince', { date: memberSince })}
          </Text>
        )}
      </VStack>

      <RenameModal
        sheetRef={renameModalRef}
        title={t('profile.editName')}
        placeholder={t('profile.enterName')}
        initialValue={user.displayName}
        onSave={handleSaveName}
      />

      <EmailVerificationModal modalRef={emailVerificationModalRef} />
    </VStack>
  )
}

const EditButton = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('p-[5px]', className))
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const WarningButton = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('p-[2px]', className))
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

export default ProfileHeader
