/* global document, URLSearchParams, fetch, history, window */

const urlParams = new URLSearchParams(window.location.search);
const LETTERS = ["all", ..."abcdefghijklmnopqrstuvwxyz"];

const state = {
  query: urlParams.get("q") ?? "",
  language: normalizeLanguage(urlParams.get("language") ?? "greek"),
  letter: normalizeLetter(urlParams.get("letter") ?? "all"),
  rows: [],
  selectedId: Number.parseInt(urlParams.get("id") ?? "", 10),
  loading: false,
  entryLoading: false
};

const els = {
  dictionaryPanel: document.querySelector("#dictionaryPanel"),
  dictionaryResults: document.querySelector("#dictionaryResults"),
  entryPage: document.querySelector("#entryPage"),
  form: document.querySelector("#lexiconSearchForm"),
  search: document.querySelector("#lexiconSearch"),
  languageSelect: document.querySelector("#languageSelect"),
  letterFilter: document.querySelector("#letterFilter"),
  metrics: document.querySelector("#lexiconMetrics"),
  resultList: document.querySelector("#resultList"),
  entryDetail: document.querySelector("#entryDetail"),
  backToList: document.querySelector("#backToList"),
  previousEntry: document.querySelector("#previousEntry"),
  nextEntry: document.querySelector("#nextEntry"),
  entryPosition: document.querySelector("#entryPosition")
};

els.search.value = state.query;
els.languageSelect.value = state.language;
renderLetterFilter();
wireEvents();
loadResults();

function wireEvents() {
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = els.search.value.trim();
    state.language = normalizeLanguage(els.languageSelect.value);
    state.selectedId = 0;
    loadResults();
  });

  els.languageSelect.addEventListener("change", () => {
    state.language = normalizeLanguage(els.languageSelect.value);
    state.selectedId = 0;
    loadResults();
  });

  els.backToList.addEventListener("click", () => {
    state.selectedId = 0;
    updateUrl();
    renderPageMode();
    renderResults();
  });

  els.previousEntry.addEventListener("click", () => {
    const previous = getAdjacentRow(-1);
    if (previous) openEntry(previous.id);
  });

  els.nextEntry.addEventListener("click", () => {
    const next = getAdjacentRow(1);
    if (next) openEntry(next.id);
  });
}

async function loadResults() {
  state.loading = true;
  renderPageMode();
  renderResults();
  updateUrl();

  const params = new URLSearchParams({
    q: state.query,
    language: state.language,
    limit: "500"
  });
  if (state.letter !== "all") params.set("letter", state.letter);

  const response = await fetch(`/api/lexicon/search?${params}`);
  if (!response.ok) {
    renderError("Impossible de charger le lexique.");
    return;
  }

  const payload = await response.json();
  state.rows = payload.rows ?? [];
  state.loading = false;
  renderPageMode();
  renderResults();
  if (state.selectedId) {
    loadEntry(state.selectedId);
  }
}

async function loadEntry(id) {
  state.selectedId = id;
  state.entryLoading = true;
  renderPageMode();
  window.scrollTo({ top: 0, left: 0 });
  updateUrl();
  updateEntryNavigation();
  renderEntryLoading();

  const response = await fetch(
    `/api/lexicon/entry?id=${encodeURIComponent(id)}`
  );
  if (!response.ok) {
    state.entryLoading = false;
    renderEmptyDetail("Entrée introuvable.");
    updateEntryNavigation();
    return;
  }

  const payload = await response.json();
  state.entryLoading = false;
  renderEntry(payload.entry, payload.resources ?? []);
  updateEntryNavigation();
}

function openEntry(id) {
  loadEntry(id);
}

function renderLetterFilter() {
  els.letterFilter.replaceChildren(
    ...LETTERS.map((letter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "letter-button";
      button.dataset.letter = letter;
      button.textContent = letter === "all" ? "[a-z]" : letter;
      button.classList.toggle("is-active", state.letter === letter);
      button.addEventListener("click", () => {
        state.letter = letter;
        state.selectedId = 0;
        renderLetterFilter();
        loadResults();
      });
      return button;
    })
  );
}

