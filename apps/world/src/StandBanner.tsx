import { useId, useState } from 'react'
import type { Language } from './language'
import './stand-banner.css'

export function StandBanner({ invitation, language }: { invitation: string; language: Language }) {
  const [collapsed, setCollapsed] = useState(false)
  const contentId = useId()
  const label =
    language === 'fr'
      ? collapsed
        ? 'Afficher le bandeau'
        : 'Réduire le bandeau'
      : collapsed
        ? 'Show banner'
        : 'Hide banner'
  return (
    <div className="stand-banner-dock" data-collapsed={collapsed}>
      <button
        type="button"
        className="stand-banner-toggle"
        aria-label={label}
        title={label}
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={() => setCollapsed(value => !value)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d={collapsed ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <a
        id={contentId}
        inert={collapsed}
        aria-hidden={collapsed}
        className="stand-banner"
        href="https://world.bible-strong.app"
        target="_blank"
        rel="noreferrer"
      >
        <img
          className="stand-banner-qr"
          src="/assets/world-qr.svg"
          width="184"
          height="184"
          alt="QR code — world.bible-strong.app"
        />
        <span className="stand-banner-copy">
          <strong>{invitation}</strong>
          <span>world.bible-strong.app</span>
        </span>
        <img
          className="stand-banner-logo"
          src="/assets/asi-europe.png"
          width="308"
          height="150"
          alt="ASI Europe"
        />
      </a>
    </div>
  )
}
