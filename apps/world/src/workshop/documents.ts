// Project documents the workshops save through the Vite dev server, one entry per file. The dev
// server validates each body with `parse` before writing it under public/; production has no
// such endpoint (scripts/check-production-build.mjs). A new world adds its entries here.
import { parseAmbientZones } from '../ambient-zones'
import { parseNavigation } from '../navigation-document'
import { parseShorelines } from '../shorelines'
import { parseEffects, parseLayout, VALENCE_NAVIGATION } from '../valence/valence-documents'

export type WorkshopDocument = { endpoint: string; file: string; parse: (value: unknown) => unknown }

/** The documents every world edits with the shared tabs, under one folder of public/. */
function worldDocuments(world: string, folder: string, parseNavigationDocument: (value: unknown) => unknown) {
  return {
    navigation: { endpoint: `/__study-world/${world}/navigation`, file: `public/${folder}/navigation.json`, parse: parseNavigationDocument },
    shorelines: { endpoint: `/__study-world/${world}/shorelines`, file: `public/${folder}/shorelines.json`, parse: parseShorelines },
    ambience: { endpoint: `/__study-world/${world}/ambience`, file: `public/${folder}/ambience.json`, parse: parseAmbientZones },
  } satisfies Record<string, WorkshopDocument>
}

export const archipelagoDocuments = {
  // The archipelago's files predate the per-world folders; their addresses stay.
  navigation: { endpoint: '/__study-world/navigation', file: 'public/navigation/archipelago.json', parse: (value: unknown) => parseNavigation(value) },
  shorelines: { endpoint: '/__study-world/shorelines', file: 'public/shorelines/archipelago.json', parse: parseShorelines },
  ambience: { endpoint: '/__study-world/ambience', file: 'public/ambience/archipelago.json', parse: parseAmbientZones },
} satisfies Record<string, WorkshopDocument>

export const valenceDocuments = {
  ...worldDocuments('valence-1876', 'valence-1876', value => parseNavigation(value, VALENCE_NAVIGATION)),
  layout: { endpoint: '/__study-world/valence-1876/layout', file: 'public/valence-1876/layout.json', parse: parseLayout },
  effects: { endpoint: '/__study-world/valence-1876/effects', file: 'public/valence-1876/effects.json', parse: parseEffects },
} satisfies Record<string, WorkshopDocument>

export const workshopDocuments: WorkshopDocument[] = [
  ...Object.values(archipelagoDocuments),
  ...Object.values(valenceDocuments),
]
