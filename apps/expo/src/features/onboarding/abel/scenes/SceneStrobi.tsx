import { colorWithOpacity } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Feather } from '@expo/vector-icons'
import type { TFunction } from 'i18next'
import Box, { HStack, VStack } from '~common/ui/Box'
import { floatingShadow } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import type { OnboardingStageMetrics } from '../OnboardingStage'
import SceneBackgroundShape from '../SceneBackgroundShape'
import { Scene } from '../SceneGraph'

/**
 * Where the scene is: the question waits, Strobi thinks, Strobi has answered, then the reader has
 * asked to try it.
 */
export type StrobiScenePhase = 'question' | 'thinking' | 'answer' | 'accepted'

/** Strobi's place in this scene, and what its next action is. */
export const STROBI_SCENE_PLACEMENT = { x: 175, y: 92, size: 136 }
export const STROBI_SCENE_QUESTION_CENTER = { x: 175, y: 208 }
export const STROBI_SCENE_OFFER_CENTER = { x: 124, y: 426 }
export const STROBI_SCENE_CONFIRMATION_CENTER = { x: 175, y: 432 }

type QuestionBubbleProps = {
  asked: boolean
  metrics: OnboardingStageMetrics
  t: TFunction
}

const QuestionBubble = ({ asked, metrics, t }: QuestionBubbleProps) => {
  const theme = useStylingTheme()
  const s = metrics.s
  return (
    <HStack
      className="border-continuous overflow-visible flex-[1] items-center"
      style={{
        gap: s(8),
        paddingHorizontal: s(14),
        borderRadius: s(18),
        backgroundColor: asked ? theme.colors.primary : theme.colors.reverse,
        ...floatingShadow,
      }}
    >
      <Text
        className={asked ? 'text-[#FFFFFF] flex-[1]' : 'text-default flex-[1]'}
        style={{ fontSize: s(13) || 16, lineHeight: s(17) || 20 }}
      >
        {t('onboarding.abel.sceneStrobi.question')}
      </Text>
      {!asked && (
        <Box
          className="overflow-hidden border-continuous items-center justify-center bg-primary"
          style={{ width: s(28), height: s(28), borderRadius: s(14) }}
        >
          <Feather name="arrow-up" size={s(15) || 16} color="#FFFFFF" />
        </Box>
      )}
    </HStack>
  )
}

const AnswerCard = ({ metrics, t }: { metrics: OnboardingStageMetrics; t: TFunction }) => {
  const theme = useStylingTheme()
  const s = metrics.s
  return (
    <VStack
      className="border-continuous overflow-visible flex-[1]"
      style={{
        gap: s(8),
        paddingVertical: s(14),
        paddingHorizontal: s(16),
        borderRadius: s(14),
        backgroundColor: theme.colors.reverse,
        ...floatingShadow,
      }}
    >
      <HStack className="overflow-hidden border-continuous items-center" style={{ gap: s(6) }}>
        <Text className="text-[#FF6B6B]" style={{ fontSize: s(12) || 14 }}>
          ✦
        </Text>
        <Text className="text-link font-bold" style={{ fontSize: s(9) || 12, letterSpacing: s(1) }}>
          {t('onboarding.abel.sceneStrobi.answerLabel').toUpperCase()}
        </Text>
      </HStack>
      <Text
        className="text-default"
        style={{ fontSize: s(13) || 15, lineHeight: s(19) || 22, fontFamily: 'Literata Book' }}
      >
        {t('onboarding.abel.sceneStrobi.answer')}
      </Text>
    </VStack>
  )
}

/**
 * A pill of the offer to try Strobi. Its press belongs to its scene node, as for every action of
 * the scenes.
 */
const OfferPill = ({
  label,
  primary,
  metrics,
}: {
  label: string
  primary: boolean
  metrics: OnboardingStageMetrics
}) => {
  const theme = useStylingTheme()
  const s = metrics.s
  return (
    <Box
      className="overflow-hidden border-continuous flex-[1] items-center justify-center"
      style={{
        borderRadius: s(18),
        backgroundColor: primary
          ? theme.colors.primary
          : colorWithOpacity(theme.colors.primary, 0.1),
      }}
    >
      <Text
        className={primary ? 'text-[#FFFFFF] font-bold' : 'text-link font-bold'}
        style={{ fontSize: s(12) || 14 }}
      >
        {label}
      </Text>
    </Box>
  )
}

