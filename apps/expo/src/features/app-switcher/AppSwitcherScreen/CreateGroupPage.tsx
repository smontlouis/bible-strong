import { useTheme } from '~themes/ThemeProvider'
import React, { memo, useRef, useState } from 'react'
import { TextInput, useWindowDimensions, ScrollView } from 'react-native'
import { KeyboardController } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from '~helpers/toast'
import {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  SharedValue,
  Extrapolation,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useTranslation } from 'react-i18next'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import { useAppSwitcherContext } from '../AppSwitcherContext'
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
      void KeyboardController.dismiss()
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
          scheduleOnRN(onPageVisible)
        } else if (!isVisible && wasVisible) {
          // Reset l'état quand on swipe vers un groupe précédent
          scheduleOnRN(resetState)
        }
      }
    )

    const handleCancel = () => {
      setName('')
      setSelectedColor(GROUP_COLORS[0])
      void KeyboardController.dismiss()
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
        void KeyboardController.dismiss()
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
        className="overflow-hidden border-continuous flex-[1] bg-reverse rounded-[24px]"
        style={[{ paddingTop: insets.top }, [{ width }, animatedStyle]]}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="always"
          scrollEnabled={false}
        >
          <Box className="overflow-hidden border-continuous items-center justify-center absolute top-[0px] right-[0px] left-[0px] bottom-[0px]">
            <Box className="overflow-hidden border-continuous items-center justify-center bg-reverse p-[20px] rounded-[24px]">
              <Image
                source={require('~assets/images/new-group-tab.svg')}
                style={{ width: 120, height: 120, opacity: 0.3 }}
                tintColor={theme.colors.tertiary}
                contentFit="contain"
              />
            </Box>
          </Box>
          <Box
            className="overflow-hidden border-continuous flex-row justify-between items-center px-[20px] py-[8px]"
            style={{
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
              overflow: 'visible',
            }}
          >
            <TouchableBox
              className="overflow-hidden border-continuous p-[8px] rounded-[24px] bg-reverse"
              accessibilityLabel={t('Annuler')}
              accessibilityRole="button"
              onPress={handleCancel}
            >
              <FeatherIcon name="x" size={24} color="tertiary" />
            </TouchableBox>

            <TouchableBox
              className="overflow-hidden border-continuous p-[8px] rounded-[24px] bg-primary"
              accessibilityLabel={t('accessibility.createGroup')}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              onPress={handleCreate}
              disabled={isDisabled}
              style={[{ opacity: isDisabled ? 0.6 : 1 }, [{ opacity: isDisabled ? 0.6 : 1 }]]}
            >
              <FeatherIcon name="check" size={24} color={isDisabled ? 'border' : 'reverse'} />
            </TouchableBox>
          </Box>

          <Box className="overflow-hidden border-continuous flex-[1] px-[20px] gap-[12px]">
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
            <HStack className="gap-[8px] overflow-visible">
              {GROUP_COLORS.map((color, index) => (
                <TouchableBox
                  className="overflow-hidden border-continuous w-[32px] h-[32px] rounded-[16px] items-center justify-center"
                  key={color}
                  accessibilityLabel={t('accessibility.colorOption', { index: index + 1 })}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selectedColor === color }}
                  onPress={() => setSelectedColor(color)}
                  style={{
                    backgroundColor: color,
                  }}
                >
                  {selectedColor === color && (
                    <Box className="overflow-hidden border-continuous w-[12px] h-[12px] rounded-[6px] bg-[black] opacity-[0.5]" />
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
