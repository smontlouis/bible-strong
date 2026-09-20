import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import './lexicon-discovery.css'

type DiscoveryCopy = {
  label: string
  close: string
  previous: string
  next: string
  finish: string
  progress: string
  titles: string[]
  descriptions: string[]
}

export function DiscoveryDialog({
  copy: t,
  icon,
  className = '',
  onClose,
  onNavigate,
  children,
  media,
}: {
  copy: DiscoveryCopy
  icon: ReactNode
  className?: string
  onClose: () => void
  onNavigate?: () => void
  children: (slide: number) => ReactNode
  media?: ReactNode
}) {
  const headingId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number } | null>(null)
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const previous = document.activeElement
    const modal = dialog.current!
    modal.showModal()
    return () => {
      modal.close()
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  function navigate(next: number) {
    if (next < 0 || next >= t.titles.length) return
    onNavigate?.()
    setSlide(next)
    content.current?.scrollTo({ top: 0 })
  }
  return (
    <dialog
      ref={dialog}
      className={`lexicon-dialog ${className}`}
      aria-labelledby={headingId}
      onCancel={onClose}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={event => {
        if (event.target instanceof HTMLAudioElement) return
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          navigate(slide + (event.key === 'ArrowRight' ? 1 : -1))
        }
      }}
    >
      <div className="lexicon-shell">
        <header className="lexicon-header">
          <span>
            <span aria-hidden="true">{icon}</span> {t.label}
          </span>
          <button className="lexicon-close" onClick={onClose} aria-label={t.close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div
          ref={content}
          className="lexicon-content"
          onTouchStart={event => {
            const touch = event.touches[0]
            gesture.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchCancel={() => {
            gesture.current = null
          }}
          onTouchEnd={event => {
            const start = gesture.current
            gesture.current = null
            if (!start) return
            const touch = event.changedTouches[0]
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
              navigate(slide + (dx < 0 ? 1 : -1))
          }}
        >
          <section key={slide} className="lexicon-slide" aria-label={`${slide + 1} / 3`}>
            <div className="lexicon-heading">
              <span className="lexicon-step">0{slide + 1} / 03</span>
              <h1 id={headingId}>{t.titles[slide]}</h1>
              <p>{t.descriptions[slide]}</p>
            </div>
            {children(slide)}
          </section>
        </div>
        <footer className="lexicon-footer">
          <div className="lexicon-navigation">
            <button
              className="lexicon-back"
              disabled={slide === 0}
              onClick={() => navigate(slide - 1)}
              aria-label={t.previous}
            >
              ←
            </button>
            <nav aria-label={t.progress}>
              {t.titles.map((title, index) => (
                <button
                  key={title}
                  aria-label={`${index + 1}. ${title}`}
                  aria-current={slide === index ? 'step' : undefined}
                  onClick={() => navigate(index)}
                />
              ))}
            </nav>
            <span aria-live="polite">{slide + 1} / 3</span>
          </div>
          <button
            className="lexicon-next"
            onClick={() => (slide === 2 ? onClose() : navigate(slide + 1))}
          >
            {slide === 2 ? t.finish : t.next}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
      {media}
    </dialog>
  )
}
