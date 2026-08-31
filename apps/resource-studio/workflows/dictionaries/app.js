const state = {
  dictionaries: [],
  work: null,
  language: "all",
  search: "",
  initial: "a",
  offset: 0,
  limit: 80,
  total: 0,
  entries: [],
  activeEntryId: null
};

const elements = {
  article: document.querySelector("#article"),
  articleByline: document.querySelector("#article-byline"),
  articleCorrespondences: document.querySelector("#article-correspondences"),
  articleDefinition: document.querySelector("#article-definition"),
  articlePlaceholder: document.querySelector("#article-placeholder"),
  articleSource: document.querySelector("#article-source"),
  articleTitle: document.querySelector("#article-title"),
  alphabet: document.querySelector("#alphabet"),
  catalogCount: document.querySelector("#catalog-count"),
  entryList: document.querySelector("#entry-list"),
  languageFilter: document.querySelector("#language-filter"),
  nextPage: document.querySelector("#next-page"),
  pageLabel: document.querySelector("#page-label"),
  previousPage: document.querySelector("#previous-page"),
  resourceCard: document.querySelector("#resource-card"),
  resultCount: document.querySelector("#result-count"),
  resultKicker: document.querySelector("#result-kicker"),
  searchInput: document.querySelector("#search-input"),
  statusLine: document.querySelector("#status-line"),
  workList: document.querySelector("#work-list")
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(value ?? 0);

const requestJson = async (url) => {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Lecture impossible");
  return payload;
};

const currentDictionary = () =>
  state.dictionaries.find((item) => item.work === state.work);

const initials = (value) =>
  value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("fr");

const renderWorks = () => {
  const visible = state.dictionaries.filter(
    (dictionary) =>
      state.language === "all" || dictionary.language === state.language
  );
  elements.workList.innerHTML = visible
    .map(
      (dictionary) => `
        <button class="work-card ${dictionary.work === state.work ? "active" : ""} ${dictionary.available ? "" : "unavailable"}"
          type="button" data-work="${escapeHtml(dictionary.work)}" ${dictionary.available ? "" : "disabled"}>
          <span class="work-seal">${escapeHtml(initials(dictionary.abbreviation))}</span>
          <span><strong>${escapeHtml(dictionary.abbreviation)}</strong><small>${escapeHtml(dictionary.language.toUpperCase())} · ${formatNumber(dictionary.counts.entries)} entrées</small></span>
          <i>${dictionary.available ? "→" : "absent"}</i>
        </button>`
    )
    .join("");
};

const renderResource = () => {
  const resource = currentDictionary();
  if (!resource) {
    elements.resourceCard.innerHTML = "<p>Aucune ressource disponible.</p>";
    return;
  }
  elements.resourceCard.innerHTML = `
    <div class="resource-heading">
      <span class="large-seal">${escapeHtml(initials(resource.abbreviation))}</span>
      <div><p>${escapeHtml(resource.resourceId)}</p><h3>${escapeHtml(resource.title)}</h3></div>
    </div>
    <p class="resource-description">${escapeHtml(resource.description)}</p>
    <dl>
      <div><dt>Auteur${resource.authors.length > 1 ? "s" : ""}</dt><dd>${resource.authors.map(escapeHtml).join(", ")}</dd></div>
      <div><dt>Édition</dt><dd>${escapeHtml(resource.edition)}</dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(resource.source)}</dd></div>
      <div><dt>Version source</dt><dd>${escapeHtml(resource.sourceVersion)}</dd></div>
      <div><dt>Liens bibliques</dt><dd>${resource.normalized ? "Normalisés et validés (BCV)" : "Source brute"}</dd></div>
      <div><dt>Droits</dt><dd>${escapeHtml(resource.rights.holder)}</dd></div>
    </dl>
    <div class="resource-stats">
      <span><strong>${formatNumber(resource.counts.entries)}</strong> articles</span>
      <span><strong>${formatNumber(resource.counts.verseAnchors)}</strong> ancres</span>
    </div>
    <p class="attribution">${escapeHtml(resource.rights.attribution)}</p>`;
};

const sanitizeDefinition = (unsafeHtml) => {
  const allowedTags = new Set([
    "A",
    "B",
    "BLOCKQUOTE",
    "BR",
    "EM",
    "H2",
    "H3",
    "H4",
    "I",
    "LI",
    "OL",
    "P",
    "SPAN",
    "STRONG",
    "SUB",
    "SUP",
    "TABLE",
    "TBODY",
    "TD",
    "TH",
    "THEAD",
    "TR",
    "UL"
  ]);
  const blockedTags = new Set([
    "EMBED",
    "FORM",
    "IFRAME",
    "OBJECT",
    "SCRIPT",
    "STYLE",
    "SVG"
  ]);
  const parsed = new DOMParser().parseFromString(
    `<body>${unsafeHtml ?? ""}</body>`,
    "text/html"
  );
  const clean = (node) => {
    for (const child of [...node.children]) {
      if (blockedTags.has(child.tagName)) {
        child.remove();
        continue;
      }
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        clean(node);
        continue;
      }
      const href = child.tagName === "A" ? child.getAttribute("href") : null;
      const entryId =
        child.tagName === "A" ? child.getAttribute("data-entry-id") : null;
      const entrySection =
        child.tagName === "A" ? child.getAttribute("data-entry-section") : null;
      const strongNumber =
        child.tagName === "A" ? child.getAttribute("data-strong-number") : null;
      const strongBook =
        child.tagName === "A" ? child.getAttribute("data-strong-book") : null;
      const strongSource =
        child.tagName === "A" ? child.getAttribute("data-strong-source") : null;
      const linkClass = child.classList.contains("word")
        ? "word"
        : child.classList.contains("verse")
          ? "verse"
          : child.classList.contains("strong-ref")
            ? "strong-ref"
            : null;
      for (const attribute of [...child.attributes])
        child.removeAttribute(attribute.name);
      if (linkClass === "word" && href) {
        child.className = "word";
        child.dataset.word = href;
        if (/^\d+$/u.test(entryId ?? "")) child.dataset.entryId = entryId;
        if (/^(?:\d+|[IVXLCDM]+)$/iu.test(entrySection ?? ""))
          child.dataset.entrySection = entrySection;
        child.setAttribute("role", "button");
        child.setAttribute("tabindex", "0");
      } else if (linkClass === "verse" && href?.startsWith("bible://")) {
        child.className = "verse bible-ref";
        child.href = href;
        child.dataset.osis = href.slice("bible://".length);
        child.title = href;
      } else if (
        linkClass === "strong-ref" &&
        /^strong:\/\/[HG]\d{4}$/u.test(href ?? "") &&
        /^\d{4}$/u.test(strongNumber ?? "") &&
        /^(?:1|40)$/u.test(strongBook ?? "")
      ) {
        child.className = "strong-ref";
        child.href = href;
        child.dataset.strongNumber = strongNumber;
        child.dataset.strongBook = strongBook;
        if (/^[HG]\d{4,5}$/u.test(strongSource ?? ""))
          child.dataset.strongSource = strongSource;
        child.title = `${strongSource ?? child.textContent} → ${href}`;
      }
      clean(child);
    }
  };
  clean(parsed.body);
  return parsed.body.innerHTML;
};

