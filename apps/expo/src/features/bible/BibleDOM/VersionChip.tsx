'use dom'

import React from 'react'
import { styled } from 'goober'
import type { ColumnTextModeControls, RootStyles } from './BibleDOMWrapper'
import ChevronDownIcon from './ChevronDownIcon'
import { INTERFACE_FONT } from './interfaceFont'
import { useTranslations } from './TranslationsContext'
import { radii } from '~common/ui/surfaces'

type TextModeKind = keyof ColumnTextModeControls

const TEXT_MODE_KINDS: TextModeKind[] = ['strong', 'interlinear']

// The header's book and version selectors: one pill split into segments by a thin gap
const SEGMENT_GAP = '3px'
const SEGMENT_RADIUS = `${radii.pill}px`

const Chip = styled('div')({
  display: 'inline-flex',
  alignItems: 'stretch',
  gap: SEGMENT_GAP,
  flexShrink: 0,
})

const segmentRadius = (isFirst: boolean, isLast: boolean) =>
  `${isFirst ? SEGMENT_RADIUS : 0} ${isLast ? SEGMENT_RADIUS : 0} ${isLast ? SEGMENT_RADIUS : 0} ${
    isFirst ? SEGMENT_RADIUS : 0
  }`

const VersionSegment = styled('div')<RootStyles & { $isLast: boolean; $height: number }>(
  ({ settings: { colors, theme }, $isLast, $height }) => ({
    fontFamily: INTERFACE_FONT,
    fontWeight: 'bold',
    fontSize: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    height: `${$height}px`,
    boxSizing: 'border-box',
    paddingInlineStart: '12px',
    paddingInlineEnd: $isLast ? '10px' : '7px',
    whiteSpace: 'nowrap',
    color: colors[theme].default,
    backgroundColor: colors[theme].lightGrey,
    borderRadius: segmentRadius(true, $isLast),
    webkitTouchCallout: 'none',
    webkitUserSelect: 'none',
    userSelect: 'none',
    cursor: 'pointer',
    '&:active': {
      opacity: 0.6,
    },
  })
)

const ModeSegment = styled('button')<
  RootStyles & { $active: boolean; $isLast: boolean; $height: number }
>(({ settings: { colors, theme }, $active, $isLast, $height }) => ({
  appearance: 'none',
  border: 'none',
  margin: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: `${$height}px`,
  boxSizing: 'border-box',
  paddingInlineStart: '8px',
  paddingInlineEnd: $isLast ? '11px' : '8px',
  backgroundColor: colors[theme].lightGrey,
  borderRadius: segmentRadius(false, $isLast),
  // The S and I marks of the header's display buttons
  color: $active ? colors[theme].primary : colors[theme].tertiary,
  fontFamily: 'Georgia, serif',
  fontWeight: 'bold',
  fontSize: '16px',
  lineHeight: 1,
  webkitTouchCallout: 'none',
  webkitUserSelect: 'none',
  userSelect: 'none',
  cursor: 'pointer',
  '&:active': { opacity: 0.6 },
}))

const ErrorIndicator = styled('span')<RootStyles>(({ settings: { theme, colors } }) => ({
  color: colors[theme].quart,
  marginLeft: '4px',
  fontSize: '12px',
}))

type Props = RootStyles & {
  version: string
  hasError?: boolean
  /** The Strong and interlinear segments the version supports. */
  controls?: ColumnTextModeControls
  withChevron?: boolean
  height?: number
  onVersionPress: () => void
  onTextModePress: (kind: TextModeKind) => void
}

/** A version's chip: its name opens the version selector, its S or I segment its display sheet. */
const VersionChip = ({
  settings,
  version,
  hasError,
  controls,
  withChevron,
  height = 32,
  onVersionPress,
  onTextModePress,
}: Props) => {
  const translations = useTranslations()
  const kinds = TEXT_MODE_KINDS.filter(kind => controls?.[kind])

  return (
    <Chip>
      <VersionSegment
        settings={settings}
        $isLast={kinds.length === 0}
        $height={height}
        onClick={onVersionPress}
      >
        {version}
        {hasError && <ErrorIndicator settings={settings}>⚠</ErrorIndicator>}
        {withChevron && <ChevronDownIcon style={{ marginLeft: 4 }} />}
      </VersionSegment>
      {kinds.map((kind, index) => {
        const control = controls?.[kind]
        if (!control) return null
        return (
          <ModeSegment
            key={kind}
            type="button"
            settings={settings}
            $active={control.active}
            $isLast={index === kinds.length - 1}
            $height={height}
            aria-pressed={control.active}
            aria-label={
              kind === 'strong'
                ? translations.chooseStrongDisplay
                : translations.originalTextOptions
            }
            onClick={() => onTextModePress(kind)}
          >
            {kind === 'strong' ? 'S' : 'I'}
          </ModeSegment>
        )
      })}
    </Chip>
  )
}

export default VersionChip
