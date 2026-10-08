import type { ResourceLanguage } from '../resources/publicSite'

// Interface strings of the topic pages, indexed by the language of the publication being
// read. `{name}` marks are filled in by the page.
export const NAVE_MESSAGES = {
  fr: {
    name: 'Bible thématique de Nave',
    'index.title': 'Thèmes bibliques',
    'index.intro':
      'La Bible thématique d’Orville J. Nave classe les passages de la Bible par sujet : personnes, lieux, doctrines, vie quotidienne. Choisissez une lettre pour parcourir ses {count} thèmes ; chacun ouvre ses sous-thèmes et leurs références, reliées au texte biblique.',
    'index.letters': 'Parcourir par lettre',
    'index.headTitle': 'Thèmes bibliques de A à Z – Bible thématique de Nave',
    'index.headDescription':
      'Les {count} thèmes de la Bible thématique de Nave, de A à Z : pour chaque sujet, les passages bibliques classés par sous-thème et reliés au texte.',
    // The French publication is a machine translation; the study workspace says so too.
    notice:
      'La version française est une traduction automatique de l’original anglais : certaines formulations sont approximatives.',
    'letter.title': 'Thèmes bibliques — {letter}',
    'letter.crumb': 'Lettre {letter}',
    'letter.count': '{count} thèmes',
    'letter.count.one': '1 thème',
    'letter.range': 'de « {first} » à « {last} »',
    'letter.headTitle': 'Thèmes bibliques en {letter} – Bible thématique de Nave',
    'letter.headDescription': '{count} commençant par {letter} dans la Bible thématique de Nave',
    'letter.page': 'page {page}',
    'letter.pageOf': 'page {page} sur {count}',
    'topic.original': 'Titre d’origine',
    'topic.references': '{count} références bibliques',
    'topic.references.one': '1 référence biblique',
    'topic.outline': 'Sous-thèmes et passages',
    'topic.verses': 'Versets bibliques sur « {topic} »',
    'topic.verses.note': 'Les premiers versets cités, dans la Bible Segond 1910.',
    'topic.seeAlso': 'Voir aussi',
    'topic.neighbours': 'Thèmes précédent et suivant',
    'topic.headTitle': '{name} : versets bibliques par thème | Bible thématique de Nave',
    'topic.description': '{count} sur le thème « {name} »',
    'topic.description.plain': '« {name} », thème de la Bible thématique de Nave',
    separator: ' : ',
  },
  en: {
    name: 'Nave’s Topical Bible',
    'index.title': 'Bible topics',
    'index.intro':
      'Orville J. Nave’s Topical Bible sorts the passages of the Bible by subject: people, places, doctrines, daily life. Pick a letter to browse its {count} topics; each one opens its sub-topics and their references, linked to the Bible text.',
    'index.letters': 'Browse by letter',
    'index.headTitle': 'Bible topics from A to Z – Nave’s Topical Bible',
    'index.headDescription':
      'The {count} topics of Nave’s Topical Bible, from A to Z: for each subject, the Bible passages sorted by sub-topic and linked to the text.',
    notice: '',
    'letter.title': 'Bible topics — {letter}',
    'letter.crumb': 'Letter {letter}',
    'letter.count': '{count} topics',
    'letter.count.one': '1 topic',
    'letter.range': 'from “{first}” to “{last}”',
    'letter.headTitle': 'Bible topics in {letter} – Nave’s Topical Bible',
    'letter.headDescription': '{count} starting with {letter} in Nave’s Topical Bible',
    'letter.page': 'page {page}',
    'letter.pageOf': 'page {page} of {count}',
    'topic.original': 'Original heading',
    'topic.references': '{count} Bible references',
    'topic.references.one': '1 Bible reference',
    'topic.outline': 'Sub-topics and passages',
    'topic.verses': 'Bible verses about “{topic}”',
    'topic.verses.note': 'The first verses cited, in the King James Version.',
    'topic.seeAlso': 'See also',
    'topic.neighbours': 'Previous and next topics',
    'topic.headTitle': '{name}: Bible verses by topic | Nave’s Topical Bible',
    'topic.description': '{count} on the topic “{name}”',
    'topic.description.plain': '“{name}”, a topic of Nave’s Topical Bible',
    separator: ': ',
  },
} as const satisfies Record<ResourceLanguage, Record<string, string>>

/** `{count} thèmes`, or its singular: counts are written in the language of the page. */
export const naveCount = (
  language: ResourceLanguage,
  key: 'letter.count' | 'topic.references',
  count: number
): string =>
  count === 1
    ? NAVE_MESSAGES[language][`${key}.one`]
    : NAVE_MESSAGES[language][key].replace('{count}', count.toLocaleString(language))