const renderEntries = () => {
  elements.entryList.innerHTML = state.entries.length
    ? state.entries
        .map(
          (entry) => `
            <button class="entry-row ${entry.id === state.activeEntryId ? "active" : ""}" type="button" data-entry-id="${entry.id}">
              <span>${escapeHtml(entry.word)}</span><small>${escapeHtml(entry.normalizedWord)}</small>
            </button>`
        )
        .join("")
    : '<div class="empty-list"><strong>∅</strong><p>Aucune entrée trouvée.</p></div>';
  const first = state.total === 0 ? 0 : state.offset + 1;
  const last = Math.min(state.total, state.offset + state.entries.length);
  elements.resultCount.textContent = `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(state.total)}`;
  elements.resultKicker.textContent = state.search
    ? `Résultats pour « ${state.search} »`
    : `Lettre ${state.initial.toLocaleUpperCase()}`;
  elements.pageLabel.textContent = state.total
    ? `Page ${Math.floor(state.offset / state.limit) + 1} / ${Math.ceil(state.total / state.limit)}`
    : "—";
  elements.previousPage.disabled = state.offset === 0;
  elements.nextPage.disabled = state.offset + state.limit >= state.total;
};

const renderAlphabet = () => {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  elements.alphabet.innerHTML = letters
    .map(
      (letter) =>
        `<button type="button" data-letter="${letter}" class="${!state.search && state.initial === letter ? "active" : ""}">${letter.toLocaleUpperCase()}</button>`
    )
    .join("");
};

