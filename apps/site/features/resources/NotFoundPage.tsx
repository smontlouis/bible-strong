import { useCurrentLocale } from '@/locales'
import { WEB_APP_ORIGIN } from './publicSite'
import ResourceShell from './ResourceShell'
import { RESOURCE_SECTIONS } from './sections'

const MESSAGES = {
  fr: {
    title: 'Page introuvable',
    body: 'Cette adresse ne mène à aucune page. Le lien est peut-être incomplet, ou la ressource a changé d’adresse.',
    sections: 'Reprendre depuis une section',
  },
  en: {
    title: 'Page not found',
    body: 'This address leads to no page. The link may be incomplete, or the resource may have moved.',
    sections: 'Start again from a section',
  },
} as const

/** What a wrong address answers with: the way back to every section of the site. */
export default function NotFoundPage() {
  const locale = useCurrentLocale()
  const messages = MESSAGES[locale]
  return (
    <ResourceShell appUrl={WEB_APP_ORIGIN}>
      <article>
        <h1 className="font-serif text-4xl leading-tight md:text-5xl">{messages.title}</h1>
        <p className="resource-prose mt-5">{messages.body}</p>
        <h2 className="mb-4 mt-10 text-xl font-semibold">{messages.sections}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {RESOURCE_SECTIONS.map(section => (
            <li key={section.key}>
              <a className="resource-card resource-card--link block h-full p-4" href={section.path(locale)}>
                <span className="font-semibold">{section.label[locale]}</span>
                <span className="resource-muted mt-1 block text-sm">{section.summary[locale]}</span>
              </a>
            </li>
          ))}
        </ul>
      </article>
    </ResourceShell>
  )
}
