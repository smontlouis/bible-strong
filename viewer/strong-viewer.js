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
const state = {
  rows: [],
  enriched: null,
  books: [],
  currentBook: "",
  currentChapter: "",
  search: "",
  viewMode: "reader",
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

  await loadText(await response.text(), filePath.split("/").pop() || filePath);
}

async function loadText(text, fileName) {
  state.enriched = await parseEnrichedFile(text);
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
    bookId: verse.bookId,
    chapter: verse.chapter,
    verse: verse.verse,
    text:
      mode === "reader"
        ? verse.views.readerHtml
        : mode === "debug"
          ? (verse.views.debugHtml ?? verse.views.advancedHtml)
          : verse.views.advancedHtml,
    enrichedMetrics: verse.metrics,
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
    verse.append(number, ...renderTaggedHtml(row.text));
    fragment.append(verse);
  }

  els.chapterView.className = "chapter-view";
  els.chapterView.replaceChildren(fragment);
  els.chapterTitle.textContent = `${bookNames[state.currentBook] ?? state.currentBook} ${state.currentChapter}`;

  if (visibleRows.length === 0) {
    els.chapterView.className = "chapter-view empty-state";
    els.chapterView.textContent = "Aucun verset ne correspond à la recherche.";
  }
}

function renderTaggedHtml(rawText) {
  const template = document.createElement("template");
  template.innerHTML = rawText.replace(/\\n/g, "\n");
  return [...template.content.childNodes].flatMap(renderNode);
}

function renderNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return [document.createTextNode(node.textContent ?? "")];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName.toLowerCase() === "w") {
    return [renderStrongToken(node)];
  }
  return [...node.childNodes].flatMap(renderNode);
}

function renderStrongToken(node) {
  const strong = node.getAttribute("strong") ?? "";
  const stepStrong = node.getAttribute("data-step-strong") ?? "";
  const stepStatus = node.getAttribute("data-step-status") ?? "";
  const isEmpty =
    node.getAttribute("data-empty") === "true" ||
    (node.textContent ?? "").trim().length === 0;
  const token = document.createElement("span");
  token.dataset.strong = strong;
  token.dataset.stepStrong = stepStrong;
  token.dataset.method = node.getAttribute("data-method") ?? "";
  token.dataset.source = node.getAttribute("data-source") ?? "";
  token.dataset.confidence = node.getAttribute("data-confidence") ?? "";
  token.tabIndex = 0;
  token.role = "button";
  token.title = [
    strong,
    stepStrong ? `STEP ${stepStrong}` : "",
    stepStatus ? `STEP status: ${stepStatus}` : "",
    node.getAttribute("data-method"),
    node.getAttribute("data-step-method"),
    node.getAttribute("data-original-token")
  ]
    .filter(Boolean)
    .join(" · ");

  if (isEmpty) {
    token.className = "empty-token";
    if (isSelectedStrong(strong)) token.classList.add("is-selected");
    token.append(renderSup(strong));
    return token;
  }

  token.className = "token";
  if (isSelectedStrong(strong)) token.classList.add("is-selected");
  if (matchesTokenSearch(node.textContent ?? "", strong)) {
    token.classList.add("highlight");
  }
  token.append(
    document.createTextNode(node.textContent ?? ""),
    renderSup(strong)
  );
  return token;
}

function getStrongTokenFromEventTarget(target) {
  if (!(target instanceof HTMLElement)) return null;
  const token = target.closest("[data-strong]");
  return token instanceof HTMLElement ? token : null;
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

  const payload = await loadLexiconEntry(selectedStrong);
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
      token.dataset.method ? metaItem("Méthode", token.dataset.method) : null,
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
        loadLexiconEntry(code).then((payload) =>
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
    const metrics = state.enriched.metrics;
    setStats([
      ["Versets", state.rows.length],
      [
        state.viewMode === "reader" ? "Tags reader" : "Tags advanced",
        state.viewMode === "reader"
          ? metrics.readerVisibleStrongCount
          : metrics.advancedStrongCount
      ],
      ["Vides", metrics.emptyStrongCount],
      [
        "Mots taggés",
        state.viewMode === "reader"
          ? metrics.readerTaggedTokenCount
          : metrics.advancedTaggedTokenCount
      ]
    ]);
    return;
  }

  const tagCount = state.rows.reduce(
    (sum, row) => sum + countMatches(row.text, /<w\b/gi),
    0
  );
  const emptyCount = state.rows.reduce(
    (sum, row) =>
      sum + countMatches(row.text, /data-empty="true"|<w\b[^>]*><\/w>/gi),
    0
  );
  setStats([
    ["Versets", state.rows.length],
    ["Tags", tagCount],
    ["Vides", emptyCount],
    ["Mots taggés", Math.max(0, tagCount - emptyCount)]
  ]);
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

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
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
