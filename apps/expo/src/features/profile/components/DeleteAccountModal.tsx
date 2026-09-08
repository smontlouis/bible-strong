import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { SheetFooter, SheetHeader, SheetTextInput, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import { deleteCurrentAuthUser, getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import Box, { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import FireAuth from '~helpers/FireAuth'
import { MODAL_FOOTER_HEIGHT } from '~helpers/constants'

type DeleteAccountModalProps = {
  modalRef: React.RefObject<SheetRef | null>
}

const DeleteAccountModal = ({ modalRef }: DeleteAccountModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const confirmationText = t('app.deleteAccountConfirmationText')
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isValid = confirmText === confirmationText

  const resetForm = () => {
    setConfirmText('')
  }

  const handleClose = () => {
    resetForm()
    modalRef.current?.dismiss()
  }

  const handleDelete = async () => {
    if (!isValid) return

    const authUser = getCurrentAuthUser()
    if (!authUser) return

    setIsLoading(true)
    try {
      await deleteCurrentAuthUser()
      handleClose()
      FireAuth.logout()
    } catch (error: unknown) {
      setIsLoading(false)
      const authError = error as { code?: string; message?: string }
      console.error('[Auth] Delete error:', authError.code, authError.message)
      if (authError.code === 'auth/requires-recent-login') {
        Alert.alert(t('Attention'), t('app.deleteAccountRequiresRecentLogin'))
      } else {
        Alert.alert(t('Erreur'), authError.message)
      }
    }
  }

  return (
    <Sheet
      ref={modalRef}
      onDismiss={resetForm}
      header={<SheetHeader title={t('app.deleteAccount')} />}
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
            <Button
              color={theme.colors.quart}
              onPress={handleDelete}
              disabled={!isValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                t('app.deleteAccountConfirmButton')
              )}
            </Button>
          </Box>
        </SheetFooter>
      )}
    >
      <SheetView>
        <VStack className="overflow-hidden border-continuous gap-[15px] px-[20px] py-[20px]">
          <Text className="text-[15px]">{t('app.deleteAccountBody')}</Text>
          <Text className="text-[14px] text-grey">
            {t('app.deleteAccountTypeConfirm', { text: confirmationText })}
          </Text>
          <StyledInput
            placeholder={confirmationText}
            placeholderTextColor={theme.colors.grey}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </VStack>
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

  const classStyles = useResolveClassNames(
    twMerge('bg-light-grey rounded-[10px] px-[15px] py-[14px] text-[16px] text-default', className)
  )
  return (
    <SheetTextInput
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof SheetTextInput>['style']}
    />
  )
}

export default DeleteAccountModal
