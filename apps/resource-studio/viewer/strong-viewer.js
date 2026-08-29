/* global document, Node, HTMLElement, URL, fetch, window */

const bookNames = {
  Gen: "Genèse",
  Exod: "Exode",
  Lev: "Lévitique",
  Num: "Nombres",
  Deut: "Deutéronome",
  Josh: "Josué",
  Judg: "Juges",
  Ruth: "Ruth",
  "1Sam": "1 Samuel",
  "2Sam": "2 Samuel",
  "1Kgs": "1 Rois",
  "2Kgs": "2 Rois",
  "1Chr": "1 Chroniques",
  "2Chr": "2 Chroniques",
  Ezra: "Esdras",
  Neh: "Néhémie",
  Esth: "Esther",
  Job: "Job",
  Ps: "Psaumes",
  Prov: "Proverbes",
  Eccl: "Ecclésiaste",
  Song: "Cantique",
  Isa: "Ésaïe",
  Jer: "Jérémie",
  Lam: "Lamentations",
  Ezek: "Ézéchiel",
  Dan: "Daniel",
  Hos: "Osée",
  Joel: "Joël",
  Amos: "Amos",
  Obad: "Abdias",
  Jonah: "Jonas",
  Mic: "Michée",
  Nah: "Nahum",
  Hab: "Habacuc",
  Zeph: "Sophonie",
  Hag: "Aggée",
  Zech: "Zacharie",
  Mal: "Malachie",
  Matt: "Matthieu",
  Mark: "Marc",
  Luke: "Luc",
  John: "Jean",
  Acts: "Actes",
  Rom: "Romains",
  "1Cor": "1 Corinthiens",
  "2Cor": "2 Corinthiens",
  Gal: "Galates",
  Eph: "Éphésiens",
  Phil: "Philippiens",
  Col: "Colossiens",
  "1Thess": "1 Thessaloniciens",
  "2Thess": "2 Thessaloniciens",
  "1Tim": "1 Timothée",
  "2Tim": "2 Timothée",
  Titus: "Tite",
  Phlm: "Philémon",
  Heb: "Hébreux",
  Jas: "Jacques",
  "1Pet": "1 Pierre",
  "2Pet": "2 Pierre",
  "1John": "1 Jean",
  "2John": "2 Jean",
  "3John": "3 Jean",
  Jude: "Jude",
  Rev: "Apocalypse"
};

const bookOrder = Object.keys(bookNames);
const sourceInfo = {
  "reference-transfer": {
    label: "Témoin direct",
    tooltip:
      "Strong repris directement depuis une Bible témoin locale : Sg1910, Darby ou DarbyR."
  },
  "reference-learned": {
    label: "Témoin appris",
    tooltip:
      "Strong placé par une correspondance déterministe apprise depuis les Bibles témoins locales."
  },
  "reference-backed-original": {
    label: "Témoin via original",
    tooltip:
      "Strong attendu par les témoins et confirmé par l'inventaire original TAHOT/TAGNT."
  },
  "dictionary-fr": {
    label: "Dictionnaire FR",
    tooltip:
      "Strong proposé par le dictionnaire Strong français local ou le lexique français de production."
  },
  "phrase-transfer": {
    label: "Expression témoin",
    tooltip:
      "Strong placé sur une expression française multi-mots apprise depuis les Bibles témoins."
  },
  "semantic-lexicon": {
    label: "Lexique FR validé",
    tooltip:
      "Placement auto-safe validé par des sources lexicales françaises déterministes : dictionnaire, lemmatisation, synonymes externes, Kaikki, WOLF, OpenOffice ou RezoJDM selon disponibilité."
  },
  "original-complete": {
    label: "Original TAHOT/TAGNT",
    tooltip:
      "Strong venant de l'inventaire original STEP Bible : TAHOT pour l'hébreu/araméen, TAGNT pour le grec. Ce n'est pas Macula."
  },
  "curated-override": {
    label: "Correction revue",
    tooltip:
      "Placement issu d'une décision validée manuellement ou via workflow de revue."
  },
  "manual-review": {
    label: "Revue humaine",
    tooltip: "Placement validé par une revue humaine explicite."
  },
  "llm-review": {
    label: "LLM revu",
    tooltip:
      "Suggestion LLM acceptée après validation. Le LLM n'est pas utilisé comme source brute."
  }
};

const metricInfo = {
  "Témoins présents":
    "Nombre de Strong attendus par les Bibles témoins locales qui existent dans le ledger, qu'ils soient placés sur texte ou laissés en Strong vide.",
  "Témoins sur texte":
    "Parmi les Strong des témoins, nombre placé sur un mot ou une expression française. Les Strong vides ne comptent pas.",
  "Original TAHOT/TAGNT sur texte":
    "Parmi les Strong de l'inventaire original STEP Bible, nombre placé sur un mot ou une expression française. TAHOT couvre l'hébreu/araméen, TAGNT le grec. Ce n'est pas Macula.",
  "À revoir":
    "Strong valides mais encore à expliquer : Strong sans mot français, risques de placement ou Strong techniques.",
  "Exp. lexicale":
    "Ancienne métrique d'expérience lexicale, conservée seulement quand le fichier chargé en contient.",
  "Candidats restants":
    "Suggestions déterministes restantes qui n'ont pas été insérées automatiquement, souvent à cause d'une ambiguïté ou d'un conflit.",
  Normal:
    "Vue reader : Strong lisibles, principalement alignés avec le style des Bibles témoins.",
  Advanced:
    "Vue d'étude : ajoute les Strong de l'inventaire original TAHOT/TAGNT, y compris ceux que les témoins ne portent pas.",
  Vides:
    "Strong valide attendu, mais aucun porteur français fiable n'a été trouvé.",
  Techniques:
    "Strong grammatical ou structurel, souvent sans équivalent français direct.",
  Risques:
    "Placements à surveiller, par exemple plusieurs Strong sur un même mot."
};

const evidenceSourceInfo = {
  "seed-term": {
    label: "Terme lexical direct",
    tooltip:
      "Le mot français correspond directement à un terme lexical connu pour ce Strong."
  },
  "seed-stem": {
    label: "Racine lexicale",
    tooltip:
      "La racine ou le lemme français correspond à un terme lexical connu pour ce Strong."
  },
  "number-component": {
    label: "Composant numérique",
    tooltip:
      "Correspondance mécanique entre un nombre français composé et une valeur numérique de l'original."
  },
  "kaikki-gloss": {
    label: "Kaikki",
    tooltip: "Signal lexical issu des glosses françaises/lexicales Kaikki."
  },
  "proper-name-step": {
    label: "Nom propre TAHOT/TAGNT",
    tooltip:
      "Nom propre détecté depuis les glosses/translittérations de l'original STEP Bible : TAHOT ou TAGNT."
  },
  "proper-name-dictionary": {
    label: "Nom propre dictionnaire",
    tooltip: "Nom propre confirmé par le dictionnaire/lexique Strong local."
  },
  "openoffice-synonyms": {
    label: "Synonymes OpenOffice",
    tooltip:
      "Lien de synonymie issu du thésaurus français OpenOffice. Utilisé comme signal, pas comme preuve suffisante seul."
  },
  wolf: {
    label: "WOLF",
    tooltip:
      "Lien lexical issu de WOLF, ressource WordNet-like française. Utilisé comme signal, pas comme preuve suffisante seul."
  },
  rezojdm: {
    label: "RezoJDM",
    tooltip:
      "Lien lexical issu du cache RezoJDM. Utilisé comme signal, pas comme preuve suffisante seul."
  },
  "french-auxiliary-phrase": {
    label: "Expression verbale française",
    tooltip:
      "Phrase auxiliaire + participe, par exemple « avait façonné », reconnue comme porteur français complet."
  }
};

const state = {
  rows: [],
  enriched: null,
  lexicalReport: null,
  lexicalByRef: new Map(),
  books: [],
  currentBook: "",
  currentChapter: "",
  search: "",
  viewMode: "normal",
  selectedStrong: "",
  selectedToken: null,
  lexiconCache: new Map()
};

const els = {
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  bookSelect: document.querySelector("#bookSelect"),
  chapterSelect: document.querySelector("#chapterSelect"),
  searchInput: document.querySelector("#searchInput"),
  viewModeSelect: document.querySelector("#viewModeSelect"),
  chapterView: document.querySelector("#chapterView"),
  chapterTitle: document.querySelector("#chapterTitle"),
  fileName: document.querySelector("#fileName"),
  stats: document.querySelector("#stats"),
  prevChapter: document.querySelector("#prevChapter"),
  nextChapter: document.querySelector("#nextChapter"),
  lexiconDrawer: document.querySelector("#lexiconDrawer")
};

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files?.[0];
  if (file) loadFile(file);
});

