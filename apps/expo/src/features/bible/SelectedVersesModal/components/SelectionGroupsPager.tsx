import type { ReactNode } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { TABS } from '../constants'
import useTabSwipeGesture from '../hooks/useTabSwipeGesture'
import { SELECTION_GROUP_WIDTH } from '../selectionSheetLayout'
import SelectionGroups from './SelectionGroups'
import VersesModalFooter from './VersesModalFooter'

type SelectionGroupsPagerProps = {
  activeTabIndex: number
  setActiveTabIndex: (index: number) => void
  /** What marks the selection, above its actions: colors, or the ways to mark words. */
  header: ReactNode
  /** Annotate, study and share, each drawn at the width it is given. */
  groups: readonly [
    (width: number) => ReactNode,
    (width: number) => ReactNode,
    (width: number) => ReactNode,
  ]
}

/**
 * The skeleton the selection sheet shows for verses and for words alike: what marks the
 * selection, then its three groups of actions, one at a time behind tabs. On the web the
 * groups stand side by side, each under its name.
 */
export default function SelectionGroupsPager({
  activeTabIndex,
  setActiveTabIndex,
  header,
  groups,
}: SelectionGroupsPagerProps) {
  const { t } = useTranslation()
  const {
    panGesture,
    animatedStyle,
    indicatorAnimatedStyle,
    goToTab,
    tabWidth,
    screenWidth,
    setContentWidth,
    setTabContainerWidth,
  } = useTabSwipeGesture({ activeTabIndex, setActiveTabIndex })

  const expanded = Platform.OS === 'web'
  const groupWidth = expanded ? SELECTION_GROUP_WIDTH : screenWidth
  const labels = [t('tabs.annotate'), t('tabs.study'), t('tabs.share')]

  return (
    <Box
      onLayout={event => setContentWidth(event.nativeEvent.layout.width)}
      className="overflow-hidden border-continuous"
      style={{ overflow: 'hidden' }}
    >
      {header}
      <SelectionGroups>
        <Animated.View
          key={expanded ? 'expanded' : 'tabs'}
          style={[
            {
              flexDirection: 'row',
              width: groupWidth * TABS.length,
              alignItems: 'flex-start',
            },
            !expanded && animatedStyle,
          ]}
        >
          {groups.map((group, index) => (
            <Box key={TABS[index]} style={{ width: groupWidth, flexShrink: 0 }}>
              {expanded && (
                <Text className="text-center text-[13px] text-grey py-[10px]">{labels[index]}</Text>
              )}
              {group(groupWidth)}
            </Box>
          ))}
        </Animated.View>
      </SelectionGroups>
      {Platform.OS !== 'web' && (
        <VersesModalFooter
          onContainerWidthChange={setTabContainerWidth}
          panGesture={panGesture}
          indicatorAnimatedStyle={indicatorAnimatedStyle}
          tabWidth={tabWidth}
          activeTabIndex={activeTabIndex}
          goToTab={goToTab}
        />
      )}
    </Box>
  )
}
