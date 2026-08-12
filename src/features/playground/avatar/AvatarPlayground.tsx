import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Box, { HStack, VStack } from '~common/ui/Box'
import Switch from '~common/ui/Switch'
import Text from '~common/ui/Text'
import BibleStrongAvatar, { type AvatarGaze, type AvatarVariant } from './BibleStrongAvatar'

// PROTOTYPE — Three avatar directions, switchable with ?variant=orb|halo|pebble,
// hosted in the existing Bible Strong playground.

type AvatarPlaygroundProps = {
  onClose: () => void
}

type Choice<T extends string> = {
  id: T
  label: string
}

const VARIANTS: readonly Choice<AvatarVariant>[] = [
  { id: 'orb', label: 'A · Bible Strong' },
  { id: 'halo', label: 'B · Référence' },
  { id: 'pebble', label: 'C · Contraste' },
]

const clamp = (value: number) => Math.max(-1, Math.min(1, value))

const ControlSection = ({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description?: string
  title: string
}) => (
  <VStack bg="reverse" borderColor="border" borderWidth={1} borderRadius={20} p={17} gap={13}>
    <VStack gap={3}>
      <Text title fontSize={16} lineHeight={20}>
        {title}
      </Text>
      {description ? (
        <Text color="grey" fontSize={12} lineHeight={17}>
          {description}
        </Text>
      ) : null}
    </VStack>
    {children}
  </VStack>
)

const ParameterSlider = ({
  accessibilityLabel,
  centerLabel,
  formatValue,
  max,
  maxLabel,
  min,
  minLabel,
  neutralValue,
  onChange,
  step,
  value,
}: {
  accessibilityLabel: string
  centerLabel: string
  formatValue: (value: number) => string
  max: number
  maxLabel: string
  min: number
  minLabel: string
  neutralValue: number
  onChange: (value: number) => void
  step: number
  value: number
}) => {
  const [trackWidth, setTrackWidth] = useState(1)
  const progress = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const neutralProgress = Math.max(0, Math.min(1, (neutralValue - min) / (max - min)))
  const thumbSize = 28

  const updateFromEvent = (event: GestureResponderEvent) => {
    const nextProgress = Math.max(0, Math.min(1, event.nativeEvent.locationX / trackWidth))
    onChange(min + nextProgress * (max - min))
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(Math.max(event.nativeEvent.layout.width, 1))
  }

  const adjust = (direction: -1 | 1) => {
    onChange(Math.max(min, Math.min(max, value + direction * step)))
  }

  return (
    <VStack gap={12}>
      <Box center>
        <Pressable onPress={() => onChange(neutralValue)}>
          <Box px={12} py={6} borderRadius={12} bg="lightGrey">
            <Text title fontSize={18}>
              {formatValue(value)}
            </Text>
          </Box>
        </Pressable>
      </Box>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min,
          max,
          now: value,
          text: formatValue(value),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event =>
          adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={updateFromEvent}
        onResponderMove={updateFromEvent}
        style={{ height: 44, justifyContent: 'center' }}
      >
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: '#DDE3F2',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: `${Math.min(progress, neutralProgress) * 100}%`,
              width: `${Math.abs(progress - neutralProgress) * 100}%`,
              height: '100%',
              backgroundColor: '#5B82EF',
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: progress * (trackWidth - thumbSize),
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: '#FFFFFF',
            borderWidth: 3,
            borderColor: '#5B82EF',
            shadowColor: '#20386F',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          }}
        />
      </View>

      <HStack justifyContent="space-between">
        <Text color="grey" fontSize={10}>
          {minLabel}
        </Text>
        <Text color="grey" fontSize={10}>
          {centerLabel}
        </Text>
        <Text color="grey" fontSize={10}>
          {maxLabel}
        </Text>
      </HStack>
    </VStack>
  )
}