wireDropZone(els.dropZone, loadFile);
els.bookSelect.addEventListener("change", () => {
  state.currentBook = els.bookSelect.value;
  state.currentChapter = firstChapter(state.currentBook);
  syncControls();
  render();
});
els.chapterSelect.addEventListener("change", () => {
  state.currentChapter = els.chapterSelect.value;
  render();
});
els.searchInput.addEventListener("input", () => {
  state.search = els.searchInput.value.trim().toLocaleLowerCase("fr-FR");
  render();
});
els.viewModeSelect.addEventListener("change", () => {
  state.viewMode = els.viewModeSelect.value;
  if (state.enriched) {
    state.rows = rowsFromEnriched(state.enriched, state.viewMode);
  }
  render();
});
els.prevChapter.addEventListener("click", () => moveChapter(-1));
els.nextChapter.addEventListener("click", () => moveChapter(1));
els.chapterView.addEventListener("click", (event) => {
  const token = getStrongTokenFromEventTarget(event.target);
  if (!token) return;
  void openLexiconDrawer(token);
});
els.chapterView.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const token = getStrongTokenFromEventTarget(event.target);
  if (!token) return;
  event.preventDefault();
  void openLexiconDrawer(token);
});

void loadInitialFileFromQuery();

async function loadFile(file) {
  const text = await file.text();
  await loadText(text, file.name);
}

