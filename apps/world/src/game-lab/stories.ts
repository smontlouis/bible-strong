import { createSoloRun, resumeSolo, pauseSolo, submitSolo, settleSolo } from '../solo-game'
import type {
  GameView,
  SoloReviewItem,
  GameOptions,
  GameInvitation,
  GameError,
  GameAction,
} from '../games-protocol'

export const stories = [
  ['station', 'Solo', 'Borne · entrée dans les jeux'],
  ['solo-choose', 'Solo', 'Choisir solo / ensemble'],
  ['solo-lobby', 'Solo', 'Prêt à jouer'],
  ['solo-generating', 'Solo', 'Chargement du catalogue'],
  ['solo-text', 'Solo', 'Réponse libre · clavier'],
  ['solo-clarify', 'Solo', 'Précision sans pénalité'],
  ['solo-generation-error', 'Solo', 'Préparation échouée · réessayer'],
  ['solo-question', 'Solo', 'Quatre étoiles · question'],
  ['solo-checking', 'Solo', 'Vérification · chrono suspendu'],
  ['solo-correct', 'Solo', 'Bonne réponse · série de 3'],
  ['solo-wrong', 'Solo', 'Erreur · nouvelle série'],
  ['solo-technical', 'Solo', 'Erreur technique · aucune pénalité'],
  ['solo-paused', 'Solo', 'Déconnexion · progression conservée'],
  ['solo-win', 'Solo', 'Quatre étoiles gagnées'],
  ['solo-timeout', 'Solo', 'Fin du chrono'],
  ['choose', 'Accueil', 'Choisir un jeu'],
  ['lobby', 'Accueil', 'Salon · hôte'],
  ['guest', 'Accueil', 'Salon · invité'],
  ['full', 'Accueil', 'Salon complet'],
  ['generating', 'Accueil', 'Chargement du catalogue'],
  ['generation-error', 'Accueil', 'Échec de préparation'],
  ['your-turn', 'Qui suis-je ?', 'À toi de jouer'],
  ['their-turn', 'Qui suis-je ?', 'La main à l’adversaire'],
  ['wrong', 'Qui suis-je ?', 'Mauvaise réponse'],
  ['checking', 'Qui suis-je ?', 'Vérification'],
  ['clarify', 'Qui suis-je ?', 'Précision demandée'],
  ['unavailable', 'Qui suis-je ?', 'Vérification indisponible'],
  ['urgent', 'Qui suis-je ?', 'Dernières secondes'],
  ['clue-2', 'Qui suis-je ?', 'Indice à 3 points'],
  ['clue-3', 'Qui suis-je ?', 'Indice à 2 points'],
  ['clue-4', 'Qui suis-je ?', 'Dernier indice'],
  ['race', 'Qui suis-je ?', 'Course à 3 ou 4'],
  ['blocked', 'Qui suis-je ?', 'Tentative utilisée'],
  ['quiz', 'Défi biblique', 'Réponse écrite · découverte'],
  ['quiz-text', 'Défi biblique', 'Réponse écrite · intermédiaire'],
  ['quiz-sent', 'Défi biblique', 'Attente des réponses'],
  ['quiz-win', 'Défi biblique', 'Bonne réponse'],
  ['quiz-wrong', 'Défi biblique', 'Mauvaise réponse'],
  ['win', 'Résultats', 'Victoire de manche'],
  ['other-wins', 'Résultats', 'L’autre joueur trouve'],
  ['no-winner', 'Résultats', 'Personne ne trouve'],
  ['void', 'Résultats', 'Manche annulée'],
  ['final', 'Résultats', 'Classement final'],
  ['tie', 'Résultats', 'Égalité'],
  ['zero', 'Résultats', 'Aucun point'],
  ['interrupted', 'Résultats', 'Partie interrompue'],
  ['pause', 'Connexion', 'Un joueur absent'],
  ['offline', 'Connexion', 'Connexion perdue'],
  ['notification', 'Invitations', 'Notification dans le monde'],
  ['notifications', 'Invitations', 'Trois invitations'],
  ['invitation', 'Invitations', 'Invitation ouverte'],
  ['invitation-expired', 'Invitations', 'Invitation expirée'],
  ['invitation-offline', 'Invitations', 'Invitation hors ligne'],
  ['invitation-pending', 'Invitations', 'Acceptation en cours'],
  ['invitation-full', 'Invitations', 'Salon devenu complet'],
] as const
export type StoryId = (typeof stories)[number][0]
export const flows = {
  solo: {
    name: 'Un défi solo',
    steps: [
      'solo-choose',
      'solo-lobby',
      'solo-generating',
      'solo-question',
      'solo-checking',
      'solo-correct',
      'solo-wrong',
      'solo-paused',
      'solo-win',
    ],
  },
  duel: {
    name: 'Un duel complet',
    steps: [
      'lobby',
      'generating',
      'your-turn',
      'checking',
      'wrong',
      'their-turn',
      'clue-2',
      'win',
      'final',
    ],
  },
  race: {
    name: 'Une course à plusieurs',
    steps: ['full', 'race', 'blocked', 'clue-2', 'other-wins', 'tie'],
  },
  invitation: {
    name: 'Recevoir et rejoindre',
    steps: ['notification', 'invitation', 'invitation-pending', 'guest'],
  },
  quiz: {
    name: 'Un défi biblique',
    steps: ['quiz', 'quiz-sent', 'quiz-win', 'quiz', 'quiz-wrong', 'final'],
  },
  reconnect: {
    name: 'Perdre la connexion',
    steps: ['your-turn', 'offline', 'pause', 'your-turn', 'win'],
  },
} satisfies Record<string, { name: string; steps: StoryId[] }>
export type LabConfig = { language: 'fr' | 'en'; players: number; perspective: number }
export type LabModel = {
  soloHistory?: SoloReviewItem[]
  game: GameView | null
  invitations: GameInvitation[]
  selected: GameInvitation | null
  online: boolean
  open: boolean
  now: number
  me: string
  options: GameOptions
  error: GameError | null
  invitationIssue: GameError | null
  invitationAction: { action: 'accept' | 'decline' } | null
}
export const people = ['Stéphane', 'Léa', 'Samuel', 'Miriam'].map((name, i) => ({
  id: `lab-player-${i}`,
  profile: {
    name,
    avatar: 'nova' as const,
    color: ['#ac7beb', '#e0a06b', '#73bbd4', '#82b681'][i],
  },
  score: 0,
  absentSince: null as number | null,
}))
function soloLabItem(
  round: number,
  language: 'fr' | 'en',
  status: SoloReviewItem['status'],
  text: string
): SoloReviewItem {
  const fr = language === 'fr'
  const examples = [
    {
      fr: 'Qui a conduit les Israélites hors d’Égypte ?',
      en: 'Who led the Israelites out of Egypt?',
      chapter: 3,
      verse: 10,
      explanationFr: 'Dieu envoie Moïse auprès du pharaon pour faire sortir son peuple d’Égypte.',
      explanationEn: 'God sends Moses to Pharaoh to lead his people out of Egypt.',
    },
    {
      fr: 'À qui Dieu a-t-il donné les deux tables du témoignage sur le mont Sinaï ?',
      en: 'To whom did God give the two tablets of testimony on Mount Sinai?',
      chapter: 31,
      verse: 18,
      explanationFr: 'Dieu donne les deux tables du témoignage à Moïse sur le mont Sinaï.',
      explanationEn: 'God gives the two tablets of testimony to Moses on Mount Sinai.',
    },
    {
      fr: 'Qui Dieu appelle-t-il depuis le buisson ardent ?',
      en: 'Whom does God call from the burning bush?',
      chapter: 3,
      verse: 4,
      explanationFr: 'Dieu appelle Moïse par son nom depuis le buisson.',
      explanationEn: 'God calls Moses by name from the bush.',
    },
  ]
  const q = examples[round % examples.length]
  return {
    round,
    question: fr ? q.fr : q.en,
    answer: fr ? 'Moïse' : 'Moses',
    status,
    text,
    explanation: fr ? q.explanationFr : q.explanationEn,
    sources: [
      {
        reference: `${fr ? 'Exode' : 'Exodus'} ${q.chapter}:${q.verse}`,
        url: `https://web.bible-strong.app/bible/${fr ? 'lsg' : 'kjv'}/exod/${q.chapter}/${q.verse}`,
      },
    ],
  }
}
export function finishSoloLab(model: LabModel) {
  const g = model.game!
  g.phase = 'finished'
  g.soloReview = [...(model.soloHistory ?? [])]
  if (g.solo?.outcome === 'timeout' && !g.soloReview.some(item => item.round === g.round))
    g.soloReview.push(soloLabItem(g.round, g.options.language, 'timeout', ''))
}
function completeSoloLab(model: LabModel, status: 'correct' | 'wrong' | 'skipped') {
  const g = model.game!
  ;(model.soloHistory ??= []).push(
    soloLabItem(g.round, g.options.language, status, g.ownAnswer?.text ?? '')
  )
  g.soloFeedback = { round: g.round, status, at: model.now }
  delete g.ownAnswer
  delete g.result
  if (g.solo!.outcome) finishSoloLab(model)
  else {
    g.round++
    g.phase = 'question'
    g.question = soloLabItem(g.round, g.options.language, 'correct', '').question
  }
}
export function makeStory(id: StoryId, config: LabConfig, now = Date.now()): LabModel {
  const fr = config.language === 'fr'
  const quiz = id.startsWith('quiz') || id.startsWith('solo-')
  const count =
    id === 'full'
      ? 4
      : id === 'race' || id === 'blocked'
        ? Math.max(3, config.players)
        : config.players
  const players = structuredClone(people.slice(0, count))
  players.forEach((p, i) => (p.score = i === 0 ? 4 : i === 1 ? 3 : 1))
  const me = players[Math.min(config.perspective, count - 1)].id
  const actor = players[0].id
  const options: GameOptions = {
    kind: quiz ? 'quiz' : 'who',
    difficulty: ['quiz-text', 'solo-text', 'solo-clarify'].includes(id) ? 'medium' : 'easy',
    subject: 'people',
    testament: 'both',
    language: config.language,
  }
  const zone = id === 'clue-2' ? 1 : id === 'clue-3' ? 2 : id === 'clue-4' ? 3 : 0
  const clues = fr
    ? [
        'Mon histoire commence au bord d’un fleuve, dans un panier.',
        'J’ai grandi dans la maison d’un souverain d’Égypte.',
        'Dieu m’a parlé depuis un buisson qui brûlait sans se consumer.',
        'J’ai conduit les Israélites hors d’Égypte et reçu les tables de la Loi.',
      ]
    : [
        'My story begins by a river, in a basket.',
        'I grew up in the household of an Egyptian ruler.',
        'God spoke to me from a bush that burned without being consumed.',
        'I led the Israelites out of Egypt and received the tablets of the Law.',
      ]
  const game: GameView = {
    id: `lab-game-${now}`,
    host: players[0].id,
    options,
    phase: 'question',
    players,
    round: 1,
    total: 5,
    pausedAt: null,
    pausedUntil: null,
    deadline: now + (id === 'urgent' ? 4000 : [20000, 20000, 12000, 8000][zone]),
    invited: [],
    answered: [],
    question: fr
      ? 'Qui a conduit les Israélites hors d’Égypte ?'
      : 'Who led the Israelites out of Egypt?',
    clues: quiz ? [] : clues.slice(0, zone + 1),
    ...(quiz
      ? {}
      : {
          who: {
            mode: count === 2 ? 'duel' : 'race',
            zone,
            points: 4 - zone,
            active: count === 2 ? actor : null,
            eligible: count === 2 ? [actor] : players.map(p => p.id),
            checking: [],
            frozenAt: null,
          },
        }),
  }
  const inviters = people.filter(p => p.id !== me)
  const invite: GameInvitation = {
    id: 'lab-invite-1',
    gameId: 'lab-invited-game',
    from: inviters[0].profile,
    options,
    expires: now + 60000,
  }
  const model: LabModel = {
    game,
    invitations: [],
    selected: null,
    online: true,
    open: true,
    now,
    me,
    options,
    error: null,
    invitationIssue: null,
    invitationAction: null,
  }
  if (id === 'station') {
    model.game = null
    model.open = false
    return model
  }
  if (id.startsWith('solo-')) {
    options.mode = 'solo'
    game.players = [structuredClone(players.find(p => p.id === me)!)]
    game.host = me
    game.round = 0
    game.solo = createSoloRun()
    game.question = soloLabItem(0, config.language, 'correct', '').question
    if (id === 'solo-choose') {
      model.game = null
      return model
    }
    if (id === 'solo-generation-error') {
      game.phase = 'lobby'
      game.reason = 'generation_failed'
      return model
    }
    if (id === 'solo-lobby' || id === 'solo-generating') {
      game.phase = id === 'solo-lobby' ? 'lobby' : 'generating'
      return model
    }
    resumeSolo(game.solo, 'preparing', now)
    game.solo.streak = game.solo.best = game.solo.answered = 2
    game.round = 2
    model.soloHistory = [0, 1].map(round =>
      soloLabItem(round, config.language, 'correct', fr ? 'Moïse' : 'Moses')
    )
    game.question = soloLabItem(game.round, config.language, 'correct', '').question
    if (id === 'solo-paused') {
      model.online = false
      pauseSolo(game.solo, 'away', now)
    }
    if (
      [
        'solo-checking',
        'solo-correct',
        'solo-wrong',
        'solo-technical',
        'solo-win',
        'solo-clarify',
      ].includes(id)
    ) {
      if (id === 'solo-win') {
        game.solo.streak = game.solo.best = game.solo.answered = game.round = 3
        model.soloHistory.push(soloLabItem(2, config.language, 'correct', fr ? 'Moïse' : 'Moses'))
        game.question = soloLabItem(3, config.language, 'correct', '').question
      }
      submitSolo(game.solo, 'lab-answer', now)
      game.ownAnswer = {
        text: id === 'solo-wrong' ? 'David' : fr ? 'Moïse' : 'Moses',
        status: 'pending',
        retriesLeft: 2,
      }
      if (id !== 'solo-checking') {
        const status =
          id === 'solo-technical'
            ? 'unavailable'
            : id === 'solo-clarify'
              ? 'clarify'
              : id === 'solo-wrong'
                ? 'wrong'
                : 'correct'
        settleSolo(game.solo, 'lab-answer', status, now)
        if (status === 'correct' || status === 'wrong') completeSoloLab(model, status)
        else game.ownAnswer.status = status
        if (game.solo.outcome) game.phase = 'finished'
      }
    }
    if (id === 'solo-timeout') {
      game.solo.remainingMs = 0
      game.solo.runningSince = null
      game.solo.outcome = 'timeout'
      model.soloHistory[1] = soloLabItem(1, config.language, 'wrong', 'David')
      game.solo.streak = 0
      game.solo.best = 1
      finishSoloLab(model)
    }
    return model
  }
  if (['choose', 'notification', 'notifications'].includes(id) || id.startsWith('invitation')) {
    model.game = null
    if (id !== 'choose') model.invitations = [invite]
    if (id === 'notifications')
      model.invitations.push(
        ...[2, 3].map(i => ({
          ...invite,
          id: `lab-invite-${i}`,
          gameId: `lab-invited-${i}`,
          from: inviters[i - 1].profile,
          options: { ...options, kind: 'quiz' as const },
        }))
      )
    if (id.startsWith('invitation')) model.selected = invite
    if (id === 'notification' || id === 'notifications') model.open = false
    if (id === 'invitation-expired') {
      model.invitations = []
      invite.expires = now - 1
    }
    if (id === 'invitation-offline') model.online = false
    if (id === 'invitation-pending') model.invitationAction = { action: 'accept' }
    if (id === 'invitation-full') model.invitationIssue = 'full'
    return model
  }
  if (['lobby', 'guest', 'full', 'generation-error', 'generating'].includes(id)) {
    game.phase = id === 'generating' ? 'generating' : 'lobby'
    delete game.who
    game.players.forEach(p => (p.score = 0))
    if (id === 'guest') game.host = players.find(p => p.id !== me)!.id
    else game.host = me
    if (id === 'generation-error') game.reason = 'generation_failed'
  }
  if (['their-turn', 'wrong'].includes(id)) {
    game.who!.active = players.find(p => p.id !== actor)!.id
    game.who!.eligible = [game.who!.active!]
  }
  if (['wrong', 'clarify', 'checking', 'unavailable', 'blocked', 'quiz-sent'].includes(id)) {
    const status =
      id === 'wrong' || id === 'blocked'
        ? 'wrong'
        : id === 'clarify'
          ? 'clarify'
          : id === 'unavailable'
            ? 'unavailable'
            : 'pending'
    game.ownAnswer = {
      text: id === 'clarify' ? (fr ? 'Le prophète' : 'The prophet') : 'David',
      status,
      retriesLeft: 2,
      ...(quiz ? {} : { zone }),
    }
    game.answered = [actor]
    if (game.who) {
      if (status === 'pending') {
        game.who.checking = [actor]
        game.who.frozenAt = now
        game.who.eligible = game.who.eligible.filter(p => p !== actor)
      }
      if (id === 'blocked') game.who.eligible = players.filter(p => p.id !== actor).map(p => p.id)
    }
  }
  if (me !== actor) delete game.ownAnswer
  if (id === 'pause') {
    game.pausedAt = now
    game.pausedUntil = now + 90000
    players.find(p => p.id !== me)!.absentSince = now
  }
  if (id === 'offline') model.online = false
  if (
    [
      'win',
      'other-wins',
      'no-winner',
      'void',
      'quiz-win',
      'quiz-wrong',
      'final',
      'tie',
      'zero',
      'interrupted',
    ].includes(id)
  ) {
    reveal(model, !['other-wins', 'quiz-wrong', 'no-winner'].includes(id), actor)
    if (!['void', 'no-winner'].includes(id)) {
      const winner = game.who?.winner ?? game.result!.answers.find(a => a.status === 'correct')?.id
      const player = game.players.find(p => p.id === winner)
      if (player) player.score += game.who?.awarded ?? 1
    }
    game.clues = clues
    if (id === 'no-winner') {
      delete game.who!.winner
      game.who!.awarded = 0
      game.result!.answers.forEach(a => (a.status = 'skipped'))
    }
    if (id === 'void') game.result!.void = true
    if (['final', 'tie', 'zero', 'interrupted'].includes(id)) {
      game.phase = 'finished'
      game.round = 4
      if (id === 'tie') game.players.forEach(p => (p.score = 8))
      if (id === 'zero') game.players.forEach(p => (p.score = 0))
      if (id === 'interrupted') game.reason = 'not_enough_players'
    }
  }
  return model
}
export function reveal(model: LabModel, correct: boolean, actor = model.me) {
  const g = model.game
  if (!g) return
  const fr = g.options.language === 'fr',
    answer = fr ? 'Moïse' : 'Moses'
  const winner = correct ? actor : (g.players.find(p => p.id !== actor)?.id ?? '')
  g.phase = 'reveal'
  g.result = {
    answer,
    explanation: fr
      ? 'Moïse fut caché dans un panier sur le Nil, puis recueilli par la fille du pharaon.'
      : 'Moses was hidden in a basket on the Nile and then taken in by Pharaoh’s daughter.',
    reference: fr ? 'Exode 2:3' : 'Exodus 2:3',
    url: 'https://bible-strong.app',
    void: false,
    answers: g.players.map(p => ({
      id: p.id,
      text: p.id === winner ? answer : 'David',
      status: p.id === winner ? 'correct' : 'wrong',
    })),
  }
  if (g.options.kind === 'quiz') {
    g.result.explanation = fr
      ? 'Dieu envoie Moïse auprès du pharaon pour faire sortir son peuple d’Égypte.'
      : 'God sends Moses to Pharaoh to bring his people out of Egypt.'
    g.result.reference = fr ? 'Exode 3:10' : 'Exodus 3:10'
    g.result.url = `https://web.bible-strong.app/bible/${fr ? 'lsg' : 'kjv'}/exod/3/10`
  }
  g.ownAnswer = {
    text: winner === model.me ? answer : 'David',
    status: winner === model.me ? 'correct' : 'wrong',
    retriesLeft: 2,
  }
  if (g.who) {
    g.who.winner = winner
    g.who.awarded = g.who.points
    g.who.eligible = []
    g.who.checking = []
  }
}
/** Simulated commands only; this module never imports multiplayer or provider clients. */
export function act(current: LabModel, action: GameAction): LabModel {
  const m = structuredClone(current),
    g = m.game
  if (action.action === 'create') {
    const next = makeStory(
      action.options.mode === 'solo' ? 'solo-lobby' : 'lobby',
      {
        language: action.options.language,
        players: Math.max(2, people.findIndex(p => p.id === m.me) + 1),
        perspective: people.findIndex(p => p.id === m.me),
      },
      m.now
    )
    next.options = action.options
    next.game!.options = action.options
    return next
  }
  if (action.action === 'leave') {
    m.game = null
    m.selected = null
    return m
  }
  if (action.action === 'accept' || action.action === 'decline') {
    const invite = m.invitations.find(i => i.id === action.invitation && i.expires > m.now)
    if (!invite) {
      m.invitationIssue = 'expired'
      return m
    }
    m.invitationAction = { action: action.action }
    return m
  }
  if (!g) return m
  if (g.solo) {
    if (action.action === 'start') g.phase = 'generating'
    if (action.action === 'next') {
      if (g.phase === 'reveal') {
        g.round++
        g.phase = 'question'
        delete g.result
      }
      resumeSolo(g.solo, 'feedback', m.now)
      resumeSolo(g.solo, 'technical', m.now)
      delete g.ownAnswer
    }
    if (action.action === 'pass' && submitSolo(g.solo, 'lab-pass', m.now)) {
      settleSolo(g.solo, 'lab-pass', 'skipped', m.now)
      g.ownAnswer = { text: '', status: 'skipped', retriesLeft: 0 }
      completeSoloLab(m, 'skipped')
    }
    if (action.action === 'answer' && submitSolo(g.solo, 'lab-answer', m.now)) {
      g.ownAnswer = { text: action.text, status: 'pending', retriesLeft: 2 }
      const normalized = action.text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()
      if (['moise', 'moses'].includes(normalized)) {
        settleSolo(g.solo, 'lab-answer', 'correct', m.now)
        completeSoloLab(m, 'correct')
      }
    }
    return m
  }
  if (action.action === 'start') {
    g.phase = 'generating'
    return m
  }
  if (action.action === 'invite') {
    g.invited.push(action.target)
    return m
  }
  if (action.action === 'next') {
    if (g.round === 4) {
      g.phase = 'finished'
      return m
    }
    const next = makeStory(
      g.options.kind === 'quiz' ? 'quiz' : 'your-turn',
      {
        language: g.options.language,
        players: g.players.length,
        perspective: g.players.findIndex(p => p.id === m.me),
      },
      m.now
    )
    next.game!.id = g.id
    next.game!.players = g.players
    next.game!.round = g.round + 1
    next.game!.options = g.options
    next.options = g.options
    if (g.options.difficulty !== 'easy') delete next.game!.choices
    return next
  }
  if (action.action === 'answer') {
    g.ownAnswer = { text: action.text, zone: g.who?.zone, status: 'pending', retriesLeft: 2 }
    g.answered = [...new Set([...g.answered, m.me])]
    if (g.who) {
      g.who.checking = [m.me]
      g.who.frozenAt = m.now
      g.who.eligible = g.who.eligible.filter(id => id !== m.me)
    }
  }
  return m
}
export function settle(current: LabModel): LabModel {
  const m = structuredClone(current),
    g = m.game
  if (m.invitationAction) {
    if (m.invitationAction.action === 'decline') {
      m.invitations = m.invitations.filter(i => i.id !== m.selected?.id)
      m.selected = null
      m.open = false
    } else if (
      m.selected &&
      m.invitations.some(i => i.id === m.selected!.id && i.expires > m.now)
    ) {
      const next = makeStory(
        'guest',
        {
          language: m.options.language,
          players: Math.max(2, people.findIndex(p => p.id === m.me) + 1),
          perspective: people.findIndex(p => p.id === m.me),
        },
        m.now
      )
      next.game!.id = m.selected.gameId
      next.game!.options = m.selected.options
      next.options = m.selected.options
      const host = people.find(p => p.profile.name === m.selected!.from.name)!
      const self = people.find(p => p.id === m.me)!
      next.game!.players = structuredClone([host, self])
      next.game!.host = host.id
      next.me = m.me
      next.invitations = []
      return next
    }
    m.invitationAction = null
    return m
  }
  if (g?.solo) {
    if (g.phase === 'generating') {
      g.phase = 'question'
      resumeSolo(g.solo, 'preparing', m.now)
    }
    if (g.ownAnswer?.status === 'pending') {
      const answer = g.ownAnswer.text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
      const status = ['moise', 'moses'].includes(answer)
        ? 'correct'
        : ['prophete', 'prophet'].includes(answer)
          ? 'clarify'
          : 'wrong'
      settleSolo(g.solo, 'lab-answer', status, m.now)
      if (status === 'clarify') g.ownAnswer.status = status
      else completeSoloLab(m, status)
      if (g.solo.outcome) g.phase = 'finished'
    }
    return m
  }
  if (g?.phase === 'generating') {
    const next = makeStory(
      g.options.kind === 'quiz' ? 'quiz' : 'your-turn',
      {
        language: g.options.language,
        players: g.players.length,
        perspective: g.players.findIndex(p => p.id === m.me),
      },
      m.now
    )
    next.game!.id = g.id
    next.game!.round = 0
    next.game!.options = g.options
    next.options = g.options
    if (g.options.difficulty !== 'easy') delete next.game!.choices
    return next
  }
  if (g?.ownAnswer?.status === 'pending' && g.phase === 'question') {
    const answer = g.ownAnswer.text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    if (answer === 'moise' || answer === 'moses') {
      reveal(m, true)
      g.players.find(p => p.id === m.me)!.score += g.who?.points ?? 1
    } else if (g.who) {
      g.ownAnswer.status = answer === 'prophete' || answer === 'prophet' ? 'clarify' : 'wrong'
      g.who.checking = []
      g.who.frozenAt = null
      g.deadline = m.now + 20000
      g.who.active =
        g.ownAnswer.status === 'clarify' ? m.me : g.players.find(p => p.id !== m.me)!.id
      g.who.eligible =
        g.who.mode === 'duel'
          ? [g.who.active]
          : g.players.filter(p => g.ownAnswer!.status === 'clarify' || p.id !== m.me).map(p => p.id)
    } else reveal(m, false)
  }
  return m
}
