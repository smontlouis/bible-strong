import { Platform } from 'react-native'
import { useAnimatedStyle } from 'react-native-reanimated'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { at, Bone, DemoStage, Finger, MiniSurface, Shape, useDemoProgress } from './demoKit'

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif'

const LINE_WIDTHS = [86, 78, 90, 70, 84, 60]
const OTHER_LINE_WIDTHS = [72, 88, 64, 90, 76, 82]

/** A column of the parallel reading: its version chip on top, its text below. */
function ColumnText({ x, widths }: { x: number; widths: number[] }) {
  return (
    <>
      {widths.map((width, index) => (
        <Bone key={index} x={x} y={40 + index * 13} width={width} />
      ))}
    </>
  )
}

/**
 * A version chip as the reader draws it: one pill split in two, the version's name with its chevron,
 * then the S of its display.
 */
function VersionChip({ x, nameWidth, style }: { x: number; nameWidth: number; style?: object }) {
  const nameSegment = nameWidth + 28
  return (
    <Shape x={x} y={10} width={nameSegment + 20} height={18}>
      <Shape x={0} y={0} width={nameSegment} height={18} className="rounded-l-full bg-light-grey">
        <Shape x={0} y={0} width={nameSegment} height={18} style={style}>
          <Bone x={9} y={6} width={nameWidth} className="bg-grey opacity-60" />
        </Shape>
        <Shape
          x={nameWidth + 13}
          y={4}
          width={10}
          height={10}
          className="items-center justify-center"
        >
          <FeatherIcon name="chevron-down" size={9} color="grey" />
        </Shape>
      </Shape>
      <Shape
        x={nameSegment + 2}
        y={0}
        width={18}
        height={18}
        className="rounded-r-full bg-light-grey items-center justify-center"
      >
        <Text className="text-[10px] font-bold text-tertiary" style={{ fontFamily: SERIF }}>
          S
        </Text>
      </Shape>
    </Shape>
  )
}

/**
 * Each column of the parallel reading has its version: a tap on its name opens the versions, and
 * the column reads in the one chosen.
 */
export function ParallelColumnVersionDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(3200)
  const chip = { x: 24 + 120 + 22, y: 4 + 19 }
  const row = { x: 150, y: 112 }

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: at(progress.get(), [0.26, 0.36, 0.66, 0.74], [100, 0, 0, 100]) }],
  }))
  const chosenRowStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.56, 0.6, 0.66, 0.7], [0, 1, 1, 0]),
  }))
  const beforeStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.7, 0.78], [1, 0]),
  }))
  const afterStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.7, 0.78], [0, 1]),
  }))
  const chipStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.16, 0.2, 0.26, 0.3], [1, 0.5, 0.5, 1]),
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={4} width={232} height={142}>
        <VersionChip x={8} nameWidth={26} />
        <ColumnText x={10} widths={LINE_WIDTHS.map(width => width + 10)} />
        <Shape x={116} y={8} width={1} height={130} className="bg-border" />
        <Shape x={0} y={0} width={232} height={142} style={beforeStyle}>
          <VersionChip x={124} nameWidth={30} style={chipStyle} />
          <ColumnText x={126} widths={LINE_WIDTHS} />
        </Shape>
        <Shape x={0} y={0} width={232} height={142} style={afterStyle}>
          <VersionChip x={124} nameWidth={20} />
          <ColumnText x={126} widths={OTHER_LINE_WIDTHS} />
        </Shape>
      </MiniSurface>
      <Shape
        x={44}
        y={64}
        width={192}
        height={86}
        className="rounded-t-[16px] border-[1px] border-separator bg-reverse"
        style={sheetStyle}
      >
        <Bone x={84} y={7} width={24} height={4} className="bg-grey opacity-40" />
        {[0, 1, 2].map(index => (
          <Shape key={index} x={12} y={18 + index * 22} width={168} height={18}>
            {index === 1 && (
              <Shape
                x={0}
                y={0}
                width={168}
                height={18}
                className="rounded-[8px] bg-light-primary"
                style={chosenRowStyle}
              />
            )}
            <Bone x={10} y={6} width={index === 1 ? 20 : 34} className="bg-grey opacity-60" />
            <Bone x={54} y={6} width={index === 0 ? 90 : 70} />
          </Shape>
        ))}
      </Shape>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.1, 0.18, 0.24, 0.3, 0.44, 0.54, 0.6, 0.66, 0.74, 1],
          x: [
            chip.x + 30,
            chip.x,
            chip.x,
            chip.x,
            chip.x,
            row.x,
            row.x,
            row.x,
            row.x,
            row.x,
            row.x,
          ],
          y: [
            chip.y + 30,
            chip.y,
            chip.y,
            chip.y,
            chip.y,
            row.y,
            row.y,
            row.y,
            row.y,
            row.y,
            row.y,
          ],
          down: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}

