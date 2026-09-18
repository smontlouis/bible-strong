import LegalDocument from '../common/LegalDocument'
import { privacyContent } from '../common/legalContent'

export default function Page() {
  return <LegalDocument locale="en" content={privacyContent.en} />
}
