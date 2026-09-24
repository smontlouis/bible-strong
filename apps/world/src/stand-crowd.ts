import { AVATARS, AVATAR_COLORS, type AvatarProfile } from './avatar-profile'
import { centralSpawnCandidates } from './multiplayer-spawn'
import type { Pose } from './multiplayer-protocol'
import { Pathfinder } from './pathfinding'
import { WalkingRoute } from './walking-route'
import { REACTION_COOLDOWN_MS, REACTION_DURATION_MS, type ReactionId } from './reactions'
import type { NavigationDocument, Point } from './world'

export const STAND_CROWD_SIZE = 5
export const STAND_REACTION_RADIUS = 140
const names = ['Noah', 'Esther', 'Ruth', 'Daniel', 'Sarah']
const replies: Record<ReactionId, readonly ReactionId[]> = {
  hello: ['hello', 'love'],
  love: ['love', 'bravo'],
  laugh: ['laugh', 'hello'],
  wow: ['wow', 'bravo'],
  think: ['think', 'hello'],
  sad: ['love', 'hello'],
  bravo: ['bravo', 'love'],
}

type Bot = {
  player: { profile: AvatarProfile }
  pose: Pose
  sample: (now: number) => Pose
  opacity: number
  leaving: boolean
  route: WalkingRoute
  wait: number
  speed: number
  reply?: { reaction: ReactionId; due: number; expires: number; toward: Point }
  nextReply: number
}

function centralNavigation(navigation: NavigationDocument): NavigationDocument {
  return {
    ...navigation,
    zones: navigation.zones.filter(zone => zone.kind === 'blocked' || zone.id === 'land-0'),
  }
}

/** Local scenery only: never inserted into multiplayer presence or game membership. */
export class StandCrowd {
  readonly remotes = new Map<string, Bot>()
  readonly reactions = new Map<string, { reaction: ReactionId; startedAt: number }>()
  readonly playerId = 'stand-local'
  readonly activity = null
  private navigation: NavigationDocument
  private walkingNavigation: NavigationDocument
  private pathfinder: Pathfinder
  private candidates: readonly Point[]
  private realCount = 0
  private spawnIn = 0
  private nextId = 0
  private lastLocalReaction = -Infinity
  private seenReactions = new Map<string, number>()

  constructor(
    navigation: NavigationDocument,
    private random = Math.random
  ) {
    this.navigation = navigation
    this.walkingNavigation = centralNavigation(navigation)
    this.pathfinder = new Pathfinder(this.walkingNavigation)
    this.candidates = centralSpawnCandidates(navigation)
  }

  private pick<T>(values: readonly T[]): T {
    return values[Math.min(values.length - 1, Math.floor(this.random() * values.length))]
  }

  private spawn(local: Point) {
    const occupied = [local, ...[...this.remotes.values()].map(bot => bot.pose)]
    const spaced = this.candidates.filter(p =>
      occupied.every(q => Math.hypot(p.x - q.x, p.y - q.y) > 38)
    )
    if (!spaced.length) return
    const point = this.pick(spaced)
    const index = this.nextId++
    const slot = names.findIndex(
      name => ![...this.remotes.values()].some(bot => bot.player.profile.name === name)
    )
    const bot: Bot = {
      player: {
        profile: {
          name: names[slot],
          avatar: AVATARS[slot].id,
          color: AVATAR_COLORS[(slot + 1) % AVATAR_COLORS.length],
        },
      },
      pose: { ...point, dx: 0, dy: 1, moving: false },
      sample: () => bot.pose,
      opacity: 0,
      leaving: false,
      route: new WalkingRoute(),
      wait: 800 + this.random() * 4000,
      speed: 0.4 + this.random() * 0.3,
      nextReply: 0,
    }
    this.remotes.set(`stand-bot-${index}`, bot)
  }

