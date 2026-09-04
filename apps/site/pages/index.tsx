import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useCurrentLocale, useI18n } from '../locales'
import LandingBibleViewerDemo from '../components/LandingBibleViewerDemo'
import { TextReveal } from '../components/ui/text-reveal'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const appStoreUrl = 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
const playStoreUrl =
  'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1'
export type ThemePreference = 'auto' | 'light' | 'dark'
const themePreferences: ThemePreference[] = ['auto', 'light', 'dark']
const themeCookieName = 'bible-strong-landing-theme'
const themeTransitionDurationMs = 500

type NativeViewTransition = {
  ready: Promise<void>
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => NativeViewTransition
}

/**
 * Tous les réglages du carrousel « Chaque question ouvre un univers ».
 * Les distances de reveal sont exprimées en pourcentage de la largeur du viewport :
 * 100 = bord droit, 50 = centre de l'écran.
 */
const WORLDS_CAROUSEL_CONFIG = {
  scroll: {
    minimumDistancePx: 1,
    // > 1 ralentit la traversée ; < 1 la raccourcit.
    distanceMultiplier: 1,
    // Plus la valeur est haute, plus le mouvement suit le scroll avec souplesse.
    scrub: 0.7,
    anticipatePin: 1,
  },
  cards: {
    // 0 anime aussi la première carte ; 1 la laisse immédiatement visible.
    animateFromIndex: 1,
    // État d'entrée des cartes avant leur arrivée dans la zone de reveal.
    minimumScale: 0.76,
    minimumOpacity: 0.45,
    entryOffsetYPx: 50,
    // 100 = bord droit du viewport ; 50 = centre du viewport.
    resizeStartsAtViewportPercent: 92,
    resizeEndsAtViewportPercent: 60,
    scrub: true,
    ease: 'none',
  },
  progress: {
    smoothingDuration: 0.42,
    ease: 'power2.out',
    maxWidthPx: 500,
    viewportWidthPercent: 48,
    heightPx: 7,
    marginTopPx: 90,
  },
  layout: {
    gapPx: 22,
    cardMaxWidthPx: 620,
    cardViewportWidthPercent: 43,
    trackSidePaddingMinPx: 24,
    contentMaxWidthPx: 1180,
  },
} as const

const worldsCarouselStyle = {
  '--worlds-gap': `${WORLDS_CAROUSEL_CONFIG.layout.gapPx}px`,
  '--worlds-card-max-width': `${WORLDS_CAROUSEL_CONFIG.layout.cardMaxWidthPx}px`,
  '--worlds-card-vw': `${WORLDS_CAROUSEL_CONFIG.layout.cardViewportWidthPercent}vw`,
  '--worlds-track-padding-min': `${WORLDS_CAROUSEL_CONFIG.layout.trackSidePaddingMinPx}px`,
  '--worlds-content-max-width': `${WORLDS_CAROUSEL_CONFIG.layout.contentMaxWidthPx}px`,
  '--worlds-progress-max-width': `${WORLDS_CAROUSEL_CONFIG.progress.maxWidthPx}px`,
  '--worlds-progress-vw': `${WORLDS_CAROUSEL_CONFIG.progress.viewportWidthPercent}vw`,
  '--worlds-progress-height': `${WORLDS_CAROUSEL_CONFIG.progress.heightPx}px`,
  '--worlds-progress-margin-top': `${WORLDS_CAROUSEL_CONFIG.progress.marginTopPx}px`,
} as CSSProperties

export type HomeProps = {
  initialTheme: ThemePreference
}

function StoreLink({ href, kicker, label }: { href: string; kicker: string; label: string }) {
  return (
    <a className="store-link" href={href} target="_blank" rel="noreferrer">
      <span>{kicker}</span>
      <strong>{label}</strong>
    </a>
  )
}

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`landing-reveal ${className}`}>{children}</div>
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

