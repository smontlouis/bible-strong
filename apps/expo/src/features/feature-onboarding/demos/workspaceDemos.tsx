import { useAnimatedStyle } from 'react-native-reanimated'
import { at, Bone, DemoStage, Finger, MiniSurface, Shape, useDemoProgress } from './demoKit'

const swipeLeft = (fromX: number, toX: number, y: number) => ({
  times: [0, 0.15, 0.25, 0.6, 0.7, 0.85, 1],
  x: [fromX, fromX, fromX, toX, toX, toX, toX],
  y: [y, y, y, y, y, y, y],
  down: [0, 0, 1, 1, 0, 0, 0],
  shown: [0, 1, 1, 1, 1, 0, 0],
})

/** A page of a tab in miniature: a title and a few lines, an image block for the second. */
function MiniPage({ x, accent }: { x: number; accent?: boolean }) {
  return (
    <Shape x={x} y={0} width={208} height={92}>
      {accent ? (
        <Shape x={14} y={12} width={180} height={30} className="rounded-[8px] bg-light-primary" />
      ) : (
        <Bone x={70} y={16} width={68} height={10} className="bg-grey opacity-50" />
      )}
      <Bone x={14} y={54} width={170} />
      <Bone x={14} y={66} width={150} />
      <Bone x={14} y={78} width={120} />
    </Shape>
  )
}

/** Swiping along the bottom bar goes to the next tab. */
export function TabBarSwipeDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2600)

  const pagesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at(progress.get(), [0.25, 0.6], [0, -232]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={4} width={232} height={142}>
        <Shape x={0} y={8} width={232} height={92}>
          <Shape x={0} y={0} width={464} height={92} style={pagesStyle}>
            <MiniPage x={12} />
            <MiniPage x={244} accent />
          </Shape>
        </Shape>
        <Shape x={0} y={106} width={232} height={1} className="bg-border" />
        {[0, 1, 2, 3, 4].map(index => (
          <Shape
            key={index}
            x={24 + index * 42}
            y={116}
            width={16}
            height={16}
            className={
              index === 3
                ? 'rounded-[4px] border-[1.5px] border-grey'
                : 'rounded-full bg-grey opacity-40'
            }
          />
        ))}
      </MiniSurface>
      <Finger progress={progress} keys={swipeLeft(196, 84, 128)} />
    </DemoStage>
  )
}

const GROUP_ACCENTS = ['bg-primary', 'bg-color2']

/** The tabs of a group, as the tab view shows them: four cards under the group's colour. */
function GroupCards({ x, accent }: { x: number; accent: string }) {
  return (
    <Shape x={x} y={0} width={208} height={98}>
      {[0, 1, 2, 3].map(index => (
        <Shape
          key={index}
          x={6 + (index % 2) * 102}
          y={(index > 1 ? 1 : 0) * 50}
          width={94}
          height={44}
          className="rounded-[8px] bg-reverse"
        >
          <Shape x={0} y={0} width={94} height={4} className={accent} />
          <Bone x={10} y={16} width={56} />
          <Bone x={10} y={28} width={40} />
        </Shape>
      ))}
    </Shape>
  )
}

/** The tab view groups the tabs: swiping goes from one group to the next. */
export function TabGroupsSwipeDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2800)

  const groupsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at(progress.get(), [0.25, 0.6], [0, -208]) }],
  }))
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at(progress.get(), [0.25, 0.6], [0, 62]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <Shape x={66} y={6} width={148} height={24} className="rounded-full bg-reverse">
        <Shape
          x={4}
          y={3}
          width={58}
          height={18}
          className="rounded-full bg-light-primary"
          style={indicatorStyle}
        />
        {GROUP_ACCENTS.map((accent, index) => (
          <Shape key={accent} x={14 + index * 62} y={8} width={46} height={8}>
            <Shape x={0} y={0} width={8} height={8} className={`rounded-full ${accent}`} />
            <Bone x={14} y={1} width={26} />
          </Shape>
        ))}
        <Bone x={130} y={9} width={8} />
      </Shape>
      <Shape x={36} y={44} width={208} height={98}>
        <Shape x={0} y={0} width={416} height={98} style={groupsStyle}>
          {GROUP_ACCENTS.map((accent, index) => (
            <GroupCards key={accent} x={index * 208} accent={accent} />
          ))}
        </Shape>
      </Shape>
      <Finger progress={progress} keys={swipeLeft(200, 90, 94)} />
    </DemoStage>
  )
}
