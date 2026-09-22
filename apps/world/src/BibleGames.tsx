import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { WorldMultiplayer } from './multiplayer'
import type { GameAction, GameOptions, GameError, GameInvitation } from './games-protocol'
import { BibleGamesView } from './BibleGamesView'

export function BibleGames({
  network,
  language,
  open,
  onOpen,
  onClose,
  disabled = false,
  preferredMode = null,
}: {
  network: WorldMultiplayer
  language: 'fr' | 'en'
  open: boolean
  onOpen: () => void
  onClose: () => void
  disabled?: boolean
  /** Tab to select when the dialog opens: solo from the station, together near a visitor. */
  preferredMode?: 'solo' | 'together' | null
}) {
  const state = useSyncExternalStore(network.games.subscribe, network.games.getSnapshot)
  const { game, invitations } = state.snapshot
  const menuPaused = game?.solo?.pauses.includes('menu')
  useEffect(() => {
    if (game?.solo && state.online && menuPaused === open)
      network.games.command({ action: open ? 'resume-solo' : 'pause-solo' })
  }, [game?.id, Boolean(game?.solo), menuPaused, open, state.online, network])
  const [options, setOptionsState] = useState<GameOptions>({
    kind: 'who',
    difficulty: 'easy',
    subject: 'mixed',
    testament: 'both',
    language,
  })
  // Solo only exists as a Bible challenge; coming back to Together restores the last
  // shared game the visitor picked instead of keeping the kind solo imposed.
  const togetherKind = useRef<GameOptions['kind']>('who')
  const withMode = (current: GameOptions, mode: 'solo' | 'together'): GameOptions => {
    if (mode === 'solo') return { ...current, mode: 'solo', kind: 'quiz' }
    return {
      ...current,
      mode: 'together',
      kind: current.mode === 'solo' ? togetherKind.current : current.kind,
    }
  }
  const setOptions = (next: GameOptions) => {
    const value =
      next.mode === 'together' && options.mode === 'solo'
        ? { ...next, kind: togetherKind.current }
        : next
    if (value.mode !== 'solo') togetherKind.current = value.kind
    setOptionsState(value)
  }
  // Apply the requested tab while rendering, so the dialog never paints the other one first.
  const request = open && preferredMode ? preferredMode : null
  const [appliedRequest, setAppliedRequest] = useState<typeof request>(null)
  if (request !== appliedRequest) {
    setAppliedRequest(request)
    if (request && (options.mode ?? 'together') !== request)
      setOptionsState(current => withMode(current, request))
  }
  const [selectedInvitation, setSelectedInvitation] = useState<GameInvitation | null>(null)
  const [invitationIssue, setInvitationIssue] = useState<GameError | null>(null)
  const [invitationAction, setInvitationAction] = useState<{
    id: string
    gameId: string
    action: 'accept' | 'decline'
  } | null>(null)
  const [clock, setClock] = useState(Date.now)
  useEffect(() => {
    if (!open && invitations.length === 0) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open, invitations.length])
  const now = Math.max(state.snapshot.now, clock + state.offset)
  const send = (action: GameAction) => network.games.command(action)
  // Closing a finished game (victory, summary, interruption) leaves it, so "My game" goes
  // away. Offline, the departure is sent as soon as the connection returns.
  const [leaveOnReturn, setLeaveOnReturn] = useState<string | null>(null)
  const close = () => {
    if (game?.phase === 'finished') {
      if (!(state.online && send({ action: 'leave' }))) setLeaveOnReturn(game.id)
    }
    setSelectedInvitation(null)
    setInvitationIssue(null)
    onClose()
  }
  useEffect(() => {
    if (!leaveOnReturn || !state.online) return
    if (game?.id === leaveOnReturn && game.phase === 'finished' && !open)
      network.games.command({ action: 'leave' })
    setLeaveOnReturn(null)
  }, [leaveOnReturn, state.online, game?.id, game?.phase, open, network])
  const selectInvitation = (invite: GameInvitation) => {
    setSelectedInvitation(invite)
    setInvitationIssue(null)
    onOpen()
  }
  const answerInvitation = (action: 'accept' | 'decline') => {
    if (
      !selectedInvitation ||
      invitationAction ||
      !state.online ||
      selectedInvitation.expires <= now
    )
      return
    setInvitationIssue(null)
    if (send({ action, invitation: selectedInvitation.id })) {
      setInvitationAction({ id: selectedInvitation.id, gameId: selectedInvitation.gameId, action })
    } else setInvitationIssue('unavailable')
  }
  useEffect(() => {
    // A delayed acknowledgement after reconnect still opens the joined lobby.
    if (selectedInvitation && game?.id === selectedInvitation.gameId) {
      setInvitationAction(null)
      setSelectedInvitation(null)
      setInvitationIssue(null)
      return
    }
    if (!invitationAction) return
    if (invitationAction.action === 'accept' && game?.id === invitationAction.gameId) {
      setInvitationAction(null)
      setSelectedInvitation(null)
      setInvitationIssue(null)
    } else if (state.error) {
      setInvitationAction(null)
      setInvitationIssue(state.error)
    } else if (!invitations.some(i => i.id === invitationAction.id)) {
      setInvitationAction(null)
      if (invitationAction.action === 'decline') {
        setSelectedInvitation(null)
        onClose()
      }
    }
  }, [game?.id, invitations, invitationAction, selectedInvitation, state.error, onClose])
  useEffect(() => {
    if (!invitationAction) return
    const timer = setTimeout(() => {
      setInvitationAction(null)
      setInvitationIssue('unavailable')
    }, 8000)
    return () => clearTimeout(timer)
  }, [invitationAction])
  const nearby = network.nearby().filter(p => !game?.players.some(member => member.id === p.id))
  return (
    <BibleGamesView
      stationOnly
      snapshot={state.snapshot}
      me={state.me}
      online={state.online}
      error={state.error}
      now={now}
      language={language}
      open={open}
      disabled={disabled}
      options={options}
      setOptions={setOptions}
      selectedInvitation={selectedInvitation}
      invitationIssue={invitationIssue}
      invitationAction={invitationAction}
      nearby={nearby}
      onOpen={() => {
        setSelectedInvitation(null)
        onOpen()
      }}
      close={close}
      selectInvitation={selectInvitation}
      answerInvitation={answerInvitation}
      send={send}
    />
  )
}
