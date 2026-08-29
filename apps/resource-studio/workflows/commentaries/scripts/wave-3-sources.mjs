import { normalizeSourceMarkup, sha256 } from './wave-sources.mjs'

export const WAVE_3_CROSSWIRE_RESOURCES = [
  { id: 'abbott', module: 'Abbott', title: 'Illustrated New Testament', author: 'John S. C. Abbott et Jacob Abbott', tradition: 'Protestante', era: '1878' },
  { id: 'burkitt', module: 'Burkitt', title: 'Burkitt’s Expository Notes', author: 'William Burkitt', tradition: 'Anglicane', era: '1700–1703' },
  { id: 'catena-aurea', module: 'Catena', title: 'Catena Aurea', author: 'Thomas d’Aquin (compilateur)', tradition: 'Catholique et patristique', era: 'XIIIe siècle / traduction historique' },
  { id: 'darby-notes', module: 'DTN', title: 'Darby Translation Notes', author: 'John Nelson Darby', tradition: 'Frères', era: 'XIXe siècle' },
  { id: 'family-notes', module: 'Family', title: 'Family Bible Notes', author: 'Justin Edwards et collaborateurs', tradition: 'Protestante', era: 'XIXe siècle' },
  { id: 'geneva-notes', module: 'Geneva', title: 'Geneva Bible Translation Notes', author: 'Traducteurs de la Bible de Genève', tradition: 'Réformée', era: 'XVIe siècle' },
  { id: 'kd', module: 'KD', title: 'Keil & Delitzsch Commentary', author: 'C. F. Keil et F. Delitzsch', tradition: 'Luthérienne', era: 'XIXe siècle' },
  { id: 'king-comments', module: 'KingComments', title: 'Kingcomments', author: 'Ger de Koning', tradition: 'Frères', era: 'Contemporain', license: 'CustomPermission' },
  { id: 'lightfoot', module: 'Lightfoot', title: 'John Lightfoot Commentary', author: 'John Lightfoot', tradition: 'Puritaine', era: 'XVIIe siècle' },
  { id: 'luther', module: 'Luther', title: 'Luther’s Commentary on Selected Bible Passages', author: 'Martin Luther', tradition: 'Luthérienne', era: 'XVIe siècle / traductions historiques' },
  { id: 'mhc', module: 'MHC', title: 'Matthew Henry’s Complete Commentary', author: 'Matthew Henry', tradition: 'Réformée', era: '1706–1710' },
  { id: 'pnt', module: 'PNT', title: 'The People’s New Testament', author: 'B. W. Johnson', tradition: 'Restoration Movement', era: '1891' },
  { id: 'rwp', module: 'RWP', title: 'Robertson’s Word Pictures', author: 'A. T. Robertson', tradition: 'Baptiste', era: '1930–1933', license: 'CustomPermission' },
  { id: 'scofield', module: 'Scofield', title: 'Scofield Reference Notes, 1917 Edition', author: 'C. I. Scofield', tradition: 'Dispensationaliste', era: '1917' },
  { id: 'fourfold-gospel', module: 'TFG', title: 'The Fourfold Gospel and Commentary on Acts', author: 'J. W. McGarvey et Philip Y. Pendleton', tradition: 'Restoration Movement', era: '1863–1914' },
  { id: 'tsk', module: 'TSK', title: 'Treasury of Scripture Knowledge', author: 'Canne, Browne, Blayney, Scott et collaborateurs', tradition: 'Référence interconfessionnelle', era: 'vers 1880' },
].map(resource => ({ ...resource, language: 'en', license: resource.license ?? 'PublicDomain' }))

export const MHM_RESOURCE = {
  id: 'mhm',
  title: 'Matthew Henry’s Modern English Commentary',
  author: 'Matthew Henry ; adaptation STEPBible',
  tradition: 'Réformée',
  era: '2025',
  language: 'en',
  license: 'CC-BY-4.0',
}

const chapterData = [
  ['Gen', 50], ['Exod', 40], ['Lev', 27], ['Num', 36], ['Deut', 34], ['Josh', 24], ['Judg', 21], ['Ruth', 4],
  ['1Sam', 31], ['2Sam', 24], ['1Kgs', 22], ['2Kgs', 25], ['1Chr', 29], ['2Chr', 36], ['Ezra', 10],
  ['Neh', 13], ['Esth', 10], ['Job', 42], ['Ps', 150], ['Prov', 31], ['Eccl', 12], ['Song', 8], ['Isa', 66],
  ['Jer', 52], ['Lam', 5], ['Ezek', 48], ['Dan', 12], ['Hos', 14], ['Joel', 3], ['Amos', 9], ['Obad', 1],
  ['Jonah', 4], ['Mic', 7], ['Nah', 3], ['Hab', 3], ['Zeph', 3], ['Hag', 2], ['Zech', 14], ['Mal', 4],
  ['Matt', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Rom', 16], ['1Cor', 16],
  ['2Cor', 13], ['Gal', 6], ['Eph', 6], ['Phil', 4], ['Col', 4], ['1Thess', 5], ['2Thess', 3],
  ['1Tim', 6], ['2Tim', 4], ['Titus', 3], ['Phlm', 1], ['Heb', 13], ['Jas', 5], ['1Pet', 5],
  ['2Pet', 3], ['1John', 5], ['2John', 1], ['3John', 1], ['Jude', 1], ['Rev', 22],
]

export const MHM_CHAPTERS = chapterData.flatMap(([osisBook, chapters], bookIndex) =>
  Array.from({ length: chapters }, (_, chapterIndex) => ({ book: bookIndex + 1, chapter: chapterIndex + 1, osisReference: `${osisBook}.${chapterIndex + 1}` }))
)

const plainText = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

export const parseMhmChapter = ({ value, book, chapter, sourceUrl }) => {
  const entries = []
  let verse = 0
  for (const spanMatch of String(value ?? '').matchAll(/<span\b[^>]*class=['"][^'"]*\bverse\b[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi)) {
    verse++
    const body = spanMatch[1]
    const html = normalizeSourceMarkup(body)
    const text = plainText(html)
    if (!text || /^(?:&#x2013;|&#8211;|–|-)$/i.test(text)) continue
    const passage = `${book}-${chapter}-${verse}`
    const rangeEnd = body.match(/<strong\b[^>]*>\s*v\.?\s*\d+\s*[-–]\s*(\d+)\s*<\/strong>/i)?.[1]
    const entry = {
      schemaVersion: 1,
      id: `mhm:${passage}`,
      passage,
      resource: { id: MHM_RESOURCE.id, name: MHM_RESOURCE.title, author: MHM_RESOURCE.author, sourceLanguage: 'en', license: MHM_RESOURCE.license },
      source: { language: 'en', html, sha256: sha256(html), provenance: `STEPBible MHM · ${sourceUrl}` },
      translation: null,
    }
    if (rangeEnd && Number(rangeEnd) > verse) entry.passageEnd = `${book}-${chapter}-${Number(rangeEnd)}`
    entries.push(entry)
  }
  return entries
}

export const confValue = (configuration, name) => configuration.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? null
