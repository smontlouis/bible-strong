import { useAnimatedStyle } from 'react-native-reanimated'
import { FeatherIcon, IonIcon, MaterialIcon } from '~common/ui/Icon'
import { at, Bone, DemoStage, Finger, MiniSurface, Shape, useDemoProgress } from './demoKit'

/** The + of the study's toolbar inserts a passage, here as a block. */
export function StudyInsertDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(3400)
  const plus = { x: 234, y: 124 }
  const blockRow = { x: 108, y: 102 }

  const menuStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.22, 0.3, 0.52, 0.58], [0, 1, 1, 0])
    return { opacity: shown, transform: [{ translateY: (1 - shown) * 6 }] }
  })
  const blockRowStyle = useAnimatedStyle(() => ({
    opacity: at(progress.get(), [0.44, 0.48, 0.52], [0, 1, 0]),
  }))
  const blockStyle = useAnimatedStyle(() => {
    const shown = at(progress.get(), [0.58, 0.7], [0, 1])
    return { opacity: shown, transform: [{ scale: 0.92 + shown * 0.08 }] }
  })

  return (
    <DemoStage onReplay={replay} label={label}>
      <MiniSurface x={24} y={4} width={232} height={142}>
        <Bone x={16} y={16} width={180} />
        <Bone x={16} y={28} width={150} />
        <Shape
          x={16}
          y={42}
          width={200}
          height={40}
          className="rounded-[8px] bg-light-grey"
          style={blockStyle}
        >
          <Shape x={0} y={0} width={3} height={40} className="bg-primary" />
          <Bone x={12} y={9} width={60} className="bg-primary opacity-60" />
          <Bone x={12} y={22} width={160} />
        </Shape>
        <Bone x={16} y={92} width={120} />
        <Shape x={0} y={110} width={232} height={1} className="bg-border" />
        {(['format-bold', 'format-italic', 'format-list-bulleted'] as const).map((icon, index) => (
          <Shape
            key={icon}
            x={16 + index * 30}
            y={116}
            width={20}
            height={20}
            className="items-center justify-center"
          >
            <MaterialIcon name={icon} size={16} color="grey" />
          </Shape>
        ))}
        <Shape x={200} y={116} width={20} height={20} className="items-center justify-center">
          <MaterialIcon name="add-box" size={20} color="primary" />
        </Shape>
      </MiniSurface>
      <MiniSurface x={104} y={62} width={140} height={58} style={menuStyle}>
        <Shape
          x={0}
          y={0}
          width={140}
          height={58}
          className="border-[1px] border-separator rounded-[16px]"
        />
        {(['link-2', 'file-text'] as const).map((icon, index) => (
          <Shape key={icon} x={12} y={8 + index * 22} width={120} height={20}>
            <FeatherIcon name={icon} size={13} color="grey" />
            <Bone x={22} y={6} width={index === 0 ? 70 : 60} />
          </Shape>
        ))}
        <Shape
          x={6}
          y={28}
          width={128}
          height={22}
          className="rounded-[8px] bg-light-primary"
          style={blockRowStyle}
        />
      </MiniSurface>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.1, 0.17, 0.22, 0.34, 0.44, 0.49, 0.58, 0.68, 1],
          x: [
            plus.x - 30,
            plus.x,
            plus.x,
            plus.x,
            blockRow.x + 50,
            blockRow.x + 50,
            blockRow.x + 50,
            blockRow.x + 50,
            blockRow.x + 50,
            blockRow.x + 50,
          ],
          y: [
            plus.y + 20,
            plus.y + 6,
            plus.y + 6,
            plus.y + 6,
            blockRow.y,
            blockRow.y,
            blockRow.y,
            blockRow.y,
            blockRow.y,
            blockRow.y,
          ],
          down: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}

/** Swiping the small player up opens the large one. */
export function AudioSwipeUpDemo({ label }: { label: string }) {
  const { progress, replay } = useDemoProgress(2600)
  const bar = { x: 24, y: 96, width: 232, height: 40 }

  const barStyle = useAnimatedStyle(() => ({ opacity: at(progress.get(), [0.3, 0.5], [1, 0]) }))
  const playerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: at(progress.get(), [0.25, 0.6], [150, 0]) }],
  }))

  return (
    <DemoStage onReplay={replay} label={label}>
      <Bone x={40} y={20} width={180} className="bg-grey opacity-30" />
      <Bone x={40} y={34} width={150} className="bg-grey opacity-30" />
      <Bone x={40} y={48} width={170} className="bg-grey opacity-30" />
      <MiniSurface x={bar.x} y={bar.y} width={bar.width} height={bar.height} style={barStyle}>
        <Shape x={8} y={6} width={28} height={28} className="rounded-[8px] bg-color4" />
        <Bone x={46} y={11} width={90} className="bg-grey opacity-60" />
        <Bone x={46} y={23} width={60} />
        <Shape x={196} y={10} width={20} height={20} className="items-center justify-center">
          <IonIcon name="pause" size={16} color="default" />
        </Shape>
      </MiniSurface>
      <MiniSurface x={24} y={4} width={232} height={150} style={playerStyle}>
        <Shape x={86} y={14} width={60} height={60} className="rounded-[12px] bg-color4" />
        <Bone x={66} y={84} width={100} className="bg-grey opacity-60" />
        <Bone x={86} y={96} width={60} />
        <Shape x={24} y={112} width={184} height={3} className="rounded-full bg-border" />
        <Shape x={24} y={112} width={70} height={3} className="rounded-full bg-color4" />
        <Shape x={104} y={122} width={24} height={20} className="items-center justify-center">
          <IonIcon name="pause" size={18} color="default" />
        </Shape>
      </MiniSurface>
      <Finger
        progress={progress}
        keys={{
          times: [0, 0.12, 0.25, 0.6, 0.68, 0.8, 1],
          x: [150, 150, 150, 150, 150, 150, 150],
          y: [130, 116, 116, 40, 40, 40, 40],
          down: [0, 0, 1, 1, 0, 0, 0],
          shown: [0, 1, 1, 1, 1, 0, 0],
        }}
      />
    </DemoStage>
  )
}
