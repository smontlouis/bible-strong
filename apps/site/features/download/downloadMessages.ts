import type { ResourceLanguage } from '../resources/publicSite'
import type { DesktopFile } from './desktopRelease'

/** The page that offers every version of Bible Strong. */
export const DOWNLOAD_PATHS: Record<ResourceLanguage, string> = {
  en: '/download',
  fr: '/fr/download',
}

/** The parts of the download page, each found again by its anchor. */
export type DownloadTarget = 'iphone' | 'android' | 'mac' | 'windows' | 'linux' | 'web'

export const DOWNLOAD_TARGETS: readonly DownloadTarget[] = [
  'iphone',
  'android',
  'mac',
  'windows',
  'linux',
  'web',
]

type DownloadMessages = {
  meta: { title: string; description: string }
  eyebrow: string
  title: string
  intro: string
  yourDevice: string
  groups: { mobile: string; computer: string; computerIntro: string; browser: string }
  targets: Record<DownloadTarget, string>
  details: Record<DownloadTarget, string>
  appStore: { kicker: string; label: string; action: string }
  googlePlay: { kicker: string; label: string; action: string }
  apk: string
  downloadFor: string
  files: Record<DesktopFile, { label: string; detail: string }>
  toInstall: string
  /** The steps of an installation; a command is set between backquotes. */
  steps: { mac: string[]; windows: string[]; linux: string[] }
  windowsWarning: string
  webTitle: string
  openWebApp: string
  release: { version: (version: string, date?: string) => string; notes: string; all: string }
  started: Record<DesktopFile, string>
  installHelp: string
  everyPlatform: string
}

const fr: DownloadMessages = {
  meta: {
    title: 'Télécharger Bible Strong – iPhone, Android, Mac, Windows et Linux',
    description:
      'Bible Strong est gratuit sur iPhone, iPad, Android, Mac, Windows et Linux, et s’ouvre dans votre navigateur. Téléchargez la dernière version pour votre appareil.',
  },
  eyebrow: 'Télécharger',
  title: 'Bible Strong sur tous vos appareils',
  intro:
    'Gratuit sur téléphone, tablette et ordinateur. Connectez-vous avec le même compte sur chacun : vos notes, vos surlignages et vos études vous suivent.',
  yourDevice: 'Votre appareil',
  groups: {
    mobile: 'Téléphone et tablette',
    computer: 'Ordinateur',
    computerIntro:
      'L’app pour ordinateur garde vos Bibles et vos ressources sur votre disque : lisez hors ligne, sur grand écran et au clavier.',
    browser: 'Navigateur',
  },
  targets: {
    iphone: 'iPhone et iPad',
    android: 'Android',
    mac: 'Mac',
    windows: 'Windows',
    linux: 'Linux',
    web: 'Navigateur',
  },
  details: {
    iphone: 'Sur l’App Store',
    android: 'Téléphones, tablettes et Chromebook',
    mac: 'Apple Silicon et Intel · macOS 11 ou plus récent',
    windows: 'Windows 10 et 11 · 64 bits',
    linux: '64 bits (x86_64)',
    web: 'Sans rien installer, sur n’importe quel ordinateur',
  },
  appStore: {
    kicker: 'Télécharger dans',
    label: 'App Store',
    action: 'Télécharger dans l’App Store',
  },
  googlePlay: {
    kicker: 'Disponible sur',
    label: 'Google Play',
    action: 'Disponible sur Google Play',
  },
  apk: 'Sans Google Play : télécharger l’APK Android — v26.0.10',
  downloadFor: 'Télécharger pour',
  files: {
    mac: { label: 'Mac', detail: 'Fichier .dmg' },
    windows: { label: 'Windows', detail: 'Fichier .exe' },
    'linux-appimage': { label: 'AppImage', detail: 'Toutes les distributions' },
    'linux-deb': { label: '.deb', detail: 'Debian, Ubuntu, Linux Mint' },
  },
  toInstall: 'Pour installer',
  steps: {
    mac: [
      'Ouvrez le fichier .dmg téléchargé.',
      'Glissez Bible Strong dans le dossier Applications.',
      'Ouvrez Bible Strong depuis le dossier Applications.',
    ],
    windows: [
      'Ouvrez le fichier .exe téléchargé. L’installation se fait pour votre compte, sans droits d’administrateur.',
      'Si Windows affiche « Windows a protégé votre ordinateur », choisissez « Informations complémentaires », puis « Exécuter quand même ».',
      'Ouvrez Bible Strong depuis le menu Démarrer.',
    ],
    linux: [
      'AppImage : rendez le fichier exécutable, dans ses propriétés ou avec `chmod +x`, puis ouvrez-le.',
      'Paquet .deb : ouvrez-le avec votre logithèque, ou installez-le avec `sudo apt install ./` suivi du nom du fichier.',
    ],
  },
  windowsWarning: 'Windows affiche ce message pour les applications qu’il ne connaît pas encore.',
  webTitle: 'L’app web',
  openWebApp: 'Ouvrir l’app web',
  release: {
    version: (version, date) =>
      date
        ? `Version ${version} pour ordinateur, publiée le ${date}.`
        : `Version ${version} pour ordinateur.`,
    notes: 'Notes de version',
    all: 'Toutes les versions',
  },
  started: {
    mac: 'Le téléchargement a commencé. Ouvrez le fichier .dmg, puis glissez Bible Strong dans le dossier Applications.',
    windows:
      'Le téléchargement a commencé. Si Windows affiche « Windows a protégé votre ordinateur », choisissez « Informations complémentaires », puis « Exécuter quand même ».',
    'linux-appimage': 'Le téléchargement a commencé. Rendez le fichier exécutable, puis ouvrez-le.',
    'linux-deb':
      'Le téléchargement a commencé. Ouvrez le paquet avec votre logithèque pour l’installer.',
  },
  installHelp: 'Aide à l’installation',
  everyPlatform: 'Toutes les plateformes',
}

