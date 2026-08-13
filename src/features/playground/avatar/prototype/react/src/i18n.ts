import { createContext, createElement, useContext, useState, type ReactNode } from 'react'

export type StudioLanguage = 'en' | 'fr'

const english: Record<string, string> = {
  'Langue de l’interface': 'Interface language',
  'Nom de l’avatar': 'Avatar name',
  sélecteur: 'picker',
  hexadécimal: 'hex value',
  'Lier width': 'Link widths',
  'Lier height': 'Link heights',
  'Lier size': 'Link sizes',
  'Lier la position des yeux': 'Link eye positions',
  'Glisser horizontalement pour modifier': 'Drag horizontally to adjust',
  'En lecture': 'Playing',
  'En pause': 'Paused',
  'Réinitialiser la rotation de la tête': 'Reset head rotation',
  'Réinitialiser la position et la rotation de': 'Reset position and rotation of',
  'Avatar procédural': 'Procedural avatar',
  'Gizmo de rotation': 'Rotation gizmo',
  'Retour aux expressions': 'Back to expressions',
  'Retour au studio': 'Back to studio',
  'Preset en mémoire': 'Saved preset',
  'Nouvelle expression': 'New expression',
  'L’avatar à gauche affiche cette expression en direct.':
    'The avatar on the left previews this expression live.',
  Corps: 'Body',
  'Apparence et orientation générale de l’avatar.': 'General avatar appearance and orientation.',
  'Couleur du corps': 'Body color',
  'Rotation de la tête': 'Head rotation',
  Yeux: 'Eyes',
  'Forme, placement et orientation propres au regard.': 'Eye shape, placement and orientation.',
  'Couleur des yeux': 'Eye color',
  Largeur: 'Width',
  Hauteur: 'Height',
  'Taille proportionnelle': 'Proportional size',
  'Œil gauche': 'Left eye',
  'Œil droit': 'Right eye',
  'Position et espacement': 'Position and spacing',
  Horizontale: 'Horizontal',
  Verticale: 'Vertical',
  Espacement: 'Spacing',
  'Rotation locale': 'Local rotation',
  Projection: 'Projection',
  'Perspective appliquée à la surface active.': 'Perspective applied to the active surface.',
  Perspective: 'Perspective',
  Supprimer: 'Delete',
  Enregistrer: 'Save',
  'Construction du corps': 'Body construction',
  'Choisis la forme principale puis assemble les primitives autour d’elle.':
    'Choose the primary shape, then assemble primitives around it.',
  'Choisir un avatar': 'Choose an avatar',
  'Double-clic pour modifier': 'Double-click to edit',
  'Nouvel avatar': 'New avatar',
  Modifier: 'Edit',
  'Mode d’édition': 'Editing mode',
  Pose: 'Pose',
  Expressions: 'Expressions',
  États: 'States',
  'Construction, forme et couleur de la tête de l’avatar.':
    'Build, shape and color of the avatar head.',
  'Une forme principale porte les yeux. Les autres primitives se placent autour d’elle.':
    'One primary shape carries the eyes. Other primitives are placed around it.',
  'Forme principale': 'Primary shape',
  'porte les yeux': 'carries the eyes',
  'Ajouter une forme': 'Add a shape',
  Dupliquer: 'Duplicate',
  'Gizmo local': 'Local gizmo',
  'Déplacer dans le plan de la caméra': 'Move in camera plane',
  Transformer: 'Transform',
  copie: 'copy',
  'Glisse un axe pour déplacer la forme, ou un anneau pour la faire tourner.':
    'Drag an axis to move the shape, or a ring to rotate it.',
  Profondeur: 'Depth',
  'Position locale': 'Local position',
  'Cette surface est la référence du visage et porte les yeux.':
    'This surface is the face reference and carries the eyes.',
  'Rondeur des arêtes': 'Edge roundness',
  Rondeur: 'Roundness',
  'Rondeur morphologique': 'Morph roundness',
  'Rondeur de la pointe': 'Tip roundness',
  'Rondeur de la base': 'Base roundness',
  'Rondeur globale': 'Global roundness',
  'Rondeur pointe': 'Tip roundness',
  'Rondeur base': 'Base roundness',
  'Couleur de base utilisée par les poses et les expressions.':
    'Base color used by poses and expressions.',
  'Forme, placement, orientation et couleur du regard par défaut.':
    'Default eye shape, placement, orientation and color.',
  'Définis l’identité du regard de cet avatar. Les poses s’ajoutent ensuite à cette base.':
    'Define this avatar’s default eyes. Poses are then applied on top of this base.',
  'Coordonnées propres à l’avatar, indépendantes des poses.':
    'Avatar-specific coordinates, independent from poses.',
  'Inclinaison par défaut propre à chaque œil.': 'Default tilt for each eye.',
  'Orientation et apparence générale de la pose.': 'General pose orientation and appearance.',
  'La pose peut remplacer temporairement la couleur de l’avatar.':
    'The pose can temporarily override the avatar color.',
  'Reprendre la couleur de l’avatar': 'Use avatar color',
  'Les libellés ↔ sont scrubbables, comme dans Figma.':
    'Labels marked ↔ can be scrubbed, like in Figma.',
  'Forme, placement, orientation et couleur du regard.':
    'Eye shape, placement, orientation and color.',
  'Coordonnées communes projetées sur la forme choisie.':
    'Shared coordinates projected onto the selected shape.',
  'Inclinaison propre à chaque œil.': 'Tilt applied to each eye.',
  'Perspective et repères appliqués à la surface active.':
    'Perspective and guides applied to the active surface.',
  'Profondeur simulée du visage.': 'Simulated face depth.',
  'Afficher le maillage': 'Show wireframe',
  Réinitialiser: 'Reset',
  Mouvement: 'Motion',
  'Mouvement perpétuel': 'Perpetual motion',
  'Aucun mouvement': 'No motion',
  'Dérive lente': 'Slow drift',
  'Micro-ajustements': 'Micro-adjustments',
  Tremblement: 'Shake',
  'Ajoute une légère présence ou un tremblement continu au corps.':
    'Adds a subtle living presence or a continuous shake to the body.',
  'Anime le regard par petites saccades naturelles ou par tremblement.':
    'Animates the gaze with natural micro-saccades or a continuous shake.',
  'Motion interpole les valeurs et notre moteur effectue le slerp quaternion.':
    'Motion interpolates values while the engine performs quaternion slerp.',
  'Vitesse du ressort': 'Spring speed',
  Cligner: 'Blink',
  'Expression aléatoire': 'Random expression',
  Séquences: 'Sequences',
  'Cycle de vie': 'Life cycle',
  Réactions: 'Reactions',
  'États animés': 'Animated states',
  'Cet état enchaîne un pool de presets et des clignements.':
    'This state cycles through presets and blinks.',
  'Expressions de la séquence': 'Sequence expressions',
  'Les presets sont joués dans cet ordre, puis la boucle recommence.':
    'Presets play in this order, then the loop starts again.',
  'Logique de clignement': 'Blink behavior',
  'Le rythme reste naturel grâce à un intervalle légèrement aléatoire.':
    'A slightly randomized interval keeps the rhythm natural.',
  'Premier clignement': 'First blink',
  'après le lancement': 'after launch',
  Intervalle: 'Interval',
  'tirage aléatoire': 'randomized',
  Durée: 'Duration',
  'fermeture et ouverture': 'close and open',
  'Changement d’expression': 'Expression change',
  'cadence de la séquence': 'sequence tempo',
  Relancer: 'Restart',
  Lancer: 'Play',
  Pause: 'Pause',
  Reprendre: 'Resume',
  Annuler: 'Cancel',
  'Supprimer cette expression ?': 'Delete this expression?',
  'Cette action retirera définitivement le preset de la bibliothèque globale.':
    'This permanently removes the preset from the global library.',
  'Le corps et les couleurs de cet avatar seront définitivement supprimés. Les expressions globales seront conservées.':
    'This avatar’s body and colors will be permanently deleted. Global expressions will be kept.',
  'Glisse sur la surface pour orienter la tête. Les anneaux du gizmo contrôlent X, Y et Z.':
    'Drag on the surface to orient the head. The gizmo rings control X, Y and Z.',
  Sphère: 'Sphere',
  Curseur: 'Cursor',
  Cylindre: 'Cylinder',
  Cône: 'Cone',
  Diamant: 'Diamond',
  'Yeux presque fermés, respiration lente et expression de sommeil.':
    'Nearly closed eyes, slow breathing and a sleepy expression.',
  'Séquence courte de réveil avant retour vers une expression neutre.':
    'Short waking sequence before returning to a neutral expression.',
  'Micro-mouvements lents, expressions 00 et 08, clignement rare.':
    'Slow micro-movements, expressions 00 and 08, infrequent blinking.',
  'Expressions 10, 01 et 19, regard stable et clignement attentif.':
    'Expressions 10, 01 and 19, steady gaze and attentive blinking.',
  'Regard haut et latéral, expressions asymétriques et changements fréquents.':
    'Upward side gaze, asymmetric expressions and frequent changes.',
  'Balayage rapide et changements très fréquents.': 'Fast scanning and very frequent changes.',
  'Rythme régulier, regard concentré et micro-variations.':
    'Steady rhythm, focused gaze and subtle variations.',
  'Grandes expressions positives et mouvements rapides.':
    'Big positive expressions and fast movements.',
  'Inclinaisons et rotations rapides pour simuler un agent en mouvement.':
    'Fast tilts and rotations to simulate a moving agent.',
  'Rythme régulier et expressions concentrées.': 'Steady rhythm and focused expressions.',
  'Grandes expressions et transitions rapides.': 'Big expressions and fast transitions.',
  'Inclinaisons et forte asymétrie.': 'Tilts and strong asymmetry.',
  sleeping: 'sleeping',
  waking: 'waking',
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  searching: 'searching',
  working: 'working',
  excited: 'excited',
  surprised: 'surprised',
  suspicious: 'suspicious',
  angry: 'angry',
  drowsy: 'drowsy',
  happy: 'happy',
  curious: 'curious',
  confused: 'confused',
  bored: 'bored',
  proud: 'proud',
  shy: 'shy',
  sad: 'sad',
  laughing: 'laughing',
  scared: 'scared',
  playful: 'playful',
  celebrate: 'celebrate',
  orbit: 'orbit',
  radar: 'radar',
  progress: 'progress',
  spawning: 'spawning',
  humming: 'humming',
  loading: 'loading',
  dictating: 'dictating',
  writing: 'writing',
  sending: 'sending',
  receiving: 'receiving',
  uploading: 'uploading',
  notifying: 'notifying',
  alerting: 'alerting',
  dragging: 'dragging',
  bouncing: 'bouncing',
  'powering-down': 'powering down',
}