/** What follows the reader's wish to try Strobi, said before the end of the onboarding. */
const Confirmation = ({ metrics, t }: { metrics: OnboardingStageMetrics; t: TFunction }) => {
  const theme = useStylingTheme()
  const s = metrics.s
  return (
    <HStack
      className="border-continuous overflow-hidden flex-[1] items-center"
      style={{
        gap: s(10),
        paddingHorizontal: s(14),
        borderRadius: s(16),
        backgroundColor: colorWithOpacity(theme.colors.primary, 0.1),
      }}
    >
      <Box
        className="overflow-hidden border-continuous items-center justify-center bg-primary"
        style={{ width: s(26), height: s(26), borderRadius: s(13) }}
      >
        <Feather name="check" size={s(15) || 16} color="#FFFFFF" />
      </Box>
      <Text
        className="text-default flex-[1]"
        style={{ fontSize: s(12) || 14, lineHeight: s(16) || 18 }}
      >
        {t('onboarding.abel.sceneStrobi.accepted')}
      </Text>
    </HStack>
  )
}

type SceneStrobiProps = {
  metrics: OnboardingStageMetrics
  phase: StrobiScenePhase
  reduceMotion: boolean
  onAsk: () => void
  onTry: () => void
  onLater: () => void
  t: TFunction
}

/**
 * The scene that presents Strobi, the study assistant: the reader asks it a question about the
 * word they have just followed through the Bible, and Strobi answers. The answer is written in
 * advance: nothing is sent anywhere during the onboarding.
 */
export const createSceneStrobi = ({
  metrics,
  phase,
  reduceMotion,
  onAsk,
  onTry,
  onLater,
  t,
}: SceneStrobiProps) => (
  <Scene id="scene-strobi">
    <Scene.Node
      id="scene-background"
      layout="resize"
      frame={{ x: 25, y: 0, width: 300, height: 300, opacity: 0.6, zIndex: 0 }}
      pointerEvents="none"
    >
      <SceneBackgroundShape borderRadius={metrics.s(150)} reduceMotion={reduceMotion} />
    </Scene.Node>

    <Scene.Node
      id="strobi-question"
      contentKey={phase === 'question' ? 'waiting' : 'asked'}
      frame={{
        x: phase === 'question' ? 22 : 64,
        y: STROBI_SCENE_QUESTION_CENTER.y - 24,
        width: phase === 'question' ? 306 : 264,
        height: 48,
        zIndex: 8,
      }}
      layout="resize"
      enterDelay={500}
      enterFrom={{ y: 16, scale: 0.9 }}
      onPress={phase === 'question' ? onAsk : undefined}
      pressScale={0.97}
      accessibilityLabel={t('onboarding.abel.sceneStrobi.question')}
    >
      <QuestionBubble asked={phase !== 'question'} metrics={metrics} t={t} />
    </Scene.Node>

    {(phase === 'answer' || phase === 'accepted') && (
      <Scene.Node
        id="strobi-answer"
        frame={{ x: 18, y: 250, width: 314, height: 140, rotation: -1, zIndex: 7 }}
        enterFrom={{ y: 20, scale: 0.92 }}
      >
        <AnswerCard metrics={metrics} t={t} />
      </Scene.Node>
    )}

    {phase === 'answer' && (
      <Scene.Node
        id="strobi-try"
        frame={{ x: 56, y: 408, width: 136, height: 36, zIndex: 9 }}
        enterDelay={650}
        enterFrom={{ y: 10, scale: 0.9 }}
        onPress={onTry}
        pressScale={0.95}
        accessibilityLabel={t('onboarding.abel.sceneStrobi.try')}
      >
        <OfferPill label={t('onboarding.abel.sceneStrobi.try')} primary metrics={metrics} />
      </Scene.Node>
    )}

    {phase === 'answer' && (
      <Scene.Node
        id="strobi-later"
        frame={{ x: 204, y: 408, width: 90, height: 36, zIndex: 9 }}
        enterDelay={700}
        enterFrom={{ y: 10, scale: 0.9 }}
        onPress={onLater}
        pressScale={0.95}
        accessibilityLabel={t('onboarding.abel.sceneStrobi.later')}
      >
        <OfferPill
          label={t('onboarding.abel.sceneStrobi.later')}
          primary={false}
          metrics={metrics}
        />
      </Scene.Node>
    )}

    {phase === 'accepted' && (
      <Scene.Node
        id="strobi-confirmation"
        frame={{
          x: 18,
          y: STROBI_SCENE_CONFIRMATION_CENTER.y - 30,
          width: 314,
          height: 60,
          zIndex: 9,
        }}
        enterFrom={{ y: 10, scale: 0.94 }}
        accessibilityLabel={t('onboarding.abel.sceneStrobi.accepted')}
      >
        <Confirmation metrics={metrics} t={t} />
      </Scene.Node>
    )}
  </Scene>
)

export default createSceneStrobi
