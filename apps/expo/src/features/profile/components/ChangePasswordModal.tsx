import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { ActivityIndicator } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import { SheetFooter, SheetHeader, SheetTextInput, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'

type ChangePasswordModalProps = {
  modalRef: React.RefObject<SheetRef | null>
}

const ChangePasswordModal = ({ modalRef }: ChangePasswordModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowCurrentPassword(false)
    setShowNewPassword(false)
  }

  const handleClose = () => {
    resetForm()
    modalRef.current?.dismiss()
  }

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return
    }

    if (newPassword !== confirmPassword) {
      return
    }

    if (newPassword.length < 6) {
      return
    }

    setIsLoading(true)
    const success = await FireAuth.changePassword(currentPassword, newPassword).finally(() =>
      setIsLoading(false)
    )

    if (success) {
      handleClose()
    }
  }

  const isValid =
    currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword

  return (
    <Sheet
      ref={modalRef}
      onDismiss={resetForm}
      header={<SheetHeader title={t('profile.changePassword')} />}
      footer={props => (
        <SheetFooter
          {...props}
          className={twMerge('gap-[10px] justify-end flex-row', props.className)}
        >
          <Box
            className="overflow-hidden border-continuous"
            style={{ height: MODAL_FOOTER_HEIGHT }}
          >
            <Button reverse onPress={handleClose} disabled={isLoading}>
              {t('Annuler')}
            </Button>
          </Box>
          <Box
            className="overflow-hidden border-continuous"
            style={{ height: MODAL_FOOTER_HEIGHT }}
          >
            <Button onPress={handleSubmit} disabled={!isValid || isLoading}>
              {isLoading ? <ActivityIndicator color="white" size="small" /> : t('Enregistrer')}
            </Button>
          </Box>
        </SheetFooter>
      )}
    >
      <SheetView className="px-[20px] py-[20px] gap-[15px]">
        <Box className="overflow-hidden border-continuous">
          <StyledInput
            placeholder={t('profile.currentPassword')}
            placeholderTextColor={theme.colors.grey}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
          />
          <TogglePasswordButton onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
            <FeatherIcon name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color="grey" />
          </TogglePasswordButton>
        </Box>

        <Box className="overflow-hidden border-continuous">
          <StyledInput
            placeholder={t('profile.newPassword')}
            placeholderTextColor={theme.colors.grey}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
          />
          <TogglePasswordButton onPress={() => setShowNewPassword(!showNewPassword)}>
            <FeatherIcon name={showNewPassword ? 'eye-off' : 'eye'} size={20} color="grey" />
          </TogglePasswordButton>
        </Box>

        {newPassword.length > 0 && newPassword.length < 6 && (
          <Text className="text-[12px] text-quart">{t('profile.passwordMinLength')}</Text>
        )}

        <StyledInput
          placeholder={t('profile.confirmPassword')}
          placeholderTextColor={theme.colors.grey}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showNewPassword}
          autoCapitalize="none"
        />

        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <Text className="text-[12px] text-quart">{t('profile.passwordMismatch')}</Text>
        )}
      </SheetView>
    </Sheet>
  )
}

const StyledInput = (
  componentProps: Omit<UIComponentProps<typeof SheetTextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'bg-light-grey rounded-[10px] px-[15px] py-[14px] pr-[50px] text-[16px] text-default',
    className
  )
  return (
    <SheetTextInput
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof SheetTextInput>['style']}
    />
  )
}

const TogglePasswordButton = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'absolute right-[15px] top-[0px] bottom-[0px] justify-center',
    className
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']}
    />
  )
}

export default ChangePasswordModal