const AvatarPlayground = ({ onClose }: AvatarPlaygroundProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ variant?: string }>()
  const router = useRouter()
  const initialVariant = VARIANTS.some(item => item.id === params.variant)
    ? (params.variant as AvatarVariant)
    : 'orb'
  const [variant, setVariant] = useState<AvatarVariant>(initialVariant)
  const [gaze, setGaze] = useState<AvatarGaze>({ x: 0, y: 0 })
  const [expression, setExpression] = useState(0)
  const [eyeScale, setEyeScale] = useState(1)
  const [turn, setTurn] = useState(0)
  const [autoBlink, setAutoBlink] = useState(true)
  const [blinkKey, setBlinkKey] = useState(0)
  const stageWidth = Math.min(Math.max(width - 40, 1), 720)
  const stageHeight = Math.min(225, Math.max(195, width * 0.52))

  const setAndShareVariant = (nextVariant: AvatarVariant) => {
    setVariant(nextVariant)
    router.setParams({ variant: nextVariant })
  }

  const cycleVariant = (direction: -1 | 1) => {
    const index = VARIANTS.findIndex(item => item.id === variant)
    const nextIndex = (index + direction + VARIANTS.length) % VARIANTS.length
    setAndShareVariant(VARIANTS[nextIndex].id)
  }

  useEffect(() => {
    if (Platform.OS !== 'web') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') cycleVariant(-1)
      if (event.key === 'ArrowRight') cycleVariant(1)
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  })

  const updateGazeFromTouch = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent
    setGaze({
      x: clamp((locationX / stageWidth) * 2 - 1),
      y: clamp((locationY / stageHeight) * 2 - 1),
    })
  }

  const reset = () => {
    setGaze({ x: 0, y: 0 })
    setExpression(0)
    setEyeScale(1)
    setTurn(0)
    setAutoBlink(true)
  }

  return (
    <Box flex bg="lightGrey">
      <VStack
        alignSelf="center"
        width={stageWidth}
        maxWidth="100%"
        pt={Math.max(insets.top, 14)}
        pb={12}
        gap={10}
      >
        <HStack alignItems="center" gap={12}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Retour')} onPress={onClose}>
            <Box
              size={40}
              borderRadius={14}
              bg="reverse"
              borderColor="border"
              borderWidth={1}
              center
            >
              <Feather name="arrow-left" size={20} color={theme.colors.default} />
            </Box>
          </Pressable>
          <VStack flex gap={1}>
            <Text color="primary" fontSize={9} bold textTransform="uppercase">
              {t('playground.avatar.eyebrow')}
            </Text>
            <Text title fontSize={21} lineHeight={25}>
              {t('playground.avatar.title')}
            </Text>
          </VStack>
        </HStack>

        <Text color="grey" fontSize={12} lineHeight={17} numberOfLines={2}>
          {t('playground.avatar.description')}
        </Text>

        <View
          accessible
          accessibilityLabel={t('playground.avatar.gazeStage')}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={updateGazeFromTouch}
          onResponderMove={updateGazeFromTouch}
          style={{
            width: '100%',
            height: stageHeight,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: variant === 'pebble' ? '#111B4D' : theme.colors.reverse,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          <Box
            position="absolute"
            top={9}
            px={11}
            py={5}
            bg="lightGrey"
            borderRadius={20}
            opacity={0.82}
          >
            <Text color="grey" fontSize={10} bold>
              {t('playground.avatar.dragHint')}
            </Text>
          </Box>
          <BibleStrongAvatar
            autoBlink={autoBlink}
            blinkKey={blinkKey}
            expression={expression}
            eyeScale={eyeScale}
            gaze={gaze}
            size={Math.min(145, stageWidth * 0.39)}
            turn={turn}
            variant={variant}
          />
          <HStack position="absolute" bottom={9} gap={7}>
            <Box size={7} borderRadius={4} backgroundColor="#42C6E8" />
            <Text color={variant === 'pebble' ? '#DDE5FF' : 'grey'} fontSize={10} bold>
              Expression SVG {expression.toString().padStart(2, '0')}
            </Text>
          </HStack>
        </View>
      </VStack>

      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 24) + 104,
        }}
        showsVerticalScrollIndicator={false}
      >
        <VStack width={stageWidth} maxWidth="100%" gap={14}>
          <ControlSection
            title={t('playground.avatar.gazeTitle')}
            description="Les axes horizontal et vertical sont indépendants. Touchez une valeur pour recentrer uniquement cet axe."
          >
            <VStack gap={18}>
              <VStack gap={6}>
                <Text bold fontSize={12}>
                  Horizontal
                </Text>
                <ParameterSlider
                  accessibilityLabel="Direction horizontale du regard"
                  centerLabel="Centre"
                  formatValue={value => `${value > 0 ? '+' : ''}${value.toFixed(2)}`}
                  min={-1}
                  minLabel="Gauche"
                  max={1}
                  maxLabel="Droite"
                  neutralValue={0}
                  step={0.05}
                  value={gaze.x}
                  onChange={x => setGaze(current => ({ ...current, x }))}
                />
              </VStack>
              <VStack gap={6}>
                <Text bold fontSize={12}>
                  Vertical
                </Text>
                <ParameterSlider
                  accessibilityLabel="Direction verticale du regard"
                  centerLabel="Centre"
                  formatValue={value => `${value > 0 ? '+' : ''}${value.toFixed(2)}`}
                  min={-1}
                  minLabel="Haut"
                  max={1}
                  maxLabel="Bas"
                  neutralValue={0}
                  step={0.05}
                  value={gaze.y}
                  onChange={y => setGaze(current => ({ ...current, y }))}
                />
              </VStack>
            </VStack>
          </ControlSection>

          <ControlSection
            title="Les 25 expressions originales"
            description="Chaque numéro est une paire de chemins à 48 points. Le passage d’un numéro à l’autre est interpolé point par point avec un ressort."
          >
            <HStack gap={7} wrap>
              {Array.from({ length: 25 }, (_, index) => (
                <Pressable key={index} onPress={() => setExpression(index)}>
                  <Box
                    size={46}
                    borderRadius={13}
                    bg={expression === index ? 'primary' : 'lightGrey'}
                    borderColor={expression === index ? 'primary' : 'border'}
                    borderWidth={1}
                    center
                  >
                    <Text color={expression === index ? 'reverse' : 'default'} fontSize={12} bold>
                      {index.toString().padStart(2, '0')}
                    </Text>
                  </Box>
                </Pressable>
              ))}
            </HStack>
          </ControlSection>

          <ControlSection
            title="Taille des yeux"
            description="La taille reste indépendante de la rotation, qui compresse automatiquement l’œil contournant la sphère."
          >
            <ParameterSlider
              accessibilityLabel="Taille des yeux"
              centerLabel="Source"
              formatValue={value => `${value.toFixed(2)}×`}
              min={0.2}
              minLabel="0,2×"
              max={2}
              maxLabel="2×"
              neutralValue={1}
              step={0.05}
              value={eyeScale}
              onChange={setEyeScale}
            />
          </ControlSection>

          <ControlSection
            title="Rotation de la tête"
            description="L’angle pilote directement la position et la compression sphérique des yeux. Touchez la valeur pour revenir à 0°."
          >
            <ParameterSlider
              accessibilityLabel="Rotation de la tête"
              centerLabel="Face"
              formatValue={value => {
                const degrees = (value * 180) / Math.PI
                return `${degrees > 0 ? '+' : ''}${Math.round(degrees)}°`
              }}
              min={-Math.PI / 2}
              minLabel="−90°"
              max={Math.PI / 2}
              maxLabel="+90°"
              neutralValue={0}
              step={(5 * Math.PI) / 180}
              value={turn}
              onChange={setTurn}
            />
          </ControlSection>

          <ControlSection title={t('playground.avatar.motionTitle')}>
            <HStack alignItems="center" justifyContent="space-between">
              <VStack flex gap={2}>
                <Text bold fontSize={14}>
                  {t('playground.avatar.autoBlink')}
                </Text>
                <Text color="grey" fontSize={11}>
                  {t('playground.avatar.autoBlinkDescription')}
                </Text>
              </VStack>
              <Switch value={autoBlink} onValueChange={setAutoBlink} />
            </HStack>
            <HStack gap={8}>
              <Pressable style={{ flex: 1 }} onPress={() => setBlinkKey(value => value + 1)}>
                <Box bg="primary" borderRadius={14} py={12} center>
                  <Text color="reverse" fontSize={13} bold>
                    {t('playground.avatar.blinkNow')}
                  </Text>
                </Box>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={reset}>
                <Box
                  bg="lightGrey"
                  borderColor="border"
                  borderWidth={1}
                  borderRadius={14}
                  py={12}
                  center
                >
                  <Text fontSize={13} bold>
                    {t('playground.avatar.reset')}
                  </Text>
                </Box>
              </Pressable>
            </HStack>
          </ControlSection>

          <ControlSection
            title={t('playground.avatar.stateTitle')}
            description={t('playground.avatar.stateDescription')}
          >
            <Box backgroundColor="#10172E" borderRadius={15} p={14}>
              <Text color="#DCE5FF" fontSize={12} lineHeight={19}>
                {`<BibleStrongAvatar\n  variant="${variant}"\n  expression={${expression}}\n  gaze={{ x: ${gaze.x.toFixed(2)}, y: ${gaze.y.toFixed(2)} }}\n  turn={${turn.toFixed(3)}} // radians\n  eyeScale={${eyeScale}}\n  autoBlink={${autoBlink}}\n/>`}
              </Text>
            </Box>
          </ControlSection>
        </VStack>
      </ScrollView>

      <HStack
        position="absolute"
        bottom={Math.max(insets.bottom, 14)}
        alignSelf="center"
        bg="default"
        borderRadius={24}
        p={5}
        gap={4}
        shadow={{
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Pressable
          accessibilityLabel={t('playground.avatar.previousVariant')}
          onPress={() => cycleVariant(-1)}
        >
          <Box size={40} center>
            <Feather name="arrow-left" size={18} color="#FFFFFF" />
          </Box>
        </Pressable>
        {VARIANTS.map(item => {
          const selected = item.id === variant
          return (
            <Pressable key={item.id} onPress={() => setAndShareVariant(item.id)}>
              <Box
                px={selected ? 15 : 10}
                height={40}
                borderRadius={20}
                bg={selected ? 'primary' : 'default'}
                center
              >
                <Text color="reverse" fontSize={12} bold opacity={selected ? 1 : 0.62}>
                  {item.label}
                </Text>
              </Box>
            </Pressable>
          )
        })}
        <Pressable
          accessibilityLabel={t('playground.avatar.nextVariant')}
          onPress={() => cycleVariant(1)}
        >
          <Box size={40} center>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Box>
        </Pressable>
      </HStack>
    </Box>
  )
}

export default AvatarPlayground
