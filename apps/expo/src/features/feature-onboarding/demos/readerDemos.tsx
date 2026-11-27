import { useAnimatedStyle } from 'react-native-reanimated'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { at, Bone, DemoStage, Finger, MiniSurface, Shape, useDemoProgress } from './demoKit'

const CELL_WIDTH = 36
const CELL_HEIGHT = 28
const CELL_GAP = 8
const GRID_X = 24
const GRID_Y = 14

/** A long press on a chapter opens it in a new tab: the tab counter goes from 1 to 2. */
export function ChapterLongPressDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2800)
  const pressed = { row: 1, column: 2 }
  const cellX = GRID_X + pressed.column * (CELL_WIDTH + CELL_GAP)
  const cellY = GRID_Y + pressed.row * (CELL_HEIGHT + CELL_GAP)
  const counter = { x: 236, y: 108, size: 26 }

  const pressedStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.2, 0.3, 0.6, 0.7], [0, 1, 1, 0]),
  }))
  const flyingStyle = useAnimatedStyle(() => {
    const p = progress.get()
    const travel = at(p, [0.55, 0.78], [0, 1])
    return {
      opacity: at(p, [0.55, 0.58, 0.74, 0.8], [0, 1, 1, 0]),
      transform: [
        { translateX: travel * (counter.x - cellX) },
        { translateY: travel * (counter.y - cellY) },
        { scale: 1 - travel * 0.5 },
      ],
    }
  })
  const oneStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.76, 0.8], [1, 0]) }))
  const twoStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.76, 0.8], [0, 1]) }))
  const counterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: at(progress.get(), [0.76, 0.82, 0.9], [1, 1.2, 1]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      {Array.from({ length: 3 }).map((_, row) =>
        Array.from({ length: 5 }).map((__, column) => (
          <Shape
            key={`${row}-${column}`}
            x={GRID_X + column * (CELL_WIDTH + CELL_GAP)}
            y={GRID_Y + row * (CELL_HEIGHT + CELL_GAP)}
            width={CELL_WIDTH}
            height={CELL_HEIGHT}
            className="rounded-[8px] bg-reverse items-center justify-center"
          >
            <Shape x={11} y={11} width={14} height={6} className="rounded-full bg-border" />
          </Shape>
        ))
      )}
      <Shape
        x={cellX}
        y={cellY}
        width={CELL_WIDTH}
        height={CELL_HEIGHT}
        className="rounded-[8px] bg-light-primary"
        style={pressedStyle}
      />
      <Shape
        x={cellX}
        y={cellY}
        width={CELL_WIDTH}
        height={CELL_HEIGHT}
        className="rounded-[8px] bg-primary"
        style={flyingStyle}
      />
      <Shape
        x={counter.x}
        y={counter.y}
        width={counter.size}
        height={counter.size}
        className="rounded-[8px] border-[1.5px] border-default"
        style={counterStyle}
      >
        <Shape
          x={0}
          y={0}
          width={23}
          height={23}
          className="items-center justify-center"
          style={oneStyle}
        >
          <Text className="text-[12px] font-bold">1</Text>
        </Shape>
        <Shape
          x={0}
          y={0}
          width={23}
          height={23}
          className="items-center justify-center"
          style={twoStyle}
        >
          <Text className="text-[12px] font-bold">2</Text>
        </Shape>
      </Shape>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.1, 0.2, 0.55, 0.6, 0.7, 1],
          x: [cellX + 50, cellX + 18, cellX + 18, cellX + 18, cellX + 18, cellX + 18, cellX + 18],
          y: [cellY + 50, cellY + 14, cellY + 14, cellY + 14, cellY + 14, cellY + 14, cellY + 14],
          down: [0, 0, 1, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 0, 0],
          hold: [0, 0, 0, 1, 1, 1, 1],
        }}
      />
    </DemoStage>
  )
}

/**
 * The button at the top right of the book selector opens its settings: order, verse, display. The
 * reader picks the display, and the list of books turns into a grid.
 */
