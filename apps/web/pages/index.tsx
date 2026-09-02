import { motion, useReducedMotion } from 'framer-motion'
import { useCurrentLocale, useI18n } from '../locales'

const appStoreUrl = 'https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8'
const playStoreUrl =
  'https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1'

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

export default function Home() {
  const t = useI18n()
  const locale = useCurrentLocale()
  const homePath = locale === 'fr' ? '/fr/' : '/'
  const supportPath = locale === 'fr' ? '/fr/give' : '/give'
  const alternatePath = locale === 'fr' ? '/' : '/fr/'
  const reduceMotion = useReducedMotion()

  const journey = [
    [t('home.journey.read.title'), t('home.journey.read.body')],
    [t('home.journey.word.title'), t('home.journey.word.body')],
    [t('home.journey.follow.title'), t('home.journey.follow.body')],
    [t('home.journey.keep.title'), t('home.journey.keep.body')],
  ]

  const capabilities = [
    {
      className: 'capability-card capability-card--versions',
      title: t('home.features.versions.title'),
      body: t('home.features.versions.body'),
      visual: (
        <span className="version-sample">
          LSG KJV
          <br />
          <span lang="he" dir="rtl">בְּרֵאשִׁית</span> SBLGNT
        </span>
      ),
    },
    {
      className: 'capability-card capability-card--personal',
      title: t('home.features.personal.title'),
      body: t('home.features.personal.body'),
      visual: (
        <div className="annotation-sample" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ),
    },
    {
      className: 'capability-card capability-card--context',
      title: t('home.features.context.title'),
      body: t('home.features.context.body'),
      visual: <span className="context-sample">850+</span>,
    },
    {
      className: 'capability-card capability-card--media',
      title: t('home.features.media.title'),
      body: t('home.features.media.body'),
      visual: (
        <div className="media-sample" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ),
    },
    {
      className: 'capability-card capability-card--image',
      title: t('home.features.resources.title'),
      body: t('home.features.resources.body'),
      visual: (
        <img
          src="/images/landing/dictionary-study.webp"
          alt={t('home.features.resources.alt')}
          loading="lazy"
          width="760"
          height="833"
        />
      ),
    },
  ]

  return (
    <main className="landing-shell">
      <header className="landing-nav-wrap">
        <nav className="landing-nav" aria-label={t('home.nav.label')}>
          <a className="brand" href={homePath} aria-label="Bible Strong">
            <img src="/images/icon.png" alt="" width="44" height="44" />
            <span>Bible Strong</span>
          </a>
          <div className="landing-nav__links">
            <a href="#parcours">{t('home.nav.journey')}</a>
            <a href="#outils">{t('home.nav.tools')}</a>
            <a href={supportPath}>{t('support')}</a>
          </div>
          <div className="landing-nav__actions">
            <a className="language-link" href={alternatePath} lang={locale === 'fr' ? 'en' : 'fr'}>
              {locale === 'fr' ? 'EN' : 'FR'}
            </a>
            <a className="button button--compact" href="#telecharger">
              {t('home.cta.download')}
            </a>
          </div>
        </nav>
      </header>

      <section className="hero-section">
        <motion.div
          className="hero-copy"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>{t('home.hero.title')}</h1>
          <p>{t('home.hero.body')}</p>
          <div className="hero-actions">
            <a className="button" href="#telecharger">
              {t('home.cta.download')}
            </a>
            <a className="text-link" href="#parcours">
              {t('home.cta.discover')} <span aria-hidden="true">↓</span>
            </a>
          </div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.97, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <img
            className="hero-photo"
            src="/images/landing/hero-study-map.webp"
            alt={t('home.hero.imageAlt')}
            width="1800"
            height="1152"
            fetchPriority="high"
          />
          <div className="phone-shot">
            <img
              src="/images/landing/abel-onboarding.webp"
              alt={t('home.hero.screenAlt')}
              width="660"
              height="1434"
            />
          </div>
        </motion.div>
      </section>

      <section className="journey-section" id="parcours">
        <Reveal className="section-heading section-heading--narrow">
          <h2>{t('home.journey.title')}</h2>
          <p>{t('home.journey.body')}</p>
        </Reveal>
        <div className="journey-layout">
          <Reveal className="journey-verse">
            <p className="verse-reference">{t('home.journey.reference')}</p>
            <p className="verse-copy">
              {t('home.journey.verseBefore')} <mark>{t('home.journey.verseWord')}</mark>
              {t('home.journey.verseAfter')}
            </p>
            <p className="verse-version">{t('home.journey.version')}</p>
          </Reveal>
          <div className="journey-steps">
            {journey.map(([title, body]) => (
              <article className="journey-step landing-reveal" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="strong-section">
        <Reveal className="strong-copy">
          <h2>{t('home.strong.title')}</h2>
          <p>{t('home.strong.body')}</p>
          <a className="text-link" href="#outils">
            {t('home.strong.link')} <span aria-hidden="true">↓</span>
          </a>
        </Reveal>
        <Reveal className="strong-specimen">
          <div className="strong-word" lang="he" dir="rtl">
            הֶבֶל
          </div>
          <div className="strong-meta">
            <div>
              <span>{t('home.strong.lemma')}</span>
              <strong>hevel</strong>
            </div>
            <div>
              <span>{t('home.strong.code')}</span>
              <strong>H1892</strong>
            </div>
            <div>
              <span>{t('home.strong.meaning')}</span>
              <strong>{t('home.strong.meaningValue')}</strong>
            </div>
          </div>
          <p className="strong-occurrence">{t('home.strong.occurrence')}</p>
        </Reveal>
      </section>

      <section className="features-section" id="outils">
        <Reveal className="section-heading">
          <h2>{t('home.features.title')}</h2>
          <p>{t('home.features.body')}</p>
        </Reveal>
        <div className="capability-grid">
          {capabilities.map((item) => (
            <article className={`${item.className} landing-reveal`} key={item.title}>
              <div className="capability-visual">{item.visual}</div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="offline-section">
        <Reveal className="offline-statement">
          <h2>{t('home.offline.title')}</h2>
          <p>{t('home.offline.body')}</p>
        </Reveal>
        <Reveal className="offline-details">
          <article>
            <h3>{t('home.offline.online.title')}</h3>
            <p>{t('home.offline.online.body')}</p>
          </article>
          <article>
            <h3>{t('home.offline.local.title')}</h3>
            <p>{t('home.offline.local.body')}</p>
          </article>
        </Reveal>
      </section>

      <section className="download-section" id="telecharger">
        <Reveal className="download-copy">
          <h2>{t('home.download.title')}</h2>
          <p>{t('home.download.body')}</p>
          <div className="store-links">
            <StoreLink href={appStoreUrl} kicker={t('home.store.apple.kicker')} label="App Store" />
            <StoreLink href={playStoreUrl} kicker={t('home.store.google.kicker')} label="Google Play" />
          </div>
        </Reveal>
        <div className="download-word" aria-hidden="true">
          Abel
          <span>הֶבֶל</span>
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
