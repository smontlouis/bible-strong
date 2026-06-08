import { useSheetInternal } from '~common/sheet'
import { useTheme } from '@emotion/react'
import { useState } from 'react'
import { Platform } from 'react-native'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import NoteEditorDOMComponent from './NoteEditorDOMComponent'

interface Props {
  defaultTitle: string
  defaultDescription: string
  resetKey?: number
  isEditing: boolean
  placeholderTitle: string
  placeholderDescription: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

/**
 * Wrapper for NoteEditorDOMComponent that integrates with Sheet keyboard handling.
 * Must be used inside a Sheet context.
 */
export default function NoteEditorSheet({
  defaultTitle,
  defaultDescription,
  resetKey,
  isEditing,
  placeholderTitle,
  placeholderDescription,
  onTitleChange,
  onDescriptionChange,
}: Props) {
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()
  const [webViewHeight, setWebViewHeight] = useState(100)
  const { animatedKeyboardState } = useSheetInternal()

  const handleSizeChange = (_width: number, height: number) => {
    setWebViewHeight(height)
  }

  const handleFocus = () => {
    animatedKeyboardState.set(state => ({
      ...state,
      target: -1,
    }))
  }

  const handleBlur = () => {
    const keyboardState = animatedKeyboardState.get()
    if (keyboardState.target === -1) {
      animatedKeyboardState.set(state => ({
        ...state,
        target: undefined,
      }))
    }
  }

  return (
    <NoteEditorDOMComponent
      encodedDefaultTitle={encodeURIComponent(defaultTitle)}
      encodedDefaultDescription={encodeURIComponent(defaultDescription)}
      resetKey={resetKey}
      isEditing={isEditing}
      colorScheme={colorScheme}
      textColor={theme.colors.default}
      editorBackgroundColor={theme.colors.opacity5}
      placeholderColor={theme.colors.grey}
      placeholderTitle={placeholderTitle}
      placeholderDescription={placeholderDescription}
      onTitleChange={onTitleChange}
      onDescriptionChange={onDescriptionChange}
      onSizeChange={handleSizeChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      dom={{
        ...(Platform.OS === 'ios' ? { useExpoDOMWebView: false } : {}),
        containerStyle: { height: webViewHeight, overflow: 'hidden' },
        style: { overflow: 'hidden' },
        scrollEnabled: false,
        hideKeyboardAccessoryView: true,
      }}
    />
  )
}