export function BookSelectorDisplayDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(3400)
  const button = { x: 222, y: 16, size: 26 }
  const panel = { x: 112, y: 48, width: 136, rowHeight: 22 }
  const displayRow = { x: panel.x + 60, y: panel.y + 8 + 2 * panel.rowHeight + 11 }

  const panelStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.2, 0.26, 0.5, 0.56], [0, 1, 1, 0])
    return { opacity: shown, transform: [{ translateY: (1 - shown) * -6 }] }
  })
  const rowStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.4, 0.43, 0.5], [0, 1, 1]),
  }))
  const listStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.55, 0.65], [1, 0]) }))
  const gridStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.58, 0.72], [0, 1])
    return { opacity: shown, transform: [{ scale: 0.94 + shown * 0.06 }] }
  })
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: at(progress.get(), [0.14, 0.17, 0.22], [1, 0.85, 1]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={4} width={232} height={142}>
        <Bone x={84} y={24} width={64} height={8} className="bg-grey" />
        <Shape
          x={button.x - 24}
          y={button.y}
          width={button.size}
          height={button.size}
          className="rounded-full bg-light-grey items-center justify-center"
          style={buttonStyle}
        >
          <IonIcon name="filter" size={14} color="default" />
        </Shape>
        <Shape x={0} y={50} width={232} height={92} style={listStyle}>
          {[0, 1, 2, 3].map(index => (
            <Shape key={index} x={16} y={index * 22} width={200} height={22}>
              <Bone x={0} y={8} width={[90, 70, 110, 60][index]} />
              <Shape x={0} y={21} width={200} height={1} className="bg-border" />
            </Shape>
          ))}
        </Shape>
        <Shape x={0} y={50} width={232} height={92} style={gridStyle}>
          {Array.from({ length: 2 }).map((_, row) =>
            Array.from({ length: 5 }).map((__, column) => (
              <Shape
                key={`${row}-${column}`}
                x={16 + column * 41}
                y={4 + row * 40}
                width={35}
                height={34}
                className="rounded-[8px] bg-light-grey"
              >
                <Bone x={8} y={14} width={19} />
              </Shape>
            ))
          )}
        </Shape>
      </MiniSurface>
      <MiniSurface
        x={panel.x}
        y={panel.y}
        width={panel.width}
        height={16 + 3 * panel.rowHeight}
        style={panelStyle}
      >
        <Shape
          x={0}
          y={0}
          width={panel.width}
          height={16 + 3 * panel.rowHeight}
          className="rounded-[16px] border-[1px] border-separator"
        />
        <Shape
          x={6}
          y={8 + 2 * panel.rowHeight}
          width={panel.width - 12}
          height={panel.rowHeight}
          className="rounded-[8px] bg-light-primary"
          style={rowStyle}
        />
        {(['list', 'hash', 'grid'] as const).map((icon, index) => (
          <Shape
            key={icon}
            x={12}
            y={8 + index * panel.rowHeight}
            width={panel.width - 24}
            height={panel.rowHeight}
          >
            <Shape x={0} y={4} width={14} height={14} className="items-center justify-center">
              <FeatherIcon name={icon} size={12} color="grey" />
            </Shape>
            <Bone x={22} y={8} width={44} />
            <Bone x={78} y={8} width={30} className="bg-grey opacity-40" />
          </Shape>
        ))}
      </MiniSurface>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.08, 0.14, 0.18, 0.3, 0.38, 0.4, 0.45, 0.52, 1],
          x: [
            button.x + 6,
            button.x + 13,
            button.x + 13,
            button.x + 13,
            displayRow.x,
            displayRow.x,
            displayRow.x,
            displayRow.x,
            displayRow.x,
            displayRow.x,
          ],
          y: [
            button.y + 50,
            button.y + 13,
            button.y + 13,
            button.y + 13,
            displayRow.y,
            displayRow.y,
            displayRow.y,
            displayRow.y,
            displayRow.y,
            displayRow.y,
          ],
          down: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}

/** Three lines of a verse, each word a bar: widths in points, by line. */
const LINES = [
  [34, 22, 46, 28, 40, 30],
  [26, 44, 50, 24, 36],
  [40, 30, 22, 48, 34, 20],
]
const LINE_X = 28
const LINE_Y = 36
const LINE_GAP = 30
const WORD_GAP = 8
const WORD_HEIGHT = 9

