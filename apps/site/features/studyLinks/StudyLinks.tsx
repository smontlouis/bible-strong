import type { StudyLinkKind } from '@bible-strong/resource-domain/contracts/studyLinksContract'
import SiteLink from '@/components/SiteLink'
import type { ResourceLanguage } from '../resources/publicSite'
import ResourceMark from './ResourceMark'
import { studyLinkDetail, type StudyLinkItem } from './studyLinksRead'

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

/** A person or a place wears its portrait; a resource, its mark. */
const StudyLinkMark = ({ item }: { item: StudyLinkItem }) =>
  item.kind !== 'entity' ? (
    <ResourceMark kind={item.kind} />
  ) : item.picture ? (
    <img
      className="study-link__portrait"
      src={item.picture}
      alt=""
      width={22}
      height={22}
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span className="study-link__portrait study-link__portrait--initial" aria-hidden="true">
      {item.label.charAt(0)}
    </span>
  )

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
              {items.map(item => {
                const detail = studyLinkDetail(item, items)
                return (
                  <li key={item.path}>
                    <SiteLink className="resource-chip study-link" href={item.path}>
                      <StudyLinkMark item={item} />
                      {item.label}
                      {detail ? <span className="resource-muted"> · {detail}</span> : null}
                    </SiteLink>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </>
  )
}
