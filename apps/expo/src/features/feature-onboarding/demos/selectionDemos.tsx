import { useAnimatedStyle } from 'react-native-reanimated'
import { at, Bone, DemoStage, Finger, MiniSurface, Shape, useDemoProgress } from './demoKit'

const HIGHLIGHTS = ['bg-color1', 'bg-color2', 'bg-color3', 'bg-color4', 'bg-color5']

/**
 * The selection sheet as it stands: the colours on top, the actions of a tab in the middle, the
 * three tabs below. The reader drags along the tabs, from Annotate to Study, and the actions follow.
 */
export function SelectionTabsSwipeDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2600)
  const trackWidth = 208
  const tabWidth = (trackWidth - 6) / 3
  const track = { x: 12, y: 102 }
  const fingerY = 6 + track.y + 13
  const fromX = 24 + track.x + 3 + tabWidth / 2

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at(progress.get(), [0.25, 0.6], [0, tabWidth]) }],
  }))
  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at(progress.get(), [0.25, 0.6], [0, -trackWidth]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={6} width={232} height={138}>
        {HIGHLIGHTS.map((color, index) => (
          <Shape
            key={color}
            x={18 + index * 30}
            y={12}
            width={18}
            height={18}
            className={`rounded-full ${color}`}
          />
        ))}
        <Shape
          x={194}
          y={12}
          width={18}
          height={18}
          className="rounded-full border-[1.5px] border-border"
        />
        <Shape x={track.x} y={40} width={trackWidth} height={54}>
          <Shape x={0} y={0} width={trackWidth * 3} height={54} style={pagesStyle}>
            {[0, 1, 2].map(page =>
              [0, 1, 2, 3].map(index => (
                <Shape
                  key={`${page}-${index}`}
                  x={page * trackWidth + 8 + index * 50}
                  y={2}
                  width={42}
                  height={50}
                >
                  <Shape
                    x={7}
                    y={0}
                    width={28}
                    height={28}
                    className={
                      page === 1 ? 'rounded-full bg-light-primary' : 'rounded-full bg-opacity5'
                    }
                  />
                  <Bone x={5} y={36} width={32} />
                </Shape>
              ))
            )}
          </Shape>
        </Shape>
        <Shape
          x={track.x}
          y={track.y}
          width={trackWidth}
          height={26}
          className="rounded-full bg-opacity5"
        >
          <Shape
            x={3}
            y={3}
            width={tabWidth}
            height={20}
            className="rounded-full bg-surface-raised"
            style={indicatorStyle}
          />
          {[0, 1, 2].map(index => (
            <Bone key={index} x={3 + index * tabWidth + tabWidth / 2 - 16} y={10} width={32} />
          ))}
        </Shape>
      </MiniSurface>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.15, 0.25, 0.6, 0.7, 0.85, 1],
          x: [
            fromX,
            fromX,
            fromX,
            fromX + tabWidth,
            fromX + tabWidth,
            fromX + tabWidth,
            fromX + tabWidth,
          ],
          y: [fingerY, fingerY, fingerY, fingerY, fingerY, fingerY, fingerY],
          down: [0, 0, 1, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}

/** A long press on a colour opens its editor: its hue, its name, its style. */
export function ColorLongPressDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2800)
  const size = 30
  const gap = 14
  const rowX = (280 - (size * 5 + gap * 4)) / 2
  const pressedX = rowX + 2 * (size + gap)

  const pressedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: at(progress.get(), [0.2, 0.3, 0.55, 0.62], [1, 0.88, 0.88, 1]) }],
  }))
  const editorStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.55, 0.68], [0, 1])
    return { opacity: shown, transform: [{ translateY: (1 - shown) * 10 }] }
  })

  return (
    <DemoStage onReplay={replay} label={label}>
      {HIGHLIGHTS.map((color, index) => (
        <Shape
          key={color}
          x={rowX + index * (size + gap)}
          y={14}
          width={size}
          height={size}
          className={`rounded-full ${color}`}
          style={index === 2 ? pressedStyle : undefined}
        />
      ))}
      <MiniSurface x={50} y={60} width={180} height={84} style={editorStyle}>
        <Shape x={14} y={14} width={28} height={28} className="rounded-full bg-color3" />
        <Bone x={52} y={20} width={90} />
        <Bone x={52} y={32} width={56} />
        {[0, 1, 2].map(index => (
          <Shape
            key={index}
            x={14 + index * 52}
            y={54}
            width={46}
            height={18}
            className={index === 0 ? 'rounded-full bg-light-primary' : 'rounded-full bg-light-grey'}
          />
        ))}
      </MiniSurface>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.1, 0.2, 0.55, 0.62, 0.72, 1],
          x: [
            pressedX + 40,
            pressedX + size / 2,
            pressedX + size / 2,
            pressedX + size / 2,
            pressedX + size / 2,
            pressedX + size / 2,
            pressedX + size / 2,
          ],
          y: [50, 29, 29, 29, 29, 29, 29],
          down: [0, 0, 1, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 0, 0],
          hold: [0, 0, 0, 1, 1, 1, 1],
        }}
      />
    </DemoStage>
  )
}
