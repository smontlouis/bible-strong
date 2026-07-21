import {
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileCode2,
  Fingerprint,
  Layers3,
  Loader2,
  Search,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
  JsonlBibleVerse
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

export function JsonlBibleView() {
  const [catalog, setCatalog] = useState<JsonlBibleCatalog | null>(null);
  const [chapterData, setChapterData] = useState<JsonlBibleChapter | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [bookId, setBookId] = useState(
    () => new URLSearchParams(window.location.search).get("book") ?? "Gen"
  );
  const [chapter, setChapter] = useState(
    () =>
      Number(new URLSearchParams(window.location.search).get("chapter")) || 1
  );
  const [query, setQuery] = useState("");
  const [selectedVersions, setSelectedVersions] =
    useState<JsonlBibleId[]>(VERSION_ORDER);
  const [selectedOccurrence, setSelectedOccurrence] =
    useState<SelectedOccurrence | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadJsonlBibleCatalog()
      .then((nextCatalog) => {
        if (cancelled) return;
        setCatalog(nextCatalog);
        const available = nextCatalog.versions
          .filter((version) => version.available)
          .map((version) => version.id);
        setSelectedVersions(available);
        const requestedBook = nextCatalog.books.find(
          (book) => book.bookId === bookId
        );
        if (!requestedBook) {
          const first = nextCatalog.books[0];
          if (first) {
            setBookId(first.bookId);
            setChapter(first.chapters[0] ?? 1);
          }
        } else if (!requestedBook.chapters.includes(chapter)) {
          setChapter(requestedBook.chapters[0] ?? 1);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Catalogue JSONL inaccessible"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableVersions = useMemo(
    () => catalog?.versions.filter((version) => version.available) ?? [],
    [catalog]
  );
  const availableIds = useMemo(
    () => availableVersions.map((version) => version.id),
    [availableVersions]
  );

  useEffect(() => {
    if (!catalog || availableIds.length === 0 || !bookId || !chapter) return;
    let cancelled = false;
    setLoading(true);
    setSelectedOccurrence(null);
    loadJsonlBibleChapter({
      versions: availableIds,
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
              : "Chapitre JSONL inaccessible"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [availableIds.join(","), bookId, catalog, chapter]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "jsonl");
    url.searchParams.set("book", bookId);
    url.searchParams.set("chapter", String(chapter));
    window.history.replaceState(null, "", url);
  }, [bookId, chapter]);

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
                <Braces /> JSONL compact
              </Badge>
              <Badge variant="secondary">reader view</Badge>
              <span className="text-muted-foreground text-xs">
                strong · eStrong · dStrong · uStrong
              </span>
            </div>
            <h2 className="jsonl-title mt-3">Table de concordance</h2>
            <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
              Huit traductions alignées verset par verset, chargées chapitre
              par chapitre depuis les JSONL finaux.
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
          <span className="text-muted-foreground mr-1 text-xs font-semibold tracking-widest uppercase">
            Colonnes
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

      <div className="grid min-h-0 flex-1 grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-auto">
          <div className="space-y-4 p-4">
            <JsonlCatalogStrip catalog={catalog} selected={selectedVersions} />
            {loading ? (
              <JsonlEmpty
                icon={Loader2}
                title="Lecture du chapitre"
                copy="Le serveur parcourt uniquement les huit JSONL locaux."
                spinning
              />
            ) : verseGroups.length === 0 ? (
              <JsonlEmpty
                icon={Search}
                title="Aucun verset"
                copy="Modifie le filtre ou réactive une version."
              />
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

        <aside className="jsonl-inspector border-border/70 bg-card/55 hidden min-h-0 border-l 2xl:block">
          <JsonlIdentityInspector
            occurrence={selectedOccurrence}
            onClear={() => setSelectedOccurrence(null)}
          />
        </aside>
      </div>

      {selectedOccurrence ? (
        <div className="border-border bg-card fixed inset-x-3 bottom-3 z-30 max-h-[58vh] overflow-auto rounded-xl border shadow-2xl 2xl:hidden">
          <JsonlIdentityInspector
            occurrence={selectedOccurrence}
            onClear={() => setSelectedOccurrence(null)}
          />
        </div>
      ) : null}
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
        label="Poids JSONL"
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

function JsonlIdentityInspector({
  occurrence,
  onClear
}: {
  occurrence: SelectedOccurrence | null;
  onClear: () => void;
}) {
  const primary = occurrence
    ? (occurrence.dstrong[0] ??
      occurrence.estrong[0] ??
      occurrence.strong[0] ??
      "")
    : "";
  const [gloss, setGloss] = useState<string>("");

  useEffect(() => {
    setGloss("");
    if (!primary) return;
    fetch(`/api/lexicon/search?q=${encodeURIComponent(primary)}&limit=1`)
      .then((response) => response.json())
      .then((payload) => {
        const row = payload.rows?.[0];
        setGloss(row?.glossFr || row?.glossEn || row?.meaningSimpleFr || "");
      })
      .catch(() => undefined);
  }, [primary]);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {!occurrence ? (
          <JsonlEmpty
            icon={CircleDot}
            title="Inspecteur d’identité"
            copy="Clique sur un mot coloré pour voir les identités Strong exactes inscrites dans le JSONL."
          />
        ) : (
          <>
            <Card className="jsonl-inspector-card">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
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
                    <CardTitle className="jsonl-inspector-word">
                      {occurrence.surface || "Strong vide"}
                    </CardTitle>
                    <CardDescription>
                      {gloss || "Résolution lexicale exacte de l’occurrence"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Fermer l’inspecteur"
                    onClick={onClear}
                  >
                    <X />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <IdentityLevel
                  label="Strong"
                  value={occurrence.strong}
                  copy="Identifiant classique compatible avec l’application."
                  tone="classic"
                />
                <IdentityLevel
                  label="eStrong"
                  value={occurrence.estrong}
                  copy="Extension morphologique ou lexicale STEP."
                  tone="extended"
                />
                <IdentityLevel
                  label="dStrong"
                  value={occurrence.dstrong}
                  copy="Sens ou forme désambiguïsée pour cette occurrence."
                  tone="distinguished"
                />
                <IdentityLevel
                  label="uStrong"
                  value={occurrence.ustrong}
                  copy="Identité de regroupement et navigation croisée."
                  tone="unified"
                />
              </CardContent>
            </Card>
            <div className="jsonl-lookup-rule rounded-lg border p-3 text-sm">
              <p className="font-semibold">Cible lexicale primaire</p>
              <code>{primary || "—"}</code>
              <p className="text-muted-foreground mt-2 text-xs leading-5">
                Priorité utilisée : dStrong, puis eStrong, puis Strong. uStrong
                sert au regroupement.
              </p>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function IdentityLevel({
  label,
  value,
  copy,
  tone
}: {
  label: string;
  value: string[];
  copy: string;
  tone: string;
}) {
  return (
    <div className={cn("jsonl-identity-level", `is-${tone}`)}>
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <div className="flex flex-wrap justify-end gap-1">
          {value.length ? (
            value.map((code) => <code key={code}>{code}</code>)
          ) : (
            <em>non émis</em>
          )}
        </div>
      </div>
      <p>{copy}</p>
    </div>
  );
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
