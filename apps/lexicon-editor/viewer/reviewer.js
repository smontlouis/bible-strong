/* global document, fetch, URLSearchParams, window */

const state = {
  review: undefined,
  filter: "pending",
  search: "",
  bookFilter: "all"
};

const els = {
  reviewDropZone: document.querySelector("#reviewDropZone"),
  reviewFolderZone: document.querySelector("#reviewFolderZone"),
  reviewFileInput: document.querySelector("#reviewFileInput"),
  reviewFolderInput: document.querySelector("#reviewFolderInput"),
  reviewView: document.querySelector("#reviewView"),
  reviewTitle: document.querySelector("#reviewTitle"),
  fileName: document.querySelector("#fileName"),
  decisionFilters: document.querySelector("#decisionFilters"),
  reviewSearch: document.querySelector("#reviewSearch"),
  bookFilter: document.querySelector("#bookFilter"),
  nextBook: document.querySelector("#nextBook"),
  visibleCount: document.querySelector("#visibleCount"),
  stats: document.querySelector("#stats"),
  saveReview: document.querySelector("#saveReview"),
  saveStatus: document.querySelector("#saveStatus")
};

els.reviewFileInput.addEventListener("change", () => {
  const files = [...(els.reviewFileInput.files ?? [])];
  if (files.length > 0) loadReviewFiles(files);
});
els.reviewFolderInput.addEventListener("change", () => {
  const files = [...(els.reviewFolderInput.files ?? [])];
  if (files.length > 0) loadReviewFiles(files);
});
els.saveReview.addEventListener("click", saveReviewDecisions);
els.decisionFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  renderReview();
});
els.reviewSearch.addEventListener("input", () => {
  state.search = els.reviewSearch.value.trim().toLowerCase();
  renderReview();
});
els.bookFilter.addEventListener("change", () => {
  state.bookFilter = els.bookFilter.value;
  renderReview();
});
els.nextBook.addEventListener("click", () => {
  selectNextBookWithPendingItems();
});
els.reviewView.addEventListener("click", (event) => {
  const button = event.target.closest("[data-review-action]");
  if (button) {
    setReviewDecision(button.dataset.reviewId, button.dataset.reviewAction);
    return;
  }

  const word = event.target.closest("[data-review-word]");
  if (word) {
    setReviewWordTarget(word.dataset.reviewId, Number(word.dataset.reviewWord));
  }
});
els.reviewView.addEventListener("input", (event) => {
  const input = event.target.closest("[data-review-note]");
  if (input) {
    updateReviewNote(input.dataset.reviewNote, input.value);
    return;
  }

  const edit = event.target.closest("[data-review-edit]");
  if (edit) {
    updateReviewEdit(
      edit.dataset.reviewId,
      edit.dataset.reviewEdit,
      edit.value
    );
  }
});
els.reviewView.addEventListener("change", (event) => {
  const edit = event.target.closest("[data-review-edit]");
  if (edit) {
    updateReviewEdit(
      edit.dataset.reviewId,
      edit.dataset.reviewEdit,
      edit.value
    );
  }
});

wireDropZone(els.reviewDropZone, loadReviewFiles);
wireDropZone(els.reviewFolderZone, loadReviewFiles);
loadInitialReviewFromUrl();

async function loadInitialReviewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const manifestPath = params.get("manifest");
  const reviewPath = params.get("review");
  if (manifestPath) {
    const response = await fetch(manifestPath);
    if (!response.ok) {
      throw new Error(`Impossible de charger le manifest: ${manifestPath}`);
    }
    await loadManifestJson(await response.json(), manifestPath);
    return;
  }
  if (!reviewPath) return;

  const response = await fetch(reviewPath);
  if (!response.ok) {
    throw new Error(`Impossible de charger la revue LLM: ${reviewPath}`);
  }

  loadReviewJson(
    await response.json(),
    reviewPath.split("/").pop() ?? reviewPath
  );
}

async function loadReviewFiles(files) {
  const jsonFiles = files
    .filter((file) => file.name.endsWith(".json"))
    .sort((left, right) =>
      (left.webkitRelativePath || left.name).localeCompare(
        right.webkitRelativePath || right.name,
        undefined,
        { numeric: true }
      )
    );
  const reviews = [];
  for (const file of jsonFiles) {
    const json = JSON.parse(await file.text());
    if (isManifestJson(json)) {
      continue;
    }
    if (json?.items && Array.isArray(json.items)) {
      reviews.push({
        review: json,
        fileName: file.webkitRelativePath || file.name
      });
    }
  }
  loadReviewBatch(reviews);
}

