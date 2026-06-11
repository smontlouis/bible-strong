/* global document, Node, HTMLElement */

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
  books: [],
  currentBook: "",
  currentChapter: "",
  search: ""
};

const els = {
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  bookSelect: document.querySelector("#bookSelect"),
  chapterSelect: document.querySelector("#chapterSelect"),
  searchInput: document.querySelector("#searchInput"),
  chapterView: document.querySelector("#chapterView"),
  chapterTitle: document.querySelector("#chapterTitle"),
  fileName: document.querySelector("#fileName"),
  stats: document.querySelector("#stats"),
  prevChapter: document.querySelector("#prevChapter"),
  nextChapter: document.querySelector("#nextChapter")
};

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files?.[0];
  if (file) loadFile(file);
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-dragging");
  });
}

els.dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

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

els.prevChapter.addEventListener("click", () => moveChapter(-1));
els.nextChapter.addEventListener("click", () => moveChapter(1));

async function loadFile(file) {
  const text = await file.text();
  state.rows = parseStrongFile(text);
  state.books = [...new Set(state.rows.map((row) => row.bookId))].sort(
    compareBooks
  );
  state.currentBook = state.books[0] ?? "";
  state.currentChapter = firstChapter(state.currentBook);
  state.search = "";
  els.fileName.textContent = file.name;
  els.searchInput.value = "";
  syncControls();
  render();
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
  const candidates = ["\t", ";", ","];
  return candidates
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
  els.prevChapter.disabled = !hasRows || !getAdjacentChapter(-1);
  els.nextChapter.disabled = !hasRows || !getAdjacentChapter(1);

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
  const html = unescapeTsvText(rawText);
  const template = document.createElement("template");
  template.innerHTML = html;
  const nodes = [];

  for (const node of template.content.childNodes) {
    nodes.push(...renderNode(node));
  }

  return nodes;
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
  const isEmpty =
    node.getAttribute("data-empty") === "true" ||
    (node.textContent ?? "").trim().length === 0;
  const token = document.createElement("span");
  token.title = [
    strong,
    node.getAttribute("data-method"),
    node.getAttribute("data-original-token")
  ]
    .filter(Boolean)
    .join(" · ");

  if (isEmpty) {
    token.className = "empty-token";
    token.append(renderSup(strong));
    return token;
  }

  token.className = "token";
  if (matchesTokenSearch(node.textContent ?? "", strong))
    token.classList.add("highlight");
  token.append(
    document.createTextNode(node.textContent ?? ""),
    renderSup(strong)
  );
  return token;
}

function renderSup(strong) {
  const sup = document.createElement("sup");
  sup.textContent = strong.split(/\s+/).map(formatStrong).join(",");
  return sup;
}

function renderStats() {
  const rows = state.rows;
  const tagCount = rows.reduce(
    (sum, row) => sum + countMatches(row.text, /<w\b/gi),
    0
  );
  const emptyCount = rows.reduce(
    (sum, row) =>
      sum + countMatches(row.text, /data-empty="true"|<w\b[^>]*><\/w>/gi),
    0
  );
  const taggedWords = Math.max(0, tagCount - emptyCount);
  const values = [rows.length, tagCount, emptyCount, taggedWords].map(
    formatNumber
  );

  els.stats.querySelectorAll("dd").forEach((dd, index) => {
    dd.textContent = values[index] ?? "-";
  });
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

function unescapeTsvText(text) {
  return text.replace(/\\n/g, "\n");
}

function formatStrong(strong) {
  return strong.replace(/^[HG]0*/i, "");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
