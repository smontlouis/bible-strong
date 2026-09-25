import type { Zone } from './world'

export const APP_DOWNLOAD_URL = 'https://bible-strong.app/'

/** Southwest of the central Bible, in the map's 1671 × 941 source coordinates. */
export const APP_DOWNLOAD_STATION = { x: 725, y: 522, width: 76, height: 92 } as const

/** Only the pedestal touches the ground; visitors can walk behind the phone. */
export const APP_DOWNLOAD_OBSTACLE: Zone = {
  id: 'app-download-pedestal',
  name: 'Présentoir de l’application',
  kind: 'blocked',
  points: [
    [695, 505],
    [710, 499],
    [740, 499],
    [755, 505],
    [755, 513],
    [740, 520],
    [710, 520],
    [695, 513],
  ],
}

export const appDownloadCopy = {
  fr: { download: 'Télécharger l’app' },
  en: { download: 'Download the app' },
} as const
