import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type Node,
  type NodeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CheckCircle2,
  Database,
  FileJson,
  Filter,
  GitCompareArrows,
  ListChecks,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  categoryLabels,
  categoryTone,
  workflowEdges,
  workflowNodes,
  type WorkflowCategory,
  type WorkflowNodeData
} from "./workflowData";

const nodeTypes = {
  workflowNode: WorkflowGraphNode
};

const categoryIcons: Record<WorkflowCategory, typeof FileJson> = {
  source: FileJson,
  index: Database,
  deterministic: GitCompareArrows,
  loop: RotateCcw,
  output: ListChecks,
  llm: Sparkles,
  quality: ShieldCheck
};

const defaultCategories = new Set<WorkflowCategory>([
  "source",
  "index",
  "deterministic",
  "loop",
  "output",
  "llm",
  "quality"
]);

export function WorkflowView() {
  const [query, setQuery] = useState("");
  const [enabledCategories, setEnabledCategories] =
    useState<Set<WorkflowCategory>>(defaultCategories);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of workflowNodes) {
      const data = node.data;
      const matchesCategory = enabledCategories.has(data.category);
      const haystack = [
        data.title,
        data.eyebrow,
        data.summary,
        data.example,
        ...data.details,
        ...data.inputs,
        ...data.outputs,
        ...data.commands,
        ...data.files,
        ...data.metrics,
        ...data.guardrails,
        ...data.risks
      ]
        .join(" ")
        .toLowerCase();
      if (
        matchesCategory &&
        (!normalizedQuery || haystack.includes(normalizedQuery))
      ) {
        ids.add(node.id);
      }
    }
    return ids;
  }, [enabledCategories, normalizedQuery]);

  const activeId =
    selectedId && visibleNodeIds.has(selectedId) ? selectedId : null;

  const nodes = useMemo(
    () =>
      workflowNodes.map((node) => ({
        ...node,
        hidden: !visibleNodeIds.has(node.id),
        data: {
          ...node.data,
          active: node.id === activeId
        }
      })),
    [activeId, visibleNodeIds]
  );

  const edges = useMemo(
    () =>
      workflowEdges.map((edge) => ({
        ...edge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.style?.stroke?.toString() ?? "#62717d",
          width: 16,
          height: 16
        },
        hidden:
          !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)
      })),
    [visibleNodeIds]
  );

  const activeNode = activeId
    ? workflowNodes.find((node) => node.id === activeId)
    : undefined;

  function toggleCategory(category: WorkflowCategory) {
    setEnabledCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function resetFilters() {
    setQuery("");
    setEnabledCategories(defaultCategories);
  }

  return (
    <section className="workflow-shell flex h-screen min-h-[760px] flex-col overflow-hidden">
      <header className="border-border/70 bg-background/95 border-b px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Workflow Strong NBS</Badge>
              <Badge className="bg-emerald-500/15 text-emerald-200">
                Deterministe d'abord
              </Badge>
              <Badge className="bg-pink-500/15 text-pink-200">
                LLM borne apres residuels
              </Badge>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal">
              Carte interactive de generation Bible Strong
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(240px,360px)_auto]">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="Chercher: SQLite, H0697, consensus, metrics..."
              />
            </div>
            <Button type="button" variant="outline" onClick={resetFilters}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[240px_minmax(0,1fr)_420px]">
        <aside className="border-border/70 bg-card/70 hidden min-h-0 border-r 2xl:block">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-4">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Filter className="size-4" />
                  Filtres
                </div>
                <div className="space-y-2">
                  {(Object.keys(categoryLabels) as WorkflowCategory[]).map(
                    (category) => {
                      const Icon = categoryIcons[category];
                      const enabled = enabledCategories.has(category);
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                            enabled
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-border bg-muted/30 text-muted-foreground"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="size-4" />
                            {categoryLabels[category]}
                          </span>
                          <span
                            className="legend-dot"
                            style={{
                              background: categoryTone[category].border
                            }}
                          />
                        </button>
                      );
                    }
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-3 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-300" />
                  Contrat actuel
                </div>
                <p className="text-muted-foreground leading-6">
                  La generation complete reste sans LLM. Le LLM intervient
                  seulement apres le rapport residuel, sur packets bornes,
                  consensus et filtre de securite.
                </p>
              </section>

              <section className="grid grid-cols-2 gap-2 text-xs">
                <MiniCount label="Noeuds" value={workflowNodes.length} />
                <MiniCount
                  label="Visibles"
                  value={[...visibleNodeIds].length}
                />
              </section>
            </div>
          </ScrollArea>
        </aside>

        <div className="workflow-canvas min-h-[470px] xl:min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            minZoom={0.28}
            maxZoom={1.35}
            defaultViewport={{ x: 44, y: 54, zoom: 0.62 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(_, node) =>
              setSelectedId((current) => (current === node.id ? null : node.id))
            }
            proOptions={{ hideAttribution: true }}
            className="workflow-flow"
          >
            <Background color="#3c4650" gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) =>
                categoryTone[(node.data as WorkflowNodeData).category].border
              }
              maskColor="rgba(7, 12, 17, 0.68)"
            />
            <Panel position="top-left">
              <div className="border-border bg-background/90 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg">
                <Waypoints className="text-primary size-4" />
                <span>
                  {visibleNodeIds.size.toLocaleString("fr-FR")} noeuds dans la
                  vue
                </span>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <aside className="border-border/70 bg-card/75 min-h-0 border-t xl:border-t-0 xl:border-l">
          <WorkflowInspector node={activeNode} />
        </aside>
      </div>
    </section>
  );
}

