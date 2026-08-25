/* global document, URLSearchParams, fetch, history, window */

const params = new URLSearchParams(window.location.search);

const state = {
  query: params.get("q") ?? "",
  language: params.get("language") ?? "all",
  bucket: params.get("bucket") ?? "top",
  rows: [],
  selectedId: Number.parseInt(params.get("id") ?? "", 10),
  summary: null,
  loading: false
};

const els = {
  search: document.querySelector("#reviewSearch"),
  languageButtons: [...document.querySelectorAll("[data-language]")],
  bucketButtons: [...document.querySelectorAll("[data-bucket]")],
  metrics: document.querySelector("#reviewMetrics"),
  resultCount: document.querySelector("#reviewResultCount"),
  resultList: document.querySelector("#reviewResultList"),
  entryDetail: document.querySelector("#reviewEntryDetail")
};

let searchTimer = 0;

els.search.value = state.query;
syncButtons();
wireEvents();
loadResults();

function wireEvents() {
  els.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = els.search.value.trim();
      state.selectedId = 0;
      loadResults();
    }, 180);
  });

  for (const button of els.languageButtons) {
    button.addEventListener("click", () => {
      state.language = button.dataset.language;
      state.selectedId = 0;
      syncButtons();
      loadResults();
    });
  }

  for (const button of els.bucketButtons) {
    button.addEventListener("click", () => {
      state.bucket = button.dataset.bucket;
      state.selectedId = 0;
      syncButtons();
      loadResults();
    });
  }
}

async function loadResults() {
  state.loading = true;
  renderResults();
  updateUrl();

  const requestParams = new URLSearchParams({
    q: state.query,
    language: state.language,
    bucket: state.bucket,
    limit: "200"
  });
  const response = await fetch(`/api/lexicon-v2/review-list?${requestParams}`);
  if (!response.ok) {
    renderError("Impossible de charger la revue produit.");
    return;
  }

  const payload = await response.json();
  state.rows = payload.rows ?? [];
  state.summary = payload.summary ?? null;
  state.loading = false;
  if (!state.selectedId && state.rows[0]) {
    state.selectedId = state.rows[0].id;
  }
  renderResults();
  if (state.selectedId) {
    loadEntry(state.selectedId);
  } else {
    renderEmptyDetail("Aucune entrée ne correspond aux filtres.");
  }
}

async function loadEntry(id) {
  state.selectedId = id;
  renderResults();
  updateUrl();
  renderEntryLoading();

  const response = await fetch(
    `/api/lexicon-v2/review-entry?id=${encodeURIComponent(id)}`
  );
  if (!response.ok) {
    renderEmptyDetail("Entrée introuvable.");
    return;
  }

  const payload = await response.json();
  renderEntry(payload.entry, payload.resources ?? []);
}

function renderResults() {
  els.resultCount.textContent = state.loading
    ? "Chargement"
    : `${formatNumber(state.rows.length)} entrée${state.rows.length > 1 ? "s" : ""}`;

  const summary = state.summary;
  els.metrics.replaceChildren(
    metric("Filtre", bucketLabel(state.bucket)),
    metric(
      "Résultats",
      state.loading ? "..." : formatNumber(state.rows.length)
    ),
    metric("Accepted", summary ? formatNumber(summary.accepted) : "..."),
    metric("Manual", summary ? formatNumber(summary.manualFixCount) : "...")
  );

  if (state.loading) {
    els.resultList.replaceChildren(
      ...Array.from({ length: 8 }, () => {
        const item = document.createElement("div");
        item.className = "result-skeleton";
        return item;
      })
    );
    return;
  }

  if (state.rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "Aucun résultat.";
    els.resultList.replaceChildren(empty);
    return;
  }

  els.resultList.replaceChildren(...state.rows.map(renderResultButton));
  scrollSelectedResultIntoView();
}

function renderResultButton(row) {
  const button = document.createElement("button");
  button.className = "result-item review-result-item";
  button.type = "button";
  button.dataset.id = String(row.id);
  if (row.id === state.selectedId) button.classList.add("is-selected");
  button.addEventListener("click", () => loadEntry(row.id));

  const top = document.createElement("span");
  top.className = "result-topline";
  const code = document.createElement("strong");
  code.textContent = row.eStrong;
  const score = document.createElement("span");
  score.textContent = `Score ${row.score}`;
  top.append(code, score);

  const title = document.createElement("span");
  title.className = "result-title";
  title.textContent = row.glossFr || row.glossEn || row.transliteration;

  const meta = document.createElement("span");
  meta.className = "result-meta";
  meta.textContent = [
    row.language === "greek" ? "Grec" : "Hébreu",
    `${formatNumber(row.sourceChars)} chars`,
    `${row.sourceReferenceCount} refs`,
    `ratio ${Number(row.lengthRatio).toFixed(2)}`
  ].join(" · ");

  const flags = document.createElement("span");
  flags.className = "review-flags";
  flags.append(...renderFlags(row.flags));

  const preview = document.createElement("span");
  preview.className = "result-preview";
  preview.textContent = row.previewFr || row.previewEn || "";

  button.append(top, title, meta, flags, preview);
  return button;
}

