export type ControlledTopicAlias = {
  topic: string
  preferredLabel: string
  aliases: readonly string[]
}

// This is deliberately small and editorial. Additions must be reviewed rather than silently
// translating the complete English source catalog.
export const CONTROLLED_FRENCH_TOPIC_ALIASES: readonly ControlledTopicAlias[] = [
  {
    topic: 'anxiety',
    preferredLabel: 'Anxiété / Inquiétude',
    aliases: ['anxiété', 'angoisse', 'stress', 'être anxieux', 'peur du lendemain'],
  },
  {
    topic: 'worry',
    preferredLabel: 'Inquiétude / Soucis',
    aliases: [
      'inquiétude',
      'souci',
      'soucis',
      'être inquiet',
      'je suis inquiet pour demain',
      'je n’arrive pas à dormir à cause de mes soucis',
    ],
  },
  {
    topic: 'loneliness',
    preferredLabel: 'Solitude',
    aliases: ['solitude', 'être seul', 'se sentir seul', 'isolement', 'abandon'],
  },
  {
    topic: 'grief',
    preferredLabel: 'Deuil / Chagrin',
    aliases: ['deuil', 'chagrin', 'perte d’un proche', 'faire son deuil'],
  },
  {
    topic: 'forgiveness',
    preferredLabel: 'Pardon',
    aliases: ['pardon', 'pardonner', 'pardonner à quelqu’un', 'réconciliation'],
  },
  {
    topic: 'fear',
    preferredLabel: 'Peur / Crainte',
    aliases: ['peur', 'crainte', 'avoir peur', 'peur de mourir'],
  },
  {
    topic: 'death',
    preferredLabel: 'Mort',
    aliases: ['mort', 'mourir', 'décès', 'fin de vie'],
  },
  {
    topic: 'trust',
    preferredLabel: 'Confiance en Dieu',
    aliases: ['confiance', 'confiance en Dieu', 'se confier en Dieu'],
  },
  {
    topic: 'faith',
    preferredLabel: 'Foi',
    aliases: ['foi', 'croire en Dieu', 'avoir la foi'],
  },
  {
    topic: 'anger',
    preferredLabel: 'Colère',
    aliases: ['colère', 'rage', 'être en colère'],
  },
  {
    topic: 'love',
    preferredLabel: 'Amour',
    aliases: ['amour', 'aimer', 'amour de Dieu', 'amour du prochain'],
  },
  {
    topic: 'sleep',
    preferredLabel: 'Sommeil',
    aliases: ['sommeil', 'dormir', 'insomnie', 'ne pas réussir à dormir'],
  },
  {
    topic: 'condemnation',
    preferredLabel: 'Condamnation',
    aliases: ['condamnation', 'condamner', 'être condamné'],
  },
]
