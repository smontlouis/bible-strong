import { useEffect, useState, type ReactNode } from 'react'
import { androidApkUrl, appStoreUrl, playStoreUrl, webAppUrl } from '@/lib/app-links'
import { useCurrentLocale } from '@/locales'
import ResourceShell from '../resources/ResourceShell'
import type { ResourceLanguage } from '../resources/publicSite'
import { DESKTOP_RELEASES_URL, desktopFilePath, type DesktopFile } from './desktopRelease'
import { currentDevicePlatform, type DevicePlatform } from './devicePlatform'
import type { DesktopReleaseSummary } from './download.functions'
import { DOWNLOAD_PATHS, downloadMessages, type DownloadTarget } from './downloadMessages'

const TARGET_OF_DEVICE: Record<DevicePlatform, DownloadTarget> = {
  ios: 'iphone',
  android: 'android',
  mac: 'mac',
  windows: 'windows',
  linux: 'linux',
}

const publicationDate = (date: string | undefined, language: ResourceLanguage) =>
  date &&
  new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(date))

/**
 * A way to get the app. The one for the reader's device is the solid button of the page; the
 * others are tinted, and take the same room so that nothing moves when the device is known.
 */
function DownloadAction({
  href,
  primary,
  file,
  children,
}: {
  href: string
  primary: boolean
  /** The desktop installer the link downloads. */
  file?: DesktopFile
  children: ReactNode
}) {
  return (
    <a
      className={`download-action${primary ? ' download-action--primary' : ''}`}
      href={href}
      {...(file ? { download: true, rel: 'nofollow' } : { target: '_blank', rel: 'noreferrer' })}
    >
      {children}
    </a>
  )
}

function PlatformCard({
  target,
  device,
  title,
  detail,
  children,
}: {
  target: DownloadTarget
  device: DownloadTarget | undefined
  /** What the card is called when its platform's name would repeat its group's. */
  title?: string
  detail: string
  children: ReactNode
}) {
  const language = useCurrentLocale()
  const t = downloadMessages(language)
  const isDevice = device === target
  return (
    <li id={target} className={`download-card${isDevice ? ' download-card--device' : ''}`}>
      <div className="download-card__head">
        <h3 className="download-card__title">{title ?? t.targets[target]}</h3>
        {isDevice && <span className="resource-chip">{t.yourDevice}</span>}
      </div>
      <p className="resource-muted mt-1 text-sm">{detail}</p>
      {children}
    </li>
  )
}

function InstallSteps({ steps, note }: { steps: string[]; note?: string }) {
  const t = downloadMessages(useCurrentLocale())
  return (
    <div className="download-card__steps">
      <p className="download-card__label">{t.toInstall}</p>
      <ol>
        {steps.map(step => (
          <li key={step}>
            {step.split('`').map((part, index) =>
              index % 2 === 1 ? (
                <code key={part} className="download-command">
                  {part}
                </code>
              ) : (
                part
              )
            )}
          </li>
        ))}
      </ol>
      {note && <p className="resource-muted mt-2 text-sm">{note}</p>}
    </div>
  )
}

/** `/download` — every way to get Bible Strong, the reader's own device marked. */
export function DownloadPage({ release }: { release: DesktopReleaseSummary | null }) {
  const language = useCurrentLocale()
  const t = downloadMessages(language)
  const [device, setDevice] = useState<DownloadTarget>()

  useEffect(() => {
    const platform = currentDevicePlatform()
    setDevice(platform && TARGET_OF_DEVICE[platform])
  }, [])

  const desktopAction = (file: DesktopFile, target: DownloadTarget, label: string) => (
    <DownloadAction href={desktopFilePath(file)} primary={device === target} file={file}>
      {label}
    </DownloadAction>
  )

  return (
    <ResourceShell
      alternatePath={DOWNLOAD_PATHS[language === 'fr' ? 'en' : 'fr']}
      appUrl={webAppUrl}
    >
      <article className="download-page">
        <header>
          <p className="resource-muted text-sm font-medium uppercase tracking-[0.14em]">
            {t.eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{t.title}</h1>
          <p className="resource-prose mt-5">{t.intro}</p>
        </header>

        <section className="download-group" aria-labelledby="download-mobile">
          <h2 id="download-mobile" className="download-group__title">
            {t.groups.mobile}
          </h2>
          <ul className="download-cards">
            <PlatformCard target="iphone" device={device} detail={t.details.iphone}>
              <div className="download-card__actions">
                <DownloadAction href={appStoreUrl} primary={device === 'iphone'}>
                  {t.appStore.action}
                </DownloadAction>
              </div>
            </PlatformCard>
            <PlatformCard target="android" device={device} detail={t.details.android}>
              <div className="download-card__actions">
                <DownloadAction href={playStoreUrl} primary={device === 'android'}>
                  {t.googlePlay.action}
                </DownloadAction>
              </div>
              <a
                className="resource-link mt-3 inline-block text-sm"
                href={androidApkUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t.apk}
              </a>
            </PlatformCard>
          </ul>
        </section>

        <section className="download-group" aria-labelledby="download-computer">
          <h2 id="download-computer" className="download-group__title">
            {t.groups.computer}
          </h2>
          <p className="resource-muted mt-1">{t.groups.computerIntro}</p>
          <ul className="download-cards">
            <PlatformCard target="mac" device={device} detail={t.details.mac}>
              <div className="download-card__actions">
                {desktopAction('mac', 'mac', `${t.downloadFor} ${t.files.mac.label}`)}
              </div>
              <InstallSteps steps={t.steps.mac} />
            </PlatformCard>
            <PlatformCard target="windows" device={device} detail={t.details.windows}>
              <div className="download-card__actions">
                {desktopAction('windows', 'windows', `${t.downloadFor} ${t.files.windows.label}`)}
              </div>
              <InstallSteps steps={t.steps.windows} note={t.windowsWarning} />
            </PlatformCard>
            <PlatformCard target="linux" device={device} detail={t.details.linux}>
              <div className="download-card__actions">
                {(['linux-appimage', 'linux-deb'] as const).map(file => (
                  <div key={file} className="download-card__file">
                    {desktopAction(file, 'linux', t.files[file].label)}
                    <span className="resource-muted text-sm">{t.files[file].detail}</span>
                  </div>
                ))}
              </div>
              <InstallSteps steps={t.steps.linux} />
            </PlatformCard>
          </ul>
          <p className="resource-muted mt-4 text-sm">
            {release && (
              <>
                {t.release.version(release.version, publicationDate(release.publishedAt, language))}{' '}
                <a
                  className="resource-link"
                  href={release.notesUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.release.notes}
                </a>
                {' · '}
              </>
            )}
            <a
              className="resource-link"
              href={DESKTOP_RELEASES_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t.release.all}
            </a>
          </p>
        </section>

        <section className="download-group" aria-labelledby="download-browser">
          <h2 id="download-browser" className="download-group__title">
            {t.groups.browser}
          </h2>
          <ul className="download-cards">
            <PlatformCard target="web" device={undefined} title={t.webTitle} detail={t.details.web}>
              <div className="download-card__actions">
                <DownloadAction href={webAppUrl} primary={false}>
                  {t.openWebApp}
                </DownloadAction>
              </div>
            </PlatformCard>
          </ul>
        </section>
      </article>
    </ResourceShell>
  )
}
