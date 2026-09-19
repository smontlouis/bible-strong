import type { Locale } from '../locales'
import type { LegalDocumentContent } from './legalContent'

export const legalPaths = {
  fr: { privacy: '/fr/politique-de-confidentialite', terms: '/fr/eula', deletion: '/fr/data-deletion' },
  en: { privacy: '/privacy-policy', terms: '/eula-en', deletion: '/data-deletion' },
}

export default function LegalDocument({
  locale,
  content,
}: {
  locale: Locale
  content: LegalDocumentContent
}) {
  const french = locale === 'fr'
  const paths = legalPaths[locale]
  return (
    <main className="legal-page" lang={locale}>
      <article className="legal-content">
        <nav aria-label={french ? 'Navigation des informations légales' : 'Legal information navigation'}>
          <a href={french ? '/fr' : '/'}>Bible Strong</a>
          <a href={paths.privacy}>{french ? 'Confidentialité' : 'Privacy'}</a>
          <a href={paths.terms}>{french ? 'Conditions d’utilisation' : 'Terms of use'}</a>
          <a href={paths.deletion}>{french ? 'Supprimer mes données' : 'Delete my data'}</a>
        </nav>
        <h1>{content.title}</h1>
        <p>{french ? 'Texte révisé le ' : 'Text revised on '}<time dateTime="2026-09-18">{french ? '18 septembre 2026' : '18 September 2026'}</time></p>
        <p>{content.introduction}</p>
        <section aria-labelledby="publisher">
          <h2 id="publisher">{french ? 'Le Studio 316 — éditeur et contact' : 'Le Studio 316 — publisher and contact'}</h2>
          <p>
            LE STUDIO 316 — {french ? 'SAS au capital de 1 000 €' : 'French simplified joint-stock company (SAS), share capital €1,000'}
            <br />
            56 chemin des Caillats, 74890 Fessy, France
            <br />
            SIREN : 941 474 421 — RCS Thonon-les-Bains
            <br />
            SIRET : 941 474 421 00018 — {french ? 'TVA' : 'VAT'} : FR70941474421
          </p>
          <p><a href="mailto:stephane@lestudio316.com">stephane@lestudio316.com</a></p>
        </section>
        <section aria-labelledby="hosting">
          <h2 id="hosting">{french ? 'Hébergement du site public' : 'Public website hosting'}</h2>
          <p>Vercel Inc. — <a href="https://vercel.com/legal">vercel.com</a></p>
        </section>
        {content.sections.map(section => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id}>{section.title}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
            {section.links && <ul>{section.links.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>}
          </section>
        ))}
      </article>
    </main>
  )
}
