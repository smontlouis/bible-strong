/* global document, fetch, console, window */

const SVG_NS = "http://www.w3.org/2000/svg";
const LEVEL_HEIGHT = 154;
const COMPONENT_GAP = 260;
const ROW_WIDTH = 8600;
const MIN_SCALE = 0.08;
const MAX_SCALE = 2.6;

const RELATION_LABELS = {
  parents: "Parents",
  children: "Enfants",
  partners: "Conjoints",
  siblings: "Fratrie"
};

const els = {
  svg: document.querySelector("#treeSvg"),
  viewport: document.querySelector("#viewportGroup"),
  status: document.querySelector("#treeStatus"),
  searchForm: document.querySelector("#treeSearchForm"),
  search: document.querySelector("#treeSearch"),
  inspector: document.querySelector("#inspectorContent"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  reset: document.querySelector("#resetView"),
  filters: [...document.querySelectorAll(".tree-filter-group input")]
};

const state = {
  nodes: [],
  links: [],
  nodeById: new Map(),
  layoutNodes: [],
  parentLinks: [],
  partnerLinks: [],
  siblingLinks: [],
  selectedId: null,
  matches: new Set(),
  visibleRelations: new Set(["parent", "partner"]),
  transform: { x: 80, y: 80, scale: 0.42 },
  bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
  isPanning: false,
  panStart: null
};

init().catch((error) => {
  console.error(error);
  els.status.textContent = `Erreur: ${error.message}`;
});

async function init() {
  bindEvents();
  const response = await fetch("/api/entities/tree");
  if (!response.ok) {
    throw new Error(`Impossible de charger les entités (${response.status})`);
  }
  const payload = await response.json();
  buildGraph(payload.nodes, payload.links);
  render();
  resetView();
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    focusSearch();
  });
  els.search.addEventListener("input", updateSearchMatches);
  els.zoomIn.addEventListener("click", () => zoomBy(1.22));
  els.zoomOut.addEventListener("click", () => zoomBy(1 / 1.22));
  els.reset.addEventListener("click", resetView);
  for (const filter of els.filters) {
    filter.addEventListener("change", () => {
      state.visibleRelations = new Set(
        els.filters.filter((item) => item.checked).map((item) => item.value)
      );
      updateVisibility();
    });
  }
  els.svg.addEventListener("wheel", onWheel, { passive: false });
  els.svg.addEventListener("pointerdown", onPointerDown);
  els.svg.addEventListener("pointermove", onPointerMove);
  els.svg.addEventListener("pointerup", endPan);
  els.svg.addEventListener("pointercancel", endPan);
  window.addEventListener("resize", () => {
    if (state.selectedId) centerNode(state.selectedId, false);
  });
}

function buildGraph(rawNodes, rawLinks) {
  state.nodes = rawNodes.map((node) => ({
    ...node,
    id: Number(node.id),
    gender: normalizeGender(node.gender),
    parents: [],
    children: [],
    partners: [],
    siblings: []
  }));
  state.nodeById = new Map(state.nodes.map((node) => [node.id, node]));

  const parentByKey = new Map();
  const partnerByKey = new Map();
  const siblingByKey = new Map();

  for (const link of rawLinks) {
    const fromId = Number(link.fromEntityId);
    const toId = Number(link.toEntityId);
    if (!state.nodeById.has(fromId) || !state.nodeById.has(toId)) continue;

    if (link.relation === "father" || link.relation === "mother") {
      addParentLink(parentByKey, toId, fromId, link.relation, link.certainty);
    } else if (link.relation === "offspring") {
      addParentLink(parentByKey, fromId, toId, "offspring", link.certainty);
    } else if (link.relation === "partner") {
      addUndirectedLink(partnerByKey, fromId, toId, link.certainty);
    } else if (link.relation === "sibling") {
      addUndirectedLink(siblingByKey, fromId, toId, link.certainty);
    }
  }

  state.parentLinks = [...parentByKey.values()];
  state.partnerLinks = [...partnerByKey.values()];
  state.siblingLinks = [...siblingByKey.values()];
  hydrateRelatives();
  computeLayout();
}

