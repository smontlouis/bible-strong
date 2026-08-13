import type { Expression } from './geometry'

const calibrated: number[][] = [
  [7.3, 27.8, -16.1, 24.2, 27.6, 38.9, 40.7, 54.3, -20.5, 0, 0],
  [-35.6, 0.7, -8.5, 29.4, 27.3, 49.5, 49.8, 57.7, -42, 0, 0],
  [-36.2, 13.1, 15.5, 44.3, 51.3, 74.2, 76, 68.7, -40.7, 0, 0],
  [15.6, -16.5, -11.3, 54, 51, 49.6, 48.5, 70.9, 30.1, 0, 0],
  [3.4, 13, 8.9, 42.6, 44, 17.3, 16, 57.9, 4.9, 0, 0],
  [-17.7, -1.4, -8.8, 29.5, 19.2, 51.6, 41.9, 56.3, 0, 0, 90],
  [14.8, 14.5, 5.5, 22.9, 22.2, 32.4, 33.4, 50.9, 39.2, 0, 0],
  [25.7, 16.5, -13.5, 48.5, 48.3, 33.5, 33, 53.3, 41.3, 61.3, -80],
  [-22.8, -15.9, 6.2, 44.5, 43.9, 32.3, 24.6, 54.9, -42, -60.9, 69.2],
  [-11.6, 8.3, -12.7, 42.5, 22.1, 41.8, 22.2, 61.7, 12.3, 0, 0],
  [20.3, 7, 8.7, 30.2, 28.1, 48.8, 49.2, 56.8, 39.9, 0, 0],
  [17.5, -15.2, -8.7, 51, 49.2, 75.3, 73.4, 70.2, 41.6, 0, 0],
  [-10.4, 15.2, 11.8, 50.6, 51.6, 50, 50.7, 69.5, 16.7, 0, 0],
  [-6, -7.7, -9.4, 43.6, 42.8, 15.5, 18.1, 57.9, 3.5, 0, 0],
  [0.2, -3.1, 9, 29.6, 16.8, 51.5, 41.3, 56.4, -7.8, 0, 90],
  [-16.2, 38.4, 2.4, 23.7, 26.2, 32.7, 34.6, 53.9, -41.1, 0, 0],
  [3.5, -16.1, 15.8, 51, 48.5, 34.9, 33, 55.1, 41.9, 80, -62.2],
  [-17.3, 11.2, -9.1, 24.2, 44.5, 44.5, 32.2, 55, -36.5, 18.5, 67.9],
  [-0.7, 3.6, 12.2, 42.1, 22.2, 41.7, 22.1, 60.4, -9.1, 0, 0],
  [-25.3, -12.4, -13.3, 30.5, 26.8, 49.9, 48.8, 56.2, -35.8, 0, 0],
  [-41.1, 20.2, 18.8, 44.6, 53, 74.9, 77.8, 70.8, -40.6, 0, 0],
  [-14.6, -12.5, -16.1, 51.4, 50.5, 50.1, 49.4, 69, -20, 0, 0],
  [10, 2.7, 8.8, 42.9, 43.3, 16.4, 17.8, 57.9, 2.7, 0, 0],
  [-17.8, 10, -6.3, 28.8, 17.3, 51.4, 42.7, 56.6, -9.8, 0, 90],
  [-29.6, 7.5, 10.1, 21.5, 23.2, 32, 33.5, 51.2, -37.4, 0, 0],
]

export const initialExpressions: Expression[] = calibrated.map(
  ([
    headX,
    headY,
    headZ,
    widthLeft,
    widthRight,
    heightLeft,
    heightRight,
    spacing,
    latitude,
    leftAngle,
    rightAngle,
  ]) => ({
    headX,
    headY,
    headZ,
    widthLeft,
    widthRight,
    heightLeft,
    heightRight,
    spacing,
    positionXLeft: 0,
    positionXRight: 0,
    positionYLeft: latitude,
    positionYRight: latitude,
    leftAngle,
    rightAngle,
    perspective: 1,
  })
)

export const defaultExpression: Expression = {
  headX: 0,
  headY: 0,
  headZ: 0,
  widthLeft: 20,
  widthRight: 20,
  heightLeft: 50,
  heightRight: 50,
  spacing: 35,
  positionXLeft: 0,
  positionXRight: 0,
  positionYLeft: -7,
  positionYRight: -7,
  leftAngle: 0,
  rightAngle: 0,
  perspective: 1,
}