function ThemeToggle({
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

function LanguageMark({ locale }: { locale: string }) {
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

function LandingHeader({
  locale,
  homePath,
  supportPath,
  alternatePath,
  theme,
  onThemeChange,
  t,
}: {
  locale: string
  homePath: string
  supportPath: string
  alternatePath: string
  theme: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
  t: ReturnType<typeof useI18n>
}) {
  return (
    <header className="landing-nav-wrap">
      <nav className="landing-nav" aria-label={t('home.nav.label')}>
        <a className="brand" href={homePath} aria-label="Bible Strong">
          <img src="/images/icon.png" alt="" width="44" height="44" />
          <span>Bible Strong</span>
        </a>
        <div className="landing-nav__links">
          <a href="#parcours">{t('home.nav.journey')}</a>
          <a href="#univers">{t('home.nav.tools')}</a>
          <a className="support-link" href={supportPath}>
            {t('support')}
            <svg aria-hidden="true" viewBox="0 0 16 16">
              <path d="M5 11 11 5M6 5h5v5" />
            </svg>
          </a>
        </div>
        <div className="landing-nav__actions">
          <a className="button button--compact" href="#telecharger">
            {t('home.cta.download')}
          </a>
          <ThemeToggle
            value={theme}
            onChange={onThemeChange}
            label={t('home.theme.label')}
            labels={{
              auto: t('home.theme.auto'),
              light: t('home.theme.light'),
              dark: t('home.theme.dark'),
            }}
          />
          <a
            className="language-link"
            href={alternatePath}
            lang={locale === 'fr' ? 'en' : 'fr'}
            aria-label={t('home.language.switch')}
            title={t('home.language.switch')}
          >
            <LanguageMark locale={locale} />
          </a>
        </div>
      </nav>
    </header>
  )
}

type AnnotationType = 'background' | 'circle' | 'underline'

const annotationColors = ['#81ecec', '#ff7675', '#fdcb6e', '#74b9ff', '#95afc0']
const annotationTypes: AnnotationType[] = ['background', 'circle', 'underline']

function AnnotationTypeIcon({ type }: { type: AnnotationType }) {
  if (type === 'circle') {
    return (
      <svg aria-hidden="true" viewBox="0 0 32 24">
        <ellipse cx="16" cy="12" rx="12" ry="8" />
        <ellipse className="annotation-tool-icon__echo" cx="16" cy="12" rx="11" ry="9" />
      </svg>
    )
  }

  return <span className={`annotation-tool-icon annotation-tool-icon--${type}`}>A</span>
}

function MarkerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32">
      <path d="m21.8 4.8 5.4 5.4-12.7 12.7-6.8 1.4 1.4-6.8L21.8 4.8Z" />
      <path d="m7.7 24.3-2.9 2.9h8.5" />
      <path className="marker-icon__shine" d="m18.8 7.8 5.4 5.4" />
    </svg>
  )
}

function VerseAnnotation({
  type,
  color,
  revision,
  children,
}: {
  type: AnnotationType
  color: string
  revision: number
  children: React.ReactNode
}) {
  const style = { '--annotation-color': color } as CSSProperties

  return (
    <span
      key={`${type}-${color}-${revision}`}
      className={`verse-annotation verse-annotation--${type}`}
      style={style}
    >
      <span className="verse-annotation__text">{children}</span>
      {type === 'circle' ? (
        <svg
          className="verse-annotation__circle"
          aria-hidden="true"
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
        >
          <ellipse cx="50" cy="24" rx="47" ry="19" pathLength="1" />
          <ellipse
            className="verse-annotation__circle-echo"
            cx="50"
            cy="24"
            rx="45"
            ry="21"
            pathLength="1"
          />
        </svg>
      ) : (
        <span className="verse-annotation__stroke" aria-hidden="true" />
      )}
    </span>
  )
}

function HighlightDemo({
  activeType,
  activeColor,
  onTypeChange,
  onColorSelect,
  labels,
  toolGroupLabel,
  colorGroupLabel,
}: {
  activeType: AnnotationType
  activeColor: string
  onTypeChange: (type: AnnotationType) => void
  onColorSelect: (color: string) => void
  labels: Record<AnnotationType, string>
  toolGroupLabel: string
  colorGroupLabel: string
}) {
  return (
    <div className="journey-demo journey-demo--highlight">
      <div className="annotation-tools" role="group" aria-label={toolGroupLabel}>
        {annotationTypes.map(type => (
          <button
            className={`annotation-tool ${activeType === type ? 'is-active' : ''}`}
            key={type}
            type="button"
            aria-label={labels[type]}
            aria-pressed={activeType === type}
            onClick={() => onTypeChange(type)}
          >
            <AnnotationTypeIcon type={type} />
            <span>{labels[type]}</span>
          </button>
        ))}
      </div>
      <div className="annotation-palette" role="group" aria-label={colorGroupLabel}>
        {annotationColors.map(color => (
          <button
            className={`annotation-color ${activeColor === color ? 'is-active' : ''}`}
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={activeColor === color}
            style={{ '--swatch-color': color } as CSSProperties}
            onClick={() => onColorSelect(color)}
          />
        ))}
        <span className="annotation-marker-icon">
          <MarkerIcon />
        </span>
      </div>
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
      <path d="M15 9.5a4 4 0 0 1 0 5M17.5 7a7.2 7.2 0 0 1 0 10" />
    </svg>
  )
}

type StrongDemoCard = {
  code: string
  transliteration: string
  title: string
  definition: string
  type: string
}

function StrongCardsDemo({
  cards,
  label,
  listen,
}: {
  cards: [StrongDemoCard, StrongDemoCard]
  label: string
  listen: string
}) {
  return (
    <div className="journey-demo journey-demo--strong-cards">
      {cards.map(card => (
        <article className="demo-strong-card" key={card.code}>
          <div className="demo-strong-card__top">
            <span>{label}</span>
            <button type="button" aria-label={listen}>
              <SpeakerIcon />
            </button>
          </div>
          <div className="demo-strong-card__word">
            <strong lang="he" dir="rtl">
              הֶבֶל
            </strong>
            <em>{card.transliteration}</em>
          </div>
          <div className="demo-strong-card__rule" />
          <div className="demo-strong-card__entry">
            <span>H{card.code}</span>
            <strong>{card.title}</strong>
          </div>
          <p>{card.definition}</p>
          <small>{card.type}</small>
        </article>
      ))}
    </div>
  )
}

type ConcordanceItem = {
  label: string
  reference: string
  before: string
  highlight: string
  after: string
}

function ConcordanceDemo({
  items,
  details,
  count,
}: {
  items: [ConcordanceItem, ConcordanceItem, ConcordanceItem]
  details: string
  count: string
}) {
  return (
    <div className="journey-demo journey-demo--concordance" aria-hidden="true">
      <div className="demo-concordance-lemma">
        <span lang="he" dir="rtl">
          הֶבֶל
        </span>
        <div>
          <strong>hevel</strong>
          <small>{details}</small>
        </div>
        <b>{count}</b>
      </div>
      <div className="demo-filters">
        {items.map((item, index) =>
          index === 0 ? (
            <strong key={item.label}>{item.label}</strong>
          ) : (
            <span key={item.label}>{item.label}</span>
          )
        )}
      </div>
      <div className="demo-occurrence-grid">
        {items.map(item => (
          <article className="demo-occurrence" key={item.label}>
            <b>{item.reference}</b>
            <p>
              {item.before}
              <mark>{item.highlight}</mark>
              {item.after}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}

function ReasoningDemo({
  noteLabel,
  noteText,
  relations,
  genesisLabel,
  genesisTitle,
  genesisChip,
  abelMeta,
  hevelMeta,
}: {
  noteLabel: string
  noteText: string
  relations: string
  genesisLabel: string
  genesisTitle: string
  genesisChip: string
  abelMeta: string
  hevelMeta: string
}) {
  return (
    <div className="journey-demo journey-demo--reasoning">
      <div className="demo-note-orbit" aria-hidden="true" />
      <article className="demo-source-card demo-source-card--verse">
        <b>{genesisLabel}</b>
        <p>{genesisTitle}</p>
        <small>LOUIS SEGOND 1910</small>
      </article>
      <article className="demo-source-card demo-source-card--abel">
        <b>H1893</b>
        <strong>Abel</strong>
        <small>{abelMeta}</small>
      </article>
      <article className="demo-source-card demo-source-card--hevel">
        <b>H1892</b>
        <strong>hevel</strong>
        <small>{hevelMeta}</small>
      </article>
      <article className="demo-note-card">
        <div className="demo-note-card__head">
          <span>▧&nbsp; {noteLabel}</span>
          <b>✦</b>
        </div>
        <p className="demo-note-card__text" aria-label={noteText}>
          <span aria-hidden="true" data-note-text={noteText}>
            {noteText}
          </span>
        </p>
        <i />
        <small>⌁&nbsp; {relations}</small>
        <div className="demo-note-card__chips">
          <span>{genesisChip}</span>
          <span>H1893</span>
          <span>H1892</span>
        </div>
      </article>
      <div className="demo-note-tag" aria-hidden="true">
        ◇
      </div>
    </div>
  )
}

export default function Home({ initialTheme }: HomeProps) {
  const rootRef = useRef<HTMLElement>(null)
  const [theme, setTheme] = useState<ThemePreference>(initialTheme)
  const [annotationTool, setAnnotationTool] = useState<AnnotationType>('background')
  const [annotation, setAnnotation] = useState({
    type: 'background' as AnnotationType,
    color: '#fdcb6e',
    revision: 0,
  })
  const t = useI18n()
  const locale = useCurrentLocale()
  const homePath = locale === 'fr' ? '/fr/' : '/'
  const supportPath = locale === 'fr' ? '/fr/give' : '/give'
  const alternatePath = locale === 'fr' ? '/' : '/fr/'
  const changeTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme)
    document.cookie = `${themeCookieName}=${encodeURIComponent(nextTheme)}; Path=/; Max-Age=31536000; SameSite=Lax`
  }

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      duration: 1.2,
      wheelMultiplier: 1,
      smoothWheel: true,
      anchors: { offset: -72 },
      prevent: node => Boolean(node.closest('.mini-bible')),
      respectReducedMotion: true,
    })
    const navigation = document.querySelector<HTMLElement>('.landing-nav-wrap')
    let previousScroll = 0
    const updateScrollTrigger = (instance: Lenis) => {
      ScrollTrigger.update()

      if (!navigation) return
      const currentScroll = instance.animatedScroll
      const movement = currentScroll - previousScroll

      if (currentScroll <= 32 || movement < -0.5) navigation.classList.remove('is-hidden')
      else if (currentScroll > 96 && movement > 0.5) navigation.classList.add('is-hidden')

      previousScroll = currentScroll
    }
    const updateLenis = (time: number) => lenis.raf(time * 1000)

    lenis.on('scroll', updateScrollTrigger)
    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.off('scroll', updateScrollTrigger)
      gsap.ticker.remove(updateLenis)
      navigation?.classList.remove('is-hidden')
      lenis.destroy()
    }
  }, [])

  const worlds = [
    {
      tone: 'blue',
      image: '/images/landing/lexicon-universe.webp',
      title: t('home.worlds.lexicon.title'),
      body: t('home.worlds.lexicon.body'),
      alt: t('home.worlds.lexicon.alt'),
    },
    {
      tone: 'violet',
      image: '/images/landing/comparisons-universe.webp',
      title: t('home.worlds.compare.title'),
      body: t('home.worlds.compare.body'),
      alt: t('home.worlds.compare.alt'),
    },
    {
      tone: 'amber',
      image: '/images/landing/dictionary-universe-v3.webp',
      title: t('home.worlds.dictionary.title'),
      body: t('home.worlds.dictionary.body'),
      alt: t('home.worlds.dictionary.alt'),
    },
    {
      tone: 'coral',
      image: '/images/landing/references-universe.webp',
      title: t('home.worlds.references.title'),
      body: t('home.worlds.references.body'),
      alt: t('home.worlds.references.alt'),
    },
    {
      tone: 'sky',
      image: '/images/landing/themes-universe-v2.webp',
      title: t('home.worlds.themes.title'),
      body: t('home.worlds.themes.body'),
      alt: t('home.worlds.themes.alt'),
    },
    {
      tone: 'mint',
      image: '/images/landing/commentaries-universe-v3.webp',
      title: t('home.worlds.commentaries.title'),
      body: t('home.worlds.commentaries.body'),
      alt: t('home.worlds.commentaries.alt'),
    },
  ]

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add(
        {
          desktop: '(min-width: 901px)',
          motion: '(prefers-reduced-motion: no-preference)',
        },
        context => {
          const { desktop, motion } = context.conditions as { desktop: boolean; motion: boolean }

          if (!motion) return

          gsap
            .timeline({
              scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: 'bottom top',
                scrub: 0.7,
              },
            })
            .to('.hero-phone', { y: 90, rotation: -2, ease: 'none' }, 0)
            .to('.hero-orbit--dictionary', { x: -30, y: 70, rotation: -16, ease: 'none' }, 0)
            .to('.hero-orbit--themes', { x: 34, y: -30, rotation: 12, ease: 'none' }, 0)
            .to('.hero-orbit--references', { x: -18, y: -55, rotation: -12, ease: 'none' }, 0)

          if (desktop) {
            const journeySteps = gsap.utils.toArray<HTMLElement>('.journey-path li')
            const journeyDemos = journeySteps.flatMap(step => {
              const demo = step.querySelector<HTMLElement>('.journey-demo')
              return demo ? [demo] : []
            })
            const journeyDistance = 2100
            let activeJourneyStep = 0
            let noteTypingTween: gsap.core.Tween | null = null

            const resetNoteTyping = (step: HTMLElement, animate: boolean) => {
              const noteText = step.querySelector<HTMLElement>('[data-note-text]')
              const fullText = noteText?.dataset.noteText
              if (!noteText || !fullText) return

              noteTypingTween?.kill()
              noteText.textContent = animate ? '' : fullText
              noteText.classList.toggle('is-typing', animate)
              if (!animate) return

              const typing = { characters: 0 }
              noteTypingTween = gsap.to(typing, {
                characters: fullText.length,
                duration: 2.4,
                delay: 0.18,
                ease: 'none',
                snap: { characters: 1 },
                onUpdate: () => {
                  noteText.textContent = fullText.slice(0, typing.characters)
                },
                onComplete: () => {
                  noteText.textContent = fullText
                  noteText.classList.remove('is-typing')
                },
              })
            }

            gsap.set(journeySteps[0], { autoAlpha: 1, y: 0 })
            gsap.set(journeySteps.slice(1), { autoAlpha: 0, y: 44 })

            const journeyPin = ScrollTrigger.create({
              trigger: '.journey-section',
              start: 'top top',
              end: `+=${journeyDistance}`,
              pin: true,
              anticipatePin: 1,
            })

            const activateJourneyStep = (nextIndex: number) => {
              if (nextIndex === activeJourneyStep) return

              const direction = nextIndex > activeJourneyStep ? 1 : -1
              const currentStep = journeySteps[activeJourneyStep]
              const nextStep = journeySteps[nextIndex]
              const nextDemo = nextStep.querySelector<HTMLElement>('.journey-demo')

              gsap.killTweensOf([...journeySteps, ...journeyDemos])
              gsap.killTweensOf('.journey-verse')
              journeySteps.forEach((step, index) => {
                if (index !== activeJourneyStep && index !== nextIndex) {
                  gsap.set(step, { autoAlpha: 0, y: direction > 0 ? 44 : -24 })
                }
              })

              const transition = gsap
                .timeline({ defaults: { overwrite: 'auto' } })
                .to(currentStep, {
                  autoAlpha: 0,
                  y: direction > 0 ? -24 : 44,
                  duration: 0.22,
                  ease: 'power1.in',
                })
                .fromTo(
                  nextStep,
                  { autoAlpha: 0, y: direction > 0 ? 44 : -24 },
                  { autoAlpha: 1, y: 0, duration: 0.48, ease: 'power3.out' },
                  '>-0.02'
                )

              if (nextDemo) {
                transition.fromTo(
                  nextDemo,
                  { y: direction > 0 ? 24 : -18, scale: 0.97 },
                  { y: 0, scale: 1, duration: 0.46, ease: 'power2.out' },
                  '<0.06'
                )
              }

              if (activeJourneyStep === 3) resetNoteTyping(currentStep, false)
              if (nextIndex === 3)
                transition.call(() => resetNoteTyping(nextStep, true), [], '<0.16')

              transition.to(
                '.journey-verse',
                { rotation: nextIndex % 2 === 0 ? -1.2 : 0.5, duration: 0.5, ease: 'power1.inOut' },
                '<'
              )

              activeJourneyStep = nextIndex
            }

            journeySteps.slice(1).forEach((_, index) => {
              ScrollTrigger.create({
                trigger: '.journey-section',
                start: () =>
                  journeyPin.start + ((index + 1) * journeyDistance) / journeySteps.length,
                end: () => journeyPin.end,
                onEnter: () => activateJourneyStep(index + 1),
                onLeaveBack: () => activateJourneyStep(index),
              })
            })

            const track = rootRef.current?.querySelector<HTMLElement>('.worlds-track')
            const worldsSection = rootRef.current?.querySelector<HTMLElement>('.worlds-section')
            const progress = rootRef.current?.querySelector<HTMLElement>('.worlds-progress span')

            if (track && worldsSection && progress) {
              const distance = () =>
                Math.max(
                  WORLDS_CAROUSEL_CONFIG.scroll.minimumDistancePx,
                  track.scrollWidth - window.innerWidth
                )
              gsap.set(progress, { scaleX: 0, transformOrigin: 'left center' })
              const updateProgress = gsap.quickTo(progress, 'scaleX', {
                duration: WORLDS_CAROUSEL_CONFIG.progress.smoothingDuration,
                ease: WORLDS_CAROUSEL_CONFIG.progress.ease,
              })
              const horizontalTimeline = gsap.to(track, {
                x: () => -distance(),
                ease: 'none',
                scrollTrigger: {
                  trigger: worldsSection,
                  start: 'top top',
                  end: () => `+=${distance() * WORLDS_CAROUSEL_CONFIG.scroll.distanceMultiplier}`,
                  pin: true,
                  scrub: WORLDS_CAROUSEL_CONFIG.scroll.scrub,
                  anticipatePin: WORLDS_CAROUSEL_CONFIG.scroll.anticipatePin,
                  invalidateOnRefresh: true,
                  onUpdate: self => updateProgress(self.progress),
                  onRefresh: self => gsap.set(progress, { scaleX: self.progress }),
                },
              })

              gsap.utils
                .toArray<HTMLElement>('.world-card')
                .slice(WORLDS_CAROUSEL_CONFIG.cards.animateFromIndex)
                .forEach(card => {
                  gsap.fromTo(
                    card,
                    {
                      autoAlpha: WORLDS_CAROUSEL_CONFIG.cards.minimumOpacity,
                      scale: WORLDS_CAROUSEL_CONFIG.cards.minimumScale,
                      y: WORLDS_CAROUSEL_CONFIG.cards.entryOffsetYPx,
                    },
                    {
                      autoAlpha: 1,
                      scale: 1,
                      y: 0,
                      ease: WORLDS_CAROUSEL_CONFIG.cards.ease,
                      scrollTrigger: {
                        trigger: card,
                        containerAnimation: horizontalTimeline,
                        start: `left ${WORLDS_CAROUSEL_CONFIG.cards.resizeStartsAtViewportPercent}%`,
                        end: `center ${WORLDS_CAROUSEL_CONFIG.cards.resizeEndsAtViewportPercent}%`,
                        scrub: WORLDS_CAROUSEL_CONFIG.cards.scrub,
                      },
                    }
                  )
                })
            }
          } else {
            ScrollTrigger.batch('.world-card', {
              start: 'top 86%',
              once: true,
              onEnter: cards =>
                gsap.fromTo(
                  cards,
                  { autoAlpha: 0, x: 38 },
                  { autoAlpha: 1, x: 0, duration: 0.75, stagger: 0.1, ease: 'power3.out' }
                ),
            })
          }

          gsap.fromTo(
            '.relations-visual',
            { autoAlpha: 0, scale: 0.86, rotation: -3 },
            {
              autoAlpha: 1,
              scale: 1,
              rotation: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: '.relations-section',
                start: 'top 88%',
                end: 'center 55%',
                scrub: 0.6,
              },
            }
          )

          gsap.fromTo(
            '.relations-copy li',
            { autoAlpha: 0, x: 35 },
            {
              autoAlpha: 1,
              x: 0,
              duration: 0.65,
              stagger: 0.14,
              ease: 'power2.out',
              scrollTrigger: { trigger: '.relations-copy', start: 'top 70%', once: true },
            }
          )

          gsap.fromTo(
            '.library-choice',
            { autoAlpha: 0, x: index => (index === 0 ? -70 : 70) },
            {
              autoAlpha: 1,
              x: 0,
              duration: 0.9,
              stagger: 0.12,
              ease: 'power3.out',
              scrollTrigger: { trigger: '.library-choices', start: 'top 78%', once: true },
            }
          )

        }
      )

      let active = true
      document.fonts.ready.then(() => {
        if (active) ScrollTrigger.refresh()
      })

      return () => {
        active = false
        media.revert()
      }
    },
    { scope: rootRef }
  )

  return (
    <main className="landing-shell" data-landing-theme={theme} ref={rootRef}>
      <LandingHeader
        locale={locale}
        homePath={homePath}
        supportPath={supportPath}
        alternatePath={alternatePath}
        theme={theme}
        onThemeChange={changeTheme}
        t={t}
      />

      <section className="hero-section">
        <div className="hero-copy">
          <h1>
            <TextReveal>{t('home.hero.title')}</TextReveal>
          </h1>
          <p>{t('home.hero.body')}</p>
          <div className="hero-actions">
            <a className="button" href="#telecharger">
              {t('home.cta.download')}
            </a>
            <a className="text-link" href="#parcours">
              {t('home.cta.discover')} <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="hero-proof">{t('home.hero.proof')}</p>
        </div>
        <div className="hero-universe">
          <div className="hero-orbit hero-orbit--dictionary">
            <img src="/images/landing/dictionary-universe.webp" alt="" />
          </div>
          <div className="hero-orbit hero-orbit--themes">
            <img src="/images/landing/themes-universe.webp" alt="" />
          </div>
          <div className="hero-phone">
            <LandingBibleViewerDemo locale={locale} />
          </div>
          <div className="hero-orbit hero-orbit--references">
            <img src="/images/landing/references-universe.webp" alt="" />
          </div>
        </div>
      </section>

      <section className="journey-section" id="parcours">
        <Reveal className="journey-intro">
          <h2>
            <TextReveal>{t('home.journey.title')}</TextReveal>
          </h2>
        </Reveal>
        <div className="journey-layout">
          <Reveal className="journey-verse">
            <p className="verse-reference">{t('home.journey.reference')}</p>
            <p className="verse-copy">
              {t('home.journey.verseBefore')}{' '}
              <VerseAnnotation
                type={annotation.type}
                color={annotation.color}
                revision={annotation.revision}
              >
                {t('home.journey.verseWord')}
              </VerseAnnotation>
              {t('home.journey.verseAfter')}
            </p>
            <p className="verse-version">{t('home.journey.version')}</p>
          </Reveal>
          <ol className="journey-path">
            <li className="landing-reveal">
              <span>01</span>
              <div>
                <h3>{t('home.journey.read.title')}</h3>
                <p>{t('home.journey.read.body')}</p>
                <HighlightDemo
                  activeType={annotationTool}
                  activeColor={annotation.color}
                  onTypeChange={setAnnotationTool}
                  onColorSelect={color =>
                    setAnnotation(current => ({
                      type: annotationTool,
                      color,
                      revision: current.revision + 1,
                    }))
                  }
                  labels={{
                    background: t('home.demo.highlight'),
                    circle: t('home.demo.circle'),
                    underline: t('home.demo.underline'),
                  }}
                  toolGroupLabel={t('home.demo.annotationType')}
                  colorGroupLabel={t('home.demo.annotationColor')}
                />
              </div>
            </li>
            <li className="landing-reveal">
              <span>02</span>
              <div>
                <h3>{t('home.journey.word.title')}</h3>
                <p>{t('home.journey.word.body')}</p>
                <StrongCardsDemo
                  label={t('home.demo.strongLabel')}
                  listen={t('home.demo.listen')}
                  cards={[
                    {
                      code: '1893',
                      transliteration: t('home.demo.strongProperTransliteration'),
                      title: t('home.demo.strongProperTitle'),
                      definition: t('home.demo.strongProperDefinition'),
                      type: t('home.demo.strongProperType'),
                    },
                    {
                      code: '1892',
                      transliteration: t('home.demo.strongCommonTransliteration'),
                      title: t('home.demo.strongCommonTitle'),
                      definition: t('home.demo.strongCommonDefinition'),
                      type: t('home.demo.strongCommonType'),
                    },
                  ]}
                />
              </div>
            </li>
            <li className="landing-reveal">
              <span>03</span>
              <div>
                <h3>{t('home.journey.follow.title')}</h3>
                <p>{t('home.journey.follow.body')}</p>
                <ConcordanceDemo
                  count={t('home.demo.concordanceCount')}
                  details={t('home.demo.concordanceDetails')}
                  items={[
                    {
                      label: t('home.demo.concordanceVanity'),
                      reference: t('home.demo.concordanceVanityReference'),
                      before: t('home.demo.concordanceVanityBefore'),
                      highlight: t('home.demo.concordanceVanityHighlight'),
                      after: t('home.demo.concordanceVanityAfter'),
                    },
                    {
                      label: t('home.demo.concordanceIdol'),
                      reference: t('home.demo.concordanceIdolReference'),
                      before: t('home.demo.concordanceIdolBefore'),
                      highlight: t('home.demo.concordanceIdolHighlight'),
                      after: t('home.demo.concordanceIdolAfter'),
                    },
                    {
                      label: t('home.demo.concordanceBreath'),
                      reference: t('home.demo.concordanceBreathReference'),
                      before: t('home.demo.concordanceBreathBefore'),
                      highlight: t('home.demo.concordanceBreathHighlight'),
                      after: t('home.demo.concordanceBreathAfter'),
                    },
                  ]}
                />
              </div>
            </li>
            <li className="landing-reveal">
              <span>04</span>
              <div>
                <h3>{t('home.journey.keep.title')}</h3>
                <p>{t('home.journey.keep.body')}</p>
                <ReasoningDemo
                  noteLabel={t('home.demo.noteLabel')}
                  noteText={t('home.demo.noteQuestion')}
                  relations={t('home.demo.relations')}
                  genesisLabel={t('home.demo.genesisLabel')}
                  genesisTitle={t('home.demo.genesisTitle')}
                  genesisChip={t('home.demo.genesisChip')}
                  abelMeta={t('home.demo.abelMeta')}
                  hevelMeta={t('home.demo.hevelMeta')}
                />
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="worlds-section" id="univers" style={worldsCarouselStyle}>
        <Reveal className="section-heading">
          <h2>
            <TextReveal>{t('home.worlds.title')}</TextReveal>
          </h2>
          <p>{t('home.worlds.body')}</p>
        </Reveal>
        <div className="worlds-viewport">
          <ul className="worlds-track" aria-label={t('home.worlds.aria')}>
            {worlds.map((world, index) => (
              <li className={`world-card world-card--${world.tone}`} key={world.title}>
                <div className="world-card__number">0{index + 1}</div>
                <img src={world.image} alt={world.alt} loading="lazy" />
                <div className="world-card__copy">
                  <h3>{world.title}</h3>
                  <p>{world.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="worlds-progress" aria-hidden="true">
          <span />
        </div>
      </section>

      <section className="relations-section">
        <Reveal className="relations-visual">
          <img
            src="/images/landing/relations-universe.webp"
            alt={t('home.relations.alt')}
            loading="lazy"
            width="1000"
            height="867"
          />
        </Reveal>
        <Reveal className="relations-copy">
          <h2>
            <TextReveal>{t('home.relations.title')}</TextReveal>
          </h2>
          <p>{t('home.relations.body')}</p>
          <ul>
            <li>{t('home.relations.notes')}</li>
            <li>{t('home.relations.tags')}</li>
            <li>{t('home.relations.studies')}</li>
          </ul>
        </Reveal>
      </section>

      <section className="library-section">
        <Reveal className="section-heading section-heading--center">
          <h2>
            <TextReveal>{t('home.offline.title')}</TextReveal>
          </h2>
        </Reveal>
        <div className="library-choices">
          <article className="library-choice library-choice--online landing-reveal">
            <div>
              <h3>{t('home.offline.online.title')}</h3>
              <p>{t('home.offline.online.body')}</p>
            </div>
            <img
              src="/images/landing/online-library.webp"
              alt={t('home.offline.online.alt')}
              loading="lazy"
            />
          </article>
          <article className="library-choice library-choice--offline landing-reveal">
            <div>
              <h3>{t('home.offline.local.title')}</h3>
              <p>{t('home.offline.local.body')}</p>
            </div>
            <img
              src="/images/landing/offline-library.webp"
              alt={t('home.offline.local.alt')}
              loading="lazy"
            />
          </article>
        </div>
      </section>

      <section className="download-section" id="telecharger">
        <Reveal className="download-copy">
          <h2>
            <TextReveal>{t('home.download.title')}</TextReveal>
          </h2>
          <p>{t('home.download.body')}</p>
          <div className="store-links">
            <StoreLink href={appStoreUrl} kicker={t('home.store.apple.kicker')} label="App Store" />
            <StoreLink
              href={playStoreUrl}
              kicker={t('home.store.google.kicker')}
              label="Google Play"
            />
          </div>
        </Reveal>
        <div className="download-word" aria-hidden="true">
          Strong
          <span lang="he" dir="rtl">
            חָזָק
          </span>
        </div>
      </section>

      <footer className="landing-footer">
        <a className="brand brand--footer" href={homePath} aria-label="Bible Strong">
          <img src="/images/icon.png" alt="" width="38" height="38" />
          <span>Bible Strong</span>
        </a>
        <p>{t('home.footer.line')}</p>
        <div>
          <a href={supportPath}>{t('support')}</a>
          <a href="https://github.com/smontlouis/bible-strong" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={locale === 'fr' ? '/fr/politique-de-confidentialite' : '/privacy-policy'}>
            {t('home.footer.privacy')}
          </a>
        </div>
      </footer>
    </main>
  )
}