function addParentLink(store, parentId, childId, relation, certainty) {
  if (parentId === childId) return;
  const key = `${parentId}:${childId}`;
  const existing = store.get(key);
  if (existing) {
    if (existing.relation === "offspring" && relation !== "offspring") {
      existing.relation = relation;
    }
    return;
  }
  store.set(key, { parentId, childId, relation, certainty });
}

function addUndirectedLink(store, leftId, rightId, certainty) {
  if (leftId === rightId) return;
  const [sourceId, targetId] = [leftId, rightId].sort((left, right) => left - right);
  store.set(`${sourceId}:${targetId}`, { sourceId, targetId, certainty });
}

function hydrateRelatives() {
  for (const link of state.parentLinks) {
    const parent = state.nodeById.get(link.parentId);
    const child = state.nodeById.get(link.childId);
    parent.children.push(child.id);
    child.parents.push(parent.id);
  }
  for (const link of state.partnerLinks) {
    state.nodeById.get(link.sourceId).partners.push(link.targetId);
    state.nodeById.get(link.targetId).partners.push(link.sourceId);
  }
  for (const link of state.siblingLinks) {
    state.nodeById.get(link.sourceId).siblings.push(link.targetId);
    state.nodeById.get(link.targetId).siblings.push(link.sourceId);
  }
  for (const node of state.nodes) {
    node.parents = uniqueSortedIds(node.parents);
    node.children = uniqueSortedIds(node.children);
    node.partners = uniqueSortedIds(node.partners);
    node.siblings = uniqueSortedIds(node.siblings);
  }
}

function computeLayout() {
  const components = connectedComponents();
  let rowX = 80;
  let rowY = 80;
  let rowHeight = 0;
  const positioned = [];

  for (const component of components) {
    const levels = orderGenerationLevels(assignLevels(component));
    const maxLevelSize = Math.max(...[...levels.values()].map((level) => level.length), 1);
    const nodeGap = maxLevelSize > 120 ? 82 : maxLevelSize > 60 ? 96 : 122;
    const width = Math.max(300, maxLevelSize * nodeGap);
    const height = Math.max(180, levels.size * LEVEL_HEIGHT);

    if (rowX > 80 && rowX + width > ROW_WIDTH) {
      rowX = 80;
      rowY += rowHeight + COMPONENT_GAP;
      rowHeight = 0;
    }

    for (const [level, nodes] of levels) {
      const sorted = nodes;
      const levelWidth = sorted.length * nodeGap;
      const startX = rowX + (width - levelWidth) / 2 + nodeGap / 2;
      sorted.forEach((node, index) => {
        node.x = startX + index * nodeGap;
        node.y = rowY + level * LEVEL_HEIGHT + 58;
        positioned.push(node);
      });
    }

    rowX += width + COMPONENT_GAP;
    rowHeight = Math.max(rowHeight, height);
  }

  state.layoutNodes = positioned;
  const xs = positioned.map((node) => node.x);
  const ys = positioned.map((node) => node.y);
  state.bounds = {
    minX: Math.min(...xs) - 120,
    minY: Math.min(...ys) - 120,
    maxX: Math.max(...xs) + 120,
    maxY: Math.max(...ys) + 120
  };
}

function connectedComponents() {
  const adjacency = new Map(state.nodes.map((node) => [node.id, new Set()]));
  for (const link of state.parentLinks) {
    adjacency.get(link.parentId).add(link.childId);
    adjacency.get(link.childId).add(link.parentId);
  }
  for (const link of state.partnerLinks) {
    adjacency.get(link.sourceId).add(link.targetId);
    adjacency.get(link.targetId).add(link.sourceId);
  }

  const visited = new Set();
  const components = [];
  for (const node of state.nodes) {
    if (visited.has(node.id)) continue;
    const stack = [node.id];
    const component = [];
    visited.add(node.id);
    while (stack.length > 0) {
      const id = stack.pop();
      const item = state.nodeById.get(id);
      component.push(item);
      for (const nextId of adjacency.get(id)) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        stack.push(nextId);
      }
    }
    components.push(component);
  }
  return components.sort((left, right) => right.length - left.length);
}

