import { Alert } from 'react-native'

import type { DownloadItem } from '~state/downloadQueue'

export const confirmBibleModeAcquisition = ({
  plan,
  modeLabel,
  translate,
  onConfirm,
}: {
  plan: DownloadItem[]
  modeLabel: string
  translate: (key: string, options?: Record<string, unknown>) => string
  onConfirm: () => void
}) => {
  const size = Math.max(
    1,
    Math.ceil(plan.reduce((total, item) => total + item.estimatedSize, 0) / 1_000_000)
  )
  Alert.alert(
    translate('Télécharger'),
    translate(
      'Les ressources manquantes pour « {{mode}} » représentent environ {{size}} Mo. Voulez-vous les télécharger ?',
      { mode: modeLabel, size }
    ),
    [
      { text: translate('Annuler'), style: 'cancel' },
      { text: translate('Télécharger'), onPress: onConfirm },
    ]
  )
}
