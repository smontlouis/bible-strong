import { Alert } from 'react-native'
import type { ConfirmDialogOptions } from './types'

export function useConfirmDialog() {
  return (options: ConfirmDialogOptions): Promise<boolean> =>
    new Promise(resolve => {
      Alert.alert(
        options.title,
        options.message,
        [
          { text: options.cancelLabel, style: 'cancel', onPress: () => resolve(false) },
          {
            text: options.confirmLabel,
            style: options.destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      )
    })
}
