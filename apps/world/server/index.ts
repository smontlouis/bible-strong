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

type Session = { player: Player | null; lastSeen: number; window: number; messages: number }
interface Env extends GuestbookEnv {
  WorldRoom: DurableObjectNamespace<WorldRoom>
  ALLOWED_ORIGINS?: string
}

export class WorldRoom extends Server<Env> {
  static options = { hibernate: true }
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
    if ([...this.getConnections()].filter(c => c.readyState === 1).length > MAX_PLAYERS) {
      connection.send(JSON.stringify({ type: 'full' } satisfies ServerMessage))
      connection.close(4008, 'Room full')
      return
    }
    const now = Date.now()
    connection.setState({ player: null, lastSeen: now, window: now, messages: 0 })
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(now + 30_000)
  }
  onMessage(connection: Connection<Session>, raw: string | ArrayBuffer) {
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
    if (message.type === 'ping') {
      connection.setState(next)
      connection.send(JSON.stringify({ type: 'pong' } satisfies ServerMessage))
      return
    }
    if (message.type === 'join' && !session.player) {
      const occupied = [...this.getConnections<Session>()].flatMap(c =>
        c.state?.player ? [c.state.player.pose] : []
      )
      const spawn = chooseCentralSpawn(navigation, occupied)
      if (!spawn) {
        connection.send(JSON.stringify({ type: 'full' } satisfies ServerMessage))
        connection.close(4008, 'No free arrival position')
        return
      }
      next.player = {
        id: crypto.randomUUID(),
        profile: message.profile,
        pose: { ...spawn, dx: 0, dy: 1, moving: false },
        seq: 0,
      }
      connection.setState(next)
      const players = [...this.getConnections<Session>()].flatMap(c =>
        c.state?.player ? [c.state.player] : []
      )
      connection.send(
        JSON.stringify({
          type: 'welcome',
          id: next.player.id,
          spawn: next.player.pose,
          players,
        } satisfies ServerMessage)
      )
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
    if (message.type === 'join')
      this.broadcast(
        JSON.stringify({ type: 'player', player: next.player! } satisfies ServerMessage),
        [connection.id]
      )
    else this.queue(next.player!)
  }
  private remove(connection: Connection<Session>) {
    const session = connection.state
    if (!session?.player) return
    const id = session.player.id
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
      if (!session || Date.now() - session.lastSeen > (session.player ? 45_000 : 10_000)) {
        this.remove(connection)
        connection.close(4000, 'Session expired')
      } else active = true
    }
    if (active) await this.ctx.storage.setAlarm(Date.now() + 30_000)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true })
    const origin = request.headers.get('Origin')
    const allowed = [url.origin, ...(env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim())]
    if (origin && !allowed.includes(origin)) return new Response('Forbidden', { status: 403 })
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
