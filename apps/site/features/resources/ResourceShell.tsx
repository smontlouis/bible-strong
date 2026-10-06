import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  isThemePreference,
  LanguageMark,
  persistThemePreference,
  themeCookieName,
  ThemeToggle,
  type ThemePreference,
} from '@/components/SiteThemeControls'
import { useCurrentLocale, useI18n } from '@/locales'
import AppInvitation from './AppInvitation'
import type { Breadcrumb } from './resourceHead'
import { RESOURCE_SECTIONS, type ResourceSectionKey } from './sections'

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const readThemePreference = (): ThemePreference => {
  const value = new RegExp(`(?:^|; )${themeCookieName}=([^;]*)`).exec(document.cookie)?.[1]
  return isThemePreference(value) ? value : 'auto'
}

// Pages are cached for everyone, so the stored theme is applied in the browser, before the
// first paint, rather than rendered on the server like on the landing page.
const applyStoredTheme = `(function(){try{var m=document.cookie.match(/(?:^|; )${themeCookieName}=(light|dark)/);if(m)document.currentScript.parentElement.dataset.theme=m[1]}catch(e){}})()`

const MENU_LABEL = { fr: 'Explorer', en: 'Explore' } as const

/**
 * Standalone chrome of a public resource page: brand, the sections of the site, the app
 * entry, theme and language, then the path leading to the page.
 */
export default function ResourceShell({
  alternatePath,
  appUrl,
  section,
  breadcrumbs,
  subHeader,
  children,
}: {
  /** The same resource in the other language, when it exists. */
  alternatePath?: string
  /** The same resource in the study workspace. */
  appUrl: string
  /** The section the page belongs to: marked in the menu, and invited to in the app. */
  section?: ResourceSectionKey
  /** The path leading to the page; the last step is the page itself. */
  breadcrumbs?: Breadcrumb[]
  /** Controls specific to the resource, kept under the main bar while scrolling. */
  subHeader?: ReactNode
  children: ReactNode
}) {
  const t = useI18n()
  const locale = useCurrentLocale()
  const homePath = locale === 'fr' ? '/fr' : '/'
  const menuRef = useRef<HTMLDetailsElement>(null)
  const [theme, setTheme] = useState<ThemePreference>('auto')

  useIsomorphicLayoutEffect(() => {
    setTheme(readThemePreference())
  }, [])

  useEffect(() => {
    const close = (event: Event) => {
      const menu = menuRef.current
      if (!menu?.open) return
      const escape = event instanceof KeyboardEvent && event.key === 'Escape'
      const outside = event.type === 'pointerdown' && !menu.contains(event.target as Node)
      if (escape || outside) menu.removeAttribute('open')
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])

  const changeTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme)
    persistThemePreference(nextTheme)
  }

  return (
    <div className="resource-shell" data-theme={theme} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: applyStoredTheme }} />
      <header className="resource-header sticky top-0 z-10">
        <div className="relative mx-auto flex h-16 max-w-[760px] items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <a
              className="flex min-w-0 shrink-0 items-center gap-2.5 font-semibold"
              href={homePath}
              aria-label={t('resource.nav.home')}
            >
              <img
                src="/images/icon.png"
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-full"
              />
              <span className="truncate max-[640px]:sr-only">Bible Strong</span>
            </a>
            <details ref={menuRef} className="resource-menu">
              <summary className="resource-menu__trigger">
                {MENU_LABEL[locale]}
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
                  <path
                    d="m4 6 4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </summary>
              <nav className="resource-menu__panel" aria-label={MENU_LABEL[locale]}>
                <ul>
                  {RESOURCE_SECTIONS.map(entry => (
                    <li key={entry.key}>
                      <a
                        className="resource-menu__item"
                        aria-current={entry.key === section ? 'true' : undefined}
                        href={entry.path(locale)}
                      >
                        <span className="font-semibold">{entry.label[locale]}</span>
                        <span className="resource-muted block text-sm">
                          {entry.summary[locale]}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          </div>
          <div className="landing-nav__actions resource-header__actions shrink-0">
            <a className="resource-cta" href={appUrl}>
              {t('home.cta.openApp')}
            </a>
            <ThemeToggle
              value={theme}
              onChange={changeTheme}
              label={t('home.theme.label')}
              labels={{
                auto: t('home.theme.auto'),
                light: t('home.theme.light'),
                dark: t('home.theme.dark'),
              }}
            />
            {alternatePath && (
              <a
                className="language-link"
                href={alternatePath}
                lang={locale === 'fr' ? 'en' : 'fr'}
                aria-label={`${locale.toUpperCase()} – ${t('home.language.switch')}`}
                title={t('home.language.switch')}
              >
                <LanguageMark locale={locale} />
              </a>
            )}
          </div>
        </div>
        {subHeader && (
          <div className="relative mx-auto max-w-[760px] px-5 pb-3">{subHeader}</div>
        )}
      </header>
      <main className="mx-auto max-w-[760px] px-5 pb-20 pt-8 md:pt-10">
        {breadcrumbs && breadcrumbs.length > 1 && (
          <nav className="resource-breadcrumbs" aria-label={t('resource.breadcrumbs')}>
            <ol>
              {breadcrumbs.map((breadcrumb, index) => (
                <li key={`${index}-${breadcrumb.label}`}>
                  {breadcrumb.path && index < breadcrumbs.length - 1 ? (
                    <a href={breadcrumb.path}>{breadcrumb.label}</a>
                  ) : (
                    <span aria-current="page">{breadcrumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {children}
        {section && (
          <AppInvitation
            section={section}
            language={locale}
            appUrl={appUrl}
            downloadPath={`${homePath}#telecharger`}
          />
        )}
      </main>
      <footer className="resource-footer mx-auto max-w-[760px] px-5 py-10 text-sm">
        <ul className="resource-footer__sections">
          {RESOURCE_SECTIONS.map(entry => (
            <li key={entry.key}>
              <a href={entry.path(locale)}>{entry.label[locale]}</a>
            </li>
          ))}
        </ul>
        <p className="resource-muted mt-6">{t('resource.footer.tagline')}</p>
        <a className="resource-link mt-2 inline-block" href={homePath}>
          {t('resource.footer.getApp')}
        </a>
      </footer>
    </div>
  )
}
