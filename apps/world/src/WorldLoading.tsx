import type { CSSProperties } from 'react'
import { ARRIVAL_FADE_MS } from './world-arrival'
import './world-loading.css'

const copy = {
  fr: {
    title: 'Un monde à explorer',
    subtitle: 'De petites îles, de grandes découvertes.',
    loading: 'Préparation de ton voyage…',
    error: 'Impossible de charger la carte. Réessaie dans un instant.',
    retry: 'Réessayer',
    invitation: 'La Bible, au fil de tes découvertes.',
  },
  en: {
    title: 'A world to explore',
    subtitle: 'Little islands, big discoveries.',
    loading: 'Preparing your journey…',
    error: 'Unable to load the map. Try again in a moment.',
    retry: 'Try again',
    invitation: 'Discover the Bible, one place at a time.',
  },
}

export function WorldLoading({
  language,
  color,
  revealing,
  failed,
}: {
  language: keyof typeof copy
  color: string
  revealing: boolean
  failed: boolean
}) {
  const t = copy[language]
  return (
    <div
      className={`loading ${revealing && !failed ? 'is-revealing' : ''}`}
      style={
        { transitionDuration: `${ARRIVAL_FADE_MS}ms`, '--loading-avatar': color } as CSSProperties
      }
    >
      <div className="loading-brand">
        Bible Strong <span>World</span>
      </div>
      <div className="loading-content">
        <div className="loading-scene" aria-hidden="true">
          <span className="loading-cloud loading-cloud-left" />
          <span className="loading-cloud loading-cloud-right" />
          <span className="loading-ripple loading-ripple-outer" />
          <span className="loading-ripple loading-ripple-inner" />
          <svg className="loading-island" viewBox="0 0 320 180" fill="none">
            <path
              d="M57 82 82 132 139 154 198 145 248 113 266 78Z"
              fill="#b5c8b3"
              stroke="#527b79"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="m82 105 17 30 40 19-6-41m65-5v37m34-52-12 37"
              stroke="#8ba79c"
              strokeWidth="2"
            />
            <path
              d="M57 78C57 50 106 34 160 34s106 16 106 44-49 44-106 44S57 106 57 78Z"
              fill="#f5e8bc"
              stroke="#527b79"
              strokeWidth="2"
            />
            <path
              d="M66 70c9-21 51-34 94-34 48 0 88 12 98 35-20 24-69 35-101 33-36 0-71-12-91-34Z"
              fill="#b9d9a4"
            />
            <ellipse cx="158" cy="81" rx="42" ry="12" fill="#759e83" opacity=".25" />
            <path
              d="m91 72-3-9m3 9 7-6m125 10 2-10m-2 10-7-5"
              stroke="#729f74"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path d="M235 56v-8m-4 4h8" stroke="#fff9df" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="loading-slime" />
          <span className="loading-spark loading-spark-one">✦</span>
          <span className="loading-spark loading-spark-two">✦</span>
        </div>
        <h1>{t.title}</h1>
        <p className="loading-subtitle">{t.subtitle}</p>
        <div className="loading-status" role="status">
          {!failed && (
            <span className="loading-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
          <p>{failed ? t.error : t.loading}</p>
        </div>
        {failed && (
          <button type="button" className="loading-retry" onClick={() => window.location.reload()}>
            {t.retry}
          </button>
        )}
      </div>
      <p className="loading-footer">{t.invitation}</p>
    </div>
  )
}
