import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifestPath = path.join(root, 'data', 'screenshots.json')
const outputPath = path.join(root, 'data', 'app-flows.json')

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const journeyRules = [
  {
    id: 'workspace-tabs',
    title: 'Workspace et onglets',
    description: "App switcher, groupes d'onglets, création d'onglet et surfaces racines.",
    match: /(home-drawer|tab-|new-tab|workspace|app-switcher)/,
  },
  {
    id: 'bible-reader',
    title: 'Lecture Bible',
    description: 'Lecture, sélection, versions, réglages de lecteur et partage biblique.',
    match: /(bible-reader|bible-book|bible-chapter|bible-version|version-picker|reader-|parallel|pericope|compare-verses|compare-version|color-palette|verse-labels|cross-version|original-bhs)/,
  },
  {
    id: 'selected-verse',
    title: 'Actions sur verset',
    description: 'Étudier, annoter, partager, lier et ajouter un verset à une étude.',
    match: /(selected-verse|selected-verses|verse-note|verse-tags|verse-link|verse-bookmark|verse-add|verse-strong)/,
  },
  {
    id: 'notes-links-tags',
    title: 'Notes, liens et tags',
    description: 'Collections utilisateur, détail, édition, filtres, tags et confirmations.',
    match: /(notes|note-|annotation-note|links|link-|tags|tag-|bookmark|highlight|annotation-|word-annotation)/,
  },
  {
    id: 'studies',
    title: 'Études',
    description: "Liste, édition riche, menus d'étude, tags, renommage et suppression.",
    match: /(studies|study-)/,
  },
  {
    id: 'resources',
    title: 'Ressources bibliques',
    description: 'Téléchargements, Nave, dictionnaire, lexique Strong, commentaires et langues.',
    match: /(download|nave|dictionary|lexique|strong|concordance|commentary|commentaries|resource-language|default-bible)/,
  },
  {
    id: 'plans',
    title: 'Plans et méditations',
    description: 'Plans de lecture, progression, tranches, méditations et partage.',
    match: /(plan|plans|meditation|slice)/,
  },
  {
    id: 'timeline',
    title: 'Chronologie',
    description: 'Timeline, recherche, sections, événements et module de chronologie.',
    match: /(timeline|chronology)/,
  },
  {
    id: 'home-discovery',
    title: 'Accueil et découverte',
    description: "Widgets d'accueil, verset du jour, apprentissage, support et handoffs.",
    match: /(home-|support|audibible|facebook|tipeee|paypal|bible-project)/,
  },
  {
    id: 'search',
    title: 'Recherche',
    description: 'Recherche biblique, filtres et états vides.',
    match: /(search)/,
  },
  {
    id: 'settings-profile',
    title: 'Compte et réglages',
    description: 'Plus, profil, auth, sauvegardes, thème, langue, aide, dev et confirmations.',
    match: /(more|profile|forgot-password|language|theme|backup|export|import|password|logout|delete-account|faq|changelog|rate-app|share-app|updates|nuke|automatic-backup)/,
  },
  {
    id: 'audio',
    title: 'Audio',
    description: 'Lecteur audio et TTS.',
    match: /(audio|tts)/,
  },
]

const fallbackJourney = {
  id: 'misc',
  title: 'Autres surfaces',
  description: 'Captures utiles non classées dans un parcours principal.',
}

const riskFor = (title, slug) => {
  const text = `${title} ${slug}`.toLowerCase()
  if (/(delete|deletion|suppression|reset|stop|nuke|destructive)/.test(text)) return 'destructive'
  if (/(share sheet|handoff|store|facebook|paypal|tipeee|github|audibible|external|export)/.test(text)) return 'external'
  if (/(edit|editor|create|creation|rename|save|tag editing|selector|download progress|download success|installed|copy|confirmation|add|restore|redownload|clear|new-study|group result)/.test(text)) {
    return 'mutating'
  }
  return 'safe'
}

const typeFor = (title, slug) => {
  const text = `${title} ${slug}`.toLowerCase()
  if (/(sheet|bottom sheet|modal|dialog|confirmation|popover|menu)/.test(text)) return 'sheet'
  if (/(editor|edit form|rename|creation form|add form)/.test(text)) return 'editor'
  if (/(webview|dom|reader|timeline-rendered)/.test(text)) return 'webview'
  if (/(share sheet|handoff|external)/.test(text)) return 'external'
  if (/(toast)/.test(text)) return 'toast'
  return 'screen'
}

