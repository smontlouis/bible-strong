import { Modal } from './Modal'
import { useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react'
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
  const content = useRef<HTMLDivElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const gesture = useRef<{ x: number; y: number } | null>(null)
  const [slide, setSlide] = useState(0)
  useLayoutEffect(() => {
    content.current?.scrollTo({ top: 0 })
  }, [slide])
  function navigate(next: number) {
    if (next < 0 || next >= t.titles.length) return
    // Keep keyboard focus inside the dialog when a slide removes its focused control.
    if (content.current?.contains(document.activeElement)) nextButton.current?.focus()
    onNavigate?.()
    setSlide(next)
  }
  return (
    <Modal
      className={`lexicon-dialog ${className}`}
      labelledBy={headingId}
      closeLabel={t.close}
      onClose={onClose}
      onKeyDown={event => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, select, audio, [role=tablist]')
        )
          return
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
        </header>
        <div
          ref={content}
          className="lexicon-content"
          onTouchStart={event => {
            if (event.touches.length !== 1) {
              gesture.current = null
              return
            }
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
          <section
            key={slide}
            className="lexicon-slide"
            aria-label={`${slide + 1} / ${t.titles.length}`}
          >
            <div className="lexicon-heading">
              <span className="lexicon-step">
                {String(slide + 1).padStart(2, '0')} / {String(t.titles.length).padStart(2, '0')}
              </span>
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
            <span aria-live="polite">
              {slide + 1} / {t.titles.length}
            </span>
          </div>
          <button
            ref={nextButton}
            className="lexicon-next"
            onClick={() => (slide === t.titles.length - 1 ? onClose() : navigate(slide + 1))}
          >
            {slide === t.titles.length - 1 ? t.finish : t.next}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
      {media}
    </Modal>
  )
}
