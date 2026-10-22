import { StyleSheet } from 'react-native'
import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { useAtomValue } from 'jotai/react'
import { isFullScreenBibleAtom } from '~state/app'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import {
  BIBLE_FORM_SHEET_HEADER_HEIGHT,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MIN,
} from '~features/app-switcher/utils/constants'
import { PASSAGE_CONTEXT_HEADER_HEIGHT } from './passagePreviewPresentation'

/** The bar under the Bible header; it slides away with the header in full screen. */
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
      className="absolute left-0 right-0 border-separator bg-reverse"
      pointerEvents={collapsed ? 'none' : 'auto'}
      accessibilityElementsHidden={collapsed}
      importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      style={{
        top: isFormSheet ? BIBLE_FORM_SHEET_HEADER_HEIGHT : HEADER_HEIGHT + insets.top,
        borderBottomWidth: StyleSheet.hairlineWidth,
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
      {children}
    </AnimatedBox>
  )
}

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
    className="w-[36px] h-[44px] items-center justify-center"
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
        className="flex-1 mx-[56px] items-center justify-center"
        accessibilityRole="button"
        accessibilityState={{ expanded: !focused }}
        onPress={focused ? onExpand : onCollapse}
      >
        <Text className="text-primary font-bold text-[14px] text-center">
          {t(focused ? 'tab.readWholeChapter' : 'tab.closeContext')}
        </Text>
      </TouchableBox>
      <Box className="absolute right-[12px] top-0 bottom-0 justify-center">
        <SubheaderIconButton
          name="x"
          accessibilityLabel={t('accessibility.clearFocus')}
          onPress={onExit}
        />
      </Box>
    </PassageSubheader>
  )
}

/**
 * Plan mode names its passage here and carries the way out. A passage of verses also gets
 * the switch between those verses and the whole chapter, as an icon to keep the line short.
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
      <Box
        className="flex-1 items-center justify-center"
        style={{ marginHorizontal: hasContextToggle ? 88 : 56 }}
      >
        <Text className="text-primary font-bold text-[14px] text-center" numberOfLines={1}>
          {`${t('tab.plan')} — ${reference}`}
        </Text>
      </Box>
      <Box className="absolute right-[12px] top-0 bottom-0 flex-row items-center">
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
      </Box>
    </PassageSubheader>
  )
}