async function loadManifestJson(manifest, manifestPath) {
  if (!isManifestJson(manifest)) {
    throw new Error("Le manifest doit contenir un tableau reviews.");
  }

  const reviews = [];
  for (const entry of manifest.reviews) {
    if (entry.status === "failed") continue;
    const reviewPath = entry.reviewHref ?? `/${entry.reviewPath}`;
    const response = await fetch(reviewPath);
    if (!response.ok) continue;
    reviews.push({
      review: await response.json(),
      fileName: reviewPath.split("/").pop() ?? reviewPath
    });
  }

  loadReviewBatch(reviews, manifestPath.split("/").pop() ?? manifestPath);
}

function loadReviewJson(review, fileName) {
  if (!review?.items || !Array.isArray(review.items)) {
    throw new Error("Le fichier de revue LLM doit contenir un tableau items.");
  }

  state.review = review;
  els.fileName.textContent = fileName;
  syncControls();
  renderReview();
}

function loadReviewBatch(reviews, fileName = undefined) {
  if (reviews.length === 0) {
    throw new Error("Aucun fichier llm-review-*.json valide trouvé.");
  }
  if (reviews.length === 1) {
    loadReviewJson(reviews[0].review, fileName ?? reviews[0].fileName);
    return;
  }

  const bible = reviews[0].review.bible;
  const items = reviews.flatMap(({ review, fileName: sourceFile }) =>
    review.items.map((item) => ({
      ...item,
      reviewSource: sourceFile
    }))
  );
  state.review = {
    generatedAt: new Date().toISOString(),
    bible,
    diagnosticsPath: reviews
      .map(({ review }) => review.diagnosticsPath)
      .join(", "),
    decisionsPath: "",
    instructions: [],
    items
  };
  state.bookFilter = "all";
  els.fileName.textContent = fileName ?? `${reviews.length} revues chargées`;
  syncControls();
  renderReview();
}

function syncControls() {
  els.saveReview.disabled = !state.review;
  els.nextBook.disabled = !state.review;
}

function renderReview() {
  const review = state.review;
  renderStats();
  renderFilters();
  syncControls();

  if (!review) return;

  const fragment = document.createDocumentFragment();
  const visibleItems = getVisibleItems();
  for (const item of visibleItems) {
    fragment.append(renderReviewCard(item));
  }

  els.reviewView.className = "chapter-view review-view";
  els.reviewView.replaceChildren(fragment);
  els.reviewTitle.textContent = `Revue LLM ${review.bible?.toUpperCase() ?? ""}`;

  if (review.items.length === 0) {
    els.reviewView.className = "chapter-view empty-state";
    els.reviewView.textContent =
      "Aucune suggestion LLM à revoir dans ce fichier.";
  } else if (visibleItems.length === 0) {
    els.reviewView.className = "chapter-view empty-state";
    els.reviewView.textContent = "Aucune suggestion ne correspond au filtre.";
  }
}

function renderReviewCard(item) {
  const card = document.createElement("section");
  const editable = isEditableReviewItem(item);
  card.className = `review-card is-${item.decision ?? "pending"}`;
  if (editable) {
    card.classList.add("is-editable");
  }

  const header = document.createElement("header");
  header.className = "review-card-header";

  const title = document.createElement("div");
  title.innerHTML = `<strong>${escapeText(item.ref)}</strong><span>${escapeText(item.word)} · ${escapeText(item.strong.join(" "))}</span>`;

  const status = document.createElement("span");
  status.className = "review-status";
  status.textContent = item.decision ?? "pending";
  header.append(title, status);

  const context = document.createElement("p");
  context.className = "review-context";
  for (const word of item.targetWords ?? []) {
    const token = document.createElement("span");
    token.textContent = word.text;
    token.title = `Index ${word.wordIndex} · ${word.normalized}`;
    token.className = "review-word";
    if (editable) {
      token.dataset.reviewId = item.id;
      token.dataset.reviewWord = String(word.wordIndex);
    }
    if (isTargetWord(item, word.wordIndex)) {
      token.classList.add("review-target");
    }
    context.append(token, document.createTextNode(" "));
  }

  const meta = document.createElement("dl");
  meta.className = "review-meta";
  meta.append(
    metaItem("Index", item.wordIndex),
    metaItem("Confiance", item.confidence),
    metaItem("Diagnostic", (item.reasons ?? []).join(", ") || "-"),
    metaItem("Raison LLM", item.llmReason || "-")
  );

  const note = document.createElement("input");
  note.type = "text";
  note.className = "review-note";
  note.placeholder = "Note de revue optionnelle";
  note.value = item.reviewerNote ?? "";
  note.dataset.reviewNote = item.id;

  const actions = document.createElement("div");
  actions.className = "review-buttons";
  actions.append(
    reviewButton(item.id, "accept", "Accepter", item.decision === "accept"),
    reviewButton(item.id, "reject", "Rejeter", item.decision === "reject"),
    reviewButton(
      item.id,
      "pending",
      "À revoir",
      (item.decision ?? "pending") === "pending"
    )
  );

  card.append(header, context, meta);
  if (editable) {
    card.append(renderCorrectionControls(item));
  }
  card.append(note, actions);
  return card;
}

