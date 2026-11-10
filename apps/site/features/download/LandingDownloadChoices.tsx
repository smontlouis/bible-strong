import SiteLink from '@/components/SiteLink'
import { useEffect, useState } from 'react'
import { androidApkUrl, appStoreUrl, playStoreUrl } from '@/lib/app-links'
import { useCurrentLocale, useI18n } from '@/locales'
import { desktopFilePath, type DesktopFile } from './desktopRelease'
import { currentDevicePlatform, isDesktopPlatform, type DevicePlatform } from './devicePlatform'
import {
  DOWNLOAD_PATHS,
  DOWNLOAD_TARGETS,
  desktopFileTarget,
  downloadMessages,
} from './downloadMessages'

const DESKTOP_FILES_OF: Partial<Record<DevicePlatform, DesktopFile[]>> = {
  mac: ['mac'],
  windows: ['windows'],
  linux: ['linux-appimage', 'linux-deb'],
}

function StoreLink({ href, kicker, label }: { href: string; kicker: string; label: string }) {
  return (
    <a className="store-link" href={href} target="_blank" rel="noreferrer">
      <span>{kicker}</span>
      <strong>{label}</strong>
    </a>
  )
}

/**
 * What the download section of the home page offers: the app for the reader's device first,
 * then every platform, each leading to its part of the download page. A page rendered before
 * the device is known offers the two stores, as most readers come on a phone.
 */
export default function LandingDownloadChoices() {
  const language = useCurrentLocale()
  const t = downloadMessages(language)
  const home = useI18n()
  const [device, setDevice] = useState<DevicePlatform>()
  const [started, setStarted] = useState<DesktopFile>()
  const downloadPath = DOWNLOAD_PATHS[language]

  useEffect(() => setDevice(currentDevicePlatform()), [])

  const desktopFiles = (device && DESKTOP_FILES_OF[device]) ?? []
  const onDesktop = isDesktopPlatform(device)

  return (
    <>
      <div className="store-links">
        {desktopFiles.map(file => (
          <a
            key={file}
            className="store-link"
            href={desktopFilePath(file)}
            download
            rel="nofollow"
            onClick={() => setStarted(file)}
          >
            <span>
              {device === 'linux' ? `${t.downloadFor} ${t.targets.linux}` : t.downloadFor}
            </span>
            <strong>{t.files[file].label}</strong>
          </a>
        ))}
        {!onDesktop && device !== 'android' && (
          <StoreLink href={appStoreUrl} kicker={t.appStore.kicker} label={t.appStore.label} />
        )}
        {!onDesktop && device !== 'ios' && (
          <StoreLink href={playStoreUrl} kicker={t.googlePlay.kicker} label={t.googlePlay.label} />
        )}
      </div>
      {started && (
        <p className="download-started" role="status">
          {t.started[started]}{' '}
          <SiteLink href={`${downloadPath}#${desktopFileTarget(started)}`}>
            {t.installHelp}
          </SiteLink>
        </p>
      )}
      {(device === undefined || device === 'android') && (
        <a className="apk-download-link" href={androidApkUrl} target="_blank" rel="noreferrer">
          {home('home.download.apk')}
        </a>
      )}
      <nav className="download-platforms" aria-label={t.everyPlatform}>
        <SiteLink className="download-platforms__all" href={downloadPath}>
          {t.everyPlatform}
        </SiteLink>
        <ul>
          {DOWNLOAD_TARGETS.map(target => (
            <li key={target}>
              <SiteLink href={`${downloadPath}#${target}`}>{t.targets[target]}</SiteLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
