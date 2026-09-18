import LegalDocument from '../common/LegalDocument'
import { privacyContent } from '../common/legalContent'

export default function Page() {
  return <LegalDocument locale="fr" content={privacyContent.fr} />
}