const loadEntries = async ({ selectFirst = false } = {}) => {
  if (!state.work) return;
  elements.entryList.classList.add("loading");
  try {
    const parameters = new URLSearchParams({
      work: state.work,
      offset: state.offset,
      limit: state.limit,
      ...(state.search ? { search: state.search } : { initial: state.initial })
    });
    const page = await requestJson(`/api/entries?${parameters}`);
    state.entries = page.entries;
    state.total = page.total;
    renderEntries();
    renderAlphabet();
    if (selectFirst && state.entries[0]) await loadEntry(state.entries[0].id);
  } catch (error) {
    elements.entryList.innerHTML = `<div class="empty-list"><strong>!</strong><p>${escapeHtml(error.message)}</p></div>`;
  } finally {
    elements.entryList.classList.remove("loading");
  }
};

const loadEntry = async (id) => {
  if (!state.work) return;
  const parameters = new URLSearchParams({ work: state.work, id });
  const [{ entry }, correspondences] = await Promise.all([
    requestJson(`/api/entry?${parameters}`),
    requestJson(`/api/correspondences?${parameters}`)
  ]);
  const resource = currentDictionary();
  state.activeEntryId = entry.id;
  elements.articleTitle.textContent = entry.word;
  elements.articleSource.textContent = resource.abbreviation;
  elements.articleByline.textContent = `${resource.authors.join(", ")} · ${resource.edition}`;
  const alternatives = correspondences.members.filter(
    (member) => !(member.work === state.work && member.id === entry.id)
  );
  elements.articleCorrespondences.hidden = alternatives.length === 0;
  elements.articleCorrespondences.innerHTML = alternatives.length
    ? `<p>Articles correspondants</p><div>${alternatives
        .map(
          (member) =>
            `<button type="button" data-correspondence-work="${escapeHtml(member.work)}" data-correspondence-id="${member.id}" data-correspondence-word="${escapeHtml(member.word)}"><strong>${escapeHtml(member.abbreviation)}</strong><span>${escapeHtml(member.word)}</span><small>${escapeHtml(member.language.toLocaleUpperCase())}</small></button>`
        )
        .join("")}</div>`
    : "";
  elements.articleDefinition.innerHTML = sanitizeDefinition(entry.definition);
  elements.articlePlaceholder.hidden = true;
  elements.article.hidden = false;
  renderEntries();
  document.title = `${entry.word} — ${resource.abbreviation}`;
  elements.article.scrollTo?.({ top: 0 });
};

const openCorrespondence = async ({ work, id, word }) => {
  state.language = "all";
  elements.languageFilter.value = "all";
  state.work = work;
  state.search = word;
  state.initial = word.slice(0, 1).toLocaleLowerCase();
  state.offset = 0;
  elements.searchInput.value = word;
  renderWorks();
  renderResource();
  await loadEntries();
  await loadEntry(id);
};

