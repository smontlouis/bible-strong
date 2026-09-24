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
        <span className="stand-banner-scan">
          <svg className="stand-banner-rays" viewBox="0 0 72 92" fill="none" aria-hidden="true">
            <path d="m48 25-8-18M29 44 9 34m18 33L7 73" />
          </svg>
          <img
            className="stand-banner-qr"
            src="/assets/world-qr.svg"
            width="184"
            height="184"
            alt="QR code — world.bible-strong.app"
          />
        </span>
        <span className="stand-banner-copy">
          <svg className="stand-banner-arrow" viewBox="0 0 72 64" fill="none" aria-hidden="true">
            <path d="M65 55C61 28 42 20 10 23m17-16L9 23l19 13" />
          </svg>
          <strong className="stand-banner-title">
            <span>{language === 'fr' ? 'Entre dans' : 'Step into'}</span>
            <span>{language === 'fr' ? 'le monde !' : 'the world!'}</span>
          </strong>
          <svg className="stand-banner-spark" viewBox="0 0 60 72" fill="none" aria-hidden="true">
            <path d="m14 32 16-23m-4 43 25-11" />
          </svg>
          <span className="stand-banner-invitation">{invitation}</span>
          <span className="stand-banner-url">world.bible-strong.app</span>
        </span>
        <span className="stand-banner-partner">
          <img
            className="stand-banner-logo"
            src="/assets/asi-europe.png"
            width="308"
            height="150"
            alt="ASI Europe"
          />
        </span>
      </a>
    </div>
  )
}
