import { useRef } from 'react'
import { flushSync } from 'react-dom'

export type ThemePreference = 'auto' | 'light' | 'dark'
export const themePreferences: ThemePreference[] = ['auto', 'light', 'dark']
// One preference for the whole site: the landing page reads it on the server, cached pages in the browser.
export const themeCookieName = 'bible-strong-landing-theme'
const themeTransitionDurationMs = 500

export const isThemePreference = (value: string | undefined): value is ThemePreference =>
  value === 'auto' || value === 'light' || value === 'dark'

export const persistThemePreference = (theme: ThemePreference) => {
  document.cookie = `${themeCookieName}=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax`
}

type NativeViewTransition = {
  ready: Promise<void>
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => NativeViewTransition
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === 'light')
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
    )
  if (theme === 'dark')
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20.2 15.2A8.7 8.7 0 0 1 8.8 3.8 8.7 8.7 0 1 0 20.2 15.2Z" />
      </svg>
    )
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="13" rx="2.5" />
      <path d="M8.5 21h7M12 17v4" />
    </svg>
  )
}

export function ThemeToggle({
  value,
  onChange,
  labels,
  label,
}: {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
  labels: Record<ThemePreference, string>
  label: string
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isTransitioningRef = useRef(false)
  const nextTheme =
    themePreferences[(themePreferences.indexOf(value) + 1) % themePreferences.length]
  const accessibleLabel = `${label} : ${labels[value]}`

  const changeThemeWithReveal = () => {
    const button = buttonRef.current
    const transitionDocument = document as ViewTransitionDocument
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!button || !transitionDocument.startViewTransition || prefersReducedMotion) {
      onChange(nextTheme)
      return
    }

    if (isTransitioningRef.current) return

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const buttonRect = button.getBoundingClientRect()
    const originX = buttonRect.left + buttonRect.width / 2
    const originY = buttonRect.top + buttonRect.height / 2
    const radius = Math.hypot(
      Math.max(originX, viewportWidth - originX),
      Math.max(originY, viewportHeight - originY)
    )
    const originXPercent = (originX / viewportWidth) * 100
    const originYPercent = (originY / viewportHeight) * 100
    const radiusPercent = (radius / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100
    const clipPath = [
      `circle(0% at ${originXPercent}% ${originYPercent}%)`,
      `circle(${radiusPercent}% at ${originXPercent}% ${originYPercent}%)`,
    ]
    const documentRoot = document.documentElement
    const cleanup = () => {
      isTransitioningRef.current = false
      delete documentRoot.dataset.themeTransition
      documentRoot.style.removeProperty('--landing-theme-transition-clip-from')
    }

    isTransitioningRef.current = true
    documentRoot.dataset.themeTransition = 'active'
    documentRoot.style.setProperty('--landing-theme-transition-clip-from', clipPath[0])

    const transition = transitionDocument.startViewTransition(() => {
      flushSync(() => onChange(nextTheme))
    })

    transition.ready
      .then(() => {
        documentRoot.animate(
          { clipPath },
          {
            duration: themeTransitionDurationMs,
            easing: 'ease-in-out',
            fill: 'forwards',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      })
      .catch(cleanup)

    transition.finished.finally(cleanup).catch(cleanup)
  }

  return (
    <button
      ref={buttonRef}
      className="theme-toggle"
      type="button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      data-theme-value={value}
      onClick={changeThemeWithReveal}
    >
      <ThemeIcon theme={value} />
    </button>
  )
}

export function LanguageMark({ locale }: { locale: string }) {
  return (
    <span className="language-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3C9.8 5.5 8.7 8.5 8.7 12S9.8 18.5 12 21" />
      </svg>
      <span>{locale.toUpperCase()}</span>
    </span>
  )
}