function renderEntry(entry, resources) {
  const header = document.createElement("header");
  header.className = "entry-header review-entry-header";

  const codeBlock = document.createElement("div");
  const code = document.createElement("p");
  code.className = "entry-code";
  code.textContent = `${entry.eStrong} · score ${entry.score}`;
  const title = document.createElement("h2");
  title.textContent = entry.glossFr || entry.glossEn || entry.eStrong;
  codeBlock.append(code, title);

  const badges = document.createElement("div");
  badges.className = "entry-badges";
  badges.append(
    badge(entry.language === "greek" ? "Grec" : "Hébreu"),
    badge(entry.status),
    ...renderFlags(entry.flags)
  );
  header.append(codeBlock, badges);

  const meta = document.createElement("dl");
  meta.className = "entry-meta review-entry-meta";
  appendMeta(meta, "Original", entry.original);
  appendMeta(meta, "Translit.", entry.transliteration);
  appendMeta(meta, "eStrong", entry.eStrong);
  appendMeta(meta, "dStrong", entry.dStrong);
  appendMeta(meta, "uStrong", entry.uStrong);
  appendMeta(meta, "Morph", entry.morph);
  appendMeta(
    meta,
    "Refs EN/FR",
    `${entry.sourceReferenceCount}/${entry.translatedReferenceCount}`
  );
  appendMeta(meta, "Ratio", Number(entry.lengthRatio).toFixed(2));
  appendMeta(
    meta,
    "Chars EN/FR",
    `${formatNumber(entry.sourceChars)}/${formatNumber(entry.translatedChars)}`
  );

  const compare = document.createElement("section");
  compare.className = "definition-grid review-definition-grid";
  compare.append(
    definitionPanel("English STEP", entry.glossEn, entry.meaningEn),
    definitionPanel(
      "Français V2",
      entry.glossFr,
      entry.meaningHtmlFr,
      entry.notesFr
    )
  );

  const resourcesBlock = renderResources(resources);
  els.entryDetail.className = "entry-detail review-entry-detail";
  els.entryDetail.replaceChildren(header, meta, compare, resourcesBlock);
}

function definitionPanel(label, gloss, meaning, notes = "") {
  const section = document.createElement("section");
  section.className = "definition-panel";

  const heading = document.createElement("h3");
  heading.textContent = label;

  const glossElement = document.createElement("p");
  glossElement.className = "definition-gloss";
  glossElement.textContent = gloss || "-";

  const meaningElement = document.createElement("div");
  meaningElement.className = "definition-meaning is-rich";
  meaningElement.innerHTML = meaning || "-";

  section.append(heading, glossElement, meaningElement);
  if (notes) {
    const notesElement = document.createElement("p");
    notesElement.className = "definition-notes";
    notesElement.textContent = notes;
    section.append(notesElement);
  }
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
    summary.textContent = `${resource.source} · ${resource.kind}`;
    const content = document.createElement("div");
    content.className = "resource-html";
    content.innerHTML = resource.contentHtml;
    details.append(summary, content);
    section.append(details);
  }
  return section;
}

function renderFlags(flags) {
  if (!flags || flags.length === 0) return [badge("stable")];
  return flags.map((flag) => {
    const span = badge(flagLabel(flag));
    span.classList.add(`flag-${flag.replace(/[^a-z0-9-]/gi, "")}`);
    return span;
  });
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
  els.resultCount.textContent = "Erreur";
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

function syncButtons() {
  for (const button of els.languageButtons) {
    button.classList.toggle(
      "is-active",
      button.dataset.language === state.language
    );
  }
  for (const button of els.bucketButtons) {
    button.classList.toggle(
      "is-active",
      button.dataset.bucket === state.bucket
    );
  }
}

function scrollSelectedResultIntoView() {
  if (!state.selectedId) return;
  const selected = els.resultList.querySelector(
    `[data-id="${state.selectedId}"]`
  );
  selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function updateUrl() {
  const nextParams = new URLSearchParams();
  if (state.query) nextParams.set("q", state.query);
  if (state.language !== "all") nextParams.set("language", state.language);
  if (state.bucket !== "top") nextParams.set("bucket", state.bucket);
  if (state.selectedId) nextParams.set("id", String(state.selectedId));
  history.replaceState(null, "", `?${nextParams.toString()}`);
}

function bucketLabel(bucket) {
  const labels = {
    all: "Toutes",
    top: "Top risque",
    critical: "Critiques",
    anomaly: "Anomalies",
    manual: "Manuelles",
    long: "Longues",
    refs: "Références"
  };
  return labels[bucket] ?? bucket;
}

function flagLabel(flag) {
  const labels = {
    "critical-strong": "critique",
    "manual-fix": "manuel",
    "long-entry": "long",
    "many-references": "refs",
    "ratio-low": "ratio bas",
    "ratio-high": "ratio haut",
    "residual-english": "anglais",
    "suspicious-name": "nom suspect",
    "validator-issue": "validateur"
  };
  return labels[flag] ?? flag;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