function assignLevels(component) {
  const componentIds = new Set(component.map((node) => node.id));
  const depth = new Map(component.map((node) => [node.id, 0]));

  for (let pass = 0; pass < 80; pass += 1) {
    let changed = false;
    for (const link of state.parentLinks) {
      if (!componentIds.has(link.parentId) || !componentIds.has(link.childId)) continue;
      const parentDepth = depth.get(link.parentId) ?? 0;
      const childDepth = depth.get(link.childId) ?? 0;
      if (childDepth < parentDepth + 1) {
        depth.set(link.childId, parentDepth + 1);
        changed = true;
      }
    }
    for (const link of state.partnerLinks) {
      if (!componentIds.has(link.sourceId) || !componentIds.has(link.targetId)) continue;
      const sourceDepth = depth.get(link.sourceId) ?? 0;
      const targetDepth = depth.get(link.targetId) ?? 0;
      if (sourceDepth !== targetDepth) {
        const nextDepth = Math.max(sourceDepth, targetDepth);
        depth.set(link.sourceId, nextDepth);
        depth.set(link.targetId, nextDepth);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const minDepth = Math.min(...depth.values());
  for (const node of component) {
    depth.set(node.id, (depth.get(node.id) ?? 0) - minDepth);
  }

  const levels = new Map();
  for (const node of component) {
    const level = depth.get(node.id) ?? 0;
    const levelNodes = levels.get(level) ?? [];
    levelNodes.push(node);
    levels.set(level, levelNodes);
  }
  return new Map([...levels.entries()].sort((left, right) => left[0] - right[0]));
}

function orderGenerationLevels(levels) {
  const orderedLevels = new Map(
    [...levels.entries()].map(([level, nodes]) => [
      level,
      nodes.slice().sort(compareFamilyOrder)
    ])
  );
  const maxLevel = Math.max(...orderedLevels.keys());
  const order = new Map();
  for (const nodes of orderedLevels.values()) {
    nodes.forEach((node, index) => order.set(node.id, index));
  }

  for (let pass = 0; pass < 8; pass += 1) {
    for (let level = 1; level <= maxLevel; level += 1) {
      sortLevelByBarycenter(orderedLevels, order, level, "down");
    }
    for (let level = maxLevel - 1; level >= 0; level -= 1) {
      sortLevelByBarycenter(orderedLevels, order, level, "up");
    }
  }
  return orderedLevels;
}

function sortLevelByBarycenter(levels, order, level, direction) {
  const nodes = levels.get(level);
  if (!nodes || nodes.length < 2) return;
  nodes.sort((left, right) => {
    const leftScore = barycenter(left, order, direction);
    const rightScore = barycenter(right, order, direction);
    if (leftScore !== rightScore) return leftScore - rightScore;
    return compareFamilyOrder(left, right);
  });
  nodes.forEach((node, index) => order.set(node.id, index));
}

function barycenter(node, order, direction) {
  const ids =
    direction === "down"
      ? [...node.parents, ...node.partners]
      : [...node.children, ...node.partners];
  const positions = ids
    .map((id) => order.get(id))
    .filter((value) => Number.isFinite(value));
  if (positions.length === 0) return order.get(node.id) ?? 0;
  return positions.reduce((total, value) => total + value, 0) / positions.length;
}

function compareFamilyOrder(left, right) {
  const parentCompare = familyKey(left).localeCompare(familyKey(right), "fr");
  return parentCompare || compareNodes(left, right);
}

function familyKey(node) {
  if (node.parents.length === 0) return `~${node.displayName}`;
  return node.parents
    .map((id) => state.nodeById.get(id)?.displayName ?? "")
    .sort((left, right) => left.localeCompare(right, "fr"))
    .join("+");
}

function render() {
  els.viewport.replaceChildren();
  const linkLayer = svgEl("g", { class: "tree-links" });
  const nodeLayer = svgEl("g", { class: "tree-nodes" });
  els.viewport.append(linkLayer, nodeLayer);

  renderLinks(linkLayer);
  for (const node of state.layoutNodes) {
    nodeLayer.append(renderNode(node));
  }
  updateStatus();
  updateTransform();
  updateVisibility();
}

function renderLinks(layer) {
  renderFamilyHubLinks(layer);
  for (const link of state.partnerLinks) {
    const source = state.nodeById.get(link.sourceId);
    const target = state.nodeById.get(link.targetId);
    if (!hasPosition(source) || !hasPosition(target)) continue;
    layer.append(
      svgEl("path", {
        class: "tree-link partner",
        "data-kind": "partner",
        d: sidePath(source, target, 10)
      })
    );
  }
  for (const link of state.siblingLinks) {
    const source = state.nodeById.get(link.sourceId);
    const target = state.nodeById.get(link.targetId);
    if (!hasPosition(source) || !hasPosition(target)) continue;
    layer.append(
      svgEl("path", {
        class: "tree-link sibling",
        "data-kind": "sibling",
        d: sidePath(source, target, -20)
      })
    );
  }
}

function renderFamilyHubLinks(layer) {
  for (const family of buildFamilyGroups()) {
    const parents = family.parentIds
      .map((id) => state.nodeById.get(id))
      .filter(hasPosition);
    const children = family.childIds
      .map((id) => state.nodeById.get(id))
      .filter(hasPosition);
    if (parents.length === 0 || children.length === 0) continue;

    const parentY = Math.max(...parents.map((node) => node.y));
    const childY = Math.min(...children.map((node) => node.y));
    const hubX = average([
      ...parents.map((node) => node.x),
      ...children.map((node) => node.x)
    ]);
    const hubY = parentY + (childY - parentY) * 0.44;

    for (const parent of parents) {
      layer.append(
        svgEl("path", {
          class: `tree-link parent ${parent.gender === "female" ? "mother" : ""}`,
          "data-kind": "parent",
          d: familyParentPath(parent, hubX, hubY)
        })
      );
    }
    for (const child of children) {
      layer.append(
        svgEl("path", {
          class: "tree-link parent",
          "data-kind": "parent",
          d: familyChildPath(hubX, hubY, child)
        })
      );
    }
  }
}

function buildFamilyGroups() {
  const groups = new Map();
  for (const node of state.layoutNodes) {
    if (node.parents.length === 0) continue;
    const parentIds = node.parents.filter((id) => hasPosition(state.nodeById.get(id)));
    if (parentIds.length === 0) continue;
    const key = parentIds.slice().sort((left, right) => left - right).join(":");
    const group = groups.get(key) ?? { parentIds, childIds: [] };
    group.childIds.push(node.id);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.childIds.sort((left, right) =>
      compareNodes(state.nodeById.get(left), state.nodeById.get(right))
    );
  }
  return [...groups.values()];
}

function renderNode(node) {
  const group = svgEl("g", {
    class: `tree-node ${node.gender}`,
    transform: `translate(${node.x}, ${node.y})`,
    tabindex: "0",
    role: "button",
    "aria-label": node.displayName,
    "data-id": String(node.id)
  });
  group.append(
    svgEl("circle", { class: "avatar-bg", cx: "0", cy: "0", r: "31" }),
    svgEl("circle", { class: "avatar-fill", cx: "0", cy: "-9", r: "11" }),
    svgEl("path", {
      class: "avatar-fill",
      d: "M -22 23 C -19 7 -10 1 0 1 C 10 1 19 7 22 23 Z"
    }),
    svgEl("path", {
      class: "avatar-accent",
      d: "M -14 22 C -10 13 -5 10 0 10 C 5 10 10 13 14 22 Z"
    }),
    svgText(truncateName(node.displayName), { x: "0", y: "51" })
  );
  group.addEventListener("click", (event) => {
    event.stopPropagation();
    selectNode(node.id, true);
  });
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(node.id, true);
    }
  });
  return group;
}

