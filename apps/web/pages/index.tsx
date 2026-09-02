import { FaGithub } from 'react-icons/fa'
import { useCurrentLocale, useI18n } from '../locales'

export default function Home() {
  const t = useI18n()
  const locale = useCurrentLocale()
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:bg-[url('/images/background.jpg')] md:bg-contain md:bg-fixed md:bg-right md:bg-no-repeat">
      <img src="/images/svg/logo-full.svg" className="absolute left-5 top-0 w-60" alt="Bible Strong" />
      <section>
        <h1 className="text-6xl font-bold">{t('home.all')}.<br />{t('home.inOne')}.</h1>
        <p className="mt-8 max-w-[400px]">{t('home.description')}</p>
        <div className="mt-8 flex items-center">
          <a className="inline-block h-[50px] w-40 overflow-hidden bg-contain bg-no-repeat" aria-label="Télécharger dans l’App Store" href="https://apps.apple.com/fr/app/bible-strong/id1454738221?mt=8" style={{ backgroundImage: `url(https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/${locale === 'fr' ? 'fr-fr' : 'en-US'}?size=250x83&releaseDate=1562112000)` }} />
          <a className={locale === 'fr' ? 'h-[63px] w-[165px]' : 'h-[70px] w-[180px]'} href="https://play.google.com/store/apps/details?id=com.smontlouis.biblestrong&pcampaignid=MKT-Other-global-all-co-prtnr-py-PartBadge-Mar2515-1">
            <img alt="Disponible sur Google Play" src={`https://play.google.com/intl/en_us/badges/images/generic/${locale}_badge_web_generic.png`} className="mb-0 w-full" />
          </a>
        </div>
      </section>
      <nav className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-4 p-4 text-muted-foreground">
        <a href={locale === 'fr' ? '/fr/give' : '/give'}>{t('support')}</a>
        <a href="https://github.com/smontlouis/bible-strong" className="flex items-center gap-1"><FaGithub /> Github</a>
      </nav>
    </main>
  )
}