async function loadInitialFileFromQuery() {
  const url = new URL(window.location.href);
  const filePath = url.searchParams.get("file");
  if (!filePath) return;

  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Impossible de charger ${filePath}: ${response.status}`);
  }

  await loadText(await response.text(), filePath.split("/").pop() || filePath, {
    filePath,
    lexicalPath: url.searchParams.get("lexical")
  });
}

async function loadText(text, fileName, options = {}) {
  state.enriched = await parseEnrichedFile(text);
  state.lexicalReport = state.enriched
    ? await loadLexicalReport(
        options.lexicalPath ?? inferLexicalReportPath(state.enriched)
      )
    : null;
  state.lexicalByRef = groupLexicalItemsByRef(state.lexicalReport);
  state.rows = state.enriched
    ? rowsFromEnriched(state.enriched, state.viewMode)
    : parseStrongFile(text);
  state.books = [...new Set(state.rows.map((row) => row.bookId))].sort(
    compareBooks
  );
  state.currentBook = state.books[0] ?? "";
  state.currentChapter = firstChapter(state.currentBook);
  state.search = "";
  els.fileName.textContent = fileName;
  els.searchInput.value = "";
  els.viewModeSelect.value = state.viewMode;
  syncControls();
  render();
}

async function loadLexicalReport(filePath) {
  if (!filePath) return null;
  const response = await fetch(asServedPath(filePath));
  if (!response.ok) return null;
  const payload = await response.json();
  return Array.isArray(payload.items) ? payload : null;
}

function inferLexicalReportPath(payload) {
  if (!payload?.bible || !payload?.scope) return null;
  const scopeSlug = String(payload.scope).replace(/[^\p{L}\p{N}.-]+/gu, "_");
  return `/outputs/lexical-candidates/${payload.bible}/bible-${payload.bible}-lexical-candidates-${scopeSlug}.json`;
}

function groupLexicalItemsByRef(report) {
  const byRef = new Map();
  for (const item of report?.items ?? []) {
    const entries = byRef.get(item.ref) ?? [];
    entries.push(item);
    byRef.set(item.ref, entries);
  }
  return byRef;
}

async function parseEnrichedFile(text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{")) return null;

  try {
    const payload = JSON.parse(trimmed);
    if (!Array.isArray(payload.verses)) return null;
    if (!payload.verses.every((verse) => verse.views)) return null;
    if (payload.split && Array.isArray(payload.verseFiles)) {
      payload.verses = (
        await Promise.all(
          payload.verseFiles.map(async (file) => {
            const response = await fetch(asServedPath(file.path));
            if (!response.ok) {
              throw new Error(
                `Impossible de charger ${file.path}: ${response.status}`
              );
            }
            return response.json();
          })
        )
      ).flat();
    }
    return payload;
  } catch {
    return null;
  }
}

function asServedPath(filePath) {
  if (String(filePath).startsWith("/")) return filePath;
  return `/${filePath}`;
}

function rowsFromEnriched(payload, mode) {
  return payload.verses.map((verse) => ({
    ref: verse.ref,
    bookId: verse.bookId,
    chapter: verse.chapter,
    verse: verse.verse,
    text:
      mode === "normal"
        ? verse.views.readerHtml
        : mode === "debug"
          ? (verse.views.debugHtml ?? verse.views.advancedHtml)
          : verse.views.advancedHtml,
    tokens: verse.tokens ?? [],
    enrichedMetrics: verse.metrics,
    lexicalItems: state.lexicalByRef.get(verse.ref) ?? [],
    annotations: verse.annotations ?? []
  }));
}

function parseStrongFile(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const delimiter = detectDelimiter(lines[0] ?? "");
  const header = parseDelimitedLine(lines.shift() ?? "", delimiter).map(
    normalizeHeader
  );
  const indexes = {
    bookId: header.indexOf("book_id"),
    chapter: header.indexOf("num_chapter"),
    verse: header.indexOf("num_verse"),
    text: header.indexOf("text")
  };

  if (Object.values(indexes).some((index) => index === -1)) {
    throw new Error(
      "Le fichier doit contenir book_id, num_chapter, num_verse, text."
    );
  }

  return lines
    .map((line) => {
      const columns = parseDelimitedLine(line, delimiter);
      return {
        bookId: columns[indexes.bookId],
        chapter: Number.parseInt(columns[indexes.chapter], 10),
        verse: Number.parseInt(columns[indexes.verse], 10),
        text: columns.slice(indexes.text).join("\t")
      };
    })
    .filter(
      (row) =>
        row.bookId && Number.isFinite(row.chapter) && Number.isFinite(row.verse)
    );
}

function detectDelimiter(headerLine) {
  return ["\t", ";", ","]
    .map((delimiter) => ({
      delimiter,
      columns: parseDelimitedLine(headerLine, delimiter).length
    }))
    .sort((a, b) => b.columns - a.columns)[0].delimiter;
}

function parseDelimitedLine(line, delimiter) {
  const columns = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      columns.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  columns.push(current);
  return columns;
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, "").trim();
}

function syncControls() {
  const hasRows = state.rows.length > 0;
  els.bookSelect.disabled = !hasRows;
  els.chapterSelect.disabled = !hasRows;
  els.searchInput.disabled = !hasRows;
  els.viewModeSelect.disabled = !state.enriched;
  els.prevChapter.disabled = !hasRows || !getAdjacentChapter(-1);
  els.nextChapter.disabled = !hasRows || !getAdjacentChapter(1);
  els.viewModeSelect.value = state.viewMode;

  els.bookSelect.replaceChildren(
    ...state.books.map((bookId) =>
      option(bookId, `${bookId} · ${bookNames[bookId] ?? bookId}`)
    )
  );
  els.bookSelect.value = state.currentBook;

  const chapters = chaptersForBook(state.currentBook);
  els.chapterSelect.replaceChildren(
    ...chapters.map((chapter) => option(chapter, chapter))
  );
  els.chapterSelect.value = state.currentChapter;
}

function render() {
  renderStats();
  syncControls();
  if (state.rows.length === 0) return;

  const rows = state.rows.filter(
    (row) =>
      row.bookId === state.currentBook &&
      String(row.chapter) === String(state.currentChapter)
  );
  const visibleRows = state.search ? rows.filter(matchesSearch) : rows;
  const fragment = document.createDocumentFragment();

  for (const row of visibleRows) {
    const verse = document.createElement("p");
    verse.className = "verse";
    verse.dataset.ref = `${row.bookId}.${row.chapter}.${row.verse}`;

    const number = document.createElement("span");
    number.className = "verse-number";
    number.textContent = row.verse;
    verse.append(number, ...renderTaggedHtml(row));
    fragment.append(verse);
    if (row.lexicalItems?.length) {
      fragment.append(renderLexicalCandidates(row));
    }
  }

  els.chapterView.className = "chapter-view";
  els.chapterView.replaceChildren(fragment);
  els.chapterTitle.textContent = `${bookNames[state.currentBook] ?? state.currentBook} ${state.currentChapter}`;

  if (visibleRows.length === 0) {
    els.chapterView.className = "chapter-view empty-state";
    els.chapterView.textContent = "Aucun verset ne correspond à la recherche.";
  }
}

function renderLexicalCandidates(row) {
  const panel = document.createElement("div");
  panel.className = "lexical-candidate-panel";

  const toolbar = document.createElement("div");
  toolbar.className = "lexical-candidate-toolbar";

  const title = document.createElement("span");
  title.className = "lexical-candidate-title";
  const highOpenCount = row.lexicalItems.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter((candidate) =>
        isDefaultVisibleLexicalCandidate(item, candidate)
      ).length,
    0
  );
  const autoSafeCount = row.lexicalItems.filter(isLexicalAutoSafeItem).length;
  const groupAutoSafeCount = row.lexicalItems.filter(
    (item) => item.groupAutoSafe
  ).length;
  const hiddenCandidateCount = row.lexicalItems.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter(
        (candidate) => !isDefaultVisibleLexicalCandidate(item, candidate)
      ).length,
    0
  );
  title.textContent = `Candidats déterministes · ${highOpenCount} visibles · ${autoSafeCount} auto-validés${
    groupAutoSafeCount > 0 ? ` · ${groupAutoSafeCount} groupés` : ""
  }`;
  title.title =
    "Suggestions déterministes restantes. Par défaut, seuls les candidats high et non occupés sont affichés ; le bouton + montre aussi les candidats occupés ou moins sûrs.";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "lexical-candidate-toggle";
  toggle.textContent = "+";
  toggle.title = `Afficher ${hiddenCandidateCount} candidats occupés ou moins sûrs`;
  toggle.setAttribute("aria-label", toggle.title);
  toggle.hidden = hiddenCandidateCount === 0;

  const list = document.createElement("div");
  list.className = "lexical-candidate-list";

  let expanded = false;
  const renderList = () => {
    const items = row.lexicalItems
      .map((item) => renderLexicalCandidateItem(item, expanded))
      .filter(Boolean);
    list.replaceChildren(
      ...(items.length > 0
        ? items
        : [lexicalCandidateEmptyState("Aucun candidat high ouvert")])
    );
    panel.classList.toggle("is-expanded", expanded);
    toggle.textContent = expanded ? "-" : "+";
    toggle.title = expanded
      ? "Masquer les candidats occupés ou moins sûrs"
      : `Afficher ${hiddenCandidateCount} candidats occupés ou moins sûrs`;
    toggle.setAttribute("aria-label", toggle.title);
  };

  toggle.addEventListener("click", () => {
    expanded = !expanded;
    renderList();
  });

  toolbar.append(title, toggle);
  panel.append(toolbar, list);
  renderList();
  return panel;
}

function renderLexicalCandidateItem(item, expanded) {
  const visibleCandidates = expanded
    ? item.candidates.slice(0, 5)
    : item.candidates.filter((candidate) =>
        isDefaultVisibleLexicalCandidate(item, candidate)
      );
  if (visibleCandidates.length === 0) return null;

  const section = document.createElement("section");
  section.className = `lexical-candidate-item is-${item.auditKind}`;
  if (item.groupAutoSafe) section.classList.add("is-group-auto-safe");

  const header = document.createElement("div");
  header.className = "lexical-candidate-header";

  const title = document.createElement("strong");
  title.textContent = `${item.strong} · ${
    item.auditKind === "empty" ? "Strong vide" : "relocation"
  }${item.groupAutoSafe ? " · groupe sûr" : ""}`;
  title.title =
    item.auditKind === "empty"
      ? "Strong valide attendu, mais pas encore placé sur un porteur français fiable."
      : "Strong déjà visible, mais le rapport voit peut-être un meilleur porteur français.";

  const meta = document.createElement("span");
  meta.textContent = item.groupAutoSafe
    ? `assigné: ${item.groupAutoSafe.assignedWordIndex} ${item.groupAutoSafe.assignedText}`
    : item.currentTarget
      ? `actuel: ${item.currentTarget.wordIndex} ${item.currentTarget.text}`
      : item.insertAfterWordIndex !== undefined
        ? `après mot ${item.insertAfterWordIndex}`
        : "";

  header.append(title, meta);

  const candidates = document.createElement("div");
  candidates.className = "lexical-candidate-chips";
  candidates.replaceChildren(
    ...visibleCandidates.map((candidate) =>
      renderLexicalCandidateChip(item, candidate)
    )
  );

  section.append(header, candidates);
  return section;
}

function renderLexicalCandidateChip(item, candidate) {
  const chip = document.createElement("span");
  chip.className = `lexical-candidate-chip is-${candidate.confidence}`;
  if (candidate.occupied) chip.classList.add("is-occupied");
  if (isLexicalAutoSafeCandidate(item, candidate)) {
    chip.classList.add("is-auto-safe");
  }
  if (isLexicalGroupAutoSafeCandidate(item, candidate)) {
    chip.classList.add("is-group-auto-safe");
  }
  chip.title = candidate.evidence.map(formatEvidenceTooltip).join("\n");
  chip.textContent = `${lexicalCandidateTargetLabel(candidate)} ${candidate.text} · ${Math.round(
    candidate.score * 100
  )}%${candidate.occupied ? " · occupé" : ""}`;
  return chip;
}

function formatEvidenceTooltip(evidence) {
  const info = evidenceSourceInfo[evidence.source];
  return [
    info?.label ?? evidence.source,
    evidence.detail,
    info?.tooltip ? `Info: ${info.tooltip}` : ""
  ]
    .filter(Boolean)
    .join(" - ");
}

function lexicalCandidateTargetLabel(candidate) {
  if (
    candidate.target === "phrase" &&
    candidate.startWordIndex !== undefined &&
    candidate.endWordIndex !== undefined
  ) {
    return `${candidate.startWordIndex}-${candidate.endWordIndex}`;
  }
  return String(candidate.wordIndex);
}

function lexicalCandidateEmptyState(text) {
  const empty = document.createElement("div");
  empty.className = "lexical-candidate-empty";
  empty.textContent = text;
  return empty;
}

function isUsefulLexicalCandidate(candidate) {
  return (
    candidate.confidence === "high" &&
    (!candidate.occupied || isStackSafeLexicalCandidate(candidate))
  );
}

function isDefaultVisibleLexicalCandidate(item, candidate) {
  if (item.groupAutoSafe) {
    return isLexicalGroupAutoSafeCandidate(item, candidate);
  }
  return isUsefulLexicalCandidate(candidate);
}

function lexicalWordHighlights(row) {
  const highlights = new Map();
  for (const item of row.lexicalItems ?? []) {
    if (item.groupAutoSafe) {
      addLexicalWordHighlight(highlights, {
        start: item.groupAutoSafe.assignedWordIndex,
        end: item.groupAutoSafe.assignedWordIndex,
        kind: "group",
        label: `${item.strong} groupe sûr`
      });
      continue;
    }

    for (const candidate of item.candidates ?? []) {
      if (!isDefaultVisibleLexicalCandidate(item, candidate)) continue;
      addLexicalWordHighlight(highlights, {
        start:
          candidate.target === "phrase" &&
          candidate.startWordIndex !== undefined
            ? candidate.startWordIndex
            : candidate.wordIndex,
        end:
          candidate.target === "phrase" && candidate.endWordIndex !== undefined
            ? candidate.endWordIndex
            : candidate.wordIndex,
        kind: isLexicalAutoSafeCandidate(item, candidate)
          ? "auto"
          : "candidate",
        label: `${item.strong} ${Math.round(candidate.score * 100)}%`
      });
    }
  }
  return highlights;
}

function addLexicalWordHighlight(highlights, highlight) {
  for (let index = highlight.start; index <= highlight.end; index += 1) {
    const entry = highlights.get(index) ?? { kinds: new Set(), labels: [] };
    entry.kinds.add(highlight.kind);
    entry.labels.push(highlight.label);
    highlights.set(index, entry);
  }
}

function consumeRenderedWordRange(context, text) {
  const count = [...text.matchAll(WORD_PATTERN)].length;
  if (count === 0) return null;
  const start = consumeRenderedWordIndex(context);
  let end = start;
  for (let index = 1; index < count; index += 1) {
    end = consumeRenderedWordIndex(context);
  }
  return { start, end };
}

function consumeRenderedWordIndex(context) {
  const fallback = context.nextWordIndex;
  const token = context.tokens[context.nextWordIndex];
  context.nextWordIndex += 1;
  return token?.wordIndex ?? fallback;
}

function applyLexicalWordHighlight(
  element,
  highlights,
  startWordIndex,
  endWordIndex
) {
  const entries = [];
  for (let index = startWordIndex; index <= endWordIndex; index += 1) {
    const entry = highlights.get(index);
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) return;

  element.classList.add("lexical-word-marker");
  const kindPriority = ["group", "auto", "candidate"];
  const kind =
    kindPriority.find((candidate) =>
      entries.some((entry) => entry.kinds.has(candidate))
    ) ?? "candidate";
  element.classList.add(`is-lexical-${kind}`);
  const labels = [...new Set(entries.flatMap((entry) => entry.labels))];
  element.title = [element.title, `Candidat lexical: ${labels.join(", ")}`]
    .filter(Boolean)
    .join("\n");
}

function renderTaggedHtml(row) {
  const template = document.createElement("template");
  template.innerHTML = row.text.replace(/\\n/g, "\n");
  const context = {
    tokens: row.tokens ?? [],
    nextWordIndex: 0,
    highlights: lexicalWordHighlights(row)
  };
  return [...template.content.childNodes].flatMap((node) =>
    renderNode(node, context)
  );
}

function renderNode(node, context) {
  if (node.nodeType === Node.TEXT_NODE) {
    return renderTextNodeWords(node.textContent ?? "", context);
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName.toLowerCase() === "w") {
    return [renderStrongToken(node, context)];
  }
  return [...node.childNodes].flatMap((child) => renderNode(child, context));
}

const WORD_PATTERN =
  /[\p{L}\p{M}\p{N}]+(?:(?:[’']|[‐‑‒–—-])[\p{L}\p{M}\p{N}]+)*/gu;

function renderTextNodeWords(text, context) {
  const nodes = [];
  let cursor = 0;

  for (const match of text.matchAll(WORD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(document.createTextNode(text.slice(cursor, index)));
    }

    const word = match[0];
    const wordIndex = consumeRenderedWordIndex(context);
    const span = document.createElement("span");
    span.textContent = word;
    span.dataset.wordIndex = String(wordIndex);
    applyLexicalWordHighlight(span, context.highlights, wordIndex, wordIndex);
    nodes.push(span);
    cursor = index + word.length;
  }

  if (cursor < text.length) {
    nodes.push(document.createTextNode(text.slice(cursor)));
  }

  return nodes;
}

function renderStrongToken(node, context) {
  const strong = node.getAttribute("strong") ?? "";
  const lexiconEnabled = node.getAttribute("data-lexicon") !== "false";
  const stepStrong = node.getAttribute("data-step-strong") ?? "";
  const stepStatus = node.getAttribute("data-step-status") ?? "";
  const sourceStrong = node.getAttribute("data-source-strong") ?? "";
  const experiment = node.getAttribute("data-experiment") ?? "";
  const isEmpty =
    node.getAttribute("data-empty") === "true" ||
    (node.textContent ?? "").trim().length === 0;
  const token = document.createElement("span");
  const renderedWordRange = consumeRenderedWordRange(
    context,
    node.textContent ?? ""
  );
  token.dataset.strong = strong;
  token.dataset.lexicon = lexiconEnabled ? "true" : "false";
  token.dataset.stepStrong = stepStrong;
  token.dataset.sourceStrong = sourceStrong;
  token.dataset.method = node.getAttribute("data-method") ?? "";
  token.dataset.source = node.getAttribute("data-source") ?? "";
  token.dataset.placement = node.getAttribute("data-placement") ?? "";
  token.dataset.target = node.getAttribute("data-target") ?? "";
  token.dataset.confidence = node.getAttribute("data-confidence") ?? "";
  token.dataset.experiment = experiment;
  if (renderedWordRange) {
    token.dataset.wordIndex = String(renderedWordRange.start);
    token.dataset.endWordIndex = String(renderedWordRange.end);
  }
  if (lexiconEnabled) {
    token.tabIndex = 0;
    token.role = "button";
  }
  token.title = [
    strong,
    stepStrong ? `Entrée TAHOT/TAGNT ${stepStrong}` : "",
    sourceStrong ? `Source ${sourceStrong}` : "",
    token.dataset.source ? `Origine ${sourceLabel(token.dataset.source)}` : "",
    token.dataset.source ? sourceTooltip(token.dataset.source) : "",
    stepStatus ? `Statut original TAHOT/TAGNT: ${stepStatus}` : "",
    experiment ? `Expérience ${experiment}` : "",
    node.getAttribute("data-method"),
    node.getAttribute("data-step-method"),
    node.getAttribute("data-original-token")
  ]
    .filter(Boolean)
    .join(" · ");

  if (isEmpty) {
    token.className = "empty-token";
    applyTokenStateClasses(token);
    if (experiment) token.classList.add("is-experiment");
    if (!lexiconEnabled) token.classList.add("is-static");
    if (isSelectedStrong(strong)) token.classList.add("is-selected");
    if (renderedWordRange) {
      applyLexicalWordHighlight(
        token,
        context.highlights,
        renderedWordRange.start,
        renderedWordRange.end
      );
    }
    token.append(renderSup(strong));
    return token;
  }

  token.className = "token";
  applyTokenStateClasses(token);
  if (experiment) token.classList.add("is-experiment");
  if (!lexiconEnabled) token.classList.add("is-static");
  if (isSelectedStrong(strong)) token.classList.add("is-selected");
  if (matchesTokenSearch(node.textContent ?? "", strong)) {
    token.classList.add("highlight");
  }
  if (renderedWordRange) {
    applyLexicalWordHighlight(
      token,
      context.highlights,
      renderedWordRange.start,
      renderedWordRange.end
    );
  }
  token.append(
    document.createTextNode(node.textContent ?? ""),
    renderSup(strong)
  );
  return token;
}

function applyTokenStateClasses(token) {
  for (const source of (token.dataset.source ?? "").split("+")) {
    if (source) token.classList.add(`source-${safeClassSuffix(source)}`);
  }
  for (const placement of (token.dataset.placement ?? "").split("+")) {
    if (placement) {
      token.classList.add(`placement-${safeClassSuffix(placement)}`);
    }
  }
}

function safeClassSuffix(value) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function getStrongTokenFromEventTarget(target) {
  if (!(target instanceof HTMLElement)) return null;
  const token = target.closest("[data-strong]");
  if (!(token instanceof HTMLElement)) return null;
  return token.dataset.lexicon === "false" ? null : token;
}

function isSelectedStrong(strong) {
  return (
    state.selectedStrong &&
    strong.split(/\s+/).filter(Boolean).includes(state.selectedStrong)
  );
}

async function openLexiconDrawer(token) {
  const strongCodes = (token.dataset.strong ?? "").split(/\s+/).filter(Boolean);
  const selectedStrong = strongCodes[0] ?? "";
  if (!selectedStrong) return;

  state.selectedToken?.classList.remove("is-selected");
  state.selectedStrong = selectedStrong;
  state.selectedToken = token;
  token.classList.add("is-selected");
  renderLexiconLoading(selectedStrong, strongCodes, token);

  const payload = await loadLexiconEntry(
    lookupStrongForToken(token, selectedStrong)
  );
  renderLexiconEntry({
    selectedStrong,
    strongCodes,
    token,
    payload
  });
}

async function loadLexiconEntry(strong) {
  if (state.lexiconCache.has(strong)) return state.lexiconCache.get(strong);

  const language = strong.startsWith("H") ? "hebrew" : "greek";
  const searchResponse = await fetch(
    `/api/lexicon/search?q=${encodeURIComponent(strong)}&language=${language}&limit=10`
  );
  if (!searchResponse.ok) {
    const payload = { error: "search-failed" };
    state.lexiconCache.set(strong, payload);
    return payload;
  }

  const search = await searchResponse.json();
  const rows = search.rows ?? [];
  const row =
    rows.find((candidate) => isSameStrong(candidate.eStrong, strong)) ??
    rows.find((candidate) => isSameStrong(candidate.dStrong, strong)) ??
    rows.find((candidate) => isSameStrong(candidate.uStrong, strong)) ??
    rows[0];
  if (!row?.id) {
    const payload = { error: "not-found" };
    state.lexiconCache.set(strong, payload);
    return payload;
  }

  const entryResponse = await fetch(
    `/api/lexicon/entry?id=${encodeURIComponent(row.id)}`
  );
  if (!entryResponse.ok) {
    const payload = { error: "entry-failed" };
    state.lexiconCache.set(strong, payload);
    return payload;
  }

  const payload = await entryResponse.json();
  state.lexiconCache.set(strong, payload);
  return payload;
}

function isSameStrong(left, right) {
  return normalizeStrongCode(left) === normalizeStrongCode(right);
}

function normalizeStrongCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^([GH])0+(\d)/, "$1$2");
}

function lookupStrongForToken(token, selectedStrong) {
  const stepCodes = (token.dataset.stepStrong ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (stepCodes.length === 1) return stepCodes[0];

  const normalizedSelected = normalizeStrongCode(selectedStrong).replace(
    /[A-Z]+$/u,
    ""
  );
  return (
    stepCodes.find(
      (code) =>
        normalizeStrongCode(code).replace(/[A-Z]+$/u, "") === normalizedSelected
    ) ?? selectedStrong
  );
}

function renderLexiconLoading(strong, strongCodes, token) {
  els.lexiconDrawer.replaceChildren(
    drawerHeader(strong, strongCodes, token),
    drawerSection("Chargement", textBlock("Recherche dans le lexique FR..."))
  );
}

function renderLexiconEntry({ selectedStrong, strongCodes, token, payload }) {
  if (payload?.error) {
    els.lexiconDrawer.replaceChildren(
      drawerHeader(selectedStrong, strongCodes, token),
      drawerSection(
        "Lexique FR",
        textBlock("Aucune fiche française trouvée pour ce Strong.")
      )
    );
    return;
  }

  const entry = payload.entry ?? {};
  const resources = (payload.resources ?? []).filter(
    (resource) => resource.contentHtmlFr || resource.contentTextFr
  );
  const meaningHtml =
    entry.meaningHtmlFr || htmlFromText(entry.meaningSimpleFr);
  const hasFrenchEntry = Boolean(
    entry.glossFr || meaningHtml || resources.length
  );

  els.lexiconDrawer.replaceChildren(
    drawerHeader(selectedStrong, strongCodes, token, entry),
    ...(hasFrenchEntry
      ? [
          entry.glossFr
            ? drawerSection("Glose", textBlock(entry.glossFr))
            : null,
          meaningHtml ? drawerHtmlSection("Définition", meaningHtml) : null,
          resources.length > 0
            ? drawerResourcesSection("Ressources FR", resources)
            : null
        ].filter(Boolean)
      : [
          drawerSection(
            "Lexique FR",
            textBlock(
              "Cette entrée existe, mais aucune traduction française n'est disponible."
            )
          )
        ])
  );
}

function drawerHeader(strong, strongCodes, token, entry = {}) {
  const header = document.createElement("div");
  header.className = "drawer-header";

  const kicker = document.createElement("p");
  kicker.className = "drawer-kicker";
  kicker.textContent = "Lexique FR";

  const title = document.createElement("h2");
  title.textContent = strong;

  const word = document.createElement("p");
  word.className = "drawer-token";
  word.textContent = (token.textContent ?? "").replace(/\s+/g, " ").trim();

  const meta = document.createElement("dl");
  meta.className = "drawer-meta";
  meta.append(
    ...[
      metaItem("Code", displayStrongCode(entry.eStrong || strong)),
      entry.transliteration
        ? metaItem("Translittération", entry.transliteration)
        : null,
      token.dataset.stepStrong
        ? metaItem("TAHOT/TAGNT", token.dataset.stepStrong)
        : null,
      token.dataset.sourceStrong
        ? metaItem("Source originale", token.dataset.sourceStrong)
        : null,
      token.dataset.source
        ? metaItem("Origine placement", sourceLabel(token.dataset.source))
        : null,
      token.dataset.method ? metaItem("Méthode", token.dataset.method) : null,
      token.dataset.experiment
        ? metaItem("Expérience", token.dataset.experiment)
        : null,
      token.dataset.confidence
        ? metaItem("Confiance", token.dataset.confidence)
        : null
    ].filter(Boolean)
  );

  const switcher = document.createElement("div");
  switcher.className = "drawer-strong-switcher";
  switcher.replaceChildren(
    ...strongCodes.map((code) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = code;
      button.classList.toggle("is-active", code === strong);
      button.addEventListener("click", () => {
        state.selectedStrong = code;
        renderLexiconLoading(code, strongCodes, token);
        loadLexiconEntry(lookupStrongForToken(token, code)).then((payload) =>
          renderLexiconEntry({
            selectedStrong: code,
            strongCodes,
            token,
            payload
          })
        );
      });
      return button;
    })
  );

  header.append(kicker, title, word);
  if (strongCodes.length > 1) header.append(switcher);
  header.append(meta);
  return header;
}

function drawerSection(title, content) {
  const section = document.createElement("section");
  section.className = "drawer-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading, content);
  return section;
}

function drawerHtmlSection(title, html) {
  const content = document.createElement("div");
  content.className = "drawer-rich-text";
  content.innerHTML = html;
  return drawerSection(title, content);
}

function sourceLabel(source) {
  return source
    .split("+")
    .filter(Boolean)
    .map((item) => sourceInfo[item]?.label ?? item)
    .join(" + ");
}

function sourceTooltip(source) {
  return source
    .split("+")
    .filter(Boolean)
    .map((item) => sourceInfo[item]?.tooltip ?? "")
    .filter(Boolean)
    .join("\n");
}

function drawerResourcesSection(title, resources) {
  const wrapper = document.createElement("div");
  wrapper.className = "drawer-resource-list";
  wrapper.replaceChildren(
    ...resources.map((resource) => {
      const item = document.createElement("article");
      item.className = "drawer-resource";
      const source = document.createElement("strong");
      source.textContent = [resource.source, resource.kind]
        .filter(Boolean)
        .join(" · ");
      const body = document.createElement("div");
      body.className = "drawer-rich-text";
      body.innerHTML =
        resource.contentHtmlFr || htmlFromText(resource.contentTextFr);
      item.append(source, body);
      return item;
    })
  );
  return drawerSection(title, wrapper);
}

function textBlock(text) {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  return paragraph;
}

function metaItem(label, value) {
  if (!value) return null;
  const wrapper = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  wrapper.append(dt, dd);
  return wrapper;
}

function htmlFromText(text) {
  if (!text) return "";
  return String(text)
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSup(strong) {
  const sup = document.createElement("sup");
  sup.textContent = strong.split(/\s+/).map(formatStrong).join(",");
  return sup;
}

function renderStats() {
  if (state.enriched?.metrics) {
    const rows = currentScopeRows();
    const metrics = aggregateEnrichedMetrics(rows);
    renderEnrichedStats(metrics);
    return;
  }

  const rows = currentScopeRows();
  const tagCount = rows.reduce(
    (sum, row) => sum + countMatches(row.text, /<w\b/gi),
    0
  );
  const emptyCount = rows.reduce(
    (sum, row) =>
      sum + countMatches(row.text, /data-empty="true"|<w\b[^>]*><\/w>/gi),
    0
  );
  setStats([
    ["Versets", rows.length],
    ["Tags", tagCount],
    ["Vides", emptyCount],
    ["Mots taggés", Math.max(0, tagCount - emptyCount)]
  ]);
}

function renderEnrichedStats(metrics) {
  const lexicalPlaced = metrics.lexicalExperimentPlacedCount ?? 0;
  const lexicalRemaining = metrics.emptyStrongCount ?? 0;
  const hasLexicalExperiment = lexicalPlaced > 0;
  const referenceUncarriedCount = Math.max(
    0,
    metrics.referenceStrongOccurrenceCount - metrics.referenceStrongCarrierCount
  );
  const originalUncarriedCount = Math.max(
    0,
    metrics.originalStrongOccurrenceCount - metrics.originalStrongCarrierCount
  );
  const unplacedNonTechnicalCount = Math.max(
    0,
    metrics.emptyStrongCount - metrics.technicalStrongCount
  );
  const reviewCount = unplacedNonTechnicalCount + metrics.placementRiskCount;
  const hasLexicalCandidates = metrics.lexicalAuditItems > 0;

  els.stats.className = "stats-dashboard";
  els.stats.replaceChildren(
    coverageMeter({
      label: "Témoins présents",
      value: metrics.referenceStrongCoverage,
      count: `${formatRatio(
        metrics.referenceStrongRepresentedCount,
        metrics.referenceStrongOccurrenceCount
      )} présents dans Advanced`
    }),
    coverageMeter({
      label: "Témoins sur texte",
      value: metrics.referenceStrongCarrierCoverage,
      count: `${formatRatio(
        metrics.referenceStrongCarrierCount,
        metrics.referenceStrongOccurrenceCount
      )} sur mot/expression · ${formatNumber(referenceUncarriedCount)} vides`
    }),
    coverageMeter({
      label: "Original TAHOT/TAGNT sur texte",
      value: metrics.originalStrongCarrierRate,
      count: `${formatRatio(
        metrics.originalStrongCarrierCount,
        metrics.originalStrongOccurrenceCount
      )} sur mot/expression · ${formatNumber(originalUncarriedCount)} à expliquer`
    }),
    coverageMeter({
      label: "À revoir",
      value:
        reviewCount === 0
          ? 1
          : 1 - reviewCount / Math.max(1, metrics.advancedStrongCount),
      displayValue: formatNumber(reviewCount),
      count: `${formatNumber(unplacedNonTechnicalCount)} sans mot · ${formatNumber(
        metrics.placementRiskCount
      )} risques · ${formatNumber(metrics.technicalStrongCount)} techniques`,
      status:
        reviewCount === 0 ? "good" : reviewCount <= 10 ? "warning" : "risk"
    }),
    ...(hasLexicalExperiment
      ? [
          coverageMeter({
            label: "Exp. lexicale",
            value: ratio(lexicalPlaced, lexicalPlaced + lexicalRemaining),
            count: `${formatNumber(lexicalPlaced)} ajoutés · ${formatNumber(
              lexicalRemaining
            )} vides restants`
          })
        ]
      : []),
    ...(hasLexicalCandidates
      ? [
          coverageMeter({
            label: "Candidats restants",
            value: ratio(
              metrics.lexicalItemsWithCandidates,
              metrics.lexicalAuditItems
            ),
            count: `${formatNumber(metrics.lexicalItemsWithCandidates)} / ${formatNumber(
              metrics.lexicalAuditItems
            )} audits · ${formatNumber(metrics.lexicalAutoSafeItems)} auto-safe · ${formatNumber(
              metrics.lexicalGroupAutoSafeItems
            )} groupés`,
            status: metrics.lexicalAmbiguousHighItems > 0 ? "warning" : "good"
          })
        ]
      : []),
    statBars([
      {
        label: "Normal",
        value: metrics.readerVisibleStrongCount,
        max: Math.max(1, metrics.advancedStrongCount),
        detail: "vue témoin lisible"
      },
      {
        label: "Advanced",
        value: metrics.advancedStrongCount,
        max: Math.max(1, metrics.advancedStrongCount),
        detail: "avec original TAHOT/TAGNT"
      },
      {
        label: "Vides",
        value: unplacedNonTechnicalCount,
        max: Math.max(1, metrics.advancedStrongCount),
        detail: "sans mot français"
      },
      {
        label: "Techniques",
        value: metrics.technicalStrongCount,
        max: Math.max(1, metrics.advancedStrongCount),
        detail: "grammaire/source seule"
      },
      {
        label: "Risques",
        value: metrics.placementRiskCount,
        max: Math.max(1, metrics.advancedStrongCount),
        detail: "multi-Strong à vérifier"
      },
      ...(hasLexicalExperiment
        ? [
            {
              label: "Exp. high",
              value: metrics.lexicalExperimentHighCount ?? 0,
              max: Math.max(1, lexicalPlaced),
              detail: "candidats forts"
            },
            {
              label: "Exp. medium",
              value: metrics.lexicalExperimentMediumCount ?? 0,
              max: Math.max(1, lexicalPlaced),
              detail: "candidats moyens"
            },
            {
              label: "Exp. empilés",
              value: metrics.lexicalExperimentOccupiedCount ?? 0,
              max: Math.max(1, lexicalPlaced),
              detail: "ajoutés sur mot déjà taggé"
            }
          ]
        : []),
      ...(hasLexicalCandidates
        ? [
            {
              label: "Cand. high",
              value: metrics.lexicalHighCandidates,
              max: Math.max(1, metrics.lexicalCandidateCount),
              detail: "signal fort"
            },
            {
              label: "Cand. ouverts",
              value: metrics.lexicalOpenCandidates,
              max: Math.max(1, metrics.lexicalCandidateCount),
              detail: "mot non occupé"
            },
            {
              label: "Cand. ambigus",
              value: metrics.lexicalAmbiguousHighItems,
              max: Math.max(1, metrics.lexicalAuditItems),
              detail: "plusieurs high"
            }
          ]
        : [])
    ]),
    miniStats([
      ["Versets", metrics.verseCount],
      ["Strong témoins", metrics.referenceStrongOccurrenceCount],
      ["Strong original", metrics.originalStrongOccurrenceCount],
      ["Normal", metrics.readerVisibleStrongCount],
      ...(hasLexicalExperiment
        ? [
            [
              "Exp. vides",
              formatPercent(
                ratio(lexicalPlaced, lexicalPlaced + lexicalRemaining)
              )
            ],
            ["Exp. ajoutés", lexicalPlaced]
          ]
        : []),
      ...(hasLexicalCandidates
        ? [
            ["Audits lex.", metrics.lexicalAuditItems],
            ["Auto-safe", metrics.lexicalAutoSafeItems]
          ]
        : [])
    ])
  );
}

function coverageMeter({ label, value, count, displayValue, status }) {
  const card = document.createElement("section");
  card.className = `coverage-meter ${status ? `is-${status}` : coverageClass(value)}`;
  card.title = metricInfo[label] ?? "";

  const header = document.createElement("div");
  header.className = "coverage-meter-header";

  const title = document.createElement("span");
  title.className = "stat-label";
  title.textContent = label;
  appendInfoHint(title, metricInfo[label]);

  const score = document.createElement("strong");
  score.textContent = displayValue ?? formatPercent(value);

  header.append(title, score);

  const track = document.createElement("div");
  track.className = "meter-track";
  const fill = document.createElement("span");
  fill.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  track.append(fill);

  const detail = document.createElement("span");
  detail.className = "stat-detail";
  detail.textContent = count;

  card.append(header, track, detail);
  return card;
}

function statBars(items) {
  const group = document.createElement("div");
  group.className = "stat-bars";
  group.replaceChildren(...items.map(statBar));
  return group;
}

function statBar(item) {
  const row = document.createElement("div");
  row.className = "stat-bar";
  row.title = metricInfo[item.label] ?? "";

  const header = document.createElement("div");
  header.className = "stat-bar-header";

  const label = document.createElement("span");
  label.textContent = item.label;
  appendInfoHint(label, metricInfo[item.label]);

  const value = document.createElement("strong");
  value.textContent = formatNumber(item.value);

  header.append(label, value);

  const track = document.createElement("div");
  track.className = "meter-track thin";
  const fill = document.createElement("span");
  fill.style.width = `${Math.max(0, Math.min(100, (item.value / item.max) * 100))}%`;
  track.append(fill);

  const detail = document.createElement("span");
  detail.className = "stat-detail";
  detail.textContent = item.detail;

  row.append(header, track, detail);
  return row;
}

function miniStats(values) {
  const grid = document.createElement("div");
  grid.className = "stats-grid";
  grid.replaceChildren(
    ...values.map(([label, value]) => {
      const item = document.createElement("div");
      const labelElement = document.createElement("span");
      labelElement.className = "stat-label";
      labelElement.textContent = label;
      appendInfoHint(labelElement, metricInfo[label]);
      const valueElement = document.createElement("strong");
      valueElement.textContent = formatStatValue(value);
      item.append(labelElement, valueElement);
      return item;
    })
  );
  return grid;
}

function setStats(values) {
  els.stats.className = "stats-grid";
  els.stats.replaceChildren(
    ...values.map(([label, value, detail]) => {
      const row = document.createElement("div");
      const labelElement = document.createElement("span");
      const valueElement = document.createElement("strong");
      labelElement.className = "stat-label";
      labelElement.textContent = label;
      appendInfoHint(labelElement, metricInfo[label]);
      valueElement.textContent = formatStatValue(value);
      row.append(labelElement, valueElement);
      if (detail) {
        const small = document.createElement("span");
        small.className = "stat-detail";
        small.textContent = detail;
        row.append(small);
      }
      return row;
    })
  );
}

function appendInfoHint(element, tooltip) {
  if (!tooltip) return;
  element.title = tooltip;
  const hint = document.createElement("span");
  hint.className = "info-hint";
  hint.textContent = "?";
  hint.setAttribute("aria-hidden", "true");
  element.append(" ", hint);
}

function coverageClass(value) {
  if (value >= 0.98) return "is-good";
  if (value >= 0.9) return "is-warning";
  return "is-risk";
}

function currentScopeRows() {
  if (!state.currentBook || !state.currentChapter) return state.rows;
  return state.rows.filter(
    (row) =>
      row.bookId === state.currentBook &&
      String(row.chapter) === String(state.currentChapter)
  );
}

function aggregateEnrichedMetrics(rows) {
  const metrics = {
    verseCount: 0,
    wordCount: 0,
    readerVisibleStrongCount: 0,
    advancedStrongCount: 0,
    emptyStrongCount: 0,
    phraseStrongCount: 0,
    technicalStrongCount: 0,
    pendingHumanCount: 0,
    rejectedCount: 0,
    referenceStrongOccurrenceCount: 0,
    referenceStrongRepresentedCount: 0,
    referenceStrongCoverage: 0,
    referenceStrongCarrierCount: 0,
    referenceStrongCarrierCoverage: 0,
    originalStrongOccurrenceCount: 0,
    originalRepresentedStrongOccurrenceCount: 0,
    originalRepresentationRate: 0,
    originalStrongCarrierCount: 0,
    originalStrongCarrierRate: 0,
    semanticMissingCount: 0,
    readerMultiStrongWordCount: 0,
    readerOverBudgetStrongCount: 0,
    placementRiskCount: 0,
    placementQuality: 0,
    readerTaggedTokenCount: 0,
    advancedTaggedTokenCount: 0,
    readerTokenCoverage: 0,
    advancedTokenCoverage: 0,
    lexicalExperimentPlacedCount: 0,
    lexicalExperimentHighCount: 0,
    lexicalExperimentMediumCount: 0,
    lexicalExperimentOccupiedCount: 0,
    lexicalAuditItems: 0,
    lexicalItemsWithCandidates: 0,
    lexicalCandidateCount: 0,
    lexicalHighCandidates: 0,
    lexicalMediumCandidates: 0,
    lexicalLowCandidates: 0,
    lexicalOpenCandidates: 0,
    lexicalOccupiedCandidates: 0,
    lexicalAutoSafeItems: 0,
    lexicalGroupAutoSafeItems: 0,
    lexicalAmbiguousHighItems: 0
  };

  for (const row of rows) {
    const rowMetrics = row.enrichedMetrics;
    if (!rowMetrics) continue;
    metrics.verseCount += 1;
    metrics.wordCount += rowMetrics.wordCount ?? 0;
    metrics.readerVisibleStrongCount +=
      rowMetrics.readerVisibleStrongCount ?? 0;
    metrics.advancedStrongCount += rowMetrics.advancedStrongCount ?? 0;
    metrics.emptyStrongCount += rowMetrics.emptyStrongCount ?? 0;
    metrics.phraseStrongCount += rowMetrics.phraseStrongCount ?? 0;
    metrics.technicalStrongCount += rowMetrics.technicalStrongCount ?? 0;
    metrics.pendingHumanCount += rowMetrics.pendingHumanCount ?? 0;
    metrics.rejectedCount += rowMetrics.rejectedCount ?? 0;
    metrics.referenceStrongOccurrenceCount +=
      rowMetrics.referenceStrongOccurrenceCount ?? 0;
    metrics.referenceStrongRepresentedCount +=
      rowMetrics.referenceStrongRepresentedCount ?? 0;
    metrics.referenceStrongCarrierCount +=
      rowMetrics.referenceStrongCarrierCount ?? 0;
    metrics.originalStrongOccurrenceCount +=
      rowMetrics.originalStrongOccurrenceCount ?? 0;
    metrics.originalRepresentedStrongOccurrenceCount +=
      rowMetrics.originalRepresentedStrongOccurrenceCount ?? 0;
    metrics.originalStrongCarrierCount +=
      rowMetrics.originalStrongCarrierCount ?? 0;
    metrics.semanticMissingCount += rowMetrics.semanticMissingCount ?? 0;
    metrics.readerMultiStrongWordCount +=
      rowMetrics.readerMultiStrongWordCount ?? 0;
    metrics.readerOverBudgetStrongCount +=
      rowMetrics.readerOverBudgetStrongCount ?? 0;
    metrics.placementRiskCount += rowMetrics.placementRiskCount ?? 0;
    metrics.readerTaggedTokenCount += rowMetrics.readerTaggedTokenCount ?? 0;
    metrics.advancedTaggedTokenCount +=
      rowMetrics.advancedTaggedTokenCount ?? 0;
    metrics.lexicalExperimentPlacedCount +=
      rowMetrics.lexicalExperimentPlacedCount ?? 0;
    metrics.lexicalExperimentHighCount +=
      rowMetrics.lexicalExperimentHighCount ?? 0;
    metrics.lexicalExperimentMediumCount +=
      rowMetrics.lexicalExperimentMediumCount ?? 0;
    metrics.lexicalExperimentOccupiedCount +=
      rowMetrics.lexicalExperimentOccupiedCount ?? 0;

    const lexicalItems = row.lexicalItems ?? [];
    metrics.lexicalAuditItems += lexicalItems.length;
    metrics.lexicalItemsWithCandidates += lexicalItems.filter(
      (item) => item.candidates.length > 0
    ).length;
    metrics.lexicalAutoSafeItems += lexicalItems.filter(
      isLexicalAutoSafeItem
    ).length;
    metrics.lexicalGroupAutoSafeItems += lexicalItems.filter(
      (item) => item.groupAutoSafe
    ).length;
    metrics.lexicalAmbiguousHighItems += lexicalItems.filter(
      (item) =>
        !item.groupAutoSafe &&
        item.candidates.filter((candidate) => candidate.confidence === "high")
          .length > 1
    ).length;
    for (const item of lexicalItems) {
      metrics.lexicalCandidateCount += item.candidates.length;
      metrics.lexicalHighCandidates += countCandidates(item, "high");
      metrics.lexicalMediumCandidates += countCandidates(item, "medium");
      metrics.lexicalLowCandidates += countCandidates(item, "low");
      metrics.lexicalOpenCandidates += item.candidates.filter(
        (candidate) => !candidate.occupied
      ).length;
      metrics.lexicalOccupiedCandidates += item.candidates.filter(
        (candidate) => candidate.occupied
      ).length;
    }
  }

  metrics.referenceStrongCoverage = ratio(
    metrics.referenceStrongRepresentedCount,
    metrics.referenceStrongOccurrenceCount
  );
  metrics.referenceStrongCarrierCoverage = ratio(
    metrics.referenceStrongCarrierCount,
    metrics.referenceStrongOccurrenceCount
  );
  metrics.originalRepresentationRate = ratio(
    metrics.originalRepresentedStrongOccurrenceCount,
    metrics.originalStrongOccurrenceCount
  );
  metrics.originalStrongCarrierRate = ratio(
    metrics.originalStrongCarrierCount,
    metrics.originalStrongOccurrenceCount
  );
  metrics.readerTokenCoverage = ratio(
    metrics.readerTaggedTokenCount,
    metrics.wordCount
  );
  metrics.advancedTokenCoverage = ratio(
    metrics.advancedTaggedTokenCount,
    metrics.wordCount
  );
  metrics.placementQuality = ratio(
    metrics.readerTaggedTokenCount - metrics.placementRiskCount,
    metrics.readerTaggedTokenCount
  );

  return metrics;
}

function countCandidates(item, confidence) {
  return item.candidates.filter(
    (candidate) => candidate.confidence === confidence
  ).length;
}

function isLexicalAutoSafeItem(item) {
  return (
    Boolean(item.groupAutoSafe) ||
    item.candidates.filter((candidate) =>
      isLexicalAutoSafeCandidate(item, candidate)
    ).length === 1
  );
}

function isLexicalGroupAutoSafeCandidate(item, candidate) {
  return (
    item.groupAutoSafe &&
    candidate.wordIndex === item.groupAutoSafe.assignedWordIndex
  );
}

function isLexicalAutoSafeCandidate(item, candidate) {
  if (candidate.confidence !== "high") return false;
  const stackSafe = isStackSafeLexicalCandidate(candidate);
  if (candidate.occupied && !stackSafe) return false;
  if (!hasDirectLexicalEvidence(candidate)) return false;
  if (
    !stackSafe &&
    new Set(candidate.evidence.map((evidence) => evidence.source)).size < 2
  ) {
    return false;
  }
  if (item.auditKind === "relocation") {
    if (isNumericCompoundRelocationCandidate(item, candidate)) return true;
    if (isNumericCompoundBacktrackCandidate(item, candidate)) return false;
    return candidate.score >= lexicalCurrentScore(item) + 0.12;
  }
  if (isDominantPhraseAutoSafeCandidate(item, candidate)) return true;
  if (isNumericCompoundEmptyDuplicateCandidate(item, candidate)) return true;
  return (
    item.candidates.filter(
      (other) =>
        other.confidence === "high" &&
        (!other.occupied || isStackSafeLexicalCandidate(other))
    ).length === 1
  );
}

function isNumericCompoundEmptyDuplicateCandidate(item, candidate) {
  if (item.auditKind !== "empty") return false;
  if (candidate.target !== "word" || !candidate.occupied) return false;
  if (!isStackSafeLexicalCandidate(candidate)) return false;

  const candidateValueCount = numericValuesForTarget(candidate.normalized).size;
  if (candidateValueCount < 2) return false;

  const richerCandidates = item.candidates.filter(
    (other) =>
      other.confidence === "high" &&
      other.target === "word" &&
      isStackSafeLexicalCandidate(other) &&
      numericValuesForTarget(other.normalized).size >= 2
  );
  return (
    richerCandidates.length === 1 &&
    richerCandidates[0]?.wordIndex === candidate.wordIndex
  );
}

function isDominantPhraseAutoSafeCandidate(item, candidate) {
  if (item.auditKind !== "empty" || candidate.target !== "phrase") {
    return false;
  }
  if (
    candidate.startWordIndex === undefined ||
    candidate.endWordIndex === undefined
  ) {
    return false;
  }
  if (
    !candidate.evidence?.some(
      (evidence) => evidence.source === "french-auxiliary-phrase"
    )
  ) {
    return false;
  }

  const highOpenCandidates = item.candidates.filter(
    (other) =>
      other.confidence === "high" &&
      !other.occupied &&
      other.wordIndex >= candidate.startWordIndex &&
      other.wordIndex <= candidate.endWordIndex
  );
  const highOpenOutsidePhrase = item.candidates.filter(
    (other) =>
      other.confidence === "high" &&
      !other.occupied &&
      (other.wordIndex < candidate.startWordIndex ||
        other.wordIndex > candidate.endWordIndex)
  );

  return highOpenCandidates.length >= 2 && highOpenOutsidePhrase.length === 0;
}

function isStackSafeLexicalCandidate(candidate) {
  return candidate.evidence?.some(
    (evidence) => evidence.source === "number-component"
  );
}

function hasDirectLexicalEvidence(candidate) {
  return candidate.evidence?.some((evidence) =>
    DIRECT_LEXICAL_EVIDENCE_SOURCES.has(evidence.source)
  );
}

const DIRECT_LEXICAL_EVIDENCE_SOURCES = new Set([
  "seed-term",
  "seed-stem",
  "number-component",
  "kaikki-gloss",
  "proper-name-step",
  "proper-name-dictionary"
]);

function lexicalCurrentScore(item) {
  if (!item.currentTarget) return 0;
  return (
    item.candidates.find(
      (candidate) => candidate.wordIndex === item.currentTarget.wordIndex
    )?.score ?? 0
  );
}

function isNumericCompoundRelocationCandidate(item, candidate) {
  if (item.auditKind !== "relocation" || !item.currentTarget) return false;
  if (candidate.wordIndex === item.currentTarget.wordIndex) return false;
  if (candidate.wordIndex < item.currentTarget.wordIndex) return false;
  if (!candidate.occupied) return false;
  if (!item.currentTarget.otherStrong?.length) return false;
  if (!isStackSafeLexicalCandidate(candidate)) return false;

  const currentCandidate = item.candidates.find(
    (current) => current.wordIndex === item.currentTarget.wordIndex
  );
  if (!currentCandidate || !isStackSafeLexicalCandidate(currentCandidate)) {
    return false;
  }

  return (
    numericValuesForTarget(candidate.normalized).size >
    numericValuesForTarget(item.currentTarget.normalized).size
  );
}

function isNumericCompoundBacktrackCandidate(item, candidate) {
  if (item.auditKind !== "relocation" || !item.currentTarget) return false;
  if (candidate.wordIndex >= item.currentTarget.wordIndex) return false;
  if (!isStackSafeLexicalCandidate(candidate)) return false;

  const currentCandidate = item.candidates.find(
    (current) => current.wordIndex === item.currentTarget.wordIndex
  );
  if (!currentCandidate || !isStackSafeLexicalCandidate(currentCandidate)) {
    return false;
  }

  return (
    numericValuesForTarget(item.currentTarget.normalized).size >
    numericValuesForTarget(candidate.normalized).size
  );
}

function numericValuesForTarget(normalized) {
  const values = new Set();
  const numericValue = Number(normalized);
  if (Number.isInteger(numericValue) && numericValue > 0) {
    for (const value of decomposeIntegerNumber(numericValue)) values.add(value);
    return values;
  }

  const parts = normalized
    .split(/[-\s'’]+/u)
    .map((part) => part.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean);
  let sum = 0;
  let allPartsAreNumeric = parts.length > 0;
  for (const part of parts) {
    const value = NUMERIC_WORD_VALUES.get(part);
    if (value === undefined) {
      allPartsAreNumeric = false;
      continue;
    }
    for (const decomposed of decomposeIntegerNumber(value)) {
      values.add(decomposed);
    }
    sum += value;
  }
  addFrenchCompoundNumberValues(parts, values);
  if (allPartsAreNumeric && sum > 0) values.add(sum);
  return values;
}

function decomposeIntegerNumber(value) {
  const values = new Set([value]);
  const teenUnit = TEEN_UNIT_VALUES.get(value);
  if (teenUnit !== undefined) {
    values.add(10);
    values.add(teenUnit);
  }
  if (value >= 100) {
    const hundreds = Math.floor(value / 100);
    if (hundreds > 0) {
      values.add(hundreds);
      values.add(100);
      values.add(hundreds * 100);
    }
  }
  const lastTwoDigits = value % 100;
  if (lastTwoDigits >= 20) {
    const tens = Math.floor(lastTwoDigits / 10) * 10;
    const units = lastTwoDigits % 10;
    if (tens > 0) values.add(tens);
    if (units > 0) values.add(units);
  } else if (lastTwoDigits > 0 && lastTwoDigits !== value) {
    values.add(lastTwoDigits);
  }
  return values;
}

function addFrenchCompoundNumberValues(parts, values) {
  const compoundValue = frenchCompoundNumberValue(parts);
  if (compoundValue !== undefined) {
    for (const value of decomposeIntegerNumber(compoundValue)) {
      values.add(value);
    }
  }

  const quatreVingtIndex = parts.findIndex(
    (part, index) =>
      part === "quatre" && ["vingt", "vingts"].includes(parts[index + 1] ?? "")
  );
  if (quatreVingtIndex !== -1) {
    values.add(80);
    const rest = parts.slice(quatreVingtIndex + 2);
    const restValue = frenchCompoundNumberValue(rest);
    if (restValue !== undefined) {
      for (const value of decomposeIntegerNumber(restValue)) values.add(value);
      for (const value of decomposeIntegerNumber(80 + restValue)) {
        values.add(value);
      }
    }
  }

  const soixanteDixIndex = parts.findIndex(
    (part, index) => part === "soixante" && parts[index + 1] === "dix"
  );
  if (soixanteDixIndex !== -1) {
    values.add(70);
    const rest = parts.slice(soixanteDixIndex + 2);
    const restValue = frenchCompoundNumberValue(rest);
    if (restValue !== undefined) {
      for (const value of decomposeIntegerNumber(restValue)) values.add(value);
      for (const value of decomposeIntegerNumber(70 + restValue)) {
        values.add(value);
      }
    }
  }

  const soixanteIndex = parts.findIndex((part) => part === "soixante");
  const teenAfterSixty =
    soixanteIndex !== -1
      ? NUMERIC_WORD_VALUES.get(parts[soixanteIndex + 1] ?? "")
      : undefined;
  if (teenAfterSixty !== undefined && teenAfterSixty >= 11) {
    values.add(70);
    for (const value of decomposeIntegerNumber(60 + teenAfterSixty)) {
      values.add(value);
    }
  }
}

function frenchCompoundNumberValue(parts) {
  if (parts.length === 0) return undefined;
  if (
    parts.length >= 2 &&
    parts[0] === "quatre" &&
    ["vingt", "vingts"].includes(parts[1] ?? "")
  ) {
    return 80 + (frenchCompoundNumberValue(parts.slice(2)) ?? 0);
  }
  if (parts.length >= 2 && parts[0] === "soixante" && parts[1] === "dix") {
    return 70 + (frenchCompoundNumberValue(parts.slice(2)) ?? 0);
  }

  let total = 0;
  for (const part of parts) {
    const value = NUMERIC_WORD_VALUES.get(part);
    if (value === undefined) return undefined;
    total += value;
  }
  return total > 0 ? total : undefined;
}

const NUMERIC_WORD_VALUES = new Map([
  ["one", 1],
  ["un", 1],
  ["une", 1],
  ["two", 2],
  ["deux", 2],
  ["three", 3],
  ["trois", 3],
  ["four", 4],
  ["quatre", 4],
  ["five", 5],
  ["cinq", 5],
  ["six", 6],
  ["seven", 7],
  ["sept", 7],
  ["eight", 8],
  ["huit", 8],
  ["nine", 9],
  ["neuf", 9],
  ["ten", 10],
  ["dix", 10],
  ["eleven", 11],
  ["onze", 11],
  ["twelve", 12],
  ["douze", 12],
  ["thirteen", 13],
  ["treize", 13],
  ["fourteen", 14],
  ["quatorze", 14],
  ["fifteen", 15],
  ["quinze", 15],
  ["sixteen", 16],
  ["seize", 16],
  ["twenty", 20],
  ["vingt", 20],
  ["thirty", 30],
  ["trente", 30],
  ["forty", 40],
  ["quarante", 40],
  ["fifty", 50],
  ["cinquante", 50],
  ["sixty", 60],
  ["soixante", 60],
  ["seventy", 70],
  ["seventyfold", 70],
  ["eighty", 80],
  ["quatre-vingt", 80],
  ["quatrevingt", 80],
  ["ninety", 90],
  ["hundred", 100],
  ["cent", 100],
  ["thousand", 1000],
  ["mille", 1000]
]);

const TEEN_UNIT_VALUES = new Map([
  [11, 1],
  [12, 2],
  [13, 3],
  [14, 4],
  [15, 5],
  [16, 6],
  [17, 7],
  [18, 8],
  [19, 9]
]);

function matchesSearch(row) {
  const ref = `${row.bookId}.${row.chapter}.${row.verse}`.toLocaleLowerCase(
    "fr-FR"
  );
  return (
    ref.includes(state.search) ||
    row.text.toLocaleLowerCase("fr-FR").includes(state.search)
  );
}

function matchesTokenSearch(text, strong) {
  if (!state.search) return false;
  return (
    text.toLocaleLowerCase("fr-FR").includes(state.search) ||
    strong.toLocaleLowerCase("fr-FR").includes(state.search)
  );
}

function moveChapter(direction) {
  const next = getAdjacentChapter(direction);
  if (!next) return;
  state.currentBook = next.book;
  state.currentChapter = next.chapter;
  render();
}

function getAdjacentChapter(direction) {
  const refs = state.books.flatMap((book) =>
    chaptersForBook(book).map((chapter) => ({ book, chapter }))
  );
  const currentIndex = refs.findIndex(
    (ref) =>
      ref.book === state.currentBook &&
      String(ref.chapter) === String(state.currentChapter)
  );
  return refs[currentIndex + direction];
}

function chaptersForBook(bookId) {
  return [
    ...new Set(
      state.rows
        .filter((row) => row.bookId === bookId)
        .map((row) => String(row.chapter))
    )
  ].sort((a, b) => Number(a) - Number(b));
}

function firstChapter(bookId) {
  return chaptersForBook(bookId)[0] ?? "";
}

function compareBooks(a, b) {
  const aIndex = bookOrder.indexOf(a);
  const bIndex = bookOrder.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function option(value, label) {
  const optionElement = document.createElement("option");
  optionElement.value = value;
  optionElement.textContent = label;
  return optionElement;
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function formatStrong(strong) {
  return strong.replace(/^[HG]0*/i, "");
}

function displayStrongCode(strong) {
  return String(strong ?? "").toUpperCase();
}

function formatStatValue(value) {
  return typeof value === "number" ? formatNumber(value) : String(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatRatio(value, total) {
  return `${formatNumber(value)} / ${formatNumber(total)}`;
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1
  }).format(value * 100)} %`;
}

function ratio(value, total) {
  return total > 0 ? value / total : 0;
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
