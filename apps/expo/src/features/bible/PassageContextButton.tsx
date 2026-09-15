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
  const insets = useSafeAreaInsets()
  const isFullScreen = useAtomValue(isFullScreenBibleAtom)
  const collapsed = !isFormSheet && isFullScreen
  return (
    <AnimatedBox
      className="absolute left-0 right-0 border-b-[1px] border-border bg-reverse"
      pointerEvents={collapsed ? 'none' : 'auto'}
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
      <TouchableBox
        className="absolute right-[12px] top-0 bottom-0 w-[40px] items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.clearFocus')}
        onPress={onExit}
      >
        <Box className="w-[28px] h-[28px] bg-light-primary rounded-[12px] items-center justify-center">
          <FeatherIcon name="x" size={15} color="primary" />
        </Box>
      </TouchableBox>
    </AnimatedBox>
  )
}