/** The columns of a layout, filling the reader under the header. */
function Columns({ count }: { count: number }) {
  const width = (232 - 16) / count
  return (
    <>
      {Array.from({ length: count }).map((_, column) => (
        <Shape key={column} x={8 + column * width} y={36} width={width} height={100}>
          {column > 0 && <Shape x={0} y={0} width={1} height={100} className="bg-border" />}
          {[0, 1, 2, 3, 4].map(index => (
            <Bone
              key={index}
              x={6}
              y={6 + index * 13}
              width={width - (index % 2 === 0 ? 14 : 24)}
            />
          ))}
        </Shape>
      ))}
    </>
  )
}

const MENU = { x: 104, y: 30, width: 140, rowHeight: 15 }
// The rows of the real menu: the main version, remove a version, add one, the layout, the width of
// the columns, leave. The first is shown disabled, removing and leaving in red.
const MENU_ROWS = [
  { width: 60, tone: 'disabled' },
  { width: 50, tone: 'destructive' },
  { width: 78, tone: 'default' },
  { width: 70, tone: 'default' },
  { width: 56, tone: 'default' },
  { width: 74, tone: 'destructive' },
] as const
const ADD_ROW = 2

/**
 * The parallel button of the header counts the versions; its menu adds one, changes the layout or
 * leaves the parallel reading. Here it adds a third column.
 */
export function ParallelMenuDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(3000)
  const button = { x: 24 + 206, y: 4 + 20 }
  const addRow = { x: MENU.x + 60, y: MENU.y + 8 + ADD_ROW * MENU.rowHeight + MENU.rowHeight / 2 }

  const menuStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.26, 0.34, 0.64, 0.7], [0, 1, 1, 0])
    return { opacity: shown, transform: [{ scale: 0.92 + 0.08 * shown }] }
  })
  const chosenRowStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.54, 0.58, 0.62, 0.66], [0, 1, 1, 0]),
  }))
  const twoStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.7, 0.8], [1, 0]) }))
  const threeStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.7, 0.8], [0, 1]) }))
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: at(progress.get(), [0.16, 0.2, 0.24], [1, 0.86, 1]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={4} width={232} height={142}>
        <Shape x={10} y={9} width={92} height={20} className="rounded-full bg-light-grey">
          <Bone x={10} y={7} width={64} className="bg-grey opacity-60" />
        </Shape>
        <Shape x={196} y={8} width={22} height={22} style={buttonStyle}>
          <Shape
            x={1}
            y={3}
            width={9}
            height={14}
            className="rounded-[4px] border-[1.5px] border-primary"
          />
          <Shape
            x={11}
            y={3}
            width={9}
            height={14}
            className="rounded-[4px] border-[1.5px] border-primary"
          />
          <Shape
            x={12}
            y={12}
            width={10}
            height={10}
            className="rounded-full bg-grey items-center justify-center"
          >
            <Shape
              x={0}
              y={0}
              width={10}
              height={10}
              className="items-center justify-center"
              style={twoStyle}
            >
              <Text className="text-[7px] font-bold text-reverse">2</Text>
            </Shape>
            <Shape
              x={0}
              y={0}
              width={10}
              height={10}
              className="items-center justify-center"
              style={threeStyle}
            >
              <Text className="text-[7px] font-bold text-reverse">3</Text>
            </Shape>
          </Shape>
        </Shape>
        <Shape x={0} y={0} width={232} height={142} style={twoStyle}>
          <Columns count={2} />
        </Shape>
        <Shape x={0} y={0} width={232} height={142} style={threeStyle}>
          <Columns count={3} />
        </Shape>
      </MiniSurface>
      <Shape
        x={MENU.x}
        y={MENU.y}
        width={MENU.width}
        height={8 * 2 + MENU.rowHeight * MENU_ROWS.length}
        className="rounded-[12px] border-[1px] border-separator bg-reverse"
        style={menuStyle}
      >
        {MENU_ROWS.map((row, index) => (
          <Shape
            key={index}
            x={6}
            y={8 + index * MENU.rowHeight}
            width={MENU.width - 12}
            height={MENU.rowHeight}
            className={row.tone === 'disabled' ? 'opacity-50' : undefined}
          >
            {index === ADD_ROW && (
              <Shape
                x={0}
                y={0}
                width={MENU.width - 12}
                height={MENU.rowHeight}
                className="rounded-[8px] bg-light-primary"
                style={chosenRowStyle}
              />
            )}
            <Shape
              x={8}
              y={3}
              width={9}
              height={9}
              className={
                row.tone === 'destructive'
                  ? 'rounded-full bg-quart opacity-60'
                  : 'rounded-full bg-border'
              }
            />
            <Bone
              x={24}
              y={5}
              width={row.width}
              className={row.tone === 'destructive' ? 'bg-quart opacity-50' : undefined}
            />
          </Shape>
        ))}
      </Shape>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.1, 0.16, 0.22, 0.3, 0.44, 0.52, 0.58, 0.64, 0.72, 1],
          x: [
            button.x - 30,
            button.x,
            button.x,
            button.x,
            button.x,
            addRow.x,
            addRow.x,
            addRow.x,
            addRow.x,
            addRow.x,
            addRow.x,
          ],
          y: [
            button.y + 40,
            button.y,
            button.y,
            button.y,
            button.y,
            addRow.y,
            addRow.y,
            addRow.y,
            addRow.y,
            addRow.y,
            addRow.y,
          ],
          down: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}