function renderCorrectionControls(item) {
  const editable = isEditableReviewItem(item);
  const fieldset = document.createElement("fieldset");
  fieldset.className = "review-correction";
  fieldset.disabled = !editable;

  const legend = document.createElement("legend");
  legend.textContent = editable
    ? "Correction manuelle"
    : "Correction verrouillée";

  const targetLabel = editLabel("Type de cible");
  const target = document.createElement("select");
  target.dataset.reviewId = item.id;
  target.dataset.reviewEdit = "target";
  for (const [value, label] of [
    ["word", "Mot"],
    ["phrase", "Phrase"],
    ["empty", "Vide"]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = getItemTarget(item) === value;
    target.append(option);
  }
  targetLabel.append(target);

  const indexLabel = editLabel("Index cible");
  const index = document.createElement("input");
  index.type = "number";
  index.min = "0";
  index.step = "1";
  index.value = String(item.wordIndex);
  index.dataset.reviewId = item.id;
  index.dataset.reviewEdit = "wordIndex";
  indexLabel.append(index);

  const wordLabel = editLabel("Mot normalisé");
  const word = document.createElement("input");
  word.type = "text";
  word.value = item.normalized ?? "";
  word.dataset.reviewId = item.id;
  word.dataset.reviewEdit = "normalized";
  wordLabel.append(word);

  const strongLabel = editLabel("Strong");
  const strong = document.createElement("input");
  strong.type = "text";
  strong.value = (item.strong ?? []).join(" ");
  strong.placeholder = "H8033";
  strong.dataset.reviewId = item.id;
  strong.dataset.reviewEdit = "strong";
  strongLabel.append(strong);

  const startLabel = editLabel("Début phrase");
  const start = document.createElement("input");
  start.type = "number";
  start.min = "0";
  start.step = "1";
  start.value = String(item.startWordIndex ?? item.wordIndex);
  start.dataset.reviewId = item.id;
  start.dataset.reviewEdit = "startWordIndex";
  start.disabled = getItemTarget(item) !== "phrase";
  startLabel.append(start);

  const endLabel = editLabel("Fin phrase");
  const end = document.createElement("input");
  end.type = "number";
  end.min = "0";
  end.step = "1";
  end.value = String(item.endWordIndex ?? item.wordIndex);
  end.dataset.reviewId = item.id;
  end.dataset.reviewEdit = "endWordIndex";
  end.disabled = getItemTarget(item) !== "phrase";
  endLabel.append(end);

  const phraseLabel = editLabel("Phrase normalisée");
  const phrase = document.createElement("input");
  phrase.type = "text";
  phrase.value = getNormalizedPhrase(item).join(" ");
  phrase.dataset.reviewId = item.id;
  phrase.dataset.reviewEdit = "normalizedPhrase";
  phrase.disabled = getItemTarget(item) !== "phrase";
  phraseLabel.append(phrase);

  fieldset.append(
    legend,
    targetLabel,
    indexLabel,
    wordLabel,
    startLabel,
    endLabel,
    phraseLabel,
    strongLabel
  );
  return fieldset;
}

function editLabel(text) {
  const label = document.createElement("label");
  label.textContent = text;
  return label;
}

function renderStats() {
  const items = state.review?.items ?? [];
  const accepted = items.filter((item) => item.decision === "accept").length;
  const rejected = items.filter((item) => item.decision === "reject").length;
  const pending = items.length - accepted - rejected;

  setStats([
    ["Suggestions", items.length],
    ["Acceptées", accepted],
    ["Rejetées", rejected],
    ["À revoir", pending]
  ]);
}

function renderFilters() {
  const items = state.review?.items ?? [];
  const counts = getDecisionCounts(items);
  for (const button of els.decisionFilters.querySelectorAll("[data-filter]")) {
    const filter = button.dataset.filter;
    button.classList.toggle("is-active", filter === state.filter);
    const label = getFilterLabel(filter);
    button.textContent = `${label} ${formatNumber(counts[filter] ?? 0)}`;
  }

  const visible = state.review ? getVisibleItems().length : 0;
  renderBookFilter(items);
  els.visibleCount.textContent = state.review
    ? `${formatNumber(visible)} affichée(s) sur ${formatNumber(items.length)}`
    : "-";
}

function renderBookFilter(items) {
  const books = [...new Set(items.map((item) => getItemBook(item)))].filter(
    Boolean
  );
  const current = books.includes(state.bookFilter) ? state.bookFilter : "all";
  if (current !== state.bookFilter) state.bookFilter = current;

  els.bookFilter.replaceChildren(
    option("all", "Tous les livres"),
    ...books.map((book) => {
      const pendingCount = items.filter(
        (item) =>
          getItemBook(item) === book &&
          (item.decision ?? "pending") === "pending"
      ).length;
      return option(book, `${book} (${formatNumber(pendingCount)})`);
    })
  );
  els.bookFilter.value = state.bookFilter;
}

function getVisibleItems() {
  const items = state.review?.items ?? [];
  return items.filter(
    (item) =>
      matchesDecisionFilter(item) &&
      matchesBookFilter(item) &&
      matchesSearch(item)
  );
}

function matchesDecisionFilter(item) {
  if (state.filter === "all") return true;
  return (item.decision ?? "pending") === state.filter;
}

function matchesBookFilter(item) {
  return state.bookFilter === "all" || getItemBook(item) === state.bookFilter;
}

function matchesSearch(item) {
  if (!state.search) return true;
  const haystack = [
    item.ref,
    item.word,
    item.normalized,
    item.strong?.join(" "),
    item.llmReason,
    ...(item.reasons ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(state.search);
}

function getDecisionCounts(items) {
  const counts = {
    pending: 0,
    accept: 0,
    reject: 0,
    all: items.length
  };
  for (const item of items) {
    counts[item.decision ?? "pending"] += 1;
  }
  return counts;
}

function getFilterLabel(filter) {
  return (
    {
      pending: "À revoir",
      accept: "Acceptées",
      reject: "Rejetées",
      all: "Tout"
    }[filter] ?? filter
  );
}

function selectNextBookWithPendingItems() {
  const items = state.review?.items ?? [];
  const books = [...new Set(items.map((item) => getItemBook(item)))].filter(
    Boolean
  );
  if (books.length === 0) return;

  const currentIndex = Math.max(0, books.indexOf(state.bookFilter));
  const candidates = [
    ...books.slice(currentIndex + 1),
    ...books.slice(0, currentIndex + 1)
  ];
  const nextBook = candidates.find((book) =>
    items.some(
      (item) =>
        getItemBook(item) === book && (item.decision ?? "pending") === "pending"
    )
  );
  if (!nextBook) return;
  state.filter = "pending";
  state.bookFilter = nextBook;
  renderReview();
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function getItemBook(item) {
  return item.ref?.split(".")[0] ?? "";
}

function isManifestJson(value) {
  return Boolean(value?.reviews && Array.isArray(value.reviews));
}

function setStats(values) {
  els.stats.replaceChildren(
    ...values.map(([label, value]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = formatNumber(value);
      row.append(dt, dd);
      return row;
    })
  );
}

function setReviewDecision(id, decision) {
  if (!state.review) return;
  const item = state.review.items.find((candidate) => candidate.id === id);
  if (!item) return;
  item.decision = decision;
  setSaveStatus("");
  renderReview();
}

function setReviewWordTarget(id, wordIndex) {
  if (!state.review || !Number.isInteger(wordIndex)) return;
  const item = state.review.items.find((candidate) => candidate.id === id);
  if (!item || !isEditableReviewItem(item)) return;
  const word = item.targetWords?.find(
    (candidate) => candidate.wordIndex === wordIndex
  );
  if (!word) return;

  if (getItemTarget(item) === "phrase") {
    setPhraseRangeFromClick(item, wordIndex);
    setSaveStatus("");
    renderReview();
    return;
  }

  item.wordIndex = word.wordIndex;
  item.word = word.text;
  item.normalized = word.normalized;
  item.reviewerNote = replaceCorrectionNote(
    item.reviewerNote,
    `Correction manuelle: cible déplacée vers "${word.text}" (index ${word.wordIndex}).`
  );
  setSaveStatus("");
  renderReview();
}

function updateReviewNote(id, value) {
  if (!state.review) return;
  const item = state.review.items.find((candidate) => candidate.id === id);
  if (item) item.reviewerNote = value;
}

function updateReviewEdit(id, field, value) {
  if (!state.review) return;
  const item = state.review.items.find((candidate) => candidate.id === id);
  if (!item || !isEditableReviewItem(item)) return;

  if (field === "target") {
    item.target = value === "phrase" || value === "empty" ? value : "word";
    if (item.target === "phrase") {
      item.startWordIndex = item.startWordIndex ?? item.wordIndex;
      item.endWordIndex = item.endWordIndex ?? item.wordIndex;
      updateNormalizedPhrase(item);
    }
  } else if (field === "wordIndex") {
    const wordIndex = Number.parseInt(value, 10);
    if (!Number.isInteger(wordIndex)) return;
    const word = item.targetWords?.find(
      (candidate) => candidate.wordIndex === wordIndex
    );
    item.wordIndex = wordIndex;
    if (word) {
      item.word = word.text;
      item.normalized = word.normalized;
    }
  } else if (field === "normalized") {
    item.normalized = normalizeEditableWord(value);
    item.word = value;
  } else if (field === "startWordIndex" || field === "endWordIndex") {
    const wordIndex = Number.parseInt(value, 10);
    if (!Number.isInteger(wordIndex)) return;
    item.target = "phrase";
    item[field] = wordIndex;
    normalizePhraseRange(item);
    updateNormalizedPhrase(item);
  } else if (field === "normalizedPhrase") {
    item.target = "phrase";
    item.normalizedPhrase = String(value)
      .split(/\s+/u)
      .map(normalizeEditableWord)
      .filter(Boolean);
  } else if (field === "strong") {
    item.strong = parseStrongList(value);
  }

  setSaveStatus("");
  renderReview();
}

function getItemTarget(item) {
  if (item.target === "phrase" || item.target === "empty") return item.target;
  if (item.decision === "accept-empty") return "empty";
  return "word";
}

function isTargetWord(item, wordIndex) {
  if (getItemTarget(item) === "phrase") {
    const startWordIndex = item.startWordIndex ?? item.wordIndex;
    const endWordIndex = item.endWordIndex ?? item.wordIndex;
    return wordIndex >= startWordIndex && wordIndex <= endWordIndex;
  }

  return wordIndex === item.wordIndex;
}

function setPhraseRangeFromClick(item, wordIndex) {
  item.target = "phrase";
  const startWordIndex = item.startWordIndex ?? item.wordIndex;
  if ((item.endWordIndex ?? startWordIndex) === startWordIndex) {
    item.startWordIndex = Math.min(startWordIndex, wordIndex);
    item.endWordIndex = Math.max(startWordIndex, wordIndex);
  } else {
    item.startWordIndex = Math.min(startWordIndex, wordIndex);
    item.endWordIndex = Math.max(startWordIndex, wordIndex);
  }
  normalizePhraseRange(item);
  updateNormalizedPhrase(item);
  item.reviewerNote = replaceCorrectionNote(
    item.reviewerNote,
    `Correction manuelle: cible déplacée vers la phrase "${getPhraseText(item)}" (index ${item.startWordIndex}-${item.endWordIndex}).`
  );
}

function normalizePhraseRange(item) {
  const words = item.targetWords ?? [];
  const maxIndex = Math.max(0, words.length - 1);
  const start = Math.max(
    0,
    Math.min(maxIndex, item.startWordIndex ?? item.wordIndex)
  );
  const end = Math.max(
    0,
    Math.min(maxIndex, item.endWordIndex ?? item.wordIndex)
  );
  item.startWordIndex = Math.min(start, end);
  item.endWordIndex = Math.max(start, end);
}

function updateNormalizedPhrase(item) {
  item.normalizedPhrase = getPhraseWords(item).map((word) => word.normalized);
  item.wordIndex = item.startWordIndex ?? item.wordIndex;
  item.normalized = item.normalizedPhrase.join(" ");
  item.word = getPhraseText(item);
}

function getNormalizedPhrase(item) {
  if (item.normalizedPhrase?.length) return item.normalizedPhrase;
  return getPhraseWords(item).map((word) => word.normalized);
}

function getPhraseWords(item) {
  const startWordIndex = item.startWordIndex ?? item.wordIndex;
  const endWordIndex = item.endWordIndex ?? item.wordIndex;
  return (item.targetWords ?? []).filter(
    (word) => word.wordIndex >= startWordIndex && word.wordIndex <= endWordIndex
  );
}

function getPhraseText(item) {
  return getPhraseWords(item)
    .map((word) => word.text)
    .join(" ");
}

async function saveReviewDecisions() {
  if (!state.review) return;
  els.saveReview.disabled = true;
  setSaveStatus("Enregistrement...");

  try {
    const response = await fetch("/api/llm-review/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReviewDecisionPayload())
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "save-failed");
    setSaveStatus(
      `Enregistré: ${result.accepted} ajout(s), ${result.skipped} déjà présent(s)/ignoré(s).`,
      "success"
    );
  } catch (error) {
    setSaveStatus(
      `Erreur: ${error instanceof Error ? error.message : "échec de l'enregistrement"}`,
      "error"
    );
  } finally {
    syncControls();
  }
}

function buildReviewDecisionPayload() {
  return {
    bible: state.review.bible,
    generatedAt: new Date().toISOString(),
    sourceReview: state.review.diagnosticsPath,
    approvedOverrides: state.review.items
      .filter((item) => item.decision === "accept")
      .map((item) => ({
        bible: item.bible,
        ref: item.ref,
        target: getItemTarget(item),
        wordIndex: item.wordIndex,
        normalized: item.normalized,
        startWordIndex: item.startWordIndex,
        endWordIndex: item.endWordIndex,
        normalizedPhrase: item.normalizedPhrase,
        strong: item.strong,
        confidence: Math.min(0.92, Math.max(0.72, item.confidence)),
        source:
          getItemTarget(item) === "phrase"
            ? "llm-review:human-approved-phrase"
            : getItemTarget(item) === "empty"
              ? "llm-review:human-approved-empty"
              : "llm-review:human-approved",
        reason: [item.llmReason, item.reviewerNote].filter(Boolean).join(" | ")
      })),
    items: state.review.items.map((item) => ({
      id: item.id,
      bible: item.bible,
      ref: item.ref,
      target: getItemTarget(item),
      wordIndex: item.wordIndex,
      normalized: item.normalized,
      startWordIndex: item.startWordIndex,
      endWordIndex: item.endWordIndex,
      normalizedPhrase: item.normalizedPhrase,
      word: item.word,
      strong: item.strong,
      confidence: item.confidence,
      decision: item.decision,
      reviewerNote: item.reviewerNote,
      llmReason: item.llmReason
    }))
  };
}

function parseStrongList(value) {
  return String(value)
    .split(/[\s,;+]+/u)
    .map((strong) => strong.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeEditableWord(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "");
}

function replaceCorrectionNote(existing, nextCorrection) {
  return [
    ...String(existing ?? "")
      .split(" | ")
      .map((part) => part.trim())
      .filter(
        (part) =>
          part && !part.startsWith("Correction manuelle: cible déplacée")
      ),
    nextCorrection
  ].join(" | ");
}

function isEditableReviewItem(item) {
  return (item.decision ?? "pending") === "pending";
}

function reviewButton(id, action, label, active) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = `review-action review-action-${action}`;
  if (active) button.classList.add("is-active");
  button.dataset.reviewId = id;
  button.dataset.reviewAction = action;
  return button;
}

function metaItem(label, value) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = String(value);
  row.append(dt, dd);
  return row;
}

function setSaveStatus(message, kind = "") {
  els.saveStatus.textContent = message;
  els.saveStatus.className = `save-status ${kind}`.trim();
}

function wireDropZone(element, callback) {
  for (const eventName of ["dragenter", "dragover"]) {
    element.addEventListener(eventName, (event) => {
      event.preventDefault();
      element.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    element.addEventListener(eventName, (event) => {
      event.preventDefault();
      element.classList.remove("is-dragging");
    });
  }
  element.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) callback(file);
  });
}

function escapeText(value) {
  const span = document.createElement("span");
  span.textContent = String(value);
  return span.innerHTML;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