const en: DownloadMessages = {
  meta: {
    title: 'Download Bible Strong – iPhone, Android, Mac, Windows and Linux',
    description:
      'Bible Strong is free on iPhone, iPad, Android, Mac, Windows and Linux, and opens in your browser. Download the latest version for your device.',
  },
  eyebrow: 'Download',
  title: 'Bible Strong on all your devices',
  intro:
    'Free on phone, tablet and computer. Sign in with the same account on each one: your notes, highlights and studies follow you.',
  yourDevice: 'Your device',
  groups: {
    mobile: 'Phone and tablet',
    computer: 'Computer',
    computerIntro:
      'The desktop app keeps your Bibles and resources on your disk: read offline, on a large screen and from the keyboard.',
    browser: 'Browser',
  },
  targets: {
    iphone: 'iPhone and iPad',
    android: 'Android',
    mac: 'Mac',
    windows: 'Windows',
    linux: 'Linux',
    web: 'Browser',
  },
  details: {
    iphone: 'On the App Store',
    android: 'Phones, tablets and Chromebooks',
    mac: 'Apple Silicon and Intel · macOS 11 or later',
    windows: 'Windows 10 and 11 · 64-bit',
    linux: '64-bit (x86_64)',
    web: 'Nothing to install, on any computer',
  },
  appStore: { kicker: 'Download on the', label: 'App Store', action: 'Download on the App Store' },
  googlePlay: { kicker: 'Get it on', label: 'Google Play', action: 'Get it on Google Play' },
  apk: 'Without Google Play: download the Android APK — v26.0.10',
  downloadFor: 'Download for',
  files: {
    mac: { label: 'Mac', detail: '.dmg file' },
    windows: { label: 'Windows', detail: '.exe file' },
    'linux-appimage': { label: 'AppImage', detail: 'Every distribution' },
    'linux-deb': { label: '.deb', detail: 'Debian, Ubuntu, Linux Mint' },
  },
  toInstall: 'To install',
  steps: {
    mac: [
      'Open the downloaded .dmg file.',
      'Drag Bible Strong into the Applications folder.',
      'Open Bible Strong from the Applications folder.',
    ],
    windows: [
      'Open the downloaded .exe file. It installs for your account, without administrator rights.',
      'If Windows shows “Windows protected your PC”, choose “More info”, then “Run anyway”.',
      'Open Bible Strong from the Start menu.',
    ],
    linux: [
      'AppImage: make the file executable, in its properties or with `chmod +x`, then open it.',
      '.deb package: open it with your software centre, or install it with `sudo apt install ./` followed by the file name.',
    ],
  },
  windowsWarning: 'Windows shows this message for apps it does not know yet.',
  webTitle: 'The web app',
  openWebApp: 'Open the web app',
  release: {
    version: (version, date) =>
      date ? `Desktop version ${version}, published on ${date}.` : `Desktop version ${version}.`,
    notes: 'Release notes',
    all: 'All versions',
  },
  started: {
    mac: 'Your download has started. Open the .dmg file, then drag Bible Strong into the Applications folder.',
    windows:
      'Your download has started. If Windows shows “Windows protected your PC”, choose “More info”, then “Run anyway”.',
    'linux-appimage': 'Your download has started. Make the file executable, then open it.',
    'linux-deb':
      'Your download has started. Open the package with your software centre to install it.',
  },
  installHelp: 'Installation help',
  everyPlatform: 'Every platform',
}

export const downloadMessages = (language: ResourceLanguage): DownloadMessages =>
  language === 'fr' ? fr : en

/** The part of the download page about a desktop installer. */
export const desktopFileTarget = (file: DesktopFile): DownloadTarget =>
  file === 'mac' ? 'mac' : file === 'windows' ? 'windows' : 'linux'
