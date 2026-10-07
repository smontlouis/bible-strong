import type { ResourceLanguage } from './publicSite'
import type { ResourceSectionKey } from './sections'

const ACTIONS: Record<ResourceLanguage, { open: string; download: string }> = {
  fr: { open: 'Ouvrir dans l’app', download: 'Télécharger l’app' },
  en: { open: 'Open in the app', download: 'Get the app' },
}

// What the study workspace adds to the page being read, section by section.
const INVITATIONS: Record<
  ResourceSectionKey,
  Record<ResourceLanguage, { title: string; body: string }>
> = {
  bible: {
    fr: {
      title: 'Allez plus loin dans l’app',
      body: 'Surlignez, annotez et reliez les versets, suivez un plan de lecture et gardez vos Bibles hors ligne.',
    },
    en: {
      title: 'Go further in the app',
      body: 'Highlight, annotate and link verses, follow a reading plan and keep your Bibles offline.',
    },
  },
  strong: {
    fr: {
      title: 'Chaque mot du texte, à portée de doigt',
      body: 'Dans l’app, touchez un mot de la Bible pour ouvrir sa fiche, puis rangez vos découvertes dans vos études.',
    },
    en: {
      title: 'Every word of the text, one tap away',
      body: 'In the app, tap a word of the Bible to open its entry, then keep what you find in your studies.',
    },
  },
  dictionary: {
    fr: {
      title: 'Le dictionnaire au fil de la lecture',
      body: 'Dans l’app, les articles s’ouvrent à côté du texte biblique et restent disponibles hors ligne.',
    },
    en: {
      title: 'The dictionary as you read',
      body: 'In the app, articles open next to the Bible text and stay available offline.',
    },
  },
  nave: {
    fr: {
      title: 'Étudiez un thème à votre rythme',
      body: 'Dans l’app, ouvrez chaque référence d’un thème à côté du texte et notez ce que vous découvrez.',
    },
    en: {
      title: 'Study a topic at your own pace',
      body: 'In the app, open every reference of a topic next to the text and write down what you find.',
    },
  },
  commentary: {
    fr: {
      title: 'Les commentaires à côté du texte',
      body: 'Dans l’app, lisez les commentaires verset par verset, à côté de la Bible, même hors ligne.',
    },
    en: {
      title: 'Commentaries next to the text',
      body: 'In the app, read commentaries verse by verse, next to the Bible, even offline.',
    },
  },
  timeline: {
    fr: {
      title: 'Parcourez toute la chronologie',
      body: 'Dans l’app, faites défiler la frise des événements bibliques et ouvrez les passages qui les racontent.',
    },
    en: {
      title: 'Walk through the whole timeline',
      body: 'In the app, scroll the frieze of biblical events and open the passages that tell them.',
    },
  },
}

/**
 * What the study workspace adds to a page, offered after its content. Reading never
 * depends on it: the invitation closes the page, it does not interrupt it.
 */
export default function AppInvitation({
  section,
  language,
  appUrl,
  downloadPath,
}: {
  section: ResourceSectionKey
  language: ResourceLanguage
  /** The same resource in the study workspace. */
  appUrl: string
  /** Where the mobile apps are offered. */
  downloadPath: string
}) {
  const invitation = INVITATIONS[section][language]
  const actions = ACTIONS[language]
  return (
    <aside className="resource-invite">
      <h2 className="text-lg font-semibold">{invitation.title}</h2>
      <p className="mt-1.5">{invitation.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a className="resource-cta" href={appUrl}>
          {actions.open}
        </a>
        <a className="resource-link font-semibold" href={downloadPath}>
          {actions.download}
        </a>
      </div>
    </aside>
  )
}
