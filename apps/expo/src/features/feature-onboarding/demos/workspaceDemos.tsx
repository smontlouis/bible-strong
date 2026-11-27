import { useAnimatedStyle } from 'react-native-reanimated'
import { FeatherIcon } from '~common/ui/Icon'
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

/** The tabs of a group, as the tab view shows them: tall cards, a title and a close button. */
function GroupCards({ x, accent }: { x: number; accent: string }) {
  return (
    <Shape x={x} y={0} width={208} height={104}>
      {[0, 1].map(index => (
        <Shape
          key={index}
          x={8 + index * 100}
          y={0}
          width={92}
          height={104}
          className="rounded-[8px] bg-reverse"
        >
          <Shape x={8} y={9} width={8} height={8} className={`rounded-full ${accent}`} />
          <Bone x={22} y={10} width={44} />
          <Shape x={76} y={8} width={10} height={10} className="items-center justify-center">
            <FeatherIcon name="x" size={9} color="grey" />
          </Shape>
          <Shape x={34} y={46} width={24} height={20} className="rounded-[4px] bg-light-grey" />
        </Shape>
      ))}
    </Shape>
  )
}

/** The tab view groups the tabs: swiping goes from one group to the next, named at the bottom. */
export function TabGroupsSwipeDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2800)

  const groupsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at(progress.get(), [0.25, 0.6], [0, -208]) }],
  }))
  const firstStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.4, 0.5], [1, 0]) }))
  const secondStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.4, 0.5], [0, 1]) }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <Shape x={36} y={6} width={208} height={104}>
        <Shape x={0} y={0} width={416} height={104} style={groupsStyle}>
          {GROUP_ACCENTS.map((accent, index) => (
            <GroupCards key={accent} x={index * 208} accent={accent} />
          ))}
        </Shape>
      </Shape>
      <Shape x={44} y={122} width={14} height={14} className="items-center justify-center">
        <FeatherIcon name="plus" size={14} color="default" />
      </Shape>
      <Shape x={102} y={120} width={76} height={18} className="rounded-full bg-reverse">
        {GROUP_ACCENTS.map((accent, index) => (
          <Shape
            key={accent}
            x={0}
            y={0}
            width={76}
            height={18}
            style={index === 0 ? firstStyle : secondStyle}
          >
            <Shape x={10} y={5} width={8} height={8} className={`rounded-full ${accent}`} />
            <Bone x={24} y={6} width={30} />
          </Shape>
        ))}
        <Shape x={60} y={4} width={10} height={10} className="items-center justify-center">
          <FeatherIcon name="chevron-down" size={10} color="grey" />
        </Shape>
      </Shape>
      <Bone x={214} y={126} width={20} height={7} className="bg-grey opacity-60" />
      <Finger progress={progress} keys={swipeLeft(200, 90, 60)} />
    </DemoStage>
  )
}
