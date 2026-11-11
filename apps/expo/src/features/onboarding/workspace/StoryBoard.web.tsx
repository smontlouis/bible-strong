import { Image } from 'expo-image'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import Color from 'color'

import { FeatherIcon } from '~common/ui/Icon'
import TabIcon from '~features/app-switcher/utils/getIconByTabType'
import { getContrastTextColor } from '~helpers/highlightUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useTheme } from '~themes/ThemeProvider'
import { colorWithOpacity } from '~themes/colorValues'
import { resolveUniverseColors, type UniverseItem } from '~themes/universeColors'

import { Keycap, keysOf } from './Keycap.web'
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_TYPES,
  OCCURRENCE_FILTERS,
  STORY_STEPS,
  STORY_TOOLS,
  type OccurrenceFilter,
  type StoryAction,
  type StoryHighlightType,
  type StoryState,
  type StoryTool,
} from './storyMachine'

/** The board is drawn in its own units, then scaled to the room the window gives it. */
export const BOARD_WIDTH = 1000
export const BOARD_HEIGHT = 600

type Box = { x: number; y: number; w: number; h: number }

const VERSE_CENTER: Box = { x: 300, y: 170, w: 400, h: 230 }
const VERSE_LEFT: Box = { x: 0, y: 180, w: 400, h: 230 }
const STUDY: Box = { x: 0, y: 0, w: 320, h: 112 }
const NOTE: Box = { x: 0, y: 444, w: 400, h: 156 }
const STRONG: Box = { x: 520, y: 0, w: 480, h: 236 }
const CONCORDANCE: Box = { x: 520, y: 254, w: 480, h: 346 }
const TOOL_X = 560
const TOOL_SIZE = { w: 280, h: 56 }
const toolY = (index: number) => 24 + index * 94
/** The reader's selection (`TEXT_SELECTION_COLOR` of the Bible DOM). */
const VERSE_SELECTION = 'rgba(0, 122, 255, 0.18)'

const TOOL_LABELS: Record<StoryTool, string> = {
  lexicon: 'onboarding.abel.sceneTwo.lexique',
  dictionary: 'onboarding.abel.sceneTwo.dictionary',
  topics: 'onboarding.abel.sceneTwo.themes',
  references: 'onboarding.abel.sceneTwo.references',
  commentary: 'onboarding.abel.sceneTwo.comments',
  compare: 'onboarding.abel.sceneTwo.comparisons',
}

const TOOL_UNIVERSES: Record<StoryTool, UniverseItem> = {
  lexicon: 'strong',
  dictionary: 'dictionary',
  topics: 'nave',
  references: 'references',
  commentary: 'commentary',
  compare: 'compare',
}

const OCCURRENCES: Record<OccurrenceFilter, { prefix: string; parts?: string[] }[]> = {
  vanity: [
    { prefix: 'ecclesiastes' },
    { prefix: 'proverbs', parts: ['Before', 'Highlight', ''] },
    { prefix: 'job' },
  ],
  idol: [{ prefix: 'idolDeuteronomy' }, { prefix: 'idolKings' }, { prefix: 'idolPsalms' }],
  breath: [
    { prefix: 'breathJob' },
    { prefix: 'breathPsalmThirtyNine' },
    { prefix: 'breathPsalmOneFortyFour' },
  ],
}

const FILTER_LABELS: Record<OccurrenceFilter, string> = {
  vanity: 'onboarding.abel.sceneFour.filterVanity',
  idol: 'onboarding.abel.sceneFour.filterIdol',
  breath: 'onboarding.abel.sceneFour.filterBreath',
}

const ICONS = {
  references: require('~assets/images/tab-icons/references.svg'),
}

/** The mark of a kind of study object: its icon on a 12% tint of its colour. */
export function UniverseTile({ universe, size = 30 }: { universe: UniverseItem; size?: number }) {
  const theme = useTheme()
  const { foreground, background } = resolveUniverseColors(theme.colors, universe)
  const icon = Math.round(size * 0.55)
  return (
    <span
      className="bs-onb-tile"
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: background }}
    >
      {universe === 'references' ? (
        <Image
          source={ICONS.references}
          style={{ width: icon, height: icon }}
          tintColor={foreground}
          contentFit="contain"
        />
      ) : universe === 'tags' ? (
        <FeatherIcon name="tag" size={icon} color={foreground} />
      ) : (
        <TabIcon type={universe as never} size={icon} color={foreground} />
      )}
    </span>
  )
}