export const stateGroups = {
  'Cycle de vie': ['sleeping', 'waking', 'idle', 'listening', 'thinking', 'searching', 'working'],
  Réactions: [
    'excited',
    'surprised',
    'suspicious',
    'angry',
    'drowsy',
    'happy',
    'curious',
    'confused',
    'bored',
    'proud',
    'shy',
    'sad',
    'laughing',
    'scared',
    'playful',
    'celebrate',
  ],
  'Morphes agent': ['orbit', 'radar', 'progress'],
  'Cycle produit': [
    'spawning',
    'humming',
    'loading',
    'dictating',
    'writing',
    'sending',
    'receiving',
    'uploading',
    'notifying',
    'alerting',
    'dragging',
    'bouncing',
    'powering-down',
  ],
} as const

export const statePools: Record<string, number[]> = {
  sleeping: [13, 22, 4],
  waking: [13],
  idle: [0, 8],
  listening: [10, 1, 19],
  thinking: [8, 16, 14, 17, 5],
  searching: [15, 9, 3, 20, 12, 18],
  working: [7, 16, 11, 10],
  excited: [2, 17, 21, 3, 11],
  surprised: [3, 21],
  suspicious: [14, 5, 23],
  angry: [7, 16],
  drowsy: [4, 22, 13],
  happy: [2, 11, 17, 19],
  curious: [3, 21, 0, 15],
  confused: [14, 5, 8],
  bored: [4, 22, 0],
  proud: [15, 8, 2],
  shy: [0, 24, 13],
  sad: [4, 13, 22],
  laughing: [2, 11, 17],
  scared: [3, 21],
  playful: [2, 17, 11, 8],
  celebrate: [2, 8, 17],
  orbit: [0, 8],
  radar: [0, 8],
  progress: [0, 8],
  spawning: [3, 0],
  humming: [0, 8],
  loading: [0, 8],
  dictating: [10, 1, 19],
  sending: [0, 8],
  receiving: [19, 0, 8],
  uploading: [15, 9, 8],
  writing: [15, 9],
  notifying: [3, 21, 0],
  alerting: [3, 21],
  bouncing: [2, 17],
  dragging: [3, 15, 0],
  'powering-down': [13, 22],
}

export type StatePlaybackConfig = {
  expressionIntervalMs: number
  blink: {
    initialDelayMs: number
    minIntervalMs: number
    maxIntervalMs: number
    durationMs: number
  }
}

const blinkProfiles = {
  natural: {
    initialDelayMs: 2600,
    minIntervalMs: 3400,
    maxIntervalMs: 6200,
    durationMs: 280,
  },
  calm: {
    initialDelayMs: 4800,
    minIntervalMs: 6500,
    maxIntervalMs: 9500,
    durationMs: 420,
  },
  attentive: {
    initialDelayMs: 3200,
    minIntervalMs: 4800,
    maxIntervalMs: 7200,
    durationMs: 240,
  },
  active: {
    initialDelayMs: 2100,
    minIntervalMs: 2800,
    maxIntervalMs: 5000,
    durationMs: 260,
  },
  reactive: {
    initialDelayMs: 1200,
    minIntervalMs: 1800,
    maxIntervalMs: 3600,
    durationMs: 220,
  },
} as const

const calmStates = new Set(['sleeping', 'drowsy', 'bored', 'sad', 'powering-down'])
const attentiveStates = new Set(['listening', 'dictating', 'receiving', 'humming'])
const reactiveStates = new Set([
  'waking',
  'excited',
  'surprised',
  'laughing',
  'scared',
  'celebrate',
  'alerting',
  'bouncing',
])

export const getStatePlaybackConfig = (name: string): StatePlaybackConfig => {
  const blink =
    name === 'idle'
      ? blinkProfiles.natural
      : calmStates.has(name)
        ? blinkProfiles.calm
        : attentiveStates.has(name)
          ? blinkProfiles.attentive
          : reactiveStates.has(name)
            ? blinkProfiles.reactive
            : blinkProfiles.active
  return {
    expressionIntervalMs: name === 'idle' ? 5200 : calmStates.has(name) ? 3600 : 2300,
    blink: { ...blink },
  }
}

export const stateNotes: Record<string, string> = {
  sleeping: 'Yeux presque fermés, respiration lente et expression de sommeil.',
  waking: 'Séquence courte de réveil avant retour vers une expression neutre.',
  idle: 'Micro-mouvements lents, expressions 00 et 08, clignement rare.',
  listening: 'Expressions 10, 01 et 19, regard stable et clignement attentif.',
  thinking: 'Regard haut et latéral, expressions asymétriques et changements fréquents.',
  searching: 'Balayage rapide et changements très fréquents.',
  working: 'Rythme régulier et expressions concentrées.',
  excited: 'Grandes expressions et transitions rapides.',
  curious: 'Inclinaisons et forte asymétrie.',
}
