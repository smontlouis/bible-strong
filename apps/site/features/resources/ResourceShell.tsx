import SiteLink from '@/components/SiteLink'
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
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
import ExploreMenu from './ExploreMenu'
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
  immersive = false,
  wide = false,
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
  /**
   * The page is an experience of its own: it takes the whole window under the header,
   * without the reading column, the invitation or the footer.
   */
  immersive?: boolean
  /**
   * The page lays out its own full-width sections, then the invitation and the footer as
   * every page has them.
   */
  wide?: boolean
  children: ReactNode
}) {
  const t = useI18n()
  const locale = useCurrentLocale()
  const homePath = locale === 'fr' ? '/fr' : '/'
  const [theme, setTheme] = useState<ThemePreference>('auto')

  useIsomorphicLayoutEffect(() => {
    setTheme(readThemePreference())
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
            <SiteLink
              className="flex min-w-0 shrink-0 items-center gap-2.5 font-semibold"
              href={homePath}
              aria-label={t('resource.nav.home')}
            >
              <img
                src="/images/icon-144.png"
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-full"
              />
              <span className="truncate max-[640px]:sr-only">Bible Strong</span>
            </SiteLink>
            <ExploreMenu section={section} />
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
              <SiteLink
                className="language-link"
                href={alternatePath}
                lang={locale === 'fr' ? 'en' : 'fr'}
                aria-label={`${locale.toUpperCase()} – ${t('home.language.switch')}`}
                title={t('home.language.switch')}
              >
                <LanguageMark locale={locale} />
              </SiteLink>
            )}
          </div>
        </div>
        {subHeader && (
          <div className="relative mx-auto max-w-[760px] px-5 pb-3">{subHeader}</div>
        )}
      </header>
      {immersive ? (
        <main className="resource-stage">{children}</main>
      ) : (
        <>
          <main
            className={
              wide ? 'resource-wide pb-20' : 'mx-auto max-w-[760px] px-5 pb-20 pt-8 md:pt-10'
            }
          >
            {breadcrumbs && breadcrumbs.length > 1 && (
              <nav className="resource-breadcrumbs" aria-label={t('resource.breadcrumbs')}>
                <ol>
                  {breadcrumbs.map((breadcrumb, index) => (
                    <li key={`${index}-${breadcrumb.label}`}>
                      {breadcrumb.path && index < breadcrumbs.length - 1 ? (
                        <SiteLink href={breadcrumb.path}>{breadcrumb.label}</SiteLink>
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
              <div className={wide ? 'mx-auto max-w-[760px] px-5' : undefined}>
                <AppInvitation
                  section={section}
                  language={locale}
                  appUrl={appUrl}
                  downloadPath={`${homePath}#telecharger`}
                />
              </div>
            )}
          </main>
          <footer className="resource-footer mx-auto max-w-[760px] px-5 py-10 text-sm">
            <ul className="resource-footer__sections">
              {RESOURCE_SECTIONS.map(entry => (
                <li key={entry.key}>
                  <SiteLink href={entry.path(locale)}>{entry.label[locale]}</SiteLink>
                </li>
              ))}
            </ul>
            <p className="resource-muted mt-6">{t('resource.footer.tagline')}</p>
            <SiteLink className="resource-link mt-2 inline-block" href={homePath}>
              {t('resource.footer.getApp')}
            </SiteLink>
          </footer>
        </>
      )}
    </div>
  )
}
