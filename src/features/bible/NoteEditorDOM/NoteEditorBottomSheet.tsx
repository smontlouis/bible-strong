import { useBottomSheetInternal } from '@gorhom/bottom-sheet'
import { useState } from 'react'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import NoteEditorDOMComponent from './NoteEditorDOMComponent'

interface Props {
  defaultTitle: string
  defaultDescription: string
  isEditing: boolean
  placeholderTitle: string
  placeholderDescription: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

/**
 * Wrapper for NoteEditorDOMComponent that integrates with BottomSheet keyboard handling.
 * Must be used inside a BottomSheet context.
 */
export default function NoteEditorBottomSheet({
  defaultTitle,
  defaultDescription,
  isEditing,
  placeholderTitle,
  placeholderDescription,
  onTitleChange,
  onDescriptionChange,
}: Props) {
  const { colorScheme } = useCurrentThemeSelector()
  const [webViewHeight, setWebViewHeight] = useState(100)
  const { animatedKeyboardState } = useBottomSheetInternal()

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
      defaultTitle={defaultTitle}
      defaultDescription={defaultDescription}
      isEditing={isEditing}
      colorScheme={colorScheme}
      placeholderTitle={placeholderTitle}
      placeholderDescription={placeholderDescription}
      onTitleChange={onTitleChange}
      onDescriptionChange={onDescriptionChange}
      onSizeChange={handleSizeChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      dom={{
        containerStyle: { height: webViewHeight, overflow: 'hidden' },
        style: { overflow: 'hidden' },
        scrollEnabled: false,
        hideKeyboardAccessoryView: true,
      }}
    />
  )
}
