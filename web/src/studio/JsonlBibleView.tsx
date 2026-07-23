import {
  BookOpenText,
  Braces,
  Bug,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileCode2,
  Fingerprint,
  Layers3,
  Loader2,
  Rows3,
  Search,
  X
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { bookLabel } from "./bookNames";
import { loadJsonlBibleCatalog, loadJsonlBibleChapter } from "./data";
import type {
  JsonlBibleCatalog,
  JsonlBibleChapter,
  JsonlBibleId,
  JsonlBibleVerse,
  LexiconEntryPayload
} from "./types";

const VERSION_ORDER: JsonlBibleId[] = [
  "OST",
  "FMAR",
  "NVS78P",
  "NEG79",
  "NBS",
  "DBY",
  "DBYR",
  "LSG"
];

interface SelectedOccurrence {
  ref: string;
  version: JsonlBibleId;
  surface: string;
  strong: string[];
  estrong: string[];
  dstrong: string[];
  ustrong: string[];
}

type BibleDisplayMode = "reading" | "verses";

interface ReadingBlock {
  type: "paragraph" | "poetry";
  verses: JsonlBibleVerse[];
}

export function JsonlBibleView({
  renderLexiconEntry
}: {
  renderLexiconEntry?: (
    payload: LexiconEntryPayload,
    options: {
      locale: "fr" | "en";
      debug: boolean;
      concordanceVersion: JsonlBibleId;
    }
  ) => ReactNode;
}) {
  const searchParams = new URLSearchParams(window.location.search);
  const [catalog, setCatalog] = useState<JsonlBibleCatalog | null>(null);
  const [chapterData, setChapterData] = useState<JsonlBibleChapter | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [bookId, setBookId] = useState(
    () =>
      searchParams.get("book") ??
      window.localStorage.getItem("bible-strong:bibles:book") ??
      "Gen"
  );
  const [chapter, setChapter] = useState(
    () =>
      Number(
        searchParams.get("chapter") ??
          window.localStorage.getItem("bible-strong:bibles:chapter")
      ) || 1
  );
  const [query, setQuery] = useState(
    () =>
      searchParams.get("bq") ??
      window.localStorage.getItem("bible-strong:bibles:query") ??
      ""
  );
  const [selectedVersions, setSelectedVersions] = useState<JsonlBibleId[]>(
    () => {
      const saved = window.localStorage.getItem("bible-strong:bibles:versions");
      if (!saved) return VERSION_ORDER;
      const requested = saved.split(",") as JsonlBibleId[];
      return VERSION_ORDER.filter((id) => requested.includes(id));
    }
  );
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<SelectedOccurrence | null>(null);
  const [displayMode, setDisplayMode] = useState<BibleDisplayMode>(() => {
    const saved = window.localStorage.getItem(
      "bible-strong:bibles:display-mode"
    );
    return saved === "verses" ? "verses" : "reading";
  });
  const [contentLocale, setContentLocale] = useState<"fr" | "en">(() => {
    const value =
      searchParams.get("locale") ||
      window.localStorage.getItem("bible-strong:lexicon-locale");
    return value === "en" ? "en" : "fr";
  });
  const [debugMode, setDebugMode] = useState(
    () =>
      searchParams.get("debug") === "1" ||
      window.localStorage.getItem("bible-strong:lexicon-debug") === "1"
  );
  const initialBookId = useRef(bookId).current;
  const initialChapter = useRef(chapter).current;

  function changeContentLocale(value: "fr" | "en") {
    setContentLocale(value);
    window.localStorage.setItem("bible-strong:lexicon-locale", value);
    const url = new URL(window.location.href);
    url.searchParams.set("locale", value);
    window.history.replaceState(null, "", url);
  }

  function changeDebugMode(value: boolean) {
    setDebugMode(value);
    window.localStorage.setItem(
      "bible-strong:lexicon-debug",
      value ? "1" : "0"
    );
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("debug", "1");
    else url.searchParams.delete("debug");
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    let cancelled = false;
    loadJsonlBibleCatalog()
      .then((nextCatalog) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        const available = nextCatalog.versions
          .filter((version) => version.available)
          .map((version) => version.id);
        setSelectedVersions((current) => {
          const retained = current.filter((id) => available.includes(id));
          return retained.length ? retained : available;
        });
        const requestedBook = nextCatalog.books.find(
          (book) => book.bookId === initialBookId
        );
        if (!requestedBook) {
          const first = nextCatalog.books[0];
          if (first) {
            setBookId(first.bookId);
            setChapter(first.chapters[0] ?? 1);
          }
        } else if (!requestedBook.chapters.includes(initialChapter)) {
          setChapter(requestedBook.chapters[0] ?? 1);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Catalogue des Bibles inaccessible"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialBookId, initialChapter]);

  const availableVersions = useMemo(
    () => catalog?.versions.filter((version) => version.available) ?? [],
    [catalog]
  );
  useEffect(() => {
    if (!catalog || selectedVersions.length === 0 || !bookId || !chapter)
      return;
    let cancelled = false;
    setLoading(true);
    setSelectedOccurrence(null);
    loadJsonlBibleChapter({
      versions: selectedVersions,
      bookId,
      chapter
    })
      .then((value) => {
        if (!cancelled) setChapterData(value);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Chapitre biblique inaccessible"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, catalog, chapter, selectedVersions]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "jsonl");
    url.searchParams.set("book", bookId);
    url.searchParams.set("chapter", String(chapter));
    if (query) url.searchParams.set("bq", query);
    else url.searchParams.delete("bq");
    window.history.replaceState(null, "", url);
    window.localStorage.setItem("bible-strong:bibles:book", bookId);
    window.localStorage.setItem("bible-strong:bibles:chapter", String(chapter));
    window.localStorage.setItem("bible-strong:bibles:query", query);
    window.localStorage.setItem(
      "bible-strong:bibles:versions",
      selectedVersions.join(",")
    );
  }, [bookId, chapter, query, selectedVersions]);

  useEffect(() => {
    window.localStorage.setItem(
      "bible-strong:bibles:display-mode",
      displayMode
    );
  }, [displayMode]);

  const chapters = useMemo(
    () => catalog?.books.find((book) => book.bookId === bookId)?.chapters ?? [],
    [bookId, catalog]
  );
  const visibleVersions = useMemo(
    () =>
      VERSION_ORDER.filter((id) => selectedVersions.includes(id))
        .map((id) => chapterData?.versions.find((version) => version.id === id))
        .filter((value) => value !== undefined),
    [chapterData, selectedVersions]
  );
  const verseGroups = useMemo(() => {
    const byRef = new Map<string, Map<JsonlBibleId, JsonlBibleVerse>>();
    for (const version of visibleVersions) {
      for (const verse of version.verses) {
        const group = byRef.get(verse.ref) ?? new Map();
        group.set(version.id, verse);
        byRef.set(verse.ref, group);
      }
    }
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return [...byRef.entries()]
      .map(([ref, versions]) => ({ ref, versions }))
      .filter(({ ref, versions }) => {
        if (!needle) return true;
        return (
          ref.toLowerCase().includes(needle) ||
          [...versions.values()].some((verse) =>
            `${stripMarkup(verse.text)} ${verse.text}`
              .toLocaleLowerCase("fr-FR")
              .includes(needle)
          )
        );
      })
      .sort(
        (left, right) =>
          (left.versions.values().next().value?.verse ?? 0) -
          (right.versions.values().next().value?.verse ?? 0)
      );
  }, [query, visibleVersions]);

  const chapterPosition = chapters.indexOf(chapter);
  const selectedGridWidth = Math.max(1, visibleVersions.length) * 300;

  function toggleVersion(id: JsonlBibleId) {
    setSelectedVersions((current) => {
      if (current.includes(id)) {
        return current.length === 1
          ? current
          : current.filter((item) => item !== id);
      }
      return VERSION_ORDER.filter((item) => [...current, id].includes(item));
    });
    setSelectedOccurrence(null);
  }

  function moveChapter(direction: -1 | 1) {
    const next = chapters[chapterPosition + direction];
    if (next !== undefined) setChapter(next);
  }

  return (
    <section className="jsonl-shell flex min-h-screen flex-col lg:h-screen lg:min-h-0">
      <header className="jsonl-masthead border-border/70 sticky top-0 z-20 border-b">
        <div className="flex flex-col gap-5 p-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="jsonl-kicker gap-1.5">
                <Braces /> Bibles locales
              </Badge>
              <Badge variant="secondary">reader view</Badge>
              <span className="text-muted-foreground text-xs">
                strong · eStrong · dStrong · uStrong
              </span>
            </div>
            <h2 className="jsonl-title mt-3">Bibles</h2>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              Lis les paragraphes, notes et mises en forme éditoriales des
              traductions, ou repasse à la comparaison verset par verset.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[170px_190px_260px]">
            <Select
              value={bookId}
              onValueChange={(value) => {
                setBookId(value);
                const firstChapter =
                  catalog?.books.find((book) => book.bookId === value)
                    ?.chapters[0] ?? 1;
                setChapter(firstChapter);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Livre" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {catalog?.books.map((book) => (
                    <SelectItem key={book.bookId} value={book.bookId}>
                      {bookLabel(book.bookId)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Chapitre précédent"
                disabled={chapterPosition <= 0 || loading}
                onClick={() => moveChapter(-1)}
              >
                <ChevronLeft />
              </Button>
              <Select
                value={String(chapter)}
                onValueChange={(value) => setChapter(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {chapters.map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        Chapitre {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                aria-label="Chapitre suivant"
                disabled={
                  chapterPosition < 0 ||
                  chapterPosition >= chapters.length - 1 ||
                  loading
                }
                onClick={() => moveChapter(1)}
              >
                <ChevronRight />
              </Button>
            </div>
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="mot, Strong ou référence"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="border-border/60 flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
          <div
            className="jsonl-display-switch mr-2 flex rounded-lg border p-1"
            aria-label="Mode d’affichage biblique"
          >
            <button
              type="button"
              aria-pressed={displayMode === "reading"}
              onClick={() => setDisplayMode("reading")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition",
                displayMode === "reading" && "is-active"
              )}
            >
              <BookOpenText className="size-3.5" />
              Lecture
            </button>
            <button
              type="button"
              aria-pressed={displayMode === "verses"}
              onClick={() => setDisplayMode("verses")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition",
                displayMode === "verses" && "is-active"
              )}
            >
              <Rows3 className="size-3.5" />
              Versets
            </button>
          </div>
          <span className="text-muted-foreground mr-1 text-xs font-semibold tracking-widest uppercase">
            Versions
          </span>
          {availableVersions.map((version) => {
            const active = selectedVersions.includes(version.id);
            return (
              <button
                key={version.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleVersion(version.id)}
                className={cn(
                  "jsonl-version-toggle flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  `jsonl-version-${version.id.toLowerCase()}`,
                  active ? "is-active" : "opacity-45"
                )}
              >
                <span className="jsonl-version-dot" />
                {version.shortLabel}
                {active ? <Check className="size-3" /> : null}
              </button>
            );
          })}
          <span className="text-muted-foreground ml-auto hidden text-xs md:block">
            {verseGroups.length} versets affichés
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-h-0 overflow-auto">
          <div className="space-y-4 p-4">
            <JsonlCatalogStrip catalog={catalog} selected={selectedVersions} />
            {loading ? (
              <JsonlEmpty
                icon={Loader2}
                title="Lecture du chapitre"
                copy="Le serveur interroge uniquement les huit SQLite bibliques locaux."
                spinning
              />
            ) : verseGroups.length === 0 ? (
              <JsonlEmpty
                icon={Search}
                title="Aucun verset"
                copy="Modifie le filtre ou réactive une version."
              />
            ) : displayMode === "reading" ? (
              <div className="jsonl-natural-grid">
                {visibleVersions.map((version) => (
                  <JsonlReadingColumn
                    key={version.id}
                    version={version}
                    query={query}
                    selectedOccurrence={selectedOccurrence}
                    onSelect={setSelectedOccurrence}
                  />
                ))}
              </div>
            ) : (
              <div className="jsonl-reading-table overflow-x-auto rounded-xl border">
                <div style={{ minWidth: selectedGridWidth + 72 }}>
                  <div
                    className="jsonl-column-head grid"
                    style={{
                      gridTemplateColumns: `64px repeat(${visibleVersions.length}, minmax(280px, 1fr))`
                    }}
                  >
                    <div className="jsonl-verse-gutter">§</div>
                    {visibleVersions.map((version) => (
                      <div
                        key={version.id}
                        className={cn(
                          "jsonl-version-heading",
                          `jsonl-version-${version.id.toLowerCase()}`
                        )}
                      >
                        <span className="jsonl-version-dot" />
                        <span>{version.shortLabel}</span>
                        <small>{version.label}</small>
                      </div>
                    ))}
                  </div>
                  {verseGroups.map(({ ref, versions }) => (
                    <div
                      key={ref}
                      className="jsonl-verse-row grid"
                      style={{
                        gridTemplateColumns: `64px repeat(${visibleVersions.length}, minmax(280px, 1fr))`
                      }}
                    >
                      <div className="jsonl-verse-gutter">
                        <strong>{versions.values().next().value?.verse}</strong>
                        <span>{ref}</span>
                      </div>
                      {visibleVersions.map((version) => {
                        const verse = versions.get(version.id);
                        return (
                          <JsonlVerseCell
                            key={`${ref}:${version.id}`}
                            version={version.id}
                            verse={verse}
                            selected={
                              selectedOccurrence?.ref === ref &&
                              selectedOccurrence.version === version.id
                            }
                            onSelect={setSelectedOccurrence}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside
          className={cn(
            "jsonl-inspector border-border/70 bg-card/95 z-30 min-h-0 overflow-hidden border shadow-2xl",
            selectedOccurrence
              ? "fixed inset-x-3 bottom-3 h-[72vh] rounded-xl 2xl:static 2xl:h-auto 2xl:rounded-none 2xl:border-y-0 2xl:border-r-0 2xl:shadow-none"
              : "hidden 2xl:block 2xl:border-y-0 2xl:border-r-0 2xl:shadow-none"
          )}
        >
          <JsonlLexiconInspector
            occurrence={selectedOccurrence}
            onClear={() => setSelectedOccurrence(null)}
            renderLexiconEntry={renderLexiconEntry}
            locale={contentLocale}
            debug={debugMode}
            onLocaleChange={changeContentLocale}
            onDebugChange={changeDebugMode}
          />
        </aside>
      </div>
    </section>
  );
}

function JsonlCatalogStrip({
  catalog,
  selected
}: {
  catalog: JsonlBibleCatalog | null;
  selected: JsonlBibleId[];
}) {
  const versions =
    catalog?.versions.filter((version) => selected.includes(version.id)) ?? [];
  const totalSize = versions.reduce(
    (sum, version) => sum + version.sizeBytes,
    0
  );
  const totalTags = versions.reduce(
    (sum, version) => sum + (version.taggedTokenCount ?? 0),
    0
  );
  return (
    <div className="grid gap-2 md:grid-cols-3">
      <JsonlStat
        icon={Layers3}
        label="Corpus actif"
        value={`${versions.length} version${versions.length > 1 ? "s" : ""}`}
        detail={versions.map((version) => version.shortLabel).join(" · ")}
      />
      <JsonlStat
        icon={FileCode2}
        label="Poids SQLite"
        value={formatBytes(totalSize)}
        detail="artefacts compacts réunis"
      />
      <JsonlStat
        icon={Fingerprint}
        label="Occurrences taggées"
        value={totalTags ? totalTags.toLocaleString("fr-FR") : "—"}
        detail="Strong classiques + identités STEP"
      />
    </div>
  );
}

function JsonlStat({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="jsonl-stat-card">
      <CardContent className="flex items-center gap-3 p-3.5">
        <div className="jsonl-stat-icon">
          <Icon />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-widest uppercase">
            {label}
          </p>
          <strong className="block text-lg leading-tight">{value}</strong>
          <span className="text-muted-foreground block truncate text-xs">
            {detail}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function JsonlVerseCell({
  version,
  verse,
  selected,
  onSelect
}: {
  version: JsonlBibleId;
  verse?: JsonlBibleVerse;
  selected: boolean;
  onSelect: (occurrence: SelectedOccurrence) => void;
}) {
  const html = useMemo(
    () => (verse ? sanitizeAndDecorateJsonlText(verse.text) : ""),
    [verse]
  );
  if (!verse) {
    return <div className="jsonl-verse-cell is-missing">Verset absent</div>;
  }
  return (
    <div
      className={cn(
        "jsonl-verse-cell",
        `jsonl-version-${version.toLowerCase()}`,
        selected && "is-selected"
      )}
    >
      <div
        className="jsonl-verse-text"
        role="group"
        aria-label={`Mots annotés de ${verse.ref} dans ${version}`}
        onClick={(event) => {
          const target = (event.target as HTMLElement).closest(
            "w[strong]"
          ) as HTMLElement | null;
          if (!target) return;
          onSelect(occurrenceFromElement(target, verse.ref, version));
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const target = (event.target as HTMLElement).closest(
            "w[strong]"
          ) as HTMLElement | null;
          if (!target) return;
          event.preventDefault();
          onSelect(occurrenceFromElement(target, verse.ref, version));
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function JsonlReadingColumn({
  version,
  query,
  selectedOccurrence,
  onSelect
}: {
  version: JsonlBibleChapter["versions"][number];
  query: string;
  selectedOccurrence: SelectedOccurrence | null;
  onSelect: (occurrence: SelectedOccurrence) => void;
}) {
  const blocks = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr-FR");
    return buildReadingBlocks(version.verses).filter(
      (block) =>
        !needle ||
        block.verses.some(
          (verse) =>
            verse.ref.toLocaleLowerCase("fr-FR").includes(needle) ||
            `${stripMarkup(verse.text)} ${verse.text}`
              .toLocaleLowerCase("fr-FR")
              .includes(needle)
        )
    );
  }, [query, version.verses]);

  return (
    <article
      className={cn(
        "jsonl-natural-column",
        `jsonl-version-${version.id.toLowerCase()}`
      )}
    >
      <header className="jsonl-natural-heading">
        <span className="jsonl-version-dot" />
        <div>
          <strong>{version.shortLabel}</strong>
          <span>{version.label}</span>
        </div>
      </header>
      <div className="jsonl-natural-page">
        {blocks.map((block) => (
          <div
            key={`${block.type}:${block.verses[0]?.ref}`}
            className={cn(
              "jsonl-reading-block",
              block.type === "poetry" && "is-poetry"
            )}
          >
            {block.verses.map((verse) => (
              <JsonlReadingVerse
                key={verse.ref}
                version={version.id}
                verse={verse}
                selected={
                  selectedOccurrence?.ref === verse.ref &&
                  selectedOccurrence.version === version.id
                }
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

function JsonlReadingVerse({
  version,
  verse,
  selected,
  onSelect
}: {
  version: JsonlBibleId;
  verse: JsonlBibleVerse;
  selected: boolean;
  onSelect: (occurrence: SelectedOccurrence) => void;
}) {
  const html = useMemo(
    () => sanitizeAndDecorateJsonlText(stripReadingLayoutTags(verse.text)),
    [verse.text]
  );

  function selectWord(target: HTMLElement) {
    onSelect(occurrenceFromElement(target, verse.ref, version));
  }

  return (
    <span
      id={`verse-${version}-${verse.ref}`}
      className={cn("jsonl-reading-verse", selected && "is-selected")}
      data-verse-ref={verse.ref}
    >
      <a
        className="jsonl-inline-verse-number"
        href={`#verse-${version}-${verse.ref}`}
        aria-label={verse.ref}
      >
        {verse.verse}
      </a>
      <span
        className="jsonl-verse-text"
        role="group"
        aria-label={`Mots annotés de ${verse.ref} dans ${version}`}
        onClick={(event) => {
          const target = (event.target as HTMLElement).closest(
            "w[strong]"
          ) as HTMLElement | null;
          if (target) selectWord(target);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const target = (event.target as HTMLElement).closest(
            "w[strong]"
          ) as HTMLElement | null;
          if (!target) return;
          event.preventDefault();
          selectWord(target);
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />{" "}
    </span>
  );
}

function JsonlLexiconInspector({
  occurrence,
  onClear,
  renderLexiconEntry,
  locale,
  debug,
  onLocaleChange,
  onDebugChange
}: {
  occurrence: SelectedOccurrence | null;
  onClear: () => void;
  renderLexiconEntry?: (
    payload: LexiconEntryPayload,
    options: {
      locale: "fr" | "en";
      debug: boolean;
      concordanceVersion: JsonlBibleId;
    }
  ) => ReactNode;
  locale: "fr" | "en";
  debug: boolean;
  onLocaleChange: (locale: "fr" | "en") => void;
  onDebugChange: (debug: boolean) => void;
}) {
  const candidateCodes = useMemo(
    () => preferredLexiconCodes(occurrence),
    [occurrence]
  );
  const [selectedCode, setSelectedCode] = useState("");
  const activeStrong = candidateCodes.includes(selectedCode)
    ? selectedCode
    : (candidateCodes[0] ?? "");
  const [entry, setEntry] = useState<LexiconEntryPayload | null>(null);
  const [entryError, setEntryError] = useState("");
  const entryCache = useRef(new Map<string, LexiconEntryPayload>());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setEntryError("");
    if (!activeStrong) {
      setEntry(null);
      return;
    }

    const cached = entryCache.current.get(activeStrong);
    if (cached) {
      setEntry(cached);
      return;
    }

    setEntry(null);
    void (async () => {
      try {
        const entryResponse = await fetch(
          `/api/lexicon/entry?strong=${encodeURIComponent(activeStrong)}&include=extended`,
          { signal: controller.signal }
        );
        if (!entryResponse.ok) {
          throw new Error("Notice lexicale indisponible");
        }
        const payload = (await entryResponse.json()) as LexiconEntryPayload;
        if (cancelled) return;
        entryCache.current.set(activeStrong, payload);
        setEntry(payload);
      } catch (error) {
        if (
          cancelled ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }
        setEntryError(
          error instanceof Error ? error.message : "Notice indisponible"
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeStrong]);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {!occurrence ? (
          <JsonlEmpty
            icon={CircleDot}
            title="Fiche lexicale"
            copy="Clique sur un mot coloré pour charger ici sa notice Strong complète."
          />
        ) : (
          <>
            <div className="bg-card/95 sticky top-0 z-10 rounded-xl border p-4 shadow-sm backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "mb-2",
                      `jsonl-version-${occurrence.version.toLowerCase()}`
                    )}
                  >
                    <span className="jsonl-version-dot" />
                    {occurrence.version} · {occurrence.ref}
                  </Badge>
                  <h3 className="truncate text-xl font-semibold tracking-tight">
                    {occurrence.surface || "Strong vide"}
                  </h3>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {activeStrong || "Aucun Strong exploitable"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <div
                    className="bg-muted/60 flex rounded-lg border p-1"
                    aria-label="Langue du contenu lexical"
                  >
                    {(["fr", "en"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onLocaleChange(value)}
                        aria-pressed={locale === value}
                        className={cn(
                          "rounded-md px-2 py-1 text-[11px] font-semibold transition",
                          locale === value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {value.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant={debug ? "default" : "outline"}
                    size="icon-sm"
                    aria-label={
                      debug ? "Désactiver le debug" : "Activer le debug"
                    }
                    aria-pressed={debug}
                    onClick={() => onDebugChange(!debug)}
                  >
                    <Bug />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Fermer la fiche lexicale"
                    onClick={onClear}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              {candidateCodes.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {candidateCodes.map((code) => (
                    <Button
                      key={code}
                      type="button"
                      variant={code === activeStrong ? "secondary" : "outline"}
                      size="sm"
                      className="h-7 px-2 font-mono text-xs"
                      onClick={() => setSelectedCode(code)}
                    >
                      {code}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>

            {entryError ? (
              <JsonlEmpty
                icon={CircleDot}
                title="Notice indisponible"
                copy={entryError}
              />
            ) : null}
            {entry && renderLexiconEntry
              ? renderLexiconEntry(entry, {
                  locale,
                  debug,
                  concordanceVersion: occurrence.version
                })
              : null}
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function preferredLexiconCodes(
  occurrence: SelectedOccurrence | null
): string[] {
  if (!occurrence) return [];
  const preferred = occurrence.dstrong.length
    ? occurrence.dstrong
    : occurrence.estrong.length
      ? occurrence.estrong
      : occurrence.strong;
  return [...new Set(preferred.map(normalizeLexiconStrong).filter(Boolean))];
}

function normalizeLexiconStrong(value: string) {
  const compact = value.trim().toUpperCase();
  const match = compact.match(/^([GH])0*(\d+)([A-Z]?)$/u);
  if (!match) return compact;
  return `${match[1]}${match[2].padStart(4, "0")}${match[3] ?? ""}`;
}

function JsonlEmpty({
  icon: Icon,
  title,
  copy,
  spinning = false
}: {
  icon: typeof Search;
  title: string;
  copy: string;
  spinning?: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
        <Icon
          className={cn("text-primary size-7", spinning && "animate-spin")}
        />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">{copy}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function buildReadingBlocks(verses: JsonlBibleVerse[]): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  let current: ReadingBlock | null = null;
  let paragraphOpen = false;
  let poetryOpen = false;

  const flush = () => {
    if (current?.verses.length) blocks.push(current);
    current = null;
  };

  for (const verse of verses) {
    const opensParagraph = /<p(?:\s[^>]*)?>/iu.test(verse.text);
    const closesParagraph = /<\/p>/iu.test(verse.text);
    const opensPoetry = /<lg(?:\s[^>]*)?>/iu.test(verse.text);
    const closesPoetry = /<\/lg>/iu.test(verse.text);
    const hasPoetryLine = /<l(?:\s[^>]*)?>/iu.test(verse.text);
    const type: ReadingBlock["type"] =
      poetryOpen || opensPoetry || hasPoetryLine ? "poetry" : "paragraph";

    if (
      !current ||
      current.type !== type ||
      opensParagraph ||
      opensPoetry ||
      (!paragraphOpen && !poetryOpen)
    ) {
      flush();
      current = { type, verses: [] };
    }

    current.verses.push(verse);
    if (opensParagraph) paragraphOpen = true;
    if (opensPoetry) poetryOpen = true;
    if (closesParagraph) {
      paragraphOpen = false;
      flush();
    }
    if (closesPoetry) {
      poetryOpen = false;
      flush();
    }
  }
  flush();
  return blocks;
}

function stripReadingLayoutTags(value: string): string {
  return value.replace(/<\/?(?:p|lg)(?:\s[^>]*)?>/giu, "");
}

function sanitizeAndDecorateJsonlText(html: string): string {
  if (typeof document === "undefined") return "";
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set([
    "W",
    "P",
    "NOTE",
    "I",
    "EM",
    "B",
    "STRONG",
    "BR",
    "DIVINENAME",
    "REF",
    "L",
    "LG",
    "SMALL-CAPS",
    "SUP"
  ]);
  template.content
    .querySelectorAll("script,style,iframe,object,embed")
    .forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    const noteLabel =
      node.tagName === "NOTE" ? node.getAttribute("n")?.trim() : null;
    const referenceId =
      node.tagName === "REF" ? node.getAttribute("id")?.trim() : null;
    const compactAttributes = new Set([
      "strong",
      "estrong",
      "dstrong",
      "ustrong"
    ]);
    for (const attribute of [...node.attributes]) {
      if (node.tagName !== "W" || !compactAttributes.has(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    }
    if (node.tagName === "W") {
      const strong = splitCodes(node.getAttribute("strong"));
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "button");
      node.setAttribute("data-strong-label", strong.map(shortStrong).join("·"));
      node.setAttribute(
        "title",
        [
          node.getAttribute("strong"),
          node.getAttribute("estrong"),
          node.getAttribute("dstrong"),
          node.getAttribute("ustrong")
        ]
          .filter(Boolean)
          .join(" · ")
      );
    } else if (node.tagName === "NOTE") {
      const content = document.createElement("span");
      content.className = "jsonl-note-content";
      content.append(...node.childNodes);
      const marker = document.createElement("span");
      marker.className = "jsonl-note-marker";
      marker.textContent = noteLabel || "•";
      node.append(marker, content);
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "note");
      node.setAttribute(
        "aria-label",
        `Note${noteLabel ? ` ${noteLabel}` : ""} : ${content.textContent?.trim() ?? ""}`
      );
    } else if (node.tagName === "REF" && referenceId) {
      node.setAttribute("data-reference", referenceId);
      node.setAttribute("title", referenceId);
    }
  });
  return template.innerHTML;
}

function occurrenceFromElement(
  element: HTMLElement,
  ref: string,
  version: JsonlBibleId
): SelectedOccurrence {
  return {
    ref,
    version,
    surface:
      element.childNodes[0]?.textContent?.trim() ?? element.textContent ?? "",
    strong: splitCodes(element.getAttribute("strong")),
    estrong: splitCodes(element.getAttribute("estrong")),
    dstrong: splitCodes(element.getAttribute("dstrong")),
    ustrong: splitCodes(element.getAttribute("ustrong"))
  };
}

function splitCodes(value: string | null): string[] {
  return (value ?? "").split(/\s+/u).filter(Boolean);
}

function shortStrong(value: string): string {
  return value.replace(/^([GH])0*/u, "$1");
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function formatBytes(value: number): string {
  if (!value) return "0 o";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}
