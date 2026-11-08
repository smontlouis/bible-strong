import { useEffect, useRef, useState } from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { useAui } from '@assistant-ui/react-native'
import { createComposerTextSync, receiveComposerText, sendComposerText } from './composerTextSync'

type Props = Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText'>

/**
 * The composer's text field. It owns the text while the user types, so that a fast typist
 * never sees the store's late value pushed back into the field (see composerTextSync).
 */
export default function AssistantComposerInput(props: Props) {
  const aui = useAui()
  const [text, setText] = useState(() => aui.composer.getState().text)
  const syncRef = useRef(createComposerTextSync(text))

  useEffect(
    () =>
      aui.subscribe(() => {
        const { sync, fieldText } = receiveComposerText(
          syncRef.current,
          aui.composer.getState().text
        )
        syncRef.current = sync
        if (fieldText !== undefined) setText(fieldText)
      }),
    [aui]
  )

  return (
    <TextInput
      {...props}
      value={text}
      onChangeText={value => {
        syncRef.current = sendComposerText(syncRef.current, value)
        setText(value)
        aui.composer.setText(value)
      }}
    />
  )
}
