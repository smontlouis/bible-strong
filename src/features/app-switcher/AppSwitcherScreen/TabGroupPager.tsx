import { useFocusEffect } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import React, { useCallback, useDeferredValue } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'

import { AnimatedBox } from '~common/ui/Box'
import {
  activeGroupIdAtom,
  tabGroupsAtom,
  bufferedGroupIdsAtom,
  appSwitcherModeAtom,
} from '../../../state/tabs'
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
  const bufferedGroupIds = useAtomValue(bufferedGroupIdsAtom)
  const appSwitcherMode = useAtomValue(appSwitcherModeAtom)
  // Différer le chargement des groupes adjacents (basse priorité)
  const deferredBufferedGroupIds = useDeferredValue(bufferedGroupIds)
  const { activeGroupIndex, groupPager, createGroupPage } = useAppSwitcherContext()

  // Check if a group is in the buffer
  // - Active group: toujours bufferisé immédiatement
  // - Groupes adjacents: bufferisés en différé (basse priorité)
  const isGroupBuffered = useCallback(
    (groupId: string) => {
      const activeGroupId = getDefaultStore().get(activeGroupIdAtom)
      // Groupe actif = priorité haute (immédiat)
      if (groupId === activeGroupId) return true
      // Groupes adjacents = priorité basse (différé)
      return deferredBufferedGroupIds.includes(groupId)
    },
    [deferredBufferedGroupIds]
  )

  const totalPages = groups.length + 1

  // Use shared values from context
  const { translateX, scrollX, navigateToPage } = groupPager

  // Local value for gesture start position
  const startX = useSharedValue(0)

  // Wrapper pour appeler navigateToPage depuis le UI thread
  const handleNavigateToPage = useCallback(
    (targetPage: number) => {
      navigateToPage(targetPage, groups.length)
    },
    [navigateToPage, groups.length]
  )

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

      // Naviguer vers la page cible (qui set aussi activeGroupIdAtom)
      if (targetPage < groups.length) {
        runOnJS(handleNavigateToPage)(targetPage)
      }

      translateX.set(withSpring(targetX))
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
  }

  const handleGroupCreated = (_groupId: string) => {
    // Navigation is handled by CreateGroupPage calling navigateToPage
  }

  // Sync pager position when screen gains focus (for external changes like useCreateTabGroupFromTag)
  useFocusEffect(
    useCallback(() => {
      const currentGroupId = getDefaultStore().get(activeGroupIdAtom)
      const currentIndex = groups.findIndex(g => g.id === currentGroupId)
      if (currentIndex !== -1 && currentIndex !== activeGroupIndex.get()) {
        // Position sans animation (on arrive sur l'écran)
        translateX.set(-currentIndex * width)
        scrollX.set(currentIndex * width)
        activeGroupIndex.set(currentIndex)
      }
    }, [groups, activeGroupIndex, translateX, scrollX, width])
  )

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <AnimatedBox flex={1} bg="lightGrey">
          <AnimatedBox row style={[{ width: totalPages * width, height: '100%' }, containerStyle]}>
            {groups.map((group, index) => (
              <TabGroupPage
                key={group.id}
                group={group}
                index={index}
                isBuffered={isGroupBuffered(group.id)}
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
    </>
  )
}

export default TabGroupPager
