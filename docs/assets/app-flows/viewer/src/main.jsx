import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { Graph, layout as dagreLayout } from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'

import flowData from '../../data/app-flows.json'
import './styles.css'

const riskColors = {
  safe: '#1f7a70',
  mutating: '#ad6b1f',
  destructive: '#b13d34',
  external: '#5c5ca8',
}

const riskLabels = {
  safe: 'Safe',
  mutating: 'Mutating',
  destructive: 'Destructive',
  external: 'External',
}

const allJourney = {
  id: 'all',
  title: 'Toutes les captures',
  description: 'Inventaire complet des captures versionnees.',
}

const curatedScope = {
  id: 'curated',
  title: 'Tous les flows curates',
  description: 'Toutes les captures rattachees a au moins un parcours manuel.',
}

const defaultFlowId =
  flowData.flows.find(flow => flow.id === 'bible-read-navigate')?.id ??
  flowData.flows[0]?.id ??
  null

function scopeId(kind, id) {
  return `${kind}:${id}`
}

function parseScope(scope) {
  const [kind, ...parts] = scope.split(':')
  return { kind, id: parts.join(':') }
}

function resolveImage(node) {
  return import.meta.env.DEV ? `/@fs/${node.absoluteImage}` : node.image
}

function AppFlowNode({ data, selected }) {
  const image = resolveImage(data)

  return (
    <article className={`flow-node flow-node--${data.risk} ${selected ? 'is-selected' : ''}`}>
      <Handle className="flow-handle" type="target" position={Position.Left} />
      <Handle className="flow-handle" type="source" position={Position.Right} />
      <div className="flow-node__thumb">
        <img src={image} alt="" loading="lazy" />
      </div>
      <div className="flow-node__body">
        <div className="flow-node__eyebrow">
          <span className={`risk risk--${data.risk}`}>{riskLabels[data.risk]}</span>
          <span>{data.type}</span>
        </div>
        <h3>{data.title}</h3>
        <p>
          {data.screenshotId} · {data.slug}
        </p>
      </div>
    </article>
  )
}

const nodeTypes = {
  appFlow: AppFlowNode,
}

const nodeDimensions = {
  width: 210,
  height: 492,
}

function getLayoutedPositions(nodes, edges) {
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const neighbors = new Map(nodes.map(node => [node.id, new Set()]))

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue
    neighbors.get(edge.source).add(edge.target)
    neighbors.get(edge.target).add(edge.source)
  }

  const visited = new Set()
  const components = []

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    const stack = [node.id]
    const componentIds = []
    visited.add(node.id)

    while (stack.length) {
      const id = stack.pop()
      componentIds.push(id)
      for (const next of neighbors.get(id)) {
        if (visited.has(next)) continue
        visited.add(next)
        stack.push(next)
      }
    }

    components.push(componentIds.map(id => nodeById.get(id)))
  }

  components.sort((a, b) => {
    const firstA = Math.min(...a.map(node => Number(node.data.screenshotId)))
    const firstB = Math.min(...b.map(node => Number(node.data.screenshotId)))
    return firstA - firstB
  })

  const positions = new Map()
  let yOffset = 0

  for (const component of components) {
    const componentIds = new Set(component.map(node => node.id))
    const componentEdges = edges.filter(
      edge => componentIds.has(edge.source) && componentIds.has(edge.target)
    )
    const graph = new Graph({ multigraph: true }).setDefaultEdgeLabel(() => ({}))

    graph.setGraph({
      rankdir: 'LR',
      align: 'UL',
      nodesep: 80,
      ranksep: 125,
      edgesep: 32,
      marginx: 40,
      marginy: 40,
      ranker: 'network-simplex',
    })

    for (const node of component) {
      graph.setNode(node.id, { ...nodeDimensions })
    }

    for (const edge of componentEdges) {
      graph.setEdge(edge.source, edge.target, {}, edge.id)
    }

    dagreLayout(graph)

    let maxY = 0
    for (const node of component) {
      const position = graph.node(node.id)
      const x = Math.round(position.x - nodeDimensions.width / 2)
      const y = Math.round(position.y - nodeDimensions.height / 2)
      positions.set(node.id, { x, y: y + yOffset })
      maxY = Math.max(maxY, y + nodeDimensions.height)
    }

    yOffset += maxY + 170
  }

  return positions
}

function buildNodes() {
  return flowData.nodes.map(node => ({
    id: node.id,
    type: 'appFlow',
    position: node.position,
    data: node,
  }))
}

function buildEdges() {
  return flowData.edges.map(edge => {
    const explicit = edge.inferred === false
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: explicit ? edge.label : undefined,
      animated: explicit,
      hidden: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: explicit ? '#1f7a70' : '#b7ada3',
      },
      style: {
        stroke: explicit ? '#1f7a70' : '#b7ada3',
        strokeWidth: explicit ? 2.4 : 1.3,
      },
      labelStyle: {
        fill: '#5b554e',
        fontSize: 11,
        fontWeight: 700,
      },
      data: edge,
    }
  })
}