const pickJourney = (slug) => journeyRules.find((journey) => journey.match.test(slug)) ?? fallbackJourney

const journeysById = new Map([...journeyRules, fallbackJourney].map((journey) => [journey.id, {
  id: journey.id,
  title: journey.title,
  description: journey.description,
}]))

const screenshotsByJourney = Map.groupBy(manifest.screenshots, (screenshot) => pickJourney(screenshot.slug).id)
const journeyLayout = new Map()
let yOffset = 0

for (const journey of journeysById.values()) {
  const count = screenshotsByJourney.get(journey.id)?.length ?? 0
  const rows = Math.max(1, Math.ceil(count / 6))
  journeyLayout.set(journey.id, { yOffset, rows })
  yOffset += rows * 360 + 260
}

const perJourneyIndex = new Map()
const nodes = manifest.screenshots.map((screenshot) => {
  const journey = pickJourney(screenshot.slug)
  const index = perJourneyIndex.get(journey.id) ?? 0
  perJourneyIndex.set(journey.id, index + 1)
  const column = index % 6
  const row = Math.floor(index / 6)
  const layout = journeyLayout.get(journey.id)

  return {
    id: `screen-${screenshot.id}`,
    screenshotId: screenshot.id,
    slug: screenshot.slug,
    title: screenshot.title,
    journey: journey.id,
    type: typeFor(screenshot.title, screenshot.slug),
    risk: riskFor(screenshot.title, screenshot.slug),
    image: `../screenshots/${screenshot.id}-${screenshot.slug}.webp`,
    absoluteImage: path.join(root, 'screenshots', `${screenshot.id}-${screenshot.slug}.webp`),
    position: {
      x: column * 340,
      y: layout.yOffset + row * 360,
    },
    notes: [],
    actions: [],
  }
})

const edges = []
const groupedNodes = Map.groupBy(nodes, (node) => node.journey)

for (const [journeyId, group] of groupedNodes) {
  for (let i = 0; i < group.length - 1; i += 1) {
    edges.push({
      id: `${group[i].id}-${group[i + 1].id}`,
      source: group[i].id,
      target: group[i + 1].id,
      label: 'next captured state',
      journey: journeyId,
      inferred: true,
    })
  }
}

const explicitEdges = [
  ['screen-001', 'screen-003', 'open Bible'],
  ['screen-003', 'screen-056', 'Annoter'],
  ['screen-056', 'screen-274', 'Note'],
  ['screen-274', 'screen-275', 'expand context'],
  ['screen-139', 'screen-271', 'Study'],
  ['screen-271', 'screen-272', 'style menu'],
  ['screen-271', 'screen-273', 'more formatting'],
  ['screen-003', 'screen-098', 'Étudier'],
  ['screen-098', 'screen-105', 'add to study'],
  ['screen-105', 'screen-106', 'choose insertion mode'],
  ['screen-106', 'screen-107', 'confirm add'],
]

for (const [source, target, label] of explicitEdges) {
  if (nodes.some((node) => node.id === source) && nodes.some((node) => node.id === target)) {
    edges.push({
      id: `${source}-${target}-explicit`,
      source,
      target,
      label,
      journey: 'curated',
      inferred: false,
    })
  }
}

const data = {
  version: 1,
  generatedFrom: 'docs/assets/app-flows/data/screenshots.json',
  generatedAt: new Date().toISOString(),
  description: 'Agent-friendly app-flow graph. Inferred edges preserve capture order inside each journey; explicit edges model known transitions.',
  journeys: [...journeysById.values()],
  nodes,
  edges,
  riskLegend: {
    safe: 'Read-only or low-risk state.',
    mutating: 'Can create, edit, download, copy, or otherwise change local/app state.',
    destructive: 'Can delete, reset, stop, or remove user/app data.',
    external: 'Leaves the app, opens native share, or triggers an external destination.',
  },
}

fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`)
console.log(`Generated ${nodes.length} nodes and ${edges.length} edges at ${outputPath}`)