  update({
    navigation,
    realCount,
    local,
    delta,
    now,
    active,
    visible,
  }: {
    navigation: NavigationDocument
    /** Null during reconnect: don't refill the scene on a transient transport failure. */
    realCount: number | null
    local: Point
    delta: number
    now: number
    active: boolean
    visible: (point: Point) => boolean
  }) {
    this.expireReactions(now)
    if (navigation !== this.navigation) {
      this.navigation = navigation
      this.walkingNavigation = centralNavigation(navigation)
      this.pathfinder = new Pathfinder(this.walkingNavigation)
      this.candidates = centralSpawnCandidates(navigation)
      this.remotes.clear()
      this.reactions.clear()
    }
    if (realCount !== null) this.realCount = Math.max(0, realCount)
    if (!active) return
    const step = Math.min(Math.max(delta, 0), 50)
    const target = Math.max(0, STAND_CROWD_SIZE - this.realCount)
    const present = [...this.remotes.values()].filter(bot => !bot.leaving)
    // Prefer an off-screen departure; visible departures fade instead of popping away.
    present.sort(
      (a, b) =>
        Number(visible(a.pose)) - Number(visible(b.pose)) ||
        Math.hypot(b.pose.x - local.x, b.pose.y - local.y) -
          Math.hypot(a.pose.x - local.x, a.pose.y - local.y)
    )
    for (const bot of present.slice(0, Math.max(0, present.length - target))) {
      bot.leaving = true
      bot.reply = undefined
    }
    this.spawnIn -= step
    if (this.remotes.size < target && this.spawnIn <= 0) {
      this.spawn(local)
      this.spawnIn = 1200 + this.random() * 1200
    }
    let planned = false
    for (const [id, bot] of this.remotes) {
      bot.opacity = Math.max(0, Math.min(1, bot.opacity + ((bot.leaving ? -1 : 1) * step) / 900))
      if (bot.leaving && bot.opacity === 0) {
        this.remotes.delete(id)
        this.reactions.delete(id)
        continue
      }
      if (bot.reply && now >= bot.reply.due) {
        if (now < bot.reply.expires) {
          this.reactions.set(id, { reaction: bot.reply.reaction, startedAt: now })
          const dx = bot.reply.toward.x - bot.pose.x,
            dy = bot.reply.toward.y - bot.pose.y
          const length = Math.hypot(dx, dy) || 1
          bot.pose.dx = dx / length
          bot.pose.dy = dy / length
        }
        bot.reply = undefined
      }
      bot.wait -= step
      if (!bot.route.points.length && bot.wait <= 0 && !planned && !bot.leaving) {
        planned = true
        const destinations = this.candidates.filter(p => {
          const distance = Math.hypot(p.x - bot.pose.x, p.y - bot.pose.y)
          return distance > 45 && distance < 180
        })
        if (destinations.length)
          bot.route.points = this.pathfinder.find(bot.pose, this.pick(destinations)) ?? []
        bot.wait = 2000 + this.random() * 6000
      }
      const before = bot.pose
      const next = bot.route.advance(before, (step / 1000) * bot.speed, this.walkingNavigation)
      const dx = next.x - before.x,
        dy = next.y - before.y
      const distance = Math.hypot(dx, dy)
      bot.pose = {
        ...before,
        ...next,
        moving: distance > 0.001,
        dx: distance > 0.001 ? dx / distance : before.dx,
        dy: distance > 0.001 ? dy / distance : before.dy,
      }
      if (before.moving && !bot.pose.moving) bot.wait = 2000 + this.random() * 6000
    }
  }

  react(reaction: ReactionId, local: Point, now: number, showLocal = true): boolean {
    if (now - this.lastLocalReaction < REACTION_COOLDOWN_MS) return false
    this.lastLocalReaction = now
    if (showLocal) this.reactions.set(this.playerId, { reaction, startedAt: now })
    this.respond(reaction, local, now)
    return true
  }

  private respond(reaction: ReactionId, source: Point, now: number) {
    const nearby = [...this.remotes.values()].filter(
      bot =>
        !bot.leaving &&
        bot.opacity > 0.5 &&
        !bot.reply &&
        now >= bot.nextReply &&
        Math.hypot(bot.pose.x - source.x, bot.pose.y - source.y) <= STAND_REACTION_RADIUS
    )
    nearby.sort(
      (a, b) =>
        Math.hypot(a.pose.x - source.x, a.pose.y - source.y) -
        Math.hypot(b.pose.x - source.x, b.pose.y - source.y)
    )
    for (const bot of nearby.slice(0, 2)) {
      bot.route.cancel()
      bot.wait = 3500 + this.random() * 1500
      bot.nextReply = now + 6000
      bot.reply = {
        reaction: this.pick(replies[reaction]),
        due: now + 600 + this.random() * 1100,
        expires: now + 4000,
        toward: { ...source },
      }
    }
  }

  observeReactions(
    events: ReadonlyMap<string, { reaction: ReactionId; startedAt: number }>,
    source: (id: string) => Point | undefined,
    now: number
  ) {
    for (const id of this.seenReactions.keys()) if (!events.has(id)) this.seenReactions.delete(id)
    for (const [id, event] of events) {
      if (this.seenReactions.get(id) === event.startedAt) continue
      this.seenReactions.set(id, event.startedAt)
      const point = source(id)
      if (point && now - event.startedAt < REACTION_DURATION_MS)
        this.respond(event.reaction, point, now)
    }
  }

  expireReactions(now: number) {
    for (const [id, event] of this.reactions)
      if (now - event.startedAt >= REACTION_DURATION_MS) this.reactions.delete(id)
  }
}
