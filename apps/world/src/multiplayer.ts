import { type AvatarActivity } from './avatar-activity'
import {
  isReaction,
  REACTION_COOLDOWN_MS,
  REACTION_DURATION_MS,
  type ReactionId,
} from './reactions'
import { GamesClient } from './games-client'
import PartySocket from 'partysocket'
import { parseProfile, type AvatarProfile } from './avatar-profile'
import { RemoteTrack } from './multiplayer-interpolation'
import {
  ROOM,
  PROTOCOL_VERSION,
  SEND_INTERVAL,
  type ClientMessage,
  type Pose,
  type PresenceStatus,
  type ServerMessage,
} from './multiplayer-protocol'

/** Owns transport and transient presence, independent of React and Phaser. */
export class WorldMultiplayer {
  readonly games = new GamesClient(command => this.send({ type: 'game', command }))
  nearby() {
    return [...this.remotes].flatMap(([id, track]) => {
      const pose = track.sample(performance.now())
      return Math.hypot(pose.x - this.pose.x, pose.y - this.pose.y) <= 180
        ? [{ id, profile: track.player.profile }]
        : []
    })
  }
  activity: AvatarActivity | null = null
  private sentActivity: AvatarActivity | null | undefined
  setActivity(activity: AvatarActivity | null) {
    this.activity = activity
    if (this.id && this.enabled && this.status.state === 'online' && this.sentActivity !== activity)
      if (this.send({ type: 'activity', activity })) this.sentActivity = activity
  }
  readonly reactions = new Map<string, { reaction: ReactionId; startedAt: number }>()
  private lastReactionSent = -Infinity
  get playerId() {
    return this.id
  }
  sendReaction(reaction: ReactionId) {
    const now = performance.now()
    if (
      !isReaction(reaction) ||
      !this.id ||
      !this.enabled ||
      document.hidden ||
      this.status.state !== 'online' ||
      now - this.lastReactionSent < REACTION_COOLDOWN_MS
    )
      return false
    if (!this.send({ type: 'reaction', reaction })) return false
    this.lastReactionSent = now
    return true
  }
  expireReactions(now: number) {
    for (const [id, event] of this.reactions)
      if (now - event.startedAt >= REACTION_DURATION_MS) this.reactions.delete(id)
  }
  readonly remotes = new Map<string, RemoteTrack>()
  status: PresenceStatus = { state: 'connecting', count: 0 }
  private socket: PartySocket | null = null
  private id: string | null = null
  private profile: AvatarProfile | null = null
  private pose: Pose = { x: 836, y: 542, dx: 0, dy: 1, moving: false }
  private lastPose = ''
  private lastProfile = ''
  private lastSent = -Infinity
  private lastReceived = 0
  private pendingSpawn: Pose | null = null
  takeSpawn(): Pose | null {
    const spawn = this.pendingSpawn
    this.pendingSpawn = null
    return spawn
  }
  private seq = 0
  private destroyed = false
  private superseded = false
  /** The page speaks another protocol version: stop reconnecting and ask for a reload. */
  private outdated = false
  /** Identity welcomed earlier in this page: a reconnect keeps the live position. */
  private knownId: string | null = null
  /** Visibility last acknowledged by a successful send, retried by the heartbeat. */
  private reportedHidden: boolean | null = null
  private reportVisibility() {
    if (this.send({ type: 'visibility', hidden: document.hidden })) this.reportedHidden = document.hidden
  }
  // Anonymous repetition history only: never used to authenticate or resume an avatar.
  private gameHistoryId = this.readGameHistoryId()
  private readGameHistoryId() {
    // getRandomValues also works on local HTTP/LAN previews where randomUUID is unavailable.
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const fresh = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    try {
      const key = 'world-game-history-id'
      const saved = localStorage.getItem(key)
      if (
        saved &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved)
      )
        return saved
      localStorage.setItem(key, fresh)
    } catch {
      /* History remains stable for this client when storage is unavailable. */
    }
    return fresh
  }
  private resumeToken: string | undefined = this.readResumeToken()
  private readResumeToken() {
    try {
      return sessionStorage.getItem('world-resume-token') || undefined
    } catch {
      return undefined
    }
  }
  private enabled = false
  private heartbeat = window.setInterval(() => {
    if (!this.socket || document.hidden) return
    if (this.id && this.reportedHidden !== document.hidden) this.reportVisibility()
    if (
      this.socket.readyState === WebSocket.OPEN &&
      performance.now() - this.lastReceived > 20_000
    ) {
      this.disconnected()
      this.socket.reconnect()
    } else this.send({ type: 'ping' })
  }, 5000)
  private visibility = () => {
    if (!this.enabled) return
    this.reactions.clear()
    this.pose = { ...this.pose, moving: false }
    if (document.hidden && this.id && !this.pendingSpawn)
      this.send({ type: 'move', pose: this.pose, seq: ++this.seq })
    this.reportVisibility()
    if (!document.hidden) {
      // Give the connection a heartbeat round trip before treating it as stale.
      this.lastReceived = performance.now()
      this.send({ type: 'ping' })
      if (!this.socket && this.profile && this.status.state !== 'full' && !this.outdated)
        this.connect()
    }
  }
  constructor() {
    document.addEventListener('visibilitychange', this.visibility)
  }

  update(pose: Pose, profile: AvatarProfile, enabled: boolean, now: number) {
    this.enabled = enabled
    this.pose = pose
    this.profile = parseProfile(profile)
    if (!enabled || !this.profile) {
      if (this.socket) this.disconnect()
      return
    }
    if (!this.socket && !this.destroyed && this.status.state !== 'full' && !this.outdated)
      this.connect()
    if (!this.id || this.pendingSpawn || document.hidden) return
    const profileKey = JSON.stringify(this.profile)
    if (profileKey !== this.lastProfile) {
      if (this.send({ type: 'profile', profile: this.profile })) this.lastProfile = profileKey
    }
    const key = JSON.stringify(pose)
    const stopped = !pose.moving && this.lastPose !== key
    if (key !== this.lastPose && (stopped || now - this.lastSent >= SEND_INTERVAL)) {
      if (this.send({ type: 'move', pose, seq: ++this.seq })) {
        this.lastPose = key
        this.lastSent = now
      }
    }
  }
  private send(message: ClientMessage) {
    // Never replay queued movement after reconnecting or accumulate data on slow networks.
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 16_384) {
      this.socket.send(JSON.stringify(message))
      return true
    }
    return false
  }
  private connect() {
    if (this.destroyed || this.superseded || this.outdated || !this.profile || this.socket) return
    const host = import.meta.env.VITE_WORLD_MULTIPLAYER_HOST || location.host
    const socket = new PartySocket({
      host,
      party: 'world-room',
      room: ROOM,
      maxEnqueuedMessages: 0,
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 10_000,
    })
    this.socket = socket
    this.status = { state: 'connecting', count: 0 }
    socket.addEventListener('open', () => {
      if (this.socket !== socket || !this.profile) return
      this.seq = 0
      this.lastProfile = JSON.stringify(this.profile)
      this.lastPose = ''
      this.lastReceived = performance.now()
      this.send({
        type: 'join',
        gameHistoryId: this.gameHistoryId,
        version: PROTOCOL_VERSION,
        profile: this.profile,
        pose: this.pose,
        ...(this.resumeToken ? { resumeToken: this.resumeToken } : {}),
      })
    })
    socket.addEventListener('message', event => {
      if (this.socket !== socket) return
      let message: ServerMessage
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      const now = performance.now()
      this.lastReceived = now
      if (message.type === 'reaction') {
        if (
          !document.hidden &&
          this.id &&
          isReaction(message.reaction) &&
          (message.id === this.id || this.remotes.has(message.id))
        )
          this.reactions.set(message.id, { reaction: message.reaction, startedAt: now })
        return
      }
      if (message.type === 'games') {
        this.games.receive(message.snapshot, message.error)
        return
      }
      if (message.type === 'game-error') {
        this.games.error(message.error)
        return
      }
      if (message.type === 'welcome') {
        this.sentActivity = undefined
        this.reactions.clear()
        this.games.connect(message.id)
        this.resumeToken = message.resumeToken
        try {
          if (this.resumeToken) sessionStorage.setItem('world-resume-token', this.resumeToken)
          else sessionStorage.removeItem('world-resume-token')
        } catch {
          /* In-memory resumption still works when storage is unavailable. */
        }
        this.seq = message.players.find(player => player.id === message.id)?.seq ?? 0
        this.reportVisibility()
        const resumedLive = this.knownId === message.id
        this.knownId = message.id
        this.id = message.id
        if (resumedLive) {
          // Same page, same identity: the visitor kept walking during the outage, so the
          // server's last known position is stale. Publish where the avatar really is.
          this.pendingSpawn = null
          if (this.send({ type: 'move', pose: { ...this.pose }, seq: ++this.seq }))
            this.lastPose = JSON.stringify(this.pose)
        } else {
          this.pendingSpawn = message.spawn
          this.pose = message.spawn
        }
        this.remotes.clear()
        for (const player of message.players)
          if (player.id !== this.id) this.remotes.set(player.id, new RemoteTrack(player, now))
        this.status = { state: 'online', count: this.remotes.size + 1 }
      } else if ((message.type === 'player' || message.type === 'frame') && this.id) {
        for (const player of message.type === 'frame' ? message.players : [message.player]) {
          if (player.id === this.id) continue
          const existing = this.remotes.get(player.id)
          if (existing) existing.push(player, now)
          else this.remotes.set(player.id, new RemoteTrack(player, now))
        }
        this.status = { state: 'online', count: this.remotes.size + 1 }
      } else if (message.type === 'leave') {
        this.reactions.delete(message.id)
        this.remotes.delete(message.id)
        if (this.id) this.status = { state: 'online', count: this.remotes.size + 1 }
      } else if (message.type === 'full') {
        this.disconnect()
        this.status = { state: 'full', count: 0 }
      } else if (message.type === 'outdated') this.markOutdated()
    })
    socket.addEventListener('close', event => {
      if (this.socket !== socket) return
      if (event.code === 4001) {
        // A copied tab resumed this session. Do not fight it with automatic reconnects.
        this.superseded = true
        this.resumeToken = undefined
        try {
          sessionStorage.removeItem('world-resume-token')
        } catch {
          /* Storage may be unavailable. */
        }
        this.disconnect()
      } else if (event.code === 4002 || event.code === 4003) {
        // The server rejected this page's messages: a reload fixes a version mismatch,
        // reconnecting would only fail the same way again.
        this.markOutdated()
      } else if (event.code === 4000 && document.hidden) {
        // A hidden tab was released; reconnect when the visitor comes back, not in the background.
        this.disconnect()
      } else this.disconnected()
    })
    socket.addEventListener('error', () => {
      if (this.socket === socket) this.disconnected()
    })
  }
  private markOutdated() {
    this.outdated = true
    this.disconnect()
    this.status = { state: 'outdated', count: 0 }
  }
  private disconnected() {
    this.reportedHidden = null
    this.reactions.clear()
    this.games.disconnect()
    this.pendingSpawn = null
    this.id = null
    this.remotes.clear()
    this.status = { state: 'offline', count: 0 }
  }
  private disconnect() {
    const socket = this.socket
    this.socket = null
    socket?.close()
    this.disconnected()
  }
  retry() {
    if (this.outdated) {
      location.reload()
      return
    }
    this.superseded = false
    this.disconnect()
    this.connect()
  }
  destroy() {
    this.destroyed = true
    window.clearInterval(this.heartbeat)
    document.removeEventListener('visibilitychange', this.visibility)
    this.disconnect()
  }
}