/** The words of three lines, each followed by its Strong number. */
const WORDS = [
  [30, 22, 36],
  [26, 38, 24],
  [34, 28],
]
const NUMBER_WIDTH = 26
const WORD_GAP = 6

const wordX = (line: number, word: number) =>
  10 +
  WORDS[line]
    .slice(0, word)
    .reduce((total, width) => total + width + NUMBER_WIDTH + WORD_GAP * 2, 0)

/**
 * In the Strong display each word carries its number; a tap on it opens the Strong entry: the
 * original word, its number and its definition.
 */
export function StrongWordTapDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2800)
  const tapped = { line: 0, word: 1 }
  const number = {
    x: wordX(tapped.line, tapped.word) + WORDS[tapped.line][tapped.word] + WORD_GAP,
    y: 12 + tapped.line * 24,
  }
  const finger = { x: 24 + number.x + NUMBER_WIDTH / 2, y: 4 + number.y + 6 }

  const selectedStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.18, 0.24], [0, 1]),
  }))
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: at(progress.get(), [0.3, 0.44], [96, 0]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={4} width={232} height={142}>
        {WORDS.map((widths, line) =>
          widths.map((width, index) => (
            <Shape
              key={`${line}-${index}`}
              x={wordX(line, index)}
              y={12 + line * 24}
              width={width + WORD_GAP + NUMBER_WIDTH}
              height={12}
            >
              <Bone x={0} y={3} width={width} />
              <Shape
                x={width + WORD_GAP}
                y={0}
                width={NUMBER_WIDTH}
                height={12}
                className="rounded-[4px] bg-light-primary"
              >
                <Bone x={5} y={4} width={16} height={4} className="bg-primary opacity-70" />
              </Shape>
            </Shape>
          ))
        )}
        <Shape
          x={number.x}
          y={number.y}
          width={NUMBER_WIDTH}
          height={12}
          className="rounded-[4px] bg-primary"
          style={selectedStyle}
        >
          <Bone x={5} y={4} width={16} height={4} className="bg-reverse" />
        </Shape>
      </MiniSurface>
      <Shape
        x={24}
        y={54}
        width={232}
        height={96}
        className="rounded-t-[16px] border-[1px] border-separator bg-reverse"
        style={sheetStyle}
      >
        <Bone x={104} y={7} width={24} height={4} className="bg-grey opacity-40" />
        <Shape x={16} y={16} width={90} height={28} className="justify-center">
          <Text className="text-[20px] font-bold">λόγος</Text>
        </Shape>
        <Shape x={112} y={24} width={40} height={14} className="rounded-full bg-light-primary">
          <Bone x={8} y={4} width={24} className="bg-primary opacity-60" />
        </Shape>
        <Bone x={16} y={52} width={190} />
        <Bone x={16} y={64} width={168} />
        <Bone x={16} y={76} width={120} />
      </Shape>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.08, 0.16, 0.22, 0.3, 0.38, 1],
          x: [finger.x + 30, finger.x, finger.x, finger.x, finger.x, finger.x, finger.x],
          y: [finger.y + 50, finger.y, finger.y, finger.y, finger.y, finger.y, finger.y],
          down: [0, 0, 1, 0, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}
