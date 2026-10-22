import Feather from '@expo/vector-icons/Feather'
import type { CSSProperties } from 'react'

import { radii } from '~common/ui/surfaces'
import type { RootStyles } from './BibleDOMWrapper'

/** What the plan offers after its passage: the next element of the day, or the day's end. */
export type PlanDayStepView = { kind: 'next' | 'finish'; label: string; title?: string }

type Props = RootStyles & { step: PlanDayStepView; onPress: () => void }

/**
 * Mirrors the card at the end of a plan element's page, in the Bible reader's own styles:
 * a card on the reading ground, set apart by its tint alone, with no border and no shadow.
 */
const PlanDayStepCard = ({ step, settings, onPress }: Props) => {
  const colors = settings.colors[settings.theme]
  const textStyle: CSSProperties = {
    display: 'block',
    overflow: 'hidden',
    fontFamily: settings.fontFamily,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={step.title ? `${step.label}, ${step.title}` : step.label}
      style={{
        direction: 'ltr',
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 14,
        marginTop: 48,
        padding: '14px 16px',
        border: 0,
        borderRadius: radii.card,
        background: colors.lightGrey,
        cursor: 'pointer',
        textAlign: 'left',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ ...textStyle, color: colors.link, fontSize: 16, lineHeight: 1.3 }}>
          {step.label}
        </strong>
        {step.title && (
          <span
            style={{
              ...textStyle,
              marginTop: 2,
              color: colors.default,
              fontSize: 14,
              lineHeight: 1.3,
            }}
          >
            {step.title}
          </span>
        )}
      </span>
      <span
        aria-hidden
        style={{
          display: 'grid',
          flexShrink: 0,
          width: 36,
          height: 36,
          placeItems: 'center',
          borderRadius: '50%',
          background: colors.primary,
        }}
      >
        <Feather
          name={step.kind === 'next' ? 'arrow-right' : 'check'}
          size={18}
          color={colors.reverse}
        />
      </span>
    </button>
  )
}

export default PlanDayStepCard
