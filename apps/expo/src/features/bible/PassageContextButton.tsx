import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { useAtomValue } from 'jotai/react'
import { isFullScreenBibleAtom } from '~state/app'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { floatingShadow, radii } from '~common/ui/surfaces'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MIN,
} from '~features/app-switcher/utils/constants'
import { PASSAGE_CONTEXT_HEADER_HEIGHT, PASSAGE_PILL_HEIGHT } from './passagePreviewPresentation'

/**
 * The band under the Bible header where the passage's pill floats: it keeps no ground of its
 * own, so the text scrolls under the pill, and it slides away with the header in full screen.
 */
const PassageSubheader = ({
  isFormSheet,
  children,
}: {
  isFormSheet?: boolean
  children: ReactNode
}) => {
  const insets = useSafeAreaInsets()
  const isFullScreen = useAtomValue(isFullScreenBibleAtom)
  const collapsed = !isFormSheet && isFullScreen
  return (
    <AnimatedBox
      className="absolute left-0 right-0 items-center justify-center"
      pointerEvents={collapsed ? 'none' : 'box-none'}
      accessibilityElementsHidden={collapsed}
      importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      style={{
        top: isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT + insets.top,
        height: PASSAGE_CONTEXT_HEADER_HEIGHT,
        zIndex: 1,
        opacity: collapsed ? 0 : 1,
        transform: [
          {
            translateY: collapsed
              ? -(HEADER_HEIGHT - HEADER_HEIGHT_MIN + PASSAGE_CONTEXT_HEADER_HEIGHT)
              : 0,
          },
        ],
        transitionProperty: ['transform', 'opacity'],
        transitionDuration: 300,
      }}
    >
      <Box
        className="flex-row items-center bg-surface-raised pl-[16px] pr-[4px] max-w-[100%] mx-[16px]"
        style={{ height: PASSAGE_PILL_HEIGHT, borderRadius: radii.pill, ...floatingShadow }}
      >
        {children}
      </Box>
    </AnimatedBox>
  )
}

/** The hairline between the pill's words and its icons. */
const PillDivider = () => <Box className="w-[1px] h-[18px] bg-separator mx-[6px]" />

const SubheaderIconButton = ({
  name,
  accessibilityLabel,
  onPress,
}: {
  name: ComponentProps<typeof FeatherIcon>['name']
  accessibilityLabel: string
  onPress: () => void
}) => (
  <TouchableBox
    className="w-[36px] items-center justify-center"
    style={{ height: PASSAGE_PILL_HEIGHT }}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={onPress}
  >
    <Box className="w-[28px] h-[28px] bg-light-primary rounded-[12px] items-center justify-center">
      <FeatherIcon name={name} size={15} color="primary" />
    </Box>
  </TouchableBox>
)

export default function PassageContextButton({
  focused,
  isFormSheet,
  onExpand,
  onCollapse,
  onExit,
}: {
  focused: boolean
  isFormSheet?: boolean
  onExpand: () => void
  onCollapse: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  return (
    <PassageSubheader isFormSheet={isFormSheet}>
      <TouchableBox
        className="justify-center"
        style={{ height: PASSAGE_PILL_HEIGHT }}
        accessibilityRole="button"
        accessibilityState={{ expanded: !focused }}
        onPress={focused ? onExpand : onCollapse}
      >
        <Text className="text-link font-semibold text-[13px]" numberOfLines={1}>
          {t(focused ? 'tab.readWholeChapter' : 'tab.closeContext')}
        </Text>
      </TouchableBox>
      <PillDivider />
      <SubheaderIconButton
        name="x"
        accessibilityLabel={t('accessibility.clearFocus')}
        onPress={onExit}
      />
    </PassageSubheader>
  )
}

/**
 * Plan mode names its passage in the pill and carries the way out. A passage of verses also
 * gets the switch between those verses and the whole chapter, as an icon to keep the pill short.
 */
export function PlanPassageBanner({
  reference,
  focused,
  isFormSheet,
  onExpand,
  onCollapse,
  onExit,
}: {
  reference: string
  /** Undefined when the passage is whole chapters, which have nothing to expand. */
  focused?: boolean
  isFormSheet?: boolean
  onExpand: () => void
  onCollapse: () => void
  onExit: () => void
}) {
  const { t } = useTranslation()
  const hasContextToggle = focused !== undefined
  return (
    <PassageSubheader isFormSheet={isFormSheet}>
      <Box className="shrink justify-center" style={{ height: PASSAGE_PILL_HEIGHT }}>
        <Text className="text-link font-semibold text-[13px]" numberOfLines={1}>
          {`${t('tab.plan')} — ${reference}`}
        </Text>
      </Box>
      <PillDivider />
      {hasContextToggle && (
        <SubheaderIconButton
          name={focused ? 'maximize-2' : 'minimize-2'}
          accessibilityLabel={t(focused ? 'tab.readWholeChapter' : 'tab.closeContext')}
          onPress={focused ? onExpand : onCollapse}
        />
      )}
      <SubheaderIconButton
        name="x"
        accessibilityLabel={t('accessibility.exitPlanMode')}
        onPress={onExit}
      />
    </PassageSubheader>
  )
}
