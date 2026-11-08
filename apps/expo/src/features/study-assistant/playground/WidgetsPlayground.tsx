import { useState, type ReactNode } from 'react'
import type { StudyWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Header from '~common/Header'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import AssistantMessageMarkdown from '../AssistantMessageMarkdown'
import { AssistantSheetContext, type AssistantSheet } from '../assistantSheetContext'
import PassageWidget from '../widgets/PassageWidget'
import StudyWidget from '../widgets/StudyWidget'
import { messageSegments } from '../widgetSegments'
import { useDemoAssistant } from './demoAssistant'

const passage = (book: number, chapter: number, start: number, end = start, version = 'LSG') => ({
  book,
  chapter,
  start,
  end,
  version,
})
const card = (id: string) => `https://bible-strong.app/assistant-widget/${id}`

type Demo = { question: string; answer: string; widgets: Descriptor[] }

/** Answers as the assistant writes them, with their cards placed in the text (ADR-0101, ADR-0108). */
const DEMOS: Demo[] = [
  {
    question: 'Que dit la Bible à quelqu’un qui est rongé par l’anxiété ?',
    answer: `La Bible ne traite pas l’anxiété comme une faute à corriger, mais comme un poids à déposer.

[Philippiens 4:6-7](${card('w4')})

Paul ne dit pas « ne ressentez rien », mais « ne portez pas cela seul » : la demande est nommée, portée à Dieu, accompagnée d’actions de grâces. Le *Commentaire de Barnes* note que le verbe traduit par « gardera » est un terme militaire.

[1 Pierre 5:7](${card('w5')})

Jésus, lui, raisonne à hauteur de vie quotidienne : les oiseaux, les lis, le Père qui sait.

[Matthieu 6:25-34](${card('w6')})

Si l’angoisse persiste, ce n’est pas un manque de foi : en parler à un médecin ou à un pasteur fait partie du soin.`,
    widgets: [
      { id: 'w4', kind: 'passages', title: 'Philippiens 4:6-7', passages: [passage(50, 4, 6, 7)] },
      { id: 'w5', kind: 'passages', title: '1 Pierre 5:7', passages: [passage(60, 5, 7)] },
      { id: 'w6', kind: 'passages', title: 'Matthieu 6:25-34', passages: [passage(40, 6, 25, 34)] },
    ],
  },
  {
    question: 'Montre-moi des versets sur la patience.',
    answer: `Voici des textes qui parlent de la patience, de Dieu et des croyants.

[Versets sur la patience](${card('w1')})

La patience y est d’abord celle de Dieu envers nous, puis un fruit de l’Esprit chez le croyant.`,
    widgets: [
      {
        id: 'w1',
        kind: 'passages',
        title: 'Versets sur la patience',
        passages: [
          passage(48, 5, 22),
          passage(59, 1, 3, 4),
          passage(45, 12, 12),
          passage(61, 3, 9),
          passage(21, 7, 8),
        ],
      },
    ],
  },
]

const demoSheet = (navigate: AssistantSheet['navigate']) =>
  // The demo only follows links and opens passages: no conversation runs here.
  ({ navigate, showSource: () => {} }) as unknown as AssistantSheet

function DemoAnswer({ demo, before }: { demo: Demo; before: boolean }) {
  const ids = new Set(demo.widgets.map(widget => widget.id))
  return (
    <Box className="mb-8">
      <Box className="bg-light-grey mb-4 self-end rounded-[16px] px-4 py-2">
        <Text className="text-[15px]">{demo.question}</Text>
      </Box>
      {messageSegments(demo.answer, ids).map((segment, index) => {
        if (segment.type === 'markdown')
          return (
            <AssistantMessageMarkdown
              key={index}
              text={segment.text}
              streaming={false}
              sources={[]}
              widgets={demo.widgets}
            />
          )
        const widget = demo.widgets.find(item => item.id === segment.id)!
        return before && 'passages' in widget ? (
          <PassageWidget key={index} widget={widget} />
        ) : (
          <StudyWidget key={index} widget={widget} />
        )
      })}
    </Box>
  )
}

function Toggle({
  value,
  onChange,
  children,
}: {
  value: boolean
  onChange: () => void
  children: ReactNode
}) {
  return (
    <TouchableBox
      accessibilityRole="button"
      accessibilityState={{ selected: value }}
      onPress={onChange}
      className={`rounded-full px-4 py-[6px] ${value ? 'bg-primary' : 'bg-light-grey'}`}
    >
      <Text className={`text-[14px] ${value ? 'text-reverse' : ''}`}>{children}</Text>
    </TouchableBox>
  )
}

/** Development only: the assistant's cards inside real-looking answers, before and after. */
export default function WidgetsPlayground() {
  const navigate = usePushRouteOnce()
  const [before, setBefore] = useState(false)
  const assistant = useDemoAssistant(DEMOS)
  return (
    <AssistantSheetContext.Provider value={demoSheet(navigate)}>
      <Container className="bg-reverse">
        <Header hasBackButton title="Cartes de l’assistant" />
        <HStack className="gap-2 px-5 pb-2">
          <Toggle value={before} onChange={() => setBefore(true)}>
            Avant
          </Toggle>
          <Toggle value={!before} onChange={() => setBefore(false)}>
            Après
          </Toggle>
          {assistant.available && (
            <Toggle value={false} onChange={assistant.open}>
              Dans l’assistant
            </Toggle>
          )}
        </HStack>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}>
          {DEMOS.map(demo => (
            <DemoAnswer key={demo.question} demo={demo} before={before} />
          ))}
        </ScrollView>
      </Container>
    </AssistantSheetContext.Provider>
  )
}