function renderResults() {
  els.metrics.replaceChildren(
    metric("Langue", languageLabel(state.language)),
    metric("Résultats", state.loading ? "..." : formatNumber(state.rows.length))
  );

  if (state.loading) {
    const skeleton = document.createElement("div");
    skeleton.className = "dictionary-loading";
    skeleton.textContent = "Chargement du lexique...";
    els.resultList.replaceChildren(skeleton);
    return;
  }

  if (state.rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "Aucun résultat.";
    els.resultList.replaceChildren(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "dictionary-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of [
    "Code strong",
    "Mot translittéré",
    "Généralement traduit par"
  ]) {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.append(th);
  }
  thead.append(headerRow);

  const tbody = document.createElement("tbody");
  tbody.replaceChildren(...state.rows.map(renderTableRow));
  table.append(thead, tbody);
  els.resultList.replaceChildren(table);
  scrollSelectedRowIntoView();
}

function renderTableRow(row) {
  const tr = document.createElement("tr");
  tr.className = "dictionary-row";
  tr.dataset.id = String(row.id);
  if (row.id === state.selectedId) tr.classList.add("is-selected");
  tr.addEventListener("click", () => openEntry(row.id));

  const code = document.createElement("td");
  const codeLink = document.createElement("button");
  codeLink.type = "button";
  codeLink.className = "table-link";
  codeLink.textContent = displayStrongCode(row.eStrong);
  code.append(codeLink);

  const transliteration = document.createElement("td");
  const transliterationLink = document.createElement("button");
  transliterationLink.type = "button";
  transliterationLink.className = "table-link";
  transliterationLink.textContent = displayTransliteration(row);
  transliteration.append(transliterationLink);

  const gloss = document.createElement("td");
  gloss.textContent = row.glossFr || row.glossEn || "-";

  tr.append(code, transliteration, gloss);
  return tr;
}

function renderEntry(entry, resources) {
  const header = document.createElement("header");
  header.className = "entry-header";

  const codeBlock = document.createElement("div");
  const code = document.createElement("p");
  code.className = "entry-code";
  code.textContent = `${entry.eStrong} · ${displayTransliteration(entry)}`;
  const title = document.createElement("h2");
  title.textContent = entry.glossFr || entry.glossEn || entry.eStrong;
  codeBlock.append(code, title);

  const badges = document.createElement("div");
  badges.className = "entry-badges";
  badges.append(
    badge(entry.language === "greek" ? "Grec" : "Hébreu"),
    badge(entry.glossFr || entry.meaningHtmlFr ? "FR" : "non traduit")
  );
  header.append(codeBlock, badges);

  const meta = document.createElement("dl");
  meta.className = "entry-meta";
  appendMeta(meta, "Original", entry.original);
  appendMeta(meta, "Translit. classique", entry.classicTransliteration);
  appendMeta(meta, "Prononciation", entry.pronunciation);
  appendMeta(meta, "Translit. STEP", entry.transliteration);
  appendMeta(meta, "eStrong", entry.eStrong);
  appendMeta(meta, "dStrong", entry.dStrong);
  appendMeta(meta, "uStrong", entry.uStrong);
  appendMeta(meta, "Morph", entry.morph);

  const compare = document.createElement("section");
  compare.className = "definition-grid definition-grid-three";
  compare.append(
    definitionPanel("English STEP", entry.glossEn, entry.meaningEn, {
      renderMeaningHtml: true
    }),
    definitionPanel("Français simple", entry.glossFr, entry.meaningSimpleFr),
    definitionPanel("Français HTML", entry.glossFr, entry.meaningHtmlFr, {
      renderMeaningHtml: true
    })
  );

  const resourcesBlock = renderResources(resources);
  els.entryDetail.className = "entry-detail";
  els.entryDetail.replaceChildren(header, meta, compare, resourcesBlock);
}

function renderPageMode() {
  const isDetail = Boolean(state.selectedId);
  els.dictionaryPanel.hidden = isDetail;
  els.dictionaryResults.hidden = isDetail;
  els.entryPage.hidden = !isDetail;
}

