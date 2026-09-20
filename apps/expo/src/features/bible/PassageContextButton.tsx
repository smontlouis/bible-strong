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
import { usePublicShell } from '~navigation/PublicShellContext'
import { pageContentStyle } from '~common/ui/PageContent'

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
  const publicShell = usePublicShell()
  const collapsed = !isFormSheet && isFullScreen
  return (
    <AnimatedBox
      className={
        publicShell.active
          ? 'absolute left-0 right-0 bg-transparent'
          : 'absolute left-0 right-0 border-b-[1px] border-border bg-reverse'
      }
      pointerEvents={collapsed ? 'none' : 'auto'}
      accessibilityElementsHidden={collapsed}
      importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      style={{
        top: publicShell.active
          ? 0
          : isFormSheet
            ? BIBLE_FORM_SHEET_HEADER_HEIGHT
            : HEADER_HEIGHT + insets.top,
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
        className={
          publicShell.active ? 'flex-1 relative items-center justify-center' : 'flex-1 relative'
        }
        style={publicShell.active ? pageContentStyle : undefined}
      >
        <TouchableBox
          className={
            publicShell.active
              ? 'h-[36px] self-center px-[22px] items-center justify-center rounded-[12px] bg-reverse border-[1px] border-border hover:bg-light-grey'
              : 'flex-1 mx-[56px] items-center justify-center'
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: !focused }}
          onPress={focused ? onExpand : onCollapse}
        >
          <Text
            className={
              publicShell.active
                ? 'text-default font-semibold text-[13px] text-center'
                : 'text-primary font-bold text-[14px] text-center'
            }
          >
            {t(focused ? 'tab.readWholeChapter' : 'tab.closeContext')}
          </Text>
        </TouchableBox>
        {!publicShell.active && (
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
        )}
      </Box>
    </AnimatedBox>
  )
}