const openEntryLink = async ({ id, word, section = "" }) => {
  state.search = word;
  state.initial = word.slice(0, 1).toLocaleLowerCase();
  state.offset = 0;
  elements.searchInput.value = word;
  await loadEntries();
  await loadEntry(id);
  if (section) {
    const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const marker = new RegExp(
      `^\\s*(?:\\(${escapedSection}\\)|${escapedSection}\\.)`,
      "iu"
    );
    const sectionElement = [
      ...elements.articleDefinition.querySelectorAll("p, h2, h3, h4, li")
    ].find((element) => marker.test(element.textContent ?? ""));
    sectionElement?.scrollIntoView({ block: "start" });
  }
};

const selectWork = async (work) => {
  state.work = work;
  state.offset = 0;
  state.activeEntryId = null;
  elements.article.hidden = true;
  elements.articlePlaceholder.hidden = false;
  renderWorks();
  renderResource();
  await loadEntries({ selectFirst: true });
};

let searchTimer;
elements.searchInput.addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = event.target.value.trim();
    state.offset = 0;
    void loadEntries();
  }, 220);
});

elements.workList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-work]");
  if (button) void selectWork(button.dataset.work);
});

elements.entryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-entry-id]");
  if (button) void loadEntry(Number(button.dataset.entryId));
});

elements.alphabet.addEventListener("click", (event) => {
  const button = event.target.closest("[data-letter]");
  if (!button) return;
  state.initial = button.dataset.letter;
  state.search = "";
  state.offset = 0;
  elements.searchInput.value = "";
  void loadEntries();
});

elements.languageFilter.addEventListener("change", (event) => {
  state.language = event.target.value;
  renderWorks();
  const visible = state.dictionaries.find(
    (dictionary) =>
      dictionary.available &&
      (state.language === "all" || dictionary.language === state.language)
  );
  if (visible && visible.work !== state.work) void selectWork(visible.work);
});

elements.previousPage.addEventListener("click", () => {
  state.offset = Math.max(0, state.offset - state.limit);
  void loadEntries();
});

elements.nextPage.addEventListener("click", () => {
  state.offset += state.limit;
  void loadEntries();
});

elements.articleDefinition.addEventListener("click", (event) => {
  const wordLink = event.target.closest("a.word");
  if (!wordLink) return;
  const destinationId = Number(wordLink.dataset.entryId);
  if (Number.isInteger(destinationId) && destinationId > 0) {
    void openEntryLink({
      id: destinationId,
      word: wordLink.dataset.word.trim(),
      section: wordLink.dataset.entrySection ?? ""
    });
    return;
  }
  state.search = wordLink.dataset.word.trim();
  state.offset = 0;
  elements.searchInput.value = state.search;
  void loadEntries({ selectFirst: true });
});

elements.articleCorrespondences.addEventListener("click", (event) => {
  const button = event.target.closest("[data-correspondence-work]");
  if (!button) return;
  void openCorrespondence({
    work: button.dataset.correspondenceWork,
    id: Number(button.dataset.correspondenceId),
    word: button.dataset.correspondenceWord
  });
});

document.addEventListener("keydown", (event) => {
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLocaleLowerCase() === "k"
  ) {
    event.preventDefault();
    elements.searchInput.focus();
  }
});

const initialize = async () => {
  try {
    const { dictionaries } = await requestJson("/api/catalog");
    state.dictionaries = dictionaries;
    elements.catalogCount.textContent = dictionaries.length;
    const availableCount = dictionaries.filter(
      (dictionary) => dictionary.available
    ).length;
    elements.statusLine.textContent = `${availableCount}/${dictionaries.length} SQLite disponibles · données locales uniquement`;
    renderWorks();
    renderAlphabet();
    const first = dictionaries.find((dictionary) => dictionary.available);
    if (first) await selectWork(first.work);
    else renderResource();
  } catch (error) {
    elements.statusLine.textContent = error.message;
    elements.workList.innerHTML = `<div class="empty-list"><strong>!</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
};

void initialize();