const wordFrame = (line: number, word: number) => ({
  x: LINE_X + LINES[line].slice(0, word).reduce((sum, width) => sum + width + WORD_GAP, 0),
  y: LINE_Y + line * LINE_GAP,
  width: LINES[line][word],
})

function VerseLines({ skip }: { skip?: { line: number; word: number } }) {
  return LINES.map((words, line) =>
    words.map((_, word) => {
      if (skip && skip.line === line && skip.word === word) return null
      const frame = wordFrame(line, word)
      return (
        <Bone
          key={`${line}-${word}`}
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={WORD_HEIGHT}
          className="bg-grey opacity-40"
        />
      )
    })
  )
}

const doubleTap = (x: number, y: number) => ({
  times: [0, 0.12, 0.2, 0.24, 0.29, 0.33, 0.42, 0.55, 1],
  x: [x + 40, x, x, x, x, x, x, x, x],
  y: [y + 46, y, y, y, y, y, y, y, y],
  down: [0, 0, 1, 0, 1, 0, 0, 0, 0],
  shown: [0, 1, 1, 1, 1, 1, 1, 0, 0],
})

/** Two taps on a word select it, with its handles: the way into the annotation mode. */
export function WordDoubleTapDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2600)
  const target = { line: 1, word: 2 }
  const frame = wordFrame(target.line, target.word)

  const selectionStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.33, 0.42], [0, 1]),
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <VerseLines skip={target} />
      <Shape
        x={frame.x - 3}
        y={frame.y - 5}
        width={frame.width + 6}
        height={WORD_HEIGHT + 10}
        className="rounded-[4px] bg-light-primary"
        style={selectionStyle}
      />
      <Bone
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={WORD_HEIGHT}
        className="bg-grey opacity-40"
      />
      {[frame.x - 4, frame.x + frame.width + 2].map((handleX, index) => (
        <Shape
          key={index}
          x={handleX}
          y={frame.y - 8}
          width={3}
          height={WORD_HEIGHT + 16}
          style={selectionStyle}
        >
          <Shape
            x={0}
            y={index === 0 ? 0 : WORD_HEIGHT + 10}
            width={3}
            height={6}
            className="rounded-full bg-primary"
          />
          <Shape x={1} y={0} width={1.5} height={WORD_HEIGHT + 16} className="bg-primary" />
        </Shape>
      ))}
      <Finger progress={progress} keys={doubleTap(frame.x + frame.width / 2, frame.y + 5)} />
    </DemoStage>
  )
}

/** Two taps on an annotation take it up again: its colours and actions come back. */
export function AnnotationDoubleTapDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2600)
  const target = { line: 1, word: 1 }
  const frame = wordFrame(target.line, target.word)
  const span = { x: frame.x - 3, width: frame.width + LINES[1][2] + WORD_GAP + 6 }

  const outlineStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.33, 0.42], [0, 1]),
  }))
  const toolbarStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.4, 0.52], [0, 1])
    return { opacity: shown, transform: [{ translateY: (1 - shown) * 6 }] }
  })

  return (
    <DemoStage onReplay={replay} label={label}>
      <Shape
        x={span.x}
        y={frame.y - 5}
        width={span.width}
        height={WORD_HEIGHT + 10}
        className="rounded-[4px] bg-color3"
      />
      <VerseLines />
      <Shape
        x={span.x - 2}
        y={frame.y - 7}
        width={span.width + 4}
        height={WORD_HEIGHT + 14}
        className="rounded-[8px] border-[1.5px] border-primary"
        style={outlineStyle}
      />
      <MiniSurface x={span.x - 30} y={frame.y - 56} width={150} height={36} style={toolbarStyle}>
        {['bg-color1', 'bg-color2', 'bg-color3', 'bg-color4'].map((color, index) => (
          <Shape
            key={color}
            x={12 + index * 26}
            y={9}
            width={18}
            height={18}
            className={`rounded-full ${color}`}
          />
        ))}
        <Shape x={120} y={9} width={18} height={18} className="items-center justify-center">
          <FeatherIcon name="trash-2" size={14} color="grey" />
        </Shape>
      </MiniSurface>
      <Finger progress={progress} keys={doubleTap(span.x + span.width / 2, frame.y + 5)} />
    </DemoStage>
  )
}