function selectNode(id, shouldCenter) {
  state.selectedId = id;
  for (const nodeEl of els.viewport.querySelectorAll(".tree-node")) {
    nodeEl.classList.toggle("is-selected", Number(nodeEl.dataset.id) === id);
  }
  renderInspector(state.nodeById.get(id));
  updateVisibility();
  if (shouldCenter) centerNode(id, true);
}

function renderInspector(node) {
  els.inspector.className = "inspector-card";
  els.inspector.replaceChildren();
  const avatar = document.createElement("div");
  avatar.className = `empty-avatar ${node.gender}`;
  const title = document.createElement("h1");
  title.textContent = node.displayName;
  const description = document.createElement("p");
  description.textContent = node.brief || node.shortDescription || node.briefest || "Aucune description.";
  const meta = document.createElement("div");
  meta.className = "inspector-meta";
  meta.append(
    chip(node.gender === "female" ? "Femme" : node.gender === "male" ? "Homme" : "Genre inconnu"),
    chip(node.englishName === node.displayName ? "Nom stable" : node.englishName)
  );
  els.inspector.append(avatar, title, meta, description);
  renderRelativeSection("parents", node.parents);
  renderRelativeSection("partners", node.partners);
  renderRelativeSection("children", node.children);
  renderRelativeSection("siblings", node.siblings);
}

