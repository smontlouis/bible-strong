import { type CSSProperties, type ReactNode } from 'react'
import { Modal } from './Modal'
import { AvatarPreview, profileCopy } from './AvatarEditor'
import type { AvatarProfile } from './avatar-profile'
import { stations, type Station } from './world'
import './exploration-journal.css'

export const journalCopy = {
  fr: {
    menu: 'Menu',
    title: 'Carnet d’exploration',
    explorer: 'Explorer',
    intro: 'Six îles, autant de découvertes.',
    voyage: 'Mon voyage',
    companion: 'Un petit compagnon pour une grande aventure.',
    avatar: 'Mon avatar',
    customize: 'Personnaliser',
    language: 'Langue du monde',
    site: 'Site Bible Strong',
    siteHint: 'Prolonger la découverte',
    resume: 'Reprendre l’exploration',
    close: 'Fermer le carnet',
    visited: 'lieux découverts',
    discovered: 'Découvert',
    go: 'Voyager vers',
    travelError: 'Cette île est inaccessible pour le moment.',
    descriptions: [
      'Comprendre les mots',
      'Aux sources du texte',
      'Relier les passages',
      'Explorer par sujet',
      'Croiser les traductions',
      'Éclairer sa lecture',
    ],
  },
  en: {
    menu: 'Menu',
    title: 'Exploration journal',
    explorer: 'Explore',
    intro: 'Six islands, a world of discoveries.',
    voyage: 'My journey',
    companion: 'A little companion for a great adventure.',
    avatar: 'My avatar',
    customize: 'Customize',
    language: 'World language',
    site: 'Bible Strong website',
    siteHint: 'Keep discovering',
    resume: 'Resume exploring',
    close: 'Close journal',
    visited: 'places discovered',
    discovered: 'Discovered',
    go: 'Travel to',
    travelError: 'This island is currently inaccessible.',
    descriptions: [
      'Understand the words',
      'Explore original words',
      'Connect the passages',
      'Explore by topic',
      'Compare translations',
      'Enrich your reading',
    ],
  },
}

export function JournalIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5C8 2 3 3 2 4v15c3-2 7-1 10 1 3-2 7-3 10-1V4c-3-2-7-1-10 1Zm0 0v15M5 7l4 1M5 11l4 1m6-4 4-1m-4 5 4-1" />
    </svg>
  )
}

export function ExplorationJournal({
  language,
  onLanguage,
  profile,
  onAvatar,
  visited,
  onTravel,
  onClose,
  camera,
  status,
  travelError,
}: {
  language: 'fr' | 'en'
  onLanguage: (language: 'fr' | 'en') => void
  profile: AvatarProfile
  onAvatar: () => void
  visited: string[]
  onTravel: (station: Station) => void
  onClose: () => void
  camera: ReactNode
  status: ReactNode
  travelError: boolean
}) {
  const t = journalCopy[language]
  return (
    <Modal
      className="exploration-journal"
      labelledBy="journal-title"
      closeLabel={t.close}
      onClose={onClose}
    >
      <h1 id="journal-title" className="sr-only">
        {t.title}
      </h1>
      <div className="journal-spread">
        <section className="journal-page journal-destinations" aria-labelledby="journal-explorer">
          <div className="journal-eyebrow">
            <JournalIcon /> Bible Strong <span>—</span> World
          </div>
          <h2 id="journal-explorer">
            {t.explorer}
            <span className="journal-star" aria-hidden="true">
              ✧
            </span>
          </h2>
          <p className="journal-intro">{t.intro}</p>
          <nav className="journal-islands" aria-label={t.explorer}>
            {stations.map((station, index) => {
              const discovered = visited.includes(station.id)
              const label = language === 'fr' ? station.name : station.en
              return (
                <button
                  type="button"
                  className="journal-island"
                  key={station.id}
                  onClick={() => onTravel(station)}
                  aria-label={`${t.go} ${label}${discovered ? ` · ${t.discovered}` : ''}`}
                  style={{ '--island-color': station.color } as CSSProperties}
                >
                  <img
                    className="journal-island-art"
                    src={`/assets/journal/${station.id}.png`}
                    alt=""
                    width={160}
                    height={160}
                    draggable={false}
                  />
                  <span className="journal-island-copy">
                    <strong>{label}</strong>
                    <small>{t.descriptions[index]}</small>
                  </span>
                  <span className="journal-island-arrow" aria-hidden="true">
                    ↗
                  </span>
                  {discovered && (
                    <span className="journal-visited" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
          <div className="journal-progress">
            <span aria-hidden="true" className="journal-progress-dots">
              {stations.map(station => (
                <i key={station.id} data-visited={visited.includes(station.id)} />
              ))}
            </span>
            <span>
              {visited.length} / {stations.length} {t.visited}
            </span>
          </div>
          {travelError && (
            <p className="journal-error" role="alert">
              {t.travelError}
            </p>
          )}
        </section>
        <section className="journal-page journal-personal" aria-labelledby="journal-voyage">
          <span className="journal-bookmark" aria-hidden="true" />
          <div className="journal-eyebrow">{t.title}</div>
          <h2 id="journal-voyage">{t.voyage}</h2>
          <p className="journal-intro">{t.companion}</p>
          <button className="journal-avatar" onClick={onAvatar} aria-haspopup="dialog">
            <span className="journal-avatar-portrait">
              <AvatarPreview color={profile.color} avatar={profile.avatar} />
            </span>
            <span>
              <small>{t.avatar}</small>
              <strong>{profile.name || profileCopy[language].guest}</strong>
              <span className="journal-text-link">
                {t.customize} <span aria-hidden="true">↗</span>
              </span>
            </span>
          </button>
          <div className="journal-language" role="group" aria-label={t.language}>
            <span>{t.language}</span>
            <div>
              {(['fr', 'en'] as const).map(lang => (
                <button
                  key={lang}
                  lang={lang}
                  aria-label={lang === 'fr' ? 'Français' : 'English'}
                  aria-pressed={language === lang}
                  onClick={() => onLanguage(lang)}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <a
            className="journal-site"
            href="https://bible-strong.app/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <JournalIcon />
            <span>
              <strong>{t.site}</strong>
              <small>{t.siteHint}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </a>
          <div className="journal-camera">{camera}</div>
          <div className="journal-status">{status}</div>
        </section>
      </div>
      <footer className="journal-footer">
        <span aria-hidden="true" className="journal-footer-ornament">
          ✧ ───
        </span>
        <button className="journal-resume" onClick={onClose}>
          <span aria-hidden="true">▷</span>
          {t.resume}
        </button>
        <span aria-hidden="true" className="journal-footer-ornament">
          ─── ✧
        </span>
      </footer>
    </Modal>
  )
}
