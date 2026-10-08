import { useI18n } from '@/locales'
import type { ResourceLanguage } from '../resources/publicSite'
import type { StrongTranslation } from './strong.functions'

/** The words a Bible renders an entry by, each with the number of times it does. */
export default function StrongTranslations({
  translations,
  version,
  language,
}: {
  translations: readonly StrongTranslation[]
  version: string
  language: ResourceLanguage
}) {
  const t = useI18n()
  if (!translations.length) return null
  return (
    <>
      <h3 className="resource-muted mb-3 mt-8 text-sm font-semibold uppercase tracking-[0.1em]">
        {t('strong.translations').replace('{version}', version)}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {translations.map(translation => (
          <li key={translation.word} className="resource-chip">
            {translation.word}
            <span className="font-semibold">{translation.count.toLocaleString(language)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