function Sidebar({
  activeScope,
  setActiveScope,
  selectedNode,
  setSelectedNodeId,
  search,
  setSearch,
  activeRisk,
  setActiveRisk,
}) {
  const journeyCounts = new Map()
  for (const node of flowData.nodes) {
    journeyCounts.set(node.journey, (journeyCounts.get(node.journey) ?? 0) + 1)
  }

  const surfaceCounts = new Map()
  for (const node of flowData.nodes) {
    for (const surface of node.surfaces ?? []) {
      surfaceCounts.set(surface, (surfaceCounts.get(surface) ?? 0) + 1)
    }
  }

  function selectScope(nextScope) {
    setActiveScope(nextScope)
    setSelectedNodeId(null)
  }

  const risks = Object.keys(flowData.riskLegend)
  const journeys = [allJourney, ...flowData.journeys]
  const active = parseScope(activeScope)

  return (
    <aside className="sidebar">
      <div>
        <h1>App Flow Map</h1>
        <p className="lede">
          React Flow viewer pour {flowData.nodes.length} captures Argent et {flowData.flows.length}{' '}
          flows curates Bible Strong.
        </p>
      </div>

      <label className="search">
        <span>Recherche</span>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="note, timeline, Strong..."
        />
      </label>

      <section>
        <h2>Flows curates</h2>
        <div className="button-list">
          <button
            className={active.kind === 'curated' ? 'is-active' : ''}
            onClick={() => selectScope(scopeId('curated', curatedScope.id))}
            type="button"
          >
            <span>{curatedScope.title}</span>
            <small>{flowData.edges.filter(edge => edge.inferred === false).length}</small>
          </button>

          {flowData.surfaces.map(surface => {
            const surfaceFlows = flowData.flows.filter(flow => flow.surface === surface.id)
            return (
              <div className="surface-group" key={surface.id}>
                <button
                  className={
                    active.kind === 'surface' && active.id === surface.id ? 'is-active' : ''
                  }
                  onClick={() => selectScope(scopeId('surface', surface.id))}
                  type="button"
                >
                  <span>{surface.title}</span>
                  <small>{surfaceCounts.get(surface.id) ?? 0}</small>
                </button>

                {surfaceFlows.map(flow => (
                  <button
                    className={`flow-button ${active.kind === 'flow' && active.id === flow.id ? 'is-active' : ''}`}
                    key={flow.id}
                    onClick={() => selectScope(scopeId('flow', flow.id))}
                    type="button"
                  >
                    <span>{flow.title}</span>
                    <small>{flow.nodes.length}</small>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Inventaire auto</h2>
        <div className="button-list">
          {journeys.map(journey => {
            const count =
              journey.id === 'all' ? flowData.nodes.length : (journeyCounts.get(journey.id) ?? 0)
            const nextScope =
              journey.id === 'all' ? scopeId('all', journey.id) : scopeId('journey', journey.id)
            const isActive =
              journey.id === 'all'
                ? active.kind === 'all'
                : active.kind === 'journey' && active.id === journey.id

            return (
              <button
                className={isActive ? 'is-active' : ''}
                key={journey.id}
                onClick={() => selectScope(nextScope)}
                type="button"
              >
                <span>{journey.title}</span>
                <small>{count}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Risk</h2>
        <div className="risk-grid">
          <button
            className={activeRisk === 'all' ? 'is-active' : ''}
            onClick={() => setActiveRisk('all')}
            type="button"
          >
            Tous
          </button>
          {risks.map(risk => (
            <button
              className={activeRisk === risk ? 'is-active' : ''}
              key={risk}
              onClick={() => setActiveRisk(risk)}
              type="button"
            >
              <span className={`dot dot--${risk}`} />
              {riskLabels[risk]}
            </button>
          ))}
        </div>
      </section>

      {selectedNode ? (
        <section className="selected-card">
          <img src={resolveImage(selectedNode)} alt="" />
          <h2>{selectedNode.title}</h2>
          <p>{selectedNode.slug}</p>
          <dl>
            <div>
              <dt>Screenshot</dt>
              <dd>{selectedNode.screenshotId}</dd>
            </div>
            <div>
              <dt>Surface</dt>
              <dd>
                {(selectedNode.surfaces ?? [])
                  .map(
                    surfaceId =>
                      flowData.surfaces.find(surface => surface.id === surfaceId)?.title ??
                      surfaceId
                  )
                  .join(', ') || selectedNode.surface}
              </dd>
            </div>
            <div>
              <dt>Flows</dt>
              <dd>{selectedNode.flows?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{selectedNode.type}</dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd>{selectedNode.risk}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className="selected-card selected-card--empty">
          <h2>Aucun noeud sélectionné</h2>
          <p>Clique sur un noeud pour afficher la capture, le type et le risque.</p>
        </section>
      )}
    </aside>
  )
}

function FlowCanvas({ activeScope, search, activeRisk, selectedNodeId, setSelectedNodeId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes())
  const [edges, , onEdgesChange] = useEdgesState(buildEdges())
  const { fitView } = useReactFlow()

  const normalizedSearch = search.trim().toLowerCase()
  const active = parseScope(activeScope)
  const explicitNodeIds = new Set(
    flowData.edges
      .filter(edge => edge.inferred === false)
      .flatMap(edge => [edge.source, edge.target])
  )

  const visibleNodeIds = new Set(
    flowData.nodes
      .filter(node => {
        const matchesScope =
          active.kind === 'all' ||
          (active.kind === 'curated' && explicitNodeIds.has(node.id)) ||
          (active.kind === 'flow' && node.flows?.includes(active.id)) ||
          (active.kind === 'surface' && node.surfaces?.includes(active.id)) ||
          (active.kind === 'journey' && node.journey === active.id)
        const matchesSearch =
          !normalizedSearch ||
          node.title.toLowerCase().includes(normalizedSearch) ||
          node.slug.toLowerCase().includes(normalizedSearch) ||
          node.screenshotId.includes(normalizedSearch)
        const matchesRisk = activeRisk === 'all' || node.risk === activeRisk
        return matchesScope && matchesSearch && matchesRisk
      })
      .map(node => node.id)
  )

  const visibleEdges = edges.filter(edge => {
    const visible = visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    const matchesScope =
      active.kind === 'all' ||
      (active.kind === 'curated' && edge.data.inferred === false) ||
      (active.kind === 'flow' && edge.data.flowId === active.id) ||
      (active.kind === 'surface' && edge.data.surface === active.id) ||
      (active.kind === 'journey' && edge.data.journey === active.id && edge.data.inferred === true)
    return visible && matchesScope
  })

  React.useEffect(() => {
    const layoutNodes = nodes.filter(node => visibleNodeIds.has(node.id))
    const layoutPositions = getLayoutedPositions(layoutNodes, visibleEdges)
    setNodes(currentNodes =>
      currentNodes.map(node => ({
        ...node,
        hidden: !visibleNodeIds.has(node.id),
        position: layoutPositions.get(node.id) ?? node.position,
      }))
    )
  }, [activeScope, activeRisk, search])

  const renderedNodes = nodes.map(node => ({
    ...node,
    selected: node.id === selectedNodeId,
  }))

  const visibleEdgeIds = new Set(visibleEdges.map(edge => edge.id))
  const filteredEdges = edges.map(edge => ({
    ...edge,
    hidden: !visibleEdgeIds.has(edge.id),
  }))

  function fitFilteredNodes() {
    const ids = [...visibleNodeIds]
    fitView({
      nodes: ids.map(id => ({ id })),
      padding: 0.16,
      duration: 350,
      includeHiddenNodes: false,
    })
  }

  React.useEffect(() => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(fitFilteredNodes))
  }, [activeScope, activeRisk, search])

  return (
    <ReactFlow
      nodes={renderedNodes}
      edges={filteredEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
      onPaneClick={() => setSelectedNodeId(null)}
      onNodeDragStop={(_, draggedNode) => {
        setNodes(currentNodes =>
          currentNodes.map(node => (node.id === draggedNode.id ? draggedNode : node))
        )
      }}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.16}
      maxZoom={1.45}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#d9d2c8" gap={24} />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap
        className="minimap"
        nodeColor={node => riskColors[node.data.risk] ?? '#8c857d'}
        nodeStrokeWidth={2}
        pannable
        zoomable
      />
      <Panel position="top-left" className="flow-panel">
        <button onClick={fitFilteredNodes} type="button">
          Fit visible
        </button>
        <span>{visibleNodeIds.size} noeuds visibles</span>
      </Panel>
    </ReactFlow>
  )
}

function App() {
  const [activeScope, setActiveScope] = React.useState(
    defaultFlowId ? scopeId('flow', defaultFlowId) : scopeId('curated', curatedScope.id)
  )
  const [activeRisk, setActiveRisk] = React.useState('all')
  const [selectedNodeId, setSelectedNodeId] = React.useState(null)
  const [search, setSearch] = React.useState('')
  const selectedNode = flowData.nodes.find(node => node.id === selectedNodeId)

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <Sidebar
          activeScope={activeScope}
          setActiveScope={setActiveScope}
          selectedNode={selectedNode}
          setSelectedNodeId={setSelectedNodeId}
          search={search}
          setSearch={setSearch}
          activeRisk={activeRisk}
          setActiveRisk={setActiveRisk}
        />
        <main className="flow-shell">
          <FlowCanvas
            activeScope={activeScope}
            activeRisk={activeRisk}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            search={search}
          />
        </main>
      </div>
    </ReactFlowProvider>
  )
}

createRoot(document.getElementById('root')).render(<App />)
