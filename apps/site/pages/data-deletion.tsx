import LegalDocument from '../common/LegalDocument'
import { deletionContent } from '../common/legalContent'
import { useCurrentLocale } from '../locales'

export default function Page() {
  const locale = useCurrentLocale()
  return <LegalDocument locale={locale} content={deletionContent[locale]} />
}