function renderRelativeSection(kind, ids) {
  const section = document.createElement("section");
  section.className = "relative-section";
  const title = document.createElement("h2");
  title.textContent = `${RELATION_LABELS[kind]} (${ids.length})`;
  const list = document.createElement("div");
  list.className = "relative-list";
  for (const id of ids.slice(0, 80)) {
    const node = state.nodeById.get(id);
    const button = document.createElement("button");
    button.className = "relative-button";
    button.type = "button";
    button.innerHTML = `<span></span><small></small>`;
    button.querySelector("span").textContent = node.displayName;
    button.querySelector("small").textContent = node.gender === "female" ? "F" : node.gender === "male" ? "H" : "";
    button.addEventListener("click", () => selectNode(id, true));
    list.append(button);
  }
  if (ids.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Aucune relation directe.";
    list.append(empty);
  }
  section.append(title, list);
  els.inspector.append(section);
}

function focusSearch() {
  updateSearchMatches();
  const query = normalizeText(els.search.value);
  if (!query) return;
  const candidates = state.layoutNodes.filter((node) => matchesNode(node, query));
  const exact = candidates.find((node) => normalizeText(node.displayName) === query);
  const target = exact ?? candidates[0];
  if (target) selectNode(target.id, true);
}

function updateSearchMatches() {
  const query = normalizeText(els.search.value);
  state.matches = new Set(
    query
      ? state.layoutNodes.filter((node) => matchesNode(node, query)).map((node) => node.id)
      : []
  );
  for (const nodeEl of els.viewport.querySelectorAll(".tree-node")) {
    const id = Number(nodeEl.dataset.id);
    const isMatch = state.matches.has(id);
    nodeEl.classList.toggle("is-match", isMatch);
    nodeEl.classList.toggle("is-dimmed", query && !isMatch && id !== state.selectedId);
  }
  updateStatus();
}

function updateVisibility() {
  for (const link of els.viewport.querySelectorAll(".tree-link")) {
    const kind = link.dataset.kind;
    const visible = state.visibleRelations.has(kind);
    link.classList.toggle("is-muted", !visible);
    link.style.display = visible ? "" : "none";
  }
}

function updateStatus() {
  const selected = state.selectedId ? state.nodeById.get(state.selectedId) : null;
  const matchText =
    state.matches.size > 0 ? ` - ${state.matches.size} résultat(s) surligné(s)` : "";
  els.status.textContent = `${state.nodes.length.toLocaleString("fr-FR")} personnages, ${state.parentLinks.length.toLocaleString("fr-FR")} liens parent/enfant, ${state.partnerLinks.length.toLocaleString("fr-FR")} couples${matchText}${selected ? ` - sélection: ${selected.displayName}` : ""}`;
}

function onWheel(event) {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  const rect = els.svg.getBoundingClientRect();
  zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  if (event.target.closest?.(".tree-node")) return;
  els.svg.setPointerCapture(event.pointerId);
  state.isPanning = true;
  state.panStart = {
    x: event.clientX,
    y: event.clientY,
    tx: state.transform.x,
    ty: state.transform.y
  };
  els.svg.classList.add("is-panning");
}

function onPointerMove(event) {
  if (!state.isPanning || !state.panStart) return;
  state.transform.x = state.panStart.tx + event.clientX - state.panStart.x;
  state.transform.y = state.panStart.ty + event.clientY - state.panStart.y;
  updateTransform();
}

