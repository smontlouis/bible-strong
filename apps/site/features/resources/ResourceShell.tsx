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

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const readThemePreference = (): ThemePreference => {
  const value = new RegExp(`(?:^|; )${themeCookieName}=([^;]*)`).exec(document.cookie)?.[1]
  return isThemePreference(value) ? value : 'auto'
}

// Pages are cached for everyone, so the stored theme is applied in the browser, before the
// first paint, rather than rendered on the server like on the landing page.
const applyStoredTheme = `(function(){try{var m=document.cookie.match(/(?:^|; )${themeCookieName}=(light|dark)/);if(m)document.currentScript.parentElement.dataset.theme=m[1]}catch(e){}})()`

/** Standalone chrome of a public resource page: brand, app entry, theme and language. */
export default function ResourceShell({
  alternatePath,
  appUrl,
  subHeader,
  children,
}: {
  /** The same resource in the other language, when it exists. */
  alternatePath?: string
  /** The same resource in the study workspace. */
  appUrl: string
  /** Controls specific to the resource, kept under the main bar while scrolling. */
  subHeader?: ReactNode
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
        <div className="mx-auto flex h-16 max-w-[760px] items-center justify-between gap-3 px-5">
          <a
            className="flex min-w-0 items-center gap-2.5 font-semibold"
            href={homePath}
            aria-label={t('resource.nav.home')}
          >
            <img
              src="/images/icon.png"
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full"
            />
            <span className="truncate max-[480px]:sr-only">Bible Strong</span>
          </a>
          <div className="landing-nav__actions shrink-0">
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
      <main className="mx-auto max-w-[760px] px-5 pb-20 pt-10 md:pt-14">{children}</main>
      <footer className="resource-muted mx-auto max-w-[760px] border-t border-[var(--resource-line)] px-5 py-10 text-sm">
        <p>{t('resource.footer.tagline')}</p>
        <a className="resource-link mt-2 inline-block" href={homePath}>
          {t('resource.footer.getApp')}
        </a>
      </footer>
    </div>
  )
}