const useSpring = (): Transition => {
  const reduce = useReducedMotion()
  return reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }
}

const boxStyle = (box: Box): CSSProperties => ({
  left: 0,
  top: 0,
  width: box.w,
  height: box.h,
})

/** A piece of the board that comes in place, and leaves smaller. */
function Piece({
  box,
  className,
  children,
  delay = 0,
  style,
}: {
  box: Box
  className: string
  children: ReactNode
  delay?: number
  style?: CSSProperties
}) {
  const spring = useSpring()
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={{ ...boxStyle(box), ...style }}
      initial={reduce ? false : { opacity: 0, x: box.x, y: box.y + 14, scale: 0.97 }}
      animate={{ opacity: 1, x: box.x, y: box.y, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      transition={{ ...spring, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  )
}

/** A highlight as the reader draws each of its types (`getHighlightStyles` of the Bible DOM). */
function highlightStyle(color: string, type: StoryHighlightType, dark: boolean): CSSProperties {
  switch (type) {
    case 'background':
      return {
        backgroundColor: colorWithOpacity(color, 0.9),
        color: getContrastTextColor(Color(color).hex(), dark),
        // The fill runs past the letters, as in the reader, without pushing them apart.
        padding: '1px 3px',
        margin: '0 -3px',
      }
    case 'textColor':
      return { color }
    case 'underline':
      return {
        backgroundImage: `linear-gradient(to top, ${colorWithOpacity(color, 0.6)} 34%, transparent 34%)`,
      }
  }
}

function VerseCard({ state, dispatch }: { state: StoryState; dispatch: (a: StoryAction) => void }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const spring = useSpring()
  const centered = state.step === 'highlight' || state.returned
  const box = centered ? VERSE_CENTER : VERSE_LEFT
  const { colorScheme } = useCurrentThemeSelector()
  // As in the mobile story, the highlight lands on « Abel », the word the story follows. The
  // selection is the reader's translucent blue over the verse, cut at each line with its radius;
  // it gives way to the highlight once there is one.
  const mark = state.color ? theme.colors[state.color] : undefined
  const selected = state.selected && !state.returned && !mark
  const studied = state.step === 'strong' || state.step === 'occurrences'
  return (
    <motion.div
      className="bs-onb-card bs-onb-verse"
      style={boxStyle(box)}
      initial={false}
      animate={{ x: box.x, y: box.y }}
      transition={spring}
      onClick={() => {
        if (state.step === 'highlight' && !state.selected)
          dispatch({ type: 'shortcut', id: 'nextVerse' })
      }}
    >
      <div className="bs-onb-verse-reference">{t('onboarding.abel.sceneOne.chapter')}</div>
      <p className="bs-onb-verse-text">
        <span className="bs-onb-verse-number">2</span>
        <span
          className="bs-onb-verse-run"
          style={{
            backgroundImage: selected
              ? `linear-gradient(${VERSE_SELECTION}, ${VERSE_SELECTION})`
              : 'none',
          }}
        >
          {t('onboarding.abel.sceneOne.lineOne')}{' '}
          <span
            className="bs-onb-verse-word"
            data-studied={studied}
            style={
              mark ? highlightStyle(mark, state.highlightType, colorScheme === 'dark') : undefined
            }
          >
            {t('onboarding.abel.sceneOne.highlightWord')}
          </span>
          {t('onboarding.abel.sceneOne.lineTwo')} {t('onboarding.abel.sceneOne.lineThree')}
        </span>
      </p>
      <div className="bs-onb-verse-version">{t('onboarding.abel.sceneOne.translation')}</div>
    </motion.div>
  )
}

const HIGHLIGHT_TYPE_LABELS: Record<StoryHighlightType, string> = {
  background: 'Fond',
  textColor: 'Texte',
  underline: 'Soulignement',
}

/**
 * The highlight colours under the verse, each beside the key that gives it, then, once the
 * verse holds a colour, the three styles the reader can draw it in.
 */
function Swatches({ state, dispatch }: { state: StoryState; dispatch: (a: StoryAction) => void }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const { colorScheme } = useCurrentThemeSelector()
  const mark = state.color ? theme.colors[state.color] : undefined
  // As wide as the verse and more; each bar takes its own width at the middle.
  const box: Box = {
    x: VERSE_CENTER.x - 60,
    y: VERSE_CENTER.y + VERSE_CENTER.h + 22,
    w: VERSE_CENTER.w + 120,
    h: 112,
  }
  return (
    <Piece box={box} className="bs-onb-piece bs-onb-swatches-row">
      <div className="bs-onb-swatches" role="group" aria-label={t('workspaceOnboarding.colors')}>
        {HIGHLIGHT_COLORS.map((color, index) => {
          const active = state.color === color
          return (
            <button
              key={color}
              type="button"
              className="bs-onb-swatch"
              data-active={active}
              aria-label={t(`onboarding.abel.sceneOne.${color}`)}
              aria-pressed={active}
              onMouseDown={event => event.preventDefault()}
              onClick={() => dispatch({ type: 'shortcut', id: 'highlight', digit: index + 1 })}
            >
              <span
                className="bs-onb-swatch-color"
                style={{ backgroundColor: theme.colors[color] }}
              />
              <Keycap keys={[String(index + 1)]} small active={active} />
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {mark && (
          <motion.div
            className="bs-onb-swatches"
            role="radiogroup"
            aria-label={t('workspaceOnboarding.styles')}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {HIGHLIGHT_TYPES.map(type => (
              <button
                key={type}
                type="button"
                role="radio"
                className="bs-onb-swatch bs-onb-style"
                data-active={state.highlightType === type}
                aria-checked={state.highlightType === type}
                onMouseDown={event => event.preventDefault()}
                onClick={() => dispatch({ type: 'highlightType', value: type })}
              >
                <span
                  className="bs-onb-style-sample"
                  style={highlightStyle(mark, type, colorScheme === 'dark')}
                >
                  Aa
                </span>
                {t(HIGHLIGHT_TYPE_LABELS[type])}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Piece>
  )
}

/** A curve from one piece to another, drawn under them. */
const curve = (from: [number, number], to: [number, number], vertical = false) => {
  const [x1, y1] = from
  const [x2, y2] = to
  if (vertical) {
    const middle = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`
  }
  const middle = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`
}

function Lines({ paths, color }: { paths: string[]; color: string }) {
  const reduce = useReducedMotion()
  return (
    <svg
      className="bs-onb-lines"
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
    >
      {paths.map((d, index) => (
        <motion.path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : index * 0.06 }}
        />
      ))}
    </svg>
  )
}

function Tools({ state, dispatch }: { state: StoryState; dispatch: (a: StoryAction) => void }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const from: [number, number] = [VERSE_LEFT.x + VERSE_LEFT.w, VERSE_LEFT.y + VERSE_LEFT.h / 2]
  return (
    <>
      <Lines
        color={theme.colors.separator}
        paths={STORY_TOOLS.map((_, index) => curve(from, [TOOL_X, toolY(index) + TOOL_SIZE.h / 2]))}
      />
      {STORY_TOOLS.map((tool, index) => (
        <Piece
          key={tool}
          box={{ x: TOOL_X, y: toolY(index), ...TOOL_SIZE }}
          className="bs-onb-card"
          delay={index * 0.04}
        >
          <button
            type="button"
            className="bs-onb-tool"
            data-active={state.tool === tool}
            onMouseDown={event => event.preventDefault()}
            onClick={() => dispatch({ type: 'shortcut', id: tool })}
          >
            <UniverseTile universe={TOOL_UNIVERSES[tool]} />
            <span className="bs-onb-tool-label">{t(TOOL_LABELS[tool])}</span>
            <Keycap
              keys={keysOf(tool)}
              small
              active={tool === 'lexicon'}
              nudge={tool === 'lexicon' && state.nudge?.key === 'lexicon' ? state.nudge.count : 0}
            />
          </button>
        </Piece>
      ))}
    </>
  )
}

function StrongCard({
  state,
  dispatch,
}: {
  state: StoryState
  dispatch: (a: StoryAction) => void
}) {
  const { t } = useTranslation()
  const proper = state.word === 'proper'
  return (
    <Piece box={STRONG} className="bs-onb-card bs-onb-strong">
      <div className="bs-onb-card-head">
        <UniverseTile universe="strong" />
        <span className="bs-onb-card-eyebrow">
          {t('onboarding.abel.sceneThree.strongLabel')} ·{' '}
          {t(
            proper
              ? 'onboarding.abel.sceneThree.properType'
              : 'onboarding.abel.sceneThree.commonType'
          )}
        </span>
        <span className="bs-onb-code">
          {t(
            proper ? 'onboarding.abel.sceneFive.abelLabel' : 'onboarding.abel.sceneFive.hevelLabel'
          )}
        </span>
      </div>
      <div className="bs-onb-hebrew">
        <span className="bs-onb-hebrew-word" lang="he" dir="rtl">
          הֶבֶל
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state.word}
            className="bs-onb-transliteration"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {t(
              proper
                ? 'onboarding.abel.sceneThree.properTransliteration'
                : 'onboarding.abel.sceneThree.commonTransliteration'
            )}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="bs-onb-segments" role="radiogroup">
        {(['proper', 'common'] as const).map(word => (
          <button
            key={word}
            type="button"
            role="radio"
            className="bs-onb-segment"
            aria-checked={state.word === word}
            onMouseDown={event => event.preventDefault()}
            onClick={() => dispatch({ type: 'word', word })}
          >
            {t(
              word === 'proper'
                ? 'onboarding.abel.sceneThree.properTitle'
                : 'onboarding.abel.sceneThree.commonTitle'
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state.word}
          className="bs-onb-definition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {t(
            proper
              ? 'onboarding.abel.sceneThree.properDefinition'
              : 'onboarding.abel.sceneThree.commonDefinition'
          )}
        </motion.div>
      </AnimatePresence>
    </Piece>
  )
}

function OccurrenceText({ prefix, parts }: { prefix: string; parts?: string[] }) {
  const { t } = useTranslation()
  const key = (suffix: string) => `onboarding.abel.sceneFour.${prefix}${suffix}`
  if (prefix === 'ecclesiastes')
    return (
      <>
        <mark>{t(key('HighlightOne'))}</mark>
        {t(key('Middle'))}
        <mark>{t(key('HighlightTwo'))}</mark>
        {t(key('After'))}
      </>
    )
  const [before, highlight, after] = parts ?? ['Before', 'Highlight', 'After']
  return (
    <>
      {t(key(before))}
      <mark>{t(key(highlight))}</mark>
      {after ? t(key(after)) : null}
    </>
  )
}

function Concordance({
  state,
  dispatch,
}: {
  state: StoryState
  dispatch: (a: StoryAction) => void
}) {
  const { t } = useTranslation()
  return (
    <Piece box={CONCORDANCE} className="bs-onb-card bs-onb-concordance" delay={0.05}>
      <div className="bs-onb-card-head">
        <UniverseTile universe="strong" />
        <span className="bs-onb-card-eyebrow">
          {t('onboarding.abel.sceneFour.hebrew')} · {t('onboarding.abel.sceneFive.hevelLabel')}
        </span>
        <span className="bs-onb-count">
          <strong>{t('onboarding.abel.sceneFour.occurrenceCount')}</strong>
          <span>{t('onboarding.abel.sceneFour.usageCount')}</span>
        </span>
      </div>
      <div className="bs-onb-filters" role="radiogroup">
        {OCCURRENCE_FILTERS.map(filter => (
          <button
            key={filter}
            type="button"
            role="radio"
            className="bs-onb-filter"
            aria-checked={state.filter === filter}
            onMouseDown={event => event.preventDefault()}
            onClick={() => dispatch({ type: 'filter', filter })}
          >
            {t(FILTER_LABELS[filter])}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={state.filter}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {OCCURRENCES[state.filter].map(occurrence => (
            <div key={occurrence.prefix} className="bs-onb-occurrence">
              <div className="bs-onb-occurrence-reference">
                {t(`onboarding.abel.sceneFour.${occurrence.prefix}Reference`)}
              </div>
              <div className="bs-onb-occurrence-text">
                <OccurrenceText {...occurrence} />
              </div>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </Piece>
  )
}

function NoteCard({ state }: { state: StoryState }) {
  const { t } = useTranslation()
  return (
    <Piece box={NOTE} className="bs-onb-card bs-onb-note">
      <div className="bs-onb-card-head">
        <UniverseTile universe="notes" size={26} />
        <span className="bs-onb-card-eyebrow">{t('onboarding.abel.sceneFive.noteLabel')}</span>
      </div>
      <div className="bs-onb-note-text">{t('onboarding.abel.sceneFive.noteQuestion')}</div>
      <div className="bs-onb-chips">
        <span className="bs-onb-chip">
          <UniverseTile universe="bible" size={22} />
          {t('onboarding.abel.sceneFive.genesisChip')}
        </span>
        <AnimatePresence>
          {state.tagged && (
            <motion.span
              className="bs-onb-chip"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <UniverseTile universe="tags" size={22} />
              <span>{t('onboarding.abel.sceneThree.properTitle')}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Piece>
  )
}

function Placeholder({
  box,
  keys,
  label,
  nudge,
  onPress,
}: {
  box: Box
  keys: string[]
  label: string
  nudge?: number
  onPress: () => void
}) {
  return (
    <Piece box={box} className="bs-onb-piece">
      <button
        type="button"
        className="bs-onb-placeholder"
        onMouseDown={event => event.preventDefault()}
        onClick={onPress}
      >
        <Keycap keys={keys} small nudge={nudge} />
        {label}
      </button>
    </Piece>
  )
}

function StudyCard() {
  const { t } = useTranslation()
  return (
    <Piece box={STUDY} className="bs-onb-card bs-onb-study">
      <div className="bs-onb-card-head">
        <UniverseTile universe="study" size={26} />
        <span className="bs-onb-study-title">{t('onboarding.abel.sceneSix.studyTitle')}</span>
      </div>
      <div className="bs-onb-study-detail">{t('onboarding.abel.sceneSix.studyDetail')}</div>
    </Piece>
  )
}

const RELATIONS: {
  from: [number, number]
  to: [number, number]
  label: string
  vertical?: boolean
}[] = [
  {
    from: [STUDY.x + 150, STUDY.y + STUDY.h],
    to: [VERSE_LEFT.x + 150, VERSE_LEFT.y],
    label: 'onboarding.abel.sceneSix.mentions',
    vertical: true,
  },
  {
    from: [NOTE.x + 250, NOTE.y],
    to: [VERSE_LEFT.x + 250, VERSE_LEFT.y + VERSE_LEFT.h],
    label: 'onboarding.abel.sceneSix.explains',
    vertical: true,
  },
  {
    from: [NOTE.x + NOTE.w, NOTE.y + NOTE.h / 2],
    to: [CONCORDANCE.x, CONCORDANCE.y + 150],
    label: 'onboarding.abel.sceneSix.references',
  },
  {
    from: [STUDY.x + STUDY.w, STUDY.y + STUDY.h / 2],
    to: [STRONG.x, STRONG.y + 70],
    label: 'onboarding.abel.sceneSix.linkedTo',
  },
]

function Relations() {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <>
      <Lines
        color={theme.colors.primary}
        paths={RELATIONS.map(relation => curve(relation.from, relation.to, relation.vertical))}
      />
      {RELATIONS.map(({ from, to, label }) => (
        <motion.span
          key={label}
          className="bs-onb-relation-label"
          style={{ left: (from[0] + to[0]) / 2, top: (from[1] + to[1]) / 2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.3 }}
        >
          {t(label)}
        </motion.span>
      ))}
    </>
  )
}

/** What the story found, around the verse once the reader is back to it. `w` is their width. */
const PILLS: { universe: UniverseItem; label: string; x: number; y: number; w: number }[] = [
  { universe: 'strong', label: 'onboarding.abel.sceneFive.abelLabel', x: 300, y: 100, w: 108 },
  { universe: 'strong', label: 'onboarding.abel.sceneFive.hevelLabel', x: 590, y: 100, w: 108 },
  { universe: 'notes', label: 'onboarding.abel.sceneSeven.note', x: 240, y: 448, w: 96 },
  { universe: 'study', label: 'onboarding.abel.sceneSeven.study', x: 440, y: 470, w: 104 },
  { universe: 'bible', label: 'onboarding.abel.sceneSeven.ecclesiastes', x: 600, y: 448, w: 180 },
]
const PILL_HEIGHT = 40

function Pills() {
  const { t } = useTranslation()
  const theme = useTheme()
  const reduce = useReducedMotion()
  const center: [number, number] = [
    VERSE_CENTER.x + VERSE_CENTER.w / 2,
    VERSE_CENTER.y + VERSE_CENTER.h / 2,
  ]
  return (
    <>
      <Lines
        color={theme.colors.separator}
        paths={PILLS.map(pill =>
          curve(center, [pill.x + pill.w / 2, pill.y + PILL_HEIGHT / 2], true)
        )}
      />
      {PILLS.map((pill, index) => (
        <motion.span
          key={pill.label}
          className="bs-onb-pill"
          style={{ left: pill.x, top: pill.y }}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            delay: reduce ? 0 : 0.18 + index * 0.06,
            type: 'spring',
            stiffness: 300,
            damping: 24,
          }}
        >
          <UniverseTile universe={pill.universe} size={26} />
          <span>{t(pill.label)}</span>
        </motion.span>
      ))}
    </>
  )
}

const stepAtLeast = (state: StoryState, step: (typeof STORY_STEPS)[number]) =>
  state.step === 'finish' || STORY_STEPS.indexOf(state.step) >= STORY_STEPS.indexOf(step)

/** The board, which fills up step after step around the verse, then empties back to it. */
export function StoryBoard({
  state,
  dispatch,
}: {
  state: StoryState
  dispatch: (action: StoryAction) => void
}) {
  const { t } = useTranslation()
  const live = !state.returned
  const showStrong = live && stepAtLeast(state, 'strong')
  const showConcordance = live && stepAtLeast(state, 'occurrences')
  const showNote = live && stepAtLeast(state, 'note') && state.noted
  const showStudy = live && stepAtLeast(state, 'relations') && state.related
  return (
    <BoardFrame>
      <AnimatePresence>
        {state.step === 'tools' && <Tools key="tools" state={state} dispatch={dispatch} />}
        {showStudy && <Relations key="relations" />}
        {showStrong && <StrongCard key="strong" state={state} dispatch={dispatch} />}
        {showConcordance && <Concordance key="concordance" state={state} dispatch={dispatch} />}
        {showNote && <NoteCard key="note" state={state} />}
        {state.step === 'note' && !state.noted && (
          <Placeholder
            key="note-placeholder"
            box={NOTE}
            keys={keysOf('note')}
            label={t('onboarding.abel.sceneFour.addNote')}
            nudge={state.nudge?.key === 'note' ? state.nudge.count : 0}
            onPress={() => dispatch({ type: 'shortcut', id: 'note' })}
          />
        )}
        {showStudy && <StudyCard key="study" />}
        {state.step === 'relations' && !state.related && (
          <Placeholder
            key="study-placeholder"
            box={STUDY}
            keys={keysOf('relation')}
            label={t('onboarding.abel.sceneFive.relations')}
            nudge={state.nudge?.key === 'relation' ? state.nudge.count : 0}
            onPress={() => dispatch({ type: 'shortcut', id: 'relation' })}
          />
        )}
        {state.step === 'highlight' && state.selected && (
          <Swatches key="swatches" state={state} dispatch={dispatch} />
        )}
        {state.returned && <Pills key="pills" />}
      </AnimatePresence>
      <VerseCard state={state} dispatch={dispatch} />
    </BoardFrame>
  )
}

/** Scales the board to the room it has, never past its own size. */
function BoardFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const { width, height } = element.getBoundingClientRect()
      setScale(Math.max(0.3, Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT, 1)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="bs-onb-board-wrap">
      {scale > 0 && (
        <div
          className="bs-onb-board"
          style={{
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
