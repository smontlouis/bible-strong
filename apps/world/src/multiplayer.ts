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
    this.pose = { ...this.pose, moving: false }
    if (document.hidden && this.id && !this.pendingSpawn)
      this.send({ type: 'move', pose: this.pose, seq: ++this.seq })
    this.send({ type: 'visibility', hidden: document.hidden })
    if (!document.hidden) {
      // Give the connection a heartbeat round trip before treating it as stale.
      this.lastReceived = performance.now()
      this.send({ type: 'ping' })
      if (!this.socket && this.profile && this.status.state !== 'full') this.connect()
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
    if (!this.socket && !this.destroyed && this.status.state !== 'full') this.connect()
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
    if (this.destroyed || this.superseded || !this.profile || this.socket) return
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
      if (message.type === 'games') {
        this.games.receive(message.snapshot, message.error)
        return
      }
      if (message.type === 'game-error') {
        this.games.error(message.error)
        return
      }
      if (message.type === 'welcome') {
        this.games.connect(message.id)
        this.resumeToken = message.resumeToken
        try {
          if (this.resumeToken) sessionStorage.setItem('world-resume-token', this.resumeToken)
          else sessionStorage.removeItem('world-resume-token')
        } catch {
          /* In-memory resumption still works when storage is unavailable. */
        }
        this.seq = message.players.find(player => player.id === message.id)?.seq ?? 0
        this.send({ type: 'visibility', hidden: document.hidden })
        this.pendingSpawn = message.spawn
        this.pose = message.spawn
        this.id = message.id
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
        this.remotes.delete(message.id)
        if (this.id) this.status = { state: 'online', count: this.remotes.size + 1 }
      } else if (message.type === 'full') {
        this.disconnect()
        this.status = { state: 'full', count: 0 }
      }
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
      } else this.disconnected()
    })
    socket.addEventListener('error', () => {
      if (this.socket === socket) this.disconnected()
    })
  }
  private disconnected() {
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
