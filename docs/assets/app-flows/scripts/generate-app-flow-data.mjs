import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifestPath = path.join(root, 'data', 'screenshots.json')
const curatedFlowsPath = path.join(root, 'data', 'curated-flows.json')
const outputPath = path.join(root, 'data', 'app-flows.json')

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const curatedSource = fs.existsSync(curatedFlowsPath)
  ? JSON.parse(fs.readFileSync(curatedFlowsPath, 'utf8'))
  : { surfaces: [], flows: [] }

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
    match:
      /(bible-reader|bible-book|bible-chapter|bible-version|version-picker|reader-|parallel|pericope|compare-verses|compare-version|color-palette|verse-labels|cross-version|original-bhs)/,
  },
  {
    id: 'selected-verse',
    title: 'Actions sur verset',
    description: 'Étudier, annoter, partager, lier et ajouter un verset à une étude.',
    match:
      /(selected-verse|selected-verses|verse-note|verse-tags|verse-link|verse-bookmark|verse-add|verse-strong)/,
  },
  {
    id: 'notes-links-tags',
    title: 'Notes, liens et tags',
    description: 'Collections utilisateur, détail, édition, filtres, tags et confirmations.',
    match:
      /(notes|note-|annotation-note|links|link-|tags|tag-|bookmark|highlight|annotation-|word-annotation)/,
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
    match:
      /(download|nave|dictionary|lexique|strong|concordance|commentary|commentaries|resource-language|default-bible)/,
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
    match:
      /(more|profile|forgot-password|language|theme|backup|export|import|password|logout|delete-account|faq|changelog|rate-app|share-app|updates|nuke|automatic-backup)/,
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
  if (
    /(share sheet|handoff|store|facebook|paypal|tipeee|github|audibible|external|export)/.test(text)
  )
    return 'external'
  if (
    /(edit|editor|create|creation|rename|save|tag editing|selector|download progress|download success|installed|copy|confirmation|add|restore|redownload|clear|new-study|group result)/.test(
      text
    )
  ) {
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

const pickJourney = slug =>
  journeyRules.find(journey => journey.match.test(slug)) ?? fallbackJourney

const toNodeId = id => (String(id).startsWith('screen-') ? String(id) : `screen-${id}`)

const curatedFlows = (curatedSource.flows ?? []).map(flow => {
  const edgeNodeIds = (flow.edges ?? []).flatMap(edge => [edge.source, edge.target])
  const nodeIds = [...new Set([...(flow.nodes ?? []), ...edgeNodeIds].map(toNodeId))]
  const edges = (flow.edges ?? []).map((edge, index) => ({
    id: `${flow.id}-${toNodeId(edge.source)}-${toNodeId(edge.target)}-${index}`,
    source: toNodeId(edge.source),
    target: toNodeId(edge.target),
    label: edge.label,
  }))

  return {
    ...flow,
    nodes: nodeIds,
    edges,
  }
})

const surfaceById = new Map((curatedSource.surfaces ?? []).map(surface => [surface.id, surface]))
const flowIdsByNode = new Map()
const surfaceIdsByNode = new Map()

for (const flow of curatedFlows) {
  for (const nodeId of flow.nodes) {
    if (!flowIdsByNode.has(nodeId)) flowIdsByNode.set(nodeId, [])
    flowIdsByNode.get(nodeId).push(flow.id)

    if (!surfaceIdsByNode.has(nodeId)) surfaceIdsByNode.set(nodeId, new Set())
    surfaceIdsByNode.get(nodeId).add(flow.surface)
  }
}

const journeysById = new Map(
  [...journeyRules, fallbackJourney].map(journey => [
    journey.id,
    {
      id: journey.id,
      title: journey.title,
      description: journey.description,
    },
  ])
)

const screenshotsByJourney = Map.groupBy(
  manifest.screenshots,
  screenshot => pickJourney(screenshot.slug).id
)
const journeyLayout = new Map()
let yOffset = 0

for (const journey of journeysById.values()) {
  const count = screenshotsByJourney.get(journey.id)?.length ?? 0
  const rows = Math.max(1, Math.ceil(count / 6))
  journeyLayout.set(journey.id, { yOffset, rows })
  yOffset += rows * 360 + 260
}

const perJourneyIndex = new Map()
const nodes = manifest.screenshots.map(screenshot => {
  const journey = pickJourney(screenshot.slug)
  const id = `screen-${screenshot.id}`
  const index = perJourneyIndex.get(journey.id) ?? 0
  perJourneyIndex.set(journey.id, index + 1)
  const column = index % 6
  const row = Math.floor(index / 6)
  const layout = journeyLayout.get(journey.id)

  return {
    id,
    screenshotId: screenshot.id,
    slug: screenshot.slug,
    title: screenshot.title,
    journey: journey.id,
    surface: [...(surfaceIdsByNode.get(id) ?? [])][0] ?? journey.id,
    surfaces: [...(surfaceIdsByNode.get(id) ?? [])],
    flows: flowIdsByNode.get(id) ?? [],
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
const groupedNodes = Map.groupBy(nodes, node => node.journey)

for (const [journeyId, group] of groupedNodes) {
  for (let i = 0; i < group.length - 1; i += 1) {
    edges.push({
      id: `${group[i].id}-${group[i + 1].id}`,
      source: group[i].id,
      target: group[i + 1].id,
      label: 'next captured state',
      journey: journeyId,
      relation: 'capture-order',
      inferred: true,
    })
  }
}

const validNodeIds = new Set(nodes.map(node => node.id))
const missingCuratedRefs = []

for (const flow of curatedFlows) {
  for (const nodeId of flow.nodes) {
    if (!validNodeIds.has(nodeId)) missingCuratedRefs.push(`${flow.id}: ${nodeId}`)
  }

  for (const edge of flow.edges) {
    if (validNodeIds.has(edge.source) && validNodeIds.has(edge.target)) {
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        journey: flow.id,
        flowId: flow.id,
        surface: flow.surface,
        relation: 'user-action',
        inferred: false,
      })
    } else {
      missingCuratedRefs.push(`${flow.id}: ${edge.source} -> ${edge.target}`)
    }
  }
}

if (missingCuratedRefs.length > 0) {
  throw new Error(
    `curated-flows.json references missing screenshots:\n${missingCuratedRefs.join('\n')}`
  )
}

const data = {
  version: 1,
  generatedFrom: 'docs/assets/app-flows/data/screenshots.json',
  curatedFrom: 'docs/assets/app-flows/data/curated-flows.json',
  generatedAt: new Date().toISOString(),
  description:
    'Agent-friendly app-flow graph. Capture-order edges preserve screenshot inventory order; curated flow edges model intentional user transitions.',
  surfaces: curatedSource.surfaces ?? [],
  flows: curatedFlows.map(flow => ({
    id: flow.id,
    title: flow.title,
    surface: flow.surface,
    surfaceTitle: surfaceById.get(flow.surface)?.title ?? flow.surface,
    description: flow.description,
    nodes: flow.nodes,
    edges: flow.edges.map(edge => edge.id),
  })),
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
