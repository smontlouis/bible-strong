import type { StudyLinkKind } from '@bible-strong/resource-domain/contracts/studyLinksContract'
import SiteLink from '@/components/SiteLink'
import type { ResourceLanguage } from '../resources/publicSite'
import type { StudyLinkItem } from './studyLinksRead'

const SECTIONS: Record<ResourceLanguage, Record<StudyLinkKind, string>> = {
  fr: {
    entity: 'Personnes et lieux',
    nave: 'Sujets bibliques',
    dictionary: 'Dictionnaires',
    timeline: 'Chronologie',
  },
  en: {
    entity: 'People and places',
    nave: 'Topics',
    dictionary: 'Dictionaries',
    timeline: 'Timeline',
  },
}

const ORDER: readonly StudyLinkKind[] = ['entity', 'nave', 'dictionary', 'timeline']

/** What the other study resources hold on this subject, one list per resource. */
export default function StudyLinks({
  language,
  links,
}: {
  language: ResourceLanguage
  links: readonly StudyLinkItem[]
}) {
  return (
    <>
      {ORDER.map(kind => {
        const items = links.filter(link => link.kind === kind)
        if (items.length === 0) return null
        return (
          <section key={kind} className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">{SECTIONS[language][kind]}</h2>
            <ul className="flex flex-wrap gap-2">
              {items.map(item => (
                <li key={item.path}>
                  <SiteLink className="resource-chip" href={item.path}>
                    {item.label}
                    {item.detail && kind !== 'entity' ? (
                      <span className="resource-muted"> · {item.detail}</span>
                    ) : null}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
