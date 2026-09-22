export const REACTIONS = ['hello', 'love', 'laugh', 'wow', 'think', 'sad', 'bravo'] as const
export type ReactionId = (typeof REACTIONS)[number]
export const REACTION_DURATION_MS = 3000
export const REACTION_COOLDOWN_MS = 1500
export function isReaction(value: unknown): value is ReactionId {
  return typeof value === 'string' && REACTIONS.some(id => id === value)
}
export function reactionAsset(id: ReactionId, layer: 'body' | 'detail') {
  return `/assets/reactions/slime/${id}-${layer}.webp`
}
export const reactionCopy = {
  fr: {
    title: 'Réactions',
    sent: 'Réaction envoyée',
    unavailable: 'Reconnecte-toi pour envoyer une réaction.',
    hello: 'Coucou',
    love: 'J’adore',
    laugh: 'Trop drôle',
    wow: 'Waouh',
    think: 'Je réfléchis',
    sad: 'Triste',
    bravo: 'Bravo',
  },
  en: {
    title: 'Reactions',
    sent: 'Reaction sent',
    unavailable: 'Reconnect to send a reaction.',
    hello: 'Hello',
    love: 'Love it',
    laugh: 'So funny',
    wow: 'Wow',
    think: 'Thinking',
    sad: 'Sad',
    bravo: 'Well done',
  },
}
