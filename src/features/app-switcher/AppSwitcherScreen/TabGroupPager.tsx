import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'

import { AnimatedBox } from '~common/ui/Box'
import { activeGroupIdAtom, tabGroupsAtom, cachedTabIdsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import CreateGroupPage from './CreateGroupPage'
import TabGroupPage from './TabGroupPage'

const VELOCITY_THRESHOLD = 500
const OVERSCROLL_RESISTANCE = 0.3
const MAX_OVERSCROLL = 100

const rubberBandClamp = (value: number, min: number, max: number): number => {
  'worklet'
  if (value > max) {
    const overscroll = value - max
    return max + Math.min(overscroll * OVERSCROLL_RESISTANCE, MAX_OVERSCROLL)
  } else if (value < min) {
    const overscroll = min - value
    return min - Math.min(overscroll * OVERSCROLL_RESISTANCE, MAX_OVERSCROLL)
  }
  return value
}

const TabGroupPager = () => {
  const { width } = useWindowDimensions()
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const setActiveGroupId = useSetAtom(activeGroupIdAtom)
  const setCachedTabIds = useSetAtom(cachedTabIdsAtom)
  const { activeGroupIndex, groupPager, createGroupPage } = useAppSwitcherContext()

  const totalPages = groups.length + 1

  // Use shared values from context
  const { translateX, scrollX, navigateToPage } = groupPager

  // Local value for gesture start position
  const startX = useSharedValue(0)

  const handleGroupChange = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < groups.length) {
      const newGroupId = groups[newIndex].id
      if (newGroupId !== activeGroupId) {
        setCachedTabIds([])
        setActiveGroupId(newGroupId)
      }
    }
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet'
      startX.set(translateX.get())
    })
    .onUpdate(event => {
      'worklet'
      const minTranslateX = -(totalPages - 1) * width
      const maxTranslateX = 0

      const newX = startX.get() + event.translationX
      translateX.set(rubberBandClamp(newX, minTranslateX, maxTranslateX))
      scrollX.set(-translateX.get())

      const pageIndex = Math.round(-translateX.get() / width)
      activeGroupIndex.set(pageIndex)

      const createPagePosition = groups.length * width
      const isOnCreatePage = -translateX.get() >= createPagePosition - 10
      createGroupPage.isFullyVisible.set(isOnCreatePage)
    })
    .onEnd(event => {
      'worklet'
      const currentPage = -translateX.get() / width
      let targetPage: number

      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        targetPage = event.velocityX > 0 ? Math.floor(currentPage) : Math.ceil(currentPage)
      } else {
        targetPage = Math.round(currentPage)
      }

      targetPage = Math.max(0, Math.min(targetPage, totalPages - 1))

      const targetX = -targetPage * width

      translateX.set(
        withSpring(targetX, undefined, finished => {
          'worklet'
          if (finished && targetPage < groups.length) {
            runOnJS(handleGroupChange)(targetPage)
          }
        })
      )

      scrollX.set(withSpring(-targetX))
      activeGroupIndex.set(targetPage)

      const createPagePosition = groups.length * width
      createGroupPage.isFullyVisible.set(-targetX >= createPagePosition - 10)
    })

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }))

  const scrollToPreviousGroup = () => {
    const targetPage = Math.max(0, groups.length - 1)
    navigateToPage(targetPage, groups.length)
    handleGroupChange(targetPage)
  }

  const handleGroupCreated = (_groupId: string) => {
    // Navigation is handled by the sync useEffect when activeGroupId changes
  }

  // Sync pager position when activeGroupId changes externally
  useEffect(() => {
    const activeIndex = groups.findIndex(g => g.id === activeGroupId)
    if (activeIndex !== -1) {
      navigateToPage(activeIndex, groups.length)
    }
  }, [activeGroupId, groups, navigateToPage])

  return (
    <GestureDetector gesture={panGesture}>
      <AnimatedBox flex={1} bg="lightGrey">
        <AnimatedBox row style={[{ width: totalPages * width, height: '100%' }, containerStyle]}>
          {groups.map((group, index) => (
            <TabGroupPage
              key={group.id}
              group={group}
              index={index}
              isActive={group.id === activeGroupId}
              scrollX={scrollX}
              groupCount={groups.length}
            />
          ))}
          <CreateGroupPage
            scrollX={scrollX}
            groupCount={groups.length}
            onCancel={scrollToPreviousGroup}
            onGroupCreated={handleGroupCreated}
          />
        </AnimatedBox>
      </AnimatedBox>
    </GestureDetector>
  )
}

export default TabGroupPager
