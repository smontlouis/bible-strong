import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { JournalIcon } from './ExplorationJournal'
import { storyCopy } from './story-copy'
import './story.css'

export function StoryDialog({
  language,
  onClose,
  onBoard,
}: {
  language: 'fr' | 'en'
  onClose: () => void
  onBoard: () => void
}) {
  const t = storyCopy[language]
  const content = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState('welcome')

  function jump(id: string) {
    const root = content.current!
    const section = root.querySelector<HTMLElement>(`#story-${id}`)!
    root.scrollTo({
      top: section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    })
    section.focus({ preventScroll: true })
  }

  function updateChapter() {
    const root = content.current!
    const top = root.getBoundingClientRect().top
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.story-section'))
    const current = sections
      .filter(section => section.getBoundingClientRect().top <= top + 130)
      .at(-1)
    const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 4
    setActive(atEnd ? 'support' : (current?.id.replace('story-', '') ?? 'welcome'))
  }

  useEffect(() => {
    const observer = new ResizeObserver(updateChapter)
    observer.observe(content.current!)
    return () => observer.disconnect()
  }, [])

  return (
    <Modal className="story-dialog" labelledBy="story-title" closeLabel={t.close} onClose={onClose}>
      <aside className="story-sidebar">
        <div className="story-brand">
          <JournalIcon />
          <div>
            <strong>Bible Strong World</strong>
            <small>{t.tagline}</small>
          </div>
        </div>
        <nav className="story-nav" aria-label={t.navigation}>
          {t.chapters.map((chapter, index) => (
            <a
              key={chapter.id}
              href={`#story-${chapter.id}`}
              aria-current={active === chapter.id ? 'location' : undefined}
              onClick={event => {
                event.preventDefault()
                jump(chapter.id)
              }}
            >
              <span className="story-number">{index + 1}</span>
              <span>{chapter.label}</span>
            </a>
          ))}
        </nav>
        <p className="story-sidebar-note">
          {t.motto}
          <span>{language === 'fr' ? 'Depuis 2019' : 'Since 2019'} · Open source</span>
        </p>
      </aside>
      <div className="story-content" ref={content} onScroll={updateChapter}>
        {t.chapters.map((chapter, index) => (
          <section
            className={`story-section story-section-${chapter.id}`}
            id={`story-${chapter.id}`}
            key={chapter.id}
            tabIndex={-1}
            aria-labelledby={index === 0 ? 'story-title' : `story-heading-${chapter.id}`}
          >
            <span className="story-eyebrow">
              {String(index + 1).padStart(2, '0')} / 06 · {chapter.label}
            </span>
            {index === 0 ? (
              <h1 id="story-title">{t.title}</h1>
            ) : (
              <h2 id={`story-heading-${chapter.id}`}>{chapter.title}</h2>
            )}
            <div className="story-rule" />
            {chapter.paragraphs.map(paragraph => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {chapter.id === 'welcome' && (
              <>
                <p className="story-motto">{t.motto}</p>
                <div className="story-actions">
                  <button className="story-primary" onClick={() => jump('about')}>
                    {t.discover} <span aria-hidden="true">→</span>
                  </button>
                  <button className="story-link" onClick={() => jump('support')}>
                    {t.support}
                  </button>
                </div>
              </>
            )}
            {chapter.id === 'about' && (
              <figure className="story-portrait">
                <div className="story-photo-placeholder" role="img" aria-label={t.photo}>
                  <svg
                    viewBox="0 0 80 80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="40" cy="28" r="13" />
                    <path d="M15 70v-7a25 25 0 0 1 50 0v7" />
                  </svg>
                  <span>{t.photo}</span>
                </div>
                <figcaption>
                  <strong>Stéphane</strong>
                  <span>{t.photoHint}</span>
                  <small>Haute-Savoie, France</small>
                </figcaption>
              </figure>
            )}
            {chapter.id === 'study' && (
              <div className="story-actions">
                <a
                  className="story-primary"
                  href="https://bible-strong.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.app} ↗
                </a>
                <a
                  className="story-link"
                  href="https://github.com/smontlouis/bible-strong"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.code} ↗
                </a>
              </div>
            )}
            {chapter.id === 'together' && (
              <div className="story-actions">
                <a className="story-primary" href="mailto:stephane@lestudio316.com">
                  {t.contact} ↗
                </a>
              </div>
            )}
            {chapter.id === 'support' && (
              <div className="story-actions">
                <a
                  className="story-primary"
                  href="https://bible-strong.app/give"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.donate} ↗
                </a>
                <button className="story-link" onClick={onBoard}>
                  {t.note}
                </button>
              </div>
            )}
          </section>
        ))}
        <footer className="story-signature">{t.signature}</footer>
      </div>
    </Modal>
  )
}
