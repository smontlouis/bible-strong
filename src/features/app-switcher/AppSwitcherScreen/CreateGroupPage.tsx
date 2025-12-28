import { useTheme } from '@emotion/react'
import React, { memo, useCallback, useRef, useState } from 'react'
import { Keyboard, TextInput, useWindowDimensions, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  SharedValue,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'

import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { useCreateGroup, useSwitchGroup } from '../../../state/tabGroups'

interface CreateGroupPageProps {
  scrollX: SharedValue<number>
  groupCount: number
  onCancel: () => void
  onGroupCreated: (groupId: string) => void
}

const CreateGroupPage = memo(
  ({ scrollX, groupCount, onCancel, onGroupCreated }: CreateGroupPageProps) => {
    const { width } = useWindowDimensions()
    const { t } = useTranslation()
    const theme = useTheme()
    const insets = useSafeAreaInsets()
    const { createGroupPage } = useAppSwitcherContext()

    const [name, setName] = useState('')
    const inputRef = useRef<TextInput>(null)
    const isCreatingRef = useRef(false)
    const isSwipingRef = useRef(false)
    const createGroup = useCreateGroup()
    const switchGroup = useSwitchGroup()

    // Position où commence la page "+" (après tous les groupes)
    const startPosition = groupCount * width

    // Style animé pour l'effet reveal "immobile"
    const animatedStyle = useAnimatedStyle(() => {
      const scrollValue = scrollX.get()

      // Calcul du progrès du swipe vers la page "+"
      const progress = interpolate(
        scrollValue,
        [startPosition - width, startPosition],
        [0, 1],
        Extrapolation.CLAMP
      )

      // Scale de 0.8 à 1 pour l'effet reveal
      const scale = interpolate(
        scrollValue,
        [startPosition - width, startPosition],
        [0.8, 1],
        Extrapolation.CLAMP
      )

      // Contre-translation pour annuler le mouvement du pager
      // La page reste visuellement fixe pendant le swipe
      const translateX = interpolate(
        scrollValue,
        [startPosition - width, startPosition],
        [-width, 0],
        Extrapolation.CLAMP
      )

      return {
        opacity: progress,
        transform: [{ translateX }, { scale }],
      }
    })

    // Auto-focus when fully visible
    const focusInput = useCallback(() => {
      inputRef.current?.focus()
    }, [])

    // Reset l'état quand on quitte la page (swipe vers groupe précédent)
    const resetState = useCallback(() => {
      // Marquer qu'on est en train de swiper pour désactiver onBlur
      isSwipingRef.current = true

      // Ne pas reset si on vient de créer un groupe
      if (isCreatingRef.current) {
        isCreatingRef.current = false
        return
      }
      setName('')
      Keyboard.dismiss()
    }, [])

    // Reset les flags quand on arrive sur la page
    const onPageVisible = useCallback(() => {
      isSwipingRef.current = false
      isCreatingRef.current = false
      focusInput()
    }, [focusInput])

    useAnimatedReaction(
      () => createGroupPage.isFullyVisible.get(),
      (isVisible, wasVisible) => {
        if (isVisible && !wasVisible) {
          runOnJS(onPageVisible)()
        } else if (!isVisible && wasVisible) {
          // Reset l'état quand on swipe vers un groupe précédent
          runOnJS(resetState)()
        }
      }
    )

    const handleCancel = useCallback(() => {
      setName('')
      Keyboard.dismiss()
      onCancel()
    }, [onCancel])

    const handleCreate = useCallback(() => {
      if (!name.trim()) return

      // Marquer qu'on est en train de créer pour éviter le reset
      isCreatingRef.current = true

      const newGroupId = createGroup(name.trim())
      if (newGroupId) {
        switchGroup(newGroupId)
        setName('')
        Keyboard.dismiss()
        onGroupCreated(newGroupId)
      } else {
        // Si la création a échoué, réinitialiser le flag
        isCreatingRef.current = false
      }
    }, [name, createGroup, switchGroup, onGroupCreated])

    const isDisabled = !name.trim()

    return (
      <AnimatedBox
        style={[{ width }, animatedStyle]}
        flex={1}
        bg="reverse"
        borderRadius={24}
        paddingTop={insets.top}
      >
        <ScrollView
          contentContainerStyle={{ flex: 1 }}
          keyboardShouldPersistTaps="always"
          scrollEnabled={false}
        >
          <Box
            alignItems="center"
            justifyContent="center"
            position="absolute"
            top={0}
            right={0}
            left={0}
            bottom={0}
          >
            <Box center bg="reverse" p={20} borderRadius={24}>
              <FeatherIcon name="plus-circle" size={70} color="default" style={{ opacity: 0.2 }} />
            </Box>
          </Box>
          <Box
            row
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal={20}
            py={8}
            lightShadow
          >
            <TouchableBox onPress={handleCancel} padding={8} borderRadius={24} bg="reverse">
              <FeatherIcon name="x" size={24} color="tertiary" />
            </TouchableBox>

            <TouchableBox
              onPress={handleCreate}
              padding={8}
              borderRadius={24}
              bg="primary"
              disabled={isDisabled}
            >
              <FeatherIcon name="check" size={24} color={isDisabled ? 'border' : 'reverse'} />
            </TouchableBox>
          </Box>

          <Box flex={1} paddingHorizontal={20}>
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={setName}
              placeholder={t('tabs.groupNamePlaceholder')}
              placeholderTextColor={theme.colors.darkGrey}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
              style={{
                width: '100%',
                height: 56,
                borderWidth: 0,
                fontSize: 30,
                color: theme.colors.default,
              }}
            />
          </Box>
        </ScrollView>
      </AnimatedBox>
    )
  }
)

CreateGroupPage.displayName = 'CreateGroupPage'

export default CreateGroupPage
