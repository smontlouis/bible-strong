import { motion, useReducedMotion } from 'motion/react'
import { useAtomValue } from 'jotai/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  commandPaletteOpenAtom,
  commandPaletteScopeAtom,
  shortcutGuideOpenAtom,
  TAB_ACTIONS_SCOPE,
} from '~features/app-switcher/commandPalette/state'
import { activeTabIdAtom } from '~state/tabs'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { webThemeVariables } from '~themes/webThemeVariables'

import { Keycap, keysOf, withKeys } from './Keycap.web'
import { advanceTour, TOUR_STEPS, type TourStep } from './tourMachine'
import { trackOnboarding } from './trackOnboarding'
import './workspace-onboarding.css'

const DONE_DELAY_MS = 3200

const useCardStyle = () => {
  const theme = useTheme()
  return {
    ...webThemeVariables(theme.colors),
    '--onb-sans': resolveFontFamily(theme.fontFamily.text),
  } as CSSProperties
}

function Card({ children, label }: { children: ReactNode; label: string }) {
  const style = useCardStyle()
  const reduce = useReducedMotion()
  return (
    <motion.aside
      className="bs-tour"
      role="status"
      aria-label={label}
      style={{ ...style, x: '-50%' }}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 30 }}
    >
      {children}
    </motion.aside>
  )
}

/**
 * The tour card, beside the real workspace: it names the next key, and moves on when the app
 * shows the reader pressed it.
 */
export function WorkspaceTourCard({ onDone }: { onDone: (closed: boolean) => void }) {
  const { t } = useTranslation()
  const paletteOpen = useAtomValue(commandPaletteOpenAtom)
  const scope = useAtomValue(commandPaletteScopeAtom)
  const guideOpen = useAtomValue(shortcutGuideOpenAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const [step, setStep] = useState<TourStep>('palette')
  const tabAtStepStart = useRef(activeTabId)

  useEffect(() => {
    trackOnboarding({ flow: 'tour', step })
    tabAtStepStart.current = activeTabId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    const next = advanceTour(step, {
      paletteOpen,
      actionsOpen: paletteOpen && scope === TAB_ACTIONS_SCOPE,
      guideOpen,
      tabChanged: activeTabId !== tabAtStepStart.current,
    })
    if (next !== step) setStep(next)
  }, [step, paletteOpen, scope, guideOpen, activeTabId])

  useEffect(() => {
    if (step !== 'done') return
    const timer = setTimeout(() => onDone(false), DONE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [step, onDone])

  const close = () => {
    trackOnboarding({ flow: 'tour', step, action: 'close' })
    onDone(true)
  }

  const slots: Record<string, ReactNode> = {
    palette: <Keycap keys={keysOf('palette')} small />,
    actions: <Keycap keys={keysOf('tabActions')} small />,
    guide: <Keycap keys={keysOf('guide')} small />,
    enter: <Keycap keys={['↵']} small />,
    chevron: <Keycap keys={['>']} small />,
  }
  const number = step === 'done' ? TOUR_STEPS.length : TOUR_STEPS.indexOf(step) + 1

  return (
    <Card label={t('workspaceOnboarding.tour.label')}>
      <div className="bs-tour-head">
        <span className="bs-tour-eyebrow">
          {t('workspaceOnboarding.tour.eyebrow', { step: number, total: TOUR_STEPS.length })}
        </span>
        <button
          type="button"
          className="bs-tour-close"
          aria-label={t('workspaceOnboarding.tour.close')}
          onClick={close}
        >
          ×
        </button>
      </div>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <p className="bs-tour-title">{t(`workspaceOnboarding.tour.${step}.title`)}</p>
        <p className="bs-tour-body">
          {withKeys(t(`workspaceOnboarding.tour.${step}.body`), slots)}
        </p>
      </motion.div>
      <div className="bs-tour-footer">
        <div className="bs-tour-dots" aria-hidden="true">
          {TOUR_STEPS.map((item, index) => (
            <span key={item} data-done={index < number} />
          ))}
        </div>
        {step !== 'done' && (
          <div className="bs-tour-actions">
            <button type="button" className="bs-tour-text-button" onClick={close}>
              {t('workspaceOnboarding.tour.later')}
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

/** A first visit opened on a shared link: the story is offered, not imposed. */
export function WorkspaceInviteCard({
  onStart,
  onLater,
}: {
  onStart: () => void
  onLater: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card label={t('workspaceOnboarding.invite.title')}>
      <div className="bs-tour-head">
        <span className="bs-tour-eyebrow">{t('workspaceOnboarding.invite.eyebrow')}</span>
        <button
          type="button"
          className="bs-tour-close"
          aria-label={t('workspaceOnboarding.invite.later')}
          onClick={onLater}
        >
          ×
        </button>
      </div>
      <p className="bs-tour-title">{t('workspaceOnboarding.invite.title')}</p>
      <div className="bs-tour-footer">
        <div className="bs-tour-actions">
          <button type="button" className="bs-tour-text-button" onClick={onLater}>
            {t('workspaceOnboarding.invite.later')}
          </button>
          <button type="button" className="bs-tour-button" onClick={onStart}>
            {t('workspaceOnboarding.invite.start')}
          </button>
        </div>
      </div>
    </Card>
  )
}
