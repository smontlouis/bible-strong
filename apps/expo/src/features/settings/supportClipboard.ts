import Clipboard from '@react-native-clipboard/clipboard'

export async function copySupportEmail(text: string) {
  Clipboard.setString(text)
}
