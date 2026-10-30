import SiteLink from '@/components/SiteLink'
import {
  BookMarked,
  BookOpen,
  History,
  Languages,
  Map,
  MessageSquareText,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useCurrentLocale } from '@/locales'
import { RESOURCE_SECTIONS, type ResourceSectionKey } from './sections'

const MENU_LABEL = { fr: 'Explorer', en: 'Explore' } as const

const SECTION_ICONS: Record<ResourceSectionKey, LucideIcon> = {
  bible: BookOpen,
  strong: Languages,
  dictionary: BookMarked,
  nave: Tags,
  commentary: MessageSquareText,
  timeline: History,
  atlas: Map,
}

/**
 * The sections of the site, in the header of every public page, the landing page included: a
 * grid of eight cells where the Bible, the first of them, takes two, so that seven sections leave
 * no hole. It opens on a click, closes outside it and with Escape, and works without the script.
 */
export default function ExploreMenu({ section }: { section?: ResourceSectionKey }) {
  const locale = useCurrentLocale()
  const menuRef = useRef<HTMLDetailsElement>(null)

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

  return (
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
        <ul className="resource-menu__grid">
          {RESOURCE_SECTIONS.map(entry => {
            const Icon = SECTION_ICONS[entry.key]
            return (
              <li key={entry.key}>
                <SiteLink
                  className="resource-menu__item"
                  aria-current={entry.key === section ? 'true' : undefined}
                  href={entry.path(locale)}
                >
                  <span className="resource-menu__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <span className="resource-menu__text">
                    <span className="resource-menu__label">{entry.label[locale]}</span>
                    <span className="resource-menu__short">{entry.short[locale]}</span>
                  </span>
                </SiteLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </details>
  )
}
