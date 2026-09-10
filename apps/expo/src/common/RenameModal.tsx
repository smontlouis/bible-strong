import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TextInput as RNTextInput } from 'react-native'
import { twMerge } from '~common/ui/classNames'

import { SheetFooter, SheetHeader, SheetTextInput, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Button from '~common/ui/Button'
import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

const StyledTextInput = (
  componentProps: Omit<UIComponentProps<typeof SheetTextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'text-default h-[48px] border-border border-[2px] rounded-[10px] px-[15px] text-[16px]',
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

interface RenameModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  title: string
  placeholder: string
  initialValue?: string
  onSave: (value: string) => void
  onClose?: () => void
}

const RenameModal = ({
  sheetRef,
  title,
  placeholder,
  initialValue = '',
  onSave,
  onClose,
}: RenameModalProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const [value, setValue] = useState(initialValue)
  const inputRef = React.useRef<RNTextInput>(null)

  const scheduleInputFocus = () => {
    inputRef.current?.focus()
  }

  const handleClose = () => {
    sheetRef.current?.dismiss()
  }

  const handleSave = () => {
    if (!value.trim()) return
    onSave(value.trim())
    handleClose()
  }

  const handlePresent = () => {
    setValue(initialValue)
    scheduleInputFocus()
  }

  const handleDismiss = () => {
    onClose?.()
  }

  const isDisabled = !value.trim()

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={handleDismiss}
      onPresent={handlePresent}
      header={<SheetHeader title={title} />}
      footer={props => (
        <SheetFooter {...props}>
          <Button disabled={isDisabled} onPress={handleSave}>
            {t('Sauvegarder')}
          </Button>
        </SheetFooter>
      )}
    >
      <SheetView className="px-[20px] py-[20px]">
        <StyledTextInput
          ref={inputRef}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.grey}
          onChangeText={setValue}
          onSubmitEditing={handleSave}
          returnKeyType="send"
          value={value}
          selectTextOnFocus
        />
      </SheetView>
    </Sheet>
  )
}

export default RenameModal
