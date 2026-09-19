import GlooDescription from './GlooDescription.web'
import { useRef, useState, type CSSProperties } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  RotateCcw,
  Search,
  Sun,
  Moon,
  PanelRight,
  Maximize2,
  FlaskConical,
} from 'lucide-react'
import themes from '~themes'
import { ThemeProvider, useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { useResourceAccess } from '~features/resources/resourceAccess'
import StudyWidget from '../widgets/StudyWidget.web'
import { resolveWidgetStory, widgetExamples, widgetStories } from './catalog'
import { resolveExample } from './resolveExample.web'
import './playground.css'

function PlaygroundContent({ dark, onTheme }: { dark: boolean; onTheme: () => void }) {
  const router = useRouter()
  const detail = useRef<HTMLElement>(null)
  const { widget: selectedId, state: selectedStateId } = useLocalSearchParams<{
    widget?: string
    state?: string
  }>()
  const {
    story: selectedStory,
    state: selectedState,
    example: selected,
  } = resolveWidgetStory(selectedId === 'comparison' ? 'passages' : selectedId, selectedStateId)
  const [search, setSearch] = useState('')
  const [wide, setWide] = useState(false)
  const [reset, setReset] = useState(0)
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState(false)
  const { colors, fontFamily } = useTheme()
  const resources = useResourceAccess()
  const query = useQuery({
    queryKey: ['widget-playground', selected.id],
    queryFn: () => resolveExample(selected.widget, resources),
    staleTime: 300000,
    retry: false,
  })
  const normalized = search
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const filtered = widgetStories.filter(story =>
    `${story.title} ${story.category} ${story.description} ${story.states
      .map(state => widgetExamples.find(example => example.id === state.exampleId)?.title || '')
      .join(' ')}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(normalized)
  )
  const categories = [...new Set(filtered.map(story => story.category))]
  const index = widgetStories.indexOf(selectedStory)
  const chooseStory = (id: string) => {
    const story = widgetStories.find(item => item.id === id) || widgetStories[0]
    router.setParams({ widget: story.id, state: story.states[0].exampleId })
    detail.current?.scrollIntoView({ block: 'start' })
    setCopied('')
    setCopyError(false)
  }
  const chooseState = (exampleId: string) => {
    router.setParams({ widget: selectedStory.id, state: exampleId })
    setCopied('')
    setCopyError(false)
  }
  const style = {
    fontFamily: resolveFontFamily(fontFamily.text),
    '--pg-bg': colors.reverse,
    '--pg-soft': colors.lightGrey,
    '--pg-text': colors.default,
    '--pg-muted': colors.grey,
    '--pg-line': colors.border,
    '--pg-accent': colors.primary,
  } as CSSProperties
  return (
    <main className="ai-playground" style={style}>
      <header className="ai-pg-top">
        <a href="/playground">
          <ArrowLeft size={16} /> Playground
        </a>
        <span>
          <FlaskConical size={16} /> Bible Strong · Atelier IA
        </span>
        <button
          onClick={onTheme}
          aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>
      <div className="ai-pg-layout">
        <aside className="ai-pg-catalog">
          <div className="ai-pg-intro">
            <span className="ai-pg-eyebrow">BIBLIOTHÈQUE INTERACTIVE</span>
            <h1>
              Les widgets <br />
              de l’assistant<span>.</span>
            </h1>
            <p>{widgetStories.length} composants, avec leurs différents états interactifs.</p>
          </div>
          <label className="ai-pg-search">
            <Search size={16} />
            <input
              aria-label="Rechercher un widget"
              placeholder="Chercher un widget…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <small>{filtered.length}</small>
          </label>
          <nav aria-label="Catalogue des widgets">
            {categories.map(category => (
              <section key={category}>
                <h2>{category}</h2>
                {filtered
                  .filter(story => story.category === category)
                  .map(story => (
                    <button
                      key={story.id}
                      aria-current={selectedStory.id === story.id ? 'page' : undefined}
                      onClick={() => chooseStory(story.id)}
                    >
                      <span>{String(widgetStories.indexOf(story) + 1).padStart(2, '0')}</span>
                      <span className="ai-pg-story-name">{story.title}</span>
                      {story.states.length > 1 && <small>{story.states.length} états</small>}
                      {story.id === selectedStory.id && <ArrowRight size={14} />}
                    </button>
                  ))}
              </section>
            ))}
            {!filtered.length && (
              <p className="ai-pg-muted">Aucun widget ne correspond à cette recherche.</p>
            )}
          </nav>
        </aside>
        <section ref={detail} className="ai-pg-detail" aria-label={selectedStory.title}>
          <div className="ai-pg-detail-heading">
            <div>
              <span className="ai-pg-eyebrow">
                {selectedStory.category} / {String(index + 1).padStart(2, '0')}
              </span>
              <h2>{selectedStory.title}</h2>
              <p>{selectedStory.description}</p>
            </div>
            <span className="ai-pg-live">
              <span /> Vrai composant
            </span>
          </div>
          <div className="ai-pg-state-picker">
            <div>
              <span className="ai-pg-eyebrow">ÉTATS DU WIDGET</span>
              <small>{`${selectedStory.states.length} ${
                selectedStory.states.length > 1 ? 'états' : 'état'
              }`}</small>
            </div>
            <div role="tablist" aria-label={`États de ${selectedStory.title}`}>
              {selectedStory.states.map(state => (
                <button
                  key={state.exampleId}
                  type="button"
                  role="tab"
                  aria-selected={state.exampleId === selectedState.exampleId}
                  onClick={() => chooseState(state.exampleId)}
                >
                  {state.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ai-pg-state-description">
            <span>{selected.title}</span>
            <p>{selected.description}</p>
          </div>
          <div className="ai-pg-toolbar">
            <div role="group" aria-label="Largeur de l’aperçu">
              <button aria-pressed={!wide} onClick={() => setWide(false)}>
                <PanelRight size={15} /> Conversation
              </button>
              <button aria-pressed={wide} onClick={() => setWide(true)}>
                <Maximize2 size={15} /> Large
              </button>
            </div>
            <button
              onClick={() => {
                setReset(n => n + 1)
                void query.refetch()
              }}
            >
              <RotateCcw size={14} /> Réinitialiser
            </button>
          </div>
          <div className="ai-pg-stage">
            <div className={`ai-pg-preview ${wide ? 'ai-pg-preview-wide' : ''}`}>
              <div className="ai-pg-preview-caption">
                <span>ASSISTANT BIBLE STRONG</span>
                <span>{wide ? 'Vue de travail' : 'Format conversation'}</span>
              </div>
              {query.isPending ? (
                <div className="ai-pg-status" role="status">
                  Chargement de l’exemple…
                </div>
              ) : query.isError ? (
                <div className="ai-pg-status" role="alert">
                  <strong>Ressource indisponible</strong>
                  <p>
                    Impossible de charger cet exemple pour le moment. Aucun contenu de remplacement
                    n’est inventé.
                  </p>
                  <button onClick={() => void query.refetch()}>Réessayer</button>
                </div>
              ) : (
                <StudyWidget
                  key={`${selectedStory.id}:${selected.id}:${reset}`}
                  widget={query.data}
                />
              )}
            </div>
          </div>
          <p className="ai-pg-data-note">
            Aucun appel à l’IA, aucun quota consommé. Les contenus sont chargés depuis les
            ressources de l’app ; les liens ouvrent leurs vraies destinations.
          </p>
          <div className="ai-pg-notes">
            <section>
              <h3>Une demande à essayer</h3>
              <blockquote>{selected.prompt}</blockquote>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(selected.prompt)
                    setCopied(`${selectedStory.id}:${selected.id}`)
                    setCopyError(false)
                  } catch {
                    setCopyError(true)
                  }
                }}
              >
                {copied === `${selectedStory.id}:${selected.id}` ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}{' '}
                {copied === `${selectedStory.id}:${selected.id}` ? 'Copié' : 'Copier la demande'}
              </button>
              {copyError && <p role="status">Sélectionnez le texte ci-dessus pour le copier.</p>}
            </section>
            <section>
              <h3>À explorer</h3>
              <ul>
                {selected.checks.map(check => (
                  <li key={check}>
                    <Check size={14} />
                    {check}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <GlooDescription kind={selected.widget.kind} />
          <details className="ai-pg-payload">
            <summary>Voir les données de cet exemple</summary>
            <p>Références publiques du widget. Aucun prompt système ni secret API.</p>
            <pre>{JSON.stringify(query.data || selected.widget, null, 2)}</pre>
          </details>
          <footer className="ai-pg-bottom">
            <span>
              {index + 1} / {widgetStories.length}
            </span>
            <button
              onClick={() => chooseStory(widgetStories[(index + 1) % widgetStories.length].id)}
            >
              Widget suivant <ArrowRight size={15} />
            </button>
          </footer>
        </section>
      </div>
    </main>
  )
}
export default function WidgetsPlayground() {
  const [dark, setDark] = useState(false)
  return (
    <ThemeProvider theme={themes[dark ? 'dark' : 'default']}>
      <PlaygroundContent dark={dark} onTheme={() => setDark(!dark)} />
    </ThemeProvider>
  )
}
