import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { StudySource, StudyWidget as Descriptor } from '@bible-strong/ai-contract/contract'
import Header from '~common/Header'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import AssistantMessageMarkdown from '../AssistantMessageMarkdown'
import { AssistantSheetContext, type AssistantSheet } from '../assistantSheetContext'
import StudyWidget from '../widgets/StudyWidget'
import SourceExcerptSheet from '../SourceExcerptSheet'
import { messageSegments } from '../widgetSegments'
import { resolveExample } from './resolveExample'
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

const fr = { language: 'fr' as const }

/** Answers that place the resource cards. */
const RESOURCE_DEMOS: Demo[] = [
  {
    question: 'Que disent les commentateurs de Jean 15:4 ?',
    answer: `« Demeurez en moi » est au cœur de l’image de la vigne. Deux commentateurs s’y arrêtent :

[Clarke et Barnes sur Jean 15:4](${card('w2')})

Tous deux lisent « demeurer » comme une relation qui dure, entretenue chaque jour, plutôt qu’un état acquis une fois pour toutes.`,
    widgets: [
      {
        id: 'w2',
        ...fr,
        kind: 'commentary_comparison',
        title: 'Jean 15:4 · Clarke et Barnes',
        sources: [],
      },
    ],
  },
  {
    question: 'Que veut dire le mot grec μένω ?',
    answer: `C’est le verbe que Jean emploie pour « demeurer ».

[Le mot μένω](${card('w1')})

Il revient plus de quarante fois dans l’Évangile de Jean, souvent pour parler de la relation entre le Père, le Fils et les disciples.`,
    widgets: [
      {
        id: 'w1',
        ...fr,
        kind: 'strong_entry',
        title: 'G3306 · μένω',
        reference: 'G3306',
        identityKind: 'strong',
        scope: 'precise_identity',
      },
    ],
  },
  {
    question: 'Que dit la Bible de la patience ?',
    answer: `Les dictionnaires bibliques distinguent la patience envers les épreuves et la patience envers les personnes.

[Patience dans deux dictionnaires](${card('w3')})

Le thème de Nave rassemble les textes qui en parlent :

[La patience selon Nave](${card('w4')})`,
    widgets: [
      {
        id: 'w3',
        ...fr,
        kind: 'dictionary_articles',
        title: 'Patience · deux dictionnaires',
        sources: [],
      },
      { id: 'w4', ...fr, kind: 'nave_topic', title: 'Patience', topic: 'patience' },
    ],
  },
  {
    question: 'Qui était Adam, et où se trouve Jéricho ?',
    answer: `Adam est le premier homme du récit de la création.

[Adam](${card('w5')})

Jéricho, elle, est l’une des plus anciennes villes connues, dans la vallée du Jourdain.

[Jéricho](${card('w6')})`,
    widgets: [
      { id: 'w5', ...fr, kind: 'person_profile', title: 'Adam', entityKey: 'Adam@Gen.2.19-Jud' },
      {
        id: 'w6',
        ...fr,
        kind: 'place_profile',
        title: 'Jéricho',
        entityKey: 'Jericho@Num.22.1-Heb',
      },
    ],
  },
  {
    question: 'Quelles sont les grandes étapes de la vie de Jésus ?',
    answer: `De la naissance à Bethléem à la résurrection, les évangiles suivent un fil que la frise permet de situer :

[De la naissance à la résurrection](${card('w1')})

Les dates restent approximatives : les évangiles ne datent pas les événements comme le ferait une chronique.`,
    widgets: [
      {
        id: 'w1',
        ...fr,
        kind: 'event_timeline',
        title: 'De la naissance à la résurrection',
        events: ['incarnation-of-jesus', 'the-resurrection'],
      },
    ],
  },
]

/** A demo card: commentaries and dictionaries first read their real excerpts. */
function DemoCard({ widget }: { widget: Descriptor }) {
  const resources = useResourceAccess()
  const needsSources =
    widget.kind === 'commentary_comparison' || widget.kind === 'dictionary_articles'
  const query = useQuery({
    queryKey: ['assistant-demo-card', widget.kind, widget.id],
    queryFn: () => resolveExample(widget, resources),
    enabled: needsSources,
    staleTime: Infinity,
  })
  const resolved = needsSources ? query.data : widget
  if (!resolved) return <Text className="text-grey my-2 text-[13px]">Chargement des extraits…</Text>
  return <StudyWidget widget={resolved} />
}

const demoSheet = (
  navigate: AssistantSheet['navigate'],
  showSource: AssistantSheet['showSource']
) =>
  // The demo only follows links, opens passages and shows excerpts: no conversation runs here.
  ({ navigate, showSource }) as unknown as AssistantSheet

function DemoAnswer({ demo }: { demo: Demo }) {
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
        return <DemoCard key={index} widget={widget} />
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

/** Development only: the assistant's cards inside real-looking answers, and in the real assistant page. */
export default function WidgetsPlayground() {
  const navigate = usePushRouteOnce()
  const [source, setSource] = useState<StudySource | null>(null)
  const assistant = useDemoAssistant(DEMOS)
  return (
    <AssistantSheetContext.Provider value={demoSheet(navigate, setSource)}>
      <Container className="bg-reverse">
        <Header hasBackButton title="Cartes de l’assistant" />
        <HStack className="gap-2 px-5 pb-2">
          {assistant.available && (
            <Toggle value={false} onChange={assistant.open}>
              Ouvrir dans l’assistant
            </Toggle>
          )}
        </HStack>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }}>
          {[...RESOURCE_DEMOS, ...DEMOS].map(demo => (
            <DemoAnswer key={demo.question} demo={demo} />
          ))}
        </ScrollView>
        <SourceExcerptSheet source={source} onClose={() => setSource(null)} />
      </Container>
    </AssistantSheetContext.Provider>
  )
}
