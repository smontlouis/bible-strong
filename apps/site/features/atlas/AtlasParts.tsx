import { useEffect, useRef, useState } from 'react'
import type { ResourceLanguage } from '../resources/publicSite'
import { searchAtlas, type AtlasTile } from './atlas.functions'
import { buildAtlasEntityPath } from './atlasRoutes'
import { ATLAS_MESSAGES, countLabel } from './messages'

/**
 * A picture of an entity: a cut-out portrait over the ground the application draws, a painting
 * that covers it, or a clay figure.
 */
export function AtlasPicture({
  src,
  alt = '',
  size,
  eager = false,
  className = '',
}: {
  src: string
  alt?: string
  /** The width the picture is drawn at, for the browser to reserve its place. */
  size: number
  eager?: boolean
  className?: string
}) {
  return (
    <span className={`atlas-picture ${className}`}>
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </span>
  )
}

/** An entity as a gallery shows it: its picture, its name and a line on it. */
export function AtlasTileLink({
  tile,
  language,
  size = 'medium',
  showChapters = false,
}: {
  tile: AtlasTile
  language: ResourceLanguage
  size?: 'small' | 'medium' | 'large'
  showChapters?: boolean
}) {
  const messages = ATLAS_MESSAGES[language]
  return (
    <a
      className={`atlas-tile atlas-tile--${size}`}
      href={buildAtlasEntityPath(language, tile.uniqueName)}
    >
      <AtlasPicture
        src={tile.picture}
        size={size === 'large' ? 220 : size === 'medium' ? 160 : 96}
      />
      <span className="atlas-tile__name">{tile.name}</span>
      {tile.brief && size !== 'small' && <span className="atlas-tile__brief">{tile.brief}</span>}
      {showChapters && (
        <span className="atlas-tile__facts">
          {countLabel(messages.chaptersShort, tile.chapterCount, language)}
        </span>
      )}
    </a>
  )
}

/** A row of tiles that scrolls sideways, with the snap of a gallery. */
export function AtlasStrip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="atlas-strip" role="list" aria-label={label}>
      {children}
    </div>
  )
}

/**
 * The search of the atlas: names that start with, then hold, what the reader types. Without
 * the script it is a plain field; the family pages and the links remain.
 */
export function AtlasSearch({ language }: { language: ResourceLanguage }) {
  const messages = ATLAS_MESSAGES[language]
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AtlasTile[] | undefined>()
  const latest = useRef('')

  useEffect(() => {
    const trimmed = query.trim()
    latest.current = trimmed
    if (trimmed.length < 2) {
      setResults(undefined)
      return
    }
    const timer = window.setTimeout(() => {
      searchAtlas({ data: { language, query: trimmed } })
        .then(found => {
          if (latest.current === trimmed) setResults(found)
        })
        .catch(() => {
          if (latest.current === trimmed) setResults([])
        })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [language, query])

  return (
    <div className="atlas-search">
      <label className="sr-only" htmlFor="atlas-search">
        {messages.search}
      </label>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="atlas-search__icon">
        <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="m13.2 13.2 3.6 3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <input
        id="atlas-search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={messages.searchPlaceholder}
        value={query}
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') setQuery('')
        }}
      />
      {results && (
        <div className="atlas-search__results" role="list">
          {results.length ? (
            results.map(tile => (
              <a
                key={tile.uniqueName}
                role="listitem"
                className="atlas-search__result"
                href={buildAtlasEntityPath(language, tile.uniqueName)}
              >
                <AtlasPicture src={tile.picture} size={40} />
                <span className="min-w-0">
                  <span className="atlas-search__name">{tile.name}</span>
                  {tile.brief && <span className="atlas-search__brief">{tile.brief}</span>}
                </span>
              </a>
            ))
          ) : (
            <p className="atlas-search__empty">{messages.searchEmpty}</p>
          )}
        </div>
      )}
    </div>
  )
}
