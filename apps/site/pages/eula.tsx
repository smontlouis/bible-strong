import LegalDocument from '../common/LegalDocument'
import { termsContent } from '../common/legalContent'

export default function Page() {
  return <LegalDocument locale="fr" content={termsContent.fr} />
}
