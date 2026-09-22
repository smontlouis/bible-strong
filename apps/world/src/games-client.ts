import type { GameAction, GameError, GamesSnapshot } from './games-protocol'
const empty: GamesSnapshot = { game: null, invitations: [], now: 0 }
export class GamesClient {
  private listeners = new Set<() => void>()
  private state: {
    snapshot: GamesSnapshot
    me: string | null
    online: boolean
    error: GameError | null
    offset: number
  } = { snapshot: empty, me: null, online: false, error: null, offset: 0 }
  constructor(private send: (command: GameAction) => boolean) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.state
  private emit() {
    for (const listener of this.listeners) listener()
  }
  connect(id: string) {
    this.state = { ...this.state, me: id, online: true }
    this.emit()
  }
  disconnect() {
    this.state = { ...this.state, online: false }
    this.emit()
  }
  receive(snapshot: GamesSnapshot, error?: GameError) {
    this.state = {
      ...this.state,
      snapshot,
      error: error ?? null,
      offset: snapshot.now - Date.now(),
    }
    this.emit()
  }
  error(error: GameError) {
    this.state = { ...this.state, error }
    this.emit()
  }
  command(command: GameAction) {
    if (!this.state.online || !this.send(command)) {
      this.error('unavailable')
      return false
    }
    this.state = { ...this.state, error: null }
    this.emit()
    return true
  }
}
