import { TextInput as NativeTextInput, type TextInputProps } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import { resolveTextTypography } from './textTypography'

/**
 * React Native's text field in the interface face, with nothing else of its own: a field that
 * names a face in its style keeps it. Import it in place of React Native's `TextInput`; it is
 * also the type of a ref to the field.
 */
export const TextInput = ({
  style,
  ...props
}: TextInputProps & { className?: string; ref?: React.Ref<NativeTextInput> }) => {
  const theme = useTheme()
  return <NativeTextInput {...props} style={resolveTextTypography(theme.fontFamily.text, style)} />
}

// The component and the type of its ref share one name, as React Native's `TextInput` does.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TextInput = NativeTextInput
