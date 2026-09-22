import { useEffect, useState, useSyncExternalStore } from 'react'
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
}: {
  network: WorldMultiplayer
  language: 'fr' | 'en'
  open: boolean
  onOpen: () => void
  onClose: () => void
  disabled?: boolean
}) {
  const state = useSyncExternalStore(network.games.subscribe, network.games.getSnapshot)
  const { game, invitations } = state.snapshot
  const [options, setOptions] = useState<GameOptions>({
    kind: 'who',
    difficulty: 'easy',
    subject: 'mixed',
    testament: 'both',
    language,
  })
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
  const close = () => {
    setSelectedInvitation(null)
    setInvitationIssue(null)
    onClose()
  }
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
