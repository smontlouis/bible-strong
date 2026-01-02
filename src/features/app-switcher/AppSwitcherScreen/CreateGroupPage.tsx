import { useTheme } from '@emotion/react'
import React, { memo, useRef, useState } from 'react'
import { Keyboard, TextInput, useWindowDimensions, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
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
import { HStack } from '~common/ui/Stack'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { useCreateGroup, getTabGroups } from '../../../state/tabGroups'
import { GROUP_COLORS } from '../../../state/tabs'
import { Image } from 'expo-image'

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
    const { createGroupPage, groupPager } = useAppSwitcherContext()

    const [name, setName] = useState('')
    const [selectedColor, setSelectedColor] = useState<string>(GROUP_COLORS[0])
    const inputRef = useRef<TextInput>(null)
    const isCreatingRef = useRef(false)
    const isSwipingRef = useRef(false)
    const createGroup = useCreateGroup()

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
        // Désactiver les touches quand la page n'est pas visible
        pointerEvents: createGroupPage.isFullyVisible.get() ? 'auto' : 'none',
      }
    })

    // Auto-focus when fully visible
    const focusInput = () => {
      inputRef.current?.focus()
    }

    // Reset l'état quand on quitte la page (swipe vers groupe précédent)
    const resetState = () => {
      // Marquer qu'on est en train de swiper pour désactiver onBlur
      isSwipingRef.current = true

      // Ne pas reset si on vient de créer un groupe
      if (isCreatingRef.current) {
        isCreatingRef.current = false
        return
      }
      setName('')
      setSelectedColor(GROUP_COLORS[0])
      Keyboard.dismiss()
    }

    // Reset les flags quand on arrive sur la page
    const onPageVisible = () => {
      isSwipingRef.current = false
      isCreatingRef.current = false
      focusInput()
    }

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

    const handleCancel = () => {
      setName('')
      setSelectedColor(GROUP_COLORS[0])
      Keyboard.dismiss()
      onCancel()
    }

    const handleCreate = () => {
      if (!name.trim()) return

      // Marquer qu'on est en train de créer pour éviter le reset
      isCreatingRef.current = true

      const newGroupId = createGroup({ name: name.trim(), color: selectedColor })
      if (newGroupId) {
        // Calculer l'index du nouveau groupe et naviguer
        const groups = getTabGroups()
        const newGroupIndex = groups.findIndex(g => g.id === newGroupId)
        groupPager.navigateToPage(newGroupIndex, groups.length)

        setName('')
        setSelectedColor(GROUP_COLORS[0])
        Keyboard.dismiss()
        onGroupCreated(newGroupId)
      } else {
        // Si la création a échoué (limite atteinte), afficher le toast
        toast.error(t('Limite de groupes atteinte'))
        isCreatingRef.current = false
      }
    }

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
              <Image
                source={require('~assets/images/new-group-tab.svg')}
                style={{ width: 120, height: 120, opacity: 0.3 }}
                tintColor={theme.colors.tertiary}
                contentFit="contain"
              />
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

          <Box flex={1} paddingHorizontal={20} gap={12}>
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
            <HStack gap={12} overflow="visible">
              {GROUP_COLORS.map(color => (
                <TouchableBox
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  width={20}
                  height={20}
                  borderRadius={10}
                  center
                  style={{
                    backgroundColor: color,
                  }}
                >
                  {selectedColor === color && (
                    <Box width={10} height={10} borderRadius={5} bg="black" opacity={0.5} />
                  )}
                </TouchableBox>
              ))}
            </HStack>
          </Box>
        </ScrollView>
      </AnimatedBox>
    )
  }
)

CreateGroupPage.displayName = 'CreateGroupPage'

export default CreateGroupPage
