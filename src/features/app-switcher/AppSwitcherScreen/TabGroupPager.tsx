import { useAtomValue, useSetAtom } from 'jotai/react'
import React, { memo, useCallback, useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { AnimatedBox } from '~common/ui/Box'
import { activeGroupIdAtom, tabGroupsAtom, cachedTabIdsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import CreateGroupPage from './CreateGroupPage'
import TabGroupPage from './TabGroupPage'
import { runOnJS } from 'react-native-worklets'

const VELOCITY_THRESHOLD = 500
const OVERSCROLL_RESISTANCE = 0.3 // Résistance quand on dépasse les limites (0-1)
const MAX_OVERSCROLL = 100 // Dépassement maximum en pixels

// Fonction rubber-band pour l'effet de rebond aux limites
const rubberBandClamp = (value: number, min: number, max: number): number => {
  'worklet'
  if (value > max) {
    // Overscroll à droite (début)
    const overscroll = value - max
    return max + Math.min(overscroll * OVERSCROLL_RESISTANCE, MAX_OVERSCROLL)
  } else if (value < min) {
    // Overscroll à gauche (fin)
    const overscroll = min - value
    return min - Math.min(overscroll * OVERSCROLL_RESISTANCE, MAX_OVERSCROLL)
  }
  return value
}

const TabGroupPager = memo(() => {
  const { width } = useWindowDimensions()
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const setActiveGroupId = useSetAtom(activeGroupIdAtom)
  const setCachedTabIds = useSetAtom(cachedTabIdsAtom)
  const { activeGroupIndex, createGroupPage } = useAppSwitcherContext()

  const totalPages = groups.length + 1 // +1 pour la page de création

  // Position de la translation (négative car on translate vers la gauche)
  const translateX = useSharedValue(0)
  const startX = useSharedValue(0)

  // scrollX pour les animations des enfants (positif, comme un contentOffset.x)
  const scrollX = useSharedValue(0)

  const handleGroupChange = useCallback(
    (newIndex: number) => {
      if (newIndex >= 0 && newIndex < groups.length) {
        const newGroupId = groups[newIndex].id
        if (newGroupId !== activeGroupId) {
          // Clear cache when switching groups
          setCachedTabIds([])
          setActiveGroupId(newGroupId)
        }
      }
    },
    [groups, activeGroupId, setActiveGroupId, setCachedTabIds]
  )

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Activer seulement si mouvement horizontal > 10px
    .failOffsetY([-10, 10]) // Échouer si mouvement vertical > 10px
    .onStart(() => {
      'worklet'
      startX.set(translateX.get())
    })
    .onUpdate(event => {
      'worklet'
      // Limites de scroll
      const minTranslateX = -(totalPages - 1) * width
      const maxTranslateX = 0

      // Drag avec effet rubber-band aux limites
      const newX = startX.get() + event.translationX
      translateX.set(rubberBandClamp(newX, minTranslateX, maxTranslateX))

      // Mise à jour de scrollX pour les animations des enfants
      // scrollX = -translateX (car translateX est négatif)
      scrollX.set(-translateX.get())

      // Mise à jour de l'index actif
      const pageIndex = Math.round(-translateX.get() / width)
      activeGroupIndex.set(pageIndex)

      // Détecter si on est sur la page de création
      const createPagePosition = groups.length * width
      const isOnCreatePage = -translateX.get() >= createPagePosition - 10
      createGroupPage.isFullyVisible.set(isOnCreatePage)
    })
    .onEnd(event => {
      'worklet'
      // Calculer la page cible basée sur la vélocité et la position
      const currentPage = -translateX.get() / width
      let targetPage: number

      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        // Swipe rapide : aller à la page suivante/précédente
        targetPage = event.velocityX > 0 ? Math.floor(currentPage) : Math.ceil(currentPage)
      } else {
        // Swipe lent : snap à la page la plus proche
        targetPage = Math.round(currentPage)
      }

      // Clamp la page cible
      targetPage = Math.max(0, Math.min(targetPage, totalPages - 1))

      // Animer vers la page cible
      const targetX = -targetPage * width

      // Animer translateX avec callback à la fin pour changer de groupe
      translateX.set(
        withSpring(targetX, undefined, finished => {
          'worklet'
          if (finished && targetPage < groups.length) {
            runOnJS(handleGroupChange)(targetPage)
          }
        })
      )

      // Mettre à jour scrollX en sync avec l'animation
      scrollX.set(withSpring(-targetX))

      // Mettre à jour l'index actif
      activeGroupIndex.set(targetPage)

      // Mettre à jour createGroupPage.isFullyVisible
      const createPagePosition = groups.length * width
      createGroupPage.isFullyVisible.set(-targetX >= createPagePosition - 10)
    })

  // Style animé pour le conteneur
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }))

  // Navigation programmatique
  const navigateToPage = useCallback(
    (pageIndex: number) => {
      'worklet'
      const targetX = -pageIndex * width
      translateX.set(withSpring(targetX))
      scrollX.set(withSpring(-targetX))
      activeGroupIndex.set(pageIndex)

      // Mettre à jour createGroupPage.isFullyVisible
      const createPagePosition = groups.length * width
      createGroupPage.isFullyVisible.set(-targetX >= createPagePosition - 10)
    },
    [width, translateX, scrollX, activeGroupIndex, groups.length, createGroupPage]
  )

  // Scroll back to the last group (used when canceling group creation)
  const scrollToPreviousGroup = useCallback(() => {
    const targetPage = Math.max(0, groups.length - 1)
    navigateToPage(targetPage)
    handleGroupChange(targetPage)
  }, [groups.length, navigateToPage, handleGroupChange])

  // Handle successful group creation
  // Navigation is handled by the sync useEffect when activeGroupId changes
  const handleGroupCreated = useCallback((_groupId: string) => {
    // No need to navigate manually - the sync useEffect handles it
  }, [])

  // Navigate to create page (for external triggers like GroupTitleButton)
  const navigateToCreatePage = useCallback(() => {
    const createPageIndex = groups.length
    navigateToPage(createPageIndex)
  }, [groups.length, navigateToPage])

  // Register the navigation function in context
  useEffect(() => {
    createGroupPage.navigateTo.current = navigateToCreatePage
    return () => {
      createGroupPage.navigateTo.current = null
    }
  }, [navigateToCreatePage, createGroupPage.navigateTo])

  // Sync pager position when activeGroupId changes externally (e.g., group deleted)
  useEffect(() => {
    const activeIndex = groups.findIndex(g => g.id === activeGroupId)
    if (activeIndex !== -1) {
      // Navigate to the active group's position
      navigateToPage(activeIndex)
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
})

TabGroupPager.displayName = 'TabGroupPager'

export default TabGroupPager