function WorkflowGraphNode({
  data
}: NodeProps<Node<WorkflowNodeData & { active?: boolean }>>) {
  const tone = categoryTone[data.category];
  const Icon = categoryIcons[data.category];

  return (
    <div
      className={cn(
        "workflow-node w-[285px] rounded-lg border p-3 text-left shadow-xl transition",
        data.active && "workflow-node-active"
      )}
      style={{
        borderColor: data.active ? tone.border : "rgba(148, 163, 184, 0.28)",
        background: data.active
          ? `linear-gradient(180deg, ${tone.background}, rgba(15, 23, 31, 0.94))`
          : "rgba(18, 26, 34, 0.93)"
      }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            {data.eyebrow}
          </p>
          <h3 className="mt-1 text-[15px] leading-tight font-semibold tracking-normal text-white">
            {data.title}
          </h3>
        </div>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-md border"
          style={{
            borderColor: tone.border,
            color: tone.border,
            background: "rgba(255,255,255,0.04)"
          }}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn("rounded-full border px-2 py-1 text-[11px]", tone.chip)}
        >
          {categoryLabels[data.category]}
        </span>
        <span className="text-muted-foreground text-[11px]">
          {data.metrics[0]}
        </span>
      </div>
    </div>
  );
}

function WorkflowInspector({ node }: { node?: Node<WorkflowNodeData> }) {
  if (!node) {
    return (
      <div className="text-muted-foreground flex h-full flex-col justify-center gap-4 p-5 text-sm">
        <div className="grid size-12 place-items-center rounded-lg border border-dashed">
          <Waypoints className="size-5" />
        </div>
        <div>
          <h3 className="text-foreground text-lg font-semibold">
            Aucun noeud selectionne
          </h3>
          <p className="mt-2 leading-6">
            Clique sur un noeud du graphe pour charger son contenu ici. Clique
            une seconde fois sur le meme noeud pour deselectionner.
          </p>
        </div>
      </div>
    );
  }

  const data = node.data;
  const tone = categoryTone[data.category];
  const Icon = categoryIcons[data.category];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-5">
        <section>
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-lg border"
              style={{
                borderColor: tone.border,
                color: tone.border,
                background: tone.background
              }}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <Badge className={tone.chip}>
                {categoryLabels[data.category]}
              </Badge>
              <h3 className="mt-2 text-xl leading-tight font-semibold tracking-normal">
                {data.title}
              </h3>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-sm leading-6">
            {data.summary}
          </p>
        </section>

        <DetailBlock title="Ce que fait cette etape">
          <div className="space-y-3">
            {data.details.map((detail) => (
              <p key={detail} className="text-sm leading-6">
                {detail}
              </p>
            ))}
          </div>
        </DetailBlock>

        <DetailBlock title="Exemple concret">
          <p className="text-sm leading-6">{data.example}</p>
        </DetailBlock>

        <div className="grid gap-4 2xl:grid-cols-2">
          <ListBlock title="Entrees" items={data.inputs} />
          <ListBlock title="Sorties" items={data.outputs} />
        </div>

        <ListBlock title="Commandes" items={data.commands} mono />
        <ListBlock title="Fichiers" items={data.files} mono />

        <div className="grid gap-4 2xl:grid-cols-2">
          <ListBlock title="Metriques a surveiller" items={data.metrics} />
          <ListBlock title="Garde-fous" items={data.guardrails} />
        </div>

        <ListBlock title="Risques connus" items={data.risks} warning />
      </div>
    </ScrollArea>
  );
}

function DetailBlock({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border/80 bg-muted/25 rounded-lg border p-4">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function ListBlock({
  title,
  items,
  mono = false,
  warning = false
}: {
  title: string;
  items: string[];
  mono?: boolean;
  warning?: boolean;
}) {
  return (
    <DetailBlock title={title}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "flex gap-2 text-sm leading-5",
              mono && "font-mono text-xs",
              warning && "text-orange-100"
            )}
          >
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </DetailBlock>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-muted/25 rounded-lg border p-3">
      <span className="text-muted-foreground block text-[11px]">{label}</span>
      <strong className="text-lg">{value.toLocaleString("fr-FR")}</strong>
    </div>
  );
}