function endPan(event) {
  if (state.isPanning && event.pointerId !== undefined) {
    try {
      els.svg.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }
  state.isPanning = false;
  state.panStart = null;
  els.svg.classList.remove("is-panning");
}

function zoomBy(factor) {
  const rect = els.svg.getBoundingClientRect();
  zoomAt(factor, rect.width / 2, rect.height / 2);
}

function zoomAt(factor, clientX, clientY) {
  const nextScale = clamp(state.transform.scale * factor, MIN_SCALE, MAX_SCALE);
  const ratio = nextScale / state.transform.scale;
  state.transform.x = clientX - (clientX - state.transform.x) * ratio;
  state.transform.y = clientY - (clientY - state.transform.y) * ratio;
  state.transform.scale = nextScale;
  updateTransform();
}

function centerNode(id, smooth) {
  const node = state.nodeById.get(id);
  if (!node || !hasPosition(node)) return;
  const rect = els.svg.getBoundingClientRect();
  if (smooth) {
    state.transform.scale = Math.max(state.transform.scale, 0.78);
  }
  state.transform.x = rect.width / 2 - node.x * state.transform.scale;
  state.transform.y = rect.height / 2 - node.y * state.transform.scale;
  updateTransform(smooth);
}

function resetView() {
  const rect = els.svg.getBoundingClientRect();
  const width = state.bounds.maxX - state.bounds.minX;
  const height = state.bounds.maxY - state.bounds.minY;
  const scale = clamp(Math.min(rect.width / width, rect.height / height) * 0.88, MIN_SCALE, 0.68);
  state.transform.scale = scale;
  state.transform.x = rect.width / 2 - ((state.bounds.minX + state.bounds.maxX) / 2) * scale;
  state.transform.y = rect.height / 2 - ((state.bounds.minY + state.bounds.maxY) / 2) * scale;
  updateTransform(true);
}

function updateTransform(smooth = false) {
  els.viewport.style.transition = smooth ? "transform 180ms ease" : "";
  els.viewport.setAttribute(
    "transform",
    `translate(${state.transform.x} ${state.transform.y}) scale(${state.transform.scale})`
  );
}

function familyParentPath(parent, hubX, hubY) {
  const startY = parent.y + 31;
  const midY = startY + (hubY - startY) * 0.65;
  return `M ${parent.x} ${startY} C ${parent.x} ${midY}, ${hubX} ${midY}, ${hubX} ${hubY}`;
}

function familyChildPath(hubX, hubY, child) {
  const endY = child.y - 31;
  const midY = hubY + (endY - hubY) * 0.35;
  return `M ${hubX} ${hubY} C ${hubX} ${midY}, ${child.x} ${midY}, ${child.x} ${endY}`;
}

function sidePath(source, target, offset) {
  const midX = (source.x + target.x) / 2;
  const sourceY = source.y + offset;
  const targetY = target.y + offset;
  return `M ${source.x} ${sourceY} C ${midX} ${sourceY - 34}, ${midX} ${targetY - 34}, ${target.x} ${targetY}`;
}

function svgEl(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function svgText(value, attributes = {}) {
  const element = svgEl("text", attributes);
  element.textContent = value;
  return element;
}

function chip(value) {
  const element = document.createElement("span");
  element.className = "inspector-chip";
  element.textContent = value;
  return element;
}

function normalizeGender(value) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("female")) return "female";
  if (normalized.includes("male")) return "male";
  return "unknown";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesNode(node, query) {
  return (
    normalizeText(node.displayName).includes(query) ||
    normalizeText(node.englishName).includes(query)
  );
}

function compareNodes(left, right) {
  return left.displayName.localeCompare(right.displayName, "fr") || left.id - right.id;
}

function uniqueSortedIds(ids) {
  return [...new Set(ids)].sort((left, right) => compareNodes(state.nodeById.get(left), state.nodeById.get(right)));
}

function hasPosition(node) {
  return Number.isFinite(node?.x) && Number.isFinite(node?.y);
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function truncateName(value) {
  return value.length > 18 ? `${value.slice(0, 17)}...` : value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
