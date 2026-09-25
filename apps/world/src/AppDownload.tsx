import type { Ref } from 'react'
import type { Language } from './language'
import { APP_DOWNLOAD_URL, appDownloadCopy } from './app-download'
import './app-download.css'

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M10 5h4m-2 4v7m-3-3 3 3 3-3" />
    </svg>
  )
}

export function AppDownloadShortcut({ language }: { language: Language }) {
  return (
    <a
      className="app-download-shortcut"
      href={APP_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="app-download-shortcut-icon">
        <PhoneIcon />
      </span>
      <span>{appDownloadCopy[language].download}</span>
      <span className="app-download-external" aria-hidden="true">
        ↗
      </span>
    </a>
  )
}

/** Phaser positions this accessible link over the phone, independently of proximity. */
export function AppDownloadStation({
  language,
  ref,
}: {
  language: Language
  ref: Ref<HTMLAnchorElement>
}) {
  const copy = appDownloadCopy[language]
  return (
    <a
      ref={ref}
      className="app-download-station"
      href={APP_DOWNLOAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Bible Strong — ${copy.download}`}
      data-visible="false"
    >
      <span className="app-download-station-copy">
        <strong>
          {copy.download}
          <span aria-hidden="true"> ↗</span>
        </strong>
      </span>
    </a>
  )
}
