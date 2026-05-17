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
  title: 'Tous les parcours',
  description: 'Toutes les captures versionnées, regroupées par journey.',
}

const curatedJourney = {
  id: 'curated',
  title: 'Transitions explicites',
  description: 'Parcours manuellement reliés lorsque la transition est connue.',
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
        <p>{data.screenshotId} · {data.slug}</p>
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
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const neighbors = new Map(nodes.map((node) => [node.id, new Set()]))

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

    components.push(componentIds.map((id) => nodeById.get(id)))
  }

  components.sort((a, b) => {
    const firstA = Math.min(...a.map((node) => Number(node.data.screenshotId)))
    const firstB = Math.min(...b.map((node) => Number(node.data.screenshotId)))
    return firstA - firstB
  })

  const positions = new Map()
  let yOffset = 0

  for (const component of components) {
    const componentIds = new Set(component.map((node) => node.id))
    const componentEdges = edges.filter((edge) => componentIds.has(edge.source) && componentIds.has(edge.target))
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
  return flowData.nodes.map((node) => ({
    id: node.id,
    type: 'appFlow',
    position: node.position,
    data: node,
  }))
}

function buildEdges() {
  return flowData.edges.map((edge) => {
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
  activeJourney,
  setActiveJourney,
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

  const risks = Object.keys(flowData.riskLegend)
  const journeys = [allJourney, curatedJourney, ...flowData.journeys]

  return (
    <aside className="sidebar">
      <div>
        <h1>App Flow Map</h1>
        <p className="lede">React Flow viewer pour les 275 captures Argent et les parcours utilisateur Bible Strong.</p>
      </div>

      <label className="search">
        <span>Recherche</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="note, timeline, Strong..."
        />
      </label>

      <section>
        <h2>Journeys</h2>
        <div className="button-list">
          {journeys.map((journey) => {
            const count =
              journey.id === 'all'
                ? flowData.nodes.length
                : journey.id === 'curated'
                  ? flowData.edges.filter((edge) => edge.inferred === false).length
                  : journeyCounts.get(journey.id) ?? 0
            return (
              <button
                className={activeJourney === journey.id ? 'is-active' : ''}
                key={journey.id}
                onClick={() => {
                  setActiveJourney(journey.id)
                  setSelectedNodeId(null)
                }}
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
          {risks.map((risk) => (
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
              <dt>Journey</dt>
              <dd>{flowData.journeys.find((journey) => journey.id === selectedNode.journey)?.title}</dd>
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

function FlowCanvas({ activeJourney, search, activeRisk, selectedNodeId, setSelectedNodeId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes())
  const [edges, , onEdgesChange] = useEdgesState(buildEdges())
  const { fitView } = useReactFlow()

  const normalizedSearch = search.trim().toLowerCase()
  const explicitNodeIds = new Set(
    flowData.edges
      .filter((edge) => edge.inferred === false)
      .flatMap((edge) => [edge.source, edge.target]),
  )

  const visibleNodeIds = new Set(
    flowData.nodes
      .filter((node) => {
        const matchesJourney =
          activeJourney === 'all'
          || node.journey === activeJourney
          || (activeJourney === 'curated' && explicitNodeIds.has(node.id))
        const matchesSearch =
          !normalizedSearch
          || node.title.toLowerCase().includes(normalizedSearch)
          || node.slug.toLowerCase().includes(normalizedSearch)
          || node.screenshotId.includes(normalizedSearch)
        const matchesRisk = activeRisk === 'all' || node.risk === activeRisk
        return matchesJourney && matchesSearch && matchesRisk
      })
      .map((node) => node.id),
  )

  const visibleEdges = edges.filter((edge) => {
    const visible = visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    const matchesJourney =
      activeJourney === 'all'
      || edge.data.journey === activeJourney
      || (activeJourney === 'curated' && edge.data.inferred === false)
    return visible && matchesJourney
  })

  React.useEffect(() => {
    const layoutNodes = nodes.filter((node) => visibleNodeIds.has(node.id))
    const layoutPositions = getLayoutedPositions(layoutNodes, visibleEdges)
    setNodes((currentNodes) => currentNodes.map((node) => ({
      ...node,
      hidden: !visibleNodeIds.has(node.id),
      position: layoutPositions.get(node.id) ?? node.position,
    })))
  }, [activeJourney, activeRisk, search])

  const renderedNodes = nodes.map((node) => ({
    ...node,
    selected: node.id === selectedNodeId,
  }))

  const visibleEdgeIds = new Set(visibleEdges.map((edge) => edge.id))
  const filteredEdges = edges.map((edge) => ({
    ...edge,
    hidden: !visibleEdgeIds.has(edge.id),
  }))

  function fitFilteredNodes() {
    const ids = [...visibleNodeIds]
    fitView({
      nodes: ids.map((id) => ({ id })),
      padding: 0.16,
      duration: 350,
      includeHiddenNodes: false,
    })
  }

  React.useEffect(() => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(fitFilteredNodes))
  }, [activeJourney, activeRisk, search])

  return (
    <ReactFlow
      nodes={renderedNodes}
      edges={filteredEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
      onPaneClick={() => setSelectedNodeId(null)}
      onNodeDragStop={(_, draggedNode) => {
        setNodes((currentNodes) =>
          currentNodes.map((node) => node.id === draggedNode.id ? draggedNode : node),
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
        nodeColor={(node) => riskColors[node.data.risk] ?? '#8c857d'}
        nodeStrokeWidth={2}
        pannable
        zoomable
      />
      <Panel position="top-left" className="flow-panel">
        <button onClick={fitFilteredNodes} type="button">Fit visible</button>
        <span>{visibleNodeIds.size} noeuds visibles</span>
      </Panel>
    </ReactFlow>
  )
}

function App() {
  const [activeJourney, setActiveJourney] = React.useState('curated')
  const [activeRisk, setActiveRisk] = React.useState('all')
  const [selectedNodeId, setSelectedNodeId] = React.useState(null)
  const [search, setSearch] = React.useState('')
  const selectedNode = flowData.nodes.find((node) => node.id === selectedNodeId)

  return (
    <ReactFlowProvider>
      <div className="app-shell">
        <Sidebar
          activeJourney={activeJourney}
          setActiveJourney={setActiveJourney}
          selectedNode={selectedNode}
          setSelectedNodeId={setSelectedNodeId}
          search={search}
          setSearch={setSearch}
          activeRisk={activeRisk}
          setActiveRisk={setActiveRisk}
        />
        <main className="flow-shell">
          <FlowCanvas
            activeJourney={activeJourney}
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
