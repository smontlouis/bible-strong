import { WorldGames } from './games/room'
import type { GameAIEnv } from './games/ai'
import { authenticateAdmin, validAdminMutation } from './guestbook-auth'
import { routeGuestbook, type GuestbookEnv } from './guestbook'
export { Guestbook } from './guestbook'
import navigationJson from '../public/navigation/archipelago.json'
import { parseNavigation } from '../src/navigation-document'
import { chooseCentralSpawn } from '../src/multiplayer-spawn'
import { Server, routePartykitRequest, type Connection } from 'partyserver'
import {
  MAX_PLAYERS,
  ROOM,
  parseClientMessage,
  type Player,
  type ServerMessage,
} from '../src/multiplayer-protocol'

const navigation = parseNavigation(navigationJson)

const RESUME_TTL = 24 * 60 * 60 * 1000
type SavedSession = { player: Player; expires: number }
type Session = {
  player: Player | null
  lastSeen: number
  window: number
  messages: number
  resumeToken?: string
  hidden?: boolean
  lastGameAction?: number
}
interface Env extends GuestbookEnv, GameAIEnv {
  WorldRoom: DurableObjectNamespace<WorldRoom>
  ALLOWED_ORIGINS?: string
  ASSETS: Fetcher
}

export class WorldRoom extends Server<Env> {
  static options = { hibernate: true }
  private gameService?: WorldGames
  private get games() {
    return (this.gameService ??= new WorldGames(
      this.ctx,
      this.env,
      () =>
        [...this.getConnections<Session>()].flatMap(c =>
          c.state?.player && c.readyState === 1
            ? [
                {
                  id: c.state.player.id,
                  profile: c.state.player.profile,
                  x: c.state.player.pose.x,
                  y: c.state.player.pose.y,
                  present: !c.state.hidden,
                },
              ]
            : []
        ),
      (id, snapshot, error) => {
        for (const c of this.getConnections<Session>())
          if (c.state?.player?.id === id && c.readyState === 1)
            c.send(
              JSON.stringify({
                type: 'games',
                snapshot,
                ...(error ? { error } : {}),
              } satisfies ServerMessage)
            )
      }
    ))
  }
  private pending = new Map<string, Player>()
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private queue(player: Player) {
    this.pending.set(player.id, player)
    if (this.flushTimer !== undefined) return
    // Coalesce concurrent movement into one frame, instead of N² tiny socket writes.
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined
      const players = [...this.pending.values()]
      this.pending.clear()
      if (players.length)
        this.broadcast(JSON.stringify({ type: 'frame', players } satisfies ServerMessage))
    }, 50)
  }
  async onConnect(connection: Connection<Session>) {
    if ([...this.getConnections()].filter(c => c.readyState === 1).length > MAX_PLAYERS + 16) {
      connection.send(JSON.stringify({ type: 'full' } satisfies ServerMessage))
      connection.close(4008, 'Room full')
      return
    }
    const now = Date.now()
    connection.setState({ player: null, lastSeen: now, window: now, messages: 0 })
    const alarm = await this.ctx.storage.getAlarm()
    if (alarm === null || alarm > now + 30_000) await this.ctx.storage.setAlarm(now + 30_000)
  }
  async onMessage(connection: Connection<Session>, raw: string | ArrayBuffer) {
    const session = connection.state
    if (!session) return
    const now = Date.now()
    const messages = now - session.window >= 1000 ? 1 : session.messages + 1
    if (messages > 40) {
      this.remove(connection)
      connection.close(4009, 'Too many messages')
      return
    }
    const message = typeof raw === 'string' ? parseClientMessage(raw) : null
    if (!message) {
      this.remove(connection)
      connection.close(4002, 'Invalid message')
      return
    }
    const next = {
      ...session,
      lastSeen: now,
      window: now - session.window >= 1000 ? now : session.window,
      messages,
    }
    if (message.type === 'game' && session.player) {
      if (now - (session.lastGameAction ?? 0) < 250) {
        connection.send(
          JSON.stringify({ type: 'game-error', error: 'rate_limited' } satisfies ServerMessage)
        )
        return
      }
      connection.setState({ ...next, lastGameAction: now })
      this.games.command(session.player.id, message.command)
      return
    }
    if (message.type === 'ping') {
      connection.setState(next)
      connection.send(JSON.stringify({ type: 'pong' } satisfies ServerMessage))
      return
    }
    if (message.type === 'join' && !session.player) {
      // Serialize resume/arrival against close callbacks and other join attempts.
      await this.ctx.blockConcurrencyWhile(async () => {
        const previous = message.resumeToken
          ? [...this.getConnections<Session>()].find(
              c =>
                c.id !== connection.id &&
                c.state?.resumeToken === message.resumeToken &&
                c.state?.player
            )
          : undefined
        const saved = message.resumeToken
          ? await this.ctx.storage.get<SavedSession>(`resume:${message.resumeToken}`)
          : undefined
        const restored =
          previous?.state?.player ?? (saved && saved.expires > now ? saved.player : null)
        const occupied = [...this.getConnections<Session>()].flatMap(c =>
          c.state?.player ? [c.state.player.pose] : []
        )
        if (occupied.length - (previous ? 1 : 0) >= MAX_PLAYERS) {
          connection.send(JSON.stringify({ type: 'full' } satisfies ServerMessage))
          connection.close(4008, 'Room full')
          return
        }
        const spawn = restored?.pose ?? chooseCentralSpawn(navigation, occupied)
        if (!spawn) {
          connection.send(JSON.stringify({ type: 'full' } satisfies ServerMessage))
          connection.close(4008, 'No free arrival position')
          return
        }
        next.resumeToken = restored ? message.resumeToken! : crypto.randomUUID()
        next.player = {
          id: restored?.id ?? crypto.randomUUID(),
          profile: message.profile,
          pose: { ...spawn, dx: restored?.pose.dx ?? 0, dy: restored?.pose.dy ?? 1, moving: false },
          seq: restored ? restored.seq + 1 : 0,
        }
        if (previous?.state) {
          // Retire the old transport without publishing a departure for the resumed avatar.
          previous.setState({ ...previous.state, player: null })
          previous.close(4001, 'Session resumed')
        }
        connection.setState(next)
        if (message.resumeToken) await this.ctx.storage.delete(`resume:${message.resumeToken}`)
        const players = [...this.getConnections<Session>()].flatMap(c =>
          c.state?.player ? [c.state.player] : []
        )
        connection.send(
          JSON.stringify({
            type: 'welcome',
            id: next.player.id,
            spawn: next.player.pose,
            players,
            resumeToken: next.resumeToken,
          } satisfies ServerMessage)
        )
        this.games.presence(next.player.id, true)
        this.pending.delete(next.player.id)
        this.broadcast(
          JSON.stringify({ type: 'player', player: next.player } satisfies ServerMessage),
          [connection.id]
        )
      })
      return
    } else if (session.player && message.type === 'visibility') {
      next.hidden = message.hidden
      connection.setState(next)
      this.games.presence(session.player.id, !message.hidden)
      return
    } else if (session.player && message.type === 'move') {
      if (message.seq <= session.player.seq) {
        connection.setState(next)
        return
      }
      next.player = { ...session.player, pose: message.pose, seq: message.seq }
      connection.setState(next)
    } else if (session.player && message.type === 'profile') {
      next.player = { ...session.player, profile: message.profile }
      connection.setState(next)
    } else {
      connection.setState(next)
      return
    }
    this.queue(next.player!)
  }
  private remove(connection: Connection<Session>) {
    const session = connection.state
    if (!session?.player) return
    if (session.resumeToken) {
      // Attachments survive hibernation; persist only when the transport actually leaves.
      this.ctx.waitUntil(
        this.ctx.storage.put(`resume:${session.resumeToken}`, {
          player: { ...session.player, pose: { ...session.player.pose, moving: false } },
          expires: Date.now() + RESUME_TTL,
        } satisfies SavedSession)
      )
    }
    const id = session.player.id
    this.games.presence(id, false)
    this.pending.delete(id)
    connection.setState({ ...session, player: null })
    this.broadcast(JSON.stringify({ type: 'leave', id } satisfies ServerMessage), [connection.id])
  }
  onClose(connection: Connection<Session>) {
    this.remove(connection)
  }
  onError(connection: Connection<Session>) {
    this.remove(connection)
    connection.close(1011, 'Connection error')
  }
  async onAlarm() {
    let active = false
    for (const connection of this.getConnections<Session>()) {
      const session = connection.state
      if (
        !session ||
        Date.now() - session.lastSeen >
          (session.player ? (session.hidden ? RESUME_TTL : 45_000) : 10_000)
      ) {
        this.remove(connection)
        connection.close(4000, 'Session expired')
      } else active = true
    }
    const saved = await this.ctx.storage.list<SavedSession>({ prefix: 'resume:' })
    const expired = [...saved]
      .filter(([, value]) => value.expires <= Date.now())
      .map(([key]) => key)
    for (let i = 0; i < expired.length; i += 128)
      await this.ctx.storage.delete(expired.slice(i, i + 128))
    const gameWake = this.games.tick()
    if (active || saved.size > expired.length || gameWake !== null)
      await this.ctx.storage.setAlarm(
        Math.min(gameWake ?? Infinity, Date.now() + (active ? 30_000 : 60 * 60 * 1000))
      )
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/__study-world/'))
      return new Response('Not found', { status: 404 })
    const adminPage = ['/admin', '/admin/', '/admin-guestbook'].includes(url.pathname)
    if (url.pathname === '/health') return Response.json({ ok: true })
    const origin = request.headers.get('Origin')
    const allowed = [url.origin, ...(env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim())]
    if (origin && !allowed.includes(origin)) return new Response('Forbidden', { status: 403 })
    if (adminPage || url.pathname === '/api/guestbook/admin') {
      const actor = await authenticateAdmin(request, env)
      if (!actor)
        return Response.json(
          { error: 'unauthorized' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } }
        )
      if (adminPage) return env.ASSETS.fetch(request)
      const stub = env.Guestbook.get(env.Guestbook.idFromName('asi-europe'))
      const reply = (body: unknown, status = 200) =>
        Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
      if (request.method === 'GET') {
        const cursor = Number(url.searchParams.get('cursor') ?? Number.MAX_SAFE_INTEGER)
        const filter = url.searchParams.get('filter') ?? 'all'
        const id = url.searchParams.get('message') ?? undefined
        if (
          !Number.isSafeInteger(cursor) ||
          cursor < 1 ||
          !['all', 'visible', 'removed'].includes(filter) ||
          (id && !/^[0-9a-f-]{36}$/i.test(id))
        )
          return reply({ error: 'invalid' }, 400)
        return reply(await stub.adminList(cursor, filter as 'all' | 'visible' | 'removed', id))
      }
      if (request.method !== 'POST') return reply({ error: 'method' }, 405)
      if (!validAdminMutation(request)) return reply({ error: 'forbidden' }, 403)
      try {
        const data = (await request.json()) as { id?: unknown; removed?: unknown }
        if (
          typeof data.id !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(data.id) ||
          typeof data.removed !== 'boolean'
        )
          return reply({ error: 'invalid' }, 400)
        return (await stub.adminSetVisibility(data.id, data.removed, actor))
          ? reply({ ok: true })
          : reply({ error: 'not_found' }, 404)
      } catch {
        return reply({ error: 'invalid' }, 400)
      }
    }
    if (url.pathname === '/api/guestbook') {
      if (request.method === 'OPTIONS')
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin || url.origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            Vary: 'Origin',
          },
        })
      const result = await routeGuestbook(request, env)
      const response = new Response(result.body, result)
      response.headers.set('Access-Control-Allow-Origin', origin || url.origin)
      response.headers.set('Vary', 'Origin')
      return response
    }
    if (url.pathname !== `/parties/world-room/${ROOM}`)
      return new Response('Not found', { status: 404 })
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 })
    // Connection routing identifiers are generated here, never trusted from the URL.
    url.searchParams.set('_pk', crypto.randomUUID())
    return (
      (await routePartykitRequest(new Request(url, request), env)) ??
      new Response('Not found', { status: 404 })
    )
  },
} satisfies ExportedHandler<Env>