function definitionPanel(label, gloss, meaning, options = {}) {
  const section = document.createElement("section");
  section.className = "definition-panel";

  const heading = document.createElement("h3");
  heading.textContent = label;

  const glossElement = document.createElement("p");
  glossElement.className = "definition-gloss";
  glossElement.textContent = gloss || "-";

  const meaningElement = document.createElement("div");
  meaningElement.className = "definition-meaning";
  if (options.renderMeaningHtml && meaning) {
    meaningElement.classList.add("is-rich");
    meaningElement.innerHTML = meaning;
  } else {
    meaningElement.textContent = meaning || "-";
  }

  section.append(heading, glossElement, meaningElement);
  return section;
}

function renderResources(resources) {
  const section = document.createElement("section");
  section.className = "resources-panel";
  const heading = document.createElement("h3");
  heading.textContent = "Ressources étendues";
  section.append(heading);

  if (resources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted-line";
    empty.textContent = "Aucune ressource étendue pour cette entrée.";
    section.append(empty);
    return section;
  }

  for (const resource of resources) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${resource.source} · ${resource.kind}${resource.contentHtmlFr ? " · FR" : ""}`;
    const content = document.createElement("div");
    content.className = "resource-html";
    content.innerHTML = resource.contentHtmlFr || resource.contentHtml;
    details.append(summary, content);
    section.append(details);
  }
  return section;
}

function renderEntryLoading() {
  els.entryDetail.className = "entry-detail empty-detail";
  els.entryDetail.replaceChildren(textBlock("Chargement de l'entrée..."));
}

function renderEmptyDetail(message) {
  els.entryDetail.className = "entry-detail empty-detail";
  els.entryDetail.replaceChildren(textBlock(message));
}

function renderError(message) {
  state.loading = false;
  const error = document.createElement("div");
  error.className = "result-empty";
  error.textContent = message;
  els.resultList.replaceChildren(error);
  renderEmptyDetail(message);
}

function textBlock(message) {
  const p = document.createElement("p");
  p.textContent = message;
  return p;
}

function appendMeta(parent, label, value) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = value || "-";
  row.append(dt, dd);
  parent.append(row);
}

function badge(value) {
  const span = document.createElement("span");
  span.className = "entry-badge";
  span.textContent = value;
  return span;
}

function metric(label, value) {
  const span = document.createElement("span");
  span.textContent = `${label}: ${value}`;
  return span;
}

function updateUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  params.set("language", state.language);
  if (state.letter !== "all") params.set("letter", state.letter);
  if (state.selectedId) params.set("id", String(state.selectedId));
  history.replaceState(null, "", `?${params.toString()}`);
}

function scrollSelectedRowIntoView() {
  if (!state.selectedId) return;
  const selected = els.resultList.querySelector(
    `[data-id="${state.selectedId}"]`
  );
  selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function getCurrentRowIndex() {
  return state.rows.findIndex((row) => row.id === state.selectedId);
}

function getAdjacentRow(direction) {
  const index = getCurrentRowIndex();
  if (index === -1) return null;
  return state.rows[index + direction] ?? null;
}

function updateEntryNavigation() {
  const index = getCurrentRowIndex();
  const total = state.rows.length;
  const hasContext = index >= 0 && total > 0;
  const previous = getAdjacentRow(-1);
  const next = getAdjacentRow(1);

  els.previousEntry.disabled = state.entryLoading || !previous;
  els.nextEntry.disabled = state.entryLoading || !next;
  els.entryPosition.textContent = hasContext
    ? `${formatNumber(index + 1)} / ${formatNumber(total)}`
    : "Hors liste";
}

function displayStrongCode(value) {
  const match = /^([GH])0*(\d+)([A-Z]?)$/i.exec(value ?? "");
  if (!match) return value || "-";
  return `${Number.parseInt(match[2], 10)}${match[3] ?? ""}`;
}

function displayTransliteration(entry) {
  return (
    entry.classicTransliteration ||
    entry.transliteration ||
    entry.original ||
    "-"
  );
}

function normalizeLanguage(value) {
  return value === "hebrew" ? "hebrew" : "greek";
}

function normalizeLetter(value) {
  return /^[a-z]$/.test(value) ? value : "all";
}

function languageLabel(language) {
  return language === "hebrew" ? "Hébreu" : "Grec";
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
