export const diagnosticCategories = [
  'shorelines',
  'navigation',
  'occluders',
  'particles',
  'butterfly',
  'dragonfly',
  'light',
  'fish',
  'duck',
  'cat',
] as const
export type DiagnosticCategory = (typeof diagnosticCategories)[number]
export type DiagnosticFilters = Record<DiagnosticCategory, boolean>
export const makeDiagnosticFilters = (enabled = true): DiagnosticFilters =>
  Object.fromEntries(diagnosticCategories.map(category => [category, enabled])) as DiagnosticFilters
export const diagnosticCopy = {
  fr: {
    title: 'Zones affichées',
    all: 'Tout',
    none: 'Aucun',
    shorelines: 'Rivages',
    navigation: 'Navigation',
    occluders: 'Décor',
    particles: 'Particules',
    butterfly: 'Papillons',
    dragonfly: 'Libellules',
    light: 'Lueurs',
    fish: 'Poissons',
    duck: 'Canard',
    cat: 'Chat',
  },
  en: {
    title: 'Visible zones',
    all: 'All',
    none: 'None',
    shorelines: 'Shorelines',
    navigation: 'Navigation',
    occluders: 'Scenery',
    particles: 'Particles',
    butterfly: 'Butterflies',
    dragonfly: 'Dragonflies',
    light: 'Glows',
    fish: 'Fish',
    duck: 'Duck',
    cat: 'Cat',
  },
}
