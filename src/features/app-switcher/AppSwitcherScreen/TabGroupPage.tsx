import { FlashList, FlashListRef, ListRenderItemInfo, ViewToken } from '@shopify/flash-list'
import { useAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity, useWindowDimensions, ViewStyle } from 'react-native'
import { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@emotion/react'
import { Image } from 'expo-image'
import Box, { AnimatedBox, FadingBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { getContrastTextColor } from '~helpers/highlightUtils'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { useAddTabToGroup } from '../../../state/tabGroups'
import { getGroupTabsAtomsAtom, TabGroup, TabItem } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { useExpandNewTab } from '../utils/useExpandNewTab'
import useTabConstants from '../utils/useTabConstants'
import StaticTabPreview from './StaticTabPreview'
import TabPreview from './TabPreview'
import useAppSwitcher from './useAppSwitcher'
import { useAutoFontSize } from '~helpers/useAutoFontSize'
import { wp } from '~helpers/utils'

interface TabGroupPageProps {
  group: TabGroup
  index: number
  isBuffered: boolean
  scrollX: SharedValue<number>
  groupCount: number
}

// Group name header (only for non-default groups)
const GroupHeader = ({
  skipEntering = true,
  skipExiting = false,
  group,
}: {
  group: TabGroup
  skipEntering?: boolean
  skipExiting?: boolean
}) => {
  const insets = useSafeAreaInsets()
  const { SCREEN_MARGIN } = useTabConstants()
  const { colorScheme } = useCurrentThemeSelector()
  const { fontSize, onTextLayout } = useAutoFontSize(30, wp(70), 20)

  if (group.isDefault) return null

  const textColor = group.color
    ? getContrastTextColor(group.color, colorScheme === 'dark')
    : undefined

  return (
    <FadingBox
      keyProp={group.id}
      direction="bottom"
      pt={SCREEN_MARGIN + insets.top}
      pb={20}
      skipEntering={skipEntering}
      skipExiting={skipExiting}
      row
      alignItems="center"
      gap={12}
    >
      <Box bg={group.color} width={24} height={24} borderRadius={6} center>
        <Text fontSize={12} style={{ color: textColor }} bold>
          {group.tabs?.length ?? 0}
        </Text>
      </Box>
      <Text
        fontSize={fontSize}
        color="default"
        numberOfLines={1}
        flex={1}
        onTextLayout={onTextLayout}
      >
        {group.name}
      </Text>
    </FadingBox>
  )
}

const TabGroupPage = ({ group, index, isBuffered, scrollX, groupCount }: TabGroupPageProps) => {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()

  // Get split atoms for this specific group (cached)
  const groupTabsAtomsAtom = useMemo(() => getGroupTabsAtomsAtom(group.id), [group.id])
  const [tabsAtoms] = useAtom(groupTabsAtomsAtom)
  const addTabToGroup = useAddTabToGroup()
  const { triggerExpandNewTab } = useExpandNewTab()
  const { TABS_PER_ROW, GAP, SCREEN_MARGIN } = useTabConstants()
  const { PADDING_HORIZONTAL } = useAppSwitcher()
  const { flashListRefs, tabPreviews } = useAppSwitcherContext()
  const insets = useSafeAreaInsets()
  const theme = useTheme()

  // Track visible indices for virtualization detection
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<PrimitiveAtom<TabItem>>[] }) => {
      const indices = viewableItems.map(item => item.index).filter((i): i is number => i !== null)
      tabPreviews.setVisibleIndices(indices)
    },
    [tabPreviews]
  )

  // Create and register FlashList ref for this group
  const flashListRef = useRef<FlashListRef<PrimitiveAtom<TabItem>>>(null)
  useEffect(() => {
    if (isBuffered) {
      flashListRefs.registerRef(group.id, flashListRef)
    }
  }, [isBuffered, group.id, flashListRefs, flashListRef])

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

  const contentContainerStyle: ViewStyle = {
    paddingTop: group.isDefault ? SCREEN_MARGIN + insets.top : 0,
    paddingHorizontal: PADDING_HORIZONTAL,
    paddingBottom: TAB_ICON_SIZE + 60,
  }

  const renderActiveItem = ({
    item: tabAtom,
    index: i,
  }: ListRenderItemInfo<PrimitiveAtom<TabItem>>) => (
    <TabPreview
      index={i}
      tabAtom={tabAtom}
      groupId={group.id}
      marginRight={(i + 1) % TABS_PER_ROW ? GAP : 0}
    />
  )

  const renderStaticItem = ({ item: tab, index: i }: ListRenderItemInfo<TabItem>) => (
    <StaticTabPreview tab={tab} index={i} marginRight={(i + 1) % TABS_PER_ROW ? GAP : 0} />
  )

  // Use stable tab.id instead of atom.toString()
  const keyExtractorActive = (item: PrimitiveAtom<TabItem>) => getDefaultStore().get(item).id

  const keyExtractorStatic = (item: TabItem) => item.id

  const ListHeaderComponentActive = <GroupHeader group={group} />

  const ListHeaderComponentStatic = <GroupHeader group={group} skipExiting />

  // Empty state for non-default groups with no tabs
  if (group.tabs?.length === 0) {
    return (
      <AnimatedBox style={[{ width }, opacityStyle]} flex={1} bg="lightGrey" zIndex={2}>
        <FadingBox keyProp={group.id} direction="bottom" flex={1} skipEntering={false}>
          <Box flex={1} center>
            <Image
              source={require('~assets/images/tabs.svg')}
              style={{ width: 150, height: 150, opacity: 0.3 }}
              tintColor={theme.colors.tertiary}
            />
            <TouchableOpacity onPress={handleCreateTab}>
              <Box
                bg="primary"
                paddingVertical={12}
                paddingHorizontal={20}
                borderRadius={24}
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
        </FadingBox>
      </AnimatedBox>
    )
  }

  // Pour les groupes non-bufferises: rendu statique avec group.tabs
  // (groupes bufferises = actif + adjacents gauche/droite)
  if (!isBuffered) {
    return (
      <AnimatedBox style={[{ width }, opacityStyle]} flex={1} bg="lightGrey">
        <FlashList
          data={group.tabs}
          numColumns={TABS_PER_ROW}
          keyExtractor={keyExtractorStatic}
          renderItem={renderStaticItem}
          ListHeaderComponent={ListHeaderComponentStatic}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
        />
      </AnimatedBox>
    )
  }

  // Pour les groupes bufferises: rendu avec atoms (actif + adjacents)
  return (
    <AnimatedBox style={[{ width }, opacityStyle]} flex={1} bg="lightGrey">
      <FlashList
        ref={flashListRef}
        data={tabsAtoms}
        numColumns={TABS_PER_ROW}
        keyExtractor={keyExtractorActive}
        renderItem={renderActiveItem}
        ListHeaderComponent={ListHeaderComponentActive}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
      />
    </AnimatedBox>
  )
}

TabGroupPage.displayName = 'TabGroupPage'

export default TabGroupPage
