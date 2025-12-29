import { useAtom } from 'jotai/react'
import React, { memo } from 'react'
import { TouchableOpacity, useWindowDimensions } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useTranslation } from 'react-i18next'
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { tabsAtomsAtom, TabGroup } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useTabConstants from '../utils/useTabConstants'
import StaticTabPreview from './StaticTabPreview'
import TabPreview from './TabPreview'
import useAppSwitcher from './useAppSwitcher'
import { useAddTabToGroup } from '../../../state/tabGroups'
import { useExpandNewTab } from '../utils/useExpandNewTab'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

interface TabGroupPageProps {
  group: TabGroup
  index: number
  isActive: boolean
  scrollX: SharedValue<number>
  groupCount: number
}

const TabGroupPage = memo(({ group, index, isActive, scrollX, groupCount }: TabGroupPageProps) => {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const addTabToGroup = useAddTabToGroup()
  const { triggerExpandNewTab } = useExpandNewTab()
  const { TABS_PER_ROW, GAP, SCREEN_MARGIN } = useTabConstants()
  const { PADDING_HORIZONTAL, scrollViewBoxStyle } = useAppSwitcher()
  const { scrollView } = useAppSwitcherContext()
  const insets = useSafeAreaInsets()

  const handleCreateTab = () => {
    const newTabId = `new-${Date.now()}`
    addTabToGroup({
      groupId: group.id,
      tab: {
        id: newTabId,
        title: t('tabs.new'),
        isRemovable: true,
        type: 'new',
        data: {},
      },
    })
    triggerExpandNewTab(newTabId)
  }

  // Animation d'opacité pour le dernier groupe quand on swipe vers la page de création
  const isLastGroup = index === groupCount - 1
  const pageStart = index * width

  const opacityStyle = useAnimatedStyle(() => {
    if (!isLastGroup) {
      return { opacity: 1 }
    }

    // Diminue l'opacité quand on swipe au-delà de la dernière page
    const opacity = interpolate(
      scrollX.get(),
      [pageStart, pageStart + width],
      [1, 0.3],
      Extrapolation.CLAMP
    )

    return { opacity }
  })

  // Empty state for non-default groups with no tabs
  if (group.tabs?.length === 0) {
    return (
      <AnimatedBox style={[{ width }, opacityStyle]} flex={1} bg="lightGrey" zIndex={2}>
        <Box flex={1} center paddingTop={insets.top + 100}>
          <Text color="grey" fontSize={16} mb={20}>
            {t('tabs.noTabs')}
          </Text>
          <TouchableOpacity onPress={handleCreateTab}>
            <Box
              bg="primary"
              paddingVertical={12}
              paddingHorizontal={20}
              borderRadius={10}
              row
              center
            >
              <FeatherIcon name="plus" color="white" size={20} />
              <Text color="white" ml={8} bold>
                {t('tabs.create')}
              </Text>
            </Box>
          </TouchableOpacity>
        </Box>
      </AnimatedBox>
    )
  }

  // Pour les groupes non-actifs: rendu statique avec group.tabs
  if (!isActive) {
    return (
      <AnimatedBox style={[{ width }, opacityStyle]} flex={1} bg="lightGrey">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: SCREEN_MARGIN + insets.top,
            paddingLeft: PADDING_HORIZONTAL,
            paddingRight: PADDING_HORIZONTAL,
            paddingBottom: TAB_ICON_SIZE + 60,
            minHeight: '100%',
          }}
        >
          <Box
            overflow="visible"
            row
            style={{
              flexWrap: 'wrap',
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
            }}
          >
            {group.tabs.map((tab, i) => (
              <StaticTabPreview
                key={tab.id}
                tab={tab}
                index={i}
                marginRight={(i + 1) % TABS_PER_ROW ? GAP : 0}
              />
            ))}
          </Box>
        </ScrollView>
      </AnimatedBox>
    )
  }

  return (
    <AnimatedBox style={[{ width }, opacityStyle]} flex={1} bg="lightGrey" zIndex={2}>
      <AnimatedScrollView
        ref={scrollView.ref}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: SCREEN_MARGIN + insets.top,
          paddingLeft: PADDING_HORIZONTAL,
          paddingRight: PADDING_HORIZONTAL,
          paddingBottom: TAB_ICON_SIZE + 60,
          minHeight: '100%',
        }}
      >
        <AnimatedBox
          overflow="visible"
          row
          style={[
            scrollViewBoxStyle,
            {
              flexWrap: 'wrap',
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
            },
          ]}
        >
          {tabsAtoms.map((tabAtom, i) => (
            <TabPreview
              key={`${tabAtom}`}
              index={i}
              tabAtom={tabAtom}
              marginRight={(i + 1) % TABS_PER_ROW ? GAP : 0}
            />
          ))}
        </AnimatedBox>
      </AnimatedScrollView>
    </AnimatedBox>
  )
})

TabGroupPage.displayName = 'TabGroupPage'

export default TabGroupPage