const frenchStates: Record<string, string> = {
  sleeping: 'sommeil',
  waking: 'réveil',
  idle: 'au repos',
  listening: 'écoute',
  thinking: 'réflexion',
  searching: 'recherche',
  working: 'travail',
  excited: 'enthousiaste',
  surprised: 'surpris',
  suspicious: 'méfiant',
  angry: 'en colère',
  drowsy: 'somnolent',
  happy: 'heureux',
  curious: 'curieux',
  confused: 'confus',
  bored: 'ennuyé',
  proud: 'fier',
  shy: 'timide',
  sad: 'triste',
  laughing: 'rire',
  scared: 'effrayé',
  playful: 'joueur',
  celebrate: 'célébration',
  orbit: 'orbite',
  radar: 'radar',
  progress: 'progression',
  spawning: 'apparition',
  humming: 'fredonnement',
  loading: 'chargement',
  dictating: 'dictée',
  writing: 'écriture',
  sending: 'envoi',
  receiving: 'réception',
  uploading: 'téléversement',
  notifying: 'notification',
  alerting: 'alerte',
  dragging: 'glissement',
  bouncing: 'rebond',
  'powering-down': 'extinction',
}

const dynamicTranslations: Array<[RegExp, string]> = [
  [/^Modifier l’expression (.+)$/, 'Edit expression $1'],
  [/^Modifier (.+)$/, 'Edit $1'],
  [/^Supprimer (.+) \?$/, 'Delete $1?'],
  [/^Ajouter une forme · (.+)$/, 'Add a shape · $1'],
  [/^Réinitialiser la position et la rotation de (.+)$/, 'Reset position and rotation of $1'],
  [/^État en cours : (.+)$/, 'Active state: $1'],
  [/^Mettre (.+) en pause$/, 'Pause $1'],
  [/^Reprendre (.+)$/, 'Resume $1'],
  [/^Arrêter (.+)$/, 'Stop $1'],
  [/^(.+) expressions$/, '$1 expressions'],
]

export const translateStudioText = (text: string, language: StudioLanguage) => {
  if (language === 'fr') return frenchStates[text] ?? text
  const exact = english[text]
  if (exact) return exact
  for (const [pattern, replacement] of dynamicTranslations) {
    if (pattern.test(text)) return text.replace(pattern, replacement)
  }
  return Object.entries(english)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((translated, [source, replacement]) => translated.replaceAll(source, replacement), text)
}

type StudioLanguageContextValue = {
  language: StudioLanguage
  setLanguage: (language: StudioLanguage) => void
  t: (text: string) => string
}

const StudioLanguageContext = createContext<StudioLanguageContextValue | null>(null)

export function StudioLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<StudioLanguage>('en')
  return createElement(
    StudioLanguageContext.Provider,
    { value: { language, setLanguage, t: text => translateStudioText(text, language) } },
    children
  )
}

export const useStudioLanguage = () => {
  const context = useContext(StudioLanguageContext)
  if (!context) throw new Error('useStudioLanguage must be used inside StudioLanguageProvider')
  return context
}
