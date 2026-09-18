import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Code2 } from 'lucide-react'
type Catalog = {
  source: 'private-local'
  promptVersion: string
  guidance: string
  biblePreferenceRules?: string
  widgets: {
    kind: string
    mode: 'explicit' | 'automatic'
    trigger: string
    tools: { name: string; description: string; parameters: unknown }[]
  }[]
}
async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const response = await fetch('http://127.0.0.1:8794/widget-catalog', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('CATALOG_UNAVAILABLE')
  const text = await response.text()
  if (text.length > 250000) throw new Error('INVALID_CATALOG')
  const data = JSON.parse(text) as Catalog
  if (
    data.source !== 'private-local' ||
    typeof data.promptVersion !== 'string' ||
    typeof data.guidance !== 'string' ||
    (data.biblePreferenceRules !== undefined && typeof data.biblePreferenceRules !== 'string') ||
    !Array.isArray(data.widgets) ||
    data.widgets.length > 30 ||
    data.widgets.some(
      w =>
        typeof w.kind !== 'string' ||
        !['explicit', 'automatic'].includes(w.mode) ||
        typeof w.trigger !== 'string' ||
        !Array.isArray(w.tools) ||
        w.tools.length > 10 ||
        w.tools.some(t => typeof t.name !== 'string' || typeof t.description !== 'string')
    )
  )
    throw new Error('INVALID_CATALOG')
  return data
}
export default function GlooDescription({ kind }: { kind: string }) {
  const query = useQuery({
    queryKey: ['private-local-widget-catalog'],
    queryFn: ({ signal }) => loadCatalog(signal),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  })
  const entry = query.data?.widgets.find(
    w => w.kind === (kind === 'passage_comparison' ? 'passages' : kind)
  )
  return (
    <section className="ai-pg-gloo" aria-label="Description envoyée à Gloo">
      <header>
        <h3>
          <Code2 size={16} /> Ce que Gloo reçoit
        </h3>
        <button
          aria-label="Actualiser les descriptions Gloo"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} />
        </button>
      </header>
      {query.isPending ? (
        <p role="status">Lecture du catalogue privé local…</p>
      ) : query.isError ? (
        <div role="status">
          <p>
            Le catalogue privé local est indisponible. Lancez <code>yarn dev:widget-catalog</code>{' '}
            dans le dépôt <code>bible-strong-ai</code>, puis actualisez.
          </p>
          <small>Les aperçus restent utilisables.</small>
        </div>
      ) : !entry ? (
        <p>Aucune description disponible pour ce widget.</p>
      ) : (
        <>
          <div className="ai-pg-gloo-meta">
            <strong>
              {entry.mode === 'explicit'
                ? 'Choix explicite du widget'
                : 'Widget automatique après lecture'}
            </strong>
            <span>Code serveur local · {query.data?.promptVersion}</span>
          </div>
          <p>
            {entry.mode === 'explicit'
              ? 'Gloo choisit le type de présentation dans les arguments de l’outil.'
              : 'Gloo choisit une ressource à lire. L’application affiche ensuite ce widget lorsque la lecture réussit ; il n’existe pas de description distincte envoyée pour ce widget.'}
          </p>
          <p className="ai-pg-gloo-trigger">
            <strong>Déclenchement côté application : </strong>
            {entry.trigger}
          </p>
          <div className="ai-pg-gloo-tools">
            {entry.tools.map(tool => (
              <article key={tool.name}>
                <code>{tool.name}</code>
                <blockquote>{tool.description}</blockquote>
                <details>
                  <summary>Arguments disponibles pour Gloo</summary>
                  <pre>{JSON.stringify(tool.parameters, null, 2)}</pre>
                </details>
              </article>
            ))}
          </div>
          <details className="ai-pg-gloo-guidance">
            <summary>Consigne générale de sélection des widgets</summary>
            <blockquote>{query.data?.guidance}</blockquote>
          </details>
          {query.data?.biblePreferenceRules && (
            <details className="ai-pg-gloo-guidance">
              <summary>Priorité des versions bibliques</summary>
              <blockquote>{query.data.biblePreferenceRules}</blockquote>
            </details>
          )}
          <small>
            Descriptions exactes du code privé local, transmises quand l’outil est exposé. JEV
            détermine les outils autorisés pour chaque demande. Ceci n’est pas la trace d’une
            réponse passée.
          </small>
        </>
      )}
    </section>
  )
}
